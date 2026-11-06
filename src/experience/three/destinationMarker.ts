import * as T from 'three';
import type {Workshop} from './assets';

export type DestinationStatus='hidden'|'pending'|'moving'|'arrived'|'blocked';
export const destinationHeight=.07; // Above the terrazzo, oak floor and lounge rugs.
export function createDestinationMarker(kit:Workshop,scene:T.Scene){
 const group=new T.Group();scene.add(group);group.visible=false;
 const color=new T.MeshBasicMaterial({color:'#527f72',transparent:true,opacity:.95,depthWrite:false}),white=new T.MeshBasicMaterial({color:'#fff9df',transparent:true,opacity:.95,depthWrite:false});
 for(const [inner,outer,material]of [[.25,.35,color],[.35,.40,white]] as const){const ring=kit.mesh(group,new T.RingGeometry(inner,outer,40),material,0,0,0);ring.rotation.x=-Math.PI/2;ring.castShadow=false;ring.receiveShadow=false;}
 const dot=kit.mesh(group,new T.CircleGeometry(.07,16),color,0,.004,0);dot.rotation.x=-Math.PI/2;dot.castShadow=false;dot.receiveShadow=false;
 let status:DestinationStatus='hidden',at=0;
 function set(point:{x:number;z:number},next:DestinationStatus){group.position.set(point.x,destinationHeight,point.z);status=next;at=performance.now();group.visible=next!=='hidden';color.color.set(next==='blocked'?'#ad604d':next==='pending'?'#738fa0':'#527f72');}
 return{set,clear(){status='hidden';group.visible=false;},get status(){return status;},
  tick(time:number,moving:boolean,reduced:boolean){
   if(status==='moving'&&!moving&&time-at>250){status='arrived';at=time;}
   if(status==='pending'&&time-at>8000){status='blocked';at=time;color.color.set('#ad604d');}
   if((status==='arrived'&&time-at>650)||(status==='blocked'&&time-at>1400)){status='hidden';group.visible=false;}
   group.scale.setScalar(!reduced&&status==='pending'?1+Math.sin((time-at)*.007)*.08:1);
  },dispose(){color.dispose();white.dispose();}};
}
