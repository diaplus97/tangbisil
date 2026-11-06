import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {setTimeout as delay} from 'node:timers/promises';

test('wave-only mode skips all effects; enabling effects loads once and retries only missing clips',async t=>{
 const hooks=registerHooks({load(url,context,next){return url.endsWith('.wav')?{format:'module',source:`export default ${JSON.stringify(url)}`,shortCircuit:true}:next(url,context);}});t.after(()=>hooks.deregister());
 const saved={fetch:globalThis.fetch,document:globalThis.document,AudioContext:globalThis.AudioContext};t.after(()=>Object.assign(globalThis,saved));
 const events=new EventTarget();globalThis.document=Object.assign(events,{hidden:false});
 const param=()=>({value:0,setValueAtTime(){},setTargetAtTime(){},linearRampToValueAtTime(){},cancelAndHoldAtTime(){}}),node=()=>({gain:param(),threshold:param(),knee:param(),ratio:param(),attack:param(),release:param(),connect(){return this;},disconnect(){},start(){},stop(){}});
 globalThis.AudioContext=class{state='running';currentTime=0;destination=node();createGain=node;createDynamicsCompressor=node;createBufferSource=node;async resume(){}async decodeAudioData(){return{duration:3};}};
 const calls=[];let fail=true;globalThis.fetch=async url=>{calls.push(url);return new Response(new Uint8Array([0]),{status:fail&&url.includes('rustle-b')?503:200});};
 const sound=await import('../src/experience/sound.ts');sound.setActionSounds(false);assert.equal(await sound.enableSound(true),true);assert.equal(calls.length,0);await sound.setSeaSound(true);assert.equal(calls.length,1);assert.match(calls[0],/sea-waves/);
 sound.setActionSounds(true);sound.setActionSounds(true);await delay(20);assert.equal(calls.length,17);
 fail=false;await sound.enableSound(true);await delay(20);assert.equal(calls.length,18);assert.match(calls.at(-1),/rustle-b/);
 await sound.enableSound(false);await sound.enableSound(true);await delay(20);assert.equal(calls.length,18);await sound.enableSound(false);
});
