import {passPointerToRoom} from './stagePointer';
import {useEffect,useRef} from 'react';
import * as T from 'three';
import {useInputMethod} from './useInputMethod';
import {Workshop,makeRenderer} from './three/assets';
import {stoneModel} from './three/restModels';
import type {Snapshot} from './types';
export default function StoneStage({state,disabled,onPress}:{state:Snapshot;disabled:boolean;onPress:(point:number[])=>Promise<unknown>}){
 const input=useInputMethod();
 const canvas=useRef<HTMLCanvasElement>(null),latest=useRef({state,received:performance.now(),disabled,onPress});
 latest.current={state,received:latest.current.state===state?latest.current.received:performance.now(),disabled,onPress};
 useEffect(()=>{
  const element=canvas.current!,renderer=makeRenderer(element);renderer.setClearColor(0,0);renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  const kit=new Workshop(),scene=new T.Scene(),camera=new T.PerspectiveCamera(32,1,.01,5);camera.position.set(0,.12,.86);camera.lookAt(0,0,0);
  scene.add(new T.HemisphereLight('#fff8e8','#749087',2.5));const key=new T.DirectionalLight('#fff4d8',2.2);key.position.set(-2,3,3);scene.add(key);
  const stone=stoneModel(kit,scene);stone.group.rotation.z=-.08;
  for(const side of[-1,1]){const palm=kit.sphere(scene,.066,side*.145,-.065,.01,'#dfb599',.65,.8,1.25);palm.rotation.z=side*.3;kit.box(scene,.095,.38,.18,side*.18,-.27,.07,'#6d8c99',.03);}
  const ray=new T.Raycaster(),pointer=new T.Vector2();let raf=0,last=0;
  const resized=()=>{const r=element.getBoundingClientRect();camera.aspect=r.width/r.height;camera.updateProjectionMatrix();renderer.setSize(r.width,r.height,false);};const observer=new ResizeObserver(resized);observer.observe(element);resized();
  const press=(e:PointerEvent)=>{e.preventDefault();e.stopPropagation();if(latest.current.disabled)return;const r=element.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2);ray.setFromCamera(pointer,camera);const hit=ray.intersectObject(stone.mesh)[0];if(!hit){passPointerToRoom(e,element);return;}const local=stone.mesh.worldToLocal(hit.point);void latest.current.onPress([T.MathUtils.clamp(local.x/.11,-1,1),T.MathUtils.clamp(local.y/.075,-1,1)]);};
  element.addEventListener('pointerdown',press);
  function frame(time:number){if(time-last>30&&!document.hidden){const {state,received}=latest.current,s=state.self.pantry.rest.stone;stone.deform(state.serverTime+performance.now()-received-(s?.pressAt??0),s?.point,matchMedia('(prefers-reduced-motion: reduce)').matches);renderer.render(scene,camera);last=time;}raf=requestAnimationFrame(frame);}raf=requestAnimationFrame(frame);
  return()=>{cancelAnimationFrame(raf);observer.disconnect();element.removeEventListener('pointerdown',press);kit.dispose();renderer.dispose();renderer.forceContextLoss();};
 },[]);
 return <div className="stone-stage"><canvas ref={canvas} tabIndex={0} role="button" aria-disabled={disabled} aria-label={input==='touch'?'말랑돌. 원하는 곳을 톡 눌러보세요.':input==='keyboard'?'말랑돌. Enter 또는 Space로 눌러보세요.':'말랑돌. 누를 곳을 클릭해 보세요.'} onKeyDown={e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();e.stopPropagation();if(!disabled&&!e.repeat)void onPress([0,0]);}}}/></div>;
}
