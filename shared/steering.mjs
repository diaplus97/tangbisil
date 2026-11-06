import {getSpace,sampleMotion,clearSegment} from './space.mjs';

// One directional intent covers the clear straight corridor. Holding a key
// does not consume a request per frame or repeatedly run the path finder.
export function steeringTarget(member,direction,now){
 if(!Array.isArray(direction)||direction.length!==2||direction.some(n=>typeof n!=='number'||!Number.isFinite(n)||Math.abs(n)>1.001)||Math.hypot(...direction)<.01)return null;
 const area=member.area??'pantry',pose=sampleMotion(member,now),start=pose.inSeat!=null?getSpace(area).approaches[pose.inSeat]:{x:pose.x,z:pose.z};
 const length=Math.hypot(...direction),dx=direction[0]/length,dz=direction[1]/length;
 let low=0,high=24;
 for(let i=0;i<14;i++){const distance=(low+high)/2,end={x:start.x+dx*distance,z:start.z+dz*distance};if(clearSegment(start,end,area))low=distance;else high=distance;}
 const distance=Math.max(0,low-.015);
 return{x:start.x+dx*distance,z:start.z+dz*distance};
}
