import * as T from 'three';
import {Workshop,mug,label,consolidate} from './assets';
import {stations,type StationId} from '../../../shared/space.mjs';
import type {Snapshot} from '../types';
import {coffeePhase,CUP_PLACE_MS,CUP_LIFT_MS} from '../../../shared/coffee.mjs';

export function candyModel(kit:Workshop,parent:T.Object3D,progress=0,eaten=false){
  const g=new T.Group();parent.add(g);
  const sugar=kit.mesh(g,new T.SphereGeometry(.095,28,20),kit.mat('#e9b955',.24));sugar.scale.set(1,.56,.8);sugar.visible=!eaten;
  const wrap=new T.Group();g.add(wrap);
  for(const side of[-1,1]){
    const half=new T.Group();wrap.add(half);half.position.x=side*(.045+progress*.18);half.rotation.z=side*progress*.35;
    const skin=kit.box(half,.125,.12,.18,side*.012,0,0,'#f3df9c',.045);
    skin.scale.x=1-progress*.45;
    kit.box(half,.029,.122,.181,-side*.035,0,0,'#81a391',.008);
    const geo=new T.CylinderGeometry(.082,.025,.12,24,5,true),pos=geo.getAttribute('position');
    for(let i=0;i<pos.count;i++){const y=pos.getY(i),a=Math.atan2(pos.getZ(i),pos.getX(i))+y*7,rad=Math.hypot(pos.getX(i),pos.getZ(i))*(1+.16*Math.cos(a*6));pos.setX(i,Math.cos(a)*rad);pos.setZ(i,Math.sin(a)*rad);}
    geo.computeVertexNormals();const twist=kit.mesh(half,geo,kit.mat('#edd48d'),side*.12,0,0);twist.rotation.z=-side*Math.PI/2;
    for(let n=0;n<3;n++)kit.box(half,.055,.002,.008,side*.145,.008,n*.025-.025,'#bba46c',.001).rotation.z=side*.1;
  }
  if(progress===1){wrap.position.z=.075;wrap.position.y=-.05;wrap.rotation.x=.3;}
  return g;
}
export function bottleModel(kit:Workshop,parent:T.Object3D,sips=0){
  const g=new T.Group();parent.add(g);
  const key='cold-bottle';if(!kit.materials.has(key))kit.materials.set(key,new T.MeshPhysicalMaterial({color:'#b7d3c7',roughness:.19,transparent:true,opacity:.57,depthWrite:false,clearcoat:.7}));
  const profile=[[0,0],[.074,0],[.085,.025],[.085,.27],[.075,.31],[.034,.36],[.034,.4],[0,.4]].map(([x,y])=>new T.Vector2(x,y));
  kit.mesh(g,new T.LatheGeometry(profile,32),kit.materials.get(key)!);
  const level=Math.max(.015,.275*(1-sips/3));kit.cylinder(g,.075,.073,level,0,.018+level/2,0,'#b6cfa3').material=kit.mat('#b6cfa3',.18);
  kit.cylinder(g,.042,.042,.045,0,.417,0,'#eff0df');
  for(let i=0;i<18;i++){const a=i/18*Math.PI*2;kit.box(g,.004,.035,.004,Math.cos(a)*.042,.417,Math.sin(a)*.042,'#d0d7c3',.001);}
  kit.cylinder(g,.086,.086,.12,0,.19,0,'#f5efd7');label(kit,g,'청포도',.125,.047,0,.202,.087,'#52795e','#f5efd7',120);
  for(let i=0;i<13;i++){const a=i*2.4;kit.sphere(g,.0035+(i%3)*.001,Math.sin(a)*.087,.04+(i%5)*.055,Math.cos(a)*.087,'#d6ebe6',1,1.4,.5);}
  return g;
}
export function createStations(kit:Workshop,scene:T.Scene,visible=true){
  const foregroundScene=scene;if(!visible)scene=new T.Scene();
  const fixed=new T.Group();scene.add(fixed);
  const hits:T.Mesh[]=[],hitMaterial=new T.MeshBasicMaterial({visible:false});
  for(const [id,p]of Object.entries(stations)){const hit=kit.mesh(scene,new T.BoxGeometry(1.2,2.1,1.35),hitMaterial,p.x,1.05,p.z);hit.userData.station=id;hit.castShadow=false;hits.push(hit);}
  const bowl=new T.Group();bowl.position.set(stations.candy.x,1.34,stations.candy.z);fixed.add(bowl);
  const bowlGeo=new T.LatheGeometry([[0,0],[.25,0],[.34,.1],[.39,.19],[.38,.21],[.36,.19],[.31,.1],[.23,.035],[0,.035]].map(([r,y])=>new T.Vector2(r,y)),48);
  kit.mesh(bowl,bowlGeo,kit.mat('#b6c3aa',.36));
  for(let i=0;i<11;i++){const c=candyModel(kit,bowl);c.position.set(Math.sin(i*2.4)*.22,.12+Math.floor(i/4)*.055,Math.cos(i*2.4)*.22);c.rotation.set(i*.23,i*.8,i*.12);c.scale.setScalar(.8);}
  const candyTag=label(kit,bowl,'레몬꿀 사탕',.48,.12,.43,.09,0,'#547063','#f3eed9',90);candyTag.rotation.y=Math.PI/2;
  const machine=new T.Group();machine.position.set(stations.coffee.x,1.34,stations.coffee.z);machine.rotation.y=Math.PI/2;fixed.add(machine);
  kit.box(machine,.72,.82,.57,0,.42,0,'#dddccf',.075);
  kit.box(machine,.58,.54,.03,0,.35,.3,'#354e55',.015);
  kit.box(machine,.36,.13,.12,0,.65,.35,'#78908e',.025);
  kit.box(machine,.23,.1,.17,0,.48,.35,'#b3b8aa',.018);
  for(const x of[-.05,.05])kit.cylinder(machine,.012,.012,.07,x,.405,.39,'#788c89');
  kit.box(machine,.56,.035,.38,0,.02,.25,'#9ba8a2',.01);
  for(let i=0;i<10;i++)kit.box(machine,.017,.008,.27,-.23+i*.052,.042,.27,'#455d60',.003);
  for(const x of[-.22,.22]){const dial=kit.cylinder(machine,.035,.035,.026,x,.65,.321,'#a8b7aa');dial.rotation.x=Math.PI/2;}
  label(kit,machine,'COFFEE',.24,.047,0,.728,.294,'#4c665f','#dddccf',70);
  // Movable cup and pour are kept outside the static geometry batch.
  const cupRoot=new T.Group();cupRoot.position.copy(machine.position);cupRoot.rotation.copy(machine.rotation);scene.add(cupRoot);
  const cup=mug(kit,cupRoot,0,.045,.36,'coffee',.85);
  const liquid=cup.children.find(c=>c instanceof T.Mesh&&c.geometry instanceof T.CircleGeometry)!;
  const stream=kit.cylinder(cupRoot,.008,.011,.19,0,.325,.39,'#725036');stream.visible=false;
  const steam=new T.Group();cupRoot.add(steam);
  const steamMaterial=new T.MeshBasicMaterial({color:'#f3f5eb',transparent:true,opacity:.18,depthWrite:false});
  for(let i=0;i<6;i++){const p=kit.mesh(steam,new T.SphereGeometry(.025,10,8),steamMaterial,0,.3,.35);p.castShadow=false;}
  const fridge=new T.Group();fridge.position.set(stations.fridge.x,0,stations.fridge.z);fridge.rotation.y=Math.PI/2;fixed.add(fridge);
  const cream='#d9e2d8',inside='#eff2e7';
  kit.box(fridge,1.18,2.3,.14,0,1.17,-.4,cream,.035);
  for(const x of[-.56,.56])kit.box(fridge,.1,2.3,.92,x,1.17,0,cream,.035);
  for(const y of[.065,2.27])kit.box(fridge,1.13,.1,.92,0,y,0,cream,.025);
  kit.box(fridge,1.02,2.09,.045,0,1.17,-.3,inside,.018);
  for(const y of[.18,.73,1.28,1.83]){
    kit.box(fridge,1,.025,.65,0,y,.04,'#c1d6d1',.008);
    kit.box(fridge,1,.04,.035,0,y,.36,'#f0f2e7',.006);
  }
  for(const y of[.2,.75,1.3])for(const x of[-.3,0,.3]){const b=bottleModel(kit,fridge);b.position.set(x,y,.02);}
  const pickupBottle=bottleModel(kit,fridge);pickupBottle.position.set(.3,1.3,.25);
  kit.box(fridge,.76,.28,.35,0,1.99,-.1,'#e6e9dc',.035);
  label(kit,fridge,'차갑게 쉬어가요',.63,.1,0,2.06,.081,'#647967','#e6e9dc',88);
  // Actual left hinge, gasket, inside shelf and handle move together.
  const hinge=new T.Group();hinge.position.set(-.57,.04,.49);fridge.add(hinge);
  const door=kit.box(hinge,1.14,2.22,.13,.57,1.11,0,cream,.055);
  kit.box(hinge,1.03,2.09,.025,.57,1.11,-.08,'#9eafa2',.018);
  kit.box(hinge,.96,2.02,.045,.57,1.11,-.106,inside,.025);
  for(const y of[.39,1.08]){kit.box(hinge,.81,.07,.2,.57,y,-.23,cream,.014);kit.box(hinge,.81,.13,.035,.57,y+.085,-.34,'#becdc1',.01);}
  kit.box(hinge,.055,.66,.075,1.025,1.29,.11,'#94a89e',.02);
  label(kit,hinge,'COLD & SLOW',.54,.068,.54,1.99,.067,'#6f8778',cream,70);
  const doorPieces=new T.Group();for(const c of [...hinge.children])doorPieces.add(c);hinge.add(doorPieces);consolidate(doorPieces,kit);
  // The real handle extends beyond the broad door proxy. Include the visible
  // door meshes so the occlusion test accepts their own front surface.
  doorPieces.userData={action:'fridge-door',station:'fridge'};
  // Static batch excludes the articulated door and the bottle being picked.
  fridge.remove(hinge,pickupBottle);fixed.remove(fridge);consolidate(fridge,kit);consolidate(fixed,kit);scene.add(fridge);fridge.add(hinge,pickupBottle);
  const lamp=new T.PointLight('#f1fff1',0,2.6,2);lamp.position.set(0,2.04,.2);fridge.add(lamp);
  const hands=new T.Group();hands.userData.action='held';foregroundScene.add(hands);let handKey='',handItem:T.Group|null=null;
  function held(kind:'candy'|'bottle'|'cup',progress:number,eaten:boolean,sips:number,drink:string){
    const key=[kind,progress.toFixed(2),eaten,sips,drink].join(':');if(key===handKey)return;handKey=key;
    if(handItem)kit.release(handItem);handItem=new T.Group();hands.add(handItem);
    const item=kind==='candy'?candyModel(kit,handItem,progress,eaten):kind==='bottle'?bottleModel(kit,handItem,sips):mug(kit,handItem,.02,-.09,0,drink,.95);
    if(kind==='bottle'){item.position.set(.06,-.12,0);item.rotation.z=-.12;item.rotation.x=.05;}
    for(const side of kind==='candy'?[-1,1]:[1]){
      const arm=new T.Group();handItem.add(arm);arm.position.set(side*(kind==='candy'?.14+progress*.18:.1),-.045,.075);
      const palm=kit.sphere(arm,.07,0,0,0,'#dfb599',.7,.7,1);palm.rotation.z=side*.35;
      kit.sphere(arm,.025,-side*.035,.022,-.038,'#dfb599',.65,1,1.5);
      const sleeve=kit.box(arm,.095,.11,.24,side*.028,-.045,.13,'#6d8c99',.04);sleeve.rotation.z=-side*.2;
    }
  }
  const doorHit=kit.mesh(hinge,new T.BoxGeometry(1.16,2.23,.17),hitMaterial,.57,1.11,0);doorHit.userData={action:'fridge-door',station:'fridge'};doorHit.castShadow=false;
  const bottleHit=kit.mesh(fridge,new T.BoxGeometry(.9,1.5,.3),hitMaterial,0,1.05,.25);bottleHit.userData={action:'fridge-bottle',station:'fridge'};bottleHit.castShadow=false;
  let angle=0;
  function tick(state:Snapshot|null,now:number,time:number,reduced:boolean){
    const f=state?.room.fixtures?.fridge,open=Boolean(f?.open);angle=reduced?(open?-1.65:0):T.MathUtils.lerp(angle,open?-1.65:0,.16);hinge.rotation.y=angle;lamp.intensity=open?.55:0;
    bottleHit.visible=open;
    pickupBottle.visible=!state?.room.members.some(m=>m.id===f?.owner&&m.pantry?.bottle&&m.pantry.bottle.sips<3);
    const owner=state?.room.members.find(m=>m.station==='coffee'&&m.pantry?.coffee.stage!=='carried'),coffee=owner?.pantry.coffee;
    cup.visible=Boolean(coffee);const {progress,pouring,finished}=coffeePhase(coffee?.stage,coffee?.readyAt??0,now);
    const place=owner?.action==='coffee-place'&&!reduced?1-T.MathUtils.smoothstep(now-owner.actionAt,0,CUP_PLACE_MS):0;
    cup.position.y=.045+place*.12;cup.rotation.z=-place*.1;
    liquid.position.y=.055+progress*.144;liquid.visible=progress>0;
    const bottom=.045+liquid.position.y*.85;
    stream.visible=pouring;stream.position.y=(.37+bottom)/2;stream.scale.y=(.37-bottom)/.19;stream.scale.x=reduced?1:1+Math.sin(time*.03)*.06;
    steam.visible=progress>.08||finished;steamMaterial.opacity=.08+progress*.08;steam.children.forEach((p,i)=>{const t=((reduced?500:time)/2100+i/6)%1;p.position.set(Math.sin(i+t*4)*.035,.27+t*.35,.36);p.scale.set(1+t,2+t,1+t);});
  }
  function foreground(camera:T.Camera,state:Snapshot|null,show:boolean,pull:number|null,reduced=false,now=Date.now()){
    const p=state?.self.pantry,candy=p?.candy,bottle=p?.bottle;
    const me=state?.room.members.find(m=>m.id===state.self.id),cup=me?.station==='coffee'&&me.action==='coffee-take'&&p?.coffee.stage==='carried';
    const isCandy=me?.station!=='coffee'&&Boolean(candy?.held&&candy.state!=='eaten'),isBottle=me?.station!=='coffee'&&!isCandy&&Boolean(bottle?.held&&bottle.sips<3);
    hands.visible=show&&(isCandy||isBottle||Boolean(cup));if(!hands.visible)return;
    held(isCandy?'candy':isBottle?'bottle':'cup',pull??candy?.progress??0,false,bottle?.sips??0,state?.self.drink??'coffee');
    hands.traverse(o=>{if(o instanceof T.Mesh)o.castShadow=false;});
    const bottom=camera instanceof T.PerspectiveCamera?-Math.tan(T.MathUtils.degToRad(camera.fov/2))*.66*.74:-.18;
    const lift=cup&&!reduced?1-T.MathUtils.smoothstep(now-me!.actionAt,0,CUP_LIFT_MS):0;
    hands.position.set(isCandy?0:.22,bottom-lift*.18,-.66-lift*.08).applyQuaternion(camera.quaternion).add(camera.position);hands.quaternion.copy(camera.quaternion);hands.scale.setScalar(.72);
  }
  return{hits,interactionTargets:[hands,doorPieces,doorHit,bottleHit],tick,foreground,dispose(){hitMaterial.dispose();steamMaterial.dispose();}};
}
