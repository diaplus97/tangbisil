import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createExploreCamera} from '../src/experience/three/exploreCamera.ts';
import {seats,stations,planMotion,sampleMotion} from '../shared/space.mjs';

test('exploration camera stays still in its dead zone and never rotates or zooms when following',()=>{
 const view=createExploreCamera({x:0,z:0});view.resize(1190/490);
 const origin=view.camera.position.clone(),bearing=view.camera.quaternion.clone();
 for(let i=0;i<90;i++)assert.equal(view.follow({x:.1,z:.1},1/30,false),false);
 assert.ok(view.camera.position.equals(origin));
 for(let i=0;i<240;i++)view.follow({x:i/30,z:-i/40},1/30,false);
 assert.ok(view.camera.position.distanceTo(origin)>2);
 assert.equal(view.camera.position.y,origin.y);assert.deepEqual(view.camera.quaternion.toArray(),bearing.toArray());assert.equal(view.camera.fov,52);
});

test('full walking body remains readable along every seat-to-object route, including narrow portrait screens',()=>{
 for(const [width,height]of [[1190,490],[370,600],[300,383]])for(let seat=0;seat<seats.length;seat++)for(const station of Object.values(stations)){
  const member={id:'camera',seat,motion:null},view=createExploreCamera({x:seats[seat][0],z:seats[seat][1]});view.resize(width/height);
  const motion=planMotion(member,station.approach,null,0,'walk');assert.ok(motion);member.motion=motion;member.seat=null;member.station=Object.keys(stations).find(id=>stations[id]===station);
  for(let time=0;time<=motion.endsAt;time+=1000/30){
   const p=sampleMotion(member,time);view.follow(p,1/30,false);
   const head=new T.Vector3(p.x,2.05,p.z).project(view.camera),feet=new T.Vector3(p.x,0,p.z).project(view.camera);
   assert.ok(Math.abs(head.x)<.9&&Math.abs(feet.x)<.9&&Math.abs(head.y)<.95&&Math.abs(feet.y)<.95,`${width} seat ${seat} ${time}: entire body in frame`);
   assert.ok((head.y-feet.y)*height/2>90,`${width}: body at least 90px tall`);
  }
 }
});

test('reduced motion uses a wider still zone, and object retargeting does not reset the existing camera',()=>{
 const regular=createExploreCamera({x:0,z:0}),quiet=createExploreCamera({x:0,z:0});regular.resize(.65);quiet.resize(.65);
 const ray=new T.Raycaster(),point=new T.Vector3();ray.setFromCamera(new T.Vector2(.27,0),regular.camera);ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),-1.05),point);
 assert.equal(regular.follow(point,1/30,false),true);assert.equal(quiet.follow(point,1/30,true),false);assert.equal(quiet.camera.position.x,3.25);
 const bearing=quiet.camera.quaternion.clone(),fov=quiet.camera.fov;
 quiet.follow({x:-5.85,z:-2.5},1/30,true);const first=quiet.camera.position.clone();quiet.follow({x:-5.8,z:3},1/30,true);
 assert.ok(quiet.camera.position.distanceTo(first)>0);assert.deepEqual(quiet.camera.quaternion.toArray(),bearing.toArray());assert.equal(quiet.camera.fov,fov);
});
