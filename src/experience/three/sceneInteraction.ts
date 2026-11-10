import {Mesh,type Intersection,type Object3D} from 'three';
import {getSpace,isWalkable,type Area,type Point,type StationId} from '../../../shared/space.mjs';

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

// The floor beside a cabinet can be visible inside its collision clearance.
export function floorDestination(point:Point,area:Area):Point|null{
 if(isWalkable(point,area))return {x:point.x,z:point.z};
 if(area!=='pantry')return null;
 let nearest:Point|null=null,best=.4;
 for(const box of getSpace(area).obstacles){
  if(point.x<=box.minX||point.x>=box.maxX||point.z<=box.minZ||point.z>=box.maxZ)continue;
  const edges=[
   {x:box.minX-.01,z:point.z},{x:box.maxX+.01,z:point.z},
   {x:point.x,z:box.minZ-.01},{x:point.x,z:box.maxZ+.01},
  ];
  for(const edge of edges){
   const distance=Math.hypot(point.x-edge.x,point.z-edge.z);
   if(distance<=best&&isWalkable(edge,area)){nearest=edge;best=distance;}
  }
 }
 return nearest;
}

// Resolve the visible model first. Touch can also use a station's larger
// invisible hit box, while a mouse pointing at bare floor always walks.
export function pickSceneTarget(hits:Intersection[],surface:Intersection|undefined,scene:Object3D,area:Area,precise:boolean){
 if(surface){
  let owner:Object3D|null=surface.object;
  while(owner&&!owner.userData.directSurface)owner=owner.parent;
  if(owner)return {...surface,object:owner};
 }
 for(const hit of hits){
  if(!isVisibleInScene(hit.object,scene)||surface&&surface.distance<hit.distance-.045)continue;
  let object:Object3D|null=hit.object;
  while(object&&!object.userData.action&&!object.userData.station&&!object.userData.portal&&object.userData.seat==null)object=object.parent;
  if(!object)continue;
  if(object.userData.station){
   if(!stationInArea(area,object.userData.station))continue;
   if(precise&&area==='pantry'&&surface?.object.userData.walkSurface)continue;
  }
  return {...hit,object};
 }
}

// Decorative foliage transmits taps. A wall or cabinet still owns its silhouette.
export function selectionSurface(intersections:Intersection[],scene:Object3D){
 for(const hit of intersections){
  const mesh=hit.object;
  if(!(mesh instanceof Mesh)||!isVisibleInScene(mesh,scene))continue;
  const material=Array.isArray(mesh.material)?mesh.material[hit.face?.materialIndex??0]:mesh.material;
  if(!material?.visible)continue;
  if(mesh.userData.decorativeCanopy)continue;
  if(mesh.userData.blocksSelection||!material.transparent||material.opacity>=.9)return hit;
 }
 return undefined;
}
