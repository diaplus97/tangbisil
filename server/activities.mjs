import {emptyRest,sampleTea} from '../shared/rest.mjs';
import {freeHand,restAction} from './rest-activities.mjs';
import {randomUUID} from 'node:crypto';
import {sampleMotion,getSpace,distance} from '../shared/space.mjs';

// Personal objects survive reconnects and are never a shared stock counter.
export function createActivities(db,GameError){
  db.exec(`CREATE TABLE IF NOT EXISTS pantry_items(user_id TEXT PRIMARY KEY REFERENCES users(id),data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS pantry_receipts(user_id TEXT NOT NULL REFERENCES users(id),request_id TEXT NOT NULL,signature TEXT NOT NULL,PRIMARY KEY(user_id,request_id));`);
  const fresh=()=>({candy:null,coffee:{stage:'carried',readyAt:0,roomId:null},bottle:null,rest:emptyRest()});
  function get(id,now=Date.now()){
    const row=db.prepare('SELECT data FROM pantry_items WHERE user_id=?').get(id),p=row?JSON.parse(row.data):fresh();
    p.rest={...emptyRest(),...p.rest};p.rest.tea=sampleTea(p.rest.tea,now);
    if(p.coffee.stage==='brewing'&&p.coffee.readyAt<=now)p.coffee.stage='ready';
    return p;
  }
  const save=(id,p)=>db.prepare('INSERT INTO pantry_items VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data').run(id,JSON.stringify(p));
  function near(member,station,now){
    const pose=sampleMotion(member,now),stationInfo=getSpace(member.area??'pantry').stations[station];
    if(!stationInfo||member.station!==station||pose.moving||distance(pose,stationInfo.approach)>.35)throw new GameError('오브젝트 앞으로 걸어간 뒤 이용해 주세요.');
  }
  function leave(id,room,station,now=Date.now()){
    if(station==='fridge'&&room.fixtures.fridge.owner===id)room.fixtures.fridge={open:false,owner:null,changedAt:now};
    if(station==='plant'||station==='tea'){
      const p=get(id,now);p.rest.sprayer=false;
      if(station==='tea'&&p.rest.tea?.roomId===room.id)Object.assign(p.rest.tea,{location:'personal',roomId:null,held:false,pourAt:0,pourEnd:0});
      save(id,p);
    }
    if(station==='coffee'){
      const p=get(id,now);
      if(p.coffee.roomId===room.id&&p.coffee.stage!=='carried'){
        db.prepare('UPDATE users SET drink=? WHERE id=?').run(p.coffee.stage==='ready'?'coffee':'water',id);
        p.coffee={stage:'carried',readyAt:0,roomId:null};save(id,p);
      }
    }
  }
  function act(id,room,member,input,now=Date.now()){
    const {type,requestId}=input;
    if(typeof requestId!=='string'||!/^[\w-]{8,80}$/.test(requestId))throw new GameError('요청 번호를 확인해 주세요.',400);
    const signature=JSON.stringify([type,input.itemId,input.progress,input.held,input.stow,input.point,input.operation,input.points,input.position,input.stone,input.revision,input.flower,input.tilt,input.gesture]),old=db.prepare('SELECT signature FROM pantry_receipts WHERE user_id=? AND request_id=?').get(id,requestId);
    if(old){if(old.signature!==signature)throw new GameError('같은 요청 번호의 내용이 달라요.',400);return{ok:true,replay:true};}
    const pose=sampleMotion(member,now);if(pose.moving||member.travel)throw new GameError('도착하면 이어서 할 수 있어요.');
    const p=get(id,now),fridge={...room.fixtures.fridge};
    const ownCandy=()=>{if(!p.candy||p.candy.id!==input.itemId||p.candy.state==='eaten')throw new GameError('내 사탕의 상태를 다시 확인해 주세요.');};
    const ownBottle=()=>{if(!p.bottle||p.bottle.id!==input.itemId||p.bottle.sips>=3)throw new GameError('내 음료의 상태를 다시 확인해 주세요.');};
    let changed=true;
    db.exec('BEGIN IMMEDIATE');
    try{
      if(type==='candy-take'){
        near(member,'candy',now);if(p.candy&&p.candy.state!=='eaten')throw new GameError('집어 든 사탕을 먼저 즐겨 주세요.');
        freeHand(p,input,'candy',GameError);p.candy={id:randomUUID(),state:'wrapped',progress:0,held:true};
      }else if(type==='candy-unwrap'){
        ownCandy();if(!p.candy.held||p.candy.state!=='wrapped')throw new GameError('사탕을 손에 들고 포장을 열어 주세요.');
        if(typeof input.progress!=='number'||!Number.isFinite(input.progress)||input.progress<0||input.progress>1)throw new GameError('포장을 당긴 정도를 확인해 주세요.',400);
        p.candy.progress=Math.max(p.candy.progress,input.progress);if(p.candy.progress===1)p.candy.state='open';
      }else if(type==='candy-eat'){
        ownCandy();if(!p.candy.held||p.candy.state!=='open')throw new GameError('포장을 모두 벗긴 뒤 먹을 수 있어요.');
        p.candy.state='eaten';p.candy.held=false;
        db.prepare('INSERT OR IGNORE INTO discoveries VALUES(?,?,?,?)').run(id,'honey-lemon-candy',now,'bowl');
      }else if(type==='candy-hold'){
        ownCandy();if(typeof input.held!=='boolean'||(pose.inSeat==null&&!(member.station==='candy'&&input.held)))throw new GameError('자리에 앉으면 사탕을 내려놓거나 다시 집을 수 있어요.');if(input.held)freeHand(p,input,'candy',GameError);p.candy.held=input.held;
      }else if(type==='coffee-place'){
        near(member,'coffee',now);if(p.coffee.stage!=='carried')throw new GameError('머신에 놓인 내 컵부터 확인해 주세요.');
        freeHand(p,input,'coffee',GameError);p.coffee={stage:'placed',readyAt:0,roomId:room.id};db.prepare("UPDATE users SET drink='water' WHERE id=?").run(id);
      }else if(type==='coffee-brew'){
        near(member,'coffee',now);if(p.coffee.stage!=='placed'||p.coffee.roomId!==room.id)throw new GameError('내 컵을 먼저 놓아 주세요.');
        p.coffee.stage='brewing';p.coffee.readyAt=now+4500;
      }else if(type==='coffee-take'){
        near(member,'coffee',now);if(!['placed','ready'].includes(p.coffee.stage)||p.coffee.roomId!==room.id)throw new GameError('커피가 다 내려지면 컵을 가져갈 수 있어요.');
        db.prepare('UPDATE users SET drink=? WHERE id=?').run(p.coffee.stage==='ready'?'coffee':'water',id);p.coffee={stage:'carried',readyAt:0,roomId:null};
      }else if(type==='fridge-open'){
        near(member,'fridge',now);if(fridge.open&&fridge.owner!==id)throw new GameError('다른 동료가 냉장고를 보고 있어요.');
        Object.assign(fridge,{open:true,owner:id,changedAt:now});
      }else if(type==='bottle-take'){
        near(member,'fridge',now);if(!fridge.open||fridge.owner!==id)throw new GameError('냉장고 문을 먼저 열어 주세요.');
        if(p.bottle&&p.bottle.sips<3)throw new GameError('가지고 있는 음료를 먼저 마셔 주세요.');
        freeHand(p,input,'bottle',GameError);p.bottle={id:randomUUID(),sips:0,held:true};
      }else if(type==='fridge-close'){
        near(member,'fridge',now);if(fridge.owner!==id)throw new GameError('냉장고 상태가 바뀌었어요.');Object.assign(fridge,{open:false,owner:null,changedAt:now});
      }else if(type==='bottle-sip'){
        ownBottle();if(!p.bottle.held)throw new GameError('음료를 먼저 집어 주세요.');p.bottle.sips++;if(p.bottle.sips===3)p.bottle.held=false;
      }else if(type==='bottle-hold'){
        ownBottle();if(typeof input.held!=='boolean'||pose.inSeat==null)throw new GameError('자리에 앉으면 음료를 내려놓거나 다시 집을 수 있어요.');if(input.held)freeHand(p,input,'bottle',GameError);p.bottle.held=input.held;
      }else if(/^(plant-|stone-|tea-|sand-|vase-|items-)/.test(type))changed=restAction({p,input,member,pose,room,now,near,GameError})!==false;
      else throw new GameError('알 수 없는 행동이에요.',400);
      save(id,p);db.prepare('INSERT INTO pantry_receipts VALUES(?,?,?)').run(id,requestId,signature);
      // Sand can be touched indefinitely. Old revisions are rejected even after
      // the bounded retry window expires, so stroke receipts need not grow forever.
      if(['sand-edit','vase-edit'].includes(type)){const prefix='["'+type+'",%';db.prepare("DELETE FROM pantry_receipts WHERE user_id=? AND signature LIKE ? AND rowid NOT IN (SELECT rowid FROM pantry_receipts WHERE user_id=? AND signature LIKE ? ORDER BY rowid DESC LIMIT 256)").run(id,prefix,id,prefix);}
      db.exec('COMMIT');room.fixtures.fridge=fridge;
      return{ok:true,replay:!changed};
    }catch(error){db.exec('ROLLBACK');throw error;}
  }
  function parkSand(id){const p=get(id);if(p.rest.sand?.held)p.rest.lastPlaced='sand';if(p.rest.vase?.held)p.rest.lastPlaced='vase';if(p.rest.sand)p.rest.sand.held=false;if(p.rest.vase)p.rest.vase.held=false;save(id,p);}
  return{get,act,leave,parkSand,public(id){const p=get(id);const {stone,tea,sand,vase,lastPlaced,...rest}=p.rest;return{rest:{...rest,vase:vase?{flower:vase.flower,held:vase.held}:null,sand:sand?{held:sand.held,revision:sand.revision,changedAt:sand.changedAt,changedKind:sand.changedKind}:null,stone:stone?(( {id,...s})=>s)(stone):null,tea:tea?(({id,...t})=>t)(tea):null},candy:p.candy?{state:p.candy.state,progress:p.candy.progress,held:p.candy.held}:null,coffee:p.coffee,bottle:p.bottle?{sips:p.bottle.sips,held:p.bottle.held}:null};}};
}
