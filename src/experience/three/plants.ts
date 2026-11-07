import * as T from 'three';
import {Workshop,consolidate} from './assets';
import {createSightFade} from './sightFade';
import {rod,contactShadow} from './detailGeometry';
import type {RoomSurfaces} from './surfaces';

export function leafMaterials(kit:Workshop){
  const existing=kit.materials.get('ficus-leaf-0');
  if(existing)return [0,1,2].map(i=>kit.materials.get('ficus-leaf-'+i)!);
  const texture=kit.texture(c=>{
    const gradient=c.createLinearGradient(0,0,512,0);gradient.addColorStop(0,'#4c7132');gradient.addColorStop(.48,'#789548');gradient.addColorStop(.51,'#6c8b3d');gradient.addColorStop(1,'#3f642c');c.fillStyle=gradient;c.fillRect(0,0,512,1024);
    let seed=37;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    for(let i=0;i<45000;i++){c.fillStyle=i%2?'#c0ce7e18':'#1d421518';const r=1+random()*5;c.fillRect(random()*512,random()*1024,r,r);}
    c.lineWidth=3;c.strokeStyle='#b4c77a8c';c.beginPath();c.moveTo(256,1024);c.bezierCurveTo(252,700,260,350,256,0);c.stroke();
    for(let i=0;i<18;i++)for(const side of [-1,1]){
      const y=65+i*52;c.strokeStyle='#bbcb844a';c.lineWidth=1.1;c.beginPath();c.moveTo(256,y+70);c.quadraticCurveTo(256+side*100,y+30,256+side*245,y-40);c.stroke();
      for(let j=0;j<3;j++){c.strokeStyle='#c1d28b21';c.lineWidth=.7;c.beginPath();c.moveTo(256+side*(50+j*50),y+45-j*18);c.lineTo(256+side*(85+j*50),y+70-j*18);c.stroke();}
    }
  },512,1024);
  const bump=texture.clone();bump.colorSpace=T.NoColorSpace;kit.textures.add(bump);
  return ['#ffffff','#d9e4b8','#bdcc9d'].map((color,i)=>{
    const material=new T.MeshPhysicalMaterial({map:texture,bumpMap:bump,bumpScale:.0008,color,side:T.DoubleSide,roughness:.51,clearcoat:.12,clearcoatRoughness:.6});kit.materials.set('ficus-leaf-'+i,material);return material;
  });
}
export function leafGeometry(){
  const length=18,across=8,positions:number[]=[],uv:number[]=[],indices:number[]=[];
  for(let j=0;j<=length;j++)for(let i=0;i<=across;i++){
    const t=j/length,u=i/across*2-1,width=.115*Math.pow(Math.sin(Math.PI*t),.72);
    const x=u*width*(1+.035*Math.sin(t*27)),y=.026*(1-u*u)*Math.sin(Math.PI*t)-.065*t*t+.012*Math.sin(t*Math.PI),z=t*.42;
    positions.push(x,y,z);uv.push(i/across,1-t);
    if(j<length&&i<across){const a=j*(across+1)+i,b=a+across+1;indices.push(a,b,a+1,b,b+1,a+1);}
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
export function indoorTree(kit:Workshop,parent:T.Object3D,scene:T.Scene,x:number,z:number,s:RoomSurfaces,seed=37){
  const tree=new T.Group();tree.position.set(x,0,z);parent.add(tree);
  const canopy=new T.Group();tree.add(canopy);
  const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const profile=[[0,-.024],[.25,-.024],[.265,.006],[.29,.075],[.34,.58],[.345,.62],[.33,.64],[.308,.63],[.302,.59],[.28,.12]].map(([r,y])=>new T.Vector2(r,y));
  kit.mesh(tree,new T.LatheGeometry(profile,64),s.ceramic);
  kit.cylinder(tree,.302,.302,.018,0,.575,0,'#4e4836');
  for(let i=0;i<38;i++){
    const a=random()*Math.PI*2,r=.06+random()*.22;
    const pebble=kit.sphere(tree,.012+random()*.018,Math.cos(a)*r,.592,Math.sin(a)*r,i%3?'#857761':'#c1b59a',1,.45,.8);pebble.rotation.y=a;
  }
  let bark=kit.materials.get('ficus-bark');
  if(!bark){
    const map=kit.texture(c=>{c.fillStyle='#94826a';c.fillRect(0,0,256,1024);for(let i=0;i<1800;i++){c.fillStyle=i%2?'#51493625':'#e4d9b52a';c.fillRect(random()*256,random()*1024,1+random()*2,4+random()*35);}},256,1024);
    const bump=map.clone();bump.colorSpace=T.NoColorSpace;kit.textures.add(bump);bark=new T.MeshStandardMaterial({map,bumpMap:bump,bumpScale:.002,roughness:.95});kit.materials.set('ficus-bark',bark);
  }
  const leafMats=leafMaterials(kit),blade=leafGeometry();
  const trunk=new T.CatmullRomCurve3([new T.Vector3(0,.58,0),new T.Vector3(-.045,1.1,.03),new T.Vector3(.035,1.8,0),new T.Vector3(-.03,2.65,.025)]);
  kit.mesh(tree,new T.TubeGeometry(trunk,28,.038,10,false),bark);
  for(let branch=0;branch<10;branch++){
    const a=branch*2.399+random()*.3,t=.28+branch*.062,start=trunk.getPoint(t),reach=.4+random()*.22;
    const end=start.clone().add(new T.Vector3(Math.cos(a)*reach,.32+random()*.17,Math.sin(a)*reach));
    const stem=new T.CatmullRomCurve3([start,start.clone().lerp(end,.45).add(new T.Vector3(0,.09,0)),end]);
    kit.mesh(canopy,new T.TubeGeometry(stem,15,.009+random()*.006,7,false),bark);
    for(let twig=0;twig<3;twig++){
      const base=stem.getPoint(.38+twig*.25),angle=a+(twig-1)*.75;
      const tip=base.clone().add(new T.Vector3(Math.cos(angle)*.23,.14+random()*.08,Math.sin(angle)*.23));rod(kit,canopy,base,tip,.006,.0025,bark);
      for(let k=0;k<4;k++){
        const node=base.clone().lerp(tip,.15+k*.25),side=k%2?1:-1,bearing=angle+side*(.55+random()*.35);
        const direction=new T.Vector3(Math.cos(bearing),.13+random()*.45,Math.sin(bearing)).normalize();
        const root=node.clone().addScaledVector(direction,.05);rod(kit,canopy,node,root,.002,.001,leafMats[1]);
        const leaf=kit.mesh(canopy,blade,leafMats[(branch+k)%3]);leaf.position.copy(root);leaf.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),direction);
        leaf.rotateZ((random()-.5)*.7);leaf.scale.setScalar(.72+random()*.55);
      }
    }
  }
  contactShadow(kit,tree,0,0,1.2,1.2,.4);
  scene.attach(canopy);
  consolidate(canopy,kit);
  return createSightFade(kit,canopy,true,.08);
}
