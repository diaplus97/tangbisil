import * as T from 'three';
import type {Workshop} from './assets';
import {getSpace,type Area} from '../../../shared/space.mjs';
import type {Snapshot} from '../types';

export function createSeatMarkers(kit:Workshop,scene:T.Scene,area:Area){
 const outer=kit.geometry(new T.CircleGeometry(.065,20)),inner=kit.geometry(new T.CircleGeometry(.024,16));
 const edge=new T.MeshBasicMaterial({color:'#e8ede2',transparent:true,opacity:.8,depthWrite:false}),ink=new T.MeshBasicMaterial({color:'#719185',transparent:true,opacity:.8,depthWrite:false});
 const markers=getSpace(area).seats.map(([x,z],i)=>{
  const g=new T.Group();g.name='seat-marker-'+i;g.position.set(x,area==='healing'?(i<4?1.08:1.48):area==='smoking'?1.53:1.68,z);g.userData={seat:i,directSurface:true};scene.add(g);
  const a=kit.mesh(g,outer,edge),b=kit.mesh(g,inner,ink,0,0,.002);a.castShadow=b.castShadow=false;g.visible=false;return g;
 });
 return {markers,point:(i:number)=>markers[i]?.position.clone(),
  update(state:Snapshot|null,choosing:boolean,hovered:number|null,camera:T.Camera,height:number){markers.forEach((g,i)=>{g.visible=Boolean(state)&&!state!.room.members.some(m=>m.seat===i)&&(choosing||hovered===i);if(g.visible){g.quaternion.copy(camera.quaternion);if(camera instanceof T.PerspectiveCamera){const distance=g.position.distanceTo(camera.position),units=2*distance*Math.tan(T.MathUtils.degToRad(camera.fov/2))/Math.max(1,height);g.scale.setScalar(Math.max(1,14*units/.13));}}});},
  dispose(){edge.dispose();ink.dispose();markers.forEach(g=>g.removeFromParent());}
 };
}
