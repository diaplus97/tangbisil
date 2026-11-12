import * as T from 'three';
import {Workshop,consolidate} from './assets';
import {softFormGeometry,type SoftSection} from './softForm';

// Elliptical sections keep the forearm, wrist and palm continuous without a tube silhouette.
const softForm=(kit:Workshop,parent:T.Group,sections:SoftSection[],material:T.Material)=>kit.mesh(parent,softFormGeometry(sections),material);

export function smokingHand(kit:Workshop,sleeve:T.Material,grip:'cigarette'|'lighter'){
 const hand=new T.Group(),skin='#deb093',skinMaterial=kit.mat(skin,.85);
 softForm(kit,hand,[[-.52,.23,.13,.072,.041],[-.29,.105,.09,.061,.039],[-.16,.043,.047,.047,.032],[-.09,.009,.023,.037,.026],[-.078,.006,.020,.036,.025]],sleeve);
 softForm(kit,hand,[[-.089,.008,.022,.038,.027],[-.083,.006,.021,.038,.027],[-.062,.003,.018,.033,.024],[-.058,.002,.017,.032,.023]],kit.mat('#e6dcca',.93));
 softForm(kit,hand,[[-.066,.002,.017,.028,.020],[-.033,0,.014,.026,.018],[-.010,0,.011,.030,.019],[.017,.001,.008,.036,.020],[.037,.002,.005,.032,.017],[.046,.002,.002,.022,.012]],skinMaterial);
 const finger=(points:number[][],radius=.008)=>{
  kit.tube(hand,points.map(p=>new T.Vector3(...p as [number,number,number])),radius,skin);
  const [x,y,z]=points.at(-1)!;const tip=kit.mesh(hand,new T.SphereGeometry(radius,8,6),skinMaterial,x,y,z);tip.scale.z=.92;
 };
 if(grip==='cigarette'){
  finger([[-.022,.027,0],[-.024,.054,-.007],[-.007,.074,-.023],[.012,.069,-.030]],.008);
  finger([[.001,.032,.002],[.003,.058,.007],[.024,.071,-.007],[.036,.056,-.020]],.0085);
  finger([[.020,.024,.006],[.029,.044,-.002],[.025,.042,-.028],[.012,.026,-.029]],.0085);
  finger([[.034,.015,.007],[.043,.031,-.003],[.036,.028,-.023],[.025,.014,-.022]],.0075);
  finger([[-.026,-.006,.014],[-.043,.016,.016],[-.030,.038,.010],[-.012,.045,-.006]],.011);
  for(const [x,y,z]of [[.010,.073,-.027],[.034,.060,-.016]])kit.sphere(hand,.006,x,y,z,'#eac4ad',1,.27,.8);
 }else{
  for(let i=0;i<4;i++){const y=.051-i*.017;finger([[.025,y-.008,.010],[.030,y,-.014],[.013,y+.002,-.036],[-.009,y,-.033]],i===3?.007:.0085);}
  finger([[-.027,-.004,.015],[-.036,.023,.010],[-.018,.064,-.006],[.003,.073,-.014]],.010);
 }
 consolidate(hand,kit);hand.traverse(o=>{o.castShadow=false;});return hand;
}

export function lighterModel(kit:Workshop,parent:T.Object3D){
 const group=new T.Group();parent.add(group);
 kit.box(group,.032,.056,.022,0,0,0,'#78958a',.007);
 kit.box(group,.032,.015,.023,0,.034,0,'#c2bfae',.003);
 const wheel=kit.mesh(group,new T.CylinderGeometry(.007,.007,.012,12),kit.mat('#69716b',.5),.009,.043,0);wheel.rotation.z=Math.PI/2;
 kit.mesh(group,new T.BoxGeometry(.009,.004,.012),kit.mat('#69716b',.5),-.009,.043,0);
 consolidate(group,kit);return{group,flameTip:new T.Vector3(-.007,.072,0)};
}

export function smokingTableModel(kit:Workshop,parent:T.Group){
 const base=new T.Group();parent.add(base);
 const profile=[[0,-.018],[.225,-.018],[.234,-.014],[.238,-.007],[.238,.002],[.233,.008],[0,.008]].map(([r,y])=>new T.Vector2(r,y));
 kit.mesh(base,new T.LatheGeometry(profile,32),kit.mat('#cfba98',.65));
 kit.cylinder(base,.226,.226,.003,0,.008,0,'#dfcfb3');
 kit.cylinder(base,.018,.026,.94,0,-.493,0,'#7e8980');
 kit.mesh(base,new T.LatheGeometry([[0,-1.008],[.14,-1.008],[.149,-1],[.14,-.984],[.026,-.979]].map(p=>new T.Vector2(...p as [number,number])),24),kit.mat('#7e8980',.85));
 return base;
}

export function ashtrayModel(kit:Workshop,parent:T.Group){
 const tray=new T.Group();parent.add(tray);
 const profile=[[0,.002],[.067,.002],[.080,.006],[.086,.015],[.086,.024],[.081,.029],[.075,.026],[.071,.014],[.060,.009],[0,.009]].map(([r,y])=>new T.Vector2(r,y));
 const bowl=new T.LatheGeometry(profile,48),p=bowl.getAttribute('position');
 // Two shallow rests are cut into the ceramic rim itself.
 for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);if(y>.014&&Math.abs(z)>.069){const notch=(1-T.MathUtils.smoothstep(Math.abs(x),.003,.015))*T.MathUtils.smoothstep(y,.014,.024);p.setY(i,y-notch*.009);}}
 bowl.computeVertexNormals();kit.mesh(tray,bowl,kit.mat('#bcc9bf',.3));
 kit.cylinder(tray,.061,.061,.002,0,.010,0,'#a4b7aa');consolidate(tray,kit);
 return tray;
}

export function cigarettePack(kit:Workshop,parent:T.Group){
 const pack=new T.Group();parent.add(pack);
 kit.box(pack,.080,.099,.034,0,.050,0,'#e9e1cd',.004);
 kit.box(pack,.081,.055,.035,0,.030,0,'#92a396',.004);
 kit.mesh(pack,new T.BoxGeometry(.065,.002,.024),kit.mat('#b6ae97'),0,.101,0);
 const lid=kit.box(pack,.081,.025,.035,0,.112,-.024,'#e9e1cd',.003);lid.rotation.x=-.65;
 for(let i=0;i<3;i++){
  kit.cylinder(pack,.005,.005,.033,-.023+i*.023,.108,.004,'#f1e7d5');
  kit.cylinder(pack,.0051,.0051,.015,-.023+i*.023,.124,.004,'#c49c6b');
 }
 consolidate(pack,kit);return pack;
}
