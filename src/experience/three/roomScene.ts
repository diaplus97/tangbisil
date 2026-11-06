import * as T from 'three';
import {Workshop,mug,packet,pie,consolidate} from './assets';
import type {Snapshot} from '../types';
import {windowLandscape,type LandscapeStatus} from './environment';
import {vaseModel} from './vaseModel';
import {sandModel} from './sandModel';
import {createHealingArchitecture} from './healingArchitecture';
import {createArchitecture} from './architecture';
import {createLighting} from './lighting';
import {createCharacter} from './character';
import {coffeePosition,pantryOffset,sharedPlate} from './layout';
import {sampleMotion,getSpace,type Area} from '../../../shared/space.mjs';
import {CUP_SIPS} from '../../../shared/coffee.mjs';
import {tableDrink} from '../../../shared/table-drink.mjs';
import {CUP_RETURN_MS,SIP_RETURN_MS} from '../gestureTiming';
import type {SeaPlaybackStatus} from './seaPlayback';
import {createRestStations} from './restStations';
import {stoneModel,teaModel} from './restModels';
import {createStations,candyModel,bottleModel} from './stations';
import {windowViews,type WindowView} from './windowView';

export const anchors={shelf:new T.Vector3(-4.15+pantryOffset.x,2.15,.9+pantryOffset.z),drink:new T.Vector3(-4.05+pantryOffset.x,1.85,-1.25+pantryOffset.z),plate:new T.Vector3(sharedPlate.x,1.27,sharedPlate.z)};

export function createRoomScene(onLandscapeStatus:(status:LandscapeStatus)=>void,video:HTMLVideoElement,onPlayback:(status:SeaPlaybackStatus)=>void,area:Area='pantry',view:WindowView=windowViews.sea){
  const map=getSpace(area),{seats}=map,healing=area==='healing';
  const kit=new Workshop(),scene=new T.Scene();
  const architecture=healing?createHealingArchitecture(kit,scene):createArchitecture(kit,scene),lights=createLighting(scene),landscape=windowLandscape(kit,scene,onLandscapeStatus,video,onPlayback,healing?{width:9.72,height:2.76,y:1.66,z:-4.59}:undefined,view);
  const objects=createStations(kit,scene,!healing),restObjects=createRestStations(kit,scene,!healing);
  const people=new Map<string,ReturnType<typeof createCharacter>>();
  const trays=new Map<string,{group:T.Group;cup:T.Group;key:string;tea?:ReturnType<typeof teaModel>}>();
  const dynamic=new T.Group();scene.add(dynamic);let clockOffset=0,current:Snapshot|null=null,firstPerson:string|null=null,holding=false;
  const shared=pie(kit,dynamic);consolidate(shared,kit);shared.scale.setScalar(.25);shared.position.set(sharedPlate.x,1.265,sharedPlate.z);shared.visible=false;
  const hitMaterial=new T.MeshBasicMaterial({visible:false});
  function hit(parent:T.Object3D,action:string,x:number,y:number,z:number,w:number,h:number,d:number){const mesh=kit.mesh(parent,new T.BoxGeometry(w,h,d),hitMaterial,x,y,z);mesh.userData.action=action;mesh.castShadow=false;mesh.receiveShadow=false;return mesh;}
  const shelfHit=healing?null:hit(scene,'snack',-7.22,1.98,.1,.42,.65,1.06);
  if(shelfHit)shelfHit.userData.station='candy';
  const plateHit=hit(shared,'shared',0,0,0,2.4,1.3,1.7);
  const objectTargets=healing?Object.entries(map.stations).map(([id,station])=>{const hit=kit.mesh(scene,new T.BoxGeometry(1.8,1.2,.7),hitMaterial,station!.x,.6,station!.z);hit.userData.station=id;hit.castShadow=false;hit.receiveShadow=false;return hit;}):objects.hits;
  const seatTargets=seats.map(([x,z],index)=>{const mesh=kit.mesh(scene,new T.BoxGeometry(.8,1.25,.8),hitMaterial,x,.65,z);mesh.castShadow=false;mesh.receiveShadow=false;mesh.userData.seat=index;return mesh;});
  const markerMaterial=new T.MeshBasicMaterial({color:'#789b8a',transparent:true,opacity:.55,depthWrite:false});
  const marker=kit.mesh(scene,new T.RingGeometry(.16,.19,48),markerMaterial,0,-.018,0);marker.rotation.x=-Math.PI/2;marker.castShadow=false;marker.receiveShadow=false;marker.visible=false;
  const steam=new T.Group();scene.add(steam);
  const steamMaterial=new T.MeshBasicMaterial({color:'#faf2da',transparent:true,opacity:.28,depthWrite:false});
  for(let i=0;i<5;i++){const puff=kit.mesh(steam,new T.SphereGeometry(.025,6,4),steamMaterial,coffeePosition.x,1.7,coffeePosition.z);puff.castShadow=false;puff.scale.set(1,2,1);}
  const handPosition=new T.Vector3(),tablePosition=new T.Vector3();
  const cameraRay=new T.Raycaster(),cameraSolids:T.Mesh[]=[];for(const root of scene.children)if(root!==dynamic)root.traverse(o=>{if(o instanceof T.Mesh)cameraSolids.push(o);});
  scene.updateMatrixWorld(true);
  function constrainCamera(origin:T.Vector3,desired:T.Vector3,ignoreNear=.2){
    const delta=desired.clone().sub(origin),length=delta.length();cameraRay.set(origin,delta.normalize());cameraRay.far=length+.24;
    const obstruction=cameraRay.intersectObjects(cameraSolids,false).find(h=>{let node:T.Object3D|null=h.object;while(node){if(!node.visible)return false;node=node.parent;}if(!(h.object instanceof T.Mesh))return false;const mat=Array.isArray(h.object.material)?h.object.material[h.face?.materialIndex??0]:h.object.material;return mat.visible&&(!mat.transparent||mat.opacity>.9)&&h.distance>ignoreNear;});
    if(obstruction&&obstruction.distance<length+.24)desired.copy(origin).addScaledVector(delta,Math.max(.45,obstruction.distance-.24));
  }
  function pose(id:string){const m=current?.room.members.find(m=>m.id===id);return m?sampleMotion(m,Date.now()+clockOffset):null;}
  function sync(state:Snapshot|null){
    current=state;if(state)clockOffset=state.serverTime-Date.now();
    const members=state?.room.members??[];
    for(const [id,p]of people)if(!members.some(m=>m.id===id)){p.dispose();people.delete(id);const tray=trays.get(id);if(tray){tray.tea?.dispose();kit.release(tray.group);trays.delete(id);}}
    for(const m of members){
      if(!people.has(m.id)){const p=createCharacter(kit,m);dynamic.add(p.group);people.set(m.id,p);}
      const key=JSON.stringify([m.drink,m.pantry.tableDrink,m.food,m.pantry.candy,m.pantry.bottle,m.pantry.coffee.stage,m.pantry.coffee.sips,m.pantry.rest?.stone?.held,Boolean(m.pantry.rest?.stone),m.pantry.rest?.tea?.held,m.pantry.rest?.tea?.location,Boolean(m.pantry.rest?.tea),Boolean(m.pantry.rest?.sand),m.pantry.rest?.sand?.held,m.pantry.rest?.vase,m.id===state?.self.id?state.self.pantry.rest.vase:null]);if(trays.get(m.id)?.key===key)continue;
      const old=trays.get(m.id);if(old){old.tea?.dispose();kit.release(old.group);}
      const g=new T.Group();dynamic.add(g);
      kit.box(g,.79,.035,.44,0,.01,0,'#bda584',.05);kit.box(g,.74,.015,.4,0,.032,0,'#e8dfc8',.045);
      const foodGroup=new T.Group();g.add(foodGroup);
      if(!healing&&m.food?.state==='sealed'&&m.food.open_progress>0){
        const progress=m.food.open_progress,pack=new T.Group();foodGroup.add(pack);pack.position.set(.16,.05,0);pack.scale.setScalar(.24);
        kit.box(pack,2.05,.018,1.18,0,0,0,'#c2cecc',.04);pie(kit,pack);
        const width=2.05*(1-progress),edge=-1.025+2.05*progress;
        kit.box(pack,width,.55,1.02,edge+width/2,.28,0,'#efe4c3',.025);
        for(const z of[-.49,.49])kit.box(pack,width,.014,.055,edge+width/2,.56,z,'#97b1bd',.004);
        const curl=kit.cylinder(pack,.105,.105,1.04,edge,.61,0,'#e8d9b1');curl.rotation.x=Math.PI/2;
      }else if(!healing&&(m.food?.state==='sealed'||m.id===state?.self.id&&(!m.food||m.food.state==='empty'))){const pack=packet(kit,foodGroup,.16,.08,0,.65);pack.rotation.x=-Math.PI/2;pack.position.z=.14;}
      else if(!healing&&m.food?.state==='open'){const snack=pie(kit,foodGroup,m.food.bites,m.food.portions===1);snack.scale.setScalar(.24);snack.position.set(.16,.05,0);}
      if(m.pantry?.candy&&!m.pantry.candy.held&&m.pantry.candy.state!=='eaten'){const candy=candyModel(kit,g,m.pantry.candy.progress);candy.position.set(.29,.12,.12);candy.scale.setScalar(.55);}
      foodGroup.removeFromParent();consolidate(foodGroup,kit);consolidate(g,kit);g.add(foodGroup);
      const rest=m.pantry.rest,drinkKind=tableDrink(m.pantry);let tea:ReturnType<typeof teaModel>|undefined;
      const cup=drinkKind==='tea'?(tea=teaModel(kit,g)).group:drinkKind==='bottle'?bottleModel(kit,g,m.pantry.bottle?.sips??0):mug(kit,g,0,0,0,m.drink,1,1-(m.pantry.coffee.sips??0)/CUP_SIPS);
      cup.scale.setScalar(healing?.6:drinkKind==='tea'?.65:.75);cup.position.set(healing?.25:-.23,.048,0);if(drinkKind!=='tea')consolidate(cup,kit);
      if(healing&&rest?.sand&&!(m.id===state?.self.id&&rest.sand.held)){const sand=sandModel(kit,g);sand.group.position.set(.03,.06,.09);sand.group.scale.setScalar(.6);}
      if(healing&&rest?.vase&&!(m.id===state?.self.id&&rest.vase.held)){const personal=m.id===state?.self.id?state.self.pantry.rest.vase:null,vase=vaseModel(kit,g,rest.vase.flower,personal?.position??0,personal?.tilt??0);vase.position.set(-.25,.05,-.16);}
      if(!healing&&rest?.stone){kit.box(g,.45,.022,.65,-.62,.035,.04,'#c8d1be',.04);}
      if(rest?.stone&&!rest.stone.held){const stone=stoneModel(kit,g);stone.group.position.set(healing?-.25:-.62,.14,healing?.22:.2);stone.group.scale.setScalar(.8);}
      if(m.id===state?.self.id){
        foodGroup.userData.action='snack';
        cup.userData.action='cup';
        if(m.pantry?.candy&&!m.pantry.candy.held&&m.pantry.candy.state!=='eaten')hit(g,'candy',.29,.15,.12,.2,.18,.2);
      }
      trays.set(m.id,{group:g,cup,key,tea});
    }
    shared.visible=Boolean(state?.room.offers.length);
  }
  function tick(time:number,state:Snapshot|null,reduced:boolean){
    const now=Date.now()+clockOffset;architecture.tickDoor(state,now,reduced);
    objects.tick(state,now,time,reduced);restObjects.tick(state,now,time,reduced);
    for(const m of state?.room.members??[]){
      const p=people.get(m.id);if(!p)continue;const position=sampleMotion(m,now),gesture=p.update(m,position,time,now,reduced,m.id===state?.self.id),tray=trays.get(m.id);
      if(tray){
        tray.tea?.update(m.pantry.rest?.tea??null,now,time,reduced);
        gesture.carry.getWorldPosition(handPosition);tray.group.rotation.set(0,p.group.rotation.y,0);
        if(position.inSeat!=null){const [x,z,a]=seats[position.inSeat];tablePosition.set(x+Math.sin(a)*.88,healing?map.tables[map.seatTables[position.inSeat]].y+.055:1.215,z+Math.cos(a)*.88);tray.group.position.copy(handPosition).lerp(tablePosition,T.MathUtils.smoothstep(position.sit,0,1));}
        else tray.group.position.copy(handPosition);
        const ownView=firstPerson===m.id;
        const cupAge=now-m.actionAt,lift=ownView&&m.action==='wave'&&cupAge>=0&&cupAge<CUP_RETURN_MS?Math.max(0,Math.min(1,cupAge/400,(CUP_RETURN_MS-cupAge)/450)):0;
        // In first person the local body is hidden, but its cup still lifts and
        // returns to the actual tray at the shared contact-sound timestamp.
        const sipping=['cup-sip','tea-sip','bottle-sip'].includes(m.action)&&cupAge>=0&&cupAge<SIP_RETURN_MS;
        tray.cup.visible=!sipping&&(tableDrink(m.pantry)!=='cup'||m.pantry.coffee.stage==='carried');
        tray.cup.position.set(healing?.25:-.23,.048+lift*.25,(healing?-.15:0)-lift*.12);
        tray.cup.rotation.x=lift*.12;
        tray.group.visible=!(firstPerson===m.id&&(holding||position.inSeat==null));
      }
      p.group.visible=firstPerson!==m.id;
    }
    const me=state?.room.members.find(m=>m.id===state.self.id),myPose=me?sampleMotion(me,now):null;
    marker.visible=Boolean(me?.motion&&myPose?.moving);if(me?.motion){const end=me.motion.points.at(-1)!;marker.position.set(end.x,-.018,end.z);}
    steam.visible=false;
  }
  function lighting(warm:boolean){lights.setWarm(warm);architecture.lighting(warm);landscape.lighting(warm);}
  return {scene,sync,tick,lighting,constrainCamera,now:()=>Date.now()+clockOffset,interactionTargets(){return [...objects.interactionTargets,...restObjects.interactionTargets,...(shelfHit?[shelfHit]:[]),...(shared.visible?[plateHit]:[]),...(current&&trays.get(current.self.id)?[trays.get(current.self.id)!.group]:[])];},landscape:landscape.select,reveal:architecture.reveal,seaMotion:landscape.motion,active:landscape.active,seatTargets,objectTargets,portalTargets:architecture.portalTargets,foreground(camera:T.Camera,state:Snapshot|null,show:boolean,pull:number|null,reduced=false){const r=state?.self.pantry.rest;objects.foreground(camera,state,show&&!r?.sprayer&&!r?.stone?.held&&!r?.tea?.held,pull,reduced,Date.now()+clockOffset);restObjects.foreground(camera,state,show);},cupPosition(){const tray=current&&trays.get(current.self.id);return tray?.group.visible?tray.group.localToWorld(new T.Vector3(-.23,.20,0)):null;},snackPosition(){const tray=current&&trays.get(current.self.id);return tray?.group.visible?tray.group.localToWorld(new T.Vector3(.16,.20,0)):null;},pose,firstPerson(id:string|null,foodInHand=false){firstPerson=id;holding=foodInHand;},labelPosition(id:string){const p=pose(id);return p?people.get(id)?.labelPosition(p):undefined;},interior(enabled:boolean,perspective=enabled){architecture.interior(enabled);landscape.interior(perspective);},dispose(){for(const p of people.values())p.dispose();objects.dispose();restObjects.dispose();for(const tray of trays.values())tray.tea?.dispose();landscape.dispose();kit.dispose();steamMaterial.dispose();hitMaterial.dispose();markerMaterial.dispose();}};
}
