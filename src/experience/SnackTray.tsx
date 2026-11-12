import {useEffect,useRef} from 'react';
import {snackDefinition} from '../../shared/snacks.mjs';
import {FoodStage} from './FoodStage';
import type {Snapshot} from './types';

type Props={onFlush?:(flush:(()=>Promise<boolean>)|null)=>void;state:Snapshot;appearance:'pixel'|'3d';busy:boolean;online:boolean;onClose:()=>void;onProgress:(progress:number)=>Promise<unknown>;onOpen:()=>Promise<unknown>;onBite:()=>Promise<unknown>;onOffer?:()=>Promise<unknown>};
export function sharedStatus(taken=0,tasted=0){return tasted>0?'함께 맛본 조각이 있어요.':taken>0?'누군가 한 조각 가져갔어요.':'한 조각을 공용 접시에 놓아두었어요.';}

export function SnackTray({onFlush,state,appearance,busy,online,onClose,onProgress,onOpen,onBite,onOffer}:Props){
  const ref=useRef<HTMLElement>(null),food=state.self.serving,canShare=Boolean(onOffer&&food?.state==='open'&&food.bites<food.portions);
  const own=state.room.offers.find(o=>o.owner_id===state.self.id),disabled=busy||!online;
  useEffect(()=>{ref.current?.focus({preventScroll:true});},[]);
  if(!food)return null;
  return <section ref={ref} className={'snack-tray simple-tray'+(appearance==='3d'?' wrapper-inset':'')} aria-label="간식 먹기" tabIndex={-1}
    onPointerDown={e=>e.stopPropagation()} onPointerUp={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}
    onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();onClose();}}}>
    <header className="simple-tray-head"><h2>{(food.source==='shared'?'나눔 · ':'')+(snackDefinition(food.snack_id,food.definition_version??1)?.name??'내 간식')}</h2>
      <button className={food.state==='empty'?'primary tray-rest':'tray-rest'} aria-label="포장 자세히 보기 닫기" onClick={onClose}><span className="desktop-label">닫기</span><span className="compact-label">닫기</span> <span aria-hidden="true">⌄</span></button>
    </header>
    <FoodStage onFlush={onFlush} key={food.id} appearance={appearance} serving={food} busy={disabled} onProgress={onProgress} onOpen={onOpen} onBite={onBite}/>
    {canShare&&<footer className="simple-tray-foot">
      {own?<p className="shared-status" role="status" data-taken={own.taken} data-tasted={own.tasted}><span className="desktop-label">{sharedStatus(own.taken,own.tasted)}</span><span className="compact-label">나눔 완료</span></p>:
        <button className="share-snack" aria-label="한 조각 나누기" disabled={disabled} onClick={()=>void onOffer?.()}><span className="desktop-label">한 조각 나누기</span><span className="compact-label">나누기</span> <span aria-hidden="true">↗</span></button>}
    </footer>}
    {!online&&<p className="tray-offline" role="status">다시 연결되면 이 간식에서 이어갈 수 있어요.</p>}
  </section>;
}
