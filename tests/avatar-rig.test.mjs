import test from 'node:test';import assert from 'node:assert/strict';import {registerHooks} from 'node:module';import {Vector3} from 'three';import {Workshop} from '../src/experience/three/assets.ts';import {avatarEyeHeight} from '../shared/appearance.mjs';import {seatedView} from '../shared/space.mjs';
test('petite rig keeps stable eye heights, planted standing soles and the cup below the eyes',async t=>{
 const hook=registerHooks({resolve(specifier,context,next){return specifier.startsWith('.')&&!/\.[a-z]+$/i.test(specifier)?next(specifier+'.ts',context):next(specifier,context);}});t.after(()=>hook.deregister());
 const previous=globalThis.document;t.after(()=>globalThis.document=previous);const noop=()=>{},ctx=new Proxy({createLinearGradient:()=>({addColorStop:noop}),createRadialGradient:()=>({addColorStop:noop})},{get:(o,k)=>o[k]??noop,set:(o,k,v)=>(o[k]=v,true)});globalThis.document={createElement:()=>({getContext:()=>ctx})};
 const {createCharacter}=await import('../src/experience/three/character.ts');
 const kit=new Workshop();t.after(()=>kit.dispose());
 for(const area of ['pantry','healing','smoking'])for(const seat of [null,0,4]){
  const m={id:'rig-'+area+seat,avatar:0,area,seat,drink:'tea',action:'rest',actionAt:1000,connected:true,pantry:{coffee:{stage:'carried'},rest:{}},food:null};
  const actor=createCharacter(kit,m),pose={x:0,z:0,yaw:0,sit:seat==null?0:1,inSeat:seat,phase:seat==null?'standing':'seated',moving:false,distance:0};
  actor.update(m,pose,1000,2000,true,false);const eye=actor.group.getObjectByName('avatar-eye-left').getWorldPosition(new Vector3());assert.ok(Math.abs(eye.y-avatarEyeHeight(area,seat))<1e-8,area+'/'+seat+' uses actual stable eye height');
  if(seat==null){for(const side of ['left','right']){const sole=actor.group.getObjectByName('avatar-ankle-'+side).localToWorld(new Vector3(0,-.122,.07));assert.ok(sole.y>-.002&&sole.y<.003,'standing sole touches floor');}}
  else assert.ok(Math.abs(seatedView(seat,area).y-eye.y)<1e-8);
  if(area==='pantry'&&seat!==null){m.action='cup-sip';m.actionAt=2000;const gesture=actor.update(m,pose,1600,2600,false,false);const rim=gesture.cupSocket.localToWorld(new Vector3(0,.228*.75,0));assert.ok(rim.y<eye.y-.04&&rim.y>eye.y-.25,'rim reaches the mouth without covering eyes');}
  actor.dispose();assert.equal(kit.geometries.size,0,'avatar geometry released');
 }
});

test('key release stops position at once while the rig settles and preserves its next stride phase',async t=>{
 const hook=registerHooks({resolve(specifier,context,next){return specifier.startsWith('.')&&!/\.[a-z]+$/i.test(specifier)?next(specifier+'.ts',context):next(specifier,context);}});t.after(()=>hook.deregister());
 const previous=globalThis.document;t.after(()=>globalThis.document=previous);const noop=()=>{},ctx=new Proxy({createLinearGradient:()=>({addColorStop:noop}),createRadialGradient:()=>({addColorStop:noop})},{get:(o,k)=>o[k]??noop,set:(o,k,v)=>(o[k]=v,true)});globalThis.document={createElement:()=>({getContext:()=>ctx})};
 const {createCharacter}=await import('../src/experience/three/character.ts');const kit=new Workshop();t.after(()=>kit.dispose());
 for(const distance of [.235,.705]){
  const m={id:'keyup-rig',avatar:0,area:'pantry',seat:null,drink:'tea',action:'rest',actionAt:1000,connected:true,pantry:{coffee:{stage:'carried'},rest:{}},food:null};
  const actor=createCharacter(kit,m),pose={x:0,z:0,yaw:0,sit:0,inSeat:null,phase:'walking',moving:true,distance:0};
  const body=actor.group.getObjectByName('avatar-head').parent,arm=body.children.find(o=>o.isGroup&&o.position.x===.229),hips=['left','right'].map(s=>actor.group.getObjectByName('avatar-ankle-'+s).parent.parent);
  actor.update(m,pose,1000,1000,false,false);pose.x=distance/2;actor.update(m,pose,1059,1059,false,false);pose.x=distance;actor.update(m,pose,1118,1118,false,false);
  const before=hips.map(h=>h.rotation.x),armBefore=arm.rotation.x,hipBefore=body.position.y;
  pose.phase='standing';pose.moving=false;actor.update(m,pose,1122,1122,false,false);
  assert.deepEqual(actor.group.position.toArray(),[distance,0,0],'key release does not move the avatar');
  hips.forEach((h,i)=>assert.ok(Math.abs(h.rotation.x-before[i])<3*Math.PI/180,'4ms stop does not snap a leg to rest'));
  assert.ok(Math.abs(arm.rotation.x-armBefore)<3*Math.PI/180,'arm settles too');assert.ok(Math.abs(body.position.y-hipBefore)<.002,'pelvis does not jump');
  for(let time=1138;time<=1618;time+=16){actor.update(m,pose,time,time,false,false);assert.equal(actor.group.position.x,distance);}
  assert.ok(Math.abs(arm.rotation.x)<1e-10);assert.equal(body.position.y,.892);
  pose.x+=.008;pose.phase='walking';pose.moving=true;actor.update(m,pose,1622,1622,false,false);
  assert.equal(Math.sign(arm.rotation.x),Math.sign(armBefore));assert.ok(Math.abs(arm.rotation.x)>.02,'restart retains the accumulated stride instead of phase zero');
  pose.phase='standing';pose.moving=false;actor.update(m,pose,1626,1626,true,false);
  assert.ok(Math.abs(arm.rotation.x)<1e-10);assert.equal(body.position.y,.892,'reduced motion stops without a settling animation');actor.dispose();
 }
 assert.equal(kit.geometries.size,0);
});
