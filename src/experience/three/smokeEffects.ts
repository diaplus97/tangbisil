import * as T from 'three';
import {Workshop} from './assets';
import {smokingVisual,type Smoking} from '../../../shared/smoking.mjs';

export function smokeGesture(s:Smoking|null|undefined,now:number){
 return smokingVisual(s,now);
}

export function cigaretteModel(kit:Workshop,parent:T.Object3D){
 const group=new T.Group();parent.add(group);
 const tube=(r:number,length:number,z:number,color:string)=>{const mesh=kit.cylinder(group,r,r,length,0,0,z,color);mesh.rotation.x=Math.PI/2;return mesh;};
 tube(.007,.031,.008,'#c5935c');const paper=tube(.0068,.077,.062,'#f2e8d8');paper.name='cigarette-paper';
 for(const z of [.022,.025])tube(.0071,.001,z,'#c3af86');
 for(let i=0;i<5;i++){const fleck=kit.sphere(group,.0009,Math.sin(i*2.4)*.007,.004,.002+i*.005,'#e7c99a',1,.7,1);fleck.castShadow=false;}
 const ash=tube(.0072,.008,.103,'#b8b2a7');
 const char=tube(.0073,.002,.100,'#655849');
 const ember=kit.sphere(group,.0078,0,0,.108,'#cf6533',1,1,.55);
 const glow=new T.MeshBasicMaterial({color:'#ed793d',transparent:true,opacity:.6,depthWrite:false});
 const heart=kit.mesh(group,new T.SphereGeometry(.006,10,6),glow,0,0,.112);heart.scale.z=.3;
 for(const mesh of group.children)mesh.castShadow=false;
 const tip=new T.Vector3(0,0,.114);
 return {group,tip,update(lit:boolean,pull:number,paperLength=.077,ashLength=.008){
  const end=.0235+paperLength;
  paper.scale.y=paperLength/.077;paper.position.z=.0235+paperLength/2;
  ash.scale.y=ashLength/.008;ash.position.z=end+ashLength/2;ash.visible=lit||paperLength<.077;
  char.position.z=end;char.visible=paperLength<.077||lit;
  ember.position.z=end+.001;heart.position.z=end+.002;ember.visible=lit;heart.visible=lit;glow.opacity=.35+.65*pull;
  tip.set(0,0,end+ashLength+.003);group.userData.paperLength=paperLength;group.userData.ashLength=ashLength;
 },dispose(){glow.dispose();}};
}

const smokeTextures=new WeakMap<Workshop,T.Texture>();
export function smokePlume(kit:Workshop,parent:T.Object3D){
 const group=new T.Group();parent.add(group);group.visible=false;
 let texture=smokeTextures.get(kit);
 if(!texture){
  texture=kit.texture(ctx=>{const g=ctx.createRadialGradient(59,58,3,64,64,62);g.addColorStop(0,'rgba(231,238,233,.82)');g.addColorStop(.38,'rgba(210,224,218,.60)');g.addColorStop(.72,'rgba(181,200,193,.23)');g.addColorStop(1,'rgba(188,208,199,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);},128,128);
  smokeTextures.set(kit,texture);
 }
 group.name='smoke-exhale';
 const sprite=()=>{const material=new T.SpriteMaterial({map:texture,transparent:true,depthWrite:false,opacity:0}),s=new T.Sprite(material);s.raycast=()=>{};s.renderOrder=4;return s;};
 const particles=Array.from({length:12},()=>{const s=sprite();group.add(s);return s;});
 const wisps=new T.Group();wisps.name='smoke-ember';parent.add(wisps);wisps.visible=false;
 const strands=Array.from({length:2},()=>{const s=sprite();wisps.add(s);return s;});
 const direction=new T.Vector3();
 return {group,update(origin:T.Vector3,yaw:number,age:number,reduced:boolean,strength=1){
  group.visible=age>=1250&&age<3900;
  if(!group.visible)return;
  direction.set(Math.sin(yaw),.18,Math.cos(yaw));
  particles.forEach((p,i)=>{
   const t=(age-1250-i*75)/1700;
   p.visible=t>0&&t<1&&(!reduced||i<2);
   if(!p.visible)return;
   const travel=reduced?.22:.10+t*.95;
   p.position.copy(origin).addScaledVector(direction,travel);
   p.position.y+=(reduced?.09:t*t*.32)+Math.sin(i*2.4)*.025;
   p.position.x+=Math.sin(i*2.4)*(reduced?.025:t*.12);
   const size=reduced?.18:.08+t*.36;p.scale.set(size,size*.80,1);
   (p.material as T.SpriteMaterial).opacity=(reduced?.27:.62)*strength*Math.sin(t*Math.PI);
  });
 },ember(origin:T.Vector3,time:number,lit:boolean,reduced:boolean){
  wisps.visible=lit;if(!lit)return;
  strands.forEach((p,i)=>{const t=reduced?.5:(time/2300+i*.5)%1;p.position.copy(origin);p.position.y+=.02+t*.22;p.position.x+=Math.sin(i+t*4)*t*.035;p.scale.set(.025+t*.055,.055+t*.12,1);(p.material as T.SpriteMaterial).opacity=(reduced?.08:.18)*Math.sin(t*Math.PI);});
 },hide(){group.visible=false;wisps.visible=false;},dispose(){[...particles,...strands].forEach(p=>(p.material as T.SpriteMaterial).dispose());group.removeFromParent();wisps.removeFromParent();}};
}
