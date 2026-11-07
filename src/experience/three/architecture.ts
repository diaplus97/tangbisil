import * as T from 'three';
import {Workshop,consolidate,label,mug,packet} from './assets';
import {roomSurfaces} from './surfaces';
import {chair,beanbag,loungePillow} from './furniture';
import {indoorTree} from './plants';
import {createSightFade} from './sightFade';
import {metricUvs,contactShadow} from './detailGeometry';
import {seats,roomBounds,pantryOffset,sharedPlate} from './layout';

import {entryDoor} from './entryDoor';
import {tables,portals} from '../../../shared/space.mjs';

function roundedShape(w:number,h:number,r:number){
  const s=new T.Shape(),x=w/2,y=h/2;
  s.moveTo(-x+r,-y);s.lineTo(x-r,-y);s.quadraticCurveTo(x,-y,x,-y+r);
  s.lineTo(x,y-r);s.quadraticCurveTo(x,y,x-r,y);s.lineTo(-x+r,y);
  s.quadraticCurveTo(-x,y,-x,y-r);s.lineTo(-x,-y+r);s.quadraticCurveTo(-x,-y,-x+r,-y);
  return s;
}
function panel(kit:Workshop,parent:T.Object3D,w:number,h:number,depth:number,r:number,material:T.Material){
  const g=new T.ExtrudeGeometry(roundedShape(w,h,r),{depth,bevelEnabled:true,bevelSize:.015,bevelThickness:.015,bevelSegments:3,curveSegments:18});
  g.translate(0,0,-depth/2);
  // Extrude UVs are world units; normalize for a consistent fine surface scale.
  const uv=g.getAttribute('uv');
  for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)/w+.5,uv.getY(i)/h+.5);
  return kit.mesh(parent,g,material);
}
function door(kit:Workshop,parent:T.Object3D,z:number,smoking:boolean,glass:T.Material,metal:T.Material){
  const g=new T.Group();g.position.set(roomBounds.width/2-.135,0,z);g.rotation.y=-Math.PI/2;parent.add(g);
  kit.box(g,1.67,2.91,.12,0,1.47,0,'#b6bebc',.025).material=metal;
  kit.box(g,1.55,2.78,.065,0,1.47,.08,'#8a9995',.018);
  const pane=kit.box(g,1.47,2.7,.03,0,1.48,.123,'#bfced2',.015);pane.material=glass;
  for(const y of [.115,2.835])kit.box(g,1.5,.035,.035,0,y,.15,'#d7dcd7',.007);
  kit.cylinder(g,.055,.055,.055,-.57,1.16,.195,'#61706c').rotation.x=Math.PI/2;
  kit.box(g,.23,.032,.055,-.48,1.16,.22,'#61706c',.012).material=metal;
  for(const y of [.43,2.43])kit.cylinder(g,.021,.021,.13,.77,y,.14,'#8d9c96').material=metal;
  if(smoking)label(kit,g,'흡연실',.63,.21,0,2.06,.151,'#30454d','#b9cbd2',100);
  else{
    // Name is undecided: a leaf identifies the second entrance.
    const icon=new T.Shape();icon.moveTo(0,0);icon.bezierCurveTo(-.27,.1,-.25,.35,.2,.43);icon.bezierCurveTo(.28,.13,.18,.02,0,0);
    const leaf=kit.mesh(g,new T.ShapeGeometry(icon,16),kit.mat('#65866a'),0,1.91,.154);leaf.scale.setScalar(.7);
    kit.tube(g,[new T.Vector3(-.12,1.86,.157),new T.Vector3(0,2.02,.157),new T.Vector3(.13,2.18,.157)],.009,'#65866a');
  }
}
export function createArchitecture(kit:Workshop,scene:T.Scene){
  const fixed=new T.Group(),shell=new T.Group(),occluders:T.Group[]=[];scene.add(fixed,shell);
  const s=roomSurfaces(kit);
  const box=(w:number,h:number,d:number,x:number,y:number,z:number,color:string,r=.025)=>kit.box(fixed,w,h,d,x,y,z,color,r);
  const wall='#faf6ed',trim='#eee9dd';
  const {width,depth,backZ,centerZ,ceilingY}=roomBounds;
  box(width+.1,.2,depth,0,-.14,centerZ,'#e8dfcd',.08);
  const floor=kit.mesh(fixed,new T.PlaneGeometry(width,depth),s.terrazzo,0,-.025,centerZ);floor.rotation.x=-Math.PI/2;floor.userData.walkSurface=true;
  box(width,.25,.18,0,.125,backZ,wall);
  box(width,.38,.18,0,4.37,backZ,wall);
  for(const x of [-width/2+.375,width/2-.375])box(.75,3.95,.18,x,2.225,backZ,wall);
  box(.18,4.46,depth,-width/2,2.23,centerZ,wall);
  kit.box(shell,.18,4.46,depth,width/2,2.23,centerZ,wall);
  kit.box(shell,width,4.46,.18,0,2.23,centerZ+depth/2,wall);
  kit.box(shell,width,.1,.08,0,.075,centerZ+depth/2-.13,trim);
  box(.08,.1,depth,-width/2+.135,.075,centerZ,trim);
  kit.box(shell,.08,.1,depth,width/2-.135,.075,centerZ,trim);
  // Full-height glazing; mullions are small enough to leave the horizon open.
  for(const x of [-7.25,-3.625,0,3.625,7.25])box(.055,3.98,.16,x,2.23,backZ+.09,'#bfc9c6',.012).material=s.frame;
  for(const y of [.25,4.2])box(14.56,.06,.17,0,y,backZ+.09,'#c7cfcb',.01).material=s.frame;
  box(14.62,.065,.3,0,.205,backZ+.18,'#f3eee0');
  for(const x of [-7.2,-3.58,.045,3.67,7.2])box(.009,3.88,.025,x,2.23,backZ+.05,'#8e9f9d',.002);
  // A real ceiling hides the cutaway edge in the entry and table cameras.
  kit.box(shell,width+.2,.12,depth+.1,0,ceilingY,centerZ,wall);
  for(let x=-7.8;x<7.9;x+=.19){
    const slat=kit.box(shell,.085,.095,depth,x,ceilingY-.12,centerZ,'#dab88b',.009);slat.material=s.wood;
  }
  const halo=panel(kit,shell,12.7,12,.05,1.2,s.cove);halo.rotation.x=-Math.PI/2;halo.position.set(0,ceilingY-.18,centerZ-.25);
  const ceiling=panel(kit,shell,12.54,11.84,.09,1.14,s.ceiling);ceiling.rotation.x=-Math.PI/2;ceiling.position.set(0,ceilingY-.24,centerZ-.25);
  for(const x of [-4,4])for(const z of [-2.3,3.8]){
    kit.cylinder(shell,.085,.085,.012,x,ceilingY-.305,z,'#d4ceba');
    const lamp=kit.cylinder(shell,.065,.065,.015,x,ceilingY-.315,z,'#fff5d8');lamp.material=s.cove;lamp.castShadow=false;
  }
  // Open approach to two entrances along the right wall.
  door(kit,fixed,-4.8,true,s.smokingGlass,s.frame);const healingDoor=entryDoor(kit,scene,portals.pantry);
  // Pantry cabinetry is on the left side wall.
  const pantry=new T.Group();pantry.position.set(pantryOffset.x,0,pantryOffset.z);fixed.add(pantry);
  {
  const box=(w:number,h:number,d:number,x:number,y:number,z:number,color:string,r=.025)=>kit.box(pantry,w,h,d,x,y,z,color,r);
  box(1.0,1.18,4.35,-4.55,.64,-.15,'#d6bb92',.04).material=s.wood;
  box(.08,.12,4.28,-4.07,.06,-.15,'#8f826b',.009);
  box(1.14,.09,4.48,-4.5,1.29,-.15,'#faf7ee',.035).material=s.terrazzoCounter;
  for(let i=0;i<5;i++){
    box(.035,1.02,.81,-4.034,.66,-1.86+i*.86,'#e1cba8',.01).material=s.wood;
    box(.04,.022,.2,-4.006,1.1,-1.86+i*.86,'#a99b80',.006).material=s.steel;
  }
  for(let i=0;i<4;i++)box(.58,.89,.85,-4.87,2.98,-1.5+i*.87,'#f8f5eb',.07);
  box(.1,.035,3.46,-4.54,2.5,-.19,'#fff0ca',.008).material=s.cove;
  for(let i=0;i<3;i++)mug(kit,pantry,-4.25,1.34,-.5+i*.3,'empty',.7);
  for(const row of [0,1]){
    const shelf=new T.Group();shelf.position.set(-4.82,1.73+row*.42,.9);shelf.rotation.y=Math.PI/2;pantry.add(shelf);
    kit.box(shelf,1.14,.045,.4,0,0,0,'#dcc29d',.012).material=s.wood;
    for(let j=0;j<4;j++)packet(kit,shelf,-.4+j*.27,.03,0,.65);
  }
  }
  // Three real tables, each with an unobstructed approach behind its chairs.
  for(const table of tables){
    const furniture=new T.Group();fixed.add(furniture);occluders.push(furniture);
    const top=panel(kit,furniture,table.length,table.width,.12,.65,s.table);top.rotation.set(-Math.PI/2,Math.PI/2,0,'YXZ');top.position.set(table.x,table.y,table.z);
    const rim=panel(kit,furniture,table.length-.08,table.width-.08,.035,.61,s.wood);rim.rotation.set(-Math.PI/2,Math.PI/2,0,'YXZ');rim.position.set(table.x,1.06,table.z);
    const geometry=new T.CylinderGeometry(.48,.55,1.06,144,8),positions=geometry.getAttribute('position');
    for(let i=0;i<positions.count;i++){const x=positions.getX(i),z=positions.getZ(i),angle=Math.atan2(z,x),groove=1-.022*(.5+.5*Math.cos(angle*36));positions.setX(i,x*groove);positions.setZ(i,z*groove);}
    geometry.computeVertexNormals();kit.mesh(furniture,geometry,s.wood,table.x,.53,table.z);
    contactShadow(kit,fixed,table.x,table.z,1.8,table.length*.7,.27);
  }
  seats.forEach(([x,z,yaw],i)=>{const c=chair(kit,fixed,s,i%3);c.position.set(x,0,z);c.rotation.y=yaw;});
  kit.cylinder(fixed,.26,.25,.028,sharedPlate.x,1.235,sharedPlate.z,'#f5f0dd');
  kit.cylinder(fixed,.215,.215,.009,sharedPlate.x,1.254,sharedPlate.z,'#e2e7dc');
  // A separate window seat frames the horizon without filling it.
  const windowSeat=new T.Group();windowSeat.position.set(2.6,0,-2.3);fixed.add(windowSeat);
  const lounge=chair(kit,windowSeat,s,0);lounge.scale.set(1.5,1.08,1.45);lounge.position.set(3.2,0,-2.4);lounge.rotation.y=-.2;
  const pillow=loungePillow(kit,lounge,s);pillow.position.set(0,.98,-.12);pillow.rotation.x=-.15;
  const bag=beanbag(kit,windowSeat,s);bag.position.set(2.2,0,-1.95);bag.rotation.y=.3;
  kit.cylinder(windowSeat,.35,.35,.055,1.45,.72,-2.7,'#eed8b3').material=s.wood;
  kit.cylinder(windowSeat,.11,.15,.7,1.45,.35,-2.7,'#d6b58c');
  kit.cylinder(windowSeat,.07,.09,.16,1.45,.83,-2.7,'#fff4d2');
  for(let i=0;i<3;i++)kit.tube(windowSeat,[new T.Vector3(1.45,.9,-2.7),new T.Vector3(1.4+i*.05,1.08,-2.7)],.005,'#7e9467');
  const trees=[indoorTree(kit,fixed,scene,-6.8,-4.95,s,37),indoorTree(kit,fixed,scene,6.7,-4.95,s,149)];
  // Use a physical surface scale on cabinetry, timber and stone, not one stretched tile per object.
  for(const group of [fixed,shell])group.traverse(o=>{if(o instanceof T.Mesh&&[s.wood,s.table,s.terrazzoCounter,kit.mat(wall)].includes(o.material as T.MeshStandardMaterial))metricUvs(o.geometry);});
  const furnitureFades=occluders.map(group=>{
    scene.attach(group);
    consolidate(group,kit);
    return createSightFade(kit,group,false,.2);
  });
  consolidate(fixed,kit);consolidate(shell,kit);
  function reveal(camera:T.Camera,point:{x:number;z:number}|null,reduced:boolean,marker?:T.Vector3|null){
    for(const fade of furnitureFades)fade(camera,point,reduced);
    for(const fade of trees)fade(camera,point,reduced,marker);
  }
  return {portalTargets:[healingDoor.hit],tickDoor:healingDoor.tick,reveal,interior(enabled:boolean){shell.visible=enabled;},lighting(warm:boolean){s.cove.emissiveIntensity=warm?2:1.1;}};
}
