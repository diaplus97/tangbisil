import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {createPantryServer} from '../server/app.mjs';

async function setup(t) {
  const app=createPantryServer({database:':memory:',graceMs:150});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${app.server.address().port}`, controllers=[];
  t.after(async()=>{controllers.forEach(c=>c.abort());await app.close();});
  async function request(path,token,body) {
    const response=await fetch(base+path,{method:body?'POST':'GET',headers:{
      ...(token?{Authorization:`Bearer ${token}`} : {}),
      ...(body?{'Content-Type':'application/json'} : {}),
    },...(body?{body:JSON.stringify(body)} : {})});
    return {status:response.status,data:await response.json()};
  }
  async function visitor(name) {
    const response=await request('/api/session',null,{name,avatar:0});
    assert.equal(response.status,201);return response.data;
  }
  async function connect(user,room='window') {
    const controller=new AbortController();controllers.push(controller);
    const response=await fetch(`${base}/api/events?room=${room}`,{
      headers:{Authorization:`Bearer ${user.token}`},signal:controller.signal,
    });
    if(response.status!==200)return {status:response.status,error:await response.json()};
    const states=[],reader=response.body.getReader(),decoder=new TextDecoder();
    const done=(async()=>{
      let buffer='';
      try {
        for(;;){
          const {done,value}=await reader.read();if(done)break;
          buffer+=decoder.decode(value,{stream:true});let end;
          while((end=buffer.indexOf('\n\n'))>=0){
            const block=buffer.slice(0,end);buffer=buffer.slice(end+2);
            const data=block.split('\n').find(line=>line.startsWith('data: '));
            if(data)states.push(JSON.parse(data.slice(6)));
          }
        }
      }catch(error){if(!controller.signal.aborted)throw error;}
    })();
    return {status:200,close:async()=>{controller.abort();await done;},async waitFor(predicate,timeoutMs=3000){
      for(let attempt=0;attempt<timeoutMs/10;attempt++){
        const state=states.find(predicate);if(state)return state;
        await delay(10);
      }
      assert.fail('Expected real-time state was not received');
    }};
  }
  const act=(user,type,extra={},room='window')=>request(`/api/action?room=${room}`,user.token,{type,requestId:randomUUID(),...extra});
  return {visitor,connect,act,request};
}

test('two authenticated streams share food state, isolate private data and update other room tabs',async t=>{
  const {visitor,connect,act,request}=await setup(t);
  const a=await visitor('레몬'),b=await visitor('창가');
  assert.equal((await act(a,'take')).status,409);
  const first=await connect(a),second=await connect(b),otherRoom=await connect(a,'quiet');
  const together=await first.waitFor(s=>s.room.members.length===2);
  assert.equal(together.self.id,a.user.id);
  assert.equal('coins' in together.room.members.find(m=>m.id===b.user.id),false);
  assert.equal('token' in together.room.members[0],false);
  const taken=await act(a,'take');assert.equal(taken.status,200);
  const servingId=taken.data.state.self.serving.id;
  await second.waitFor(s=>s.room.members.find(m=>m.id===a.user.id)?.food?.state==='sealed');
  await otherRoom.waitFor(s=>s.self.serving?.id===servingId);
  assert.equal((await act(a,'unwrap',{servingId,progress:.43})).status,200);
  await otherRoom.waitFor(s=>s.self.serving?.open_progress===.43&&s.self.serving.state==='sealed');
  await second.waitFor(s=>s.room.members.find(m=>m.id===a.user.id)?.food?.open_progress===.43);
  assert.equal((await act(a,'open',{servingId})).status,200);
  assert.equal((await act(a,'bite',{servingId})).data.firstDiscovery,true);
  await otherRoom.waitFor(s=>s.self.coins===50&&s.self.serving.bites===1);
  assert.equal((await act(a,'offer')).status,200);
  const offered=await second.waitFor(s=>s.room.offers.length===1);
  const sample=await act(b,'sample',{offerId:offered.room.offers[0].id});
  assert.equal(sample.data.state.self.discoveries.length,0);
  await first.waitFor(s=>s.room.offers[0]?.taken===1&&s.room.offers[0]?.tasted===0);
  await act(b,'bite',{servingId:sample.data.state.self.serving.id});
  assert.equal((await act(b,'offer')).status,409,'an empty shared portion cannot create a new offer');
  for(const stream of [first,second])await stream.waitFor(s=>s.room.offers[0]?.taken===1&&s.room.offers[0]?.tasted===1);
  const collection=await request('/api/me',b.token);
  assert.equal(collection.data.self.discoveries[0].source,'shared');
  assert.equal(collection.data.self.coins,50);
  assert.equal((await request('/api/me',a.user.id)).status,401);
});

test('six seats, same-visitor reconnect and disconnected-seat release are enforced',async t=>{
  const {visitor,connect}=await setup(t);
  const users=[],streams=[];
  for(let i=0;i<7;i++)users.push(await visitor(`동료${i}`));
  for(let i=0;i<6;i++)streams.push(await connect(users[i]));
  const full=await streams[0].waitFor(s=>s.room.members.length===6);
  assert.equal(new Set(full.room.members.map(m=>m.seat)).size,6);
  const denied=await connect(users[6]);assert.equal(denied.status,409);
  const sameVisitor=await connect(users[0]);assert.equal(sameVisitor.status,200);
  await streams[0].close();
  await sameVisitor.waitFor(s=>s.room.members.length===6&&s.room.members.every(m=>m.connected));
  await streams[1].close();
  await sameVisitor.waitFor(s=>s.room.members.some(m=>m.id===users[1].user.id&&!m.connected));
  await sameVisitor.waitFor(s=>s.room.members.length===5);
  const admitted=await connect(users[6]);assert.equal(admitted.status,200);
  const refilled=await admitted.waitFor(s=>s.room.members.length===6);
  assert.equal(new Set(refilled.room.members.map(m=>m.seat)).size,6);
});

test('tasting a carried sample updates its original shared plate after leaving that room',async t=>{
  const {visitor,connect,act}=await setup(t),a=await visitor('나누는 동료'),b=await visitor('가져가는 동료');
  const first=await connect(a),second=await connect(b);
  const taken=await act(a,'take'),servingId=taken.data.state.self.serving.id;
  await act(a,'open',{servingId});await act(a,'bite',{servingId});await act(a,'offer');
  const offered=await second.waitFor(s=>s.room.offers.length===1);
  const sample=await act(b,'sample',{offerId:offered.room.offers[0].id});
  await second.close();await first.waitFor(s=>s.room.members.length===1);
  const elsewhere=await connect(b,'quiet');
  await act(b,'bite',{servingId:sample.data.state.self.serving.id},'quiet');
  const original=await first.waitFor(s=>s.room.offers[0]?.tasted===1);
  assert.equal(original.room.offers[0].taken,1);assert.equal(original.self.serving.bites,1);
  const carried=await elsewhere.waitFor(s=>s.self.serving?.state==='empty');
  assert.equal(carried.self.discoveries[0].source,'shared');assert.equal(carried.room.offers.length,0);
});

test('movement is shared, a seat has one owner, and walking does not create extra room capacity',async t=>{
  const {visitor,connect,act}=await setup(t),a=await visitor('걷는 동료'),b=await visitor('앉는 동료');
  const first=await connect(a),second=await connect(b);
  const [one,two]=await Promise.all([act(a,'sit',{seat:2}),act(b,'sit',{seat:2})]);
  assert.deepEqual([one.status,two.status].sort(),[200,409]);
  const owner=one.status===200?a:b;
  const observed=await second.waitFor(s=>s.room.members.some(m=>m.id===owner.user.id&&m.seat===2&&m.motion));
  assert.equal(observed.room.members.filter(m=>m.seat===2).length,1);assert.ok(observed.serverTime>0);
  const moved=await act(a,'move',{x:6,z:5});assert.equal(moved.status,200);
  await first.waitFor(s=>s.room.members.some(m=>m.id===a.user.id&&m.seat===null&&m.motion?.toSeat===null));
  const others=[];for(let i=0;i<4;i++){const user=await visitor(`걷기${i}`);others.push(user);await connect(user);await act(user,'move',{x:5+i*.3,z:5});}
  const denied=await connect(await visitor('일곱째'));assert.equal(denied.status,409);
  const taken=await act(a,'take');assert.equal(taken.status,409,'food waits until the walk has finished');
});

test('walking through doors scopes presence and fixtures, keeps food, cancels disconnected travel and restores sharing on return',async t=>{
 const {visitor,connect,act}=await setup(t),a=await visitor('힐링 A'),b=await visitor('힐링 B');let first=await connect(a),second=await connect(b);
 const taken=await act(a,'take'),servingId=taken.data.state.self.serving.id;await act(a,'open',{servingId});await act(a,'bite',{servingId});await act(a,'offer');
 const offered=await second.waitFor(s=>s.room.offers.length===1),offerId=offered.room.offers[0].id;
 async function travel(user,stream,to){const r=await act(user,'travel',{to});assert.equal(r.status,200);assert.notEqual(r.data.state.room.area,to);const m=r.data.state.room.members.find(m=>m.id===user.user.id);assert.ok(m.travel.enterAt>r.data.state.serverTime);return stream.waitFor(s=>s.room.area===to&&s.room.members.some(m=>m.id===user.user.id&&m.motion?.id.endsWith('-inside')&&m.motion.endsAt<=s.serverTime),20000);}
 const healing=await travel(a,first,'healing');assert.equal(healing.self.serving.bites,1);assert.equal(healing.room.offers.length,0);assert.equal(healing.room.total,2);assert.equal(healing.room.members.length,1);
 const alone=await second.waitFor(s=>s.room.area==='pantry'&&s.room.members.length===1);assert.equal(alone.room.offers.length,1);assert.deepEqual(alone.room.counts,{pantry:1,healing:1});
 for(const [type,extra]of[['take',{}],['sample',{offerId}],['approach',{station:'tea'}],['fridge-open',{}]])assert.notEqual((await act(a,type,extra)).status,200);
 const together=await travel(b,second,'healing');assert.equal(together.room.members.length,2);assert.equal(new Set(together.room.members.map(m=>m.seat)).size,2);
 const start=await act(a,'travel',{to:'pantry'});assert.equal(start.status,200);const stopped=await act(a,'stand');assert.equal(stopped.data.state.room.area,'healing');assert.equal(stopped.data.state.room.members.find(m=>m.id===a.user.id).travel,null);
 await act(b,'travel',{to:'pantry'});await second.close();await first.waitFor(s=>s.room.area==='healing'&&s.room.members.some(m=>m.id===b.user.id&&!m.connected&&!m.travel));await first.waitFor(s=>s.room.members.length===1);
 second=await connect(b);await second.waitFor(s=>s.room.area==='healing');
 await travel(a,first,'pantry');const back=await travel(b,second,'pantry');assert.equal(back.room.members.length,2);assert.equal(back.room.offers.length,1);
 const sample=await act(b,'sample',{offerId});assert.equal(sample.status,200);await act(b,'bite',{servingId:sample.data.state.self.serving.id});const final=await first.waitFor(s=>s.room.offers[0]?.tasted===1);assert.equal(final.self.serving.bites,1);
});
