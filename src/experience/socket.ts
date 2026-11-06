import type {Snapshot} from './types';
import {requestJson} from './request';
export type ActionReply={status:number;data?:{replay?:boolean;firstDiscovery:boolean;state:Snapshot};error?:string};
export type PantrySocket={action:(input:Record<string,unknown>)=>Promise<ActionReply>;contact:(input:Record<string,unknown>)=>void;done:Promise<void>;close:()=>void};
export class PauseConnection extends Error{}
export async function openPantrySocket(token:string,room:string,signal:AbortSignal,onState:(state:Snapshot)=>void):Promise<PantrySocket>{
  const {response:admission,data:grant}=await requestJson(`/api/connect?room=${room}`,{method:'POST',headers:{Authorization:`Bearer ${token}`},signal});
  if(!admission.ok){if([409,429,503,404].includes(admission.status))throw new PauseConnection(grant.error??'잠시 뒤 다시 들어와 주세요.');throw Object.assign(new Error(grant.error),{status:admission.status});}
  if(signal.aborted)throw new DOMException('Aborted','AbortError');
  const url=new URL(`/api/socket?room=${room}`,location.href);url.protocol=url.protocol==='https:'?'wss:':'ws:';
  const ws=new WebSocket(url,['pantry.v1',`ticket.${grant.ticket}`]);
  const pending=new Map<string,{resolve:(result:ActionReply)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
  let heartbeat:ReturnType<typeof setInterval>|undefined,lastPong=Date.now(),reason:Error|undefined,closed=false;
  let finish:()=>void,fail:(error:Error)=>void;
  const done=new Promise<void>((resolve,reject)=>{finish=resolve;fail=reject;});
  // The caller awaits this immediately; also attach a handler during setup.
  void done.catch(()=>{});
  const stop=()=>{if(closed)return;closed=true;clearInterval(heartbeat);clearTimeout(openTimeout);signal.removeEventListener('abort',abort);
    for(const entry of pending.values()){clearTimeout(entry.timer);entry.reject(new Error('연결이 끊겨 저장을 확인하지 못했어요.'));}pending.clear();
    if(signal.aborted)finish();else fail(reason??new Error('연결을 다시 확인하고 있어요.'));
  };
  const abort=()=>{reason=new DOMException('Aborted','AbortError');ws.close();stop();};
  const openTimeout=setTimeout(()=>{reason=new Error('연결 응답을 기다리고 있어요.');ws.close();stop();},10000);
  signal.addEventListener('abort',abort,{once:true});
  ws.onopen=()=>{heartbeat=setInterval(()=>{
    if(Date.now()-lastPong>75000){ws.close();return;}
    if(ws.readyState===WebSocket.OPEN)ws.send('ping');
  },25000);};
  ws.onmessage=event=>{
    if(event.data==='pong'){lastPong=Date.now();return;}
    try{
      const frame=JSON.parse(event.data);
      if(frame.type==='state'){clearTimeout(openTimeout);onState(frame.state);}
      if(frame.type==='relocated'||frame.type==='paused'){reason=new PauseConnection(frame.error);ws.close();stop();}
      if(frame.type==='result'){
        const entry=pending.get(frame.requestId);if(entry){clearTimeout(entry.timer);pending.delete(frame.requestId);entry.resolve(frame);}
      }
    }catch{reason=new Error('화면 상태를 다시 확인하고 있어요.');ws.close();}
  };
  ws.onclose=()=>stop();ws.onerror=()=>{reason=new Error('연결을 다시 확인하고 있어요.');};
  return {done,close:abort,contact(input){if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:'action',input:{type:'sand-contact',...input}}));},
    action(input){return new Promise((resolve,reject)=>{
      if(ws.readyState!==WebSocket.OPEN){reject(new Error('연결을 다시 확인하고 있어요.'));return;}
      const id=String(input.requestId);const timer=setTimeout(()=>{pending.delete(id);reject(new Error('저장 응답을 기다리고 있어요. 같은 행동을 다시 누르면 확인할게요.'));},12000);
      pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({type:'action',input}));
    })}};
}
