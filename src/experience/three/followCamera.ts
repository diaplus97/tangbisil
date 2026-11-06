import * as T from 'three';

// The bearing belongs to the visitor, not to the character's route or seat.
export function createFollowCamera(point:{x:number;z:number},yaw=Math.PI,area='pantry',resolve?:(origin:T.Vector3,desired:T.Vector3,ignoreNear?:number)=>void){
 const camera=new T.PerspectiveCamera(55,1,.08,70),anchor=new T.Vector3(point.x,0,point.z);
 let pitch=-.13,distance=4.5,ready=false,stationBlend=0,stationSide=1;
 const bounds=area==='healing'?{x:4.72,minZ:-4.32,maxZ:4.15}:{x:7.65,minZ:-5.6,maxZ:7.95};
 const desired=new T.Vector3(),look=new T.Vector3();
 function update(p:{x:number;z:number;focus?:{x:number;z:number;y?:number}|null},dt:number,reduced:boolean){
  const alpha=!ready||reduced?1:1-Math.exp(-Math.min(dt,.1)*13);anchor.lerp(new T.Vector3(p.x,0,p.z),alpha);
  if(p.focus&&stationBlend<.001)stationSide=(p.focus.x-anchor.x)*-Math.cos(yaw)+(p.focus.z-anchor.z)*Math.sin(yaw)<0?-1:1;
  stationBlend+=(Number(Boolean(p.focus))-stationBlend)*alpha;
  const center=anchor.clone();if(p.focus){center.x+=(p.focus.x-anchor.x)*.35;center.z+=(p.focus.z-anchor.z)*.35;}
  const arm=distance-stationBlend*.8;
  const right=new T.Vector3(-Math.cos(yaw),0,Math.sin(yaw));
  desired.set(center.x-Math.sin(yaw)*arm,2.5,center.z-Math.cos(yaw)*arm).addScaledVector(right,T.MathUtils.lerp(1.1,stationSide*2.2,stationBlend));
  // Keep the camera inside the room; the look target keeps the avatar visible
  // when its orbit slides along a wall, without following the walking heading.
  desired.x=T.MathUtils.clamp(desired.x,-bounds.x,bounds.x);desired.z=T.MathUtils.clamp(desired.z,bounds.minZ,bounds.maxZ);
  const reach=Math.hypot(desired.x-anchor.x,desired.z-anchor.z);
  desired.y=T.MathUtils.clamp(2.5+(2.8-reach)*.38,2.5,area==='healing'?3.08:3.55);
  const origin=new T.Vector3(anchor.x,2.05,anchor.z),wanted=desired.clone();resolve?.(origin,desired);
  const objectOrigin=p.focus?new T.Vector3(p.focus.x,(p.focus.y??1.4)+.2,p.focus.z).addScaledVector(new T.Vector3(anchor.x-p.focus.x,0,anchor.z-p.focus.z).normalize(),.25):null;
  const blocked=(candidate:T.Vector3)=>{if(!objectOrigin||!resolve)return false;const probe=candidate.clone();resolve(objectOrigin,probe,.65);return probe.distanceToSquared(candidate)>.01;};
  // A cupboard must not push the lens into the avatar. Slide the orbit into
  // the nearest open side instead; the visitor's chosen bearing stays stored.
  if(Math.hypot(desired.x-anchor.x,desired.z-anchor.z)<2.8||blocked(desired)){
   let best:T.Vector3|null=null,score=Infinity;
   const base=Math.atan2(wanted.x-anchor.x,wanted.z-anchor.z);
   for(const angle of [.35,-.35,.7,-.7,1.05,-1.05,1.4,-1.4,1.8,-1.8,Math.PI]){
    const candidate=new T.Vector3(T.MathUtils.clamp(anchor.x+Math.sin(base+angle)*4,-bounds.x,bounds.x),2.65,T.MathUtils.clamp(anchor.z+Math.cos(base+angle)*4,bounds.minZ,bounds.maxZ));
    resolve?.(origin,candidate);if(Math.hypot(candidate.x-anchor.x,candidate.z-anchor.z)<2.8||blocked(candidate))continue;
    const cost=candidate.distanceToSquared(wanted)+(ready?candidate.distanceToSquared(camera.position)*.15:0);if(cost<score){best=candidate;score=cost;}
   }
   if(best)desired.copy(best);
  }
  camera.position.copy(desired);
  look.set(center.x+Math.sin(yaw)*.65,1.35+pitch*3,center.z+Math.cos(yaw)*.65);
  camera.lookAt(look);camera.updateMatrixWorld();ready=true;
 }
 update(point,1,true);
 return{camera,follow:update,
  resize(aspect:number){camera.aspect=aspect;camera.fov=aspect<.8?68:55;distance=aspect<.8?4.1:4.5;camera.updateProjectionMatrix();},
  drag(dx:number,dy:number,width:number,height:number){yaw-=dx/Math.max(width,1)*Math.PI*1.35;pitch=T.MathUtils.clamp(pitch-dy/Math.max(height,1)*1.1,-.48,.16);},
  turn(horizontal:number,vertical:number){yaw+=horizontal;pitch=T.MathUtils.clamp(pitch+vertical,-.48,.16);},
  aim(nextYaw:number,nextPitch=-.13){yaw=nextYaw;pitch=nextPitch;},
  get angles(){return{yaw,pitch};},
 };
}
