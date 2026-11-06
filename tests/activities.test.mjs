import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep,basename} from 'node:path';
import {createStore} from '../server/store.mjs';
import {moveVisitor} from '../server/movement.mjs';
import {stations,sampleMotion} from '../shared/space.mjs';
function setup(t){
 const store=createStore(':memory:');t.after(()=>store.close());const a=store.createUser('A',0),b=store.createUser('B',1);
 const member=(u,seat)=>({id:u.user.id,seat,station:null,motion:null,moves:new Map()});
 const am=member(a,0),bm=member(b,1),room={id:'window',members:new Map([[am.id,am],[bm.id,bm]]),fixtures:{fridge:{open:false,owner:null,changedAt:0}}};
 let now=1000;
 const move=(m,station)=>{const previous=m.station;const result=moveVisitor(room,m,{type:'approach',station,requestId:randomUUID()},now);if(previous!==m.station)store.activities.leave(m.id,room,previous,now);return result;};
 const arrive=m=>{now=m.motion.endsAt+1;};
 const act=(m,type,extra={},key=randomUUID())=>store.activities.act(m.id,room,m,{type,requestId:key,...extra},now);
 return{store,a,b,am,bm,room,move,arrive,act,now:()=>now,advance:ms=>now+=ms};
}
test('table sipping is owned, finite, idempotent and preserves snack and other drinks',t=>{
 const {store,am,bm,room,act,move,arrive}=setup(t);
 store.act(am.id,'window',{type:'take',requestId:randomUUID()});const food=store.serving(am.id);
 store.act(am.id,'window',{type:'unwrap',requestId:randomUUID(),servingId:food.id,progress:.5});const saved=store.serving(am.id);
 const key=randomUUID();act(am,'cup-sip',{sips:0},key);assert.equal(store.activities.get(am.id).coffee.sips,1);
 assert.equal(act(am,'cup-sip',{sips:0},key).replay,true);assert.throws(()=>act(am,'cup-sip',{sips:0}));assert.throws(()=>act(am,'cup-sip',{sips:1},key));
 assert.equal(store.activities.get(bm.id).coffee.sips,0);assert.deepEqual(store.serving(am.id),saved);assert.equal(store.getUser(am.id).drink,'tea');
 for(let sips=1;sips<5;sips++)act(am,'cup-sip',{sips});assert.throws(()=>act(am,'cup-sip',{sips:5}));
 move(am,'coffee');assert.throws(()=>act(am,'cup-sip',{sips:5}));arrive(am);act(am,'coffee-place');assert.throws(()=>act(am,'cup-sip',{sips:0}));
 store.activities.leave(am.id,room,'coffee');assert.deepEqual(store.serving(am.id),saved);
});

test('failed sip leaves held items untouched; successful table sip stows them atomically',t=>{
 const {store,am,room,move,arrive,act,advance,now}=setup(t);move(am,'candy');arrive(am);act(am,'candy-take');const candy=store.activities.get(am.id).candy;
 moveVisitor(room,am,{type:'sit',seat:0,requestId:randomUUID()},now());advance(am.motion.endsAt-now()+1);
 assert.throws(()=>act(am,'cup-sip',{sips:3}));assert.equal(store.activities.get(am.id).candy.held,true);
 act(am,'cup-sip',{sips:0});assert.equal(store.activities.get(am.id).candy.held,false);assert.equal(store.activities.get(am.id).candy.id,candy.id);
 assert.equal(store.activities.get(am.id).coffee.sips,1);
});

test('prepared tea and bottles drink directly from the table without consuming the ordinary mug',t=>{
 const {store,am,bm,room,move,arrive,act,advance,now}=setup(t);
 const sit=()=>{moveVisitor(room,am,{type:'sit',seat:0,requestId:randomUUID()},now());advance(am.motion.endsAt-now()+1);};
 move(am,'tea');arrive(am);act(am,'tea-place');let tea=store.activities.get(am.id,now()).rest.tea;
 act(am,'tea-bag',{itemId:tea.id});act(am,'tea-pour',{itemId:tea.id});advance(3100);act(am,'tea-stop',{itemId:tea.id});act(am,'tea-take',{itemId:tea.id});sit();
 tea=store.activities.get(am.id,now()).rest.tea;const key=randomUUID(),input={itemId:tea.id,volume:tea.volume,table:true};
 assert.throws(()=>act(bm,'tea-sip',input));assert.throws(()=>act(am,'cup-sip',{sips:0}));act(am,'tea-sip',input,key);
 assert.equal(store.activities.get(am.id,now()).rest.tea.volume,tea.volume-.16);assert.equal(store.activities.get(am.id,now()).rest.tea.held,false);assert.equal(act(am,'tea-sip',input,key).replay,true);assert.throws(()=>act(am,'tea-sip',input));
 assert.equal(store.activities.get(am.id).coffee.sips,0);
 move(am,'fridge');arrive(am);act(am,'fridge-open');act(am,'bottle-take');const bottle=store.activities.get(am.id).bottle;sit();
 act(am,'bottle-sip',{itemId:bottle.id,table:true,sips:0});assert.equal(store.activities.get(am.id).bottle.sips,1);assert.equal(store.activities.get(am.id).bottle.held,false);assert.equal(store.activities.get(am.id).tableDrink,'bottle');
 assert.equal(store.activities.get(am.id,now()).rest.tea.volume,tea.volume-.16);assert.throws(()=>act(am,'tea-sip',{itemId:tea.id,table:true,volume:tea.volume-.16}));assert.throws(()=>act(am,'bottle-sip',{itemId:bottle.id,table:true,sips:0}));
 act(am,'tea-hold',{itemId:tea.id,held:true,stow:true});assert.equal(store.activities.get(am.id).tableDrink,'tea');
 act(am,'tea-sip',{itemId:tea.id,volume:tea.volume-.16,table:true});assert.equal(store.activities.get(am.id).bottle.sips,1);
 act(am,'bottle-hold',{itemId:bottle.id,held:true,stow:true});assert.equal(store.activities.get(am.id).tableDrink,'bottle');
 act(am,'bottle-sip',{itemId:bottle.id,table:true,sips:1});assert.equal(store.activities.get(am.id).bottle.sips,2);
});

test('stations reserve before walking, reject remote actions, support cancellation and retargeting',t=>{
 const s=setup(t),{store,am,bm,room,move,arrive,act}=s;
 assert.throws(()=>act(am,'candy-take'),/걸어간/);move(am,'candy');assert.throws(()=>act(am,'candy-take'),/도착/);
 assert.throws(()=>move(bm,'candy'),/이용하고/);assert.equal(bm.seat,1);
 const before=sampleMotion(am,s.now()+900);moveVisitor(room,am,{type:'stand',requestId:randomUUID()},s.now()+900);
 assert.equal(am.station,null);assert.ok(Math.abs(am.motion.start.x-before.x)<1e-8);
 move(bm,'candy');arrive(bm);act(bm,'candy-take');assert.ok(store.activities.get(bm.id).candy);assert.equal(store.activities.get(am.id).candy,null);
});
test('candy ownership, monotonic peel, retries, eating record and table storage preserve the lemon pie',t=>{
 const {store,am,bm,move,arrive,act}=setup(t);store.act(am.id,'window',{type:'take',requestId:randomUUID()});const pie=store.serving(am.id);
 move(am,'candy');arrive(am);const key=randomUUID();act(am,'candy-take',{},key);const c=store.activities.get(am.id).candy;
 assert.equal(act(am,'candy-take',{},key).replay,true);assert.equal(store.activities.get(am.id).candy.id,c.id);assert.throws(()=>act(am,'candy-take'));
 assert.throws(()=>act(bm,'candy-unwrap',{itemId:c.id,progress:1}));assert.throws(()=>act(am,'candy-eat',{itemId:c.id}));
 act(am,'candy-unwrap',{itemId:c.id,progress:.6});act(am,'candy-unwrap',{itemId:c.id,progress:.2});assert.equal(store.activities.get(am.id).candy.progress,.6);
 act(am,'candy-unwrap',{itemId:c.id,progress:1});const eat=randomUUID();act(am,'candy-eat',{itemId:c.id},eat);assert.equal(act(am,'candy-eat',{itemId:c.id},eat).replay,true);
 assert.equal(store.self(am.id).discoveries.filter(d=>d.snack_id==='honey-lemon-candy').length,1);assert.deepEqual(store.serving(am.id),pie);assert.equal(store.self(am.id).coins,40);
});
test('coffee requires a placed cup and elapsed brew; interruptions return exactly one cup',t=>{
 const {store,am,bm,room,move,arrive,act,advance,now}=setup(t);move(am,'coffee');arrive(am);
 assert.throws(()=>act(am,'coffee-brew'));act(am,'coffee-place');const key=randomUUID();act(am,'coffee-brew',{},key);const end=store.activities.get(am.id,now()).coffee.readyAt;
 assert.equal(act(am,'coffee-brew',{},key).replay,true);assert.equal(store.activities.get(am.id,now()).coffee.readyAt,end);assert.throws(()=>act(am,'coffee-take'));
 assert.throws(()=>move(bm,'coffee'));advance(2000);store.activities.leave(am.id,room,'coffee',now());assert.equal(store.activities.get(am.id,now()).coffee.stage,'carried');assert.equal(store.getUser(am.id).drink,'water');
 act(am,'coffee-place');act(am,'coffee-brew');advance(4501);act(am,'coffee-take');assert.equal(store.getUser(am.id).drink,'coffee');assert.equal(store.activities.get(am.id,now()).coffee.stage,'carried');assert.throws(()=>act(am,'coffee-take'));
 act(am,'coffee-place');act(am,'coffee-brew');advance(4600);store.activities.leave(am.id,room,'coffee',now());assert.equal(store.getUser(am.id).drink,'coffee');
});
test('fridge ownership, one bottle, sip retries and automatic closing do not mix visitors',t=>{
 const {store,am,bm,room,move,arrive,act,now}=setup(t);move(am,'fridge');arrive(am);assert.throws(()=>act(am,'bottle-take'));
 act(am,'fridge-open');assert.equal(room.fixtures.fridge.owner,am.id);assert.throws(()=>act(bm,'fridge-close'));act(am,'bottle-take');const bottle=store.activities.get(am.id).bottle;
 assert.throws(()=>act(am,'bottle-take'));assert.throws(()=>act(bm,'bottle-sip',{itemId:bottle.id}));
 const sip=randomUUID();act(am,'bottle-sip',{itemId:bottle.id},sip);act(am,'bottle-sip',{itemId:bottle.id},sip);assert.equal(store.activities.get(am.id).bottle.sips,1);
 store.activities.leave(am.id,room,'fridge',now());assert.equal(room.fixtures.fridge.open,false);assert.equal(store.activities.get(am.id).bottle.id,bottle.id);
});
test('partly opened candy, bottle and previous records survive closing the actual database',()=>{
 const dir=mkdtempSync(join(tmpdir(),'pantry-objects-')),file=join(dir,'items.sqlite');let store;
 try{store=createStore(file);const u=store.createUser('Persist',0),id=u.user.id,m={id,seat:null,station:'candy',motion:{id:'position',start:{...stations.candy.approach,yaw:0,sit:0},points:[stations.candy.approach],fromSeat:null,toSeat:null,startedAt:0,endsAt:0,departMs:0,walkMs:0,arriveMs:0}},r={id:'window',fixtures:{fridge:{open:false,owner:null}}};
 const act=(type,extra={})=>store.activities.act(id,r,m,{type,requestId:randomUUID(),...extra});act('candy-take');const c=store.activities.get(id).candy;act('candy-unwrap',{itemId:c.id,progress:.43});
 m.station='fridge';m.motion.points=[stations.fridge.approach];act('fridge-open');act('bottle-take',{stow:true});const bottle=store.activities.get(id).bottle;act('bottle-sip',{itemId:bottle.id});
 store.act(id,'window',{type:'take',requestId:randomUUID()});const pie=store.serving(id);store.act(id,'window',{type:'unwrap',servingId:pie.id,progress:.4,requestId:randomUUID()});
 store.close();store=createStore(file);assert.equal(store.authenticate(u.token),id);assert.equal(store.activities.get(id).candy.progress,.43);assert.equal(store.activities.get(id).candy.id,c.id);assert.equal(store.activities.get(id).bottle.id,bottle.id);assert.equal(store.activities.get(id).bottle.sips,1);assert.equal(store.serving(id).open_progress,.4);
 }finally{store?.close();const root=resolve(tmpdir());if(resolve(dir).startsWith(root+sep)&&basename(dir).startsWith('pantry-objects-'))rmSync(dir,{recursive:true,force:true});}
});
