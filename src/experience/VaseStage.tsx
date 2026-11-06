import {useEffect,useRef} from 'react';
import {flowers} from '../../shared/vase.mjs';
import type {Vase} from './types';

type Props={vase:Vase;disabled:boolean;act:(type:string,input?:Record<string,unknown>)=>Promise<unknown>};
export default function VaseStage({vase,disabled,act}:Props){
 const canvas=useRef<HTMLCanvasElement>(null),latest=useRef({vase,disabled,act}),refresh=useRef<()=>void>();latest.current={vase,disabled,act};
 useEffect(()=>{refresh.current?.();},[vase]);
 useEffect(()=>{
  const el=canvas.current!,c=el.getContext('2d')!;let position=vase.position,tilt=vase.tilt,drag:{id:number;x:number;position:number;tilt:number;mode:'position'|'tilt'}|null=null,pending=false;
  function ellipse(x:number,y:number,rx:number,ry:number,fill:string|CanvasGradient){c.fillStyle=fill;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();}
  function draw(){
   c.clearRect(0,0,420,340);ellipse(212,312,101,12,'#20392815');ellipse(210,309,57,7,'#20392825');
   const ceramic=c.createLinearGradient(150,0,270,0);ceramic.addColorStop(0,'#9ca79b');ceramic.addColorStop(.28,'#e2e7dc');ceramic.addColorStop(.52,'#f2f2e5');ceramic.addColorStop(.85,'#ccd6c7');ceramic.addColorStop(1,'#8e9e90');
   c.fillStyle=ceramic;c.beginPath();c.moveTo(192,218);c.bezierCurveTo(190,240,161,247,164,279);c.bezierCurveTo(164,321,256,321,256,279);c.bezierCurveTo(259,247,230,240,228,218);c.closePath();c.fill();
   ellipse(210,218,18,6,'#d8dfd0');ellipse(210,219,12,3,'#607867');
   c.save();c.translate(210+position*15,220);c.rotate(-tilt);c.lineCap='round';c.strokeStyle='#789369';c.lineWidth=3;c.beginPath();c.moveTo(0,0);c.bezierCurveTo(-8,-40,15,-80,3,-129);c.stroke();
   for(const side of[-1,1]){c.save();c.translate(side*13,-48+(side+1)*-15);c.rotate(side*.5);const leaf=c.createLinearGradient(-22,0,22,0);leaf.addColorStop(0,'#96ad81');leaf.addColorStop(1,'#55775e');ellipse(0,0,23,6,leaf);c.strokeStyle='#c6d2a4';c.lineWidth=.65;c.beginPath();c.moveTo(-17,0);c.lineTo(17,0);c.stroke();c.restore();}
   c.translate(3,-130);const f=flowers.find(f=>f.id===latest.current.vase.flower)??flowers[0],count=f.id==='poppy'?5:f.id==='cornflower'?12:8;
   c.shadowColor='#405b4225';c.shadowBlur=5;c.shadowOffsetY=3;
   for(let i=0;i<count;i++){c.save();c.rotate(i/count*Math.PI*2);const petal=c.createLinearGradient(0,0,0,-36);petal.addColorStop(0,f.id==='poppy'?'#ba7668':f.id==='cornflower'?'#6884a5':'#c8c2ac');petal.addColorStop(.55,f.color);petal.addColorStop(1,f.id==='cosmos'?'#fffdf3':f.color);ellipse(0,-22,f.id==='poppy'?20:f.id==='cornflower'?8:12,26,petal);c.strokeStyle='#ffffff38';c.lineWidth=.8;c.beginPath();c.moveTo(0,-8);c.quadraticCurveTo(2,-20,0,-39);c.stroke();c.restore();}
   c.shadowColor='transparent';ellipse(0,0,10,9,f.id==='poppy'?'#566453':'#bba062');
   for(let i=0;i<24;i++){const a=i*2.4,r=Math.sqrt(i)*1.65;ellipse(Math.cos(a)*r,Math.sin(a)*r,1.4,1.4,'#e6cf8e');}c.restore();
  }
  function sync(){if(drag||pending)return;position=latest.current.vase.position;tilt=latest.current.vase.tilt;draw();}refresh.current=sync;
  const clamp=(v:number,max:number)=>Math.max(-max,Math.min(max,v));
  async function save(){pending=true;try{await latest.current.act('vase-edit',{itemId:latest.current.vase.id,revision:latest.current.vase.revision,position,tilt});}finally{pending=false;sync();}}
  function down(e:PointerEvent){if(e.button!==0||!e.isPrimary||pending||latest.current.disabled)return;e.preventDefault();e.stopPropagation();el.focus({preventScroll:true});const b=el.getBoundingClientRect();drag={id:e.pointerId,x:e.clientX,position,tilt,mode:(e.clientY-b.top)/b.height<.48?'tilt':'position'};el.setPointerCapture(e.pointerId);}
  function move(e:PointerEvent){if(!drag||e.pointerId!==drag.id)return;e.preventDefault();e.stopPropagation();const dx=(e.clientX-drag.x)/el.getBoundingClientRect().width;if(drag.mode==='position')position=clamp(drag.position+dx*3,.6);else tilt=clamp(drag.tilt+dx*1.7,.35);draw();}
  function up(e:PointerEvent){if(!drag||e.pointerId!==drag.id)return;e.preventDefault();e.stopPropagation();const d=drag;drag=null;if(Math.abs(e.clientX-d.x)<3){const x=(e.clientX-el.getBoundingClientRect().left)/el.getBoundingClientRect().width-.5;if(d.mode==='position')position=clamp(x*2,.6);else tilt=clamp(x,.35);}draw();void save();el.releasePointerCapture(e.pointerId);}
  function cancel(){drag=null;sync();}
  function key(e:KeyboardEvent){if(e.key==='Escape'){cancel();return;}if(pending||latest.current.disabled)return;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(e.key)){e.preventDefault();e.stopPropagation();if(e.key==='Home'){position=0;tilt=0;}else if(e.key==='ArrowLeft'||e.key==='ArrowRight')position=clamp(position+(e.key==='ArrowLeft'?-.12:.12),.6);else tilt=clamp(tilt+(e.key==='ArrowDown'?-.07:.07),.35);draw();void save();}}
  el.addEventListener('pointerdown',down);el.addEventListener('pointermove',move);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',cancel);el.addEventListener('lostpointercapture',cancel);el.addEventListener('keydown',key);draw();
  return()=>{refresh.current=undefined;el.removeEventListener('pointerdown',down);el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',up);el.removeEventListener('pointercancel',cancel);el.removeEventListener('lostpointercapture',cancel);el.removeEventListener('keydown',key);};
 },[]);
 return <div className="vase-stage"><canvas ref={canvas} width={420} height={340} tabIndex={0} role="button" aria-disabled={disabled} aria-label="내 꽃병. 줄기를 밀거나 눌러 위치, 꽃잎을 밀거나 눌러 기울기 조절. 좌우 방향키는 위치, 위아래는 기울기, Home은 가운데."/></div>;
}
