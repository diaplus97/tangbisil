import test from 'node:test';
import assert from 'node:assert/strict';
import {verifySite} from '../scripts/verify-site.mjs';

test('deployment checks only GET the current page, health and same-origin assets',async()=>{
 const calls=[],html='<div id="root"></div><script type="module" src="/assets/index-test.js"></script><link rel="stylesheet" href="/assets/main.css">';
 const fetcher=async(url,options)=>{calls.push([new URL(url).pathname,options.method]);const path=new URL(url).pathname;return path==='/api/health'?Response.json({ok:true,app:'tangbisil',version:'0.4.0',transport:'websocket'}):new Response(path==='/'?html:'/* asset */',{headers:{'Content-Type':path==='/'?'text/html':path.endsWith('.js')?'text/javascript':'text/css'}});};
 const result=await verifySite('https://example.test/?room=window',{fetcher});assert.ok(result.every(r=>r.ok));assert.deepEqual(calls,[['/','GET'],['/api/health','GET'],['/assets/index-test.js','GET'],['/assets/main.css','GET']]);
});
test('deployment checks reject SPA fallbacks and do not fetch foreign script sources',async()=>{
 for(const script of ['/assets/missing.js','https://other.test/app.js']){
  const calls=[];const result=await verifySite('https://example.test',{fetcher:async url=>{calls.push(String(url));return new Response(`<div id="root"></div><script type="module" src="${script}"></script>`,{headers:{'Content-Type':'text/html'}});}});
  assert.equal(result.find(r=>r.label==='게임 서버').ok,false);assert.equal(result.find(r=>r.label==='실행 파일과 스타일').ok,false);assert.ok(calls.every(u=>new URL(u).origin==='https://example.test'));
 }
});
