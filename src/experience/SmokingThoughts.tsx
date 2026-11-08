import {useEffect,useRef,useState} from 'react';
import {thoughtPhrases} from '../../shared/smoking.mjs';
import type {Snapshot,Thought} from './types';
import './smoking.css';

type Props={state:Snapshot;disabled:boolean;reduceMotion:boolean;act:(type:string,extra:Record<string,unknown>)=>Promise<unknown>};
export function SmokingThoughts({state,disabled,reduceMotion,act}:Props){
 const offset=state.receivedAt!==undefined?state.serverTime-state.receivedAt:0;
 const [revision,wake]=useState(0),[selected,setSelected]=useState<string|null>(null);
 const chooser=useRef<HTMLDetailsElement>(null),expires=state.room.thoughts??[];
 const card=useRef<HTMLElement>(null);
 const now=Date.now()+offset,notes=expires.filter(n=>n.until>now);
 const note=notes.find(n=>n.id===selected)??notes.at(-1),mine=notes.some(n=>n.mine);
 useEffect(()=>{
   const next=state.room.thoughts?.filter(n=>n.until>Date.now()+offset).sort((a,b)=>a.until-b.until)[0];
   const redraw=()=>wake(n=>n+1);
   const timer=next?window.setTimeout(redraw,Math.max(1,next.until-(Date.now()+offset)+5)):undefined;
   document.addEventListener('visibilitychange',redraw);
   return()=>{clearTimeout(timer);document.removeEventListener('visibilitychange',redraw);};
 },[state,offset,revision]);
 useEffect(()=>{
   if(!note||reduceMotion||!card.current?.animate)return;
   const remaining=Math.max(0,note.until-(Date.now()+offset)),duration=Math.min(650,remaining);
   const fade=card.current.animate([{opacity:1},{opacity:0}],{delay:remaining-duration,duration,easing:'ease-in',fill:'forwards'});
   return()=>fade.cancel();
 },[note?.id,note?.until,offset,reduceMotion]);
 async function post(phrase:Thought['phrase']){
   if(await act('thought-leave',{phrase,sentAt:Math.round(Date.now()+offset)})){
     if(chooser.current)chooser.current.open=false;setSelected(null);
   }
 }
 return <section className="terrace-thoughts" aria-label="흡연실에 잠시 놓인 한마디">
   {note&&<article ref={card} className="terrace-note" key={note.id}>
     <span className={'wind-thread'+(note.hasEcho?' resonant':'')} aria-hidden="true"><i/><i/></span>
     <p aria-live="polite">{thoughtPhrases[note.phrase]}</p>
     <div className="note-actions">
       {note.mine?<span role="status">{note.hasEcho?'누군가도 그렇대요':'내가 놓은 한마디'}</span>:<button disabled={disabled||note.echoed} aria-pressed={note.echoed} onClick={()=>void act('thought-echo',{noteId:note.id})}>{note.echoed?'공감을 보냈어요':'나도 그래요'}</button>}
       {notes.length>1&&<button onClick={()=>setSelected(notes[(notes.findIndex(n=>n.id===note.id)+1)%notes.length].id)}>다른 한마디 ›</button>}
     </div>
   </article>}
   {!mine&&<details className="thought-picker" ref={chooser} onKeyDown={e=>{if(e.key==='Escape'&&chooser.current){chooser.current.open=false;chooser.current.querySelector('summary')?.focus();e.stopPropagation();}}}>
     <summary>한마디 놓기</summary><div><p>이 방에 잠시 보이다 흩어져요.</p>
     {Object.entries(thoughtPhrases).map(([id,text])=><button key={id} disabled={disabled} onClick={()=>void post(id as Thought['phrase'])}>{text}</button>)}
     </div>
   </details>}
 </section>;
}
