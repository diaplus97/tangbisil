import * as T from 'three';
import {createCameraCollision} from './cameraCollision';
import {createDestinationMarker} from './destinationMarker';
import {createSeatMarkers} from './seatMarkers';
import {Workshop,mug,mugSaucer,packet,pie,consolidate} from './assets';
import type {Snapshot} from '../types';
import {windowLandscape,type LandscapeStatus} from './environment';
import {vaseModel} from './vaseModel';
import {sandModel} from './sandModel';
import {createSmokingScene} from './smokingScene';
import {createSmokingArchitecture} from './smokingArchitecture';
import {createHealingArchitecture} from './healingArchitecture';
import {createArchitecture} from './architecture';
import {createLighting} from './lighting';
import {createCharacter} from './character';
import {coffeePosition,pantryOffset,sharedPlate} from './layout';
import {sampleMotion,getSpace,type Area} from '../../../shared/space.mjs';
import {CUP_SIPS} from '../../../shared/coffee.mjs';
import {tableDrink} from '../../../shared/table-drink.mjs';
import type {SeaPlaybackStatus} from './seaPlayback';
import {createRestStations} from './restStations';
import {stoneModel,teaModel} from './restModels';
import {createStations,candyModel,bottleModel} from './stations';
import {windowViews,type WindowView} from './windowView';

export const anchors={shelf:new T.Vector3(-4.15+pantryOffset.x,2.15,.9+pantryOffset.z),drink:new T.Vector3(-4.05+pantryOffset.x,1.85,-1.25+pantryOffset.z),plate:new T.Vector3(sharedPlate.x,1.27,sharedPlate.z)};

export function createRoomScene(onLandscapeStatus:(status:LandscapeStatus)=>void,video:HTMLVideoElement,onPlayback:(status:SeaPlaybackStatus)=>void,area:Area='pantry',view:WindowView=windowViews.sea){
  const map=getSpace(area),{seats}=map,healing=area==='healing',smoking=area==='smoking';
  const kit=new Workshop(),scene=new T.Scene();
  const architecture=smoking?createSmokingArchitecture(kit,scene):healing?createHealingArchitecture(kit,scene):createArchitecture(kit,scene),lights=createLighting(scene),landscape=windowLandscape(kit,scene,onLandscapeStatus,video,onPlayback,smoking?{width:9.28,height:2.57,y:1.94,z:-4.25}:healing?{width:9.72,height:2.76,y:1.66,z:-4.59}:undefined,view);
  let objects=area==='pantry'?createStations(kit,scene):null,restObjects=area==='pantry'?createRestStations(kit,scene):null;
  const smokingObjects=smoking?createSmokingScene(kit,scene):null;
  const seatMarkers=createSeatMarkers(kit,scene,area);
  const people=new Map<string,ReturnType<typeof createCharacter>>();
  const trays=new Map<string,{group:T.Group;food:T.Group;cup:T.Group;key:string;tea?:ReturnType<typeof teaModel>}>();
  const dynamic=new T.Group();scene.add(dynamic);let clockOffset=0,current:Snapshot|null=null,firstPerson:string|null=null,selectionViewer:string|null=null,holding=false;
  const shared=pie(kit,dynamic);consolidate(shared,kit);shared.scale.setScalar(.25);shared.position.set(sharedPlate.x,1.265,sharedPlate.z);shared.visible=false;
  const hitMaterial=new T.MeshBasicMaterial({visible:false});
  function hit(parent:T.Object3D,action:string,x:number,y:number,z:number,w:number,h:number,d:number){const mesh=kit.mesh(parent,new T.BoxGeometry(w,h,d),hitMaterial,x,y,z);mesh.userData.action=action;mesh.castShadow=false;mesh.receiveShadow=false;return mesh;}
  const shelfHit=area!=='pantry'?null:hit(scene,'snack',-7.22,1.98,.1,.42,.65,1.06);
  if(shelfHit)shelfHit.userData.station='candy';
  const plateHit=hit(shared,'shared',0,0,0,2.4,1.3,1.7);
  const objectTargets=healing?Object.entries(map.stations).map(([id,station])=>{const hit=kit.mesh(scene,new T.BoxGeometry(1.8,1.2,.7),hitMaterial,station!.x,.6,station!.z);hit.userData.station=id;hit.castShadow=false;hit.receiveShadow=false;return hit;}):objects?.hits??[];
  const seatTargets=seats.map(([x,z],index)=>{const wide=healing&&index<4?1.36:smoking?.98:.84;const mesh=kit.mesh(scene,new T.BoxGeometry(wide,1.45,wide),hitMaterial,x,.725,z);mesh.castShadow=false;mesh.receiveShadow=false;mesh.userData.seat=index;return mesh;});
  const destination=createDestinationMarker(kit,scene);
  const steam=new T.Group();scene.add(steam);
  const steamMaterial=new T.MeshBasicMaterial({color:'#faf2da',transparent:true,opacity:.28,depthWrite:false});
  for(let i=0;i<5;i++){const puff=kit.mesh(steam,new T.SphereGeometry(.025,6,4),steamMaterial,coffeePosition.x,1.7,coffeePosition.z);puff.castShadow=false;puff.scale.set(1,2,1);}
  const handPosition=new T.Vector3(),handRotation=new T.Quaternion(),tableRotation=new T.Quaternion();
  const constrainCamera=createCameraCollision(area);
  function pose(id:string){const m=current?.room.members.find(m=>m.id===id);return m?sampleMotion(m,Date.now()+clockOffset):null;}
  function sync(state:Snapshot|null){
    current=state;if(state)clockOffset=state.serverTime-(state.receivedAt??Date.now());
    const members=state?.room.members??[];
    for(const [id,p]of people)if(!members.some(m=>m.id===id)){p.dispose();people.delete(id);const tray=trays.get(id);if(tray){tray.tea?.dispose();kit.release(tray.group);trays.delete(id);}}
    for(const m of members){
      const previous=people.get(m.id);
      if(previous?.avatar!==m.avatar){previous?.dispose();const p=createCharacter(kit,m);dynamic.add(p.group);people.set(m.id,p);}
      if(smoking)continue;
      const key=JSON.stringify([m.drink,m.pantry.tableDrink,m.food,m.pantry.candy,m.pantry.bottle,m.pantry.coffee.sips,m.pantry.rest?.stone?.held,Boolean(m.pantry.rest?.stone),m.pantry.rest?.tea?.held,m.pantry.rest?.tea?.location,Boolean(m.pantry.rest?.tea),Boolean(m.pantry.rest?.sand),m.pantry.rest?.sand?.held,m.pantry.rest?.vase,m.id===state?.self.id?state.self.pantry.rest.vase:null]);if(trays.get(m.id)?.key===key)continue;
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
      const cup=drinkKind==='tea'?(tea=teaModel(kit,g)).group:drinkKind==='bottle'?bottleModel(kit,g,m.pantry.bottle?.sips??0):mug(kit,g,0,0,0,m.drink,1,1-(m.pantry.coffee.sips??0)/CUP_SIPS,false);
      if(drinkKind!=='bottle'){
        const saucer=mugSaucer(kit,g);saucer.position.set(healing?.25:-.23,.048,healing?-.15:0);saucer.scale.setScalar(healing?.6:.75);
      }
      cup.scale.setScalar(healing?.6:drinkKind==='tea'?.65:.75);cup.position.set(healing?.25:-.23,.048,0);if(drinkKind!=='tea')consolidate(cup,kit);
      if(healing&&rest?.sand&&!(m.id===state?.self.id&&rest.sand.held)){const sand=sandModel(kit,g);sand.group.position.set(.03,.06,.09);sand.group.scale.setScalar(.6);}
      if(healing&&rest?.vase&&!(m.id===state?.self.id&&rest.vase.held)){const personal=m.id===state?.self.id?state.self.pantry.rest.vase:null,vase=vaseModel(kit,g,rest.vase.flower,personal?.position??0,personal?.tilt??0);vase.position.set(-.25,.05,-.16);}
      if(!healing&&rest?.stone){kit.box(g,.45,.022,.65,-.62,.035,.04,'#c8d1be',.04);}
      if(rest?.stone&&!rest.stone.held){const stone=stoneModel(kit,g);stone.group.position.set(healing?-.25:-.62,.14,healing?.22:.2);stone.group.scale.setScalar(.8);}
      if(m.id===state?.self.id){
        foodGroup.userData.action='snack';
        foodGroup.userData.directSurface=true;
        cup.userData.action='cup';
        cup.userData.directSurface=true;
        // The table remains a stable target while the cup is in the hand.
        hit(g,'cup',healing?.25:-.23,.11,healing?-.15:0,.245,.15,.24);
        if(!healing)hit(g,'snack',.16,.12,.03,.56,.24,.42);
        if(m.pantry?.candy&&!m.pantry.candy.held&&m.pantry.candy.state!=='eaten')hit(g,'candy',.29,.15,.12,.2,.18,.2);
        if(rest?.stone&&!rest.stone.held)hit(g,'stone-held',healing?-.25:-.62,.14,healing?.22:.2,.32,.25,.3);
        if(healing&&rest?.sand&&!rest.sand.held)hit(g,'sand-held',.03,.10,.09,.48,.18,.32);
        if(healing&&rest?.vase&&!rest.vase.held)hit(g,'vase-held',-.25,.20,-.16,.26,.42,.26);
      }
      trays.set(m.id,{group:g,food:foodGroup,cup,key,tea});
    }
    shared.visible=Boolean(state?.room.offers.length);
  }
  function tick(time:number,state:Snapshot|null,reduced:boolean){
    const now=Date.now()+clockOffset;smokingObjects?.tick(state,now);architecture.tickDoor(state,now,reduced);
    objects?.tick(state,now,time,reduced);restObjects?.tick(state,now,time,reduced);
    for(const m of state?.room.members??[]){
      const p=people.get(m.id);if(!p)continue;const position=sampleMotion(m,now),gesture=p.update(m,position,time,now,reduced,m.id===state?.self.id),tray=trays.get(m.id);
      if(tray){
        tray.tea?.update(m.pantry.rest?.tea??null,now,time,reduced);
        const seat=position.inSeat===m.seat&&position.sit>.52?position.inSeat:m.parkedSeat;
        tray.group.visible=seat!=null&&!(firstPerson===m.id&&holding);
        if(tray.group.visible&&seat!=null){
          const [x,z,a]=seats[seat];
          tray.group.rotation.set(0,a,0);
          tray.group.position.set(x+Math.sin(a)*.88,healing?map.tables[map.seatTables[seat]].y+.055:1.215,z+Math.cos(a)*.88);
          tray.cup.visible=tableDrink(m.pantry)!=='cup'||m.pantry.coffee.stage==='carried';
          tray.food.visible=!(gesture.eating&&(!m.food||m.food.state==='empty'));
          tray.cup.position.set(healing?.25:-.23,.048,healing?-.15:0);tray.cup.rotation.set(0,Math.PI,0);
          if(gesture.lift>0){
            gesture.cupSocket.getWorldPosition(handPosition);tray.group.worldToLocal(handPosition);
            gesture.cupSocket.getWorldQuaternion(handRotation);
            tray.group.getWorldQuaternion(tableRotation).invert();handRotation.premultiply(tableRotation);
            // Follow the actual handle grip at the lip; ease across the last
            // few centimetres to the same saucer on pickup and return.
            const grip=T.MathUtils.smoothstep(gesture.lift,0,.68);
            tray.cup.position.lerp(handPosition,grip);tray.cup.quaternion.slerp(handRotation,grip);
          }
        }
      }
      p.group.visible=firstPerson!==m.id&&selectionViewer!==m.id;
    }
    const me=state?.room.members.find(m=>m.id===state.self.id),myPose=me?sampleMotion(me,now):null;
    destination.tick(time,Boolean(myPose?.moving),reduced);
    steam.visible=false;
  }
  function ownTable(){
    const self=current?.self.id;if(!self)return;
    const poseNow=pose(self);if(poseNow?.phase!=='seated')return;
    return trays.get(self);
  }
  function objectPoint(action:string){
    if(action.startsWith('seat-'))return seatMarkers.point(Number(action.slice(5)));
    if(action==='coffee'){const machine=scene.getObjectByName('pantry-coffee-machine');if(machine)return machine.localToWorld(new T.Vector3(0,.45,.34));}
    if(action==='stone-basket'&&map.stations.stone){const s=map.stations.stone;return new T.Vector3(s.x,.95,s.z);}
    if(action==='plant-stand'&&map.stations.plant){const s=map.stations.plant;return new T.Vector3(s.x+.55,1.075,s.z+.2);}
    if(action==='cigarette'||action==='ashtray'){const points=smokingObjects?.positions();return points?.[action];}
    if(action==='shared')return shared.visible?shared.getWorldPosition(new T.Vector3()):undefined;
    let found:T.Vector3|undefined;
    const groups=[ownTable()?.group,...(objects?.interactionTargets??[]),...(restObjects?.interactionTargets??[]),people.get(current?.self.id??'')?.group,scene];
    for(const group of groups)group?.traverseVisible(o=>{if(!found&&o.userData.action===action)found=o.getWorldPosition(new T.Vector3());});
    if(found)return found;
    const id=action==='leaf'?'plant':action.startsWith('fridge-')?'fridge':action,station=map.stations[id as keyof typeof map.stations];
    return station?new T.Vector3(station.x,station.y,station.z):undefined;
  }
  function lighting(warm:boolean){lights.setWarm(warm);architecture.lighting(warm);landscape.lighting(warm);}
  return {scene,sync,tick,lighting,seatMarkers,objectPoint,constrainCamera,destination,now:()=>Date.now()+clockOffset,interactionTargets(){const tray=ownTable(),ownCharacter=people.get(current?.self.id??'');return [...(ownCharacter?[ownCharacter.group]:[]),...(smokingObjects?.targets()??[]),...(objects?.interactionTargets??[]),...(restObjects?.interactionTargets??[]),...(shelfHit?[shelfHit]:[]),...(shared.visible?[plateHit]:[]),...(tray?[tray.group]:[])];},landscape:landscape.select,reveal(camera:T.Camera,actor:{x:number;z:number}|null,reduced:boolean){architecture.reveal(camera,actor,reduced,destination.point);objects?.reveal?.(camera,actor,reduced);},seaMotion:landscape.motion,active:landscape.active,seatTargets,objectTargets,portalTargets:architecture.portalTargets,foreground(camera:T.Camera,state:Snapshot|null,show:boolean,pull:number|null,reduced=false){if(healing&&show&&!objects){objects=createStations(kit,scene,false);restObjects=createRestStations(kit,scene,false);}const r=state?.self.pantry.rest;smokingObjects?.foreground(camera,state,firstPerson!==null,reduced,Date.now()+clockOffset);objects?.foreground(camera,state,show&&!r?.sprayer&&!r?.stone?.held&&!r?.tea?.held,pull,reduced,Date.now()+clockOffset);restObjects?.foreground(camera,state,show);},smokingPositions(){return smokingObjects?.positions()??null;},cupPosition(){const tray=ownTable();return tray?.group.visible?tray.group.localToWorld(new T.Vector3(-.23,.20,0)):null;},snackPosition(){const tray=ownTable();return tray?.group.visible?tray.group.localToWorld(new T.Vector3(.16,.20,0)):null;},pose,selectionViewer(id:string|null){selectionViewer=id;},firstPerson(id:string|null,foodInHand=false){firstPerson=id;holding=foodInHand;},labelPosition(id:string){const p=pose(id);return p?people.get(id)?.labelPosition(p):undefined;},interior(enabled:boolean,perspective=enabled){architecture.interior(enabled);landscape.interior(perspective);},dispose(){seatMarkers.dispose();smokingObjects?.dispose();for(const p of people.values())p.dispose();objects?.dispose();restObjects?.dispose();for(const tray of trays.values())tray.tea?.dispose();landscape.dispose();kit.dispose();steamMaterial.dispose();hitMaterial.dispose();destination.dispose();}};
}
