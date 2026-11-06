import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
const hooks=registerHooks({resolve(specifier,context,next){return next(specifier==='./request'&&context.parentURL?.endsWith('/socket.ts')?'./request.ts':specifier,context);}});
after(()=>hooks.deregister());
const {openPantrySocket,PauseConnection}=await import('../src/experience/socket.ts');

function setup(t){
 const saved={fetch:globalThis.fetch,WebSocket:globalThis.WebSocket,location:globalThis.location};t.after(()=>Object.assign(globalThis,saved));
 globalThis.location={href:'https://example.test/'};const sockets=[];
 globalThis.WebSocket=class{static OPEN=1;readyState=0;constructor(){sockets.push(this);}send(){}close(){this.readyState=3;this.onclose?.();}};
 globalThis.fetch=async()=>Response.json({ticket:'ticket'});return sockets;
}
test('HTML admission limits preserve PauseConnection instead of retrying forever',async t=>{
 setup(t);for(const status of [429,503]){globalThis.fetch=async()=>new Response('Please pause',{status});await assert.rejects(openPantrySocket('token','window',new AbortController().signal,()=>{}),PauseConnection);}
});
test('an open socket without the first room state has a bounded startup wait',async t=>{
 const sockets=setup(t);t.mock.timers.enable({apis:['setTimeout','setInterval']});
 const connection=await openPantrySocket('token','window',new AbortController().signal,()=>{}),ws=sockets[0];ws.readyState=1;ws.onopen();
 const failed=assert.rejects(connection.done,/연결 응답/);t.mock.timers.tick(10001);await failed;assert.equal(ws.readyState,3);
});
test('the first room state clears startup timeout without expiring a healthy stream',async t=>{
 const sockets=setup(t);t.mock.timers.enable({apis:['setTimeout','setInterval']});let received=0;
 const controller=new AbortController(),connection=await openPantrySocket('token','window',controller.signal,()=>received++),ws=sockets[0];ws.readyState=1;ws.onopen();ws.onmessage({data:JSON.stringify({type:'state',state:{version:0}})});
 t.mock.timers.tick(15000);assert.equal(received,1);assert.equal(ws.readyState,1);controller.abort();await connection.done;
});
