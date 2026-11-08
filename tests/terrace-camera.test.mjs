import test from 'node:test';
import {Vector3} from 'three';
import assert from 'node:assert/strict';
import {createFollowCamera} from '../src/experience/three/followCamera.ts';
import {createCameraCollision} from '../src/experience/three/cameraCollision.ts';
import {getSpace,planMotion,sampleMotion} from '../shared/space.mjs';

test('the camera approaches coffee and leaves the cabinet without jumping on a cleared sightline',()=>{
 const {seats,approaches,stations}=getSpace();
 for(const ratio of [320/568,390/844,1280/720]){
   const [x,z,yaw]=seats[0],eye=createFollowCamera({x,z},yaw+.42,'pantry',createCameraCollision('pantry'));
   eye.resize(ratio);eye.follow({x,z,sit:1},1,true);
   const m={area:'pantry',seat:0,station:null,motion:null},previous=eye.camera.position.clone();
   let start=0;
   for(const dest of ['coffee','seat']){
     const coffee=dest==='coffee',seat=coffee?null:0;
     const motion=planMotion(m,coffee?stations.coffee.approach:approaches[0],seat,start,dest);
     Object.assign(m,{motion,seat,station:coffee?'coffee':null});
     for(let ms=start;ms<motion.endsAt+2000;ms+=1000/60){
       eye.follow({...sampleMotion(m,ms),focus:coffee?stations.coffee:null},1/60,false);
       assert.ok(previous.distanceTo(eye.camera.position)<.12,'automatic camera displacement exceeded its frame limit');
       previous.copy(eye.camera.position);
     }
     start=motion.endsAt+2200;
   }
 }
});

test('reduced motion keeps the selected direction through a walk and still accepts seated look input',()=>{
 const {seats,stations}=getSpace(),[x,z,yaw]=seats[0],view=createFollowCamera({x,z},yaw+.42,'pantry',createCameraCollision('pantry'));
 view.resize(390/844);
 const member={area:'pantry',seat:0,station:null,motion:null};
 view.follow({...sampleMotion(member,0)},1/60,true);
 const start=view.camera.getWorldDirection(new Vector3());
 view.turn(.4,.1);view.follow({...sampleMotion(member,0)},1/60,true);
 const chosen=view.camera.getWorldDirection(new Vector3()),last=view.camera.position.clone();
 assert.ok(start.angleTo(chosen)>.25);
 const motion=planMotion(member,stations.coffee.approach,null,0,'coffee');
 Object.assign(member,{motion,seat:null,station:'coffee'});
 for(let ms=0;ms<motion.endsAt+2000;ms+=1000/60){
   view.follow({...sampleMotion(member,ms),focus:stations.coffee},1/60,true);
   assert.ok(chosen.angleTo(view.camera.getWorldDirection(new Vector3()))<1e-5);
   assert.ok(last.distanceTo(view.camera.position)<=.201);
   last.copy(view.camera.position);
 }
 view.turn(-.45,0);view.follow({...sampleMotion(member,motion.endsAt+2000),focus:stations.coffee},1/60,true);
 assert.ok(chosen.angleTo(view.camera.getWorldDirection(new Vector3()))>.3);
});
