import {useEffect,useState} from 'react';
import {smokingDeadline,smokingPhase} from '../../shared/smoking.mjs';
import {directAction} from './directActions';
import type {Snapshot} from './types';

type Props={state:Snapshot;disabled:boolean;onUse:(id:string)=>void;anchor:(id:string)=>(element:HTMLElement|null)=>void};
export function SmokingActions({state,disabled,onUse,anchor}:Props){
 const [,wake]=useState(0),me=state.room.members.find(m=>m.id===state.self.id);
 const now=Date.now()+(state.receivedAt!==undefined?state.serverTime-state.receivedAt:0),phase=smokingPhase(me?.smoking,now);
 useEffect(()=>{
  const end=smokingDeadline(me?.smoking,now);if(!end)return;
  const timer=setTimeout(()=>wake(n=>n+1),Math.max(1,end-now+20));
  return()=>clearTimeout(timer);
 },[me?.smoking,phase,state.serverTime]);
 const cigarette=directAction(state,'cigarette'),ashtray=directAction(state,'ashtray');
 return <>
  {cigarette?<button className="world-action smoking-action" ref={anchor('smoke-cigarette')} disabled={disabled} onClick={()=>onUse('cigarette')}>{cigarette.label}</button>:
   <span className="world-status smoking-action" ref={anchor('smoke-cigarette')} role="status">{phase==='lighting'?'불을 붙이는 중':phase==='puffing'?'후—':phase==='ending'?'불을 끄는 중':''}</span>}
  {ashtray&&<button className="world-action smoking-action" ref={anchor('smoke-ashtray')} disabled={disabled} onClick={()=>onUse('ashtray')}>{ashtray.label}</button>}
 </>;
}
