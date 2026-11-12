import * as T from 'three';
import {Workshop,consolidate} from './assets';
import {appearance} from '../../../shared/appearance.mjs';
import {getSpace,sampleMotion} from '../../../shared/space.mjs';
import {smokingTable} from '../../../shared/smoking.mjs';
import {cigaretteModel,smokeGesture,smokePlume} from './smokeEffects';
import {ashtrayModel,cigarettePack,lighterModel,smokingHand,smokingTableModel} from './smokingModels';
import type {Snapshot} from '../types';

export function createSmokingScene(kit:Workshop,scene:T.Scene){
 const hitMaterial=new T.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,colorWrite:false});
 hitMaterial.visible=false;
 const furniture=new T.Group();scene.add(furniture);
 const fixtures=getSpace('smoking').seats.map((_,i)=>{
  const t=smokingTable(i),table=new T.Group();table.position.set(t.x,t.y,t.z);table.rotation.y=t.yaw;scene.add(table);const base=smokingTableModel(kit,table);
  const tray=ashtrayModel(kit,table);tray.position.set(-.085,.016,.035);tray.userData={directSurface:true,action:'ashtray',smokingSeat:i};
  // A shallower bowl keeps the original generous interaction area.
  const trayHit=kit.mesh(tray,new T.CylinderGeometry(.113,.113,.038,24),hitMaterial,0,.019,0);trayHit.castShadow=false;
  const pack=cigarettePack(kit,table);pack.position.set(.12,.013,-.015);pack.rotation.y=-.15;pack.userData={directSurface:true,action:'cigarette',smokingSeat:i};
  const packHit=kit.mesh(pack,new T.BoxGeometry(.105,.14,.135),hitMaterial,0,.07,0);packHit.castShadow=false;
  const spare=lighterModel(kit,table);spare.group.position.set(.105,.025,.116);spare.group.rotation.x=Math.PI/2;
  // Six identical, immobile tables/lighters share material batches; clickable bowls and packs keep their owners.
  table.updateWorldMatrix(true,true);furniture.attach(base);furniture.attach(spare.group);
  const butt=cigaretteModel(kit,tray);butt.group.position.set(-.020,.016,.020);butt.group.rotation.set(.05,2.1,0);butt.group.scale.setScalar(.6);butt.update(false,0);butt.group.visible=false;
  return{table,pack,tray,butt};
 });
 consolidate(furniture,kit);
 const sleeveMaterial=new T.MeshStandardMaterial({color:'#637a81',roughness:.95});
 const hand=smokingHand(kit,sleeveMaterial,'cigarette'),cigarette=cigaretteModel(kit,hand);scene.add(hand);hand.scale.setScalar(.75);hand.userData={directSurface:true,action:'cigarette'};
 cigarette.group.position.set(.003,.064,-.020);cigarette.group.rotation.set(-.13,-1.9,.08);
 const lighterHand=smokingHand(kit,sleeveMaterial,'lighter');scene.add(lighterHand);lighterHand.scale.set(-.75,.75,.75);
 const lighter=lighterModel(kit,lighterHand);lighter.group.position.set(0,.020,-.012);
 const flameMaterial=new T.MeshBasicMaterial({color:'#ffc87b',transparent:true,opacity:.85,depthWrite:false});
 const flame=kit.mesh(lighter.group,new T.SphereGeometry(.010,10,8),flameMaterial,-.007,.057,0);flame.scale.set(.55,1.5,.55);flame.castShadow=false;
 const plume=smokePlume(kit,scene),mouth=new T.Vector3(),forward=new T.Vector3();
 const tip=new T.Vector3(),contact=new T.Vector3(),socket=new T.Vector3(),rest=new T.Vector3(),axis=new T.Vector3(),down=new T.Vector3(0,-1,0),turn=new T.Quaternion(),endTurn=new T.Quaternion();
 let snapshot:Snapshot|null=null,eye=false,now=0;
 const target=new T.Vector3(),ashTarget=new T.Vector3();
 function seated(){
  const m=snapshot?.room.members.find(m=>m.id===snapshot?.self.id);
  return m&&m.seat!=null&&!m.travel&&!sampleMotion(m,now).moving?m:null;
 }
 return {
  tick(state:Snapshot|null,time:number){snapshot=state;now=time;for(let i=0;i<fixtures.length;i++){const occupant=state?.room.members.find(p=>p.seat===i),s=occupant?.smoking;fixtures[i].butt.group.visible=Boolean(s?.endedAt&&s.seat===i&&(!s.ending||time>=s.endedAt+700));}},
  foreground(camera:T.Camera,state:Snapshot|null,show:boolean,reduced:boolean,time:number){
   snapshot=state;now=time;eye=show;
   const m=seated(),g=smokeGesture(m?.smoking,now);
   hand.visible=show&&Boolean(m)&&(g.active||g.phase==='ending');lighterHand.visible=hand.visible&&g.phase==='lighting';
   if(!hand.visible){plume.hide();return;}
   const aspect=camera instanceof T.PerspectiveCamera?camera.aspect:1,fov=camera instanceof T.PerspectiveCamera?camera.fov:60;
   const halfY=Math.tan(T.MathUtils.degToRad(fov/2))*.58,halfX=halfY*aspect;
   const lift=reduced?(g.phase==='puffing'?.55:0):g.lift;
   hand.position.set(Math.min(.15,halfX*.53)*(1-lift*.60),-Math.min(.24,halfY*.68)+lift*.10,-.58+lift*.13);
   hand.rotation.set(-.12,-.16,-.12+lift*.15);
   hand.position.applyQuaternion(camera.quaternion).add(camera.position);hand.quaternion.premultiply(camera.quaternion);
   if(g.phase==='ending'){
    const reach=reduced?1:T.MathUtils.smoothstep(g.age/490,0,1);
    axis.set(0,0,1).applyQuaternion(cigarette.group.quaternion).applyQuaternion(hand.quaternion);
    turn.setFromUnitVectors(axis,down);endTurn.copy(hand.quaternion).premultiply(turn);hand.quaternion.slerp(endTurn,reach);
    hand.updateMatrixWorld(true);tip.copy(cigarette.tip);cigarette.group.localToWorld(tip);
    contact.set(0,.014,0);fixtures[m!.seat!].tray.localToWorld(contact);hand.position.addScaledVector(contact.sub(tip),reach);
   }
   hand.updateMatrixWorld(true);
   if(lighterHand.visible){
    lighterHand.quaternion.copy(camera.quaternion);lighterHand.rotateY(.25);lighterHand.rotateZ(-.12);
    rest.set(-.11,-Math.min(.26,halfY*.72)-.025,-.55).applyQuaternion(camera.quaternion).add(camera.position);lighterHand.position.copy(rest);lighterHand.updateMatrixWorld(true);
    tip.copy(cigarette.tip);cigarette.group.localToWorld(tip);
    socket.copy(lighter.flameTip);lighter.group.localToWorld(socket);
    const contactAmount=reduced?1:T.MathUtils.smoothstep(Math.min(g.age/260,(1200-g.age)/240),0,1);
    lighterHand.position.addScaledVector(tip.sub(socket),contactAmount);lighterHand.updateMatrixWorld(true);
   }
   flame.visible=!reduced&&g.age>280&&g.age<820;
   const lit=g.phase==='ending'?!reduced&&g.age<490:g.phase!=='lighting'||g.age>650;cigarette.update(lit,g.phase==='puffing'?g.lift:.1);
   sleeveMaterial.color.set(appearance(m!.avatar,m!.id).sleeve);
   camera.getWorldDirection(forward);mouth.copy(camera.position).addScaledVector(forward,.25);mouth.y-=.11;
   plume.update(mouth,Math.atan2(forward.x,forward.z),g.phase==='puffing'?g.age:-1,reduced,1.8);
  },
  targets(){const m=seated();return m?[fixtures[m.seat!].pack,fixtures[m.seat!].tray,...(hand.visible?[hand]:[])]:[];},
  positions(){
   const m=seated();if(!m||!eye)return null;
   const fixture=fixtures[m.seat!],phase=smokeGesture(m.smoking,now).phase;
   fixture.pack.getWorldPosition(target);target.y+=.11;fixture.tray.getWorldPosition(ashTarget);ashTarget.y+=.05;
   if(hand.visible&&phase!=='ending')hand.getWorldPosition(target).add(new T.Vector3(0,.12,0));
   return{cigarette:target.clone(),ashtray:ashTarget.clone()};
  },
  dispose(){hitMaterial.dispose();sleeveMaterial.dispose();cigarette.dispose();plume.dispose();flameMaterial.dispose();fixtures.forEach(f=>f.butt.dispose());}
 };
}
