import test from 'node:test';
import assert from 'node:assert/strict';
import {roomSnapshotBatch} from '../server/room-view.mjs';
import {createStore} from '../server/store.mjs';

test('a six-person broadcast reads public servings once while keeping inventory and claims personal',t=>{
 const store=createStore(':memory:');t.after(()=>store.close());const ids=Array.from({length:6},(_,i)=>store.createUser('방문자'+i,i%2).user.id);
 const room={id:'window',members:new Map(ids.map((id,i)=>[id,{id,area:'pantry',seat:i,streams:new Set([1])}])),history:[],fixtures:{fridge:{open:false}}};
 let publicReads=0;const counted={...store,serving(id){publicReads++;return store.serving(id);},offers(_room,id){return[{claimed:id===ids[0]?1:0}];}};
 const batch=roomSnapshotBatch(counted,room,10),views=ids.map(batch);assert.equal(publicReads,6);
 for(let i=0;i<6;i++){assert.equal(views[i].self.id,ids[i]);assert.equal(views[i].room.offers[0].claimed,i===0?1:0);assert.ok(views[i].room.members.every(m=>!('coins' in m)&&!('discoveries' in m)&&!('token_hash' in m)));}
 room.members.get(ids[5]).area='healing';const next=roomSnapshotBatch(counted,room,11);assert.equal(next(ids[0]).room.members.length,5);assert.equal(next(ids[5]).room.members.length,1);
 const plan=store.db.prepare('EXPLAIN QUERY PLAN SELECT * FROM servings WHERE user_id=? ORDER BY created_at DESC,rowid DESC LIMIT 1').all(ids[0]);assert.ok(plan.some(p=>p.detail.includes('servings_user_created')));assert.ok(plan.every(p=>!p.detail.includes('TEMP B-TREE')));
});
