import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {smokingAction} from '../server/smoking.mjs';
import {moveVisitor} from '../server/movement.mjs';
import {smokingPhase,SMOKE_LIGHT_MS,SMOKE_PUFF_MS,SMOKE_OUT_MS} from '../shared/smoking.mjs';
import {getSpace} from '../shared/space.mjs';

function setup(){
 const a={id:'a',area:'smoking',seat:0,moves:new Map()},b={id:'b',area:'smoking',seat:1,moves:new Map()};
 const room={members:new Map([[a.id,a],[b.id,b]])};let now=10000;
 const input=(m,type,extra={})=>({type,requestId:randomUUID(),revision:m.smoking?.revision??0,...(m.smoking?{itemId:m.smoking.id}:{}),...extra});
 const act=(m,type,extra={})=>{const action=input(m,type,extra);return{action,result:smokingAction(m,action,now)};};
 return {a,b,room,input,act,now:()=>now,advance:ms=>now+=ms};
}

test('independent cigarette sessions light, puff once per gesture and extinguish with replay protection',()=>{
 const {a,b,act,input,now,advance}=setup();
 const {action}=act(a,'smoke-take');const own=structuredClone(a.smoking);
 assert.equal(smokingPhase(a.smoking,now()),'lighting');assert.equal(smokingAction(a,action,now()).replay,true);assert.deepEqual(a.smoking,own);
 act(b,'smoke-take');assert.notEqual(a.smoking.id,b.smoking.id);
 assert.throws(()=>act(a,'smoke-puff'));advance(SMOKE_LIGHT_MS);assert.equal(smokingPhase(a.smoking,now()),'ready');
 const duplicate=input(a,'smoke-puff');smokingAction(a,duplicate,now());assert.equal(smokingAction(a,duplicate,now()).replay,true);
 assert.equal(a.smoking.puffs,1);assert.equal(b.smoking.puffs,0);assert.throws(()=>act(a,'smoke-puff'));
 assert.throws(()=>act(b,'smoke-out',{itemId:a.smoking.id}));advance(SMOKE_PUFF_MS);
 assert.throws(()=>smokingAction(a,{...duplicate,requestId:randomUUID()},now()));
 act(a,'smoke-puff');assert.equal(a.smoking.puffs,2);
 const ended=act(a,'smoke-out');assert.equal(smokingPhase(a.smoking,now()),'ending');assert.equal(smokingAction(a,ended.action,now()).replay,true);
 assert.equal(a.smoking.puffAt,0);advance(SMOKE_OUT_MS);assert.equal(smokingPhase(a.smoking,now()),'idle');
 const previous=a.smoking.id;act(a,'smoke-take');assert.notEqual(a.smoking.id,previous);
 assert.equal(smokingAction(a,action,now()).replay,true);assert.notEqual(a.smoking.id,own.id);
});

test('moving and room travel stop smoke atomically, while invalid moves preserve the cigarette',()=>{
 const {a,room,act,input,now,advance}=setup();act(a,'smoke-take');advance(SMOKE_LIGHT_MS);act(a,'smoke-puff');
 const saved=structuredClone(a.smoking);assert.throws(()=>moveVisitor(room,a,{type:'move',x:99,z:99,requestId:randomUUID()},now()));assert.deepEqual(a.smoking,saved);
 const stale=input(a,'smoke-puff');
 moveVisitor(room,a,{type:'stand',requestId:randomUUID()},now());assert.equal(a.smoking.endedAt,now());assert.equal(a.smoking.ending,false);assert.equal(a.smoking.puffAt,0);assert.throws(()=>smokingAction(a,stale,now()));
 advance(3000);assert.throws(()=>act(a,'smoke-take'));
 moveVisitor(room,a,{type:'sit',seat:0,requestId:randomUUID()},now());advance(a.motion.endsAt-now()+1);act(a,'smoke-take');
 moveVisitor(room,a,{type:'travel',to:'pantry',requestId:randomUUID()},now());assert.ok(a.smoking.endedAt);assert.throws(()=>act(a,'smoke-take'));
});

test('older members need no migration and serialization preserves the cigarette without relighting',()=>{
 const {a,act,now,advance,input}=setup();assert.equal(smokingPhase(a.smoking,now()),'idle');
 assert.throws(()=>smokingAction({...a,area:'pantry'},input(a,'smoke-take'),now()));
 const old=input(a,'smoke-take');assert.throws(()=>smokingAction(a,{...old,revision:NaN},now()));
 act(a,'smoke-take');advance(SMOKE_LIGHT_MS);act(a,'smoke-puff');
 const restored=JSON.parse(JSON.stringify(a));assert.deepEqual(restored.smoking,a.smoking);
 advance(SMOKE_PUFF_MS);assert.equal(smokingPhase(restored.smoking,now()),'ready');
 const replay=restored.smokeReceipts.at(-1);const [type,itemId,revision]=JSON.parse(replay.signature);
 assert.equal(smokingAction(restored,{type,itemId,revision,requestId:replay.requestId},now()).replay,true);
 assert.equal(restored.smoking.puffs,1);
 for(let i=0;i<getSpace('smoking').seats.length;i++)assert.ok(getSpace('smoking').approaches[i]);
});
