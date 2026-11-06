import * as T from 'three';

export type Eye={x:number;y:number;z:number;yaw:number;pitch:number};
export function createFirstPersonCamera(eye:Eye){
  const camera=new T.PerspectiveCamera(60,1,.035,70),anchor=new T.Vector3(eye.x,eye.y,eye.z);
  let yaw=eye.yaw,pitch=eye.pitch,targetYaw=yaw,targetPitch=pitch,manualLook=false;
  camera.position.copy(anchor);
  function orient(){camera.lookAt(camera.position.x+Math.sin(yaw)*Math.cos(pitch),camera.position.y+Math.sin(pitch),camera.position.z+Math.cos(yaw)*Math.cos(pitch));camera.updateMatrixWorld();}
  function aim(nextYaw:number,nextPitch=0){targetYaw=yaw+Math.atan2(Math.sin(nextYaw-yaw),Math.cos(nextYaw-yaw));targetPitch=T.MathUtils.clamp(nextPitch,-.65,.38);}
  orient();
  return {camera,
    resize(aspect:number){const vertical=2*Math.atan(Math.tan(T.MathUtils.degToRad(54))/aspect);camera.aspect=aspect;camera.fov=T.MathUtils.clamp(T.MathUtils.radToDeg(vertical),42,92);camera.clearViewOffset();camera.updateProjectionMatrix();},
    anchor(point:{x:number;y:number;z:number}){anchor.set(point.x,point.y,point.z);},
    // A destination can suggest an arrival view until the visitor chooses one.
    // Updating the seated eye position must never undo that choice.
    beginMove(){manualLook=false;},
    frame(nextYaw:number,nextPitch=0){if(!manualLook)aim(nextYaw,nextPitch);},
    aim(nextYaw:number,nextPitch=0){manualLook=true;aim(nextYaw,nextPitch);},
    drag(dx:number,dy:number,width:number,height:number){
      manualLook=true;
      const horizontal=2*Math.atan(Math.tan(T.MathUtils.degToRad(camera.fov/2))*camera.aspect);
      yaw-=dx/Math.max(width,1)*horizontal;pitch=T.MathUtils.clamp(pitch-dy/Math.max(height,1)*T.MathUtils.degToRad(camera.fov),-.65,.38);
      targetYaw=yaw;targetPitch=pitch;orient();
    },
    turn(horizontal:number,vertical:number){manualLook=true;yaw+=horizontal;pitch=T.MathUtils.clamp(pitch+vertical,-.65,.38);targetYaw=yaw;targetPitch=pitch;orient();},
    update(dt:number,reduced:boolean){const alpha=reduced?1:1-Math.exp(-Math.min(dt,.1)*12);camera.position.lerp(anchor,alpha);yaw+=(targetYaw-yaw)*alpha;pitch+=(targetPitch-pitch)*alpha;orient();},
    get angles(){return{yaw,pitch};},
  };
}
