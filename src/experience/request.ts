// Covers both response headers and JSON bodies; a stalled request must release UI locks.
export async function requestJson(url:string,options:RequestInit={},timeoutMs=12000){
 const controller=new AbortController(),parent=options.signal;
 const abort=()=>controller.abort(parent?.reason);if(parent?.aborted)abort();else parent?.addEventListener('abort',abort,{once:true});
 const timer=setTimeout(()=>controller.abort(new DOMException('응답이 늦어지고 있어요. 잠시 뒤 다시 시도해 주세요.','TimeoutError')),timeoutMs);
 try{controller.signal.throwIfAborted();const response=await fetch(url,{...options,signal:controller.signal});controller.signal.throwIfAborted();const data=await response.json().catch(error=>{if(!response.ok&&!controller.signal.aborted)return{error:'지금은 연결을 확인할 수 없어요. 잠시 뒤 다시 시도해 주세요.'};throw error;});controller.signal.throwIfAborted();return{response,data};}
 finally{clearTimeout(timer);parent?.removeEventListener('abort',abort);}
}
