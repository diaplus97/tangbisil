import {DurableObject} from 'cloudflare:workers';
import {sqliteAdapter,jsonStore} from './sql.mjs';
import {captureUser,restoreUser} from './checkpoint.mjs';
import {createGameStore} from '../server/game-store.mjs';
import {GameError} from '../shared/errors.mjs';
import {getSpace} from '../shared/space.mjs';
import {moveVisitor} from '../server/movement.mjs';
import {completeTravel,clearParkedTray,reservedSeats} from '../server/travel.mjs';
import {sandContact} from '../server/sand-contact.mjs';
import {roomSnapshot,roomSnapshotBatch,validateSnackAction,actionNames} from '../server/room-view.mjs';
import {startRoomMedia,mediaAction,migrateTvQueue,needsTvQueueMigration} from '../shared/room-media.mjs';
import {actionInput} from '../shared/requests.mjs';

const fresh=id=>({id,members:[],history:[],fixtures:{fridge:{open:false,owner:null,changedAt:0}},version:0,pending:{},releases:[],tastes:[],tickets:{},quota:{day:0,count:0},retryAt:0,retries:0});
export class PantryRoom extends DurableObject {
  constructor(ctx,env){
    super(ctx,env);this.db=sqliteAdapter(ctx.storage);this.json=jsonStore(this.db);this.store=createGameStore(this.db,{crossRoomOffers:true});this.tail=Promise.resolve();this.load();
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping','pong'));
    // A process restart can lose sockets without a close callback. Hibernated
    // sockets are restored by getWebSockets and must keep their existing seats.
    let orphaned=false;for(const m of this.r.members.values())if(!this.sockets(m.id).length&&!m.departAt){m.departAt=Date.now()+5000;orphaned=true;}
    if(orphaned){this.save();ctx.blockConcurrencyWhile(()=>this.schedule());}
  }
  load(){
    this.r=this.json.get('room',fresh(null));
    this.r.members=new Map(this.r.members.map(m=>[m.id,{...m,moves:new Map(m.moves),contacts:new Map(m.contacts??[])}]));
  }
  encoded(){return {...this.r,members:[...this.r.members.values()].map(m=>({...m,moves:[...m.moves],contacts:[...(m.contacts??new Map())]}))};}
  save(){this.json.set('room',this.encoded());}
  exclusive(fn){const result=this.tail.then(fn);this.tail=result.catch(()=>{});return result;}
  atomic(fn){try{return this.ctx.storage.transactionSync(()=>{const value=fn();this.save();return value;});}catch(error){this.load();throw error;}}
  sockets(id){return this.ctx.getWebSockets(id).filter(ws=>ws.readyState===1);}
  home(key){return this.env.VISITORS.get(this.env.VISITORS.idFromName(key));}
  other(room){return this.env.ROOMS.get(this.env.ROOMS.idFromName(room));}
  snapshot(id){return roomSnapshot(this.store,this.r,id,this.r.version,m=>this.sockets(m.id).length>0);}
  broadcast(){const view=roomSnapshotBatch(this.store,this.r,this.r.version,m=>this.sockets(m.id).length>0);for(const m of this.r.members.values()){const sockets=this.sockets(m.id);if(!sockets.length)continue;const value=JSON.stringify({type:'state',state:view(m.id)});for(const ws of sockets)try{ws.send(value);}catch{}}}
  queueUser(m){
    const previous=this.r.pending[m.key];if(!previous)m.revision++;
    const checkpoint=captureUser(this.db,m.id),food=checkpoint.tables.servings[0];
    m.originRoom=food?.offer_id?(this.store.sampleOriginRoom(m.id)??m.originRoom):null;
    checkpoint.originRoom=m.originRoom;
    this.r.pending[m.key]={key:m.key,epoch:m.epoch,revision:m.revision,checkpoint};
  }
  async flush(){
    try{
      for(const [key,pending] of Object.entries(this.r.pending)){
        const result=await this.home(key).commit(this.r.id,pending.epoch,pending.revision,pending.checkpoint);
        if(!result.ok)throw new GameError('기록 저장을 다시 확인하고 있어요. 같은 행동을 다시 눌러 주세요.',503);
        delete this.r.pending[key];this.save();
      }
      while(this.r.tastes.length){const taste=this.r.tastes[0];await this.other(taste.room).markTasted(taste.offerId,taste.userId,taste.at);this.r.tastes.shift();this.save();}
      while(this.r.releases.length){const release=this.r.releases[0];await this.home(release.key).release(this.r.id,release.epoch);this.r.releases.shift();this.save();}
      if(this.r.retryAt||this.r.retries){this.r.retryAt=0;this.r.retries=0;this.save();}
    }catch(error){
      this.r.retries++;this.r.retryAt=this.r.retries<=3?Date.now()+10000:0;this.save();await this.schedule();throw error;
    }
  }
  async schedule(){
    // Overdue game timers cannot bypass a failed outbox's backoff or restart
    // automatic retries after its budget is exhausted. An explicit action can retry.
    const times=(this.r.retries&&this.hasOutbox()?[this.r.retryAt]:[...[...this.r.members.values()].flatMap(m=>[m.departAt,m.arriveAt,m.readyAt])]).filter(t=>t>0);
    const next=times.length?Math.max(Date.now()+20,Math.min(...times)):null,current=await this.ctx.storage.getAlarm();
    if(next!==null){if(current!==next)await this.ctx.storage.setAlarm(next);}else if(current!==null)await this.ctx.storage.deleteAlarm();
  }
  remove(m){
    this.store.activities.leave(m.id,this.r,m.station);this.queueUser(m);
    this.r.releases.push({key:m.key,epoch:m.epoch});this.r.members.delete(m.id);
    if(!this.r.members.size&&this.r.media)this.r.media.emptyAt=Date.now();
    for(const [ticket,value] of Object.entries(this.r.tickets))if(value.id===m.id)delete this.r.tickets[ticket];
  }
  async advance(){
    const recovering=Object.keys(this.r.pending).length>0;await this.flush();if(recovering)this.broadcast();const now=Date.now();let changed=false;
    if(needsTvQueueMigration(this.r)){this.atomic(()=>{migrateTvQueue(this.r,now);this.r.version++;});this.broadcast();}
    const due=[...this.r.members.values()].some(m=>(m.departAt&&m.departAt<=now)||(m.arriveAt&&m.arriveAt<=now)||(m.readyAt&&m.readyAt<=now));
    if(due)this.atomic(()=>{
      for(const m of this.r.members.values()){
        if(m.departAt&&m.departAt<=now&&!this.sockets(m.id).length){this.remove(m);changed=true;continue;}
        if(m.arriveAt&&m.arriveAt<=now){
          if(m.travel){completeTravel(m,now);if(m.area==='pantry')this.store.activities.parkSand(m.id);m.arriveAt=m.motion?.endsAt??0;}
          else m.arriveAt=0;
          this.store.saveLocation(m.id,this.r.id,m.area,m.seat);this.queueUser(m);changed=true;
        }
        if(m.readyAt&&m.readyAt<=now){m.readyAt=0;this.queueUser(m);changed=true;}
      }
      if(changed)this.r.version++;
    });
    await this.flush();if(changed)this.broadcast();await this.schedule();
  }
  prepare(room,key){return this.exclusive(async()=>{
    await this.advance();if(this.r.id&&this.r.id!==room)throw Error('Room identity mismatch');
    const identity=await this.home(key).identity();if(!identity)return {error:'자리를 다시 잡아 주세요.',status:401};
    let m=this.r.members.get(identity.id);
    if(!m&&this.r.members.size>=6)return {error:'지금은 여섯 자리가 모두 찼어요. 잠시 뒤 다시 들어오거나 다른 방을 골라 주세요.',status:409,retryAfter:30};
    if(this.sockets(identity.id).length>=2)return {error:'같은 방문자는 두 화면까지 함께 열 수 있어요.',status:409,retryAfter:30};
    const claimed=await this.home(key).claim(room);
    if(claimed.error||claimed.conflict)return {...claimed,status:claimed.status??409};
    this.atomic(()=>{
      this.r.id=room;
      startRoomMedia(this.r);
      if(!m){
        restoreUser(this.db,claimed.checkpoint);
        const saved=this.store.location(identity.id,room),area=saved.area==='healing'?'healing':'pantry',occupied=reservedSeats(this.r,area,identity.id),seats=getSpace(area).seats;
        const seat=Number.isInteger(saved.seat)&&saved.seat>=0&&saved.seat<seats.length&&!occupied.has(saved.seat)?saved.seat:seats.findIndex((_,i)=>!occupied.has(i));
        if(seat<0)throw new GameError('빈 자리가 생기면 들어올 수 있어요.');
        const used=new Set([...this.r.members.values()].map(member=>member.slot));
        m={id:identity.id,key,epoch:claimed.epoch,revision:claimed.revision,originRoom:claimed.checkpoint.originRoom??null,area,seat,slot:[0,1,2,3,4,5].find(i=>!used.has(i)),station:null,motion:null,travel:null,enteredAt:0,moves:new Map(),contacts:new Map(),contact:null,action:'rest',actionAt:Date.now(),arriveAt:0,readyAt:0,departAt:Date.now()+30000,rate:{at:0,count:0}};
        clearParkedTray(this.r,area,seat);this.r.members.set(m.id,m);this.store.saveLocation(m.id,room,area,seat);this.queueUser(m);
      }
      for(const [ticket,value] of Object.entries(this.r.tickets))if(value.until<Date.now()||value.id===m.id)delete this.r.tickets[ticket];
      const ticket=crypto.randomUUID();this.r.tickets[ticket]={id:m.id,until:Date.now()+30000};this.r.version++;
    });
    await this.flush();await this.schedule();
    return {ok:true,ticket:Object.entries(this.r.tickets).find(([,value])=>value.id===m.id)[0],transport:'websocket'};
  });}
  detach(key,expectedRoom){return this.exclusive(async()=>{
    await this.advance();const m=[...this.r.members.values()].find(member=>member.key===key);
    if(m){for(const ws of this.sockets(m.id)){ws.send(JSON.stringify({type:'relocated',error:'다른 방으로 자리를 옮겼어요. 이 화면은 쉬어 둘게요.'}));ws.close(4001,'Moved to another room');}
      this.atomic(()=>{this.remove(m);this.r.version++;});await this.flush();this.broadcast();await this.schedule();}
    if(!m){const identity=await this.home(key).identity();if(identity?.room===expectedRoom)await this.home(key).release(expectedRoom,identity.epoch);}
    return {ok:true};
  });}
  // Deliberately synchronous: a taste outbox may arrive while this room is
  // flushing another outbox. It must never await the other room or a visitor.
  markTasted(offerId,userId,at){
    this.atomic(()=>{this.db.prepare('UPDATE claims SET tasted_at=COALESCE(tasted_at,?) WHERE offer_id=? AND user_id=?').run(at,offerId,userId);this.r.version++;});this.broadcast();return {ok:true};
  }
  fetch(request){return this.exclusive(async()=>{
    try{
      await this.advance();
      if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return new Response('WebSocket required',{status:426});
      const protocols=request.headers.get('Sec-WebSocket-Protocol')?.split(',').map(s=>s.trim())??[];
      const ticket=protocols.find(p=>p.startsWith('ticket.'))?.slice(7),grant=this.r.tickets[ticket],m=grant&&this.r.members.get(grant.id);
      if(!protocols.includes('pantry.v1')||!grant||grant.until<Date.now()||!m)return new Response('Expired connection ticket',{status:401});
      if(this.sockets(m.id).length>=2)return new Response('Too many tabs',{status:409});
      const pair=new WebSocketPair(),[client,server]=Object.values(pair);
      this.ctx.acceptWebSocket(server,[m.id]);server.serializeAttachment({id:m.id,key:m.key,epoch:m.epoch});
      this.atomic(()=>{delete this.r.tickets[ticket];m.departAt=0;this.r.version++;});
      this.broadcast();await this.schedule();
      return new Response(null,{status:101,webSocket:client,headers:{'Sec-WebSocket-Protocol':'pantry.v1'}});
    }catch(error){return Response.json({error:error.status?error.message:'잠시 연결을 쉬고 있어요.'},{status:error.status??503});}
  });}
  consume(m){
    const now=Date.now(),day=Math.floor(now/86400000);
    if(this.r.quota.day!==day)this.r.quota={day,count:0};
    if(this.r.quota.count>=Number(this.env.ROOM_DAILY_MESSAGES??2000))throw new GameError('오늘 이 방은 충분히 쉬었어요. 내일 다시 만나요. 기록은 그대로 보관해 둘게요.',429);
    if(now-m.rate.at>=1000)m.rate={at:now,count:0};
    if(m.rate.count>=8)throw new GameError('손을 잠깐 쉬었다가 천천히 이어 주세요.',429);
    m.rate.count++;this.r.quota.count++;
  }
  webSocketMessage(ws,message){return this.exclusive(async()=>{
    let input;
    try{
      if(typeof message!=='string'||message.length>8192){ws.close(1009,'Message too large');return;}
      let frame;try{frame=JSON.parse(message);}catch{ws.close(1008,'Invalid message');return;}
      if(!frame||typeof frame!=='object'||Array.isArray(frame)||frame.type!=='action'||!frame.input||typeof frame.input!=='object'||Array.isArray(frame.input)){ws.close(1008,'Invalid action');return;}input=frame.input;
      await this.advance();const attachment=ws.deserializeAttachment(),m=this.r.members.get(attachment.id);
      if(!m||m.key!==attachment.key||m.epoch!==attachment.epoch)throw new GameError('자리를 다시 잡아 주세요.',401);
      // Persist usage separately so rejected game actions cannot roll it back.
      this.atomic(()=>this.consume(m));let result;
      actionInput(input);
      this.atomic(()=>{
        if(input.type==='tv-join'||input.type==='tv-next')result=mediaAction(this.r,m,input,GameError);
        else if(input.type==='sand-contact'){const changed=sandContact(m,this.store.activities.get(m.id).rest.sand,input,GameError);result={ok:true,replay:!changed};}
        else if(['move','sit','stand','approach','travel'].includes(input.type)){
          const previous=m.station;result=moveVisitor(this.r,m,input);
          if(!result.replay){if(previous!==m.station){this.store.activities.leave(m.id,this.r,previous);m.readyAt=0;}m.contact=null;m.action='rest';m.actionAt=Date.now();m.arriveAt=(m.travel?.enterAt??m.motion?.endsAt??Date.now())+15;this.queueUser(m);}
        }else if(/^(cup-|candy-|coffee-|fridge-|bottle-|plant-|stone-|tea-|sand-|vase-|items-)/.test(input.type)){
          result=this.store.activities.act(m.id,this.r,m,input);
          if(!result.replay){
            if(input.type!=='sand-edit')m.contact=null;else if(input.gesture===true)m.contact={gestureId:input.requestId,kind:input.operation==='stone'?'stone':'rake',until:Date.now()+320};
            m.action=input.type;m.actionAt=Date.now();const p=this.store.activities.get(m.id);
            if(input.type==='coffee-brew')m.readyAt=p.coffee.readyAt+20;if(input.type==='tea-pour')m.readyAt=p.rest.tea.pourEnd+20;
            this.queueUser(m);
          }
        }else{
          validateSnackAction(this.store,m,input);const food=this.store.serving(m.id),origin=m.originRoom;
          result=this.store.act(m.id,this.r.id,input);
          if(!result.replay){
            if(input.type==='bite'&&food?.offer_id&&origin&&origin!==this.r.id)this.r.tastes.push({room:origin,offerId:food.offer_id,userId:m.id,at:Date.now()});
            if(actionNames[input.type]){m.action=input.type;m.actionAt=Date.now();this.r.history.unshift({area:m.area,id:input.requestId,name:this.store.getUser(m.id).name,text:actionNames[input.type],at:Date.now()});this.r.history=this.r.history.slice(0,4);}
            this.queueUser(m);
          }
        }
        if(!result.replay)this.r.version++;
      });
      await this.flush();if(!result.replay)this.broadcast();await this.schedule();
      if(input.type!=='sand-contact')ws.send(JSON.stringify({type:'result',requestId:input.requestId,status:200,data:{...result,state:this.snapshot(m.id)}}));
    }catch(error){
      const status=error.status??503;
      try{ws.send(JSON.stringify({type:'result',requestId:input?.requestId,status,error:error.status?error.message:'저장을 다시 확인하고 있어요. 잠시 뒤 이어 주세요.'}));}catch{}
      if(status===429){try{ws.send(JSON.stringify({type:'paused',error:error.message}));ws.close(4008,'Please pause');}catch{}}
    }
  });}
  webSocketClose(ws){try{ws.close(1000,'Disconnected');}catch{}return this.exclusive(async()=>{
    const attachment=ws.deserializeAttachment(),m=this.r.members.get(attachment?.id);
    if(!m||this.sockets(m.id).some(socket=>socket!==ws))return;
    // Record disconnection before an outbox flush can fail. Recovery must still
    // release this seat even if the close callback cannot reach its final flush.
    this.atomic(()=>{
      m.contact=null;m.departAt=Date.now()+5000;
      if(m.travel||m.motion?.keyboard){moveVisitor(this.r,m,{type:'stand',requestId:'disconnect-'+crypto.randomUUID()});m.arriveAt=0;}
      this.r.version++;
    });await this.flush();this.atomic(()=>{
      if(m.station==='tea'||m.station==='plant'){this.store.activities.leave(m.id,this.r,m.station);m.readyAt=0;this.queueUser(m);}
    });await this.flush();this.broadcast();await this.schedule();
  });}
  webSocketError(ws){try{ws.close(1011,'Connection interrupted');}catch{}return this.webSocketClose(ws);}
  hasOutbox(){return Object.keys(this.r.pending).length>0||this.r.tastes.length>0||this.r.releases.length>0;}
  alarm(){return this.exclusive(async()=>{
    if(this.r.retries&&this.hasOutbox()&&(!this.r.retryAt||this.r.retryAt>Date.now())){await this.schedule();return;}
    try{await this.advance();}catch(error){
      // flush already persisted the next bounded retry. Throwing here would also
      // start the platform's alarm retries, outside that budget.
      if(!this.r.retries||!this.hasOutbox())throw error;
    }
  });}
}
