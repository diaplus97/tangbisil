import {Box3,Ray,Vector3} from 'three';
import {getSpace,type Area} from '../../../shared/space.mjs';

// Camera clearance uses room-scale solids, not every leaf, seam and chair triangle.
export function createCameraCollision(area:Area){
 const map=getSpace(area),boxes=map.obstacles.map(o=>new Box3(new Vector3(o.minX+.16,0,o.minZ+.16),new Vector3(o.maxX-.16,1.55,o.maxZ-.16)));
 if(area==='pantry'){
  boxes.push(new Box3(new Vector3(-7.8,2.48,-1.86),new Vector3(-7.13,3.45,1.62)));
  boxes.push(new Box3(new Vector3(-7.65,0,2.4),new Vector3(-6.45,2.32,3.62)));
 }else if(area==='healing')boxes.push(new Box3(new Vector3(3.6,0,-4.2),new Vector3(4.4,2.65,-3.4)));
 const ray=new Ray(),delta=new Vector3(),hit=new Vector3();
 return (origin:Vector3,desired:Vector3,ignoreNear=.2)=>{
  delta.copy(desired).sub(origin);const length=delta.length();if(length<.001)return;
  ray.set(origin,delta.multiplyScalar(1/length));let nearest=length+.24;
  for(const box of boxes){if(!ray.intersectBox(box,hit))continue;const d=hit.distanceTo(origin);if(d>ignoreNear&&d<nearest)nearest=d;}
  // Short lens-to-lens sweeps must never move farther than the proposed step.
  const minimum=ignoreNear<.1?0:.45;
  if(nearest<length+.24)desired.copy(origin).addScaledVector(delta,Math.min(length,Math.max(minimum,nearest-.24)));
 };
}
