import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep,basename} from 'node:path';
import {createPantryServer} from '../server/app.mjs';

test('the static server cannot traverse to private files and keeps API authentication separate',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'tangbisil-security-')),root=join(dir,'public');mkdirSync(root);
 writeFileSync(join(root,'index.html'),'<!doctype html><title>QA pantry</title>');writeFileSync(join(dir,'private.txt'),'PRIVATE-OUTSIDE-ROOT');
 const app=createPantryServer({database:':memory:',staticDir:root});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+app.server.address().port;
 t.after(async()=>{await app.close();assert.ok(resolve(dir).startsWith(resolve(tmpdir())+sep)&&basename(dir).startsWith('tangbisil-security-'));rmSync(dir,{recursive:true});});
 const traversal=await fetch(base+'/%2e%2e%2fprivate.txt');assert.equal(traversal.status,400);assert.equal((await traversal.text()).includes('PRIVATE-OUTSIDE-ROOT'),false);
 for(const path of ['/.env','/.git/config','/server/app.mjs','/data/pantry.sqlite']){
  const r=await fetch(base+path);assert.match(r.headers.get('content-type'),/^text\/html/);assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.equal(await r.text(),'<!doctype html><title>QA pantry</title>');
 }
 for(const path of ['/api/me','/api/action','/api/events'])assert.equal((await fetch(base+path)).status,401);
 const foreign=await fetch(base+'/api/session',{method:'POST',headers:{Origin:'https://other.test','Content-Type':'application/json'},body:JSON.stringify({name:'foreign'})});assert.equal(foreign.status,403);
});
