import {lazy,Suspense,useEffect,useRef,useState,type PointerEvent} from 'react';
import {drawFood} from './pixelArt';
import type {Serving} from './types';
import {playSound,wrapperMotion,stopWrapperSound} from './sound';
const Food3D=lazy(()=>import('./Food3D'));

type Props={serving:Serving;busy:boolean;appearance?:'pixel'|'3d';onProgress:(progress:number)=>Promise<unknown>;onOpen:()=>Promise<unknown>;onBite:()=>Promise<unknown>};
export function FoodStage({serving,busy,appearance='pixel',onProgress,onOpen,onBite}:Props){
  const initial=serving.state==='sealed'?(serving.open_progress||0):1;
  const canvas=useRef<HTMLCanvasElement>(null),drag=useRef<{x:number;id:number;progress:number}|null>(null);
  const anim=useRef(0),progressRef=useRef(initial),submitted=useRef(initial),opening=useRef(false),animating=useRef(false);
  const latest=useRef({onProgress,serving});latest.current={onProgress,serving};
  const lastMotion=useRef(performance.now()),tap=useRef<{x:number;y:number;id:number;moved:boolean}|null>(null);
  const [progress,setProgress]=useState(initial),[dragging,setDragging]=useState(false);
  const [crunch,setCrunch]=useState(0),[unwrapping,setUnwrapping]=useState(false),[fallback,setFallback]=useState(false);
  const prevBites=useRef(serving.bites),pixel=appearance==='pixel'||fallback;
  const label=serving.state==='sealed'?'포장 오른쪽을 잡고 오른쪽으로 당겨 여는 레몬 샌드파이':serving.state==='empty'?'다 먹은 접시와 접힌 포장':'레몬 크림 단면이 보이는 샌드파이';
  useEffect(()=>{const p=serving.state==='sealed'?(serving.open_progress||0):1;submitted.current=Math.max(submitted.current,p);if(p>progressRef.current){setProgress(p);progressRef.current=p;}},[serving.id,serving.state,serving.open_progress]);
  useEffect(()=>{if(serving.bites>prevBites.current)setCrunch(Date.now());prevBites.current=serving.bites;},[serving.bites]);
  useEffect(()=>{
    if(!pixel)return;
    let frame=0;const c=canvas.current!.getContext('2d')!;
    function render(){drawFood(c,progress,serving.bites,serving.state==='empty',serving.portions===1,Date.now()-crunch);if(Date.now()-crunch<650)frame=requestAnimationFrame(render);}
    render();return()=>cancelAnimationFrame(frame);
  },[progress,serving,crunch,pixel]);
  async function saveProgress(){
    const p=Math.min(.984,progressRef.current);
    if(opening.current||latest.current.serving.state!=='sealed'||p<=submitted.current+.001)return;
    submitted.current=p;const result=await latest.current.onProgress(p);
    if(!result)submitted.current=latest.current.serving.open_progress||0;
  }
  useEffect(()=>()=>{cancelAnimationFrame(anim.current);stopWrapperSound();void saveProgress();},[]);
  async function finish(){
    if(opening.current||busy){setUnwrapping(false);return;}
    opening.current=true;setUnwrapping(true);setProgress(1);progressRef.current=1;stopWrapperSound();playSound('open');
    const result=await onOpen();if(!result){const p=latest.current.serving.open_progress||0;setProgress(p);progressRef.current=p;}
    opening.current=false;setUnwrapping(false);
  }
  function accessibleOpen(){
    if(opening.current||animating.current||busy||drag.current)return;
    animating.current=true;setUnwrapping(true);const start=performance.now(),from=progressRef.current;
    function move(now:number){const p=from+(1-from)*Math.min(1,(now-start)/650);wrapperMotion((1-from)/.65,p);setProgress(p);progressRef.current=p;if(p<1)anim.current=requestAnimationFrame(move);else{animating.current=false;void finish();}}
    anim.current=requestAnimationFrame(move);
  }
  function pointerDown(e:PointerEvent<HTMLDivElement>){
    if(e.isPrimary&&e.button===0&&serving.state==='open'&&!busy){tap.current={x:e.clientX,y:e.clientY,id:e.pointerId,moved:false};e.currentTarget.setPointerCapture(e.pointerId);return;}
    if(!e.isPrimary||e.button!==0||drag.current||serving.state!=='sealed'||busy||opening.current||animating.current)return;
    e.currentTarget.setPointerCapture(e.pointerId);drag.current={x:e.clientX,id:e.pointerId,progress:progressRef.current};lastMotion.current=performance.now();setDragging(true);
  }
  function pointerMove(e:PointerEvent<HTMLDivElement>){
    if(tap.current&&Math.hypot(e.clientX-tap.current.x,e.clientY-tap.current.y)>6)tap.current.moved=true;
    if(!drag.current||e.pointerId!==drag.current.id||busy)return;
    const width=e.currentTarget.getBoundingClientRect().width,p=Math.max(progressRef.current,Math.min(1,drag.current.progress+(e.clientX-drag.current.x)/(width*.28)));
    const now=performance.now(),speed=Math.abs(p-progressRef.current)/Math.max(.016,(now-lastMotion.current)/1000);lastMotion.current=now;wrapperMotion(speed,p);
    progressRef.current=p;setProgress(p);
  }
  function pointerUp(e:PointerEvent<HTMLDivElement>){
    if(tap.current?.id===e.pointerId){const touch=tap.current;tap.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);if(!touch.moved&&serving.state==='open'&&!busy)void onBite();return;}
    if(!drag.current||e.pointerId!==drag.current.id)return;
    drag.current=null;setDragging(false);stopWrapperSound();
    if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
    if(progressRef.current>=.985)void finish();else void saveProgress();
  }
  return <div className="food-interaction">
    <div className={`food-stage ${dragging?'dragging':''} ${serving.state}`} data-testid="food-stage" data-serving-id={serving.id} data-bites={serving.bites} data-state={serving.state} data-progress={progress.toFixed(3)}
      onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp}
      onPointerCancel={()=>{tap.current=null;if(!drag.current)return;drag.current=null;setDragging(false);stopWrapperSound();void saveProgress();}}>
      {pixel?<canvas ref={canvas} width="320" height="200" aria-label={label}/>:<Suspense fallback={<div className="food-three-loading">접시를 놓는 중…</div>}><Food3D progress={progress} bites={serving.bites} empty={serving.state==='empty'} sample={serving.portions===1} crunch={crunch} label={label} onUnavailable={()=>setFallback(true)}/></Suspense>}
      {serving.state==='sealed'&&<div className="drag-hint" aria-hidden="true">{progress>.01?(dragging?'사각사각, 원하는 만큼.':'뜯던 곳에서 이어 당겨요.'):'포장을 잡고 오른쪽으로'} <span>⟶</span></div>}
      {serving.state==='empty'&&<span className="plate-note">잘 먹었습니다.</span>}
    </div>
    <div className="food-action-row">
      {serving.state==='sealed'?<><span className="interaction-note">{progress>.01?'뜯던 곳에서 이어서 열어요.':'오른쪽으로 당기거나 버튼을 눌러요.'}</span><button className="primary" onClick={accessibleOpen} disabled={busy||unwrapping}>{unwrapping?'포장을 여는 중…':progress>.01?'이어서 포장 열기':'포장 열기'} <span aria-hidden="true">↗</span></button></>:
        serving.state==='open'?<><span className="interaction-note">{serving.portions===1?'누군가 나눠준, 작은 한 조각.':serving.bites===0?'바삭한 겉면, 부드러운 크림.':serving.bites===1?'사이사이 레몬잼이 보여요.':'접시에 조금 남아 있어요.'}</span><button className="primary" disabled={busy} onClick={()=>void onBite()}>{busy?'접시에 남기는 중…':'한입 먹기'} <span>↗</span></button></>:
        <span className="interaction-note">맛본 기억은 앨범에 남아 있어요.</span>}
    </div>
  </div>;
}
