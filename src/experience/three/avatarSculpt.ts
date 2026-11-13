import * as T from 'three';
import {Workshop,consolidate} from './assets';
import {appearance,avatarDimensions} from '../../../shared/appearance.mjs';

type Look=ReturnType<typeof appearance>;
type Ring=[y:number,rx:number,rz:number,z?:number,x?:number];
type XYZ=[number,number,number];
export const avatarProportions=avatarDimensions;
const tau=2*Math.PI,skin='#deb093',warmSkin='#c59178';
const shade=(hex:string,light:number,hue=0)=>'#'+new T.Color(hex).offsetHSL(hue,0,light).getHexString();

function tintedMesh(kit:Workshop,p:T.Group,geo:T.BufferGeometry,hex:string,fabric=false,x=0,y=0,z=0){
 const key=fabric?'avatar-knit':'avatar-matte';
 let material=kit.materials.get(key);
 if(!material){
  material=new T.MeshStandardMaterial({vertexColors:true,roughness:fabric?.98:.84});
  if(fabric){
   const weave=kit.texture(ctx=>{
    ctx.fillStyle='#888';ctx.fillRect(0,0,64,64);ctx.lineWidth=1.25;
    for(let row=0;row<8;row++)for(let col=-1;col<9;col++){
     const x=col*8+(row%2)*4,y=row*8;ctx.strokeStyle='#adadad';ctx.beginPath();
     ctx.moveTo(x,y);ctx.quadraticCurveTo(x+1,y+4,x+3.5,y+6);ctx.quadraticCurveTo(x+6,y+4,x+7,y);ctx.stroke();
    }
   },64,64);
   weave.wrapS=weave.wrapT=T.RepeatWrapping;weave.repeat.set(6,3);
   material.bumpMap=weave;material.bumpScale=.0014;
  }
  kit.materials.set(key,material);
 }
 const shade=new T.Color(hex),n=geo.getAttribute('position').count,colors=new Float32Array(n*3);
 for(let i=0;i<n;i++)shade.toArray(colors,i*3);
 geo.setAttribute('color',new T.BufferAttribute(colors,3));
 return kit.mesh(p,geo,material,x,y,z);
}

// Continuous oval cross sections keep the cloth round at the side, with a
// separately shaped front, seat and hem. The seam wraps onto the same vertices.
function surface(kit:Workshop,parent:T.Group,color:string,rows:number,sides:number,
  point:(row:number,angle:number)=>XYZ,fabric=false){
  const positions:number[]=[],uv:number[]=[],index:number[]=[];
  for(let r=0;r<rows;r++)for(let i=0;i<sides;i++){
    positions.push(...point(r,tau*i/sides));uv.push(i/sides,r/(rows-1));
    if(r===rows-1)continue;
    const a=r*sides+i,b=r*sides+(i+1)%sides;
    index.push(a,b,a+sides,b,b+sides,a+sides);
  }
  for(let i=1;i<sides-1;i++){index.push(0,i+1,i);const t=(rows-1)*sides;index.push(t,t+i,t+i+1);}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(index);geo.computeVertexNormals();
  return tintedMesh(kit,parent,geo,color,fabric);
}
function form(kit:Workshop,p:T.Group,color:string,rings:Ring[],ribs=0,fabric=color!==skin){
  return surface(kit,p,color,rings.length,ribs?64:24,(row,a)=>{
    const [y,rx,rz,z=0,x=0]=rings[row],r=1+(ribs?.014*Math.cos(28*a):0);
    return [x+rx*Math.sin(a)*r,y,z+rz*Math.cos(a)*r];
  },fabric);
}
function seam(kit:Workshop,p:T.Group,color:string,r:number,...pts:XYZ[]){
  return tintedMesh(kit,p,new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(v=>new T.Vector3(...v))),Math.max(5,pts.length*2),r,5,false),color);
}
function oval(kit:Workshop,p:T.Group,color:string,x:number,y:number,z:number,rx:number,ry:number,rz:number){
  const mesh=tintedMesh(kit,p,new T.SphereGeometry(1,16,12),color,false,x,y,z);mesh.scale.set(rx,ry,rz);return mesh;
}
// Bake color into vertices on the rigid anatomical segments. Eyelids, held
// props and moving joints stay independent. Static trims share a draw call.
function batch(kit:Workshop,joint:T.Group){
 const rigid=new T.Group();joint.add(rigid);
 for(const o of [...joint.children])if(o instanceof T.Mesh)rigid.add(o);
 if(rigid.children.length)consolidate(rigid,kit);else rigid.removeFromParent();
}

// A lock is a broad strand that follows the scalp normal and narrows into
// the neighbouring wave. Its cross section stays flattened against the head.
function lock(kit:Workshop,head:T.Group,hex:string,points:XYZ[],width:number,thickness:number){
 const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));
 const centers=curve.getPoints(16);
 const frames=centers.map((p,i)=>{
  const tangent=curve.getTangent(i/16),normal=new T.Vector3(p.x/.25,(p.y-.024)/.26,p.z/.23).normalize();
  const side=tangent.clone().cross(normal).normalize();
  return {side,normal:side.clone().cross(tangent).normalize()};
 });
 surface(kit,head,hex,17,12,(i,a)=>{
  const t=i/16,size=.08+.92*Math.pow(Math.sin(t*Math.PI),.66);
  const v=centers[i].clone().addScaledVector(frames[i].side,width*size*Math.sin(a)).addScaledVector(frames[i].normal,thickness*size*Math.cos(a));
  return [v.x,v.y,v.z];
 });
}

function hairStyle(kit:Workshop,head:T.Group,l:Look){
 const hair=l.hair,part=l.part,cut=l.cut;
 // A side part sweeps into the temple; large shallow flutes travel around
 // the skull into a scalloped bob or a swept-up nape.
 surface(kit,head,hair,23,64,(r,a)=>{
  const t=1-r/22,front=Math.cos(a),side=Math.sin(a)*part;
  const fringe=.96+.25*Math.exp(-((side+.45)**2)/.16)-.10*side;
  const nape=l.bun?1.98:2.22+cut*.13;
  const edge=T.MathUtils.lerp(nape,fringe,T.MathUtils.smoothstep(front,-.12,.82));
  const theta=.009+t*edge;
  const waves=l.bun?9:6;
  const crest=Math.cos(waves*a+part*(l.bun?2.6:1.15)*t+(l.bun?0:1.35)*Math.sin(5*t));
  const flare=l.bun?0:.14*T.MathUtils.smoothstep(t,.50,.96)*(1-Math.max(0,front));
  const radius=Math.sin(theta)*(1+flare+(l.bun?.025:.062)*crest*Math.sin(t*Math.PI/2));
  return [.252*Math.sin(a)*radius+part*.017*(1-t),.039+.266*Math.cos(theta)+(l.bun?.009:.023)*crest*t*t,-.007+.238*Math.cos(a)*radius];
 });
 const strand=shade(hair,.018);
 lock(kit,head,strand,[[part*.049,.295,.045],[-part*.018,.27,.119],[-part*.107,.208,.174],[-part*.18,.135,.162],[-part*.212,.065,.119],[-part*.222,.009,.057]],.038,.016);
 lock(kit,head,hair,[[part*.052,.291,.047],[part*.128,.24,.136],[part*.18,.167,.157],[part*.213,.087,.127],[part*.224,.007,.068]],.035,.019);
 if(l.bun){
  const bun=new T.Group();head.add(bun);bun.position.set(part*.042,-.045+.018*cut,-.224);bun.rotation.z=part*.3;
  surface(kit,bun,hair,17,36,(r,a)=>{const t=r/16,angle=Math.PI*(1-t),v=Math.sin(angle)*(1+.055*Math.cos(7*a+4*t));return [.113*v*Math.sin(a),.109*Math.cos(angle),.106*v*Math.cos(a)];});batch(kit,bun);
 }else{
  for(const s of [-1,1]){
   lock(kit,head,hair,[[s*.167,.184,.114],[s*.223,.103,.102],[s*.24,.02,.053],[s*.216,-.046,.056],[s*.224,-.10,.004],[s*.180,-.160-.012*cut,-.059]],.055,.034);
   lock(kit,head,shade(hair,.022),[[s*.040,.235,-.158],[s*.088,.171,-.211],[s*.117,.093,-.220],[s*.087,.01,-.249],[s*.12,-.068,-.208],[s*.075,-.14-.012*cut,-.169]],.067,.026);
   lock(kit,head,strand,[[s*.149,.196,-.128],[s*.216,.10,-.126],[s*.23,.012,-.10],[s*.204,-.063,-.117],[s*.19,-.124,-.10],[s*.153,-.168-.009*cut,-.103]],.056,.025);
  }
 }
}
function face(kit:Workshop,body:T.Group,l:Look){
 const head=new T.Group();head.name='avatar-head';head.position.set(0,avatarProportions.headY,.012);head.scale.setScalar(avatarProportions.headScale);body.add(head);
 form(kit,head,skin,[[-.226,.058,.068,.028],[-.214,.116,.111,.025],[-.179,.161,.155,.02],[-.115,.199,.177,.015],[-.05,.219,.196,.01],[.03,.225,.2],[.10,.214,.192],[.18,.17,.158],[.237,.087,.083],[.253,.015,.018]]);
 for(const s of [-1,1]){
  const ear=oval(kit,head,skin,s*.214,-.028,.01,.042,.059,.04);ear.rotation.x=-.20;
  oval(kit,head,warmSkin,s*.246,-.025,.015,.009,.029,.019);
  seam(kit,head,l.hair,.007,[s*.055,.061,.190],[s*.092,.072,.177],[s*.126,.06,.161]);
 }
 // The profile of the bridge and rounded nose tip is visible in a side view.
 const bridge=oval(kit,head,skin,0,-.02,.187,.029,.050,.025);bridge.rotation.x=-.23;
 oval(kit,head,skin,0,-.049,.201,.029,.023,.025);
 seam(kit,head,'#8b5b51',.0055,[-.032,-.116,.181],[0,-.122,.185],[.034,-.112,.18]);
 hairStyle(kit,head,l);batch(kit,head);
 const eyes=[-1,1].map(s=>{const eye=oval(kit,head,'#382e2a',s*.081,.008,.195,.017,.023,.009);eye.name='avatar-eye-'+(s<0?'left':'right');eye.rotation.y=s*.30;return eye;});
 return {head,eyes};
}
function clothing(kit:Workshop,body:T.Group,l:Look){
 const coat=l.coat,dark=shade(coat,-.047),cream='#e7d4b5';
 const hem=.018-.046*l.hem;
 form(kit,body,coat,[[hem,.213,.155],[.065,.236,.181,-.008],[.16,.25,.183,-.008],[.29,.239,.177],[.41,.247,.178],[.47,.26,.164],[.512,.245,.142],[.552,.179,.109],[.574,.097,.087]]);
 form(kit,body,dark,[[hem-.003,.211,.154],[hem+.008,.222,.167],[hem+.057,.235,.18],[hem+.066,.232,.179]],1);
 form(kit,body,skin,[[.51,.084,.078],[.59,.076,.074],[.68,.086,.078,.007]]);
 if(l.quilt){
  for(const [y,rx,rz] of [[.128,.25,.192],[.247,.247,.186],[.366,.247,.184],[.463,.251,.164]]){
   form(kit,body,coat,[[y-.053,rx*.974,rz*.97],[y-.041,rx*.99,rz*1.02],[y-.012,rx*1.045,rz*1.08],[y+.027,rx*1.032,rz*1.065],[y+.050,rx*.971,rz*.97]]);
   seam(kit,body,shade(coat,-.034),.0045,[-rx*.88,y-.052,-rz*.49],[-rx*.52,y-.058,-rz*.91],[0,y-.059,-rz*1.02],[rx*.52,y-.058,-rz*.91],[rx*.88,y-.052,-rz*.49]);
  }
  for(const side of [-1,1])seam(kit,body,shade(coat,-.022),.004,[side*.094,.496,-.147],[side*.090,.39,-.183],[side*.088,.26,-.186],[side*.087,.14,-.193],[side*.081,.071,-.178]);
  form(kit,body,dark,[[.528,.121,.102],[.55,.113,.097],[.609,.097,.083]]);
  seam(kit,body,dark,.006,[0,.545,.115],[0,.438,.174],[0,.24,.19],[0,.064,.18]);
 }else{
  const rows=[[.304,.004,.179],[.367,.039,.180],[.41,.065,.180],[.47,.089,.167],[.512,.098,.146],[.547,.082,.117],[.561,.066,.104]];
  const xyz:number[]=[],uv:number[]=[],indices:number[]=[];
  const piping:XYZ[]=[];
  for(const [i,[y,width,depth]] of rows.entries()){
   for(let j=0;j<=8;j++){
    const x=width*(j/4-1),z=.004+depth*Math.sqrt(1-(x/.239)**2);
    xyz.push(x,y,z);uv.push(j/8,i/6);
    if(j===8)piping.push([x,y,z]);
    if(i<rows.length-1&&j<8){const k=i*9+j;indices.push(k,k+1,k+9,k+1,k+10,k+9);}
   }
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(xyz,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();
  tintedMesh(kit,body,geo,cream,true);
  for(const side of [-1,1])seam(kit,body,dark,.010,[side*.008,.060,.177],[side*.008,.19,.181],...piping.map(([x,y,z]):XYZ=>[side*x,y,z+.003]));
  for(const y of [.27,.175,.085])oval(kit,body,'#71584a',.023,y,.184,.012,.012,.004);
 }
 batch(kit,body);return {coat,cream};
}
function makeArm(kit:Workshop,body:T.Group,side:number,l:Look,coat:string,cream:string){
 const shoulder=new T.Group();shoulder.position.set(side*.229,.482,.005);body.add(shoulder);
 const elbow=new T.Group();elbow.position.y=-.29;shoulder.add(elbow);
 const wrist=new T.Group();wrist.position.y=-.27;elbow.add(wrist);
 const sleeve=l.quilt||l.choice===1?l.sleeve:coat;
 form(kit,shoulder,sleeve,[[-.335,.071,.075],[-.303,.092,.095],[-.243,.095,.1],[-.139,.10,.111],[-.048,.112,.118],[.012,.104,.108],[.055,.069,.079],[.069,.023,.038]]);
 form(kit,elbow,sleeve,[[-.146,.074,.076],[-.124,.089,.089],[-.093,.095,.093],[-.056,.091,.095],[.002,.089,.090],[.054,.067,.070],[.068,.025,.035]]);
 form(kit,elbow,cream,[[-.163,.074,.072],[-.158,.082,.079],[-.103,.089,.085],[-.096,.085,.082]],1);
 form(kit,elbow,skin,[[-.292,.042,.041],[-.246,.046,.047],[-.186,.061,.059],[-.135,.067,.066]]);
 const open=new T.Group(),grip=new T.Group();wrist.add(open,grip);
 for(const [hand,closed] of [[open,false],[grip,true]] as const){
  oval(kit,hand,skin,0,-.031,.007,.041,.062,.050);
  for(let f=0;f<4;f++){
   const z=.036-f*.022,len=.039-.006*Math.abs(f-1);
   const finger=oval(kit,hand,skin,closed?-side*.018:-side*.004,closed?-.067:-.076,z,.021,len,.0155);
   finger.rotation.z=side*(closed?-1.0:-.18);
  }
  const thumb=oval(kit,hand,skin,-side*(closed?.035:.032),-.043,.051,.021,.039,.023);
  thumb.rotation.z=-side*.52;thumb.rotation.x=closed?-.52:-.28;batch(kit,hand);
 }
 batch(kit,shoulder);batch(kit,elbow);return {shoulder,elbow,wrist,open,grip};
}
function makeLeg(kit:Workshop,group:T.Group,side:number,l:Look){
 const hip=new T.Group(),knee=new T.Group(),ankle=new T.Group();group.add(hip);hip.add(knee);knee.add(ankle);
 ankle.name='avatar-ankle-'+(side<0?'left':'right');
 hip.position.x=side*.119;knee.position.y=-avatarProportions.legUpper;ankle.position.y=-avatarProportions.legLower;
 const color=l.pants;
 form(kit,hip,color,[[-.478,.087,.091,.003],[-.439,.10,.107,.007],[-.354,.102,.112],[-.224,.111,.119],[-.088,.122,.135,-.012],[.008,.127,.146,-.015],[.084,.108,.123]]);
 form(kit,knee,color,[[-.53,.087,.095,.003],[-.517,.098,.108,.006],[-.484,.101,.108,.002],[-.385,.093,.099,-.004],[-.223,.091,.105,-.009],[-.09,.101,.11],[.01,.103,.106],[.059,.074,.081],[.071,.023,.029]]);
 const shoe=shade(l.shoe,l.tone*.04),sole='#c9bcaa';
 form(kit,ankle,'#b89d86',[[-.05,.061,.065],[.034,.061,.065],[.085,.063,.066]]);
 form(kit,ankle,sole,[[-.122,.082,.148,.07],[-.118,.10,.164,.07],[-.093,.104,.168,.07],[-.086,.101,.163,.07]]);
 form(kit,ankle,shoe,[[-.091,.10,.161,.068],[-.073,.101,.163,.068],[-.046,.099,.153,.064],[-.026,.086,.114,.032],[.011,.070,.087,.004],[.019,.060,.068,-.004]]);
 if(!l.quilt)for(let i=0;i<2;i++)seam(kit,ankle,sole,.005,[-.047,-.017-i*.015,.088+i*.026],[0,-.006-i*.015,.087+i*.026],[.045,-.017-i*.015,.09+i*.026]);
 for(const child of hip.children)if(child instanceof T.Mesh)child.geometry.scale(1,avatarProportions.legUpper/.42,1);
 for(const child of knee.children)if(child instanceof T.Mesh)child.geometry.scale(1,avatarProportions.legLower/.55,1);
 batch(kit,hip);batch(kit,knee);batch(kit,ankle);return {hip,knee,ankle,side};
}
export function sculptColleague(kit:Workshop,avatar:number,id:string){
 const look=appearance(avatar,id),group=new T.Group(),body=new T.Group();group.add(body);
 const {coat,cream}=clothing(kit,body,look),{head,eyes}=face(kit,body,look);
 return {group,body,head,eyes,left:makeArm(kit,body,-1,look,coat,cream),right:makeArm(kit,body,1,look,coat,cream),
  legs:[makeLeg(kit,group,-1,look),makeLeg(kit,group,1,look)]};
}
