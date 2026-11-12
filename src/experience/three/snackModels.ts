import * as T from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {Workshop,pie} from './assets';
import {snackDefinition,LEGACY_SNACK_ID,type SnackKind} from '../../../shared/snacks.mjs';

export type FoodIdentity={snack_id?:string;definition_version?:number;bites?:number;portions?:number;state?:string;open_progress?:number};
export function recipe(food?:FoodIdentity|null){return snackDefinition(food?.snack_id??LEGACY_SNACK_ID,food?.definition_version??1)??snackDefinition(LEGACY_SNACK_ID)!;}
function random(seed=17){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
function material(kit:Workshop,kind:SnackKind,section=false,bites=0){
 const key=`snack:${kind}:${section}:${section&&kind==='dubaiCookie'?bites:0}`,cached=kit.materials.get(key);if(cached)return cached;
 const rnd=random(),map=kit.texture(c=>{
  const w=1024,h=1024;c.fillStyle=kind==='fruitMochi'?'#eee9dc':kind==='dubaiCookie'?'#513025':'#77422d';c.fillRect(0,0,w,h);
  if(section&&kind==='fruitMochi'){
   // Authored basic strawberry/red-bean filling. No cream layer or copied artwork.
   c.fillStyle='#eae7dc';c.fillRect(0,0,w,h);c.fillStyle='#694537';c.beginPath();c.moveTo(505,56);c.bezierCurveTo(725,155,977,629,892,858);c.bezierCurveTo(740,1020,252,1020,126,858);c.bezierCurveTo(18,640,308,164,505,56);c.fill();
   for(let i=0;i<12000;i++){const x=rnd()*w,y=rnd()*h;c.fillStyle=i%2?'#9c736333':'#291b1833';c.fillRect(x,y,2+rnd()*3,2+rnd()*2);}
   const red=c.createLinearGradient(0,110,0,920);red.addColorStop(0,'#e96357');red.addColorStop(.55,'#c92f32');red.addColorStop(1,'#a81f29');c.fillStyle=red;c.beginPath();c.moveTo(506,135);c.bezierCurveTo(658,260,825,558,817,789);c.bezierCurveTo(795,933,259,958,216,789);c.bezierCurveTo(187,582,357,275,506,135);c.fill();
   c.strokeStyle='#f5a18c77';for(let i=0;i<75;i++){const y=330+rnd()*500,x=510+(rnd()-.5)*(y-120)*.8;c.lineWidth=1+rnd()*3;c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(510,y+10,510,880);c.stroke();}
   c.fillStyle='#f3cfb4';c.beginPath();c.moveTo(507,210);c.bezierCurveTo(529,503,580,725,625,865);c.quadraticCurveTo(515,930,400,865);c.bezierCurveTo(465,686,491,440,507,210);c.fill();
   for(let i=0;i<130;i++){const a=rnd()*Math.PI*2,x=510+Math.cos(a)*(220+rnd()*35),y=680+Math.sin(a)*190;c.fillStyle='#ffc69b88';c.beginPath();c.ellipse(x,y,2,6,a,0,Math.PI*2);c.fill();}
  }else if(section&&kind==='dubaiCookie'){
   c.fillStyle='#503226';c.fillRect(0,0,w,h);c.save();c.beginPath();const edge=bites===1?.17:-.26;
   for(const side of[-1,1])for(let j=0;j<=100;j++){const t=side===-1?j/100:1-j/100,r=Math.pow(Math.sin(Math.PI*(.17+t*.83)),.58)*.78;let lo=0,hi=r;for(let n=0;n<14;n++){const x=(lo+hi)/2,z=edge+.22*(x/.85)**2;if(x*x+z*z<r*r)lo=x;else hi=x;}const x=512+side*Math.max(0,lo-.025)/1.65*1024,y=(1-t)*1024;if(side===-1&&j===0)c.moveTo(x,y);else c.lineTo(x,y);}c.closePath();c.clip();
   c.fillStyle='#7a792b';c.fillRect(0,0,w,h);
   for(let i=0;i<12500;i++){const x=rnd()*w,y=rnd()*h,a=rnd()*6.28,len=4+rnd()*24;c.strokeStyle=['#b4a448','#d0bc60','#767529','#948e36','#4a5423'][i%5];c.lineWidth=2+rnd()*4;c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+Math.cos(a)*len*.4,y+Math.sin(a)*len*.7,x+Math.cos(a)*len,y+Math.sin(a)*len);c.stroke();}
   c.restore();
  }else if(section&&kind==='layeredMochi'){
   c.fillStyle='#60382e';c.fillRect(0,0,w,h);
   for(let row=0;row<5;row++){const y=85+row*193;c.beginPath();c.moveTo(0,y);for(let x=0;x<=w;x+=8)c.lineTo(x,y+Math.sin(x*.019+row)*6);for(let x=w;x>=0;x-=8)c.lineTo(x,y+72+Math.sin(x*.024+row)*7);c.closePath();c.fillStyle='#c5b5a0';c.fill();c.strokeStyle='#f1e0c52b';c.lineWidth=9;c.stroke();}
   for(let i=0;i<17000;i++){c.fillStyle=i%2?'#e4c0a720':'#2b1a2028';c.fillRect(rnd()*w,rnd()*h,1+rnd()*4,1+rnd()*3);}
  }else{
   for(let i=0;i<26000;i++){c.fillStyle=kind==='fruitMochi'?(i%2?'#fffdf26b':'#beb8ac28'):kind==='dubaiCookie'?(i%2?'#a5735120':'#2d190d28'):(i%2?'#c1835459':'#2c140d52');c.beginPath();c.arc(rnd()*w,rnd()*h,.5+rnd()*2,0,Math.PI*2);c.fill();}
  }
 },1024,1024);
 const m=new T.MeshStandardMaterial({map,roughness:kind==='dubaiCookie'&&!section?.4:.87,bumpMap:map,bumpScale:section?.009:kind==='fruitMochi'?.008:.012});kit.materials.set(key,m);return m;
}
function cutGeometry(kind:SnackKind,bites:number){
 let g:T.BufferGeometry;
 if(kind==='layeredMochi'){g=new RoundedBoxGeometry(1.65,.62,1.13,7,.075);g.translate(0,.31,0);}
 else {
  const rings=32,segments=72,pos:number[]=[],uv:number[]=[],idx:number[]=[],fruit=kind==='fruitMochi',height=fruit?1.22:.77;
  for(let j=0;j<=rings;j++){
   const t=j/rings,y=t*height;
   const radius=fruit?Math.pow(Math.sin(Math.PI*(.07+t*.93)),.66)*(.74-.28*t):Math.pow(Math.sin(Math.PI*(.17+t*.83)),.58)*.78;
   for(let i=0;i<=segments;i++){const a=i/segments*Math.PI*2;pos.push(Math.cos(a)*radius,y,Math.sin(a)*radius*(fruit?.85:1));uv.push(i/segments,t);}
  }
  for(let j=0;j<rings;j++)for(let i=0;i<segments;i++){const a=j*(segments+1)+i,b=a+segments+1;idx.push(a,b,a+1,a+1,b,b+1);}
  g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();
 }
 const source=g,flat=source.index?source.toNonIndexed():source.clone();source.dispose();const p=flat.getAttribute('position'),uv=flat.getAttribute('uv'),normals=flat.getAttribute('normal');flat.clearGroups();
 const faces:number[][]=[[],[]],cut=bites===1?.17:-.26,height=kind==='fruitMochi'?1.22:kind==='dubaiCookie'?.77:.62;
 for(let i=0;i<p.count;i+=3){
  let clipped=0;
  for(let n=0;n<3;n++){const at=i+n,x=p.getX(at),z=p.getZ(at),edge=cut+.22*Math.pow(x/.85,2)+.013*Math.cos(x*27);if(bites>0&&z>edge){p.setZ(at,edge);clipped++;}}
  const section=clipped===3||kind==='layeredMochi'&&Math.abs((normals.getY(i)+normals.getY(i+1)+normals.getY(i+2))/3)<.65;
  if(section)for(let n=0;n<3;n++){uv.setXY(i+n,p.getX(i+n)/1.65+.5,p.getY(i+n)/height);if(clipped===3)normals.setXYZ(i+n,0,0,1);}
  faces[section?1:0].push(i,i+1,i+2);
 }
 flat.setIndex([...faces[0],...faces[1]]);flat.addGroup(0,faces[0].length,0);flat.addGroup(faces[0].length,faces[1].length,1);return flat;
}
/** Every mouthful cuts the solid; scale is never used to stand in for eating. */
export function snackFood(kit:Workshop,parent:T.Object3D,food:FoodIdentity={},overrideBites?:number){
 const r=recipe(food),bites=overrideBites??food.bites??0,g=new T.Group();parent.add(g);
 if(food.state==='empty'&&overrideBites===undefined||bites>=3||food.portions===1&&bites>0)return g;
 if(r.kind==='lemonPie'){pie(kit,g,bites,food.portions===1);return g;}
 const shape=cutGeometry(r.kind,food.portions===1?2:bites);
 for(const part of shape.groups){if(!part.count)continue;const geom=shape.clone();geom.clearGroups();geom.setIndex(Array.from(shape.index!.array.slice(part.start,part.start+part.count)));kit.mesh(g,geom,material(kit,r.kind,part.materialIndex===1,food.portions===1?2:bites));}shape.dispose();
 // Small remnants belong to the filling, not a fountain of generic particles.
 if(bites>0&&r.kind==='dubaiCookie')for(let i=0;i<7;i++){const crumb=kit.box(g,.055,.012,.018,Math.sin(i*31)*.45,.012,.25+Math.cos(i*23)*.18,i%2?'#a99b45':'#78792d',.004);crumb.rotation.y=i*1.7;}
 return g;
}
function paperMat(kit:Workshop,key:string,color:string,ink:string,label:string){
 const cached=kit.materials.get(key);if(cached)return cached;
 const rnd=random(81),texture=kit.texture(c=>{c.fillStyle=color;c.fillRect(0,0,512,512);for(let i=0;i<8000;i++){c.fillStyle=i%2?'#ffffff11':'#24201a0c';c.fillRect(rnd()*512,rnd()*512,1+rnd()*2,1+rnd()*2);}c.strokeStyle=ink+'44';c.lineWidth=1;for(let i=0;i<12;i++){c.beginPath();c.moveTo(i*49,0);c.lineTo(i*41+15,512);c.stroke();}c.fillStyle=ink;c.textAlign='center';c.font='600 33px sans-serif';c.fillText(label,256,268);c.font='14px sans-serif';if(label)c.fillText('잠깐의 달콤한 쉼',256,300);},512,512);
 const m=new T.MeshStandardMaterial({map:texture,side:T.DoubleSide,roughness:.92,bumpMap:texture,bumpScale:.008});kit.materials.set(key,m);return m;
}
/** Original game wrappers. Gathered red paper follows the reference; the sleeve
 * and wax paper are authored packaging, not claims about manufacturers' packs. */
export function snackPackaging(kit:Workshop,parent:T.Object3D,food:FoodIdentity={}){
 const r=recipe(food),group=new T.Group();parent.add(group);
 const red=r.kind==='fruitMochi',slide=r.kind==='layeredMochi',lemon=r.kind==='lemonPie';
 const m=paperMat(kit,'paper:'+r.kind,red?'#b63336':slide?'#eee4d1':lemon?'#e9ddb3':'#e1d9ba',red?'#f3ddbd':slide?'#714b40':lemon?'#486e80':'#637251',slide?'겹겹':lemon?'LEMON':'');
 let update:(progress:number)=>void;
 if(lemon){
  const geom=new T.PlaneGeometry(2.2,1.32,48,8);geom.rotateX(-Math.PI/2);const original=geom.attributes.position.array.slice(),cover=kit.mesh(group,geom,m,0,.35,0);
  const edge=kit.box(group,.11,.03,1.32,1.1,.49,0,'#8da9b6',.006),base=kit.box(group,2.24,.015,1.34,0,.012,0,'#bccbc8',.04);
  const sides=new T.Group();group.add(sides);for(const z of[-.66,.66])kit.mesh(sides,new T.BoxGeometry(2.2,.55,.012),m,0,.275,z);const end=kit.mesh(group,new T.BoxGeometry(.012,.55,1.32),m,-1.1,.275,0);kit.mesh(sides,new T.BoxGeometry(.012,.55,1.32),m,1.1,.275,0);
  update=p=>{cover.visible=edge.visible=sides.visible=p<.999;end.visible=p<.015;sides.scale.x=Math.max(.001,1-p);sides.position.x=p*1.1;base.visible=true;const pos=geom.attributes.position,peel=-1.1+p*2.2;for(let i=0;i<pos.count;i++){const x=original[i*3],z=original[i*3+2],d=Math.max(0,peel-x),r=.16;pos.setXYZ(i,d>0?peel-Math.sin(d/r)*r:x,d>0?.20+r*(1-Math.cos(d/r)):.20,z);}pos.needsUpdate=true;geom.computeVertexNormals();};
 }else if(r.kind==='dubaiCookie'){
  kit.mesh(group,new T.BoxGeometry(1.66,.012,1.66),m,0,.018,0);
  const panels=Array.from({length:4},()=>kit.mesh(group,new T.PlaneGeometry(1,1,20,20),m));
  const seal=kit.mesh(group,new T.CircleGeometry(.13,32),kit.mat('#7c8b61'),0,.96,.01);seal.rotation.x=-Math.PI/2;
  update=p=>{seal.visible=p<.22;seal.position.x=p*.5;seal.position.y=.96+p*.2;
   panels.forEach((panel,j)=>{const open=T.MathUtils.smoothstep(p,.12+(j%2)*.13,.85+(j%2)*.15),pos=panel.geometry.attributes.position,a=j*Math.PI/2;
    for(let i=0;i<pos.count;i++){const u=i%21/20-.5,v=Math.floor(i/21)/20,closedR=1.03*(1-v*v),radius=T.MathUtils.lerp(closedR,.8+v*.70,open),width=T.MathUtils.lerp(2.12*(1-v*v*.5),1.66,open),side=u*width;
     pos.setXYZ(i,Math.cos(a)*radius-Math.sin(a)*side,T.MathUtils.lerp(Math.sin(v*Math.PI/2)*.95,.04,open)+Math.sin(v*25+u*7)*.006,Math.sin(a)*radius+Math.cos(a)*side);
    }pos.needsUpdate=true;panel.geometry.computeVertexNormals();});};
 }else if(slide){
  const sleeve=new T.Group();group.add(sleeve);const top=kit.mesh(sleeve,new T.BoxGeometry(1.76,.018,1.25),m,0,.72,0);top.rotation.y=0;
  for(const z of[-.625,.625])kit.mesh(sleeve,new T.BoxGeometry(1.76,.72,.018),m,0,.36,z);
  kit.mesh(sleeve,new T.BoxGeometry(1.76,.018,1.25),m,0,0,0);
  update=p=>{sleeve.position.x=-Math.min(1,p)*2.05;sleeve.rotation.z=-.04*Math.sin(p*Math.PI);sleeve.visible=p<.999;};
 }else{
  const petals=red?6:lemon?2:4,meshes:T.Mesh[]=[],segments=18,rows=18;
  for(let petal=0;petal<petals;petal++){
   const geom=new T.PlaneGeometry(1,1,segments,rows),mesh=kit.mesh(group,geom,m);meshes.push(mesh);
  }
  const tie=new T.Group();group.add(tie);
  if(red){const band=kit.mesh(tie,new T.TorusGeometry(.145,.025,6,32),kit.mat('#cfb58c'),0,1.4,0);band.rotation.x=Math.PI/2;for(const side of[-1,1]){const bow=kit.mesh(tie,new T.TorusGeometry(.075,.013,5,18),kit.mat('#d8c2a0'),side*.085,1.42,.14);bow.scale.y=.5;}const tag=kit.mesh(tie,new T.BoxGeometry(.20,.26,.007),paperMat(kit,'red-tag','#ecddbd','#765849','쉼'),.17,1.22,.2);tag.rotation.z=-.22;}
  else {const seal=kit.mesh(tie,new T.CircleGeometry(.13,32),kit.mat(lemon?'#93b2b9':'#7f8d61'),0,lemon?.62:.96,.05);seal.rotation.x=-Math.PI/2;}
  update=progress=>{
   const p=Math.max(0,Math.min(1,progress)),open=T.MathUtils.smoothstep(p,red?.18:.08,1);
   tie.visible=p<(red?.28:.22);tie.position.set(p*.4,p*.15,0);tie.rotation.z=p*1.2;
   meshes.forEach((mesh,j)=>{const pos=mesh.geometry.attributes.position;
    for(let i=0;i<pos.count;i++){
     const u=(i%(segments+1))/segments,v=Math.floor(i/(segments+1))/rows;
     const a=(j+(u-.5)*1.01)/petals*Math.PI*2,crease=Math.sin(u*42+j*3)*.027*Math.sin(v*Math.PI)*(1-open*.85);
     const closedR=red?(v<.3?.55+v*.6:v<.85?.73-(v-.3)*1.11:.12+(v-.85)*1.2):(.68*Math.sin(v*Math.PI)+.25*(1-v));
     const radius=closedR*(1-open)+(.12+v*1.38)*open;
     const y=(red?1.6:lemon?.7:1.05)*v*(1-open)+(.04+Math.sin(v*5+j)*.008)*open;
     pos.setXYZ(i,Math.cos(a)*(radius+crease),y+crease,Math.sin(a)*(radius+crease)*(lemon?.67:1));
    }pos.needsUpdate=true;mesh.geometry.computeVertexNormals();});
  };
 }
 update(food.open_progress??0);return{group,update};
}
export function snackModel(kit:Workshop,parent:T.Object3D,food:FoodIdentity={}){
 const group=new T.Group();parent.add(group);snackFood(kit,group,food);
 if(food.state==='sealed')snackPackaging(kit,group,food);
 return group;
}
