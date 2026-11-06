export function byteRange(value,size){
  const match=/^bytes=(\d*)-(\d*)$/.exec(value??'');if(!match||(!match[1]&&!match[2]))return null;
  let start=0,end=size-1;
  if(match[1]){start=Number(match[1]);if(match[2])end=Math.min(Number(match[2]),size-1);}
  else{const suffix=Number(match[2]);if(suffix<=0)return null;start=Math.max(0,size-suffix);}
  return Number.isSafeInteger(start)&&Number.isSafeInteger(end)&&start<=end&&start<size?{start,end}:null;
}
export async function mediaResponse(request,asset,sizeHint){
  if(asset.status!==200)return asset;
  const headers=new Headers(asset.headers);headers.set('Accept-Ranges','bytes');
  if(Number.isSafeInteger(sizeHint)&&sizeHint>=0)headers.set('Content-Length',String(sizeHint));
  const requested=request.headers.get('Range'),ifRange=request.headers.get('If-Range');
  if(!requested||(ifRange&&ifRange!==headers.get('ETag')&&ifRange!==headers.get('Last-Modified')))return new Response(request.method==='HEAD'?null:asset.body,{status:200,headers});
  let size=headers.has('Content-Length')?Number(headers.get('Content-Length')):NaN;
  if(!Number.isSafeInteger(size)||size<0){
    // Static Assets can omit Content-Length. Production uses a build manifest;
    // this bounded-file fallback also handles direct adapter callers.
    const bytes=await asset.arrayBuffer();size=bytes.byteLength;headers.set('Content-Length',String(size));asset=new Response(bytes,{headers});
  }
  const range=byteRange(requested,size);
  if(!range){await asset.body?.cancel();headers.set('Content-Range',`bytes */${size}`);headers.set('Content-Length','0');return new Response(null,{status:416,headers});}
  const {start,end}=range;headers.set('Content-Range',`bytes ${start}-${end}/${size}`);headers.set('Content-Length',String(end-start+1));
  if(request.method==='HEAD'){await asset.body?.cancel();return new Response(null,{status:206,headers});}
  const reader=asset.body.getReader();let offset=0;
  const body=new ReadableStream({async pull(controller){
    try{
      for(;;){const {done,value}=await reader.read();if(done){controller.close();return;}
        const from=Math.max(0,start-offset),to=Math.min(value.byteLength,end-offset+1);offset+=value.byteLength;
        if(to>from)controller.enqueue(value.slice(from,to));
        if(offset>end){controller.close();await reader.cancel();return;}
        if(to>from)return;
      }
    }catch(error){controller.error(error);}
  },cancel(reason){return reader.cancel(reason);}});
  return new Response(body,{status:206,headers});
}
