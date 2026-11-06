import {closeOtherPickers} from './PersonalItems';
import {useEffect,useRef} from 'react';
import {getSpace,stations as pantryStations,type StationId} from '../../shared/space.mjs';
import type {Snapshot} from './types';
type Props={onTravel:()=>Promise<void>;onSea:()=>void;waves:boolean;onWaves:()=>void;state:Snapshot;disabled:boolean;showSeats:boolean;onClose:()=>void;onSeat:(seat:number)=>Promise<void>;onObject:(id:StationId)=>Promise<void>};
export default function ExploreDestinations({onTravel,onSea,waves,onWaves,state,disabled,showSeats,onClose,onSeat,onObject}:Props){
 const map=getSpace(state.room.area),{seats,seatTables,tables}=map,stations=map.stations as typeof pantryStations;
 const details=useRef<HTMLDetailsElement>(null),summary=useRef<HTMLElement>(null);
 function close(focus=false){if(details.current)details.current.open=false;onClose();if(focus)summary.current?.focus({preventScroll:true});}
 useEffect(()=>{if(details.current)details.current.open=showSeats;},[showSeats]);
 useEffect(()=>{const outside=(e:PointerEvent)=>{if(details.current?.open&&!details.current.contains(e.target as Node))close();};document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside);},[]);
 return <nav className="destination-bar" aria-label="이동할 곳"><details className="seat-picker" ref={details} onKeyDown={e=>{if(e.key==='Escape'&&details.current?.open){e.preventDefault();e.stopPropagation();close(true);}}} onToggle={e=>{if(e.currentTarget.open)closeOtherPickers(e.currentTarget);else onClose();}}>
  <summary ref={summary}>둘러보기 <span aria-hidden="true">⌃</span></summary>
  <div className="seat-picker-panel" aria-label="사물과 앉을 자리">
   <header className="picker-header"><strong>둘러보기</strong><button className="quiet-action" onClick={()=>close(true)} aria-label="둘러보기 닫기">닫기</button></header>
   <div className="compact-view-options"><p>손가락으로 밀어 둘러보고, 사물은 톡 눌러요.</p><div><button onClick={()=>{onSea();close(true);}}>바다 보기</button><button aria-pressed={waves} onClick={onWaves}>{waves?'파도 소리 끄기':'파도 소리 켜기'}</button></div></div>
   <button className="portal-choice" disabled={disabled} onClick={()=>{close(true);void onTravel();}}>{map.portal.name} <span aria-hidden="true">↗</span></button>{state.room.area==='healing'&&(state.self.pantry.rest.sand?.held||state.self.pantry.rest.vase?.held)&&<p className="area-count">{state.self.pantry.rest.vase?.held?'꽃병과 꽃 배치':'모래 트레이와 선·돌'}는 이곳에 보관돼요.</p>}<p className="area-count">여기 {state.room.members.filter(m=>m.connected).length}명 · 전체 {state.room.total??state.room.members.length}명 / 6명</p>
   <fieldset><legend>작은 쉼을 고르세요</legend><div className="destination-objects">{(Object.keys(stations) as StationId[]).map(id=>{const owner=state.room.members.find(m=>m.station===id),mine=owner?.id===state.self.id;return <button key={id} disabled={disabled||Boolean(owner&&!mine)} aria-pressed={mine} onClick={()=>{close(true);void onObject(id);}} aria-label={stations[id].name+(['fridge','plant','stone','tea'].includes(id)?'로':'으로')+' 이동'+(owner&&!mine?' · 이용 중':'')}><span className="destination-title">{stations[id].name}</span><small>{owner&&!mine?'이용 중':id==='sand'?'선 긋고, 돌 놓고, 잠깐 쉬기':id==='plant'?'물 한 번, 초록의 반응':id==='stone'?'누르고, 천천히 놓기':id==='tea'?'나를 위한 따뜻한 잔':''}</small></button>;})}</div></fieldset>
   {tables.map((table,t)=><fieldset key={table.id}><legend>{table.name}</legend><div className="destination-seats">{seats.map((_,i)=>{if(seatTables[i]!==t)return null;const owner=state.room.members.find(m=>m.seat===i),mine=owner?.id===state.self.id;return <button key={i} disabled={disabled||Boolean(owner)} onClick={()=>{void onSeat(i);close(true);}} aria-label={String(i+1)+'번 자리 · '+(mine?'내 자리':owner?owner.name+'님 자리':'비어 있음')}>{i+1}번 <small>{mine?'내 자리':owner?'이용 중':'빈 자리'}</small></button>;})}</div></fieldset>)}
  </div>
 </details></nav>;
}
