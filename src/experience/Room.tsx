import {useEffect,useRef,type CSSProperties} from 'react';
import {ribbonState} from '../../shared/smoking.mjs';
import {drawAvatar,drawRoom,pixelMemberPosition} from './pixelArt';
import type {Snapshot} from './types';
export function Avatar({variant=0,visitorId='preview-02'}:{variant?:number;visitorId?:string}){
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{const c=ref.current?.getContext('2d');if(c){c.clearRect(0,0,50,80);drawAvatar(c,25,45,variant,'rest',false,1000,visitorId);}},[variant,visitorId]);
 return <canvas width="50" height="80" ref={ref} className="avatar-preview" aria-hidden="true"/>;
}
export function Room({state,onShelf,onPlate,onDrink,onReturn,reduceMotion,disabled,simple=false,sampleAvailable=false}:{state:Snapshot|null;onShelf:()=>void;onPlate:()=>void;onDrink:()=>void;onReturn:()=>void;reduceMotion:boolean;disabled:boolean;simple?:boolean;sampleAvailable?:boolean}){
 const area=state?.room.area??'pantry',side=area!=='pantry',title=area==='smoking'?'흡연실 테라스':area==='healing'?'힐링방':'창가 탕비실';
 const ref=useRef<HTMLCanvasElement>(null),latest=useRef(state),names=useRef(new Map<string,HTMLDivElement>()),offset=useRef(0);latest.current=state;
 useEffect(()=>{if(state)offset.current=state.serverTime-(state.receivedAt??Date.now());},[state]);
 useEffect(()=>{
   const c=ref.current!.getContext('2d')!;let raf=0,last=0;
   const reduced=reduceMotion;
   function frame(now:number){
     if(now-last>1000/24){const s=latest.current;drawRoom(c,s?.room.members??[],s?.self.id,s?.room.offers.length??0,reduced?1000:Date.now(),Date.now()+offset.current,s?.room.area,s?.room.area==='smoking'?ribbonState(s.room.messages??s.room.thoughts,Date.now()+offset.current):0);for(const m of s?.room.members??[]){const el=names.current.get(m.id),p=pixelMemberPosition(m,Date.now()+offset.current);if(el){el.style.setProperty('--seat-x',`${p.x/640*100}%`);el.style.top=`${(p.y-56)/360*100}%`;}}last=now;}
     raf=requestAnimationFrame(frame);
   }
   raf=requestAnimationFrame(frame);return()=>cancelAnimationFrame(raf);
 },[reduceMotion]);
 return <div className="room-frame pixel-space" data-area={area}>
   <canvas ref={ref} width="640" height="360" className="room-canvas" aria-label={side?title+' · 창가에서 함께 쉬는 공간':'창가 탕비실. 왼쪽에 음료와 간식 선반, 가운데에 공용 테이블이 있습니다.'} role="img"/>
   <div className="scene-label">{title}</div>
   {!side&&!simple&&<><button className="hotspot shelf-hotspot" onClick={onShelf} disabled={disabled} aria-label="간식 선반에서 레몬 샌드파이 고르기"><span className="hotspot-dot"/><span>오늘의 레몬파이</span></button>
   <button className="hotspot drink-hotspot" onClick={onDrink} disabled={disabled} aria-label="음료 고르기"><span className="hotspot-dot"/><span>한 잔</span></button></>}
   {sampleAvailable&&<button className="hotspot plate-hotspot sample-hotspot" onClick={onPlate} disabled={disabled}><span className="hotspot-dot"/>한 조각 맛보기</button>}
   {state?.room.members.map(m=>{const s=pixelMemberPosition(m);return <div ref={el=>{if(el)names.current.set(m.id,el);else names.current.delete(m.id);}} key={m.id} className={`visitor-name ${m.id===state.self.id?'is-me':''} ${!m.connected?'reconnecting':''}`} style={{'--seat-x':`${s.x/640*100}%`,top:`${(s.y-56)/360*100}%`} as CSSProperties}><span className="presence-dot"/>{m.name}{m.id===state.self.id&&<small> 나</small>}{!m.connected&&<small> 연결 중</small>}</div>;})}
   {side?<button className="pixel-return" disabled={disabled||Boolean(state?.room.members.find(m=>m.id===state.self.id)?.travel)} onClick={onReturn}>탕비실로 돌아가기</button>:<div className="scene-weather" aria-hidden="true">☀ <span>햇살이 드는 자리</span></div>}
 </div>;
}
