import * as T from 'three';

// Fixed bearing and lens. Only translation changes, after leaving the quiet
// central region; neither the path nor the destination rotates the camera.
export function createExploreCamera(point:{x:number;z:number}){
  const focus=new T.Vector3(point.x-.15,1.05,point.z-.15);
  const offset=new T.Vector3(3.4,2.8,4.4),camera=new T.PerspectiveCamera(52,1,.06,70);
  camera.position.copy(focus).add(offset);camera.lookAt(focus);camera.updateMatrixWorld();
  const projected=new T.Vector3(),subject=new T.Vector3(),hit=new T.Vector3(),ray=new T.Raycaster(),plane=new T.Plane(new T.Vector3(0,1,0),-1.05);
  return {camera,
    resize(aspect:number){camera.aspect=aspect;camera.updateProjectionMatrix();camera.updateMatrixWorld();},
    follow(point:{x:number;z:number},dt:number,reduced:boolean){
      subject.set(point.x,1.05,point.z);projected.copy(subject).project(camera);
      const xLimit=reduced?.32:.22,yLimit=reduced?.3:.22;
      const x=T.MathUtils.clamp(projected.x,-xLimit,xLimit),y=T.MathUtils.clamp(projected.y,-yLimit,yLimit);
      if(Math.abs(x-projected.x)<.001&&Math.abs(y-projected.y)<.001)return false;
      ray.setFromCamera(new T.Vector2(x,y),camera);
      if(!ray.ray.intersectPlane(plane,hit))return false;
      const amount=reduced?1:1-Math.exp(-Math.min(dt,.1)*7);
      camera.position.x+=(subject.x-hit.x)*amount;camera.position.z+=(subject.z-hit.z)*amount;
      camera.updateMatrixWorld();return true;
    },
  };
}
