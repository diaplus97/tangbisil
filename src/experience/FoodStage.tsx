import {lazy,Suspense,useEffect,useRef,useState,type PointerEvent} from 'react';
import {drawFood} from './pixelArt';
import {drawSnackFallback} from './snackFallback';
import type {Serving} from './types';
import {snackOpenSound,wrapperMotion,stopWrapperSound,stopSnackSound} from './sound';
import {snackDefinition,LEGACY_SNACK_ID} from '../../shared/snacks.mjs';
import {snackBiteProfiles} from './snackBiteMotion';
const Food3D=lazy(()=>import('./Food3D'));

type Props={onFlush?:(flush:(()=>Promise<boolean>)|null)=>void;serving:Serving;busy:boolean;appearance?:'pixel'|'3d';onProgress:(progress:number)=>Promise<unknown>;onOpen:()=>Promise<unknown>;onBite:()=>Promise<unknown>};
export function FoodStage({onFlush,serving,busy,appearance='pixel',onProgress,onOpen,onBite}:Props){
  const definition=snackDefinition(serving.snack_id,serving.definition_version??1)??snackDefinition(LEGACY_SNACK_ID)!;
  const initial=serving.state==='sealed'?(serving.open_progress||0):1;
  const canvas=useRef<HTMLCanvasElement>(null),drag=useRef<{x:number;y:number;id:number;progress:number;moved:boolean}|null>(null);
  const pendingSave=useRef<Promise<unknown>|null>(null);
  const live=useRef(true),biting=useRef(false),lastBite=useRef(-Infinity);
  const suppressBite=useRef(false),[cancelToken,setCancelToken]=useState(0);
  const anim=useRef(0),progressRef=useRef(initial),submitted=useRef(initial),opening=useRef(false),animating=useRef(false);
  const latest=useRef({onProgress,serving});latest.current={onProgress,serving};
  const lastMotion=useRef(performance.now()),tap=useRef<{x:number;y:number;id:number;moved:boolean}|null>(null);
  const [progress,setProgress]=useState(initial),[dragging,setDragging]=useState(false);
  const [crunch,setCrunch]=useState(0),[unwrapping,setUnwrapping]=useState(false),[fallback,setFallback]=useState(false);
  const prevBites=useRef(serving.bites),pixel=appearance==='pixel'||fallback;
  const label=definition.name+' · '+(serving.state==='sealed'?definition.openingLabel:serving.state==='empty'?'다 먹은 접시':definition.description);
  useEffect(()=>{const p=serving.state==='sealed'?(serving.open_progress||0):1;submitted.current=Math.max(submitted.current,p);if(p>progressRef.current){setProgress(p);progressRef.current=p;}},[serving.id,serving.state,serving.open_progress]);
  useEffect(()=>{if(serving.bites>prevBites.current&&!suppressBite.current)setCrunch(Date.now());prevBites.current=serving.bites;},[serving.bites]);
  useEffect(()=>{
    if(!pixel)return;
    let frame=0;const c=canvas.current!.getContext('2d')!;
    function render(){if(definition.kind==='lemonPie')drawFood(c,progress,serving.bites,serving.state==='empty',serving.portions===1,Date.now()-crunch);else drawSnackFallback(c,definition.kind,progress,serving.bites,serving.state==='empty');if(Date.now()-crunch<650)frame=requestAnimationFrame(render);}
    render();return()=>cancelAnimationFrame(frame);
  },[progress,serving,crunch,pixel]);
  async function saveProgress():Promise<boolean>{
    if(pendingSave.current){const ok=await pendingSave.current;if(!ok)return false;return saveProgress();}
    const p=Math.min(.984,progressRef.current);
    if(opening.current||latest.current.serving.state!=='sealed'||p<=submitted.current+.001)return true;
    submitted.current=p;pendingSave.current=latest.current.onProgress(p);const result=await pendingSave.current;pendingSave.current=null;
    if(!result)submitted.current=latest.current.serving.open_progress||0;return Boolean(result);
  }
  async function cancelGesture(){suppressBite.current=true;setCancelToken(n=>n+1);tap.current=null;drag.current=null;cancelAnimationFrame(anim.current);animating.current=false;setDragging(false);setUnwrapping(false);stopWrapperSound();stopSnackSound();return await saveProgress();}
  useEffect(()=>{onFlush?.(cancelGesture);return()=>onFlush?.(null);},[onFlush]);
  useEffect(()=>{live.current=true;const hidden=()=>{if(document.hidden)cancelGesture();};document.addEventListener('visibilitychange',hidden);window.addEventListener('blur',cancelGesture);return()=>{live.current=false;document.removeEventListener('visibilitychange',hidden);window.removeEventListener('blur',cancelGesture);cancelAnimationFrame(anim.current);stopWrapperSound();void saveProgress();};},[]);
  async function finish(){
    if(opening.current||busy){setUnwrapping(false);return;}
    opening.current=true;setUnwrapping(true);stopWrapperSound();
    const result=await onOpen();if(live.current){const p=result?1:latest.current.serving.open_progress||0;setProgress(p);progressRef.current=p;if(result)snackOpenSound(definition.kind);setUnwrapping(false);}
    opening.current=false;
  }
  function accessibleOpen(){
    if(opening.current||animating.current||busy||drag.current)return;
    let reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;try{reduced||=localStorage.getItem('tangbisil:reduce-motion')==='on';}catch{}
    if(reduced){void finish();return;}
    animating.current=true;setUnwrapping(true);const start=performance.now(),from=progressRef.current;
    function move(now:number){const p=from+(.984-from)*Math.min(1,(now-start)/650);wrapperMotion(Math.max(0,.984-from)/.65,p,definition.kind);setProgress(p);progressRef.current=p;if(now-start<650)anim.current=requestAnimationFrame(move);else{animating.current=false;void finish();}}
    anim.current=requestAnimationFrame(move);
  }
  function pointerDown(e:PointerEvent<HTMLDivElement>){
    if(e.isPrimary&&e.button===0&&serving.state==='open'&&!busy){tap.current={x:e.clientX,y:e.clientY,id:e.pointerId,moved:false};e.currentTarget.setPointerCapture(e.pointerId);return;}
    if(!e.isPrimary||e.button!==0||drag.current||serving.state!=='sealed'||busy||opening.current||animating.current)return;
    e.currentTarget.setPointerCapture(e.pointerId);drag.current={x:e.clientX,y:e.clientY,id:e.pointerId,progress:progressRef.current,moved:false};lastMotion.current=performance.now();setDragging(true);
  }
  function pointerMove(e:PointerEvent<HTMLDivElement>){
    if(tap.current&&Math.hypot(e.clientX-tap.current.x,e.clientY-tap.current.y)>6)tap.current.moved=true;
    if(!drag.current||e.pointerId!==drag.current.id||busy)return;
    if(Math.hypot(e.clientX-drag.current.x,e.clientY-drag.current.y)>6)drag.current.moved=true;
    const width=e.currentTarget.getBoundingClientRect().width,p=Math.max(progressRef.current,Math.min(1,drag.current.progress+(definition.opening==='slide'?drag.current.x-e.clientX:definition.opening==='gather'||definition.opening==='fold'?Math.abs(e.clientX-drag.current.x):e.clientX-drag.current.x)/(width*.28)));
    const now=performance.now(),speed=Math.abs(p-progressRef.current)/Math.max(.016,(now-lastMotion.current)/1000);lastMotion.current=now;wrapperMotion(speed,p,definition.kind);
    progressRef.current=p;setProgress(p);
  }
  function pointerUp(e:PointerEvent<HTMLDivElement>){
    if(tap.current?.id===e.pointerId){const touch=tap.current;tap.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);if(!touch.moved&&serving.state==='open'&&!busy)void bite();return;}
    if(!drag.current||e.pointerId!==drag.current.id)return;
    const moved=drag.current.moved;drag.current=null;setDragging(false);stopWrapperSound();
    if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
    if(progressRef.current>=.985)void finish();else if(!moved)accessibleOpen();else void saveProgress();
  }
  async function bite(){const now=performance.now();if(biting.current||busy||now-lastBite.current<snackBiteProfiles[definition.kind].duration)return;suppressBite.current=false;lastBite.current=now;biting.current=true;try{await onBite();}finally{biting.current=false;}}
  return <div className="food-interaction">
    <div className={`food-stage ${dragging?'dragging':''} ${serving.state}`} tabIndex={0} role="button" aria-label={definition.name+' '+(serving.state==='sealed'?'포장 열기':serving.state==='open'?'한입 먹기':'다 먹은 접시')} aria-disabled={busy||serving.state==='empty'} onKeyDown={e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();e.stopPropagation();if(!busy&&!e.repeat){if(serving.state==='sealed')accessibleOpen();else if(serving.state==='open')void bite();}}}} data-testid="food-stage" data-serving-id={serving.id} data-bites={serving.bites} data-state={serving.state} data-progress={progress.toFixed(3)}
      onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp}
      onPointerCancel={cancelGesture} onLostPointerCapture={()=>{if(drag.current||tap.current)cancelGesture();}}>
      {pixel?<canvas ref={canvas} width="320" height="200" aria-label={label}/>:<Suspense fallback={<div className="food-three-loading">접시를 놓는 중…</div>}><Food3D food={serving} progress={progress} bites={serving.bites} empty={serving.state==='empty'} sample={serving.portions===1} crunch={crunch} cancelToken={cancelToken} label={label} onUnavailable={()=>setFallback(true)}/></Suspense>}
      {serving.state==='sealed'&&<div className="drag-hint" aria-hidden="true">{progress>.01?(dragging?'사각사각, 원하는 만큼.':'뜯던 곳에서 이어 당기거나 톡 누르세요.'):definition.openingLabel+' · 톡 눌러도 열려요'} <span>⟶</span></div>}
      {serving.state==='sealed'&&<div className="wrapper-progress" role="progressbar" aria-label="포장 열림" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress*100)}><span style={{width:progress*100+'%'}}/></div>}
      {serving.state==='empty'&&<span className="plate-note">잘 먹었습니다.</span>}
    </div>
    {appearance==='pixel'&&<div className="food-action-row">
      {serving.state==='sealed'?<><span className="interaction-note">{progress>.01?'뜯던 곳에서 이어서 열어요.':definition.openingLabel}</span><button className="primary" onClick={accessibleOpen} disabled={busy||unwrapping}>{unwrapping?'포장을 여는 중…':progress>.01?'이어서 포장 열기':'포장 열기'} <span aria-hidden="true">↗</span></button></>:
        serving.state==='open'?<><span className="interaction-note">{serving.portions===1?'누군가 나눠준, 작은 한 조각.':serving.bites===0?definition.description:serving.bites===1?'한입 베어 문 단면이 보여요.':'접시에 조금 남아 있어요.'}</span><button className="primary" disabled={busy} onClick={()=>void bite()}>{busy?'접시에 남기는 중…':'한입 먹기'} <span>↗</span></button></>:
        <span className="interaction-note">맛본 기억은 앨범에 남아 있어요.</span>}
    </div>}
  </div>;
}
