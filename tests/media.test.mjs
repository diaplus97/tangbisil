import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep,basename} from 'node:path';
import {serveStatic} from '../server/static.mjs';

test('media supports bounded, suffix, open and HEAD byte requests without downloading the whole file',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'tangbisil-media-')),file=join(dir,'sea.mp4'),bytes=Buffer.from('0123456789');await writeFile(file,bytes);
 const server=http.createServer((req,res)=>void serveStatic(req,res,file));await new Promise(done=>server.listen(0,'127.0.0.1',done));
 t.after(async()=>{await new Promise(done=>server.close(done));assert.ok(resolve(dir).startsWith(resolve(tmpdir())+sep)&&basename(dir).startsWith('tangbisil-media-'));await rm(dir,{recursive:true});});
 const url=`http://127.0.0.1:${server.address().port}/sea.mp4`;
 for(const[range,expected,contentRange]of[['bytes=0-1','01','bytes 0-1/10'],['bytes=5-','56789','bytes 5-9/10'],['bytes=-3','789','bytes 7-9/10'],['bytes=7-100','789','bytes 7-9/10']]){
  const res=await fetch(url,{headers:{Range:range}});assert.equal(res.status,206);assert.equal(res.headers.get('Content-Type'),'video/mp4');assert.equal(res.headers.get('Content-Range'),contentRange);assert.equal(await res.text(),expected);
 }
 const head=await fetch(url,{method:'HEAD'});assert.equal(head.headers.get('content-length'),'10');assert.equal(await head.text(),'');
 for(const range of ['bytes=10-','bytes=5-2','bytes=-0','bytes=','bytes=0-1,3-4']){const res=await fetch(url,{headers:{Range:range}});assert.equal(res.status,416);assert.equal(res.headers.get('Content-Range'),'bytes */10');}
});
