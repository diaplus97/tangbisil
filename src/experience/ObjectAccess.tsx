import {useEffect,useState} from 'react';
import {smokingDeadline,smokingPhase} from '../../shared/smoking.mjs';
import {directAction} from './directActions';
import {getSpace} from '../../shared/space.mjs';
import type {Snapshot} from './types';

type Props={state:Snapshot;disabled:boolean;moving:boolean;sampleAvailable:boolean;onUse:(target:string)=>void;onSeat:(seat:number)=>void;onFocus:(target:string|null)=>void;anchor:(target:string)=>(el:HTMLElement|null)=>void};
// Native keyboard targets are revealed one at a time by focus, never as a second action bar.
export function ObjectAccess({state,disabled,moving,sampleAvailable,onUse,onSeat,onFocus,anchor}:Props){
 const [,wake]=useState(0),me=state.room.members.find(m=>m.id===state.self.id),p=state.self.pantry,now=Date.now()+(state.receivedAt!==undefined?state.serverTime-state.receivedAt:0);
 const phase=smokingPhase(me?.smoking,now);
 useEffect(()=>{const end=smokingDeadline(me?.smoking,now);if(!end)return;const timer=setTimeout(()=>wake(n=>n+1),Math.max(1,end-now+20));return()=>clearTimeout(timer);},[me?.smoking,phase,state.serverTime]);
 const targets:string[]=[];
 if(!moving){
  if(state.room.area==='smoking'&&me?.seat!=null)targets.push('cigarette','ashtray');
  else{
   if(me?.station)targets.push(...(me.station==='snacks'?['snack-slot-0','snack-slot-1','snack-slot-2']:me.station==='plant'?['plant','plant-stand','leaf']:me.station==='stone'?['stone-basket']:me.station==='tea'?['tea-cup','tea-kettle','tea-tin','tea-bag']:me.station==='flower'?['flower-cosmos','flower-poppy','flower-cornflower']:me.station==='fridge'?['fridge-door','fridge-bottle']:[me.station]));
   if(me?.seat!=null){targets.push('cup','held');if(state.room.area==='pantry')targets.push('snack');if(sampleAvailable)targets.push('shared');
    if(p.candy&&!p.candy.held&&p.candy.state!=='eaten')targets.push('candy');
    if(p.rest.stone&&!p.rest.stone.held)targets.push('stone-held');
    if(p.rest.sand&&!p.rest.sand.held)targets.push('sand-held');
    if(p.rest.vase&&!p.rest.vase.held)targets.push('vase-held');
   }
  }
 }
 return <div className="object-access-group" aria-label="공간의 물건과 자리">
  {[...new Set(targets)].map(target=>{const action=directAction(state,target),waiting=target==='cigarette'?(phase==='lighting'?'불을 붙이는 중':phase==='puffing'?'천천히 내쉬는 중':phase==='ending'?'담배를 끄는 중':''):target==='coffee'&&p.coffee.stage==='brewing'?'커피가 내려오는 중':'';return(action||waiting)&&<button key={target} ref={anchor('access-'+target)} className="object-access" disabled={disabled} aria-disabled={!action||disabled} onFocus={()=>onFocus('action-'+target)} onBlur={()=>onFocus(null)} onClick={()=>{if(action)onUse(target);}}>{action?.label??waiting}<kbd>Enter</kbd></button>;})}
  {getSpace(state.room.area).seats.map((_,i)=>!state.room.members.some(m=>m.seat===i)&&<button key={'seat-'+i} ref={anchor('access-seat-'+i)} className="object-access" disabled={disabled} onFocus={()=>onFocus('seat-'+i)} onBlur={()=>onFocus(null)} onClick={()=>onSeat(i)}>{i+1}번 빈 자리에 앉기<kbd>Enter</kbd></button>)}
  {state.room.area==='smoking'&&<span className="sr-only" role="status">{phase==='lighting'?'불을 붙이는 중':phase==='puffing'?'한 모금 내쉬는 중':phase==='ending'?'담배를 끄는 중':''}</span>}
 </div>;
}
