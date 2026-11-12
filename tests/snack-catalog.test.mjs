import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createStore} from '../server/store.mjs';
import {captureUser,restoreUser} from '../cloudflare/checkpoint.mjs';
import {snackCatalog,snackDisplay,LEGACY_SNACK_ID} from '../shared/snacks.mjs';
import {validateSnackAction} from '../server/room-view.mjs';
const DAY=86400000,start=Date.parse('2026-11-12T00:00:00+09:00');
const input=(type,extra={})=>({type,requestId:randomUUID(),...extra});
function setup(t){const store=createStore(':memory:');t.after(()=>store.close());let now=start; t.mock.method(Date,'now',()=>now);return{store,time:value=>now=value,act:(id,type,extra={})=>store.act(id,'window',input(type,extra)),create:()=>store.createUser('간식',0).user.id};}
const take=slot=>({snackId:slot.snackId,definitionVersion:slot.definitionVersion,displayId:snackDisplay().displayId});

test('KST midnight changes exactly one of three stable slots, including the schedule wrap',()=>{
 let prior=snackDisplay(start-1);assert.equal(prior.dayId,'2026-11-11');assert.equal(prior.nextChangeAt,start);
 const seen=new Set();for(let day=0;day<25;day++){
  const display=snackDisplay(start+day*DAY);assert.equal(display.slots.length,3);assert.equal(new Set(display.slots.map(s=>s.snackId)).size,3);
  assert.equal(display.nextChangeAt,start+(day+1)*DAY);assert.equal(display.slots.filter((s,i)=>s.snackId!==prior.slots[i].snackId).length,1);
  display.slots.forEach(s=>seen.add(s.snackId));prior=display;
 }
 assert.deepEqual([...seen].sort(),snackCatalog.map(s=>s.id).sort());
});

test('owned opening, bite shape and remaining portions outlive rotation without accepting stale new takes',t=>{
 const {store,time,act,create}=setup(t),a=create(),b=create(),slot=snackDisplay().slots[0],request=input('take',take(slot));
 store.act(a,'window',request);const original=store.serving(a);
 act(a,'unwrap',{servingId:original.id,progress:.42});const partly=store.serving(a);
 assert.throws(()=>act(a,'take',take(snackDisplay().slots[1])));assert.deepEqual(store.serving(a),partly);
 let day=1;while(snackDisplay(start+day*DAY).slots.some(s=>s.snackId===slot.snackId))day++;time(start+day*DAY);
 assert.deepEqual(store.serving(a),partly);assert.equal(store.act(a,'window',request).replay,true);assert.deepEqual(store.serving(a),partly);
 assert.throws(()=>store.act(b,'window',request));assert.throws(()=>store.act(a,'window',{...request,snackId:LEGACY_SNACK_ID}));
 act(a,'unwrap',{servingId:original.id,progress:.2});assert.equal(store.serving(a).open_progress,.42);
 act(a,'open',{servingId:original.id});act(a,'bite',{servingId:original.id,bites:0});
 assert.equal(store.serving(a).bites,1);assert.equal(store.serving(a).portions,original.portions);assert.equal(store.serving(a).snack_id,slot.snackId);
 assert.equal(store.self(a).discoveries[0].snack_id,slot.snackId);assert.equal(store.self(a).discoveries[0].definition_version,1);
});

test('each recipe retains its identity through sharing, sampling, discovery and personal checkpoints',t=>{
 const {store,time,act,create}=setup(t);
 for(const definition of snackCatalog){
  let day=0;while(!snackDisplay(start+day*DAY).slots.some(s=>s.snackId===definition.id))day++;time(start+day*DAY);
  const a=create(),b=create(),slot=snackDisplay().slots.find(s=>s.snackId===definition.id);act(a,'take',take(slot));const serving=store.serving(a);
  act(a,'open',{servingId:serving.id});assert.throws(()=>act(a,'offer',{servingId:'another-serving'}));act(a,'offer',{servingId:serving.id});
  const offer=store.offers('window',b).find(o=>o.owner_id===a);assert.equal(offer.snack_id,definition.id);assert.equal(offer.definition_version,1);
  time(Date.now()+DAY*4); // Old offers expire; create a fresh one from the same owned food.
  act(a,'offer',{servingId:serving.id});const latest=store.offers('window',b).find(o=>o.owner_id===a);act(b,'sample',{offerId:latest.id});
  const sample=store.serving(b);assert.equal(sample.snack_id,definition.id);assert.equal(sample.definition_version,1);assert.equal(sample.portions,1);assert.equal(store.self(b).discoveries.length,0);
  act(b,'bite',{servingId:sample.id,bites:0});assert.equal(store.self(b).discoveries[0].snack_id,definition.id);assert.equal(store.serving(a).bites,0);
  const checkpoint=captureUser(store.db,a),destination=createStore(':memory:');try{restoreUser(destination.db,checkpoint);assert.deepEqual(destination.serving(a),store.serving(a));assert.equal(captureUser(destination.db,a).tables.servings.length,1);}finally{destination.close();}
 }
});

test('legacy takes and checkpoints default to definition one; unknown recipes never change the current plate',t=>{
 const {store,act,create}=setup(t),a=create();act(a,'take');const s=store.serving(a);assert.equal(s.snack_id,LEGACY_SNACK_ID);assert.equal(s.definition_version,1);
 const saved=captureUser(store.db,a);delete saved.tables.servings[0].definition_version;restoreUser(store.db,saved);assert.deepEqual(store.serving(a),s);
 const b=create();for(const extra of [{snackId:'missing',definitionVersion:1},{snackId:LEGACY_SNACK_ID,definitionVersion:2},{snackId:LEGACY_SNACK_ID}]){assert.throws(()=>act(b,'take',{...extra,displayId:snackDisplay().displayId}));assert.equal(store.serving(b),null);}
});

test('public take requires a current choice at the display; only exact existing receipts can replay elsewhere',t=>{
 const{store,create,time}=setup(t),id=create(),member={id,area:'pantry',station:null,seat:0,motion:null},display=snackDisplay(),choice=input('take',take(display.slots[0]));
 for(const request of[input('take'),input('take',{definitionVersion:1,displayId:display.displayId}),choice])assert.throws(()=>validateSnackAction(store,member,request));
 assert.equal(store.serving(id),null);member.station='snacks';validateSnackAction(store,member,choice);store.act(id,'window',choice);const before=store.serving(id);
 time(start+DAY*8);member.station=null;validateSnackAction(store,member,choice);assert.equal(store.act(id,'window',choice).replay,true);assert.deepEqual(store.serving(id),before);
 const changed={...choice,definitionVersion:2};validateSnackAction(store,member,changed);assert.throws(()=>store.act(id,'window',changed));
});
