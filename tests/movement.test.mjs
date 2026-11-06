import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {seats,approaches,isWalkable,findPath,sampleMotion,planMotion,seatedView,seatedHorizontalFov,stations} from '../shared/space.mjs';
import {moveVisitor} from '../server/movement.mjs';

const member=(id,seat)=>({id,seat,motion:null,moves:new Map()});
test('all seated views include the opposite companion and part of the window; every seat pair has a path',()=>{
 const half=seatedHorizontalFov*Math.PI/360;
 const visible=(eye,x,z)=>Math.acos(Math.min(1,Math.max(-1,((x-eye.x)*Math.sin(eye.yaw)+(z-eye.z)*Math.cos(eye.yaw))/Math.hypot(x-eye.x,z-eye.z))))<half;
 for(let i=0;i<seats.length;i++){
  const eye=seatedView(i),opposite=seats[i^1];assert.ok(visible(eye,opposite[0],opposite[1]),`seat ${i} sees its companion`);
  assert.ok(Array.from({length:113},(_,n)=>-5.6+n*.1).some(x=>visible(eye,x,-4.51)),`seat ${i} sees some window`);
  for(let j=0;j<seats.length;j++)assert.ok(findPath(approaches[i],approaches[j]),`${i} to ${j}`);
 }
});
test('all chairs have reachable exits, and cross-room paths avoid furniture',()=>{
  const destination={x:6,z:5};
  for(let seat=0;seat<seats.length;seat++){
    assert.ok(isWalkable(approaches[seat]),`chair ${seat} exit is clear`);
    const path=findPath(approaches[seat],destination);assert.ok(path);
    for(const station of Object.values(stations))assert.ok(findPath(approaches[seat],station.approach),'each station is reachable from every chair');
    for(let i=1;i<path.length;i++)for(let t=0;t<=1;t+=.02)assert.ok(isWalkable({x:path[i-1].x+(path[i].x-path[i-1].x)*t,z:path[i-1].z+(path[i].z-path[i-1].z)*t}));
  }
  assert.equal(findPath({x:2,z:2},{x:-2,z:.3}),null);
  assert.equal(findPath({x:2,z:2},{x:99,z:99}),null);
});
test('timed movement stands, walks, sits and interrupts from the current position',()=>{
  const a=member('a',0),motion=planMotion(a,approaches[4],4,1000,'journey');a.motion=motion;a.seat=4;
  assert.equal(sampleMotion(a,1000).sit,1);
  const halfway=sampleMotion(a,1000+motion.departMs+motion.walkMs*.5);assert.equal(halfway.phase,'walking');
  const interrupted=planMotion(a,{x:6,z:5},null,1000+motion.departMs+motion.walkMs*.5,'next');
  assert.ok(Math.abs(interrupted.start.x-halfway.x)<1e-8);assert.ok(Math.abs(interrupted.start.z-halfway.z)<1e-8);
  const seated=sampleMotion(a,motion.endsAt+1);assert.equal(seated.phase,'seated');assert.equal(seated.x,seats[4][0]);assert.equal(seated.z,seats[4][1]);
});
test('a seat is reserved atomically, failed requests do not move anyone, repeats do not restart travel',()=>{
  const a=member('a',0),b=member('b',1),room={members:new Map([['a',a],['b',b]])};
  const command={type:'sit',seat:2,requestId:randomUUID()};moveVisitor(room,a,command,1000);const original=structuredClone(a.motion);
  assert.throws(()=>moveVisitor(room,b,{...command,requestId:randomUUID()},1000),/먼저 고른/);assert.equal(b.seat,1);assert.equal(b.motion,null);
  assert.equal(moveVisitor(room,a,command,1200).replay,true);assert.deepEqual(a.motion,original);
  assert.throws(()=>moveVisitor(room,a,{...command,seat:4},1200),/내용이 달라/);
  moveVisitor(room,a,{type:'stand',requestId:randomUUID()},a.motion.endsAt+1);assert.equal(a.seat,null);
  moveVisitor(room,b,{type:'sit',seat:2,requestId:randomUUID()},10000);assert.equal(b.seat,2);
});
test('invalid targets and forged seat values leave a visitor in place',()=>{
  const a=member('a',0),room={members:new Map([['a',a]])};
  for(const command of [{type:'move',x:NaN,z:2},{type:'move',x:'2',z:2},{type:'move',x:-2,z:.3},{type:'move',x:100,z:100},{type:'sit',seat:8},{type:'sit',seat:'1'}]){
    assert.throws(()=>moveVisitor(room,a,{...command,requestId:randomUUID()}));assert.equal(a.seat,0);assert.equal(a.motion,null);
  }
});
