import * as T from 'three';
import {Workshop,label,consolidate} from './assets';
import {leafGeometry,leafMaterials} from './plants';
import {misterModel,stoneModel,teaModel} from './restModels';
import {stations} from '../../../shared/space.mjs';
import {sampleTea} from '../../../shared/rest.mjs';
import type {Snapshot,Tea} from '../types';

export function createRestStations(kit:Workshop,scene:T.Scene,visible=true){
 const foregroundScene=scene;if(!visible)scene=new T.Scene();
 const shelf=new T.Group();shelf.position.set(stations.plant.x,0,stations.plant.z);scene.add(shelf);
 shelf.userData={directSurface:true,station:'plant',action:'plant'};
 const furniture=new T.Group();shelf.add(furniture);
 for(const y of[.26,1.04])kit.box(furniture,1.45,.065,.7,0,y,0,'#c4b391',.035);
 for(const x of[-.64,.64])for(const z of[-.27,.27])kit.box(furniture,.045,1.03,.045,x,.52,z,'#81998b',.015);
 kit.box(furniture,.38,.16,.28,.28,.38,0,'#d3c9ac',.025);
 label(kit,furniture,'잠깐, 초록을 돌봐요',.75,.11,0,.94,.355,'#56765c','#e8ead8',80);
 const leaves:{pivot:T.Group;rest:number;index:number}[]=[],mats=leafMaterials(kit);
 const droplets:T.Mesh[]=[];const dropletMat=new T.MeshPhysicalMaterial({color:'#defff4',roughness:.08,metalness:.1,transparent:true,opacity:.75,clearcoat:1});kit.materials.set('leaf-dew',dropletMat);
 for(const [pot,x,size]of[[0,-.32,1],[1,.28,.75]]){
  const plant=new T.Group();shelf.add(plant);plant.position.set(x,1.075,-.08);
  const profile=[[0,0],[.115,0],[.14,.04],[.175,.23],[.176,.26],[.16,.268],[.15,.24],[.12,.04]].map(([r,y])=>new T.Vector2(r*size,y*size));
  kit.mesh(plant,new T.LatheGeometry(profile,48),kit.mat(pot?'#c4d3bc':'#eee6d0',.45));kit.cylinder(plant,.154*size,.154*size,.018,0,.24*size,0,'#5a5341');
  for(let i=0;i<14;i++){
   const angle=i*2.399+pot,height=.25*size+(i%4)*.095*size,reach=.08+(i%3)*.035;
   const pivot=new T.Group();plant.add(pivot);pivot.position.set(Math.cos(angle)*reach,height,Math.sin(angle)*reach);pivot.rotation.set(-.35+(i%5)*.13,angle,0);pivot.scale.setScalar(size*(.7+(i%3)*.12));
   kit.tube(plant,[new T.Vector3(0,.24*size,0),new T.Vector3(pivot.position.x*.5,height+.02,pivot.position.z*.5),pivot.position],.004,'#70905a');
   kit.mesh(pivot,leafGeometry(),mats[i%3]);leaves.push({pivot,rest:pivot.rotation.x,index:i+pot*14});
   for(let d=0;d<2;d++){const dew=kit.mesh(pivot,new T.SphereGeometry(.009+d*.003,10,8),dropletMat,(d?-.04:.028),.011,.18+d*.065);dew.scale.set(1,.5,1.2);dew.visible=false;dew.castShadow=false;droplets.push(dew);}
  }
 }
 const parkedMister=misterModel(kit,furniture);parkedMister.position.set(.55,1.08,.2);
 // Keep the bottle separate: it disappears from its stand while held.
 furniture.remove(parkedMister);shelf.add(parkedMister);consolidate(furniture,kit);
 const mistMaterial=new T.MeshBasicMaterial({color:'#e5fff4',transparent:true,opacity:.42,depthWrite:false});
 const mist=new T.InstancedMesh(new T.SphereGeometry(.007,5,4),mistMaterial,52);mist.frustumCulled=false;shelf.add(mist);const dummy=new T.Object3D();
 const basket=new T.Group();basket.position.set(stations.stone.x,0,stations.stone.z);scene.add(basket);
 kit.box(basket,1.15,.07,.7,0,.74,0,'#c6b79b',.06);for(const x of[-.48,.48])for(const z of[-.26,.26])kit.box(basket,.055,.74,.055,x,.37,z,'#769289',.018);
 const woven=kit.mat('#b2b69a',.92),profile=[[.18,0],[.24,0],[.29,.17],[.282,.2],[.26,.2],[.22,.04],[.18,.04]].map(([r,y])=>new T.Vector2(r,y));kit.mesh(basket,new T.LatheGeometry(profile,48),woven,0,.78,0);
 for(let j=0;j<10;j++){const ring=kit.mesh(basket,new T.TorusGeometry(.24+j*.004,.004,5,64),kit.mat(j%2?'#a2a78a':'#c4c8ae'),0,.79+j*.018,0);ring.rotation.x=Math.PI/2;}
 for(let j=0;j<32;j++){const a=j/32*Math.PI*2;kit.tube(basket,[new T.Vector3(Math.sin(a)*.237,.79,Math.cos(a)*.237),new T.Vector3(Math.sin(a)*.28,.965,Math.cos(a)*.28)],.003,'#d1d2bb');}
 const sampleStone=stoneModel(kit,basket);sampleStone.group.position.set(0,.92,0);sampleStone.group.rotation.x=.25;
 label(kit,basket,'말랑돌 · 가져가 쉬어요',.68,.105,0,.65,-.355,'#557269','#ecebdb',72).rotation.y=Math.PI;
 const tray=new T.Group();tray.position.set(stations.tea.x+.12,1.34,stations.tea.z);tray.rotation.y=Math.PI/2;scene.add(tray);
 const counter=new T.Group();scene.add(counter);kit.box(counter,1.1,1.23,.86,stations.tea.x,.615,stations.tea.z,'#c9c7ae',.045);kit.box(counter,1.15,.065,.9,stations.tea.x,1.305,stations.tea.z,'#e8e3d0',.025);consolidate(counter,kit);
 kit.box(tray,.84,.035,.66,0,.018,0,'#929f83',.035);kit.box(tray,.79,.008,.61,0,.04,0,'#cdd3bb',.02);
 const tea=teaModel(kit,tray);tea.group.position.set(-.2,.05,.12);const saucer=kit.cylinder(tray,.1,.09,.018,.06,.06,.22,'#e0dfcc');const usedBag=kit.box(tray,.06,.01,.08,.06,.075,.22,'#9c946c',.006);
 const tin=kit.cylinder(tray,.06,.06,.12,.3,.11,.2,'#b4c5aa');label(kit,tray,'보리차',.072,.043,.3,.13,.261,'#52775d','#dfe4cc',90);
 const kettle=new T.Group();tray.add(kettle);const kprofile=[[0,0],[.13,0],[.15,.06],[.145,.2],[.1,.26],[.085,.27]].map(([r,y])=>new T.Vector2(r,y));kit.mesh(kettle,new T.LatheGeometry(kprofile,48),kit.mat('#e7dfc9',.32));kit.cylinder(kettle,.095,.1,.022,0,.278,0,'#c4ccb7');kit.sphere(kettle,.025,0,.3,0,'#6c8575',1,.6,1);
 const handle=kit.mesh(kettle,new T.TorusGeometry(.115,.018,12,40,Math.PI*1.6),kit.mat('#688174'),.12,.13,0);handle.rotation.z=-Math.PI*.3;
 kit.tube(kettle,[new T.Vector3(-.11,.09,0),new T.Vector3(-.22,.18,.08),new T.Vector3(-.36,.22,.24)],.019,'#e7dfc9');
 kit.cylinder(tray,.125,.14,.12,.16,.11,-.12,'#819581');
 const tap=kit.box(kettle,.045,.022,.05,-.16,.18,.04,'#6d8a75',.008);

 const stream=kit.cylinder(tray,.005,.009,.13,-.2,.355,.12,'#d4dfcb');stream.visible=false;stream.castShadow=false;const waterMat=new T.MeshPhysicalMaterial({color:'#f2fff8',transparent:true,opacity:.55,roughness:.08,clearcoat:1,depthWrite:false});kit.materials.set('tea-stream',waterMat);stream.material=waterMat;
 label(kit,tray,'따뜻한 보리차',.6,.08,0,-.085,.49,'#5b735d','#e8e3d0',84);
 const hand=new T.Group();hand.userData.action='held';foregroundScene.add(hand);let handKind='',held:T.Group|null=null,heldTea:ReturnType<typeof teaModel>|null=null;
 function foreground(camera:T.Camera,state:Snapshot|null,show:boolean){
  const r=state?.self.pantry.rest,kind=r?.sprayer?'sprayer':r?.tea?.held?'tea':'';hand.visible=show&&Boolean(kind);if(!hand.visible)return;
  if(kind!==handKind){heldTea?.dispose();heldTea=null;if(held)kit.release(held);held=new T.Group();hand.add(held);handKind=kind;
   const item=kind==='sprayer'?misterModel(kit,held):(heldTea=teaModel(kit,held)).group;item.position.set(0,-.13,0);
   kit.sphere(held,.06,.07,-.07,.04,'#dfb599',.55,.8,1);kit.box(held,.085,.09,.25,.095,-.13,.17,'#6d8c99',.03);
  }
  hand.traverse(o=>{if(o instanceof T.Mesh)o.castShadow=false;});
  const now=state?state.serverTime+performance.now()-received:Date.now();heldTea?.update(r?.tea??null,now,performance.now(),false);
  const bottom=camera instanceof T.PerspectiveCamera?-Math.tan(T.MathUtils.degToRad(camera.fov/2))*.68*.7:-.2;
  hand.position.set(.19,bottom,-.68).applyQuaternion(camera.quaternion).add(camera.position);hand.quaternion.copy(camera.quaternion);hand.scale.setScalar(.75);
  if(kind==='sprayer'&&r){const age=now-r.sprayAt;hand.rotateX(age>=0&&age<650?Math.sin(age/650*Math.PI)*-.12:0);}
 }
 let received=performance.now(),snapshot:Snapshot|null=null;
 function tick(state:Snapshot|null,now:number,time:number,reduced:boolean){
  if(snapshot!==state){snapshot=state;received=performance.now();}
  const members=state?.room.members??[],spray=Math.max(0,...members.map(m=>m.pantry.rest?.sprayAt??0)),brush=Math.max(0,...members.map(m=>m.pantry.rest?.brushAt??0)),age=now-spray,brushAge=now-brush;
  parkedMister.visible=!members.some(m=>m.station==='plant'&&m.pantry.rest?.sprayer);
  leaves.forEach(({pivot,rest,index})=>{const a=age<1900?Math.exp(-age/600)*Math.sin(age*.012+index*.6)*.055:0,b=brushAge<2200?Math.exp(-brushAge/800)*Math.sin(brushAge*.006+index*.3)*.12:0;pivot.rotation.x=rest+(reduced?0:a+b);});
  droplets.forEach((d,i)=>{d.visible=spray>0&&age>220+i*5&&age<18000;});dropletMat.opacity=Math.max(0,.75*(1-age/18000));
  mist.visible=!reduced&&spray>0&&age>=0&&age<650;
  if(mist.visible)for(let i=0;i<52;i++){const t=Math.max(0,(age-i*3)/650),a=i*2.399,r=.025+((i*37)%53)/53*.21;dummy.position.set(.5*(1-t)+Math.cos(a)*r*t,1.42+Math.sin(a)*r*t-.13*t*t,.55-.7*t);dummy.scale.setScalar(t>0?Math.sin(Math.PI*Math.min(1,t)):.001);dummy.updateMatrix();mist.setMatrixAt(i,dummy.matrix);}if(mist.visible)mist.instanceMatrix.needsUpdate=true;
  const owner=members.find(m=>m.station==='tea'&&m.pantry.rest?.tea?.location==='station'),raw=owner?.pantry.rest.tea??null,t=sampleTea(raw as Tea|null,now),pouring=Boolean(t?.pourAt&&t.pourEnd>now);
  tea.group.visible=Boolean(t);tea.update(raw,now,time,reduced);usedBag.visible=Boolean(t?.bagUsed&&!t.bagIn);saucer.visible=true;tin.visible=true;stream.visible=pouring;const surface=.095+(t?.volume??0)*.155;stream.position.y=(.38+surface)/2;stream.scale.y=(.38-surface)/.13;stream.scale.x=reduced?1:1+Math.sin(time*.023)*.08;
  kettle.position.set(.16,.16,-.12);kettle.rotation.z=0;tap.position.y=pouring?.172:.18;
 }
 return{interactionTargets:[hand],tick,foreground,dispose(){mist.geometry.dispose();mistMaterial.dispose();tea.dispose();heldTea?.dispose();}};
}
