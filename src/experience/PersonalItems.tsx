import {createContext,useContext,useEffect,useRef,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {useCompactLayout} from './useInputMethod';
export const ToolsDockContext=createContext<HTMLElement|null>(null);
export function closeOtherPickers(current:HTMLDetailsElement){for(const other of document.querySelectorAll<HTMLDetailsElement>('.pantry-app details[open]'))if(other!==current&&!other.contains(current)&&!current.contains(other))other.open=false;}
export function PersonalItems({children,label='내려둔 물건',dockable=true}:{children:ReactNode;label?:string;dockable?:boolean}){
 const dock=useContext(ToolsDockContext),compact=useCompactLayout(),docked=Boolean(compact&&dock&&dockable),title=docked?'내 물건':label;
 const details=useRef<HTMLDetailsElement>(null),summary=useRef<HTMLElement>(null);
 function close(focus=false){if(details.current)details.current.open=false;if(focus)summary.current?.focus({preventScroll:true});}
 useEffect(()=>{const outside=(event:PointerEvent)=>{if(details.current?.open&&!details.current.contains(event.target as Node))close();};document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside);},[]);
 const picker=<details ref={details} className={'personal-items'+(docked?' docked-items':'')} onToggle={event=>{if(event.currentTarget.open)closeOtherPickers(event.currentTarget);}} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close(true);}}}>
  <summary ref={summary}>{title}<span aria-hidden="true" className="items-chevron">⌃</span></summary>
  <div className="personal-items-panel" onClick={event=>{if((event.target as Element).closest('button'))close(true);}}>
   <header className="picker-header"><strong>{title}</strong><button className="quiet-action" aria-label={title+' 닫기'} onClick={()=>close(true)}>닫기</button></header>
   <div className="personal-items-options">{children}</div>
  </div>
 </details>;
 return docked&&dock?createPortal(picker,dock):picker;
}
