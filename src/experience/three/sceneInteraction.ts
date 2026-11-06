import type {Object3D} from 'three';
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
