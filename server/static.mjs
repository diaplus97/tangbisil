import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {extname} from 'node:path';

const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.woff2':'font/woff2','.json':'application/json','.wav':'audio/wav','.mp3':'audio/mpeg','.mp4':'video/mp4','.webm':'video/webm','.ogg':'audio/ogg'};
export async function serveStatic(req,res,target){
  const{size}=await stat(target),extension=extname(target);
  const headers={'Content-Type':mime[extension]??'application/octet-stream','Cache-Control':extension==='.html'?'no-cache':'public, max-age=3600','Accept-Ranges':'bytes'};
  let start=0,end=size-1,status=200;
  if(req.headers.range){
    const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    let valid=Boolean(match&&(match[1]||match[2]));
    if(valid){
      if(match[1]){start=Number(match[1]);end=match[2]?Math.min(Number(match[2]),size-1):size-1;}
      else{const suffix=Number(match[2]);valid=suffix>0;start=Math.max(0,size-suffix);}
      valid=valid&&Number.isSafeInteger(start)&&Number.isSafeInteger(end)&&start<=end&&start<size;
    }
    if(!valid){res.writeHead(416,{...headers,'Content-Range':`bytes */${size}`,'Content-Length':'0'});res.end();return;}
    status=206;headers['Content-Range']=`bytes ${start}-${end}/${size}`;
  }
  res.writeHead(status,{...headers,'Content-Length':String(size===0?0:end-start+1)});
  if(req.method==='HEAD'||size===0){res.end();return;}
  const stream=createReadStream(target,{start,end});stream.on('error',error=>res.destroy(error));res.on('close',()=>stream.destroy());stream.pipe(res);
}
