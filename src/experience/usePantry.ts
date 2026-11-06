import {useCallback,useEffect,useRef,useState} from 'react';
import type {Snapshot} from './types';
const params=new URLSearchParams(location.search);
export const roomId=/^[\w-]{1,40}$/.test(params.get('room')??'window')?(params.get('room')??'window'):'window';
const profile=params.get('visitor')?.replace(/[^\w-]/g,'').slice(0,40)||'main';
const key=`tangbisil:v04:${profile}`;
const readToken=()=>{try{return localStorage.getItem(key)??'';}catch{return '';}};
const pause=(ms:number,signal:AbortSignal)=>new Promise<void>(resolve=>{
  if(signal.aborted){resolve();return;}
  const finish=()=>{clearTimeout(timer);signal.removeEventListener('abort',finish);resolve();};
  const timer=setTimeout(finish,ms);
  signal.addEventListener('abort',finish,{once:true});
});

export function usePantry(){
  const[token,setToken]=useState(readToken),[state,setState]=useState<Snapshot|null>(null);
  const[status,setStatus]=useState<'loading'|'welcome'|'connecting'|'online'|'offline'>(token?'loading':'welcome');
  const[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const lock=useRef(false);
  const uncertain=useRef<{signature:string;requestId:string}|null>(null);
  useEffect(()=>{
    if(!token){setStatus('welcome');return;}
    const abort=new AbortController();
    async function run(){
      let delay=700;
      while(!abort.signal.aborted){
        setStatus('connecting');
        try{
          const response=await fetch(`/api/events?room=${roomId}`,{headers:{Authorization:`Bearer ${token}`},signal:abort.signal});
          if(response.status===401){try{localStorage.removeItem(key);}catch{}setToken('');setState(null);return;}
          if(!response.ok){const data=await response.json();throw new Error(data.error);}
          const reader=response.body!.getReader(),decoder=new TextDecoder();let buffer='',firstSnapshot=true;
          while(!abort.signal.aborted){
            const{done,value}=await reader.read();if(done)break;
            buffer+=decoder.decode(value,{stream:true});
            let end:number;
            while((end=buffer.indexOf('\n\n'))>=0){
              const chunk=buffer.slice(0,end);buffer=buffer.slice(end+2);
              const data=chunk.split('\n').find(line=>line.startsWith('data: '));
              if(data){const incoming=JSON.parse(data.slice(6)) as Snapshot,initial=firstSnapshot;firstSnapshot=false;setState(current=>initial||!current||incoming.version>=current.version?incoming:current);setStatus('online');setError('');delay=700;}
            }
          }
          if(!abort.signal.aborted)setStatus('offline');
        }catch(e){if(abort.signal.aborted)return;setStatus('offline');setError(e instanceof Error?e.message:'연결을 다시 확인하고 있어요.');}
        await pause(delay,abort.signal);delay=Math.min(delay*2,6000);
      }
    }
    void run();return()=>abort.abort();
  },[token]);
  const enter=useCallback(async(name:string,avatar:number)=>{
    setBusy(true);setError('');
    try{
      const res=await fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,avatar})});
      const data=await res.json();if(!res.ok)throw new Error(data.error);
      try{localStorage.setItem(key,data.token);}catch{setError('이 브라우저에서는 방문자 정보를 보관할 수 없어요. 창을 닫으면 기록을 다시 열기 어려울 수 있어요.');}
      setToken(data.token);
    }catch(e){setError(e instanceof Error?e.message:'연결을 확인해 주세요.');}finally{setBusy(false);}
  },[]);
  const act=useCallback(async(type:string,extra:Record<string,unknown>={})=>{
    if(lock.current||status!=='online')return null;
    lock.current=true;setBusy(true);setError('');
    const signature=JSON.stringify([type,extra]),requestId=uncertain.current?.signature===signature?uncertain.current.requestId:crypto.randomUUID();
    const payload=JSON.stringify({type,requestId,...extra});
    try{
      let res:Response;
      try{res=await fetch(`/api/action?room=${roomId}`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:payload});}
      catch{uncertain.current={signature,requestId};res=await fetch(`/api/action?room=${roomId}`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:payload});}
      uncertain.current=null;
      const data=await res.json();if(!res.ok)throw new Error(data.error);
      // SSE is the authoritative ordered stream; this snapshot also permits prompt feedback.
      setState(current=>!current||data.state.version>=current.version?data.state:current);
      return data as {firstDiscovery:boolean;state:Snapshot};
    }catch(e){setError(e instanceof Error?e.message:'저장을 확인하지 못했어요. 다시 시도해 주세요.');return null;}
    finally{lock.current=false;setBusy(false);}
  },[token,status]);
  const contact=useCallback((extra:Record<string,unknown>)=>{
    if(status!=='online')return;
    void fetch(`/api/action?room=${roomId}`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({type:'sand-contact',...extra}),keepalive:!extra.active}).catch(()=>{});
  },[token,status]);
  return{contact,state,status,error,busy,enter,act,clearError:()=>setError('')};
}
