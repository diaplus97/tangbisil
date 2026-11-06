import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {join,resolve,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {createStore,GameError} from '../server/store.mjs';
import {sandContact} from '../server/sand-contact.mjs';
import {getSpace} from '../shared/space.mjs';
import {decodeSand,rakeSand} from '../shared/sand.mjs';

test('sand contact cannot expose coordinates, restart from late packets, or act while away/empty-handed',()=>{
 const m={id:'a',area:'healing',seat:0,motion:null},sand={id:'mine',held:true},gestureId=randomUUID(),base={itemId:'mine',gestureId,kind:'rake'};
 sandContact(m,sand,{...base,sequence:1,active:true},GameError,1000);assert.equal(m.contact.until,2100);assert.deepEqual(Object.keys(m.contact).sort(),['gestureId','kind','until']);
 sandContact(m,sand,{...base,sequence:3,active:false},GameError,1100);assert.equal(m.contact,null);
 assert.equal(sandContact(m,sand,{...base,sequence:2,active:true},GameError,1200),false);assert.equal(m.contact,null);
 for(const override of [{area:'pantry'},{travel:{to:'pantry'}},{seat:null}])assert.throws(()=>sandContact({...m,...override},sand,{...base,sequence:4,active:true},GameError,1300));
 assert.throws(()=>sandContact(m,{...sand,held:false},{...base,sequence:4,active:true},GameError));
 assert.throws(()=>sandContact(m,sand,{...base,itemId:'other',sequence:4,active:true},GameError));
 for(let i=0;i<100;i++)sandContact(m,sand,{...base,gestureId:randomUUID(),sequence:1,active:false},GameError);assert.equal(m.contacts.size,24);
});

test('long sand strokes produce identical grooves before and after exact bounded persistence chunks',()=>{
 const points=Array.from({length:470},(_,i)=>[.12+.76*(i/469),.45+Math.sin(i*.075)*.2]);
 const expected=rakeSand(decodeSand(),points);let chunked=decodeSand();
 for(let i=0;i<points.length-1;i+=63)chunked=rakeSand(chunked,points.slice(i,i+64));
 assert.deepEqual(chunked,expected);
});

test('one personal vase enforces explicit hand swaps, ownership, revision, bounds and persistent private arrangement',()=>{
 const dir=mkdtempSync(join(tmpdir(),'pantry-vase-')),file=join(dir,'test.sqlite');let store=createStore(file);
 try{
  const a=store.createUser('꽃',0).user.id,b=store.createUser('동료',1).user.id,room={id:'vase',fixtures:{fridge:{open:false,owner:null}}},m={id:a,area:'healing',seat:null,station:null,motion:null};
  const at=station=>{const point=getSpace('healing').stations[station].approach;m.station=station;m.seat=null;m.motion={start:{...point,yaw:0,sit:0},points:[point],toSeat:null,fromSeat:null,startedAt:0,endsAt:0,departMs:0,walkMs:0,arriveMs:0};};
  const act=(type,extra={},key=randomUUID(),member=m)=>store.activities.act(member.id,room,member,{type,requestId:key,...extra},10000);
  at('sand');act('sand-take');at('flower');assert.throws(()=>act('vase-take',{flower:'cosmos'}),/내려놓고/);
  act('vase-take',{flower:'cosmos',stow:true});const vase=store.activities.get(a).rest.vase,itemId=vase.id;assert.equal(store.activities.get(a).rest.sand.held,false);
  const key=randomUUID();act('vase-take',{flower:'poppy'},key);assert.equal(act('vase-take',{flower:'poppy'},key).replay,true);assert.equal(store.activities.get(a).rest.vase.id,itemId);
  assert.throws(()=>act('vase-take',{flower:'unknown'}));m.seat=0;m.motion=null;m.station=null;
  const arrange={itemId,revision:2,position:.4,tilt:-.2};act('vase-edit',arrange);assert.throws(()=>act('vase-edit',arrange),/바뀌었어요/);
  assert.throws(()=>act('vase-edit',{...arrange,revision:3,position:2}));assert.throws(()=>act('vase-edit',{...arrange,revision:3},randomUUID(),{...m,id:b,seat:1}));
  const publicVase=store.activities.public(a).rest.vase;assert.deepEqual(publicVase,{flower:'poppy',held:true});assert.equal(store.activities.get(b).rest.vase,null);
  act('vase-hold',{itemId,held:false});assert.equal(store.activities.get(a).rest.lastPlaced,'vase');
  const sandId=store.activities.get(a).rest.sand.id;act('sand-hold',{itemId:sandId,held:true});act('sand-hold',{itemId:sandId,held:false});assert.equal(store.activities.get(a).rest.lastPlaced,'sand');
  act('vase-hold',{itemId,held:true});store.activities.parkSand(a);m.area='pantry';assert.equal(store.activities.get(a).rest.vase.held,false);assert.throws(()=>act('vase-hold',{itemId,held:true}));
  store.close();store=createStore(file);assert.equal(store.activities.get(a).rest.lastPlaced,'vase');const saved=store.activities.get(a).rest.vase;assert.equal(saved.position,.4);assert.equal(saved.tilt,-.2);assert.equal(saved.flower,'poppy');assert.equal(saved.held,false);
 }finally{store.close();if(resolve(dir).startsWith(resolve(tmpdir())+sep)&&dir.includes('pantry-vase-'))rmSync(dir,{recursive:true,force:true});}
});

test('recorded sand clips have silent endpoints, bounded peaks and no clipping',()=>{
 for(const name of ['sand-a','sand-b','sand-c','sand-stone']){
  const bytes=readFileSync(new URL('../src/assets/audio/'+name+'.wav',import.meta.url));let offset=12,pcm;
  while(offset+8<bytes.length){const n=bytes.readUInt32LE(offset+4);if(bytes.toString('ascii',offset,offset+4)==='data'){pcm=bytes.subarray(offset+8,offset+8+n);break;}offset+=8+n+(n%2);}
  assert.ok(pcm);const values=Array.from({length:pcm.length/2},(_,i)=>pcm.readInt16LE(i*2));assert.equal(values[0],0);assert.equal(values.at(-1),0);assert.ok(Math.max(...values.map(Math.abs))<2400);assert.ok(values.length>=11000&&values.length<=23000);
 }
});
