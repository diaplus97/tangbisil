import {passPointerToRoom} from './stagePointer';
import {useEffect,useRef} from 'react';
import {decodeSand,rakeSand,gentleStroke,SAND_WIDTH,SAND_HEIGHT} from '../../shared/sand.mjs';
import {sandMotion,stopSandSound,playSound,sandStrokeSound} from './sound';
import type {Snapshot} from './types';

type Props={state:Snapshot;disabled:boolean;connected:boolean;contact:(input:Record<string,unknown>)=>void;act:(type:string,extra?:Record<string,unknown>)=>Promise<unknown>};
export default function SandStage({state,disabled,connected,contact,act}:Props){
 const canvas=useRef<HTMLCanvasElement>(null),latest=useRef({state,disabled,connected,contact,act}),refresh=useRef<()=>void>();latest.current={state,disabled,connected,contact,act};
 useEffect(()=>{refresh.current?.();},[state.self.pantry.rest.sand?.revision]);
 useEffect(()=>{
  const el=canvas.current!,ctx=el.getContext('2d')!,grain=document.createElement('canvas');grain.width=SAND_WIDTH;grain.height=SAND_HEIGHT;const gc=grain.getContext('2d')!;
  let grid=decodeSand(latest.current.state.self.pantry.rest.sand!.surface),stones=latest.current.state.self.pantry.rest.sand!.stones.map(p=>[...p]),selected:number|null=null,pending=false,revision=latest.current.state.self.pantry.rest.sand!.revision;
  const queue:Record<string,unknown>[]=[];let disposed=false,gestureId='',sequence=0,lastContact=-Infinity,lastPointAt=0,angle=-.45,idle:ReturnType<typeof setTimeout>|undefined;
  let drawing=false;
  let drag:{id:number;stone:number|null;points:number[][];origin:number[];moved:boolean;placing:boolean}|null=null;
  const rect={x:47,y:32,w:506,h:292},clamp=(v:number,min=.03,max=.97)=>Math.max(min,Math.min(max,v));
  function shape(x:number,y:number,w:number,h:number,r:number){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
  function draw(){
   ctx.clearRect(0,0,600,380);
   ctx.save();ctx.shadowColor='#14281b50';ctx.shadowBlur=20;ctx.shadowOffsetY=12;ctx.fillStyle='#957959';shape(23,18,554,330,27);ctx.fill();ctx.restore();
   const wood=ctx.createLinearGradient(0,15,0,348);wood.addColorStop(0,'#dbc09b');wood.addColorStop(.5,'#b99a73');wood.addColorStop(.92,'#d2b48c');wood.addColorStop(1,'#9c7b54');ctx.fillStyle=wood;shape(23,13,554,330,25);ctx.fill();
   ctx.save();shape(23,13,554,330,25);ctx.clip();for(let i=0;i<75;i++){ctx.beginPath();ctx.strokeStyle=i%2?'#ead4b146':'#79572d23';ctx.lineWidth=.6;ctx.moveTo(20,i*4.5+14);for(let j=0;j<12;j++)ctx.lineTo(j*55,i*4.5+14+Math.sin(i*1.2+j*.5)*3);ctx.stroke();}ctx.restore();
   ctx.fillStyle='#a38b64';shape(39,24,522,309,17);ctx.fill();
   const pixels=gc.createImageData(SAND_WIDTH,SAND_HEIGHT);
   for(let y=0;y<SAND_HEIGHT;y++)for(let x=0;x<SAND_WIDTH;x++){
    const i=y*SAND_WIDTH+x,depth=(grid[i]-128)/112,slope=(grid[Math.max(0,y-1)*SAND_WIDTH+Math.max(0,x-1)]-grid[Math.min(SAND_HEIGHT-1,y+1)*SAND_WIDTH+Math.min(SAND_WIDTH-1,x+1)])/112;
    const noise=((x*31+y*73+x*y*7)%29-14)*.24,light= -depth*35+slope*38+noise;
    pixels.data.set([Math.max(0,219+light),Math.max(0,205+light),Math.max(0,171+light),255],i*4);
   }
   gc.putImageData(pixels,0,0);ctx.save();shape(rect.x,rect.y,rect.w,rect.h,12);ctx.clip();ctx.imageSmoothingEnabled=true;ctx.drawImage(grain,rect.x,rect.y,rect.w,rect.h);
   const shade=ctx.createLinearGradient(0,rect.y,0,rect.y+rect.h);shade.addColorStop(0,'#65522d30');shade.addColorStop(.08,'#fff6d000');shade.addColorStop(1,'#f7e6b910');ctx.fillStyle=shade;ctx.fillRect(rect.x,rect.y,rect.w,rect.h);ctx.restore();
   stones.forEach(([sx,sy],i)=>{const x=rect.x+sx*rect.w,y=rect.y+sy*rect.h,rx=19+i*3,ry=14+i*2;
    ctx.save();ctx.translate(x,y);ctx.rotate((i-1)*.55);ctx.shadowColor='#4b432766';ctx.shadowBlur=5;ctx.shadowOffsetY=5;const stone=ctx.createRadialGradient(-rx*.35,-ry*.6,1,0,0,rx*1.4);stone.addColorStop(0,['#d1d5bd','#a7b1a6','#c0b7a6'][i]);stone.addColorStop(1,['#7d896f','#626e65','#857c6b'][i]);ctx.fillStyle=stone;ctx.beginPath();ctx.ellipse(0,0,rx,ry,0,0,Math.PI*2);ctx.fill();ctx.shadowColor='transparent';ctx.strokeStyle='#f2ead740';ctx.lineWidth=.7;ctx.beginPath();ctx.ellipse(-1,-2,rx*.84,ry*.7,0,Math.PI,Math.PI*1.9);ctx.stroke();
    if(selected===i){ctx.strokeStyle='#4c7462';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,0,rx+5,ry+5,0,0,Math.PI*2);ctx.stroke();}ctx.restore();
   });
   if(drag&&drag.stone==null&&!drag.placing){const point=drag.points.at(-1)!;ctx.save();ctx.translate(rect.x+point[0]*rect.w,rect.y+point[1]*rect.h);ctx.rotate(angle);ctx.strokeStyle='#927447';ctx.lineWidth=6;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(0,8);ctx.lineTo(0,53);ctx.stroke();ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-17,8);ctx.lineTo(17,8);for(const x of[-16,0,16]){ctx.moveTo(x,8);ctx.lineTo(x,0);}ctx.stroke();ctx.restore();}
  }
  function sync(){if(drag||pending||queue.length)return;const sand=latest.current.state.self.pantry.rest.sand;if(!sand||sand.revision<revision)return;revision=sand.revision;grid=decodeSand(sand.surface);stones=sand.stones.map(p=>[...p]);draw();}
  refresh.current=sync;
  function signal(active:boolean,kind:'rake'|'stone'='rake'){
   if(!gestureId)return;latest.current.contact({itemId:latest.current.state.self.pantry.rest.sand?.id,gestureId,sequence:++sequence,active,kind});lastContact=performance.now();
  }
  function stop(){clearTimeout(idle);stopSandSound();if(drawing)signal(false);drawing=false;}
  function activity(kind:'rake'|'stone',speed:number){
   if(!drawing||performance.now()-lastContact>420){drawing=true;signal(true,kind);}
   clearTimeout(idle);idle=setTimeout(stop,150);if(kind==='rake')sandMotion(speed);
  }
  function point(e:PointerEvent){const b=el.getBoundingClientRect();return[clamp(((e.clientX-b.left)/b.width*600-rect.x)/rect.w),clamp(((e.clientY-b.top)/b.height*380-rect.y)/rect.h)].map(v=>Math.round(v*10000)/10000);}
  async function flush(){
   if(pending||!queue.length||disposed)return;pending=true;
   while(queue.length&&!disposed){
    const extra=queue.shift()!,sand=latest.current.state.self.pantry.rest.sand;
    if(!sand||!latest.current.connected){queue.length=0;break;}
    const result=await latest.current.act('sand-edit',{itemId:sand.id,revision,...extra}) as {state:Snapshot}|null;
    if(!result){queue.length=0;cancel();break;}revision=result.state.self.pantry.rest.sand!.revision;if(extra.gesture)sandStrokeSound();
   }
   pending=false;sync();
  }
  function commit(extra:Record<string,unknown>){queue.push(extra);void flush();}
  function down(e:PointerEvent){
   e.preventDefault();e.stopPropagation();if(e.button!==0||!e.isPrimary||latest.current.disabled||pending)return;
   const b=el.getBoundingClientRect(),x=(e.clientX-b.left)/b.width*600,y=(e.clientY-b.top)/b.height*380;
   if(x<rect.x||x>rect.x+rect.w||y<rect.y||y>rect.y+rect.h){passPointerToRoom(e,el);return;}
   el.focus({preventScroll:true});gestureId=crypto.randomUUID();sequence=0;lastPointAt=performance.now();const p=point(e),stone=stones.findIndex(s=>Math.hypot((s[0]-p[0])*rect.w,(s[1]-p[1])*rect.h)<30);
   drag={id:e.pointerId,stone:stone<0?null:stone,points:[p],origin:p,moved:false,placing:selected!=null&&stone<0};if(stone>=0)selected=stone;el.setPointerCapture(e.pointerId);draw();
  }
  function move(e:PointerEvent){
   if(!drag||drag.id!==e.pointerId||!latest.current.connected)return;e.preventDefault();e.stopPropagation();const p=point(e),last=drag.points.at(-1)!;
   const dx=(p[0]-last[0])*rect.w,dy=(p[1]-last[1])*rect.h,distance=Math.hypot(dx,dy);if(distance<1)return;
   const now=performance.now(),speed=distance/Math.max(8,now-lastPointAt);lastPointAt=now;drag.moved=true;
   if(drag.stone!=null){stones[drag.stone]=p.map(v=>clamp(v,.1,.9));drag.points=[p];activity('stone',speed);}
   else if(!drag.placing){
    angle=Math.atan2(dy,dx)+Math.PI/2;grid=rakeSand(grid,[last,p]);drag.points.push(p);activity('rake',speed);
    // Save exact contiguous chunks without simplifying or redrawing the earlier path.
    if(drag.points.length===64){commit({operation:'stroke',points:drag.points});drag.points=[p];}
   }draw();
  }
  function end(e:PointerEvent){
   const d=drag;if(!d||d.id!==e.pointerId)return;e.preventDefault();e.stopPropagation();stop();drag=null;if(el.hasPointerCapture(e.pointerId))el.releasePointerCapture(e.pointerId);
   if(d.stone!=null){if(d.moved){selected=null;playSound('sandStone');commit({operation:'stone',stone:d.stone,position:stones[d.stone]});}}
   else if(d.placing&&selected!=null){const index=selected;selected=null;playSound('sandStone');commit({operation:'stone',stone:index,position:point(e).map(v=>clamp(v,.1,.9))});}
   else if(d.points.length>1)commit({operation:'stroke',points:d.points});draw();
  }
  function cancel(){stop();if(drag&&el.hasPointerCapture(drag.id))el.releasePointerCapture(drag.id);drag=null;sync();}
  function visibility(){if(document.hidden)cancel();}
  function key(e:KeyboardEvent){if(e.key==='Escape'){selected=null;cancel();return;}if(e.key==='Enter'||e.key===' '){e.preventDefault();if(!e.repeat&&!latest.current.disabled&&!pending)commit({operation:'stroke',points:gentleStroke(revision),gesture:true});}}
  el.addEventListener('pointerdown',down);el.addEventListener('pointermove',move);el.addEventListener('pointerup',end);el.addEventListener('pointercancel',cancel);el.addEventListener('lostpointercapture',cancel);el.addEventListener('keydown',key);document.addEventListener('visibilitychange',visibility);window.addEventListener('blur',cancel);draw();
  return()=>{disposed=true;stop();refresh.current=undefined;el.removeEventListener('pointerdown',down);el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',end);el.removeEventListener('pointercancel',cancel);el.removeEventListener('lostpointercapture',cancel);el.removeEventListener('keydown',key);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('blur',cancel);};
 },[]);
 return <div className="sand-stage"><canvas width={600} height={380} ref={canvas} role="button" tabIndex={0} aria-disabled={disabled} aria-label="개인 모래 트레이. 드래그해 선을 긋고, 돌은 끌거나 돌과 놓을 곳을 차례로 누르세요. Enter로 선 한 번 긋기."/></div>;
}
