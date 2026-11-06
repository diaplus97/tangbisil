import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {Workshop} from './assets';

export function metricUvs(geometry:T.BufferGeometry){
  const p=geometry.getAttribute('position'),n=geometry.getAttribute('normal'),uv=geometry.getAttribute('uv');
  for(let i=0;i<p.count;i++){
    const x=Math.abs(n.getX(i)),y=Math.abs(n.getY(i)),z=Math.abs(n.getZ(i));
    if(y>x&&y>z)uv.setXY(i,p.getX(i),p.getZ(i));
    else if(x>z)uv.setXY(i,p.getZ(i),p.getY(i));
    else uv.setXY(i,p.getX(i),p.getY(i));
  }
  return geometry;
}
export function softBox(kit:Workshop,parent:T.Object3D,w:number,h:number,d:number,r:number,material:T.Material){
  return kit.mesh(parent,metricUvs(new RoundedBoxGeometry(w,h,d,5,r)),material);
}
export function rod(kit:Workshop,parent:T.Object3D,from:T.Vector3,to:T.Vector3,r0:number,r1:number,material:T.Material){
  const delta=to.clone().sub(from),g=new T.CylinderGeometry(r1,r0,delta.length(),16,1);
  const uv=g.getAttribute('uv');for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*Math.PI*(r0+r1),uv.getY(i)*delta.length());
  const mesh=kit.mesh(parent,g,material);mesh.position.copy(from).add(to).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());return mesh;
}
export function seam(kit:Workshop,parent:T.Object3D,points:T.Vector3[],material:T.Material,r=.004,closed=false){
  const curve=new T.CatmullRomCurve3(points,closed,'centripetal');
  return kit.mesh(parent,new T.TubeGeometry(curve,Math.max(32,points.length*3),r,5,closed),material);
}
export function contactShadow(kit:Workshop,parent:T.Object3D,x:number,z:number,w:number,d:number,opacity=.22){
  const key='contact-shadow-'+opacity;
  let material=kit.materials.get(key);
  if(!material){
    const map=kit.texture(c=>{const gradient=c.createRadialGradient(64,64,3,64,64,64);gradient.addColorStop(0,'#303325bb');gradient.addColorStop(.4,'#30332555');gradient.addColorStop(1,'#30332500');c.fillStyle=gradient;c.fillRect(0,0,128,128);},128,128);
    material=new T.MeshStandardMaterial({map,transparent:true,opacity,depthWrite:false,roughness:1,polygonOffset:true,polygonOffsetFactor:-1});
    kit.materials.set(key,material);
  }
  const mesh=kit.mesh(parent,new T.PlaneGeometry(w,d),material,x,-.021,z);mesh.rotation.x=-Math.PI/2;mesh.castShadow=false;mesh.receiveShadow=false;mesh.renderOrder=1;return mesh;
}
