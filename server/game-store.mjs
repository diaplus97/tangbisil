import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {avatarChoice} from '../shared/appearance.mjs';
import {GameError} from '../shared/errors.mjs';
export {GameError} from '../shared/errors.mjs';
import {createActivities} from './activities.mjs';
import {LEGACY_SNACK_ID,snackDefinition,snackDisplay} from '../shared/snacks.mjs';

export const SNACK_ID = LEGACY_SNACK_ID;
export const hashToken = token => createHash('sha256').update(token).digest('hex');
export function createGameStore(db,{crossRoomOffers=false}={}) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, token_hash TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
      avatar INTEGER NOT NULL, coins INTEGER NOT NULL DEFAULT 40, drink TEXT NOT NULL DEFAULT 'tea', created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS servings (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), snack_id TEXT NOT NULL,
      state TEXT NOT NULL CHECK(state IN ('sealed','open','empty')), bites INTEGER NOT NULL DEFAULT 0,
      portions INTEGER NOT NULL DEFAULT 3, source TEXT NOT NULL, created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS servings_user_created ON servings(user_id,created_at);
    CREATE TABLE IF NOT EXISTS discoveries (
      user_id TEXT NOT NULL REFERENCES users(id), snack_id TEXT NOT NULL, discovered_at INTEGER NOT NULL,
      source TEXT NOT NULL, PRIMARY KEY(user_id,snack_id)
    );
    CREATE TABLE IF NOT EXISTS offers (
      id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), room_id TEXT NOT NULL,
      snack_id TEXT NOT NULL, created_at INTEGER NOT NULL, active INTEGER NOT NULL DEFAULT 1
    );
    CREATE UNIQUE INDEX IF NOT EXISTS one_offer ON offers(owner_id,room_id) WHERE active=1;
    CREATE TABLE IF NOT EXISTS claims (
      offer_id TEXT NOT NULL REFERENCES offers(id), user_id TEXT NOT NULL REFERENCES users(id),
      PRIMARY KEY(offer_id,user_id)
    );
    CREATE TABLE IF NOT EXISTS receipts (
      user_id TEXT NOT NULL REFERENCES users(id), request_id TEXT NOT NULL, action TEXT NOT NULL,
      result TEXT NOT NULL, PRIMARY KEY(user_id,request_id)
    );
  `);
  // Additive migration: existing plates and discoveries keep their identities.
  // Cloudflare rooms have separate databases: the original room verifies claims
  // and receives a durable idempotent tasting message instead of a cross-DB FK.
  if(!db.prepare('PRAGMA table_info(servings)').all().some(c=>c.name==='offer_id'))db.exec('ALTER TABLE servings ADD COLUMN offer_id TEXT'+(crossRoomOffers?'':' REFERENCES offers(id)'));
  if(!db.prepare('PRAGMA table_info(claims)').all().some(c=>c.name==='tasted_at'))db.exec('ALTER TABLE claims ADD COLUMN tasted_at INTEGER');
  if(!db.prepare('PRAGMA table_info(receipts)').all().some(c=>c.name==='signature'))db.exec('ALTER TABLE receipts ADD COLUMN signature TEXT');
  if(!db.prepare('PRAGMA table_info(servings)').all().some(c=>c.name==='open_progress')){
    db.exec("ALTER TABLE servings ADD COLUMN open_progress REAL NOT NULL DEFAULT 0; UPDATE servings SET open_progress=1 WHERE state!='sealed'");
  }
  for(const table of ['servings','offers','discoveries'])if(!db.prepare(`PRAGMA table_info(${table})`).all().some(c=>c.name==='definition_version'))db.exec(`ALTER TABLE ${table} ADD COLUMN definition_version INTEGER NOT NULL DEFAULT 1`);
  db.exec('CREATE TABLE IF NOT EXISTS visitor_locations(user_id TEXT NOT NULL REFERENCES users(id),room_id TEXT NOT NULL,area TEXT NOT NULL,seat INTEGER,PRIMARY KEY(user_id,room_id))');
  const location=(id,room)=>db.prepare('SELECT area,seat FROM visitor_locations WHERE user_id=? AND room_id=?').get(id,room)??{area:'pantry',seat:null};
  const saveLocation=(id,room,area,seat)=>db.prepare('INSERT INTO visitor_locations VALUES(?,?,?,?) ON CONFLICT(user_id,room_id) DO UPDATE SET area=excluded.area,seat=excluded.seat').run(id,room,area,seat);
  const activities=createActivities(db,GameError);
  const getUser = id => db.prepare('SELECT id,name,avatar,coins,drink,created_at FROM users WHERE id=?').get(id);
  const serving = id => db.prepare('SELECT * FROM servings WHERE user_id=? ORDER BY created_at DESC,rowid DESC LIMIT 1').get(id) ?? null;
  const discovered = id => db.prepare('SELECT snack_id,definition_version,discovered_at,source FROM discoveries WHERE user_id=? ORDER BY discovered_at').all(id);
  const self = id => ({ ...getUser(id), serving: serving(id), discoveries: discovered(id),pantry:activities.get(id) });
  const sampleOriginRoom = id => db.prepare('SELECT room_id FROM offers WHERE id=?').get(serving(id)?.offer_id ?? '')?.room_id ?? null;
  function createUser(name, avatar, identity={}) {
    const token = identity.token ?? randomBytes(32).toString('hex');
    const id = identity.id ?? randomUUID();
    db.prepare('INSERT INTO users(id,token_hash,name,avatar,created_at) VALUES(?,?,?,?,?)').run(id,hashToken(token),name,avatar,Date.now());
    return { token, user: self(id) };
  }
  function authenticate(token) {
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    return db.prepare('SELECT id FROM users WHERE token_hash=?').get(hashToken(token))?.id ?? null;
  }
  function offers(roomId, userId) {
    return db.prepare(`SELECT o.id,o.owner_id,o.snack_id,o.definition_version,o.created_at,u.name,u.avatar,
      EXISTS(SELECT 1 FROM claims c WHERE c.offer_id=o.id AND c.user_id=?) AS claimed,
      (SELECT COUNT(*) FROM claims c WHERE c.offer_id=o.id) AS taken,
      (SELECT COUNT(*) FROM claims c WHERE c.offer_id=o.id AND c.tasted_at IS NOT NULL) AS tasted
      FROM offers o JOIN users u ON u.id=o.owner_id
      WHERE o.room_id=? AND o.active=1 AND o.created_at>? ORDER BY o.created_at DESC`).all(userId,roomId,Date.now()-86400000);
  }
  function discover(id, food) {
    const result = db.prepare('INSERT OR IGNORE INTO discoveries(user_id,snack_id,discovered_at,source,definition_version) VALUES(?,?,?,?,?)').run(id,food.snack_id,Date.now(),food.source,food.definition_version??1);
    if (result.changes) db.prepare('UPDATE users SET coins=coins+10 WHERE id=?').run(id);
    return Boolean(result.changes);
  }
  function act(id, roomId, input) {
    const { type, requestId } = input;
    if (typeof requestId !== 'string' || !/^[\w-]{8,80}$/.test(requestId)) throw new GameError('요청을 다시 시도해 주세요.',400);
    const signature=JSON.stringify([type,input.servingId,input.progress,input.offerId,input.drink,...(input.bites!==undefined?[input.bites]:[]),...(type==='appearance'?[input.avatar]:[]),...(type==='take'&&input.snackId!==undefined?[input.snackId,input.definitionVersion,input.displayId]:[])]);
    const old = db.prepare('SELECT action,result,signature FROM receipts WHERE user_id=? AND request_id=?').get(id,requestId);
    if (old) {
      if (old.action !== type) throw new GameError('이미 사용한 요청입니다.',409);
      if(old.signature!=null&&old.signature!==signature)throw new GameError('같은 요청 번호의 내용이 달라요.',409);
      return { ...JSON.parse(old.result), replay: true };
    }
    db.exec('BEGIN IMMEDIATE');
    try {
      let result = { ok: true, firstDiscovery: false };
      const food = serving(id);
      const available = food && food.state !== 'empty';
      const needOwn = () => {
        if (!food || input.servingId !== food.id) throw new GameError('접시의 상태가 바뀌었어요. 다시 열어 주세요.');
      };
      if(type==='appearance'){
        if(avatarChoice(input.avatar)!==input.avatar)throw new GameError('목록에서 옷을 골라 주세요.',400);
        db.prepare('UPDATE users SET avatar=? WHERE id=?').run(input.avatar,id);
      }else if (type === 'take') {
        if (available) throw new GameError('접시에 있는 간식을 먼저 즐겨 주세요.');
        if(input.snackId!==undefined&&!Number.isSafeInteger(input.definitionVersion))throw new GameError('간식 종류를 다시 확인해 주세요.',400);
        const explicit=input.snackId!==undefined,definition=snackDefinition(explicit?input.snackId:SNACK_ID,explicit?input.definitionVersion:1),display=snackDisplay();
        if(!definition)throw new GameError('진열된 간식을 다시 골라 주세요.',400);
        if(explicit&&(input.displayId!==display.displayId||!display.slots.some(s=>s.snackId===definition.id&&s.definitionVersion===definition.version)))throw new GameError('진열이 바뀌었어요. 지금 선반에서 다시 골라 주세요.');
        db.prepare('INSERT INTO servings(id,user_id,snack_id,definition_version,state,bites,portions,source,created_at) VALUES(?,?,?,?,?,?,?,?,?)').run(randomUUID(),id,definition.id,definition.version,'sealed',0,definition.portions,'shelf',Date.now());
      } else if (type === 'unwrap') {
        needOwn();
        if(food.state!=='sealed')throw new GameError('이미 열린 간식이에요.');
        if(typeof input.progress!=='number'||!Number.isFinite(input.progress)||input.progress<0||input.progress>=1)throw new GameError('포장을 당긴 정도를 다시 확인해 주세요.',400);
        // A delayed tab or retry can never seal an already peeled section again.
        db.prepare('UPDATE servings SET open_progress=MAX(open_progress,?) WHERE id=?').run(input.progress,food.id);
      } else if (type === 'open') {
        needOwn();
        if (food.state !== 'sealed') throw new GameError('이미 열린 간식이에요.');
        db.prepare("UPDATE servings SET state='open',open_progress=1 WHERE id=?").run(food.id);
      } else if (type === 'bite') {
        needOwn();
        if (food.state !== 'open') throw new GameError('포장을 열어 주세요.');
        if(input.bites!==undefined&&input.bites!==food.bites)throw new GameError('이미 한입 먹은 간식이에요. 지금 접시에서 이어 주세요.');
        const bites = food.bites + 1;
        db.prepare('UPDATE servings SET bites=?,state=? WHERE id=?').run(bites,bites >= food.portions ? 'empty' : 'open',food.id);
        if(food.offer_id)db.prepare('UPDATE claims SET tasted_at=COALESCE(tasted_at,?) WHERE offer_id=? AND user_id=?').run(Date.now(),food.offer_id,id);
        result.firstDiscovery = discover(id,food);
      } else if (type === 'offer') {
        if(input.servingId!==undefined)needOwn();
        if (!food||food.state==='sealed') throw new GameError('포장을 먼저 열면 한 조각 나눌 수 있어요.');
        if(food.state!=='open'||food.bites>=food.portions)throw new GameError('먹을 간식이 남아 있을 때 한 조각 나눌 수 있어요.');
        db.prepare('UPDATE offers SET active=0 WHERE owner_id=? AND room_id=? AND created_at<=?').run(id,roomId,Date.now()-86400000);
        if (db.prepare('SELECT id FROM offers WHERE owner_id=? AND room_id=? AND active=1').get(id,roomId)) throw new GameError('이미 한 접시를 놓아두었어요.');
        db.prepare('INSERT INTO offers(id,owner_id,room_id,snack_id,created_at,active,definition_version) VALUES(?,?,?,?,?,1,?)').run(randomUUID(),id,roomId,food.snack_id,Date.now(),food.definition_version??1);
      } else if (type === 'sample') {
        if (available) throw new GameError('내 접시의 간식을 먼저 먹어 주세요.');
        const offer = db.prepare('SELECT * FROM offers WHERE id=? AND room_id=? AND active=1 AND created_at>?').get(input.offerId ?? '',roomId,Date.now()-86400000);
        if (!offer || offer.owner_id === id) throw new GameError('다른 사람이 놓은 시식을 골라 주세요.');
        if (db.prepare('SELECT 1 FROM claims WHERE offer_id=? AND user_id=?').get(offer.id,id)) throw new GameError('이미 맛본 시식이에요.');
        db.prepare('INSERT INTO claims(offer_id,user_id) VALUES(?,?)').run(offer.id,id);
        db.prepare('INSERT INTO servings(id,user_id,snack_id,definition_version,state,bites,portions,source,created_at,offer_id,open_progress) VALUES(?,?,?,?,?,?,?,?,?,?,1)').run(randomUUID(),id,offer.snack_id,offer.definition_version??1,'open',0,1,'shared',Date.now(),offer.id);
      } else if (type === 'retract') {
        db.prepare('UPDATE offers SET active=0 WHERE id=? AND owner_id=? AND room_id=?').run(input.offerId ?? '',id,roomId);
      } else if (type === 'drink') {
        if (!['tea','coffee','water'].includes(input.drink)) throw new GameError('음료를 선택해 주세요.',400);
        db.prepare('UPDATE users SET drink=? WHERE id=?').run(input.drink,id);
      } else if (type !== 'wave') throw new GameError('알 수 없는 행동이에요.',400);
      if(['take','open','bite','sample'].includes(type))activities.stow(id);
      db.prepare('INSERT INTO receipts(user_id,request_id,action,result,signature) VALUES(?,?,?,?,?)').run(id,requestId,type,JSON.stringify(result),signature);
      db.exec('COMMIT');
      return result;
    } catch (e) { db.exec('ROLLBACK'); throw e; }
  }
  return { db, location,saveLocation,activities, createUser, authenticate, self, getUser, serving, sampleOriginRoom, offers, act, close: () => db.close() };
}
