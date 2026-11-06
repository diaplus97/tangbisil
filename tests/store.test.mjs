import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep,basename} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createStore} from '../server/store.mjs';
import {DatabaseSync} from 'node:sqlite';

function setup(t){const store=createStore(':memory:');t.after(()=>store.close());const a=store.createUser('레몬',0),b=store.createUser('창가',1);return{store,a,b};}
function act(s,u,type,extra={},requestId=randomUUID(),room='window'){return s.act(u.user.id,room,{type,requestId,...extra});}
function open(s,u){act(s,u,'take');const food=s.serving(u.user.id);act(s,u,'open',{servingId:food.id});return food.id;}
test('a reused snack request cannot silently accept a changed payload',t=>{
 const{store:s,a}=setup(t);act(s,a,'take');const id=s.serving(a.user.id).id,request=randomUUID();
 act(s,a,'unwrap',{servingId:id,progress:.42},request);
 assert.throws(()=>act(s,a,'unwrap',{servingId:id,progress:.8},request),error=>error.status===409);
 assert.equal(s.serving(a.user.id).open_progress,.42);
 assert.equal(act(s,a,'unwrap',{progress:.42,servingId:id},request).replay,true);
});
test('sealed food cannot be eaten and a failed action never changes collection or budget',t=>{
 const{store:s,a}=setup(t);act(s,a,'take');const f=s.serving(a.user.id);
 assert.throws(()=>act(s,a,'bite',{servingId:f.id}),/포장을/);
 assert.equal(s.self(a.user.id).coins,40);assert.equal(s.self(a.user.id).discoveries.length,0);assert.equal(s.serving(a.user.id).bites,0);
});
test('first taste, budget and receipt commit together; retry cannot eat or pay twice',t=>{
 const{store:s,a}=setup(t);const id=open(s,a),request=randomUUID();
 assert.equal(act(s,a,'bite',{servingId:id},request).firstDiscovery,true);
 assert.equal(act(s,a,'bite',{servingId:id},request).replay,true);
 assert.equal(s.serving(a.user.id).bites,1);assert.equal(s.self(a.user.id).coins,50);
 act(s,a,'bite',{servingId:id});act(s,a,'bite',{servingId:id});
 assert.equal(s.serving(a.user.id).state,'empty');assert.equal(s.self(a.user.id).coins,50);
 const next=open(s,a);act(s,a,'bite',{servingId:next});assert.equal(s.self(a.user.id).coins,50);assert.equal(s.self(a.user.id).discoveries.length,1);
});
test('one visitor cannot open another visitor’s serving',t=>{
 const{store:s,a,b}=setup(t);act(s,a,'take');act(s,b,'take');
 assert.throws(()=>act(s,b,'open',{servingId:s.serving(a.user.id).id}),/상태/);
 assert.equal(s.serving(a.user.id).state,'sealed');assert.equal(s.serving(b.user.id).state,'sealed');
});

test('partly peeled packaging persists without allowing a bite or resealing from a stale tab',t=>{
 const{store:s,a,b}=setup(t);act(s,a,'take');act(s,b,'take');const id=s.serving(a.user.id).id,request=randomUUID();
 act(s,a,'unwrap',{servingId:id,progress:.43},request);
 assert.equal(s.serving(a.user.id).open_progress,.43);assert.equal(s.serving(a.user.id).state,'sealed');
 assert.throws(()=>act(s,a,'bite',{servingId:id}),/포장을/);
 assert.throws(()=>act(s,b,'unwrap',{servingId:id,progress:.7}),/상태/);
 for(const progress of[-.1,1,Infinity,NaN,'0.6'])assert.throws(()=>act(s,a,'unwrap',{servingId:id,progress}),/당긴/);
 act(s,a,'unwrap',{servingId:id,progress:.7});act(s,a,'unwrap',{servingId:id,progress:.2});
 act(s,a,'unwrap',{servingId:id,progress:.43},request);
 assert.equal(s.serving(a.user.id).open_progress,.7);assert.equal(s.self(a.user.id).discoveries.length,0);
 act(s,a,'open',{servingId:id});assert.equal(s.serving(a.user.id).open_progress,1);
 assert.throws(()=>act(s,a,'unwrap',{servingId:id,progress:.4}),/이미 열린/);
});
test('a shared sample does not consume the owner’s food and discovering requires eating it',t=>{
 const{store:s,a,b}=setup(t);const id=open(s,a);act(s,a,'bite',{servingId:id});act(s,a,'offer');const offer=s.offers('window',b.user.id)[0];
 act(s,b,'sample',{offerId:offer.id});assert.equal(s.serving(a.user.id).bites,1);assert.equal(s.self(b.user.id).discoveries.length,0);
 const sample=s.serving(b.user.id);assert.equal(sample.portions,1);act(s,b,'bite',{servingId:sample.id});
 assert.equal(s.self(b.user.id).discoveries[0].source,'shared');assert.equal(s.self(b.user.id).coins,50);
 assert.throws(()=>act(s,b,'sample',{offerId:offer.id}),/이미 맛본/);
});
test('sample ownership, room isolation and unopened sharing are enforced by the server',t=>{
 const{store:s,a,b}=setup(t);assert.throws(()=>act(s,b,'offer'),/먼저/);const id=open(s,a);act(s,a,'bite',{servingId:id});act(s,a,'offer');const offer=s.offers('window',b.user.id)[0];
 assert.equal(s.offers('another',b.user.id).length,0);assert.throws(()=>act(s,b,'sample',{offerId:offer.id},randomUUID(),'another'),/다른 사람/);
 act(s,b,'retract',{offerId:offer.id});assert.equal(s.offers('window',a.user.id).length,1);
 act(s,a,'retract',{offerId:offer.id});assert.equal(s.offers('window',a.user.id).length,0);
});
test('each recipient can taste the same shared plate without a race for stock',t=>{
 const{store:s,a,b}=setup(t),c=s.createUser('세 번째',1);const id=open(s,a);act(s,a,'bite',{servingId:id});act(s,a,'offer');const offer=s.offers('window',b.user.id)[0];
 for(const u of[b,c]){act(s,u,'sample',{offerId:offer.id});act(s,u,'bite',{servingId:s.serving(u.user.id).id});assert.equal(s.self(u.user.id).coins,50);}
 assert.equal(s.offers('window',a.user.id).length,1);
});

test('opening permits sharing before a bite without granting a discovery or consuming food',t=>{
 const{store:s,a,b}=setup(t);act(s,a,'take');
 assert.throws(()=>act(s,a,'offer'),/포장을 먼저/);
 const food=s.serving(a.user.id);act(s,a,'open',{servingId:food.id});act(s,a,'offer');
 const owner=structuredClone(s.self(a.user.id));assert.equal(owner.coins,40);assert.equal(owner.discoveries.length,0);assert.equal(owner.serving.bites,0);
 act(s,b,'sample',{offerId:s.offers('window',b.user.id)[0].id});
 assert.equal(s.self(b.user.id).discoveries.length,0);
 act(s,b,'bite',{servingId:s.serving(b.user.id).id});
 assert.equal(s.self(b.user.id).discoveries[0].source,'shared');assert.deepEqual(structuredClone(s.self(a.user.id)),owner);
});

test('an empty personal plate cannot create another offer or change collection and budget',t=>{
 const{store:s,a}=setup(t),id=open(s,a);act(s,a,'offer');const offer=s.offers('window',a.user.id)[0];
 for(let i=0;i<3;i++)act(s,a,'bite',{servingId:id});act(s,a,'retract',{offerId:offer.id});const before=structuredClone(s.self(a.user.id));
 assert.throws(()=>act(s,a,'offer'),/남아/);assert.equal(s.offers('window',a.user.id).length,0);assert.deepEqual(structuredClone(s.self(a.user.id)),before);
});

test('a sample can only be reshared while food remains; stale retries never resurrect a withdrawn offer',t=>{
 const{store:s,a,b}=setup(t);open(s,a);act(s,a,'offer');const original=s.offers('window',b.user.id)[0];act(s,b,'sample',{offerId:original.id});
 const key=randomUUID();act(s,b,'offer',{},key);const own=s.offers('window',b.user.id).find(o=>o.owner_id===b.user.id);assert.ok(own);
 act(s,b,'retract',{offerId:own.id});const sample=s.serving(b.user.id);act(s,b,'bite',{servingId:sample.id});const before=structuredClone(s.self(b.user.id));
 assert.equal(before.serving.state,'empty');assert.throws(()=>act(s,b,'offer'),/남아/);assert.equal(act(s,b,'offer',{},key).replay,true);
 assert.equal(s.offers('window',b.user.id).length,1);assert.equal(s.offers('window',b.user.id)[0].id,original.id);assert.deepEqual(structuredClone(s.self(b.user.id)),before);
});
test('confirmed progress survives closing and reopening the actual database',()=>{
 const dir=mkdtempSync(join(tmpdir(),'tangbisil-store-')),file=join(dir,'pantry.sqlite');let s=createStore(file);
 try{const a=s.createUser('재방문',0),id=open(s,a),b=s.createUser('포장 중',1);act(s,b,'take');const partial=s.serving(b.user.id).id;act(s,b,'unwrap',{servingId:partial,progress:.43});act(s,a,'bite',{servingId:id});act(s,a,'offer');s.close();s=createStore(file);
 assert.equal(s.authenticate(a.token),a.user.id);assert.equal(s.self(a.user.id).coins,50);assert.equal(s.serving(a.user.id).bites,1);assert.equal(s.self(a.user.id).discoveries.length,1);assert.equal(s.offers('window',a.user.id).length,1);
 assert.equal(s.serving(b.user.id).id,partial);assert.equal(s.serving(b.user.id).open_progress,.43);assert.equal(s.serving(b.user.id).state,'sealed');
 }finally{s.close();assert.ok(resolve(dir).startsWith(resolve(tmpdir())+sep)&&basename(dir).startsWith('tangbisil-store-'));rmSync(dir,{recursive:true});}
});
test('tokens do not resolve from public user IDs and replay keys cannot change action',t=>{
 const{store:s,a}=setup(t);assert.equal(s.authenticate(a.user.id),null);assert.equal(s.authenticate('x'.repeat(64)),null);
 const request=randomUUID();act(s,a,'take',{},request);assert.throws(()=>act(s,a,'wave',{},request),/이미 사용/);
});

test('the shared plate distinguishes taking from tasting and keeps both visitors private',t=>{
 const {store:s,a,b}=setup(t),id=open(s,a);act(s,a,'bite',{servingId:id});act(s,a,'offer');
 const offer=s.offers('window',a.user.id)[0],before=structuredClone(s.self(a.user.id));
 assert.equal(offer.taken,0);assert.equal(offer.tasted,0);
 act(s,b,'sample',{offerId:offer.id});let shared=s.offers('window',a.user.id)[0];
 assert.equal(shared.taken,1);assert.equal(shared.tasted,0);assert.equal(shared.claimed,0);
 assert.equal(s.offers('window',b.user.id)[0].claimed,1);assert.equal(s.self(b.user.id).discoveries.length,0);
 const sample=s.serving(b.user.id),request=randomUUID();act(s,b,'bite',{servingId:sample.id},request);act(s,b,'bite',{servingId:sample.id},request);
 for(const u of [a,b]){shared=s.offers('window',u.user.id)[0];assert.equal(shared.taken,1);assert.equal(shared.tasted,1);}
 assert.deepEqual(structuredClone(s.self(a.user.id)),before);act(s,b,'take');assert.equal(s.offers('window',a.user.id)[0].tasted,1);
});

test('adding shared tasting metadata preserves a pre-existing database and is repeatable',()=>{
 const dir=mkdtempSync(join(tmpdir(),'tangbisil-store-')),file=join(dir,'legacy.sqlite');let s;
 try{
  const old=new DatabaseSync(file);
  old.exec(`CREATE TABLE servings(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,snack_id TEXT NOT NULL,state TEXT NOT NULL,bites INTEGER NOT NULL DEFAULT 0,portions INTEGER NOT NULL DEFAULT 3,source TEXT NOT NULL,created_at INTEGER NOT NULL);
   CREATE TABLE claims(offer_id TEXT NOT NULL,user_id TEXT NOT NULL,PRIMARY KEY(offer_id,user_id));
   INSERT INTO servings VALUES('existing-plate','existing-visitor','lemon-sandwich-pie','open',1,3,'shelf',123);
   INSERT INTO claims VALUES('existing-offer','existing-recipient');
   CREATE TABLE receipts(user_id TEXT,request_id TEXT,action TEXT,result TEXT,PRIMARY KEY(user_id,request_id));
   INSERT INTO receipts VALUES('existing-visitor','legacy-request','bite','{"ok":true}');`);old.close();
  for(let i=0;i<2;i++){s=createStore(file);assert.equal(s.serving('existing-visitor').id,'existing-plate');assert.equal(s.serving('existing-visitor').bites,1);assert.equal(s.serving('existing-visitor').offer_id,null);const claim=s.db.prepare('SELECT * FROM claims').get();assert.equal(claim.user_id,'existing-recipient');assert.equal(claim.tasted_at,null);assert.equal(s.db.prepare('SELECT signature FROM receipts').get().signature,null);assert.equal(s.act('existing-visitor','window',{type:'bite',requestId:'legacy-request'}).replay,true);assert.equal(s.serving('existing-visitor').bites,1);s.close();s=null;}
 }finally{s?.close();assert.ok(resolve(dir).startsWith(resolve(tmpdir())+sep)&&basename(dir).startsWith('tangbisil-store-'));rmSync(dir,{recursive:true});}
});
