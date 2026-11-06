import * as T from 'three';
import {Workshop,label} from './assets';
import {sampleTea} from '../../../shared/rest.mjs';
import type {Tea} from '../types';

export function misterModel(kit:Workshop,parent:T.Object3D){
 const g=new T.Group();parent.add(g);
 const profile=[[0,0],[.065,0],[.08,.015],[.085,.09],[.079,.19],[.044,.23],[.027,.235],[.027,.26]].map(([r,y])=>new T.Vector2(r,y));
 const body=kit.mesh(g,new T.LatheGeometry(profile,40),kit.mat('#a7c3b6',.28));body.castShadow=true;
 kit.cylinder(g,.029,.029,.035,0,.265,0,'#476c65');
 kit.box(g,.045,.04,.115,0,.3,-.025,'#617f75',.018);
 const nozzle=kit.cylinder(g,.013,.018,.03,0,.3,-.09,'#c4cbb5');nozzle.rotation.x=Math.PI/2;
 const trigger=kit.box(g,.018,.065,.018,0,.267,-.052,'#476c65',.007);trigger.rotation.x=.35;
 kit.tube(g,[new T.Vector3(0,.26,0),new T.Vector3(.008,.16,.01),new T.Vector3(-.014,.03,.02)],.003,'#c6dfce');
 label(kit,g,'MIST',.075,.028,0,.12,.084,'#46695d','#cbdcc7',80);
 return g;
}

export function stoneModel(kit:Workshop,parent:T.Object3D){
 const g=new T.Group();parent.add(g);const geo=new T.SphereGeometry(1,56,40),pos=geo.getAttribute('position');
 for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i),n=1+.045*Math.sin(x*4+z*2)*Math.cos(y*3);pos.setXYZ(i,x*.17*n,y*.118*(1+.06*x),z*.145*n);}
 geo.computeVertexNormals();const original=Float32Array.from(pos.array);
 let mat=kit.materials.get('soft-stone');
 if(!mat){const tex=kit.texture(c=>{c.fillStyle='#8ba7a4';c.fillRect(0,0,256,256);let seed=21;for(let i=0;i<10000;i++){seed=(seed*1664525+1013904223)>>>0;const x=seed%256;seed=(seed*1664525+1013904223)>>>0;c.fillStyle=i%2?'#d4e1d21c':'#294e4918';c.fillRect(x,seed%256,1,1);}},256,256);mat=new T.MeshPhysicalMaterial({map:tex,color:'#b6c9c5',roughness:.9,clearcoat:.03});kit.materials.set('soft-stone',mat);}
 const mesh=kit.mesh(g,geo,mat);let last=-1,px=0,py=0;
 return{group:g,mesh,deform(age:number,point:number[]=[0,0],reduced=false){
  const attack=T.MathUtils.smoothstep(age,0,160),release=1-T.MathUtils.smoothstep(age,320,reduced?750:1550),amount=age<0?0:attack*release;
  if(amount===last&&point[0]===px&&point[1]===py)return;last=amount;px=point[0];py=point[1];
  const cx=px*.11,cy=py*.075;
  for(let i=0;i<pos.count;i++){const j=i*3,x=original[j],y=original[j+1],z=original[j+2],front=T.MathUtils.smoothstep(z,-.01,.07),weight=Math.exp(-((x-cx)**2+(y-cy)**2)/.0045)*front;
   pos.setXYZ(i,x*(1+amount*.045),y*(1+amount*.025),z-amount*.064*weight);
  }pos.needsUpdate=true;geo.computeVertexNormals();
 }};
}

export function teaModel(kit:Workshop,parent:T.Object3D){
 const group=new T.Group();parent.add(group);
 let glaze=kit.materials.get('tea-glaze');if(!glaze){const tex=kit.texture(c=>{c.fillStyle='#e5e3d3';c.fillRect(0,0,256,256);let seed=93;for(let i=0;i<3200;i++){seed=(seed*1664525+1013904223)>>>0;const x=seed%256;seed=(seed*1664525+1013904223)>>>0;c.fillStyle='#6d827224';c.fillRect(x,seed%256,1,1);}},256,256);glaze=new T.MeshPhysicalMaterial({map:tex,roughness:.27,clearcoat:.35});kit.materials.set('tea-glaze',glaze);}
 const profile=[[0,.014],[.084,.014],[.092,.025],[.118,.2],[.119,.235],[.114,.242],[.106,.236],[.105,.21],[.082,.04],[0,.04]].map(([r,y])=>new T.Vector2(r,y));
 kit.mesh(group,new T.LatheGeometry(profile,56),glaze);
 const handle=kit.mesh(group,new T.TorusGeometry(.068,.016,12,40,Math.PI*1.65),glaze,.123,.137,0);handle.rotation.z=-Math.PI*.325;
 const liquid=kit.mesh(group,new T.CircleGeometry(.105,56),kit.mat('#b9b99a',.16),0,.045,0);liquid.rotation.x=-Math.PI/2;
 // A soft expanding tint blooms through the water, then becomes uniform.
 const bloomMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{strength:{value:0},clock:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'varying vec2 vUv;uniform float strength;uniform float clock;void main(){vec2 p=vUv-vec2(.43,.53);float r=length(p);float edge=.08+strength*.6;float dye=1.-smoothstep(edge-.12,edge+.1,r+.025*sin(p.x*28.+clock)*sin(p.y*25.));float ripple=.025*sin(r*65.-clock*1.8);gl_FragColor=vec4(vec3(.63,.38,.12)+ripple,clamp(dye*(.18+strength*.65),0.,.83));}'});kit.materials.set('tea-bloom-'+group.uuid,bloomMaterial as unknown as T.MeshStandardMaterial);
 const bloom=kit.mesh(group,new T.CircleGeometry(.104,56),bloomMaterial,0,.046,0);bloom.rotation.x=-Math.PI/2;bloom.castShadow=false;
 const bag=new T.Group();group.add(bag);const paper=kit.box(bag,.058,.082,.013,0,.135,.025,'#a39265',.008);paper.rotation.z=.15;
 kit.tube(bag,[new T.Vector3(0,.17,.025),new T.Vector3(.045,.245,.05),new T.Vector3(.075,.247,.095),new T.Vector3(.085,.16,.112)],.0016,'#dfd4b4');kit.box(bag,.033,.038,.004,.085,.15,.114,'#7c9985',.003);
 const steam=new T.Group();group.add(steam);let texture=[...kit.textures].find(t=>t.name==='tea-steam');if(!texture){texture=kit.texture(c=>{const gr=c.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'#ffffff80');gr.addColorStop(.55,'#ffffff20');gr.addColorStop(1,'#ffffff00');c.fillStyle=gr;c.fillRect(0,0,64,64);},64,64);texture.name='tea-steam';}
 const puffs=Array.from({length:5},()=>{const material=new T.SpriteMaterial({map:texture,transparent:true,depthWrite:false,opacity:0});const sprite=new T.Sprite(material);steam.add(sprite);return sprite;});
 return{group,update(raw:Omit<Tea,'id'>|null,now:number,time:number,reduced:boolean){const t=sampleTea(raw as Tea|null,now),volume=t?.volume??0,strength=t?.strength??0;
  liquid.visible=bloom.visible=volume>.001;liquid.position.y=.045+volume*.155;bloom.position.y=liquid.position.y+.0005;bloomMaterial.uniforms.strength.value=strength;bloomMaterial.uniforms.clock.value=reduced?0:time*.0005;
  bag.visible=Boolean(t?.bagIn);steam.visible=volume>0;
  puffs.forEach((p,i)=>{const life=((reduced?850:time)/2700+i/5)%1;p.position.set(Math.sin(i+life*2)*.035,.24+life*.32,Math.cos(i)*.025);p.scale.set(.055+life*.07,.1+life*.12,1);p.material.opacity=reduced?.11:Math.sin(life*Math.PI)*.27;});
 },dispose(){puffs.forEach(p=>p.material.dispose());bloomMaterial.dispose();kit.materials.delete('tea-bloom-'+group.uuid);}};
}
