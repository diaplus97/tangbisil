export const SAND_WIDTH=120,SAND_HEIGHT=80;
export const initialStones=()=>[[.23,.28],[.73,.35],[.62,.73]];
export function decodeSand(value){try{const raw=atob(value??'');if(raw.length===SAND_WIDTH*SAND_HEIGHT)return Uint8Array.from(raw,c=>c.charCodeAt(0));}catch{}return new Uint8Array(SAND_WIDTH*SAND_HEIGHT).fill(128);}
export function encodeSand(grid){return btoa(String.fromCharCode(...grid));}
export function rakeSand(grid,points){
 const result=grid.slice();
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],dx=(b[0]-a[0])*(SAND_WIDTH-1),dy=(b[1]-a[1])*(SAND_HEIGHT-1),length=Math.hypot(dx,dy);if(length<.05)continue;
  const nx=-dy/length,ny=dx/length,steps=Math.ceil(length*1.5);
  for(let j=0;j<=steps;j++)for(const offset of[-4,0,4]){
   const x=a[0]*(SAND_WIDTH-1)+dx*j/steps+nx*offset,y=a[1]*(SAND_HEIGHT-1)+dy*j/steps+ny*offset;
   for(let gy=Math.max(0,Math.floor(y-2));gy<=Math.min(SAND_HEIGHT-1,Math.ceil(y+2));gy++)for(let gx=Math.max(0,Math.floor(x-2));gx<=Math.min(SAND_WIDTH-1,Math.ceil(x+2));gx++){
    const d=Math.hypot(gx-x,gy-y);if(d>2)continue;const target=d<1.2?128+112*(1-d/1.4):104;
    const index=gy*SAND_WIDTH+gx;
    // Adjacent samples must not fill a groove again with the next sample's rim.
    if(d<1.2)result[index]=Math.max(result[index],Math.round(target));
    else if(result[index]<=128)result[index]=104;
   }
  }
 }
 return result;
}
export function gentleStroke(revision=0){const y=.25+(revision%4)*.14;return Array.from({length:28},(_,i)=>{const x=.12+i/27*.76;return[x,y+Math.sin(i/27*Math.PI*2)*.055];});}
export function nextStonePosition(stone){return [stone[0]>.55?.28:.72,stone[1]>.55?.28:.72];}
