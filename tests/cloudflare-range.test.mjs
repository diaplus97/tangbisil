import test from 'node:test';
import assert from 'node:assert/strict';
import {mediaResponse} from '../cloudflare/range.mjs';
const bytes=Uint8Array.from({length:256},(_,i)=>i);
const asset=()=>new Response(bytes,{headers:{'Content-Length':'256','Content-Type':'video/mp4',ETag:'"fixture"'}});
test('media ranges preserve exact Safari probe, suffix and open-ended bytes',async()=>{
  for(const [range,start,end] of [['bytes=0-1',0,1],['bytes=48-100',48,100],['bytes=-12',244,255],['bytes=250-',250,255]]){
    const res=await mediaResponse(new Request('https://test/video.mp4',{headers:{Range:range}}),asset());
    assert.equal(res.status,206);assert.equal(res.headers.get('Content-Range'),`bytes ${start}-${end}/256`);
    assert.deepEqual(new Uint8Array(await res.arrayBuffer()),bytes.slice(start,end+1));
  }
});
test('invalid and multipart ranges reject without leaking a full body',async()=>{
  for(const range of ['bytes=256-','bytes=5-2','bytes=0-1,5-6','bytes=-0']){
    const res=await mediaResponse(new Request('https://test/video.mp4',{headers:{Range:range}}),asset());assert.equal(res.status,416);assert.equal((await res.arrayBuffer()).byteLength,0);
  }
});
test('HEAD and If-Range preserve correct full/range semantics',async()=>{
  const head=await mediaResponse(new Request('https://test/video.mp4',{method:'HEAD',headers:{Range:'bytes=0-1'}}),asset());assert.equal(head.status,206);assert.equal(head.headers.get('Content-Length'),'2');assert.equal((await head.text()).length,0);
  const stale=await mediaResponse(new Request('https://test/video.mp4',{headers:{Range:'bytes=0-1','If-Range':'"old"'}}),asset());assert.equal(stale.status,200);assert.equal((await stale.arrayBuffer()).byteLength,256);
});
test('assets without Content-Length still answer Safari byte probes using the build size',async()=>{
  for(const hint of [256,undefined]){
    const source=new Response(bytes,{headers:{'Content-Type':'video/mp4'}});
    const result=await mediaResponse(new Request('https://test/video.mp4',{headers:{Range:'bytes=0-1'}}),source,hint);
    assert.equal(result.status,206);assert.equal(result.headers.get('Content-Range'),'bytes 0-1/256');assert.deepEqual(new Uint8Array(await result.arrayBuffer()),bytes.slice(0,2));
  }
});
