import * as T from 'three';
import {Workshop} from './assets';

export type RoomSurfaces=ReturnType<typeof roomSurfaces>;
export function roomSurfaces(kit:Workshop){
  let seed=91731;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  function repeat(t:T.Texture,count=1){t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(count,count);return t;}
  function dataMap(t:T.Texture){const m=t.clone();m.colorSpace=T.NoColorSpace;kit.textures.add(m);return m;}
  function keep<M extends T.MeshStandardMaterial>(key:string,m:M):M{kit.materials.set(key,m);return m;}
  const oak=repeat(kit.texture(c=>{
    c.fillStyle='#d4b58a';c.fillRect(0,0,1024,1024);
    for(let i=0;i<2800;i++){
      const x=random()*1024,phase=random()*6.28,a=2+random()*9;
      c.strokeStyle=i%3?'rgba(94,59,29,.075)':'rgba(255,241,208,.2)';c.lineWidth=.4+random()*1.2;c.beginPath();
      for(let y=0;y<=1024;y+=8){const xx=x+Math.sin(y*.009+phase)*a+Math.sin(y*.031+phase)*1.4;y?c.lineTo(xx,y):c.moveTo(xx,y);}c.stroke();
    }
    for(let i=0;i<35000;i++){c.fillStyle=i%2?'#fff5dc16':'#58401c16';c.fillRect(random()*1024,random()*1024,.7,2+random()*5);}
  },1024,1024));
  const wood=keep('room-oak',new T.MeshStandardMaterial({map:oak,bumpMap:dataMap(oak),bumpScale:.002,roughness:.57}));
  // Neutral weave maps are multiplied by each upholstery colour. UVs are metres.
  const textile=repeat(kit.texture(c=>{
    const image=c.createImageData(1024,1024),p=image.data;
    for(let y=0;y<1024;y++)for(let x=0;x<1024;x++){
      const over=((x>>3)+(y>>3))%2,thread=over?Math.sin((x%8+.5)*Math.PI/8):Math.sin((y%8+.5)*Math.PI/8);
      const shade=206+thread*34+(random()-.5)*12,i=(y*1024+x)*4;p[i]=shade;p[i+1]=shade;p[i+2]=shade;p[i+3]=255;
    }c.putImageData(image,0,0);
  },1024,1024),.9);
  const clothBump=dataMap(textile);
  const fabrics=['#77a4b4','#a6b888','#d8c9ab'].map((color,i)=>keep('fabric-'+i,new T.MeshPhysicalMaterial({color,map:textile,bumpMap:clothBump,bumpScale:.0035,roughness:.97,sheen:.3,sheenColor:new T.Color(color).lerp(new T.Color('#ffffff'),.35),sheenRoughness:.9})));
  const seamColors=['#527f90','#7d9167','#aa9676'].map((color,i)=>keep('seam-'+i,new T.MeshStandardMaterial({color,roughness:1})));
  const stone=repeat(kit.texture(c=>{
    c.fillStyle='#dfdcd2';c.fillRect(0,0,1024,1024);
    for(let i=0;i<6000;i++){
      const x=random()*1024,y=random()*1024,r=.6+random()*3.8;
      c.fillStyle=['#aeaa9d55','#b5b6ac45','#f9f4e5aa','#c9b39d45','#91998d25'][i%5];c.beginPath();
      for(let j=0;j<5;j++){const a=j*Math.PI*2/5,rr=r*(.7+random()*.5);j?c.lineTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr):c.moveTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr);}c.closePath();c.fill();
    }
    for(let i=0;i<65000;i++){c.fillStyle=i%2?'#ffffff18':'#4b4b3512';c.fillRect(random()*1024,random()*1024,1,1);}
  },1024,1024),6);
  const terrazzo=keep('terrazzo',new T.MeshStandardMaterial({map:stone,bumpMap:dataMap(stone),bumpScale:.0007,roughness:.65}));
  const counterMap=stone.clone();counterMap.repeat.set(1,1);kit.textures.add(counterMap);
  const terrazzoCounter=keep('terrazzo-counter',new T.MeshStandardMaterial({map:counterMap,color:'#fffdf7',roughness:.46}));
  const mineral=repeat(kit.texture(c=>{
    c.fillStyle='#f0e8d9';c.fillRect(0,0,512,512);
    for(let i=0;i<22000;i++){c.fillStyle=i%3?'#80755712':'#ffffff40';c.fillRect(random()*512,random()*512,.8+random(),.8+random());}
  },512,512),2);
  const table=keep('table-top',new T.MeshStandardMaterial({map:mineral,bumpMap:dataMap(mineral),bumpScale:.001,roughness:.5}));
  const plaster=repeat(kit.texture(c=>{c.fillStyle='#f6f3eb';c.fillRect(0,0,512,512);for(let i=0;i<45000;i++){c.fillStyle=i%2?'#585d5112':'#ffffff44';c.fillRect(random()*512,random()*512,1,1);}},512,512),2);
  const wall=kit.mat('#faf6ed');wall.color.set('#ffffff');wall.map=plaster;wall.bumpMap=dataMap(plaster);wall.bumpScale=.0018;
  const ceramic=keep('ceramic',new T.MeshStandardMaterial({color:'#dcd6c5',map:plaster,bumpMap:dataMap(plaster),bumpScale:.0014,roughness:.72}));
  const frame=keep('room-frame',new T.MeshStandardMaterial({color:'#a8b4b0',roughness:.3,metalness:.65}));
  const steel=keep('brushed-steel',new T.MeshStandardMaterial({color:'#98a29f',roughness:.33,metalness:.8}));
  const ceiling=keep('ceiling',new T.MeshStandardMaterial({color:'#f8f5ec',roughness:1,emissive:'#fff3df',emissiveIntensity:.12}));
  const cove=keep('cove',new T.MeshStandardMaterial({color:'#ffe9bd',emissive:'#ffdca1',emissiveIntensity:1.1,roughness:1}));
  const glassPattern=kit.texture(c=>{c.fillStyle='#eef2ee';c.fillRect(0,0,512,1024);for(let x=0;x<512;x++){const a=.06+.05*Math.cos(x*Math.PI/4);c.fillStyle=`rgba(72,102,104,${a})`;c.fillRect(x,0,1,1024);}},512,1024);
  const smokingGlass=keep('smoking-glass',new T.MeshPhysicalMaterial({color:'#a5bbc1',map:glassPattern,bumpMap:dataMap(glassPattern),bumpScale:.003,roughness:.34,clearcoat:.35,clearcoatRoughness:.25}));
  const reliefGlass=keep('relief-glass',smokingGlass.clone());reliefGlass.color.set('#b1c0a5');
  return {wood,frame,steel,fabrics,seamColors,terrazzo,terrazzoCounter,table,ceramic,ceiling,cove,smokingGlass,reliefGlass};
}
