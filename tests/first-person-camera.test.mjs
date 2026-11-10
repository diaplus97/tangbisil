import test from 'node:test';
import assert from 'node:assert/strict';
import {createFirstPersonCamera} from '../src/experience/three/firstPersonCamera.ts';

const eye={x:-3.5,y:1.623,z:1.65,yaw:Math.PI,pitch:-.05};
test('seated look changes direction without moving the eye or requiring a new camera mode',()=>{
 const view=createFirstPersonCamera(eye);view.resize(1190/420);const position=view.camera.position.clone();
 view.drag(300,-70,1190,420);const look=view.angles;assert.notEqual(look.yaw,eye.yaw);assert.notEqual(look.pitch,eye.pitch);
 for(let i=0;i<60;i++){view.anchor(eye);view.update(1/30,false);}
 assert.deepEqual(view.angles,look);assert.deepEqual(view.camera.position.toArray(),position.toArray());
 for(let i=0;i<200;i++)view.turn(.12,.08);
 assert.equal(view.angles.pitch,.8);assert.ok(view.angles.yaw>Math.PI*4,'horizontal look is not locked to the seated chair');
});
test('wide first-person lens stays bounded on portrait displays and never changes because of looking',()=>{
 for(const aspect of [1190/420,370/420,300/248]){
  const view=createFirstPersonCamera(eye);view.resize(aspect);const fov=view.camera.fov;
  assert.ok(fov>=42&&fov<=92);view.drag(200,400,300,248);view.update(.1,true);assert.equal(view.camera.fov,fov);assert.ok(view.angles.pitch>=-1.05);
 }
 const desktop=createFirstPersonCamera(eye);desktop.resize(1190/420);
 const horizontal=2*Math.atan(Math.tan(desktop.camera.fov*Math.PI/360)*desktop.camera.aspect)*180/Math.PI;
 assert.ok(Math.abs(horizontal-108)<1e-8);
});
test('walking translates a manually chosen view without orbit, bob or automatic yaw reset',()=>{
 const view=createFirstPersonCamera(eye);view.resize(2);view.turn(-.5,.1);const look=view.angles;
 for(let i=0;i<90;i++){view.anchor({x:eye.x-i/60,y:eye.y,z:eye.z-i/30});view.update(1/30,false);}
 assert.deepEqual(view.angles,look);assert.equal(view.camera.position.y,eye.y);assert.ok(view.camera.position.x<eye.x-1);
 view.aim(Math.PI,-.02);view.update(.1,true);assert.ok(Math.abs(Math.sin(view.angles.yaw))<1e-8);assert.ok(Math.abs(view.angles.pitch+.02)<1e-8);
});

test('arrival framing preserves a view chosen during walking, including keyboard and sea reset',()=>{
 for(const look of [view=>view.drag(250,-40,1000,500),view=>view.turn(.6,.1),view=>view.aim(Math.PI,-.02)]){
  const view=createFirstPersonCamera(eye);view.resize(2);view.beginMove();view.frame(0,-.06);view.update(1,true);
  look(view);view.update(1,true);const chosen=view.angles;
  view.anchor({x:2,y:1.623,z:-3});view.frame(-1.8,-.055);view.update(1,true);
  assert.ok(Math.abs(view.angles.yaw-chosen.yaw)<1e-8&&Math.abs(view.angles.pitch-chosen.pitch)<1e-8,'sitting down must keep the visitor’s chosen direction');
  assert.ok(view.camera.position.toArray().every((value,i)=>Math.abs(value-[2,1.623,-3][i])<1e-8));
 }
});

test('choosing another destination permits framing again until the next manual look',()=>{
 const view=createFirstPersonCamera(eye);view.turn(.6,.1);
 view.beginMove();view.frame(.2,-.1);view.update(1,true);
 assert.ok(Math.abs(Math.sin(view.angles.yaw-.2))<1e-8);assert.ok(Math.cos(view.angles.yaw-.2)>.999);assert.ok(Math.abs(view.angles.pitch+.1)<1e-8);
 view.frame(-1,-.055);view.update(1,true);
 assert.ok(Math.abs(Math.sin(view.angles.yaw+1))<1e-8);assert.ok(Math.cos(view.angles.yaw+1)>.999);assert.ok(Math.abs(view.angles.pitch+.055)<1e-8);
});
