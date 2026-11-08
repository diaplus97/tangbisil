import * as T from 'three';

type Focus={x:number;z:number;y?:number;yaw?:number};
type Subject={x:number;z:number;sit?:number;focus?:Focus|null;steering?:boolean};
const deltaAngle=(a:number,b:number)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
export function createFollowCamera(point:{x:number;z:number},yaw=Math.PI,area='pantry',resolve?:(origin:T.Vector3,desired:T.Vector3,ignoreNear?:number)=>void){
 const camera=new T.PerspectiveCamera(55,1,.08,70),anchor=new T.Vector3(point.x,0,point.z);
 const bounds=area==='healing'?{x:4.72,minZ:-4.32,maxZ:4.15}:area==='smoking'?{x:4.38,minZ:-3.94,maxZ:4.0}:{x:7.65,minZ:-5.6,maxZ:7.95};
 const nextEye=new T.Vector3(),travel=new T.Vector3(),desired=new T.Vector3(),origin=new T.Vector3(),candidate=new T.Vector3(),best=new T.Vector3(),aimPoint=new T.Vector3(),focusPoint=new T.Vector3(),objectOrigin=new T.Vector3(),probe=new T.Vector3();
 let ready=false,pitch=-.13,distance=5.3,weight=0,standing=0,lastFocus:Focus|null=null,manualFocus:Focus|null=null;
 let focusBearing=yaw,orbit=yaw+Math.PI,radius=distance,height=2.5,manual=false,steeringOrbit:number|null=null;
 // Preserve the visitor's current optical heading when reduced motion is enabled mid-shot.
 let wasReduced=false,headingOffset=0,pitchOffset=0;
 const opticalDirection=new T.Vector3();
 function bounded(v:T.Vector3){v.x=T.MathUtils.clamp(v.x,-bounds.x,bounds.x);v.z=T.MathUtils.clamp(v.z,bounds.minZ,bounds.maxZ);}
 function place(v:T.Vector3,bearing:number,arm:number,eyeY:number){
   v.set(anchor.x+Math.sin(bearing)*arm,eyeY,anchor.z+Math.cos(bearing)*arm);bounded(v);resolve?.(origin,v);
 }
 function obstructed(v:T.Vector3){
   if(weight<.45||!resolve)return false;
   probe.copy(v);resolve(objectOrigin,probe,.65);return probe.distanceToSquared(v)>.04;
 }
 function follow(p:Subject,dt:number,reduced:boolean){
   const snap=!ready,step=Math.min(.10,Math.max(0,dt)),damp=snap?1:1-Math.exp(-step*10);
   if(reduced&&!wasReduced&&ready){
     camera.getWorldDirection(opticalDirection);
     headingOffset=deltaAngle(yaw,Math.atan2(opticalDirection.x,opticalDirection.z));
     pitchOffset=Math.asin(T.MathUtils.clamp(opticalDirection.y,-1,1))-pitch;
   }
   wasReduced=reduced;
   anchor.x+=(p.x-anchor.x)*damp;anchor.z+=(p.z-anchor.z)*damp;
   origin.set(anchor.x,2.05,anchor.z);
   const target=p.focus??null;
   if(target!==lastFocus){
     manualFocus=null;
     if(target){
       const bearing=target.yaw??Math.atan2(target.x-p.x,target.z-p.z);
       const front=bearing+Math.PI,relative=deltaAngle(front,orbit);
       // Stay on the near side of the appliance. The oblique view leaves
       // the cup and the user's shoulder in different parts of the frame.
       const offset=(relative<0?-1:1)*T.MathUtils.clamp(Math.abs(relative),.64,.94);
       focusBearing=front+offset;
     }
     lastFocus=target;
   }
   let requested=0;
   if(!reduced&&target&&target!==manualFocus){
     focusPoint.set(target.x,target.y??1.45,target.z);
     requested=1-T.MathUtils.smoothstep(Math.hypot(p.x-target.x,p.z-target.z),1.45,4.3);
     objectOrigin.copy(focusPoint);objectOrigin.y+=.18;
     objectOrigin.x-=Math.sin(target.yaw??0)*.28;objectOrigin.z-=Math.cos(target.yaw??0)*.28;
   }
   const blend=snap?1:1-Math.exp(-step*4.6);weight+=(requested-weight)*blend;
   standing+=(1-(p.sit??1)-standing)*damp;
   const arm=distance+standing*(camera.aspect<.8?1:1.1)-weight*1.52;
   const free=yaw+Math.PI+(reduced?headingOffset:Math.atan2(.95,arm));
   if(!p.steering||manual)steeringOrbit=null;
   else if(steeringOrbit===null&&ready)steeringOrbit=orbit;
   const home=steeringOrbit??free;
   const wanted=reduced?free:home+deltaAngle(home,focusBearing)*weight;
   place(desired,wanted,arm,2.5);
   const minReach=2.65+standing*(1-weight)*1.55;
   if(!reduced&&(Math.hypot(desired.x-anchor.x,desired.z-anchor.z)<minReach||obstructed(desired))){
     let score=Infinity;best.copy(desired);
     for(const angle of [.32,-.32,.64,-.64,.96,-.96,1.28,-1.28,1.60,-1.60,2.1,-2.1,Math.PI]){
       place(candidate,wanted+angle,arm,2.65);
       if(Math.hypot(candidate.x-anchor.x,candidate.z-anchor.z)<minReach||obstructed(candidate))continue;
       const cost=candidate.distanceToSquared(desired)+(ready?candidate.distanceToSquared(camera.position)*.55:0);
       if(cost<score){score=cost;best.copy(candidate);}
     }
     desired.copy(best);
   }
   const bearing=Math.atan2(desired.x-anchor.x,desired.z-anchor.z),reach=Math.hypot(desired.x-anchor.x,desired.z-anchor.z);
   const turn=deltaAngle(orbit,bearing),speed=manual?6.8:1.75;
   orbit+=snap?turn:T.MathUtils.clamp(turn,-speed*step,speed*step);
   radius+=snap?reach-radius:T.MathUtils.clamp(reach-radius,-step*3.8,step*3.8);
   const eyeY=2.5+Math.max(0,2.8-reach)*.30;height+=(eyeY-height)*damp;
   place(nextEye,orbit,radius,height);
   if(!snap){
     // A sightline can clear in one frame as we pass a cabinet corner.
     // Limit the actual lens travel as well as the requested orbit radius.
     travel.copy(nextEye).sub(camera.position);
     const maxTravel=(manual?12:6.5)*step;
     if(travel.lengthSq()>maxTravel*maxTravel)nextEye.copy(camera.position).add(travel.setLength(maxTravel));
     resolve?.(camera.position,nextEye,.015);
   }
   camera.position.copy(nextEye);
   aimPoint.set(anchor.x+Math.sin(yaw)*.58,1.35+pitch*3,anchor.z+Math.cos(yaw)*.58);
   if(weight>.001)aimPoint.lerp(focusPoint,.79*weight);
   if(reduced){
     const heading=yaw+headingOffset,tilt=T.MathUtils.clamp(pitch+pitchOffset,-.9,.5);
     opticalDirection.set(Math.sin(heading)*Math.cos(tilt),Math.sin(tilt),Math.cos(heading)*Math.cos(tilt));
     aimPoint.copy(camera.position).add(opticalDirection);
   }
   camera.lookAt(aimPoint);camera.updateMatrixWorld();ready=true;
   if(Math.abs(turn)<.035)manual=false;
 }
 follow(point,1,false);
 function takeLook(){
   if(!wasReduced&&lastFocus&&manualFocus!==lastFocus&&weight>.02)yaw=orbit-Math.PI-Math.atan2(.95,radius);
   manual=true;manualFocus=lastFocus;steeringOrbit=null;
 }
 return {camera,follow,
   resize(aspect:number){camera.aspect=aspect;const portrait=1-T.MathUtils.smoothstep(aspect,.55,1.22);camera.fov=55+portrait*20;distance=5.3-portrait*.53;camera.updateProjectionMatrix();},
   drag(dx:number,dy:number,width:number,height:number){takeLook();yaw-=dx/Math.max(width,1)*Math.PI*1.35;pitch=T.MathUtils.clamp(pitch-dy/Math.max(height,1)*1.1,-.48,.23);},
   turn(horizontal:number,vertical:number){takeLook();yaw+=horizontal;pitch=T.MathUtils.clamp(pitch+vertical,-.48,.23);},
   aim(nextYaw:number,nextPitch=-.13){takeLook();yaw=nextYaw-(wasReduced?headingOffset:0);pitch=nextPitch-(wasReduced?pitchOffset:0);},
   get angles(){return {yaw,pitch};}
 };
}
