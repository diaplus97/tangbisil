import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createFollowCamera} from '../src/experience/three/followCamera.ts';
import {createCameraCollision} from '../src/experience/three/cameraCollision.ts';
import {fridgeShelfView} from '../src/experience/three/layout.ts';
import {seats,stations,planMotion,sampleMotion} from '../shared/space.mjs';

test('standing uses a wider middle-distance view while the seated tray remains closer',()=>{
 const view=createFollowCamera({x:0,z:0},Math.PI);view.resize(1280/720);view.follow({x:0,z:0,sit:1},1,true);
 const seated=view.camera.position.length();
 for(let frame=0;frame<120;frame++)view.follow({x:0,z:0,sit:0},1/60,true);
 assert.ok(view.camera.position.length()>seated+.8);assert.equal(view.camera.fov,55);
 const head=new T.Vector3(0,2,0).project(view.camera),feet=new T.Vector3(0,0,0).project(view.camera);
 assert.ok((head.y-feet.y)/2<.36);
});

test('walking keeps the optical heading along a bent route and near the wall',()=>{
 const yaw=-2.82,view=createFollowCamera({x:-3.7,z:1.75},yaw,'pantry',createCameraCollision('pantry'));
 view.resize(390/844,true);assert.ok(view.camera.fov>=80);
 for(const [x,z] of [[-3.7,1.75],[-5.85,1.75],[-5.85,-2.5],[.95,-3],[7,6.4]]){
  for(let i=0;i<100;i++)view.follow({x,z,stableHeading:true},1/60,false);
  const d=view.camera.getWorldDirection(new T.Vector3()),delta=Math.atan2(d.x,d.z)-yaw;
  assert.ok(Math.abs(Math.atan2(Math.sin(delta),Math.cos(delta)))<.02);
 }
});

test('room-scale camera solids stop the lens at the overhead cabinet without triangle picking',()=>{
 const clip=createCameraCollision('pantry'),origin=new T.Vector3(-5.85,2.05,-1.4),desired=new T.Vector3(-7.6,3,-1.4);
 clip(origin,desired);assert.ok(desired.x>-7.13);assert.ok(desired.distanceTo(origin)>.5);
 const open=new T.Vector3(2,2.5,4),expected=open.clone();clip(new T.Vector3(0,2.05,4),open);assert.deepEqual(open,expected);
});

test('low third person follows every seat route without resetting the chosen bearing',()=>{
 for(const [w,h]of [[1280,720],[390,844],[320,568]])for(let seat=0;seat<seats.length;seat++){
  const [x,z,yaw]=seats[seat],view=createFollowCamera({x,z},yaw+.42);view.resize(w/h);view.turn(.2,0);const bearing=view.angles.yaw;
  const m={id:'camera',seat,motion:null};m.motion=planMotion(m,stations.coffee.approach,null,0,'walk');m.seat=null;m.station='coffee';
  for(let at=0;at<=m.motion.endsAt;at+=100){const p=sampleMotion(m,at);view.follow(p,.1,false);assert.equal(view.angles.yaw,bearing);assert.ok(view.camera.position.y<3.6);assert.ok(view.camera.position.x>=-7.65&&view.camera.position.x<=7.65);assert.ok(view.camera.position.z>=-5.6&&view.camera.position.z<=7.95);}
 }
});
test('touch, keyboard, reduced motion and station framing preserve manual orbit',()=>{
 const v=createFollowCamera({x:0,z:2});v.resize(320/568);v.drag(80,-20,320,568);const bearing=v.angles.yaw;
 v.follow({x:-5.85,z:-2.5,focus:stations.coffee},1,true);assert.equal(v.angles.yaw,bearing);v.follow({x:1,z:0},1,true);assert.equal(v.angles.yaw,bearing);
 const head=new T.Vector3(1,1.8,0).project(v.camera),feet=new T.Vector3(1,0,0).project(v.camera);assert.ok(Math.abs(head.x)<1&&Math.abs(head.y)<1&&Math.abs(feet.y)<1);
 const h=createFollowCamera({x:4.55,z:4.05},5*Math.PI/4,'healing');h.follow({x:4.55,z:4.05},1,true);assert.ok(h.camera.position.y<=3.08);
});

test('arriving from either side frames a bottle through the open side of the fridge',()=>{
 const target=fridgeShelfView;
 for(const aspect of [320/568,1280/720])for(const [seat,[x,z,yaw]] of seats.entries()){
   const view=createFollowCamera({x,z},yaw+.42,'pantry',createCameraCollision('pantry'));view.resize(aspect);
   const m={area:'pantry',seat,motion:null,station:null};
   m.motion=planMotion(m,target.approach,null,0,'open-fridge');m.seat=null;m.station='fridge';
   for(let time=0;time<m.motion.endsAt+2200;time+=1000/60)view.follow({...sampleMotion(m,time),focus:target},1/60,false);
   const eye=view.camera.position;
   assert.ok(eye.z<target.z-.5&&eye.x>target.x+1.2);
   const bottle=new T.Vector3(target.x+.25,1.5,target.z-.3),screen=bottle.clone().project(view.camera);
   assert.ok(Math.abs(screen.x)<.92&&Math.abs(screen.y)<.85&&screen.z>0&&screen.z<1);
   const crossing=bottle.clone().lerp(eye,(target.x+.46-bottle.x)/(eye.x-bottle.x));
   assert.ok(Math.abs(crossing.z-target.z)<.51,'sightline to bottle passes through the shelf opening');
 }
});

test('an opaque cabinet cannot compress the orbit into the character or clip the lens',()=>{
 const box=new T.Box3(new T.Vector3(-7.76,2.535,-1.855),new T.Vector3(-7.18,3.425,-1.005));
 const resolve=(origin,desired,ignoreNear=.2)=>{const delta=desired.clone().sub(origin),length=delta.length(),hit=new T.Ray(origin,delta.normalize()).intersectBox(box,new T.Vector3());if(hit&&hit.distanceTo(origin)>ignoreNear&&hit.distanceTo(origin)<length+.24)desired.copy(origin).addScaledVector(delta,Math.max(.45,hit.distanceTo(origin)-.24));};
 const view=createFollowCamera({x:-5.85,z:-2.5},Math.PI/2,'pantry',resolve);view.resize(320/568);
 view.follow({x:-5.85,z:-2.5,focus:stations.coffee},1,true);
 assert.equal(box.containsPoint(view.camera.position),false);assert.ok(Math.hypot(view.camera.position.x+5.85,view.camera.position.z+2.5)>=2.8);assert.equal(view.angles.yaw,Math.PI/2);
});
