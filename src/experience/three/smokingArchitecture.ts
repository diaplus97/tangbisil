import * as T from 'three';
import {getSpace} from '../../../shared/space.mjs';
import {Workshop,consolidate} from './assets';
import {ribbonState,smokingCenter} from '../../../shared/smoking.mjs';
import type {Snapshot} from '../types';
import {entryDoor} from './entryDoor';
import {roomSurfaces} from './surfaces';
import {metricUvs} from './detailGeometry';

function linenRibbon(kit:Workshop,parent:T.Object3D,color:string,hem:string){
 // Three columns shape the folded centre and the split end of the fabric.
 const positions:number[]=[],colors:number[]=[],indices:number[]=[];
 const dye=new T.Color(color),edge=new T.Color(hem);
 for(let i=0;i<7;i++){
   const t=i/6,bend=Math.sin(t*Math.PI),width=.023+.06*Math.min(1,t*4);
   for(const side of [-1,0,1]){
     positions.push(t*t*.54+side*width,-t*.67+bend*.01+side*width*t+(i===6&&side===0 ? .085 : 0),bend*.075+(1-Math.abs(side))*.025);
     colors.push(...(side===-1?edge:dye).toArray());
   }
   if(i)for(let j=0;j<2;j++){const a=(i-1)*3+j;indices.push(a,a+3,a+1,a+1,a+3,a+4);}
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();
 const cloth=new T.MeshStandardMaterial({side:T.DoubleSide,roughness:.98,vertexColors:true});kit.materials.set('linen-'+color,cloth);
 const mesh=kit.mesh(parent,geometry,cloth);mesh.visible=false;mesh.castShadow=false;mesh.raycast=()=>{};return mesh;
}

// A glazed sea-facing terrace. Individual seats leave a clear return aisle
// beside the blue-grey door. Nothing in the terrace needs a separate light pass.
export function createSmokingArchitecture(kit:Workshop,scene:T.Scene){
 const fixed=new T.Group(),shell=new T.Group();scene.add(fixed,shell);
 const s=roomSurfaces(kit),map=getSpace('smoking');
 const box=(w:number,h:number,d:number,x:number,y:number,z:number,c:string,r=.015)=>kit.box(fixed,w,h,d,x,y,z,c,r);
 const floor=box(9.35,.14,8.45,0,-.10,0,'#bcc4bd');floor.userData.walkSurface=true;
 for(let row=0;row<8;row++)for(let col=0;col<9;col++){
   const tile=box(1.025,.036,1.042,(col-4)*1.033,-.025,(row-3.5)*1.05,'#d6d5c9',.005);
   tile.material=s.terrazzo;metricUvs(tile.geometry);tile.userData.walkSurface=true;
 }
 const wall='#d6ddd7',metal='#738780',wood='#be9b70';
 kit.box(shell,.14,3.45,8.45,-4.67,1.69,0,wall);kit.box(shell,.14,3.45,8.45,4.67,1.69,0,wall);
 kit.box(shell,9.35,3.45,.12,0,1.69,4.23,wall);kit.box(shell,9.35,.13,8.45,0,3.45,0,'#e5e8de');
 for(let i=0;i<27;i++){const slat=kit.box(shell,.075,.09,2.12,-4.56+i*.175,3.33,2.99,wood);slat.material=s.wood;}
 for(const x of [-3,0,3]){const light=kit.box(shell,1.55,.035,.105,x,3.33,-1.2,'#f9e8c4');light.material=s.cove;}
 box(9.35,.67,.23,0,.32,-4.16,'#bac6bd');box(9.35,.19,.23,0,3.28,-4.16,wall);
 const ledge=box(9.3,.075,.46,0,.68,-4.0,wood);ledge.material=s.wood;metricUvs(ledge.geometry);
 for(const x of [-4.58,-1.54,1.54,4.58])box(.055,2.58,.13,x,1.98,-4.12,metal);
 box(9.2,.035,.10,0,1.04,-4.12,metal);
 for(const [x,z,yaw] of map.seats){
   const seat=new T.Group();fixed.add(seat);seat.position.set(x,0,z);seat.rotation.y=yaw;
   for(const side of [-1,1]){
     for(const z of [-.28,.26]){
       const foot=kit.cylinder(seat,.024,.031,.635,side*.37,.345,z,metal);
       foot.rotation.z=-side*.045;
       kit.cylinder(seat,.034,.032,.030,side*.385,.024,z,'#5a6963');
     }
     kit.box(seat,.055,.055,.65,side*.365,.62,-.006,metal,.014);
     kit.box(seat,.055,.48,.055,side*.39,.91,-.28,metal,.014);
   }
   for(let i=0;i<5;i++){const plank=kit.box(seat,.91,.095,.122,0,.683,-.27+i*.135,wood,.021);plank.material=s.wood;metricUvs(plank.geometry);}
   for(let i=0;i<2;i++){const back=kit.box(seat,.93,.165,.062,0,.958+i*.18,-.31,wood,.026);back.material=s.wood;metricUvs(back.geometry);}
 }
 const circle=kit.cylinder(fixed,2.14,2.14,.006,smokingCenter.x,-.002,smokingCenter.z,'#c4cdc1');circle.userData.walkSurface=true;
 const border=kit.mesh(fixed,new T.TorusGeometry(2.14,.008,6,120),kit.mat('#aab8ab',.9),smokingCenter.x,.002,smokingCenter.z);border.rotation.x=Math.PI/2;
 // Coastal grasses soften the ends of the sill without hiding the horizon.
 for(const [x,z,phase] of [[-3.93,-3.55,1.8],[3.8,-3.57,3.1]]){
   kit.cylinder(fixed,.285,.225,.48,x,.24,z,'#adb9a9');
   kit.cylinder(fixed,.261,.261,.024,x,.477,z,'#675c49');
   for(let i=0;i<21;i++){
     const angle=i*2.4+phase,h=.50+.38*(.5+.5*Math.sin(i*7.1)),spread=.19+.16*Math.abs(Math.sin(i*1.7));
     const base=new T.Vector3(x+.09*Math.cos(angle),.478,z+.09*Math.sin(angle));
     const tip=base.clone().add(new T.Vector3(spread*Math.cos(angle),h,spread*Math.sin(angle)));
     const middle=base.clone().lerp(tip,.58);middle.y+=.16;
     const cross=new T.Vector3(-Math.sin(angle)*.022,0,Math.cos(angle)*.022);
     const vertices=[base,middle.clone().sub(cross),tip,middle.clone().add(cross)];
     const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices.flatMap(v=>v.toArray()),3));
     geo.setIndex([0,1,2,0,2,3,2,1,0,3,2,0]);geo.computeVertexNormals();
     kit.mesh(fixed,geo,kit.mat(i%3?'#71846b':'#9b9f77'));
   }
 }
 const vent=box(.085,.64,1.18,-4.55,2.34,1.3,'#b1bdb7');
 for(let i=0;i<9;i++)box(.025,.020,.96,vent.position.x+.052,2.12+i*.053,1.3,'#86968e',.006);
 const peg=box(.30,.043,.098,-1.51,2.5,-4.0,'#9e8360',.016);
 const linen=new T.Group();linen.name='terrace-ribbons';linen.position.set(peg.position.x,peg.position.y,-3.94);scene.add(linen);
 const voice=linenRibbon(kit,linen,'#d6a44d','#aa783c'),echo=linenRibbon(kit,linen,'#548f85','#377169');
 voice.position.x=-.09;echo.position.set(.08,0,.035);echo.scale.set(.85,.78,1);
 let previous=0,changedAt=0;
 const door=entryDoor(kit,scene,map.portal);consolidate(fixed,kit);consolidate(shell,kit);
 return {portalTargets:[door.hit],tickDoor(state:Snapshot|null,now:number,reduced:boolean){
   door.tick(state,now,reduced);
   const next=ribbonState(state?.room.messages??state?.room.thoughts,now);
   if(next!==previous){changedAt=now;previous=next;}
   voice.visible=next>0;echo.visible=next===2;
   const settling=reduced?0:Math.max(0,1-(now-changedAt)/450);
   voice.rotation.z=-.065*settling;echo.rotation.z=.13-.10*settling;
 },reveal(){},interior(enabled:boolean){shell.visible=enabled;},lighting(warm:boolean){s.cove.emissiveIntensity=warm?1.4:1.05;}};
}
