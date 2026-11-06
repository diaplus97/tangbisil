// Production-layout smoke test. Uses a fresh temporary DB, never data/pantry.sqlite.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import http from 'node:http';
import {cp, mkdir, mkdtemp, readdir, rm, stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {basename, dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
await stat(join(root,'dist/index.html')); // Run npm run build first.
const scratch=await mkdtemp(join(tmpdir(),'pantry-runtime-'));
const appDir=join(scratch,'app'),database=join(scratch,'volume','pantry.sqlite');
const controllers=[];
let child,proxy,base;
const publicHeaders={Origin:'https://pantry.example.test'};
async function waitFor(predicate,label,timeout=5000){
  const end=Date.now()+timeout;
  while(Date.now()<end){const result=predicate();if(result)return result;await delay(20);}
  throw new Error(`Timed out: ${label}`);
}
async function start(){
  let output='',errors='';
  child=spawn(process.execPath,['server/start.mjs'],{
    cwd:appDir,windowsHide:true,stdio:['ignore','pipe','pipe'],
    env:{...process.env,NODE_ENV:'production',HOST:'0.0.0.0',PORT:'0',PANTRY_DB:database},
  });
  child.stdout.on('data',chunk=>output+=chunk);
  child.stderr.on('data',chunk=>errors+=chunk);
  let launchError;child.on('error',error=>launchError=error);
  const address=await waitFor(()=>{
    if(launchError)throw launchError;
    if(child.exitCode!==null)throw new Error(`Runtime exited: ${errors}`);
    return output.match(/http:\/\/0\.0\.0\.0:(\d+)/)?.[1];
  },'runtime startup');
  // Model TLS termination: upstream HTTP keeps the public Host and HTTPS Origin.
  proxy=http.createServer((req,res)=>{
    const upstream=http.request({hostname:'127.0.0.1',port:Number(address),path:req.url,method:req.method,
      headers:{...req.headers,host:'pantry.example.test','x-forwarded-proto':'https'}},incoming=>{
      res.writeHead(incoming.statusCode,incoming.headers);incoming.pipe(res);
    });
    upstream.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end();});
    res.on('close',()=>upstream.destroy());req.pipe(upstream);
  });
  await new Promise(resolve=>proxy.listen(0,'127.0.0.1',resolve));
  base=`http://127.0.0.1:${proxy.address().port}`;
}
async function stop(){
  controllers.splice(0).forEach(controller=>controller.abort());
  if(proxy){const closed=new Promise(resolve=>proxy.close(resolve));proxy.closeAllConnections();await closed;proxy=null;}
  if(child&&child.exitCode===null&&child.signalCode===null){
    const exited=once(child,'exit');child.kill();await exited;
  }
  child=null;
}
async function request(path,token,body){
  const res=await fetch(base+path,{
    method:body?'POST':'GET',signal:AbortSignal.timeout(5000),
    headers:{...publicHeaders,...(token?{Authorization:`Bearer ${token}`} : {}),...(body?{'Content-Type':'application/json'} : {})},
    ...(body?{body:JSON.stringify(body)} : {}),
  });
  assert.ok(res.ok,`${path}: HTTP ${res.status}`);return res.json();
}
async function connect(token){
  const controller=new AbortController();controllers.push(controller);
  const res=await fetch(base+'/api/events?room=deployment-check',{
    headers:{...publicHeaders,Authorization:`Bearer ${token}`},signal:controller.signal,
  });
  assert.equal(res.status,200);
  assert.match(res.headers.get('content-type'),/text\/event-stream/);
  assert.match(res.headers.get('cache-control'),/no-transform/);
  assert.equal(res.headers.get('x-accel-buffering'),'no');
  const reader=res.body.getReader(),decoder=new TextDecoder();
  const stream={state:null,heartbeat:false,error:null};
  void (async()=>{
    let buffer='';
    try{
      for(;;){
        const{done,value}=await reader.read();if(done)break;
        buffer+=decoder.decode(value,{stream:true});let end;
        while((end=buffer.indexOf('\n\n'))>=0){
          const block=buffer.slice(0,end);buffer=buffer.slice(end+2);
          if(block.includes(': heartbeat'))stream.heartbeat=true;
          const data=block.split('\n').find(line=>line.startsWith('data: '));
          if(data)stream.state=JSON.parse(data.slice(6));
        }
      }
    }catch(error){if(!controller.signal.aborted)stream.error=error;}
  })();
  await waitFor(()=>stream.state,'unbuffered first snapshot');return stream;
}
try{
  await mkdir(appDir);
  for(const folder of ['dist','server'])await cp(join(root,folder),join(appDir,folder),{recursive:true});
  await mkdir(join(appDir,'shared'));
  for(const file of await readdir(join(root,'shared')))if(file.endsWith('.mjs'))await cp(join(root,'shared',file),join(appDir,'shared',file));
  // No package.json, node_modules, .env, local DB, or development middleware in this layout.
  assert.deepEqual((await readdir(appDir)).sort(),['dist','server','shared']);
  await start();
  assert.equal((await request('/api/health')).app,'tangbisil');
  const html=await fetch(base+'/');assert.equal(html.status,200);assert.match(await html.text(),/\/assets\/.*\.js/);
  const movie=(await readdir(join(appDir,'dist/assets'))).find(file=>file.endsWith('.mp4'));
  assert.ok(movie,'MP4 sea fallback is bundled');
  const range=await fetch(base+'/assets/'+movie,{headers:{Range:'bytes=0-63'}});
  assert.equal(range.status,206);assert.equal(range.headers.get('content-type'),'video/mp4');
  assert.equal((await range.arrayBuffer()).byteLength,64);
  const a=await request('/api/session',null,{name:'배포검사A',avatar:0});
  const b=await request('/api/session',null,{name:'배포검사B',avatar:1});
  const first=await connect(a.token),second=await connect(b.token);
  await waitFor(()=>first.state.room.members.length===2,'two visitors');
  const action=(token,type,extra={})=>request('/api/action?room=deployment-check',token,{type,requestId:crypto.randomUUID(),...extra});
  const taken=await action(a.token,'take'),servingId=taken.state.self.serving.id;
  await action(a.token,'open',{servingId});await action(a.token,'bite',{servingId});await action(a.token,'offer');
  const offer=await waitFor(()=>second.state.room.offers[0],'shared offer');
  const sample=await action(b.token,'sample',{offerId:offer.id});
  await action(b.token,'bite',{servingId:sample.state.self.serving.id});
  await waitFor(()=>first.state.room.offers[0]?.tasted===1,'tasting sync');
  await waitFor(()=>first.heartbeat&&second.heartbeat,'SSE heartbeat',12000);
  assert.equal(first.error,null);assert.equal(second.error,null);
  // Public HTTPS Origin with the preserved Host works; another origin stays rejected.
  const denied=await fetch(base+'/api/session',{method:'POST',headers:{...publicHeaders,Origin:'https://elsewhere.example.test','Content-Type':'application/json'},body:'{}'});
  assert.equal(denied.status,403);
  await stop();await start();
  const restored=await connect(b.token);
  assert.equal(restored.state.self.serving.state,'empty');
  assert.equal(restored.state.self.discoveries[0].source,'shared');
  assert.equal(restored.state.self.coins,50);
  const owner=await request('/api/me',a.token);assert.equal(owner.self.serving.bites,1);
  assert.ok((await stat(database)).size>0);
  console.log('PASS: isolated Node runtime; external HOST/platform PORT; HTTPS proxy headers; MP4 ranges; two visitors/share/taste; immediate SSE + heartbeat; same-token reconnect and DB restart persistence.');
}finally{
  await stop();
  // Only remove the exact temporary directory created by this run.
  assert.equal(dirname(scratch),resolve(tmpdir()));assert.ok(basename(scratch).startsWith('pantry-runtime-'));
  await rm(scratch,{recursive:true,force:true});
}
