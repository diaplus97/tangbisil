import {useCallback,useEffect,useRef,useState} from 'react';
import type {Snapshot} from './types';
import {requestJson} from './request';
import {openPantrySocket,PauseConnection,type PantrySocket,type ActionReply} from './socket';
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
  const[status,setStatus]=useState<'loading'|'welcome'|'connecting'|'online'|'offline'|'paused'>(token?'loading':'welcome');
  const[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const epoch=useRef(0),requests=useRef<AbortController|null>(null),activeAction=useRef<symbol|null>(null),entry=useRef<AbortController|null>(null),mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;entry.current?.abort();};},[]);
  const lock=useRef(false),socket=useRef<PantrySocket|null>(null),usesSocket=useRef(false);
  const[retryTick,setRetryTick]=useState(0),retry=()=>setRetryTick(value=>value+1);
  const uncertain=useRef<{signature:string;requestId:string}|null>(null);
  useEffect(()=>{
    if(!token){setStatus('welcome');return;}
    const abort=new AbortController();
    async function run(){
      let delay=1000;let mode:string|undefined;
      while(!abort.signal.aborted){
        const currentEpoch=++epoch.current;
        const current=()=>!abort.signal.aborted&&epoch.current===currentEpoch;
        const receive=(incoming:Snapshot,initial:boolean)=>{if(!current())return;const snapshot={...incoming,receivedAt:Date.now()};setState(previous=>current()&&(initial||!previous||incoming.version>=previous.version)?snapshot:previous);setStatus('online');setError('');delay=1000;};
        requests.current?.abort();requests.current=new AbortController();activeAction.current=null;lock.current=false;setBusy(false);setStatus('connecting');
        try{
          if(!mode){const {response:health,data}=await requestJson('/api/health',{signal:abort.signal});if(health.status===429)throw new PauseConnection('지금은 잠시 쉬어가는 중이에요. 조금 뒤 다시 들어와 주세요.');if(!health.ok)throw new Error('연결을 확인하고 있어요.');mode=data.transport??'sse';usesSocket.current=mode==='websocket';}
          if(mode==='websocket'){
            let initial=true;const connection=await openPantrySocket(token,roomId,abort.signal,incoming=>{receive(incoming,initial);initial=false;});if(!current()){connection.close();return;}socket.current=connection;
            await connection.done;if(socket.current===connection)socket.current=null;if(!current())return;
          }else{
          const streamAbort=new AbortController(),cancelStream=()=>streamAbort.abort(abort.signal.reason);
          abort.signal.addEventListener('abort',cancelStream,{once:true});
          const initialTimer=setTimeout(()=>streamAbort.abort(new DOMException('첫 화면의 응답이 늦어지고 있어요. 다시 연결할게요.','TimeoutError')),10000);
          try{
          const response=await fetch(`/api/events?room=${roomId}`,{headers:{Authorization:`Bearer ${token}`},signal:streamAbort.signal});
          if(!current())return;
          if(response.status===401){try{localStorage.removeItem(key);}catch{}setToken('');setState(null);return;}
          if(!response.ok){const data=await response.json();throw new Error(data.error);}
          const reader=response.body!.getReader(),decoder=new TextDecoder();let buffer='',firstSnapshot=true;
          try{while(!abort.signal.aborted){
            const{done,value}=await reader.read();if(done)break;
            buffer+=decoder.decode(value,{stream:true});
            let end:number;
            while((end=buffer.indexOf('\n\n'))>=0){
              const chunk=buffer.slice(0,end);buffer=buffer.slice(end+2);
              const data=chunk.split('\n').find(line=>line.startsWith('data: '));
              if(data){const incoming=JSON.parse(data.slice(6)) as Snapshot,initial=firstSnapshot;firstSnapshot=false;clearTimeout(initialTimer);receive(incoming,initial);}
            }
          }}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
          }finally{clearTimeout(initialTimer);abort.signal.removeEventListener('abort',cancelStream);streamAbort.abort();}
          }
          if(!abort.signal.aborted)setStatus('offline');
        }catch(e){if(!current())return;socket.current=null;if(e instanceof PauseConnection){setStatus('paused');setError(e.message);return;}if((e as {status?:number})?.status===401){try{localStorage.removeItem(key);}catch{}setToken('');setState(null);return;}setStatus('offline');setError(e instanceof Error?e.message:'연결을 다시 확인하고 있어요.');}
        finally{if(epoch.current===currentEpoch){epoch.current++;requests.current?.abort();activeAction.current=null;lock.current=false;if(!abort.signal.aborted)setBusy(false);}}
        await pause(delay+Math.random()*500,abort.signal);delay=Math.min(delay*2,30000);
      }
    }
    void run();return()=>{epoch.current++;abort.abort();requests.current?.abort();activeAction.current=null;lock.current=false;socket.current?.close();socket.current=null;};
  },[token,retryTick]);
  const enter=useCallback(async(name:string,avatar:number)=>{
    if(entry.current)return;const controller=new AbortController();entry.current=controller;setBusy(true);setError('');
    try{
      const {response:res,data}=await requestJson('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,avatar}),signal:controller.signal});
      if(!mounted.current)return;if(!res.ok)throw new Error(data.error);
      try{localStorage.setItem(key,data.token);}catch{setError('이 브라우저에서는 방문자 정보를 보관할 수 없어요. 창을 닫으면 기록을 다시 열기 어려울 수 있어요.');}
      setToken(data.token);
    }catch(e){if(mounted.current)setError(e instanceof Error?e.message:'연결을 확인해 주세요.');}finally{entry.current=null;if(mounted.current)setBusy(false);}
  },[]);
  const act=useCallback(async(type:string,extra:Record<string,unknown>={})=>{
    if(lock.current||status!=='online')return null;
    const started=epoch.current,owner=Symbol('action'),signal=requests.current?.signal;
    const current=()=>mounted.current&&epoch.current===started&&!signal?.aborted;
    activeAction.current=owner;lock.current=true;setBusy(true);setError('');
    const signature=JSON.stringify([type,extra]),requestId=uncertain.current?.signature===signature?uncertain.current.requestId:crypto.randomUUID();
    const input={type,requestId,...extra},payload=JSON.stringify(input);
    const send=async():Promise<ActionReply>=>{
      if(!current())throw new DOMException('Aborted','AbortError');
      if(socket.current)return socket.current.action(input);
      if(usesSocket.current)throw new Error('연결을 다시 확인하고 있어요.');
      const {response,data}=await requestJson(`/api/action?room=${roomId}`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:payload,signal});
      return {status:response.status,...(response.ok?{data}:{error:data.error})};
    };
    try{
      let reply:ActionReply;
      uncertain.current={signature,requestId};
      try{reply=await send();}catch{reply=await send();}
      if(!current())return null;
      if(reply.status<500)uncertain.current=null;
      if(reply.status!==200||!reply.data)throw new Error(reply.error??'저장을 다시 확인하고 있어요.');
      const data=reply.data;
      const snapshot={...data.state,receivedAt:Date.now()};
      setState(previous=>current()&&(!previous||data.state.version>=previous.version)?snapshot:previous);
      return data;
    }catch(e){if(current())setError(e instanceof Error?e.message:'저장을 확인하지 못했어요. 다시 시도해 주세요.');return null;}
    finally{if(activeAction.current===owner){activeAction.current=null;lock.current=false;if(current())setBusy(false);}}
  },[token,status]);
  const contact=useCallback((extra:Record<string,unknown>)=>{
    if(status!=='online')return;
    if(socket.current){socket.current.contact(extra);return;}
    if(usesSocket.current)return;
    void requestJson(`/api/action?room=${roomId}`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({type:'sand-contact',...extra}),keepalive:!extra.active}).catch(()=>{});
  },[token,status]);
  return{inputReady:()=>!lock.current,contact,state,status,error,busy,enter,act,retry,clearError:()=>setError('')};
}
