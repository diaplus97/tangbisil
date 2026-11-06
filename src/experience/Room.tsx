import {useEffect,useRef,type CSSProperties} from 'react';
import {drawAvatar,drawRoom,pixelMemberPosition} from './pixelArt';
import type {Snapshot} from './types';
export function Avatar({variant=0}:{variant?:number}){
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{const c=ref.current?.getContext('2d');if(c){c.clearRect(0,0,50,80);drawAvatar(c,25,45,variant,'rest',false,1000);}},[variant]);
 return <canvas width="50" height="80" ref={ref} className="avatar-preview" aria-hidden="true"/>;
}
export function Room({state,onShelf,onPlate,onDrink,disabled,simple=false,sampleAvailable=false}:{state:Snapshot|null;onShelf:()=>void;onPlate:()=>void;onDrink:()=>void;disabled:boolean;simple?:boolean;sampleAvailable?:boolean}){
 const ref=useRef<HTMLCanvasElement>(null),latest=useRef(state),names=useRef(new Map<string,HTMLDivElement>()),offset=useRef(0);latest.current=state;
 useEffect(()=>{if(state)offset.current=state.serverTime-Date.now();},[state]);
 useEffect(()=>{
   const c=ref.current!.getContext('2d')!;let raf=0,last=0;
   const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
   function frame(now:number){
     if(now-last>1000/24){const s=latest.current;drawRoom(c,s?.room.members??[],s?.self.id,s?.room.offers.length??0,reduced?1000:Date.now(),Date.now()+offset.current);for(const m of s?.room.members??[]){const el=names.current.get(m.id),p=pixelMemberPosition(m,Date.now()+offset.current);if(el){el.style.setProperty('--seat-x',`${p.x/640*100}%`);el.style.top=`${(p.y-56)/360*100}%`;}}last=now;}
     raf=requestAnimationFrame(frame);
   }
   raf=requestAnimationFrame(frame);return()=>cancelAnimationFrame(raf);
 },[]);
 return <div className="room-frame">
   <canvas ref={ref} width="640" height="360" className="room-canvas" aria-label="창가 탕비실. 왼쪽에 음료와 간식 선반, 가운데에 여섯 자리의 공용 테이블이 있습니다." role="img"/>
   <div className="scene-label"><span className="tiny-star">✦</span> 창가 탕비실 <span className="scene-label-sub">01</span></div>
   {!simple&&<><button className="hotspot shelf-hotspot" onClick={onShelf} disabled={disabled} aria-label="간식 선반에서 레몬 샌드파이 고르기"><span className="hotspot-dot"/><span>오늘의 레몬파이</span></button>
   <button className="hotspot drink-hotspot" onClick={onDrink} disabled={disabled} aria-label="음료 고르기"><span className="hotspot-dot"/><span>한 잔</span></button></>}
   {sampleAvailable&&<button className="hotspot plate-hotspot sample-hotspot" onClick={onPlate} disabled={disabled}><span className="hotspot-dot"/>한 조각 맛보기</button>}
   {state?.room.members.map(m=>{const s=pixelMemberPosition(m);return <div ref={el=>{if(el)names.current.set(m.id,el);else names.current.delete(m.id);}} key={m.id} className={`visitor-name ${m.id===state.self.id?'is-me':''} ${!m.connected?'reconnecting':''}`} style={{'--seat-x':`${s.x/640*100}%`,top:`${(s.y-56)/360*100}%`} as CSSProperties}><span className="presence-dot"/>{m.name}{m.id===state.self.id&&<small> 나</small>}{!m.connected&&<small> 연결 중</small>}</div>;})}
   <div className="scene-weather" aria-hidden="true">☀ <span>햇살이 드는 자리</span></div>
 </div>;
}
