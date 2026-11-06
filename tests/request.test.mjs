import test from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {requestJson} from '../src/experience/request.ts';

test('JSON deadlines cover stalled headers and stalled bodies and preserve caller aborts',async t=>{
 const original=globalThis.fetch;t.after(()=>globalThis.fetch=original);
 for(const body of [false,true]){
  globalThis.fetch=async(_url,{signal})=>{const hung=()=>new Promise((_,reject)=>{if(signal.aborted)reject(signal.reason);else signal.addEventListener('abort',()=>reject(signal.reason),{once:true});});return body?{ok:true,json:hung}:hung();};
  await assert.rejects(requestJson('/test',{},20),{name:'TimeoutError'});
 }
 const controller=new AbortController(),reason=new DOMException('Left connection','AbortError'),pending=requestJson('/test',{signal:controller.signal});controller.abort(reason);await assert.rejects(pending,error=>error===reason);
});
test('completed JSON requests clear their timer and non-JSON error pages retain HTTP status',async t=>{
 const original=globalThis.fetch;t.after(()=>globalThis.fetch=original);let requestSignal;
 globalThis.fetch=async(_url,{signal})=>{requestSignal=signal;return Response.json({ok:true});};
 assert.equal((await requestJson('/test',{},20)).data.ok,true);await delay(35);assert.equal(requestSignal.aborted,false);
 globalThis.fetch=async()=>new Response('Service unavailable',{status:503});assert.equal((await requestJson('/test')).response.status,503);
});
