import {useSyncExternalStore} from 'react';
type Method='touch'|'mouse'|'keyboard';
let current:Method=typeof matchMedia!=='undefined'&&matchMedia('(pointer: coarse)').matches?'touch':'mouse';
const listeners=new Set<()=>void>();
function change(next:Method){if(current===next)return;current=next;for(const listener of listeners)listener();}
const pointer=(event:PointerEvent)=>change(event.pointerType==='touch'?'touch':'mouse');
const keyboard=(event:KeyboardEvent)=>{if(['Tab','Enter',' ','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(event.key))change('keyboard');};
function subscribe(listener:()=>void){
 // Observe before object controls stop propagation to keep camera input separate.
 if(!listeners.size){document.addEventListener('pointerdown',pointer,{passive:true,capture:true});document.addEventListener('keydown',keyboard,true);}
 listeners.add(listener);return()=>{listeners.delete(listener);if(!listeners.size){document.removeEventListener('pointerdown',pointer,true);document.removeEventListener('keydown',keyboard,true);}};
}
export function useInputMethod(){return useSyncExternalStore(subscribe,()=>current,()=>'mouse' as Method);}

const compactQuery=typeof matchMedia==='undefined'?null:matchMedia('(max-width:650px)');
function subscribeCompact(listener:()=>void){compactQuery?.addEventListener('change',listener);return()=>compactQuery?.removeEventListener('change',listener);}
export function useCompactLayout(){return useSyncExternalStore(subscribeCompact,()=>compactQuery?.matches??false,()=>false);}
