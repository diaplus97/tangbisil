import {useEffect,useRef,useState} from 'react';
import {normalizeThought,thoughtFadeMs,thoughtInterval,thoughtLifetime,thoughtMaxLength,thoughtPhrases,smokingPhase,smokingDeadline} from '../../shared/smoking.mjs';
import type {Snapshot,Thought} from './types';
import './smoking.css';

type Props={state:Snapshot;disabled:boolean;reduceMotion:boolean;act:(type:string,extra:Record<string,unknown>)=>Promise<unknown>};
function ThoughtCard({note,offset,reduceMotion,disabled,act}:Omit<Props,'state'>&{note:Thought;offset:number}){
 const card=useRef<HTMLElement>(null);
 useEffect(()=>{
  if(reduceMotion||!card.current?.animate)return;
  const remaining=Math.max(0,note.until-Date.now()-offset),duration=Math.min(thoughtFadeMs,remaining);
  const fade=card.current.animate([{opacity:Math.min(1,remaining/thoughtFadeMs)},{opacity:0}],{delay:Math.max(0,remaining-duration),duration,easing:'linear',fill:'forwards'});
  return()=>fade.cancel();
 },[note.id,note.until,offset,reduceMotion]);
 const text=note.text??(note.phrase?thoughtPhrases[note.phrase]:'');
 return <article ref={card} className="terrace-note" data-note-id={note.id} aria-label={note.mine?'내 한마디':'동료의 한마디'}>
  <p>{text}</p>
  <div className="note-actions">{note.mine?<span>{note.hasEcho?'누군가도 그렇대요':'내 한마디'}</span>:<button className="note-echo" disabled={disabled||note.echoed} aria-pressed={note.echoed} onClick={()=>void act('thought-echo',{noteId:note.id})}>{note.echoed?'공감을 보냈어요':'나도 그래요'}</button>}</div>
 </article>;
}
export function SmokingThoughts({state,disabled,reduceMotion,act}:Props){
 const offset=state.receivedAt!==undefined?state.serverTime-state.receivedAt:0;
 const [revision,wake]=useState(0),[draft,setDraft]=useState(''),[sending,setSending]=useState(false),[writing,setWriting]=useState(false),[keyboard,setKeyboard]=useState(false);
 const chooser=useRef<HTMLDetailsElement>(null),field=useRef<HTMLTextAreaElement>(null),root=useRef<HTMLElement>(null),composing=useRef(false),inFlight=useRef(false);
 const supported=Array.isArray(state.room.messages),expires=state.room.messages??state.room.thoughts??[],now=Date.now()+offset,notes=expires.filter(n=>n.until>now);
 const mine=notes.find(n=>n.mine),readyAt=mine?(mine.createdAt??mine.until-thoughtLifetime)+thoughtInterval:0,waiting=readyAt>now;
 const smoking=state.room.members.find(m=>m.id===state.self.id)?.smoking,smokeEnd=smokingDeadline(smoking,now),gesturing=['lighting','puffing','ending'].includes(smokingPhase(smoking,now));
 const text=normalizeThought(draft),length=[...draft.normalize('NFC')].length;
 useEffect(()=>{
  const next=Math.min(...expires.filter(n=>n.until>Date.now()+offset).map(n=>n.until),...[readyAt,smokeEnd].filter(t=>t>Date.now()+offset));
  const redraw=()=>wake(n=>n+1),timer=Number.isFinite(next)?window.setTimeout(redraw,Math.max(1,next-Date.now()-offset+5)):undefined;
  document.addEventListener('visibilitychange',redraw);return()=>{clearTimeout(timer);document.removeEventListener('visibilitychange',redraw);};
 },[state,offset,revision,readyAt,smokeEnd]);
 useEffect(()=>{
  const viewport=window.visualViewport;
  const resize=()=>{if(!root.current)return;const bottom=viewport?viewport.height+viewport.offsetTop:innerHeight,inset=Math.max(0,root.current.getBoundingClientRect().bottom-bottom);root.current.style.setProperty('--chat-keyboard-offset',inset+'px');setKeyboard(inset>80);};
  resize();viewport?.addEventListener('resize',resize);viewport?.addEventListener('scroll',resize);window.addEventListener('resize',resize);
  return()=>{viewport?.removeEventListener('resize',resize);viewport?.removeEventListener('scroll',resize);window.removeEventListener('resize',resize);};
 },[]);
 function close(){if(chooser.current){chooser.current.open=false;chooser.current.querySelector('summary')?.focus();}setWriting(false);}
 async function post(){
  if(!supported||disabled||inFlight.current||composing.current||waiting||!text)return;
  const submitted=draft;
  inFlight.current=true;setSending(true);
  try{if(await act('thought-say',{text,sentAt:Math.round(Date.now()+offset)})){setDraft(current=>current===submitted?'':current);field.current?.focus();}}
  finally{inFlight.current=false;setSending(false);}
 }
 return <section ref={root} className="terrace-thoughts" data-writing={writing} data-keyboard={keyboard} data-gesture={gesturing} aria-label="흡연실 한마디">
  <div className="terrace-notes" aria-live="polite" aria-relevant="additions text">{notes.slice(-1).map(note=><ThoughtCard key={note.id} note={note} offset={offset} reduceMotion={reduceMotion} disabled={disabled} act={act}/>)}</div>
  {supported?<details className="thought-picker" ref={chooser} onToggle={e=>{if(e.currentTarget.open)field.current?.focus();else setWriting(false);}} onKeyDown={e=>{if(e.key==='Escape'&&!composing.current&&!e.nativeEvent.isComposing){e.preventDefault();e.stopPropagation();close();}}}>
   <summary>한마디 쓰기</summary>
   <div><form className="thought-composer" onSubmit={e=>{e.preventDefault();void post();}}>
    <label htmlFor="terrace-message">지금 떠오른 한마디</label>
    <textarea ref={field} id="terrace-message" rows={2} value={draft} maxLength={thoughtMaxLength*2} placeholder="잠깐 나누고 싶은 이야기를 적어요" onChange={e=>setDraft(e.target.value)} onFocus={()=>setWriting(true)} onBlur={()=>setWriting(false)} onCompositionStart={()=>{composing.current=true;}} onCompositionEnd={()=>{composing.current=false;}} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!composing.current&&!e.nativeEvent.isComposing&&e.nativeEvent.keyCode!==229){e.preventDefault();void post();}}} aria-describedby="terrace-message-limit"/>
    <div className="thought-compose-actions"><small id="terrace-message-limit">{waiting?'잠깐 여백을 두어요':`${length} / ${thoughtMaxLength}자`}</small><button type="button" onClick={close}>접기</button><button type="submit" disabled={disabled||sending||waiting||!text}>{sending?'보내는 중':'보내기'}</button></div>
   </form></div>
  </details>:<p className="thought-picker">새로고침 후 한마디를 쓸 수 있어요.</p>}
 </section>;
}
