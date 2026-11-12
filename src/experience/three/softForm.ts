import * as T from 'three';

export type SoftSection=[y:number,x:number,z:number,width:number,depth:number];
export function softFormGeometry(sections:SoftSection[]){
 const vertices:number[]=[],uvs:number[]=[],indices:number[]=[],sides=16;
 for(let i=0;i<sections.length;i++){
  const [y,x,z,rx,rz]=sections[i];
  for(let j=0;j<sides;j++){const a=j/sides*Math.PI*2;vertices.push(x+Math.cos(a)*rx,y,z+Math.sin(a)*rz);uvs.push(j/sides,i/(sections.length-1));}
 }
 for(let i=0;i<sections.length-1;i++)for(let j=0;j<sides;j++){const a=i*sides+j,b=i*sides+(j+1)%sides;indices.push(a,a+sides,b,b,a+sides,b+sides);}
 for(const [i,flip]of [[0,true],[sections.length-1,false]] as const){const [y,x,z]=sections[i],center=vertices.length/3;vertices.push(x,y,z);uvs.push(.5,.5);for(let j=0;j<sides;j++){const a=i*sides+j,b=i*sides+(j+1)%sides;indices.push(center,flip?a:b,flip?b:a);}}
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
 // Stock primitives carry UVs even without maps. Keep that layout when batching skin and fingers.
 geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
