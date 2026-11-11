import * as T from 'three';
import {Workshop,consolidate} from './assets';
import {appearance} from '../../../shared/appearance.mjs';
import {getSpace,sampleMotion} from '../../../shared/space.mjs';
import {smokingTable} from '../../../shared/smoking.mjs';
import {cigaretteModel,smokeGesture,smokePlume} from './smokeEffects';
import type {Snapshot} from '../types';

function cigaretteHand(kit:Workshop,sleeveMaterial:T.Material){
 const group=new T.Group(),skin='#deb093';
 const sleeve=kit.cylinder(group,.054,.068,.52,.061,-.27,.07,'#637a81');sleeve.material=sleeveMaterial;sleeve.rotation.z=.18;
 kit.cylinder(group,.055,.058,.035,.017,-.012,.06,'#eadac5');
 kit.sphere(group,.044,0,.027,.025,skin,.82,.9,.7);
 for(const [x,y,z]of [[-.017,.059,-.015],[.004,.058,-.006]]){
  kit.tube(group,[new T.Vector3(x-.01,y-.04,z+.02),new T.Vector3(x,y,z),new T.Vector3(x+.024,y+.007,z-.017)],.0085,skin);
  kit.sphere(group,.0065,x+.020,y+.01,z-.016,'#e4bfa8',1,.35,.85);
 }
 for(const x of [.018,.034])kit.tube(group,[new T.Vector3(x,.024,.014),new T.Vector3(x+.005,.035,-.012),new T.Vector3(x-.014,.008,-.018)],.009,skin);
 kit.tube(group,[new T.Vector3(-.029,-.005,.028),new T.Vector3(-.035,.027,.005),new T.Vector3(-.012,.045,-.019)],.010,skin);
 consolidate(group,kit);group.traverse(o=>{o.castShadow=false;});
 return group;
}

export function createSmokingScene(kit:Workshop,scene:T.Scene){
 const fixtures=getSpace('smoking').seats.map((_,i)=>{
  const t=smokingTable(i),table=new T.Group();table.position.set(t.x,t.y,t.z);table.rotation.y=t.yaw;scene.add(table);
  kit.cylinder(table,.235,.23,.035,0,0,0,'#bdc5bb');
  kit.cylinder(table,.023,.034,.96,0,-.5,0,'#7c8c84');kit.cylinder(table,.16,.17,.025,0,-.995,0,'#7c8c84');
  const tray=new T.Group();table.add(tray);tray.position.set(-.085,.025,.035);tray.userData={directSurface:true,action:'ashtray',smokingSeat:i};
  const profile=[[.025,0],[.097,0],[.113,.018],[.113,.045],[.101,.055],[.085,.047],[.075,.014],[.025,.014]].map(([r,y])=>new T.Vector2(r,y));
  kit.mesh(tray,new T.LatheGeometry(profile,40),kit.mat('#a9bcb7',.3));
  kit.cylinder(tray,.075,.075,.009,0,.018,0,'#73867d');
  for(const yaw of[0,Math.PI]){kit.box(tray,.035,.009,.024,0,.049,Math.cos(yaw)*.095,'#7c918b',.005);}
  consolidate(tray,kit);
  const pack=new T.Group();table.add(pack);pack.position.set(.12,.026,-.015);pack.rotation.y=-.15;
  pack.userData={directSurface:true,action:'cigarette',smokingSeat:i};
  kit.box(pack,.095,.055,.135,0,.027,0,'#e7e0cf',.008);
  kit.box(pack,.098,.011,.065,0,.057,-.032,'#90a69b',.004);
  kit.box(pack,.062,.009,.043,0,.057,.031,'#b5ad9b',.002);
  for(let n=0;n<3;n++){kit.cylinder(pack,.004,.004,.060,-.025+n*.023,.087,.016,'#efe5d4');kit.cylinder(pack,.0041,.0041,.018,-.025+n*.023,.124,.016,'#c99e69');}
  consolidate(pack,kit);
  kit.box(table,.035,.018,.077,.105,.025,.116,'#6c8e8a',.006);kit.box(table,.032,.019,.019,.105,.027,.145,'#c2c7bb',.003);
  const butt=cigaretteModel(kit,tray);butt.group.position.set(-.023,.026,.026);butt.group.rotation.set(.10,2.1,0);butt.group.scale.setScalar(.6);butt.update(false,0);butt.group.visible=false;
  return{table,pack,tray,butt};
 });
 const sleeveMaterial=new T.MeshStandardMaterial({color:'#637a81',roughness:.95});
 const hand=cigaretteHand(kit,sleeveMaterial),cigarette=cigaretteModel(kit,hand);scene.add(hand);hand.scale.setScalar(.75);hand.userData={directSurface:true,action:'cigarette'};
 cigarette.group.position.set(.007,.067,-.019);cigarette.group.rotation.set(-.20,-2.0,.22);
 const lighterHand=cigaretteHand(kit,sleeveMaterial);scene.add(lighterHand);lighterHand.scale.set(-.82,.82,.82);
 kit.box(lighterHand,.032,.065,.024,0,.07,-.025,'#6c8e8a',.005);
 kit.box(lighterHand,.033,.018,.026,0,.105,-.025,'#c3c6b9',.004);
 const flame=kit.mesh(lighterHand,new T.SphereGeometry(.012,10,8),new T.MeshBasicMaterial({color:'#ffcc75',transparent:true,opacity:.8}),0,.13,-.025);flame.scale.set(.55,1.7,.55);
 const plume=smokePlume(kit,scene),mouth=new T.Vector3(),forward=new T.Vector3();
 let snapshot:Snapshot|null=null,eye=false,now=0;
 const target=new T.Vector3(),ashTarget=new T.Vector3();
 function seated(){
  const m=snapshot?.room.members.find(m=>m.id===snapshot?.self.id);
  return m&&m.seat!=null&&!m.travel&&!sampleMotion(m,now).moving?m:null;
 }
 return {
  tick(state:Snapshot|null,time:number){snapshot=state;now=time;const m=seated();for(let i=0;i<fixtures.length;i++){const occupant=state?.room.members.find(p=>p.seat===i),s=occupant?.smoking;fixtures[i].butt.group.visible=Boolean(s?.endedAt&&s.seat===i&&(!s.ending||time>=s.endedAt+700));}},
  foreground(camera:T.Camera,state:Snapshot|null,show:boolean,reduced:boolean,time:number){
   snapshot=state;now=time;eye=show;
   const m=seated(),s=m?.smoking,g=smokeGesture(s,now);
   hand.visible=show&&Boolean(m)&&(g.active||g.phase==='ending');lighterHand.visible=hand.visible&&g.phase==='lighting';
   if(!hand.visible){plume.hide();return;}
   const aspect=camera instanceof T.PerspectiveCamera?camera.aspect:1,fov=camera instanceof T.PerspectiveCamera?camera.fov:60;
   const halfY=Math.tan(T.MathUtils.degToRad(fov/2))*.58,halfX=halfY*aspect;
   const lift=reduced?(g.phase==='puffing'?.55:0):g.lift;
   hand.position.set(Math.min(.16,halfX*.55)*(1-lift*.68),-Math.min(.24,halfY*.68)+lift*.12,-.58+lift*.10);
   hand.rotation.set(-.12,-.16,-.12+lift*.15);
   if(g.phase==='ending'){const t=reduced?1:T.MathUtils.smoothstep(g.age/700,0,1);hand.position.y-=t*.2;hand.position.x-=t*.12;}
   hand.position.applyQuaternion(camera.quaternion).add(camera.position);hand.quaternion.premultiply(camera.quaternion);
   hand.updateMatrixWorld(true);
   lighterHand.position.set(.015,-Math.min(.24,halfY*.7)+.06,-.58).applyQuaternion(camera.quaternion).add(camera.position);
   lighterHand.quaternion.copy(camera.quaternion);lighterHand.rotateY(.3);
   flame.visible=!reduced&&g.age>280&&g.age<820;
   const lit=g.phase==='ending'?g.age<300:g.phase!=='lighting'||g.age>650;cigarette.update(lit,g.phase==='puffing'?g.lift:.1);
   const look=appearance(m!.avatar,m!.id);
   // Each sleeve has its own material batch, shared only by this first-person rig.
   sleeveMaterial.color.set(look.sleeve);
   camera.getWorldDirection(forward);mouth.copy(camera.position).addScaledVector(forward,.25);mouth.y-=.11;
   plume.update(mouth,Math.atan2(forward.x,forward.z),g.phase==='puffing'?g.age:-1,reduced,1.8);
  },
  targets(){const m=seated();return m?[fixtures[m.seat!].pack,fixtures[m.seat!].tray,...(hand.visible?[hand]:[])]:[];},
  positions(){
   const m=seated();if(!m||!eye)return null;
   const fixture=fixtures[m.seat!],phase=smokeGesture(m.smoking,now).phase;
   fixture.pack.getWorldPosition(target);target.y+=.09;fixture.tray.getWorldPosition(ashTarget);ashTarget.y+=.07;
   if(hand.visible&&phase!=='ending')hand.getWorldPosition(target).add(new T.Vector3(0,.12,0));
   return{cigarette:target.clone(),ashtray:ashTarget.clone()};
  },
  dispose(){sleeveMaterial.dispose();cigarette.dispose();plume.dispose();(flame.material as T.Material).dispose();fixtures.forEach(f=>f.butt.dispose());}
 };
}
