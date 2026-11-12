import {useEffect,useRef,useState} from 'react';
import {exitsFrom,getSpace,type Area,stations as pantryStations,type StationId} from '../../shared/space.mjs';
import type {Snapshot} from './types';
type Props={onTravel:(to:Area)=>Promise<void>;state:Snapshot;disabled:boolean;moving:boolean;canReturn:boolean;onReturn:()=>Promise<void>;onStand:()=>Promise<unknown>;onClose:()=>void;onSelected?:()=>void;onSeat:(seat:number)=>Promise<void>;onObject:(id:StationId)=>Promise<void>};
export default function ExploreDestinations({onTravel,state,disabled,moving,canReturn,onReturn,onStand,onClose,onSelected=onClose,onSeat,onObject}:Props){
 const map=getSpace(state.room.area),{seats,seatTables,tables}=map,stations=map.stations as typeof pantryStations;
 const [section,setSection]=useState<'seats'|'objects'|'rooms'>('seats'),panel=useRef<HTMLDivElement>(null);
 useEffect(()=>{document.querySelectorAll<HTMLDetailsElement>('.pantry-app details[open]').forEach(d=>{d.open=false;});panel.current?.querySelector<HTMLButtonElement>('[aria-pressed=true]')?.focus({preventScroll:true});},[]);
 function choose(action:()=>Promise<unknown>){onSelected();void action();}
 const me=state.room.members.find(m=>m.id===state.self.id);
 return <>
  {/* Keep the complete pointer gesture off the canvas, including the release. */}
  <div className="destination-dismiss" aria-hidden="true" onPointerDown={e=>e.stopPropagation()} onPointerUp={e=>e.stopPropagation()} onClick={onClose}/>
  <nav className="destination-bar" aria-label="이동할 곳"><div ref={panel} className="seat-picker-panel move-picker" role="dialog" aria-modal="true" aria-labelledby="move-picker-title"
   onKeyDown={e=>{
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();onClose();}
    if(e.key==='Tab'){
     const buttons=[...e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')],first=buttons[0],last=buttons.at(-1);
     if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
     else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
    }
   }}>
   <header className="picker-header"><strong id="move-picker-title">{moving?'어디로 바꿀까요?':'어디로 옮길까요?'}</strong><button className="quiet-action" onClick={onClose}>취소</button></header>
   <div className="destination-sections" role="group" aria-label="목적지 종류">
    <button aria-pressed={section==='seats'} onClick={()=>setSection('seats')}>빈 자리</button>
    {Object.keys(stations).length>0&&<button aria-pressed={section==='objects'} onClick={()=>setSection('objects')}>물건</button>}
    <button aria-pressed={section==='rooms'} onClick={()=>setSection('rooms')}>다른 공간</button>
   </div>
   <div className="destination-list">
    {section==='seats'&&(map.id==='smoking'?[{id:'terrace',name:'바다 앞 자리'}]:tables).map((table,t)=><fieldset key={table.id}><legend>{table.name}</legend><div className="destination-seats">{seats.map((_,i)=>{
     if(map.id!=='smoking'&&seatTables[i]!==t)return null;
     const owner=state.room.members.find(m=>m.seat===i),mine=owner?.id===state.self.id;
     return <button key={i} disabled={disabled||Boolean(owner)} onClick={()=>choose(()=>onSeat(i))} aria-label={table.name+' '+(i+1)+'번 자리 · '+(mine?'내 자리':owner?'이용 중':'비어 있음')}>{i+1}번 자리 <small>{mine?'내 자리':owner?'이용 중':'비어 있어요'}</small></button>;
    })}</div></fieldset>)}
    {section==='objects'&&<div className="destination-objects">{(Object.keys(stations) as StationId[]).map(id=>{
     const owner=state.room.members.find(m=>m.station===id),mine=owner?.id===state.self.id;
     return <button key={id} disabled={disabled||Boolean(owner)} onClick={()=>choose(()=>onObject(id))} aria-label={stations[id].name+' · '+(mine?'현재 위치':owner?'이용 중':'이동')}><span className="destination-title">{stations[id].name}</span>{owner&&<small>{mine?'현재 위치':'이용 중'}</small>}</button>;
    })}</div>}
    {section==='rooms'&&exitsFrom(map.id).map(exit=><button key={exit.id} className="portal-choice" disabled={disabled} onClick={()=>choose(()=>onTravel(exit.to))}>{exit.name}<span aria-hidden="true">↗</span></button>)}
   </div>
   {section==='seats'&&(canReturn||!moving&&(me?.seat!=null||me?.station))?<div className="destination-shortcuts">
    {canReturn&&<button disabled={disabled} onClick={()=>choose(onReturn)}>원래 자리로</button>}
    {!moving&&(me?.seat!=null||me?.station)&&<button disabled={disabled} onClick={()=>choose(onStand)}>일어나 둘러보기</button>}
   </div>:<p className="destination-caption">{moving?'고르면 새 경로로 걸어가요.':'고르면 일어나서 걸어가요.'}</p>}
  </div></nav>
 </>;
}
