type Rect={x:number;y:number;w:number;h:number};
export function placeTableActions(centerX:number,baseY:number,w:number,h:number,viewW:number,viewH:number,avoid:Rect[]){
 const clamp=(x:number,min:number,max:number)=>Math.max(min,Math.min(max,x));
 const x=clamp(centerX-w/2,10,viewW-w-10),top=110,bottom=viewH-h-12;
 const clear=(r:Rect)=>r.y>=top&&r.y<=bottom&&avoid.every(o=>r.x>=o.x+o.w+8||r.x+r.w<=o.x-8||r.y>=o.y+o.h+8||r.y+r.h<=o.y-8);
 const ys=[baseY,...avoid.flatMap(o=>[o.y-h-12,o.y+o.h+12]),top,bottom];
 const xs=[x,...avoid.flatMap(o=>[clamp(o.x-w-12,10,viewW-w-10),clamp(o.x+o.w+12,10,viewW-w-10)])];
 let best:Rect|null=null,cost=Infinity;
 for(const px of xs)for(const py of ys){
  const rect={x:px,y:py,w,h},distance=Math.abs(px-x)*1.2+Math.abs(py-baseY);
  if(distance<cost&&clear(rect)){best=rect;cost=distance;}
 }
 return best;
}
