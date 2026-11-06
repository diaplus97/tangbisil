import * as T from 'three';
import {Workshop} from './assets';
import {softBox,rod,seam,contactShadow} from './detailGeometry';
import type {RoomSurfaces} from './surfaces';

function roundedLoop(w:number,h:number,r:number){
  const points:T.Vector2[]=[];
  for(let corner=0;corner<4;corner++){
    const cx=corner===0||corner===3?w/2-r:-w/2+r,cy=corner<2?h/2-r:-h/2+r;
    for(let j=0;j<9;j++){const a=corner*Math.PI/2+j*Math.PI/16;points.push(new T.Vector2(cx+Math.cos(a)*r,cy+Math.sin(a)*r));}
  }return points;
}
export function chair(kit:Workshop,parent:T.Object3D,s:RoomSurfaces,color=0){
  const g=new T.Group();parent.add(g);const cloth=s.fabrics[color],thread=s.seamColors[color];
  const frame=softBox(kit,g,.67,.075,.6,.02,s.wood);frame.position.y=.545;
  // Legs terminate inside the timber chassis; their foot pads touch the floor.
  for(const x of [-1,1])for(const z of [-1,1]){
    const foot=new T.Vector3(x*.315,.012,z*.3),top=new T.Vector3(x*.255,.585,z*.225);
    rod(kit,g,foot,top,.035,.046,s.wood);
    kit.cylinder(g,.035,.035,.034,foot.x,-.007,foot.z,'#858577');
    contactShadow(kit,g,foot.x,foot.z,.19,.19,.45);
  }
  const seat=softBox(kit,g,.79,.18,.75,.085,cloth);seat.position.set(0,.645,.015);
  seam(kit,g,roundedLoop(.75,.71,.16).map(p=>new T.Vector3(p.x,.645,p.y+.015)),thread,.0035,true);
  const back=new T.Group();back.position.set(0,.97,-.28);back.rotation.x=-.1;g.add(back);
  const shell=softBox(kit,back,.8,.63,.17,.08,cloth);
  // The back upholstery extends into the seat rather than floating over it.
  shell.position.y=-.015;
  for(const z of [-.081,.081])seam(kit,back,roundedLoop(.745,.56,.17).map(p=>new T.Vector3(p.x,p.y-.015,z)),thread,.0034,true);
  for(const x of [-.335,.335]){
    const arm=softBox(kit,g,.15,.23,.53,.072,cloth);arm.position.set(x,.805,-.025);arm.rotation.x=-.035;
    seam(kit,g,[new T.Vector3(x,.82,.23),new T.Vector3(x,.91,.13),new T.Vector3(x,.93,-.13),new T.Vector3(x,.9,-.25)],thread,.003);
  }
  contactShadow(kit,g,0,0,1.12,1.04,.18);return g;
}

function bagPoint(phi:number,theta:number){
  const sy=Math.cos(phi),ring=Math.sin(phi),rear=Math.max(0,-Math.sin(theta));
  const fold=Math.sin(theta*8+.6)*.018+Math.sin(theta*17+phi*4)*.008;
  const radius=ring*(1+fold*Math.sin(phi)*3);
  const x=Math.cos(theta)*radius*.66*(1+.035*Math.sin(theta*3));
  const z=Math.sin(theta)*radius*.71;
  let y=.425+sy*.425;
  if(sy>0){
    // A depressed seat, raised rear bolster and sagging front lip.
    y-=.43*Math.exp(-(x*x/ .21+(z-.12)*(z-.12)/.25))*sy*sy;
    y+=rear*.45*ring*sy*sy; y-=Math.max(0,Math.sin(theta))*.1*ring*sy*sy;
    y+=Math.sin(theta*8+ring*1.2)*.018*Math.pow(ring,1.6)*sy*sy;
  }
  y=Math.max(-.024,y-.12*Math.pow(Math.max(0,-sy),2));return new T.Vector3(x,y,z);
}
export function beanbag(kit:Workshop,parent:T.Object3D,s:RoomSurfaces){
  const g=new T.Group();parent.add(g);const segments=112,rings=64,p:number[]=[],uv:number[]=[],indices:number[]=[];
  for(let j=0;j<=rings;j++)for(let i=0;i<=segments;i++){
    const v=bagPoint(j/rings*Math.PI,i/segments*Math.PI*2);p.push(v.x,v.y,v.z);uv.push(i/segments*2.8,j/rings*1.5);
    if(j<rings&&i<segments){const a=j*(segments+1)+i,b=a+segments+1;indices.push(a,a+1,b,b,a+1,b+1);}
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(p,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  // Parameter winding is outward; weld the duplicated poles only through normals.
  kit.mesh(g,geometry,s.fabrics[2]);
  for(let panel=0;panel<8;panel++){
    const theta=panel*Math.PI/4,points=[];
    for(let i=1;i<=36;i++){const v=bagPoint(.08+i/36*Math.PI*.78,theta);v.multiplyScalar(1.005);points.push(v);}
    seam(kit,g,points,s.seamColors[2],.003);
  }
  const hem=[];for(let i=0;i<64;i++)hem.push(bagPoint(Math.PI*.66,i/64*Math.PI*2).multiplyScalar(1.006));
  seam(kit,g,hem,s.seamColors[2],.0045,true);
  // Woven grab tab and a short concealed zip on the rear panel.
  const tab=softBox(kit,g,.13,.025,.08,.008,s.seamColors[2]);tab.position.set(0,.54,-.58);tab.rotation.x=.45;
  const zipPoints=[];for(let i=0;i<12;i++)zipPoints.push(bagPoint(1.48+i*.022,Math.PI*1.5).multiplyScalar(1.01));
  seam(kit,g,zipPoints,s.seamColors[2],.005);
  contactShadow(kit,g,0,0,1.65,1.75,.42);return g;
}

export function loungePillow(kit:Workshop,parent:T.Object3D,s:RoomSurfaces){
  const g=new T.Group();parent.add(g);
  const pillow=softBox(kit,g,.42,.34,.15,.07,s.fabrics[2]);
  // Slightly pinched corners and a stitch line keep this from reading as a slab.
  const pos=pillow.geometry.getAttribute('position');
  for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i);pos.setZ(i,pos.getZ(i)*(1-.2*Math.abs(x/.21)*Math.abs(y/.17)));}
  pillow.geometry.computeVertexNormals();
  seam(kit,g,roundedLoop(.39,.31,.07).map(p=>new T.Vector3(p.x,p.y,.012)),s.seamColors[2],.0025,true);
  return g;
}
