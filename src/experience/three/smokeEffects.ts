import * as T from 'three';
import {Workshop} from './assets';
import {smokingPhase,SMOKE_LIGHT_MS,SMOKE_PUFF_MS,type Smoking} from '../../../shared/smoking.mjs';

export function smokeGesture(s:Smoking|null|undefined,now:number){
 const phase=smokingPhase(s,now);
 const age=phase==='lighting'?now-s!.litAt:phase==='puffing'?now-s!.puffAt:phase==='ending'?now-s!.endedAt:0;
 const rise=(t:number)=>T.MathUtils.smoothstep(t,0,1);
 const lift=phase==='lighting'?rise(Math.min(age/350,(SMOKE_LIGHT_MS-age)/350)):phase==='puffing'?rise(Math.min(age/450,(1900-age)/500)):0;
 return {phase,age,lift,active:phase==='lighting'||phase==='puffing'||phase==='ready'};
}

export function cigaretteModel(kit:Workshop,parent:T.Object3D){
 const group=new T.Group();parent.add(group);
 const tube=(r:number,length:number,z:number,color:string)=>{const mesh=kit.cylinder(group,r,r,length,0,0,z,color);mesh.rotation.x=Math.PI/2;return mesh;};
 tube(.007,.031,.008,'#c5935c');tube(.0068,.077,.062,'#f2e8d8');
 for(const z of [.022,.025])tube(.0071,.001,z,'#c3af86');
 for(let i=0;i<5;i++){const fleck=kit.sphere(group,.0009,Math.sin(i*2.4)*.007,.004,.002+i*.005,'#e7c99a',1,.7,1);fleck.castShadow=false;}
 const ash=tube(.0072,.008,.103,'#b8b2a7');
 const ember=kit.sphere(group,.0078,0,0,.108,'#cf6533',1,1,.55);
 const glow=new T.MeshBasicMaterial({color:'#ed793d',transparent:true,opacity:.6,depthWrite:false});
 const heart=kit.mesh(group,new T.SphereGeometry(.006,10,6),glow,0,0,.112);heart.scale.z=.3;
 for(const mesh of group.children)mesh.castShadow=false;
 return {group,tip:new T.Vector3(0,0,.114),update(lit:boolean,pull:number){ash.visible=lit;ember.visible=lit;heart.visible=lit;glow.opacity=.38+.62*pull;},dispose(){glow.dispose();}};
}

const smokeTextures=new WeakMap<Workshop,T.Texture>();
export function smokePlume(kit:Workshop,parent:T.Object3D){
 const group=new T.Group();parent.add(group);group.visible=false;
 let texture=smokeTextures.get(kit);
 if(!texture){
  texture=kit.texture(ctx=>{const g=ctx.createRadialGradient(64,64,2,64,64,62);g.addColorStop(0,'rgba(239,244,240,.45)');g.addColorStop(.45,'rgba(227,236,233,.24)');g.addColorStop(1,'rgba(231,240,236,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);},128,128);
  smokeTextures.set(kit,texture);
 }
 const particles=Array.from({length:10},()=>{const material=new T.SpriteMaterial({map:texture,transparent:true,depthWrite:false,opacity:0}),sprite=new T.Sprite(material);sprite.raycast=()=>{};sprite.renderOrder=4;group.add(sprite);return sprite;});
 const direction=new T.Vector3();
 return {group,update(origin:T.Vector3,yaw:number,age:number,reduced:boolean,strength=1){
  group.visible=age>=1100&&age<SMOKE_PUFF_MS;
  if(!group.visible)return;
  direction.set(Math.sin(yaw),.18,Math.cos(yaw));
  particles.forEach((p,i)=>{
   const t=(age-1100-i*70)/1500;
   p.visible=t>0&&t<1&&(!reduced||i<2);
   if(!p.visible)return;
   const travel=reduced?.14:t*.72;
   p.position.copy(origin).addScaledVector(direction,travel);
   p.position.y+=(reduced?.07:t*t*.35)+Math.sin(i*2.4)*.018;
   p.position.x+=Math.sin(i*2.4)*(reduced?.025:t*.09);
   const size=reduced?.13:.055+t*.28;p.scale.set(size,size*.72,1);
   (p.material as T.SpriteMaterial).opacity=(reduced?.18:.37)*strength*Math.sin(t*Math.PI);
  });
 },hide(){group.visible=false;},dispose(){particles.forEach(p=>(p.material as T.SpriteMaterial).dispose());group.removeFromParent();}};
}
