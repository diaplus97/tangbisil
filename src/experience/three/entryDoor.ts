import * as T from 'three';
import {Workshop,label} from './assets';
import type {Portal} from '../../../shared/space.mjs';
import type {Snapshot} from '../types';

export function entryDoor(kit:Workshop,scene:T.Scene,portal:Portal){
 const group=new T.Group();scene.add(group);group.position.set(portal.x,0,portal.z);group.rotation.y=-Math.PI/2;
 for(const x of[-.81,.81])kit.box(group,.075,2.9,.16,x,1.45,0,'#a2afa5',.012);
 kit.box(group,1.68,.075,.16,0,2.88,0,'#a2afa5',.012);
 kit.box(group,1.57,2.78,.025,0,1.44,-.06,'#c4ccba',.005);
 kit.box(group,1.7,.025,.48,0,.005,.14,'#b0ab99',.01);
 const hinge=new T.Group();group.add(hinge);hinge.position.set(.75,0,.04);
 kit.box(hinge,1.5,2.77,.065,-.75,1.44,0,'#d8dfce',.025);
 kit.box(hinge,1.38,1.45,.025,-.75,1.84,.045,'#b3c6be',.025);
 for(const y of[.2,.39,.58,.77])kit.box(hinge,1.38,.14,.025,-.75,y,.044,'#d6c3a0',.01);
 kit.box(hinge,.22,.04,.08,-1.3,1.17,.085,'#647d70',.012);
 label(kit,hinge,portal.to==='healing'?'힐링방':'탕비실',.78,.24,-.75,2.03,.064,'#375a4c','#e8efdf',100);
 label(kit,hinge,portal.to==='healing'?'기대어 쉬는 곳':'한 조각의 여유',.84,.13,-.75,1.76,.064,'#537162','#dce8d5',80);
 const hit=kit.box(group,1.58,2.8,.15,0,1.42,.17,'#ffffff');hit.material=new T.MeshBasicMaterial({visible:false});kit.materials.set('portal-hit',hit.material as T.MeshStandardMaterial);hit.userData.portal=portal.to;hit.castShadow=false;hit.receiveShadow=false;
 let angle=0;
 return{hit,tick(state:Snapshot|null,now:number,reduced:boolean){const open=state?.room.members.some(m=>m.travel&&now>m.motion!.endsAt-400||m.enteredAt&&now-m.enteredAt<1200);const target=open?1.18:0;angle=reduced?target:T.MathUtils.lerp(angle,target,.22);hinge.rotation.y=angle;}};
}
