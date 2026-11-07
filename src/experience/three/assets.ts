import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export const colors={wall:'#e5dfcc',trim:'#f0eadb',blue:'#8da7ad',deepBlue:'#4e6877',wood:'#c5a27a',woodDark:'#8c715a',cream:'#f4ecd5',leaf:'#68896b',skin:'#dfb798'};
export class Workshop {
  materials=new Map<string,T.MeshStandardMaterial>();
  geometries=new Set<T.BufferGeometry>();
  textures=new Set<T.Texture>();
  mat(color:string,roughness=.85){
    const key=color+roughness;
    if(!this.materials.has(key))this.materials.set(key,new T.MeshStandardMaterial({color,roughness}));
    return this.materials.get(key)!;
  }
  geometry<G extends T.BufferGeometry>(g:G){this.geometries.add(g);return g;}
  mesh(parent:T.Object3D,g:T.BufferGeometry,material:T.Material,x=0,y=0,z=0){
    this.geometries.add(g);const m=new T.Mesh(g,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  }
  box(parent:T.Object3D,w:number,h:number,d:number,x:number,y:number,z:number,color:string,r=.025){
    return this.mesh(parent,new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/3,h/3,d/3)),this.mat(color),x,y,z);
  }
  sphere(parent:T.Object3D,r:number,x:number,y:number,z:number,color:string,sx=1,sy=1,sz=1){
    const m=this.mesh(parent,new T.SphereGeometry(r,12,8),this.mat(color),x,y,z);m.scale.set(sx,sy,sz);return m;
  }
  cylinder(parent:T.Object3D,rt:number,rb:number,h:number,x:number,y:number,z:number,color:string){
    return this.mesh(parent,new T.CylinderGeometry(rt,rb,h,24),this.mat(color),x,y,z);
  }
  tube(parent:T.Object3D,points:T.Vector3[],radius:number,color:string){
    return this.mesh(parent,new T.TubeGeometry(new T.CatmullRomCurve3(points),12,radius,6,false),this.mat(color));
  }
  texture(draw:(c:CanvasRenderingContext2D)=>void,w=512,h=512){
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;draw(canvas.getContext('2d')!);
    const t=new T.CanvasTexture(canvas);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;this.textures.add(t);return t;
  }
  release(group:T.Object3D){group.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();this.geometries.delete(o.geometry);}});group.removeFromParent();}
  dispose(){this.geometries.forEach(g=>g.dispose());this.materials.forEach(m=>m.dispose());this.textures.forEach(t=>t.dispose());}
}

// Merge immobile furniture by material. Small details do not each require a draw call.
export function consolidate(group:T.Group,kit:Workshop){
  group.updateMatrixWorld(true);
  const worldToGroup=group.matrixWorld.clone().invert();
  const batches=new Map<string,{material:T.Material;geometries:T.BufferGeometry[];cast:boolean;receive:boolean;order:number;floor:boolean}>(),originals=new Set<T.BufferGeometry>();
  group.traverse(o=>{if(o instanceof T.Mesh&&!Array.isArray(o.material)){
    originals.add(o.geometry);
    const floor=o.userData.walkSurface===true;
    const g=o.geometry.clone().applyMatrix4(worldToGroup.clone().multiply(o.matrixWorld)),key=[o.material.uuid,o.castShadow,o.receiveShadow,o.renderOrder,floor].join(':');
    const batch=batches.get(key)??{material:o.material,geometries:[] as T.BufferGeometry[],cast:o.castShadow,receive:o.receiveShadow,order:o.renderOrder,floor};batch.geometries.push(g);batches.set(key,batch);
  }});
  group.clear();
  originals.forEach(g=>{g.dispose();kit.geometries.delete(g);});
  for(const {material,geometries,cast,receive,order,floor} of batches.values()){
    const expanded=geometries.map(g=>g.index?g.toNonIndexed():g);
    const merged=mergeGeometries(expanded,false);
    if(merged){const mesh=kit.mesh(group,merged,material);mesh.castShadow=cast;mesh.receiveShadow=receive;mesh.renderOrder=order;if(floor)mesh.userData.walkSurface=true;}
    new Set([...geometries,...expanded]).forEach(g=>g.dispose());
  }
}

export function label(kit:Workshop,parent:T.Object3D,text:string,w:number,h:number,x:number,y:number,z:number,color=colors.deepBlue,bg=colors.cream,fontSize=42){
  const key='label:'+JSON.stringify([text,color,bg,fontSize]);let material=kit.materials.get(key);
  if(!material){const texture=kit.texture(c=>{
    c.fillStyle=bg;c.fillRect(0,0,512,128);c.fillStyle=color;
    let size=Math.min(fontSize,96);c.font=`500 ${size}px "Malgun Gothic", sans-serif`;
    while(size>16&&(c.measureText(text).width>464||c.measureText(text).actualBoundingBoxAscent+c.measureText(text).actualBoundingBoxDescent>96)){size--;c.font=`500 ${size}px "Malgun Gothic", sans-serif`;}
    const metrics=c.measureText(text);c.textAlign='center';c.textBaseline='alphabetic';c.fillText(text,256,64+(metrics.actualBoundingBoxAscent-metrics.actualBoundingBoxDescent)/2);
  },512,128);
  material=new T.MeshStandardMaterial({map:texture,roughness:1,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});kit.materials.set(key,material);}
  return kit.mesh(parent,new T.PlaneGeometry(w,h),material,x,y,z);
}

export function mug(kit:Workshop,parent:T.Object3D,x:number,y:number,z:number,drink='tea',size=1,fill=1){
  const g=new T.Group();g.position.set(x,y,z);g.scale.setScalar(size);parent.add(g);
  const color=drink==='coffee'?'#d8c8ab':'#9fbec0',key='glazed-cup-'+color;
  if(!kit.materials.has(key))kit.materials.set(key,new T.MeshPhysicalMaterial({color,roughness:.3,clearcoat:.25,clearcoatRoughness:.23}));
  const ceramic=kit.materials.get(key)!;
  const profile=[[0,.025],[.087,.025],[.1,.035],[.117,.195],[.118,.221],[.113,.228],[.105,.221],[.103,.195],[.091,.049],[0,.049]].map(([r,h])=>new T.Vector2(r,h));
  kit.mesh(g,new T.LatheGeometry(profile,40),ceramic);
  kit.mesh(g,new T.TorusGeometry(.067,.017,10,32),ceramic,.13,.139,0);
  const liquid=kit.mat(drink==='coffee'?'#59402d':drink==='water'?'#9ab6b3':'#938044',.19);
  const surface=kit.mesh(g,new T.CircleGeometry(.103,40),liquid,0,.199,0);surface.rotation.x=-Math.PI/2;surface.position.y=.045+.154*fill;surface.visible=fill>0;
  if(drink==='empty'){surface.removeFromParent();surface.geometry.dispose();kit.geometries.delete(surface.geometry);}
  const saucer=[[0,.008],[.09,.008],[.11,.012],[.165,.022],[.174,.029],[.17,.036],[.112,.025],[.09,.018],[0,.018]].map(([r,h])=>new T.Vector2(r,h));
  kit.mesh(g,new T.LatheGeometry(saucer,40),kit.mat('#e8e1d1',.36));return g;
}

export function plant(kit:Workshop,parent:T.Object3D,x:number,z:number,size=1,y=0){
  const g=new T.Group();parent.add(g);g.position.set(x,y,z);g.scale.setScalar(size);
  kit.cylinder(g,.23,.16,.37,0,.19,0,'#b69a81');kit.cylinder(g,.245,.245,.055,0,.38,0,'#cfb396');
  kit.cylinder(g,.208,.208,.015,0,.405,0,'#5c5745');
  for(let i=0;i<9;i++){
    const a=i*2.4, height=.6+(i%4)*.16, end=new T.Vector3(Math.cos(a)*.31,height,Math.sin(a)*.31);
    kit.tube(g,[new T.Vector3(0,.4,0),new T.Vector3(end.x*.35,height*.8,end.z*.35),end],.012,'#647a50');
    const leaf=kit.sphere(g,.16,end.x,end.y,end.z,i%2?'#82986b':'#5e805f',.65,.23,1.65);
    leaf.rotation.set(.35*Math.sin(a),-a+.4,.5*Math.cos(a));
  }
  return g;
}

export function packet(kit:Workshop,parent:T.Object3D,x:number,y:number,z:number,size=1){
  const g=new T.Group();g.position.set(x,y,z);g.scale.setScalar(size);parent.add(g);
  kit.box(g,.34,.46,.12,0,.23,0,'#efe4c3',.045);
  kit.box(g,.35,.045,.13,0,.43,0,'#97b1bd',.008);kit.box(g,.35,.045,.13,0,.03,0,'#97b1bd',.008);
  const lemon=kit.sphere(g,.084,0,.255,.066,'#dfba58',1.1,1,.17);
  lemon.rotation.z=.2;
  kit.box(g,.15,.012,.013,0,.12,.066,'#708b98',.003);
  kit.box(g,.09,.009,.013,0,.094,.066,'#a2a28c',.003);return g;
}

function pieOutline(bites:number,w:number,d:number){
  const s=new T.Shape(),x=w/2,z=d/2,r=.1;
  s.moveTo(-x+r,-z);
  if(bites>0){s.lineTo(x-.4,-z);s.quadraticCurveTo(x-.43,-z+.16,x-.28,-z+.16);s.quadraticCurveTo(x-.28,-z+.32,x-.13,-z+.3);s.quadraticCurveTo(x-.05,-z+.4,x,-z+.32);}
  else{s.lineTo(x-r,-z);s.quadraticCurveTo(x,-z,x,-z+r);}
  s.lineTo(x,z-r);s.quadraticCurveTo(x,z,x-r,z);
  if(bites>1){s.lineTo(-x+.4,z);s.quadraticCurveTo(-x+.43,z-.15,-x+.28,z-.15);s.quadraticCurveTo(-x+.28,z-.3,-x+.12,z-.29);s.quadraticCurveTo(-x+.05,z-.37,-x,z-.3);}
  else{s.lineTo(-x+r,z);s.quadraticCurveTo(-x,z,-x,z-r);}
  s.lineTo(-x,-z+r);s.quadraticCurveTo(-x,-z,-x+r,-z);return s;
}

export function pie(kit:Workshop,parent:T.Object3D,bites=0,sample=false){
  const g=new T.Group();parent.add(g);const w=sample?.85:1.5,d=.85;
  const outline=pieOutline(bites,w,d),boundary=outline.getPoints(36);
  function inside(x:number,z:number){let result=false;const y=-z;for(let i=0,j=boundary.length-1;i<boundary.length;j=i++){const a=boundary[i],b=boundary[j];if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)result=!result;}return result;}
  if(!kit.materials.has('biscuit')){
    const texture=kit.texture(c=>{
      c.fillStyle='#f2dfbc';c.fillRect(0,0,256,256);
      for(let i=0;i<5000;i++){const x=(Math.sin(i*127.1)*43758.5)%1*256,y=(Math.sin(i*311.7)*96431.8)%1*256;c.fillStyle=i%3?'#e2c79d':'#fff0d5';c.fillRect(Math.abs(x),Math.abs(y),1+(i%2),1);}
    },256,256);
    kit.materials.set('biscuit',new T.MeshStandardMaterial({color:'#ecc995',map:texture,bumpMap:texture,bumpScale:.012,roughness:1}));
  }
  for(const [base,height,color] of [[0,.15,'#b98142'],[.15,.045,'#e0b744'],[.195,.1,'#fff0cb'],[.295,.17,'#dba45c']] as const){
    const geometry=new T.ExtrudeGeometry(outline,{depth:height,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.015,bevelThickness:.015,curveSegments:16});
    geometry.rotateX(-Math.PI/2);kit.mesh(g,geometry,base===.295?kit.materials.get('biscuit')!:kit.mat(color),0,base,0);
  }
  // Toasted speckles and thin icing live on the upper surface.
  for(let i=0;i<45;i++){
    const x=Math.sin(i*67.3)*w*.36,z=Math.sin(i*13.7)*.3;
    if(!inside(x,z))continue;
    kit.sphere(g,.012,x,.483,z,i%2?'#e9c17c':'#c38c4a',1,.25,1);
  }
  for(let i=0;i<(sample?2:4);i++){
    const x=-w*.32+i*.26;let segment:T.Vector3[]=[];
    const flush=()=>{if(segment.length>1)kit.tube(g,segment,.018,'#f5dfaa');segment=[];};
    for(let k=0;k<=30;k++){const t=k/30,px=x+.16*t,z=-.28+.56*t;if(inside(px-.022,z)&&inside(px+.022,z)&&inside(px,z+.022)&&inside(px,z-.022))segment.push(new T.Vector3(px,.49+Math.sin(t*Math.PI)*.01,z));else flush();}flush();
  }
  return g;
}

export function makeRenderer(canvas:HTMLCanvasElement){
  const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;renderer.outputColorSpace=T.SRGBColorSpace;return renderer;
}
