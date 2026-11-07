import * as T from 'three';
import {Workshop,consolidate,label} from './assets';
import {roomSurfaces} from './surfaces';
import {beanbag,chair,loungePillow} from './furniture';
import {indoorTree} from './plants';
import {metricUvs,contactShadow} from './detailGeometry';
import {getSpace} from '../../../shared/space.mjs';
import {entryDoor} from './entryDoor';
import {vaseModel} from './vaseModel';
import {flowers} from '../../../shared/vase.mjs';
import {sandModel} from './sandModel';

export function createHealingArchitecture(kit:Workshop,scene:T.Scene){
 const fixed=new T.Group(),shell=new T.Group();scene.add(fixed,shell);const s=roomSurfaces(kit),map=getSpace('healing');
 const box=(w:number,h:number,d:number,x:number,y:number,z:number,color:string,r=.02)=>kit.box(fixed,w,h,d,x,y,z,color,r);
 const subfloor=box(10.2,.2,9.2,0,-.13,0,'#d1bea0');
 subfloor.userData.walkSurface=true;
 // Individual long oak boards retain their grain and small joints at eye level.
 for(let i=0;i<25;i++){const plank=box(.396,.035,9, -4.8+i*.4,-.01,0,'#d8c4a0',.006);plank.userData.walkSurface=true;plank.material=s.wood;metricUvs(plank.geometry);}
 box(.16,3.4,9.1,-5,1.68,0,'#f6f3e7');
 kit.box(shell,.16,3.4,9.1,5,1.68,0,'#f6f3e7');kit.box(shell,10,3.4,.16,0,1.68,4.5,'#f6f3e7');
 for(const x of[-4.89,4.89])kit.box(shell,.035,.13,9,x,.065,0,'#bea886');
 kit.box(shell,10,.12,9.2,0,3.4,0,'#f5f3e8');
 for(let x=-4.9;x<5;x+=.25)kit.box(shell,.065,.06,1.2,x,3.3,-3.85,'#d5bc98').material=s.wood;
 for(const x of[-3.6,3.6]){const lamp=kit.box(shell,.09,.02,5,x,3.31,.4,'#fff2cf');lamp.material=s.cove;}
 box(10,.28,.14,0,.14,-4.5,'#e9e4d6');box(10,.35,.14,0,3.2,-4.5,'#e9e4d6');
 for(const x of[-4.85,-1.65,1.65,4.85])box(.055,2.78,.13,x,1.66,-4.43,'#a9b8b0');
 box(9.75,.065,.26,0,.29,-4.38,'#eee9dc');
 for(const x of[-1.9,2.4]){const rug=box(3.65,.022,3.1,x,.026,1.3,'#c6cbb2',.22);rug.userData.walkSurface=true;rug.material=s.fabrics[1];contactShadow(kit,fixed,x,1.3,3.8,3.3,.12);}
 map.tables.forEach(t=>{const top=box(t.width,.075,t.length,t.x,t.y,t.z,'#d7bd98',.16);top.material=s.wood;metricUvs(top.geometry);for(const x of[-1,1])for(const z of[-1,1])box(.055,t.y-.04,.055,t.x+x*(t.width/2-.16),(t.y-.04)/2,t.z+z*(t.length/2-.16),'#a28d6f',.014);});
 map.seats.forEach(([x,z,yaw],i)=>{const seat=i<4?beanbag(kit,fixed,s):chair(kit,fixed,s,0);seat.position.set(x,0,z);seat.rotation.y=yaw;if(i>=4)seat.scale.set(1,.8,1);const pillow=loungePillow(kit,seat,s);pillow.position.set(0,i<4?.64:.93,-.35);pillow.rotation.x=-.18;});
 const reveal=indoorTree(kit,fixed,scene,4,-3.8,s,51);
 const shelf=box(1.8,.88,.65,-3.5,.44,4.1,'#c4ae8b',.04);shelf.material=s.wood;metricUvs(shelf.geometry);
 box(1.86,.05,.72,-3.5,.91,4.1,'#e2d4b6',.025);
 for(const x of[-3.98,-3.02]){const tray=sandModel(kit,fixed);tray.group.position.set(x,.95,4.08);tray.group.scale.setScalar(.68);}
 label(kit,fixed,'나만의 모래 트레이',1.2,.17,-3.5,.73,3.758,'#56705c','#ede9d7',90).rotation.y=Math.PI;
 const flowerShelf=box(1.8,.94,.6,-.5,.47,4.1,'#c4ae8b',.04);flowerShelf.material=s.wood;metricUvs(flowerShelf.geometry);
 box(1.86,.05,.68,-.5,.965,4.1,'#e2d4b6',.025);
 flowers.forEach((flower,i)=>{const v=vaseModel(kit,fixed,flower.id);v.position.set(-1+i*.5,.995,4.08);v.scale.setScalar(1.35);});
 label(kit,fixed,'마음에 드는 한 송이',1.2,.17,-.5,.76,3.778,'#56705c','#ede9d7',90).rotation.y=Math.PI;
 // A woven wall panel softens the rear wall without adding another activity.
 const textile=box(2.2,.75,.04,-.3,2.42,4.38,'#c8cfb6',.05);textile.material=s.fabrics[2];
 const door=entryDoor(kit,scene,map.portal);
 consolidate(fixed,kit);consolidate(shell,kit);
 return{portalTargets:[door.hit],tickDoor:door.tick,reveal,interior(enabled:boolean){shell.visible=enabled;},lighting(warm:boolean){s.cove.emissiveIntensity=warm?2:1.1;}};
}
