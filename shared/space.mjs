import {healingSeats,healingTables,healingBounds,healingStations,portals} from './healing.mjs';
import {smokingSeats,smokingTable,smokingBounds,smokingEntrance,smokingExit,smokingCenter} from './smoking.mjs';
export {portals};
export function exitsFrom(area='pantry'){
  if(area==='smoking')return [smokingExit];
  return area==='healing'?[portals.healing]:[portals.pantry,smokingEntrance];
}
// One authoritative map for furniture, destinations and timed movement.
export const tables=[
 {id:'together',name:'함께 앉는 테이블',x:-2.25,z:1,y:1.14,width:1.83,length:3.0},
 {id:'window',name:'창가 테이블',x:2.35,z:-3,y:1.14,width:1.65,length:1.7},
 {id:'quiet',name:'조용한 테이블',x:3.2,z:2.4,y:1.14,width:1.65,length:1.7},
];
export const tableCenter=tables[0];
export const seats=[
 [-3.7,1.75,120*Math.PI/180],[-.8,1.75,-120*Math.PI/180],
 [-3.7,.25,110*Math.PI/180],[-.8,.25,-110*Math.PI/180],
 [.95,-3,112*Math.PI/180],[3.75,-3,-112*Math.PI/180],
 [1.8,2.4,115*Math.PI/180],[4.6,2.4,-115*Math.PI/180],
];
export const seatTables=[0,0,0,0,1,1,2,2];
export const stations={
 candy:{name:'사탕 그릇',x:-7.05,z:-.1,y:1.4,approach:{x:-5.85,z:-.1},yaw:-Math.PI/2},
 coffee:{name:'커피 머신',x:-7.05,z:-2.5,y:1.6,approach:{x:-5.85,z:-2.5},yaw:-Math.PI/2},
 plant:{name:'창가 식물',x:-4.75,z:-5.55,y:1.3,approach:{x:-4.75,z:-4.25},yaw:Math.PI},
 stone:{name:'손놀이 바구니',x:.1,z:5.85,y:.95,approach:{x:.1,z:4.65},yaw:0},
 tea:{name:'차 트레이',x:-7.05,z:1.8,y:1.3,approach:{x:-5.85,z:1.8},yaw:-Math.PI/2},
 fridge:{name:'냉장고',x:-7.05,z:3,y:1.3,approach:{x:-5.8,z:3},yaw:-Math.PI/2},
};
export const approaches=seats.map(([x,z,yaw])=>({x:x-Math.sin(yaw)*.96,z:z-Math.cos(yaw)*.96}));
export const seatedEyeHeight=1.623;
export const seatedHorizontalFov=96;
export function seatedView(seat,area='pantry'){const [x,z,yaw]=getSpace(area).seats[seat],low=area==='healing',offset=low?(seat<4?.02:.1):.19;return{x:x+Math.sin(yaw)*offset,y:low?(seat<4?1.27:1.48):seatedEyeHeight,z:z+Math.cos(yaw)*offset,yaw};}
export const walkBounds={minX:-6.3,maxX:7.25,minZ:-5.3,maxZ:6.8};
const radius=.21;
const shapes=[
 ...tables.map(t=>[t.x-t.width/2,t.x+t.width/2,t.z-t.length/2,t.z+t.length/2]),
 [-5.5,-4,-5.95,-5.05],[-.55,.75,5.45,6.3],
 [-7.8,-6.5,-3.6,2.18],[-7.8,-6.45,2.3,3.7],
 [-6.55,-5.35,3.4,3.85], // Keep the refrigerator door's opening arc clear.
 ...seats.map(([x,z])=>[x-.42,x+.42,z-.42,z+.42]),
 [5.15,6.5,-5.3,-4.1],[4.35,5.5,-4.8,-3.65],
 [-7.15,-6.45,-5.3,-4.6],[6.35,7.05,-5.3,-4.6],
];
export const obstacles=shapes.map(([minX,maxX,minZ,maxZ])=>({minX:minX-radius,maxX:maxX+radius,minZ:minZ-radius,maxZ:maxZ+radius}));
const healingObstacles=[...healingTables.map(t=>[t.x-t.width/2,t.x+t.width/2,t.z-t.length/2,t.z+t.length/2]),...healingSeats.map(([x,z],i)=>[x-(i<4?.64:.47),x+(i<4?.64:.47),z-(i<4?.65:.48),z+(i<4?.65:.48)]),[-4.5,-2.5,3.7,4.4],[-1.5,.5,3.7,4.4],[3.5,4.5,-4.3,-3.3]].map(([minX,maxX,minZ,maxZ])=>({minX:minX-radius,maxX:maxX+radius,minZ:minZ-radius,maxZ:maxZ+radius}));
const spaces={pantry:{id:'pantry',name:'탕비실',seats,tables,seatTables,stations,approaches,walkBounds,obstacles,portal:portals.pantry},healing:{id:'healing',name:'힐링방',seats:healingSeats,tables:healingTables,seatTables:[0,0,1,1,2,2],stations:healingStations,approaches:healingSeats.map(([x,z,yaw])=>({x:x-Math.sin(yaw)*(z>0?1.16:.96),z:z-Math.cos(yaw)*(z>0?1.16:.96)})),walkBounds:healingBounds,obstacles:healingObstacles,portal:portals.healing}};
spaces.smoking={id:'smoking',name:'흡연실',seats:smokingSeats,tables:[],seatTables:[],stations:{},
 approaches:smokingSeats.map(([x,z,yaw])=>({x:x-Math.sin(yaw)*.92,z:z-Math.cos(yaw)*.92})),
 walkBounds:smokingBounds,obstacles:[...smokingSeats.map(([x,z])=>({minX:x-.51,maxX:x+.51,minZ:z-.52,maxZ:z+.52})),
 {minX:smokingCenter.x-smokingCenter.radius-radius,maxX:smokingCenter.x+smokingCenter.radius+radius,minZ:smokingCenter.z-smokingCenter.radius-radius,maxZ:smokingCenter.z+smokingCenter.radius+radius},
 ...smokingSeats.slice(4).map((_,i)=>{const t=smokingTable(i+4);return{minX:t.x-.35,maxX:t.x+.35,minZ:t.z-.35,maxZ:t.z+.35};}),
 ...[[-3.93,-3.55],[3.8,-3.57]].map(([x,z])=>({minX:x-.48,maxX:x+.48,minZ:z-.48,maxZ:z+.48}))],portal:smokingExit};
export function getSpace(area='pantry'){return area==='healing'||area==='smoking'?spaces[area]:spaces.pantry;}
export function isWalkable(p,area='pantry'){const {walkBounds,obstacles}=getSpace(area);return typeof p?.x==='number'&&typeof p?.z==='number'&&Number.isFinite(p.x)&&Number.isFinite(p.z)&&p.x>=walkBounds.minX&&p.x<=walkBounds.maxX&&p.z>=walkBounds.minZ&&p.z<=walkBounds.maxZ&&!obstacles.some(o=>p.x>o.minX&&p.x<o.maxX&&p.z>o.minZ&&p.z<o.maxZ);}
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function clearSegment(a,b,area='pantry'){
  const {obstacles}=getSpace(area);
  if(!isWalkable(a,area)||!isWalkable(b,area))return false;
  return !obstacles.some(o=>{
    let low=0,high=1;
    for(const [key,min,max]of [['x',o.minX,o.maxX],['z',o.minZ,o.maxZ]]){
      const delta=b[key]-a[key];
      if(Math.abs(delta)<1e-8){if(a[key]<=min||a[key]>=max)return false;}
      else{let t0=(min-a[key])/delta,t1=(max-a[key])/delta;if(t0>t1)[t0,t1]=[t1,t0];low=Math.max(low,t0);high=Math.min(high,t1);if(low>=high)return false;}
    }return low<high&&high>0&&low<1;
  });
}
const cornerCache=new Map();
function cornersFor(area){if(!cornerCache.has(area))cornerCache.set(area,getSpace(area).obstacles.flatMap(o=>[o.minX-.025,o.maxX+.025].flatMap(x=>[o.minZ-.025,o.maxZ+.025].map(z=>({x,z})))).filter(p=>isWalkable(p,area)));return cornerCache.get(area);}
export function findPath(start,end,area='pantry'){
  if(!isWalkable(start,area)||!isWalkable(end,area))return null;
  if(clearSegment(start,end,area))return [{...start},{...end}];
  const nodes=[start,end,...cornersFor(area)],cost=nodes.map(()=>Infinity),previous=nodes.map(()=>-1),visited=new Set();cost[0]=0;
  for(let pass=0;pass<nodes.length;pass++){
    let current=-1;for(let i=0;i<nodes.length;i++)if(!visited.has(i)&&(current<0||cost[i]<cost[current]))current=i;
    if(current<0||!Number.isFinite(cost[current]))return null;
    if(current===1){const path=[];for(let i=1;i>=0;i=previous[i])path.unshift({...nodes[i]});return path;}
    visited.add(current);
    for(let i=0;i<nodes.length;i++)if(!visited.has(i)&&clearSegment(nodes[current],nodes[i],area)){
      const next=cost[current]+distance(nodes[current],nodes[i]);if(next<cost[i]){cost[i]=next;previous[i]=current;}
    }
  }return null;
}
const smooth=t=>t*t*(3-2*t);
const mix=(a,b,t)=>a+(b-a)*t;
function atSeat(seat,area='pantry'){const [x,z,yaw]=getSpace(area).seats[seat];return{x,z,yaw,sit:1,phase:'seated',inSeat:seat,moving:false,distance:0};}
export function sampleMotion(member,now){
  const m=member.motion,area=member.area??'pantry',{stations}=getSpace(area);
  if(!m)return member.seat!=null?atSeat(member.seat,area):{x:1,z:2,yaw:Math.PI,sit:0,phase:'standing',inSeat:null,moving:false,distance:0};
  const age=Math.max(0,now-m.startedAt),start=m.points[0],last=m.points.at(-1);
  if(age<m.departMs){const t=smooth(age/m.departMs);return{x:mix(m.start.x,start.x,t),z:mix(m.start.z,start.z,t),yaw:m.start.yaw,sit:m.start.sit*(1-t),phase:'rising',inSeat:m.fromSeat,moving:true,distance:0};}
  if(age<m.departMs+m.walkMs){
    let remaining=(age-m.departMs)/1000*1.65,total=remaining;
    for(let i=1;i<m.points.length;i++){
      const a=m.points[i-1],b=m.points[i],length=distance(a,b);
      if(remaining<=length){const t=length?remaining/length:1;return{x:mix(a.x,b.x,t),z:mix(a.z,b.z,t),yaw:Math.atan2(b.x-a.x,b.z-a.z),sit:0,phase:'walking',inSeat:null,moving:true,distance:total};}remaining-=length;
    }
  }
  if(m.toSeat!=null){
    const seat=atSeat(m.toSeat,area),t=m.arriveMs?smooth(Math.min(1,(age-m.departMs-m.walkMs)/m.arriveMs)):1;
    return {...seat,x:mix(last.x,seat.x,t),z:mix(last.z,seat.z,t),sit:t,phase:t<1?'sitting':'seated',moving:t<1};
  }
  const before=m.points.length>1?m.points.at(-2):m.start;
  return {x:last.x,z:last.z,yaw:member.station&&stations[member.station]?stations[member.station].yaw:distance(before,last)>.01?Math.atan2(last.x-before.x,last.z-before.z):m.start.yaw,sit:0,phase:'standing',inSeat:null,moving:false,distance:0};
}
export function planMotion(member,destination,toSeat,now,id){
  const area=member.area??'pantry',{approaches}=getSpace(area),pose=sampleMotion(member,now),fromSeat=pose.inSeat,start=fromSeat!=null?approaches[fromSeat]:{x:pose.x,z:pose.z};
  const end=toSeat!=null?approaches[toSeat]:destination,path=findPath(start,end,area);
  if(!path)return null;
  const departMs=fromSeat!=null?Math.max(200,600*Math.min(1,distance(pose,start)/.85)):0;
  const walkMs=path.slice(1).reduce((sum,p,i)=>sum+distance(path[i],p),0)/1.65*1000,arriveMs=toSeat!=null?650:0;
  return {id,start:{x:pose.x,z:pose.z,yaw:pose.yaw,sit:pose.sit},points:path,fromSeat,toSeat,startedAt:now,departMs,walkMs,arriveMs,endsAt:now+departMs+walkMs+arriveMs};
}
