import {createHash,randomBytes} from 'node:crypto';
import {mediaResponse} from './range.mjs';
import mediaSizes from '../dist-cf/media-manifest.json';
export {PantryRoom} from './room.mjs';
export {PantryVisitor} from './visitor.mjs';
export {PantryGate} from './gate.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin',...(data.retryAfter?{'Retry-After':String(data.retryAfter)}:{})}});
async function body(request){
  const reader=request.body?.getReader();if(!reader)return {};
  const chunks=[];let size=0;
  for(;;){const{done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>8192){await reader.cancel();throw Object.assign(Error('요청이 너무 커요.'),{status:413});}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw Object.assign(Error('요청 형식을 확인해 주세요.'),{status:400});}
}
export default {
  async fetch(request,env){
    const url=new URL(request.url);
    try{
      if(!url.pathname.startsWith('/api/')){
        const response=await env.ASSETS.fetch(request);
        return url.pathname.startsWith('/assets/pantry-sea-loop-')?mediaResponse(request,response,mediaSizes[url.pathname]):response;
      }
      const origin=request.headers.get('Origin');if(origin&&origin!==url.origin)return json({error:'같은 주소에서 접속해 주세요.'},403);
      if(url.pathname==='/api/health')return json({ok:true,app:'tangbisil',version:'0.4.0',transport:'websocket'});
      const room=url.searchParams.get('room')??'window',rooms=(env.ALLOWED_ROOMS??'window,breeze,quiet,sunset').split(',');
      if(url.pathname!=='/api/session'&&!rooms.includes(room))return json({error:'지금은 창가·바람·고요·노을 방만 열려 있어요. 초대 링크를 확인해 주세요.'},404);
      const gate=async kind=>{
        const ip=hash(request.headers.get('CF-Connecting-IP')??'local'),shard=parseInt(ip[0],16)%8;
        return env.GATES.get(env.GATES.idFromName('gate-'+shard)).allow(ip,kind);
      };
      if(url.pathname==='/api/session'&&request.method==='POST'){
        const input=await body(request),name=String(input.name??'').trim();if(!name||[...name].length>12||/[\u0000-\u001f<>]/.test(name))return json({error:'이름은 1~12자로 적어 주세요.'},400);
        const access=await gate('session');if(!access.ok)return json(access,access.status);
        const token=randomBytes(32).toString('hex'),home=env.VISITORS.get(env.VISITORS.idFromName(hash(token)));
        return json(await home.initialize(name,input.avatar===1?1:0,token),201);
      }
      if(url.pathname==='/api/socket'&&request.method==='GET'){
        if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return json({error:'연결을 다시 열어 주세요.'},426);
        const access=await gate('connect');if(!access.ok)return json(access,access.status);
        // Tickets are single-use, short-lived, and only minted after admission.
        return env.ROOMS.get(env.ROOMS.idFromName(room)).fetch(request);
      }
      const token=request.headers.get('Authorization')?.replace(/^Bearer /,'');
      if(!/^[a-f0-9]{64}$/.test(token??''))return json({error:'자리를 다시 잡아 주세요.'},401);
      if(url.pathname==='/api/me'&&request.method==='GET'){
        const access=await gate('connect');if(!access.ok)return json(access,access.status);
        const self=await env.VISITORS.get(env.VISITORS.idFromName(hash(token))).view();
        return self?json({self}):json({error:'자리를 다시 잡아 주세요.'},401);
      }
      if(url.pathname==='/api/connect'&&request.method==='POST'){
        const access=await gate('connect');if(!access.ok)return json(access,access.status);
        if(env.ADMISSIONS==='closed')return json({error:'잠시 새 입장을 쉬고 있어요. 조금 뒤 다시 만나요.',retryAfter:300},503);
        const key=hash(token),home=env.VISITORS.get(env.VISITORS.idFromName(key)),identity=await home.identity();
        if(!identity)return json({error:'자리를 다시 잡아 주세요.'},401);
        if(identity.room&&identity.room!==room)await env.ROOMS.get(env.ROOMS.idFromName(identity.room)).detach(key,identity.room);
        const result=await env.ROOMS.get(env.ROOMS.idFromName(room)).prepare(room,key);
        return json(result,result.status??(result.ok?200:409));
      }
      return json({error:'연결된 화면에서 다시 시도해 주세요.'},404);
    }catch(error){return json({error:error.status?error.message:'잠시 연결을 쉬고 있어요. 조금 뒤 다시 들어와 주세요.',retryAfter:30},error.status??503);}
  },
};
