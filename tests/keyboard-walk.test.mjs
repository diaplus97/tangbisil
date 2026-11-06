import test from 'node:test';
import assert from 'node:assert/strict';
import {createKeyboardWalk,keyboardVector} from '../src/experience/keyboardWalk.ts';
import {moveVisitor} from '../server/movement.mjs';
import {sampleMotion,clearSegment,getSpace} from '../shared/space.mjs';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';

test('unrelated action latency preserves a held key, and hidden-tab stop retries without RAF',async()=>{
 let ready=false,moves=0,stops=0;
 const c=createKeyboardWalk({ready:()=>ready,direction:keys=>keys.has('KeyW')?[0,1]:null,move:async()=>{moves++;return true;},stop:async()=>{stops++;return true;}});
 try{
  c.press('KeyW');await c.tick(performance.now());assert.equal(moves,0);
  ready=true;await delay(140);assert.equal(moves,1);
  ready=false;await c.stop();assert.equal(stops,0);
  ready=true;await delay(140);assert.equal(stops,1);assert.equal(c.active,false);
 }finally{c.dispose();}
});

test('releasing while another action is pending never sends the obsolete walk',async()=>{
 let ready=false,moves=0;
 const c=createKeyboardWalk({ready:()=>ready,direction:keys=>keys.size?[1,0]:null,move:async()=>{moves++;return true;},stop:async()=>true});
 try{c.press('KeyD');await c.tick(performance.now());await c.stop();ready=true;await delay(140);assert.equal(moves,0);}finally{c.dispose();}
});

test('holding a physical key sends one intent; keyup stops after a delayed response',async()=>{
 const sent=[];let complete;
 const c=createKeyboardWalk({direction:keys=>keys.has('KeyW')?[0,1]:null,move:async d=>{sent.push(['move',d]);return await new Promise(resolve=>complete=resolve);},stop:async()=>{sent.push(['stop']);return true;}});
 c.press('KeyW');const pending=c.tick(1000);c.release('KeyW');const stopped=c.stop();
 assert.equal(sent.length,1);complete(true);await pending;await stopped;
 assert.deepEqual(sent.map(x=>x[0]),['move','stop']);assert.equal(c.active,false);
});

test('three seconds of held WASD consumes two requests including release, not frame updates',async()=>{
 let moves=0,stops=0;
 const c=createKeyboardWalk({direction:keys=>keyboardVector(keys,{x:1,z:0},{x:0,z:1}),move:async()=>{moves++;return true;},stop:async()=>{stops++;return true;}});
 c.press('KeyW');for(let now=0;now<3000;now+=16)await c.tick(now);
 assert.equal(moves,1);c.release('KeyW');await c.stop();assert.equal(stops,1);
 assert.deepEqual(keyboardVector(new Set(['KeyW']),{x:1,z:0},{x:0,z:1}),[1,0]);
 const diagonal=keyboardVector(new Set(['KeyW','KeyD']),{x:1,z:0},{x:0,z:1});assert.ok(Math.abs(Math.hypot(...diagonal)-1)<1e-8);
});

test('directional paths stay straight and collision-safe in both rooms; stand stops at current position',()=>{
 for(const area of ['pantry','healing'])for(const seat of [0,1])for(const direction of [[1,0],[-1,0],[0,1],[0,-1],[.707,.707]]){
  const member={id:'walker',area,seat,motion:null,moves:new Map()},room={members:new Map([['walker',member]])};
  const input={type:'move',direction,requestId:randomUUID()};moveVisitor(room,member,input,1000);
  assert.equal(member.motion.keyboard,true);assert.equal(member.motion.points.length,2);
  assert.ok(clearSegment(...member.motion.points,area));assert.equal(moveVisitor(room,member,input,1100).replay,true);
  const now=1000+member.motion.departMs+250,before=sampleMotion(member,now);
  moveVisitor(room,member,{type:'stand',requestId:randomUUID()},now);
  const after=sampleMotion(member,now+10000);assert.ok(Math.hypot(after.x-before.x,after.z-before.z)<1e-8);
 }
});

test('malformed keyboard vectors cannot move a visitor or reuse a different receipt',()=>{
 const m={id:'a',seat:0,motion:null,moves:new Map()},room={members:new Map([['a',m]])};
 for(const direction of [[NaN,0],[0,0],[2,0],[1],['1',0],null])assert.throws(()=>moveVisitor(room,m,{type:'move',direction,requestId:randomUUID()},1000));
 assert.equal(m.seat,0);assert.equal(m.motion,null);
 const requestId=randomUUID();moveVisitor(room,m,{type:'move',direction:[0,1],requestId},1000);
 assert.throws(()=>moveVisitor(room,m,{type:'move',direction:[1,0],requestId},1100),/내용이 달라/);
});
