import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {getSpace,findPath,clearSegment,sampleMotion} from '../shared/space.mjs';
import {moveVisitor} from '../server/movement.mjs';
import {completeTravel,reservedSeats} from '../server/travel.mjs';
import {createStore} from '../server/store.mjs';
import {decodeSand,encodeSand,rakeSand,gentleStroke} from '../shared/sand.mjs';

test('both rooms have reachable doors, stations and every seat with furniture-safe routes',()=>{
 for(const area of ['pantry','healing']){const space=getSpace(area),points=[...space.approaches,...Object.values(space.stations).map(s=>s.approach),space.portal.approach];
  for(const a of points)for(const b of points){const route=findPath(a,b,area);assert.ok(route);for(let i=1;i<route.length;i++)assert.ok(clearSegment(route[i-1],route[i],area));}
 }
 assert.equal(getSpace('healing').seats.length,6);
});
test('six visitors reserve separate healing seats, walk to the door, then to the seat; retry, cancel and return retain identity',()=>{
 const members=Array.from({length:6},(_,i)=>({id:'visitor-'+i,area:'pantry',seat:i,slot:i,motion:null,moves:new Map()})),room={members:new Map(members.map(m=>[m.id,m]))};
 const commands=members.map(()=>({type:'travel',to:'healing',requestId:randomUUID()}));
 members.forEach((m,i)=>{moveVisitor(room,m,commands[i],1000);assert.equal(m.area,'pantry');assert.equal(completeTravel(m,m.motion.endsAt),false);});
 assert.equal(new Set(members.map(m=>m.travel.seat)).size,6);
 const original=structuredClone(members[0].travel);assert.equal(moveVisitor(room,members[0],commands[0],1100).replay,true);assert.deepEqual(members[0].travel,original);
 moveVisitor(room,members[0],{type:'stand',requestId:randomUUID()},1500);assert.equal(members[0].travel,null);assert.equal(reservedSeats(room,'healing').size,5);
 moveVisitor(room,members[0],{type:'travel',to:'healing',requestId:randomUUID()},1600);
 for(const m of members){assert.ok(completeTravel(m,m.travel.enterAt));assert.equal(m.area,'healing');assert.equal(sampleMotion(m,m.motion.endsAt+1).phase,'seated');}
 assert.equal(new Set(members.map(m=>m.seat)).size,6);
 assert.throws(()=>moveVisitor(room,members[0],{type:'sit',seat:members[1].seat,requestId:randomUUID()},100000),/먼저/);
 for(const m of members){const id=m.id;moveVisitor(room,m,{type:'travel',to:'pantry',requestId:randomUUID()},100000);completeTravel(m,m.travel.enterAt);assert.equal(m.id,id);assert.equal(m.area,'pantry');}
 assert.equal(new Set(members.map(m=>m.seat)).size,6);
});
test('rake strokes leave continuous visible grooves in a fixed-size surface, including many strokes',()=>{
 let grid=decodeSand();grid=rakeSand(grid,[[.15,.5],[.85,.5]]);assert.ok(grid.filter(v=>v>180).length>200);
 for(let i=0;i<100;i++)grid=rakeSand(grid,gentleStroke(i));assert.equal(grid.length,9600);assert.equal(encodeSand(grid).length,12800);assert.deepEqual(decodeSand(encodeSand(grid)),grid);
});
test('sand retry storage stays bounded and parking preserves the surface and stones',t=>{
 const store=createStore(':memory:');t.after(()=>store.close());const id=store.createUser('모래',0).user.id,room={id:'sand',fixtures:{fridge:{open:false,owner:null}}},point=getSpace('healing').stations.sand.approach;
 const m={id,area:'healing',seat:null,station:'sand',motion:{start:{...point,yaw:0,sit:0},points:[point],toSeat:null,fromSeat:null,startedAt:0,endsAt:0,departMs:0,walkMs:0,arriveMs:0}};
 const act=(type,extra={},key=randomUUID())=>store.activities.act(id,room,m,{type,requestId:key,...extra},10000);
 act('sand-take');const itemId=store.activities.get(id).rest.sand.id;m.seat=0;m.station=null;m.motion=null;const firstKey=randomUUID();
 for(let revision=0;revision<270;revision++)act('sand-edit',{itemId,revision,operation:'stroke',points:[[.2,.5],[.8,.5]]},revision===0?firstKey:randomUUID());
 assert.equal(store.db.prepare('SELECT count(*) AS n FROM pantry_receipts WHERE user_id=?').get(id).n,257);
 assert.throws(()=>act('sand-edit',{itemId,revision:0,operation:'stroke',points:[[.2,.5],[.8,.5]]},firstKey),/바뀌었어요/);
 const before=store.activities.get(id).rest.sand;store.activities.parkSand(id);const parked=store.activities.get(id).rest.sand;
 assert.equal(parked.held,false);assert.equal(parked.surface,before.surface);assert.deepEqual(parked.stones,before.stones);assert.equal(parked.revision,270);
});
test('private sand is owned, revision-checked, preserved across travel and database reopen with existing tea and food',()=>{
 const dir=mkdtempSync(join(tmpdir(),'pantry-sand-')),file=join(dir,'test.sqlite');let store=createStore(file);
 try{let now=10000;const a=store.createUser('A',0).user.id,b=store.createUser('B',1).user.id,room={id:'sand-room',fixtures:{fridge:{open:false,owner:null}}};
  const m={id:a,area:'healing',seat:null,station:'sand',motion:null},other={id:b,area:'healing',seat:1,station:null,motion:null};
  const point=getSpace('healing').stations.sand.approach;m.motion={start:{...point,yaw:0,sit:0},points:[point],toSeat:null,fromSeat:null,startedAt:0,endsAt:0,departMs:0,walkMs:0,arriveMs:0};
  const act=(type,extra={},member=m,requestId=randomUUID())=>store.activities.act(member.id,room,member,{type,requestId,...extra},now);
  act('sand-take');const sand=store.activities.get(a).rest.sand;assert.throws(()=>act('sand-edit',{itemId:sand.id,revision:0,operation:'smooth'}));m.station=null;m.seat=0;m.motion=null;
  assert.throws(()=>act('sand-edit',{itemId:sand.id,revision:0,operation:'smooth'},other));
  const key=randomUUID(),stroke={itemId:sand.id,revision:0,operation:'stroke',points:gentleStroke(0)};act('sand-edit',stroke,m,key);assert.equal(act('sand-edit',stroke,m,key).replay,true);
  assert.throws(()=>act('sand-edit',stroke),/바뀌었어요/);assert.throws(()=>act('sand-edit',{itemId:sand.id,revision:1,operation:'stone',stone:0,position:[-1,1]}));
  act('sand-edit',{itemId:sand.id,revision:1,operation:'stone',stone:0,position:[.8,.8]});act('sand-hold',{itemId:sand.id,held:false});act('sand-hold',{itemId:sand.id,held:true});
  const before=store.activities.get(a).rest.sand;m.area='pantry';assert.throws(()=>act('sand-edit',{itemId:sand.id,revision:2,operation:'smooth'}));assert.throws(()=>act('sand-take'));
  store.act(a,room.id,{type:'take',requestId:randomUUID()});const food=store.serving(a);store.act(a,room.id,{type:'unwrap',servingId:food.id,progress:.43,requestId:randomUUID()});
  const teaPoint=getSpace('pantry').stations.tea.approach;m.seat=null;m.station='tea';m.motion={start:{...teaPoint,yaw:0,sit:0},points:[teaPoint],toSeat:null,fromSeat:null,startedAt:0,endsAt:0,departMs:0,walkMs:0,arriveMs:0};
  act('tea-place',{stow:true});const tea=store.activities.get(a).rest.tea;act('tea-bag',{itemId:tea.id});act('tea-pour',{itemId:tea.id});now+=1200;act('tea-take',{itemId:tea.id});
  store.saveLocation(a,room.id,'healing',3);store.close();store=createStore(file);const after=store.self(a);assert.equal(after.serving.open_progress,.43);assert.equal(after.pantry.rest.tea.volume,.4);assert.equal(after.pantry.rest.sand.surface,before.surface);assert.deepEqual(after.pantry.rest.sand.stones,before.stones);assert.equal(after.pantry.rest.sand.held,false);assert.equal(store.location(a,room.id).area,'healing');
  const exposed=store.activities.public(a).rest.sand;assert.equal('surface' in exposed,false);assert.equal('stones' in exposed,false);assert.equal('id' in exposed,false);assert.equal(store.activities.get(b).rest.sand,null);
 }finally{store.close();if(resolve(dir).startsWith(resolve(tmpdir())+sep)&&dir.includes('pantry-sand-'))rmSync(dir,{recursive:true,force:true});}
});
