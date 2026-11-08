import http from 'node:http';
import {sandContact} from './sand-contact.mjs';
import {roomSnapshot,roomSnapshotBatch,validateSnackAction,actionNames as actions} from './room-view.mjs';
import { stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { createStore, GameError } from './store.mjs';
import {completeTravel,clearParkedTray,reservedSeats} from './travel.mjs';
import {moveVisitor} from './movement.mjs';
import {avatarChoice} from '../shared/appearance.mjs';
import {serveStatic} from './static.mjs';
import {getSpace} from '../shared/space.mjs';
import {startRoomMedia,mediaAction,migrateTvQueue} from '../shared/room-media.mjs';
import {objectInput,actionInput} from '../shared/requests.mjs';

export function createPantryServer({ database='data/pantry.sqlite', staticDir='dist', middleware, graceMs=5000 }={}) {
  const store = createStore(database);
  store.db.exec('CREATE TABLE IF NOT EXISTS room_media (id TEXT PRIMARY KEY, data TEXT NOT NULL)');
  const saveMedia=r=>store.db.prepare('INSERT INTO room_media VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(r.id,JSON.stringify(r.media));
  const rooms = new Map();
  const rate = new Map();
  let version = 0;
  let closing = false;
  function room(id) {
    if (!/^[a-zA-Z0-9_-]{1,40}$/.test(id)) throw new GameError('방 주소를 확인해 주세요.',400);
    if (!rooms.has(id)) rooms.set(id,{ id, media:JSON.parse(store.db.prepare('SELECT data FROM room_media WHERE id=?').get(id)?.data??'null'), members:new Map(), history:[],fixtures:{fridge:{open:false,owner:null,changedAt:0}} });
    const r=rooms.get(id);if(migrateTvQueue(r)){saveMedia(r);broadcast(r);}return r;
  }
  const snapshot=(r,id)=>roomSnapshot(store,r,id,version);
  function broadcast(r) {
    version++;const view=roomSnapshotBatch(store,r,version);
    for (const m of r.members.values()) {
      if(!m.streams.size)continue;
      const data=`event: state\ndata: ${JSON.stringify(view(m.id))}\n\n`;
      for (const res of m.streams) { if (!res.destroyed) res.write(data); }
    }
  }
  function attach(id, roomId, res) {
    const r=room(roomId);
    let m=r.members.get(id);
    if (!m) {
      if(r.members.size>=6)throw new GameError('이 방은 잠시 만석이에요. 다른 방 링크로 함께 들어와 주세요.',409);
      startRoomMedia(r);saveMedia(r);
      const saved=store.location(id,roomId),area=saved.area==='healing'?'healing':'pantry',occupied=reservedSeats(r,area,id),seats=getSpace(area).seats;
      const seat=Number.isInteger(saved.seat)&&saved.seat>=0&&saved.seat<seats.length&&!occupied.has(saved.seat)?saved.seat:seats.map((_,i)=>i).find(n=>!occupied.has(n));
      if (seat === undefined) throw new GameError('이 방은 잠시 만석이에요. 다른 방 링크로 함께 들어와 주세요.',409);
      const slots=new Set([...r.members.values()].map(x=>x.slot));
      m={id,area,travel:null,enteredAt:0,seat,slot:[0,1,2,3,4,5].find(n=>!slots.has(n)),station:null,motion:null,moves:new Map(),arrival:null,brewTimer:null,streams:new Set(),action:'rest',actionAt:Date.now(),timer:null};
      // An abandoned machine gives the visitor their one cup back on reconnect.
      const pantry=store.activities.get(id),coffee=pantry.coffee;
      if(pantry.rest.sprayer&&!([...rooms.values()].some(active=>active.members.get(id)?.station==='plant')))store.activities.leave(id,r,'plant');
      if(pantry.rest.tea?.location==='station'&&!([...rooms.values()].some(active=>active.members.get(id)?.station==='tea')))store.activities.leave(id,{id:pantry.rest.tea.roomId,fixtures:r.fixtures},'tea');
      if(coffee.stage!=='carried'&&coffee.roomId&&!([...rooms.values()].some(active=>active.members.get(id)?.station==='coffee'))){store.activities.leave(id,{id:coffee.roomId,fixtures:r.fixtures},'coffee');}
      clearParkedTray(r,area,seat);r.members.set(id,m);store.saveLocation(id,r.id,area,seat);
    }
    clearTimeout(m.timer);
    res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});
    res.write(': connected\n\n');
    m.streams.add(res);
    broadcast(r);
    res.on('close',()=>{
      m.streams.delete(res);
      if(closing)return;
      if (!m.streams.size) {
        m.contact=null;
        if(m.travel||m.motion?.keyboard){clearTimeout(m.arrival);moveVisitor(r,m,{type:'stand',requestId:'disconnect-'+Date.now()});}
        if(m.station==='tea'||m.station==='plant'){store.activities.leave(id,r,m.station);clearTimeout(m.brewTimer);}
        broadcast(r);
        m.timer=setTimeout(()=>{ if (!m.streams.size) {clearTimeout(m.arrival);clearTimeout(m.brewTimer);store.activities.leave(id,r,m.station);r.members.delete(id);if(!r.members.size){r.media.emptyAt=Date.now();saveMedia(r);}broadcast(r);} },graceMs);
        m.timer.unref();
      }
    });
  }
  function scheduleArrival(r,m){
    clearTimeout(m.arrival);const trip=m.travel,motionId=m.motion?.id,deadline=trip?trip.enterAt:m.motion?.endsAt??Date.now();
    m.arrival=setTimeout(()=>{if(r.members.get(m.id)!==m||m.motion?.id!==motionId)return;
      if(m.travel){if(!m.streams.size)return;completeTravel(m);if(m.area==='pantry')store.activities.parkSand(m.id);store.saveLocation(m.id,r.id,m.area,m.seat);broadcast(r);scheduleArrival(r,m);}
      else {store.saveLocation(m.id,r.id,m.area??'pantry',m.seat);broadcast(r);}
    },Math.max(0,deadline-Date.now())+15);m.arrival.unref();
  }
  const heartbeat=setInterval(()=>{for(const r of rooms.values()) for(const m of r.members.values()) for(const res of m.streams)res.write(': heartbeat\n\n');},10000);
  heartbeat.unref();
  const send=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
  async function body(req) {
    let text='';
    for await (const chunk of req) {text+=chunk;if(Buffer.byteLength(text)>8192)throw new GameError('요청이 너무 커요.',413);}
    try{return objectInput(JSON.parse(text||'{}'));}catch{throw new GameError('요청 형식이 올바르지 않아요.',400);}
  }
  const server=http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','same-origin');
    try {
      const url=new URL(req.url,'http://localhost');
      if(url.pathname.startsWith('/api/')) {
        if(req.headers.origin){let origin;try{origin=new URL(req.headers.origin);}catch{throw new GameError('같은 주소에서 접속해 주세요.',403);}if(origin.host!==req.headers.host)throw new GameError('같은 주소에서 접속해 주세요.',403);}
        const ip=req.socket.remoteAddress;
        const usage=rate.get(ip)??{time:Date.now(),count:0};
        if(Date.now()-usage.time>60000){usage.time=Date.now();usage.count=0;}
        usage.count++;rate.set(ip,usage);
        if(usage.count>2000)throw new GameError('잠시 후 다시 시도해 주세요.',429);
        if(url.pathname==='/api/health'){send(res,200,{ok:true,app:'tangbisil',version:'0.4.0'});return;}
        if(url.pathname==='/api/session'&&req.method==='POST') {
          const data=await body(req), name=typeof data.name==='string'?data.name.trim():'';
          if(!name||[...name].length>12||/[\u0000-\u001f<>]/.test(name))throw new GameError('이름은 1~12자로 적어 주세요.',400);
          send(res,201,store.createUser(name,avatarChoice(data.avatar)));return;
        }
        const id=store.authenticate(req.headers.authorization?.replace(/^Bearer /,''));
        if(!id)throw new GameError('자리를 다시 잡아 주세요.',401);
        if(url.pathname==='/api/me'&&req.method==='GET'){send(res,200,{self:store.self(id)});return;}
        const roomId=url.searchParams.get('room')??'window';
        if(url.pathname==='/api/events'&&req.method==='GET'){attach(id,roomId,res);return;}
        if(url.pathname==='/api/action'&&req.method==='POST') {
          const input=actionInput(await body(req));
          const r=room(roomId), m=r.members.get(id);
          if(!m?.streams.size)throw new GameError('방에 연결하고 있어요. 잠시 후 다시 눌러 주세요.',409);
          if(input.type==='tv-join'||input.type==='tv-next'){const result=mediaAction(r,m,input,GameError);if(!result.replay){saveMedia(r);broadcast(r);}send(res,200,{...result,state:snapshot(r,id)});return;}
          if(input.type==='sand-contact'){const changed=sandContact(m,store.activities.get(id).rest.sand,input,GameError);if(changed)broadcast(r);send(res,200,{ok:true});return;}
          if(['move','sit','stand','approach','travel'].includes(input.type)){
            const previousStation=m.station;
            const result=moveVisitor(r,m,input);
            if(!result.replay){
              if(previousStation!==m.station){store.activities.leave(id,r,previousStation);clearTimeout(m.brewTimer);}
              clearTimeout(m.arrival);m.contact=null;m.action='rest';m.actionAt=Date.now();broadcast(r);
              scheduleArrival(r,m);
            }
            send(res,200,{...result,state:snapshot(r,id)});return;
          }
          if(/^(cup-|candy-|coffee-|fridge-|bottle-|plant-|stone-|tea-|sand-|vase-|items-)/.test(input.type)){
            const result=store.activities.act(id,r,m,input);
            if(!result.replay){if(input.type!=='sand-edit')m.contact=null;else if(input.gesture===true)m.contact={gestureId:input.requestId,kind:input.operation==='stone'?'stone':'rake',until:Date.now()+320};m.action=input.type;m.actionAt=Date.now();
              if(input.type==='tea-pour'){clearTimeout(m.brewTimer);const t=store.activities.get(id).rest.tea;m.brewTimer=setTimeout(()=>{if(r.members.get(id)===m)broadcast(r);},Math.max(0,t.pourEnd-Date.now())+20);m.brewTimer.unref();}
              if(input.type==='coffee-brew'){clearTimeout(m.brewTimer);m.brewTimer=setTimeout(()=>{if(r.members.get(id)===m)broadcast(r);},4520);m.brewTimer.unref();}
            }
            for(const activeRoom of rooms.values())if(activeRoom.members.has(id))broadcast(activeRoom);
            send(res,200,{...result,state:snapshot(r,id)});return;
          }
          validateSnackAction(store,m,input);
          const sampleRoom=input.type==='bite'?store.sampleOriginRoom(id):null;
          const result=store.act(id,roomId,input);
          if(!result.replay&&actions[input.type]) {
            m.action=input.type;m.actionAt=Date.now();
            r.history.unshift({area:m.area??'pantry',id:input.requestId,name:store.getUser(id).name,text:actions[input.type],at:Date.now()});
            r.history=r.history.slice(0,4);
          }
          // Personal progress follows every open tab; tasting also updates its original shared plate.
          for(const activeRoom of rooms.values())if(activeRoom.members.has(id)||activeRoom.id===sampleRoom)broadcast(activeRoom);
          send(res,200,{...result,state:snapshot(r,id)});return;
        }
        throw new GameError('찾을 수 없는 요청이에요.',404);
      }
      if(middleware){middleware(req,res,()=>send(res,404,{error:'Not found'}));return;}
      const root=resolve(staticDir);
      const decoded=decodeURIComponent(url.pathname);
      const file=resolve(root,'.'+decoded);
      if(file!==root&&!file.startsWith(root+sep))throw new GameError('잘못된 경로입니다.',400);
      let target=file;
      try{if(!(await stat(file)).isFile())target=resolve(root,'index.html');}catch{target=resolve(root,'index.html');}
      await serveStatic(req,res,target);
    } catch(e) {
      if(!res.headersSent)send(res,e.status??500,{error:e.status?e.message:'잠시 연결이 어려워요. 다시 시도해 주세요.'});
      else res.end();
      if(!e.status)console.error(e);
    }
  });
  return {server,store,close:async()=>{
    closing=true;
    clearInterval(heartbeat);
    for(const r of rooms.values())for(const m of r.members.values()){clearTimeout(m.timer);clearTimeout(m.arrival);clearTimeout(m.brewTimer);store.activities.leave(m.id,r,m.station);for(const res of m.streams)res.end();}
    await new Promise(resolve=>server.close(resolve));store.close();
  }};
}
