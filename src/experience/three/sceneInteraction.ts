import {Mesh,type Intersection,type Object3D} from 'three';
import {getSpace,type Area,type StationId} from '../../../shared/space.mjs';

// Detached helper scenes are not visible even when every object's visible flag is true.
export function isVisibleInScene(object:Object3D,scene:Object3D):boolean{
 for(let node:Object3D|null=object;node;node=node.parent){
  if(!node.visible)return false;
  if(node===scene)return true;
 }
 return false;
}

export function stationInArea(area:Area,id:unknown):StationId|null{
 return typeof id==='string'&&Object.hasOwn(getSpace(area).stations,id)?id as StationId:null;
}

// Foliage can conceal a seat or appliance while still letting a floor tap
// select its visible destination marker. Solid furniture always stops the ray.
export function selectionSurfaces(intersections:Intersection[],scene:Object3D){
 let canopyDistance=Infinity;
 for(const hit of intersections){
  const mesh=hit.object;
  if(!(mesh instanceof Mesh)||!isVisibleInScene(mesh,scene))continue;
  const material=Array.isArray(mesh.material)?mesh.material[hit.face?.materialIndex??0]:mesh.material;
  if(!material?.visible)continue;
  if(mesh.userData.decorativeCanopy){
   if(material.opacity>.4)canopyDistance=Math.min(canopyDistance,hit.distance);
  }else if(mesh.userData.blocksSelection||!material.transparent||material.opacity>=.9){
   return {surface:hit,canopyDistance};
  }
 }
 return {surface:undefined,canopyDistance};
}
