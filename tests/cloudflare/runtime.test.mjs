import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {readFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {flowers} from '../../shared/vase.mjs';
import {tvQueue} from '../../shared/room-media.mjs';
const require=createRequire(import.meta.url),fromWrangler=createRequire(require.resolve('wrangler/package.json'));
const {Miniflare,convertV4MiniflareOptions}=fromWrangler('miniflare');
const config=JSON.parse((await readFile(new URL('../../wrangler.pantry.jsonc',import.meta.url),'utf8')).replace(/^\s*\/\/.*$/gm,''));
test('Cloudflare room scenery and TV queue survive hibernation without waking alarms', {timeout:60000},async t=>{
  const {mf,visitor,connect,storage}=await setup(t),a=await visitor('TV A'),b=await visitor('TV B'),first=await connect(a),second=await connect(b);
  assert.deepEqual(first.state.room.media,second.state.room.media);
  const session=first.state.room.media.sessionId;
  assert.equal((await first.act('tv-join')).status,409);
  await Promise.all([first.act('travel',{to:'healing'}),second.act('travel',{to:'healing'})]);
  await Promise.all([first.arrive(),second.arrive()]);
  assert.equal((await first.act('tv-join')).status,200);await second.wait(()=>second.state.room.media.tv);
  assert.equal((await second.act('tv-join')).data.replay,true);
  const before=structuredClone(first.state.self);
  // Move only the shared content clock forward; no personal checkpoint changes.
  const sql=await storage('PantryRoom','window'),saved=JSON.parse((await sql.exec("SELECT value FROM cf_json WHERE key='room'"))[0].value);
  saved.media.tv.startedAt-=10000;
  await sql.exec("UPDATE cf_json SET value=? WHERE key='room'",JSON.stringify(saved));
  await mf.unsafeEvictDurableObject('pantry-test','PantryRoom',{name:'window',webSockets:'hibernate'});
  first.ws.send('ping');await first.wait(()=>first.messages.includes('pong'));
  const request={sessionId:session,expectedVersion:1};
  const results=await Promise.all([first.act('tv-next',request),second.act('tv-next',request)]);
  assert.equal(results.filter(r=>r.data.replay).length,1);
  assert.equal(first.state.room.media.tv.version,2);assert.equal(first.state.room.media.tv.videoId,tvQueue[1].id);
  assert.equal(second.state.room.media.tv.videoId,first.state.room.media.tv.videoId);
  assert.deepEqual(first.state.self,before);
  await mf.unsafeEvictDurableObject('pantry-test','PantryRoom',{name:'window',webSockets:'hibernate'});
  assert.equal((await first.act('tv-join')).data.state.room.media.tv.version,2);
  const third=await connect(a);assert.equal(third.state.room.media.tv.version,2);assert.equal(third.state.room.media.sessionId,session);
});
async function setup(t,overrides={}){
  const mf=new Miniflare(convertV4MiniflareOptions({name:'pantry-test',modules:true,scriptPath:fileURLToPath(new URL('../../test-results/cf-bundle/worker.js',import.meta.url)),
    compatibilityDate:config.compatibility_date,compatibilityFlags:config.compatibility_flags,cf:false,unsafeInspectDurableObjects:true,
    bindings:{...config.vars,...overrides},durableObjects:Object.fromEntries(config.durable_objects.bindings.map(b=>[b.name,{className:b.class_name,useSQLite:true}])),
  }));
  const connections=[];t.after(async()=>{try{for(const c of connections)try{c.ws.close();}catch{}}finally{await mf.dispose();}});await mf.ready;
  let ip=0;
  async function visitor(name){const res=await mf.dispatchFetch('http://example.test/api/session',{method:'POST',headers:{'Content-Type':'application/json','CF-Connecting-IP':`198.51.100.${++ip}`},body:JSON.stringify({name,avatar:0})});assert.equal(res.status,201);return res.json();}
  async function connect(user,room='window'){
    const res=await mf.dispatchFetch(`http://example.test/api/connect?room=${room}`,{method:'POST',headers:{Authorization:`Bearer ${user.token}`,'CF-Connecting-IP':`203.0.113.${++ip}`}});
    const grant=await res.json();if(!res.ok)return {status:res.status,...grant};
    const upgrade=await mf.dispatchFetch(`http://example.test/api/socket?room=${room}`,{headers:{Upgrade:'websocket','Sec-WebSocket-Protocol':`pantry.v1, ticket.${grant.ticket}`,'CF-Connecting-IP':`203.0.113.${ip}`}});
    assert.equal(upgrade.status,101);const ws=upgrade.webSocket,states=[],replies=new Map(),messages=[];
    ws.addEventListener('message',event=>{if(event.data==='pong'){messages.push('pong');return;}const frame=JSON.parse(event.data);if(frame.type==='state')states.push(frame.state);if(frame.type==='result')replies.set(frame.requestId,frame);messages.push(frame.type);});
    ws.accept();
    const wait=async(predicate,timeout=6000)=>{const end=Date.now()+timeout;while(Date.now()<end){const found=predicate();if(found)return found;await delay(20);}assert.fail('Expected Cloudflare state was not received');};
    const c={ws,status:200,states,messages,get state(){return states.at(-1);},wait,
      async act(type,extra={},requestId=randomUUID()){ws.send(JSON.stringify({type:'action',input:{type,requestId,...extra}}));const result=await wait(()=>replies.get(requestId));replies.delete(requestId);return result;},
      async arrive(){await wait(()=>{const m=c.state.room.members.find(m=>m.id===user.user.id);return m&&!m.travel&&(!m.motion||Date.now()>m.motion.endsAt+40);},25000);await delay(100);},
    };
    connections.push(c);await wait(()=>c.state);return c;
  }
  const storage=(className,name)=>mf.unsafeGetDurableObjectStorage('pantry-test',className,{name});
  return {mf,visitor,connect,storage};
}
test('Cloudflare two visitors share exactly once; hibernation and cross-room personal records survive', {timeout:60000},async t=>{
  const {mf,visitor,connect,storage}=await setup(t),a=await visitor('CF동료A'),b=await visitor('CF동료B'),first=await connect(a),second=await connect(b);
  await first.wait(()=>first.state.room.members.length===2);
  const taken=await first.act('take');assert.equal(taken.status,200);const servingId=taken.data.state.self.serving.id;
  await first.act('unwrap',{servingId,progress:.42});await first.act('open',{servingId});await first.act('offer');
  await second.wait(()=>second.state.room.offers[0]);const offerId=second.state.room.offers[0].id;
  const requestId=randomUUID(),sample=await second.act('sample',{offerId},requestId);assert.equal(sample.status,200);
  const duplicate=await second.act('sample',{offerId},requestId);assert.equal(duplicate.data.replay,true);assert.equal(duplicate.data.state.self.serving.id,sample.data.state.self.serving.id);
  await mf.unsafeEvictDurableObject('pantry-test','PantryRoom',{name:'window',webSockets:'hibernate'});
  first.ws.send('ping');await first.wait(()=>first.messages.includes('pong'));
  await mf.unsafeEvictDurableObject('pantry-test','PantryVisitor',{name:createHash('sha256').update(b.token).digest('hex')});
  const moved=await connect(b,'breeze');assert.equal(moved.status,200);assert.equal(moved.state.self.serving.id,sample.data.state.self.serving.id);
  moved.ws.close();await delay(150);
  await mf.unsafeEvictDurableObject('pantry-test','PantryRoom',{name:'breeze',webSockets:'hibernate'});
  const refreshed=await connect(b,'breeze');assert.equal(refreshed.state.self.serving.id,sample.data.state.self.serving.id);
  await refreshed.act('bite',{servingId:sample.data.state.self.serving.id});
  await first.wait(()=>first.state.room.offers[0].tasted===1);
  assert.equal(refreshed.state.self.discoveries[0].source,'shared');assert.equal(refreshed.state.self.coins,50);
  assert.equal((await refreshed.act('offer')).status,409);
  const ownerElsewhere=await connect(a,'quiet');assert.equal(ownerElsewhere.status,200);
  const back=await connect(b,'window');assert.equal(back.state.room.offers[0].tasted,1);assert.equal(back.state.room.offers[0].claimed,1);
  const roomDb=await storage('PantryRoom','window'),row=await roomDb.exec("SELECT value FROM cf_json WHERE key='room'");
  assert.equal(JSON.parse(row[0].value).members.length,1);
  assert.equal(JSON.stringify(first.state.room).includes('token_hash'),false);
});
test('Cloudflare arrivals, coffee alarm, fridge and personal sand/vase survive hibernation', {timeout:180000},async t=>{
  const {mf,visitor,connect}=await setup(t),a=await visitor('생활검사A'),b=await visitor('생활검사B'),c=await connect(a),peer=await connect(b);
  const take=await c.act('take'),servingId=take.data.state.self.serving.id;await c.act('unwrap',{servingId,progress:.42});
  assert.equal((await c.act('approach',{station:'coffee'})).status,200);
  assert.equal((await peer.act('approach',{station:'coffee'})).status,409);await c.arrive();
  assert.equal((await c.act('coffee-place')).status,200);assert.equal((await c.act('coffee-brew')).status,200);
  await mf.unsafeEvictDurableObject('pantry-test','PantryRoom',{name:'window',webSockets:'hibernate'});
  await c.wait(()=>c.state.self.pantry.coffee.stage==='ready',7000);assert.equal((await c.act('coffee-take')).status,200);
  await c.act('approach',{station:'fridge'});await c.arrive();assert.equal((await c.act('fridge-open')).status,200);
  await peer.wait(()=>peer.state.room.fixtures.fridge.open);const bottle=await c.act('bottle-take');assert.equal(bottle.status,200);
  await c.act('fridge-close');await c.act('bottle-sip',{itemId:bottle.data.state.self.pantry.bottle.id});
  await c.act('travel',{to:'healing'});await c.arrive();assert.equal(c.state.room.area,'healing');
  await c.act('approach',{station:'sand'});await c.arrive();assert.equal((await c.act('sand-take',{stow:true})).status,200);
  await c.act('sit',{seat:0});await c.arrive();let sand=c.state.self.pantry.rest.sand;
  assert.equal((await c.act('sand-edit',{itemId:sand.id,revision:sand.revision,operation:'stroke',points:[[.2,.3],[.6,.7]]})).status,200);
  sand=c.state.self.pantry.rest.sand;const surface=sand.surface;
  await c.act('approach',{station:'flower'});await c.arrive();assert.equal((await c.act('vase-take',{flower:flowers[0].id,stow:true})).status,200);
  await c.act('sit',{seat:0});await c.arrive();const vase=c.state.self.pantry.rest.vase;
  assert.equal((await c.act('vase-edit',{itemId:vase.id,revision:vase.revision,position:.1,tilt:.15})).status,200);
  await mf.unsafeEvictDurableObject('pantry-test','PantryRoom',{name:'window',webSockets:'hibernate'});
  await c.act('vase-hold',{itemId:vase.id,held:false});
  assert.equal(c.state.self.pantry.rest.sand.surface,surface);assert.equal(c.state.self.pantry.rest.vase.position,.1);assert.equal(c.state.self.serving.open_progress,.42);
  const rejoined=await connect(a,'quiet');assert.equal(rejoined.state.self.pantry.rest.vase.position,.1);assert.equal(rejoined.state.self.pantry.rest.sand.surface,surface);assert.equal(rejoined.state.self.pantry.bottle.sips,1);
  assert.equal(JSON.stringify(peer.state.room.members).includes(surface),false);
});
test('Cloudflare pending personal commit recovers after failure without an extra bite', {timeout:30000},async t=>{
  const {visitor,connect,storage}=await setup(t),a=await visitor('복구검사'),c=await connect(a);
  const take=await c.act('take'),servingId=take.data.state.self.serving.id;await c.act('open',{servingId});
  const key=createHash('sha256').update(a.token).digest('hex'),home=await storage('PantryVisitor',key);
  const original=(await home.exec("SELECT value FROM cf_json WHERE key='record'"))[0].value;
  const changed=JSON.parse(original);changed.epoch+=99;await home.exec("UPDATE cf_json SET value=? WHERE key='record'",JSON.stringify(changed));
  const requestId=randomUUID(),failed=await c.act('bite',{servingId},requestId);assert.equal(failed.status,503);
  await home.exec("UPDATE cf_json SET value=? WHERE key='record'",original);
  const retry=await c.act('bite',{servingId},requestId);assert.equal(retry.status,200);assert.equal(retry.data.replay,true);assert.equal(retry.data.state.self.serving.bites,1);assert.equal(retry.data.state.self.coins,50);
});
test('Cloudflare room capacity, unsupported rooms and daily allowance fail gently', {timeout:30000},async t=>{
  const {visitor,connect}=await setup(t,{ROOM_DAILY_MESSAGES:'2'}),users=[];
  for(let i=0;i<7;i++)users.push(await visitor('자리'+i));
  const joined=[];for(let i=0;i<6;i++)joined.push(await connect(users[i]));
  assert.equal((await connect(users[6])).status,409);assert.equal((await connect(users[6],'unbounded-room')).status,404);
  await joined[0].act('wave');await joined[0].act('wave');const limit=await joined[0].act('wave');assert.equal(limit.status,429);assert.match(limit.error,/오늘/);
});
test('Cloudflare concurrent duplicate requests and interrupted room claims keep one personal owner', {timeout:30000},async t=>{
  const {mf,visitor,connect,storage}=await setup(t),a=await visitor('동시검사'),first=await connect(a),second=await connect(a);
  const requestId=randomUUID(),results=await Promise.all([first.act('take',{},requestId),second.act('take',{},requestId)]);
  assert.ok(results.every(result=>result.status===200));assert.equal(results.filter(result=>result.data.replay).length,1);
  assert.equal(results[0].data.state.self.serving.id,results[1].data.state.self.serving.id);
  const b=await visitor('중단검사'),key=createHash('sha256').update(b.token).digest('hex'),home=await storage('PantryVisitor',key);
  const record=JSON.parse((await home.exec("SELECT value FROM cf_json WHERE key='record'"))[0].value);
  record.room='sunset';record.epoch++;await home.exec("UPDATE cf_json SET value=? WHERE key='record'",JSON.stringify(record));
  const restored=await connect(b,'quiet');assert.equal(restored.status,200);
  const view=await mf.dispatchFetch('http://example.test/api/me',{headers:{Authorization:`Bearer ${a.token}`}}),me=await view.json();
  assert.equal(view.status,200);assert.equal(me.self.serving.id,results[0].data.state.self.serving.id);assert.equal('token_hash' in me.self,false);
});
