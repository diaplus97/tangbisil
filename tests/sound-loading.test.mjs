import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {setTimeout as delay} from 'node:timers/promises';
import {COFFEE_BREW_MS} from '../shared/coffee.mjs';

test('wave-only mode skips all effects; enabling effects loads once and retries only missing clips',async t=>{
 const hooks=registerHooks({load(url,context,next){return url.endsWith('.wav')?{format:'module',source:`export default ${JSON.stringify(url)}`,shortCircuit:true}:next(url,context);}});t.after(()=>hooks.deregister());
 const saved={fetch:globalThis.fetch,document:globalThis.document,AudioContext:globalThis.AudioContext};t.after(()=>Object.assign(globalThis,saved));
 const events=new EventTarget();globalThis.document=Object.assign(events,{hidden:false});
 const param=()=>({value:0,setValueAtTime(){},setTargetAtTime(){},linearRampToValueAtTime(){},cancelAndHoldAtTime(){}}),node=()=>({gain:param(),threshold:param(),knee:param(),ratio:param(),attack:param(),release:param(),connect(){return this;},disconnect(){},start(){},stop(){}});
 globalThis.AudioContext=class{state='running';currentTime=0;destination=node();createGain=node;createDynamicsCompressor=node;createBufferSource=node;async resume(){}async decodeAudioData(){return{duration:3};}};
 const calls=[];let fail=true;globalThis.fetch=async url=>{calls.push(url);return new Response(new Uint8Array([0]),{status:fail&&url.includes('rustle-b')?503:200});};
 const sound=await import('../src/experience/sound.ts');sound.setActionSounds(false);assert.equal(await sound.enableSound(true),true);assert.equal(calls.length,0);await sound.setSeaSound(true);assert.equal(calls.length,1);assert.match(calls[0],/sea-waves/);
 sound.setActionSounds(true);sound.setActionSounds(true);await delay(20);assert.equal(calls.length,25);
 fail=false;await sound.enableSound(true);await delay(20);assert.equal(calls.length,26);assert.match(calls.at(-1),/rustle-b/);
 await sound.enableSound(false);await sound.enableSound(true);await delay(20);assert.equal(calls.length,26);await sound.enableSound(false);
});

async function delayedAudio(t){
 const hooks=registerHooks({load(url,context,next){return url.endsWith('.wav')?{format:'module',source:`export default ${JSON.stringify(url)}`,shortCircuit:true}:next(url,context);}});
 const saved={fetch:globalThis.fetch,document:globalThis.document,AudioContext:globalThis.AudioContext};
 const document=Object.assign(new EventTarget(),{hidden:false}),pending=new Map(),starts=[],events=[];
 globalThis.document=document;document.addEventListener('pantry-audio-ready',()=>events.push(performance.now()));
 const param=()=>({value:0,setValueAtTime(){},setTargetAtTime(){},linearRampToValueAtTime(){},cancelAndHoldAtTime(){}});
 const node=()=>({gain:param(),pan:param(),playbackRate:param(),threshold:param(),knee:param(),ratio:param(),attack:param(),release:param(),connect(){return this;},disconnect(){},addEventListener(){},start(...args){starts.push({clip:this.buffer?.clip,args});},stop(){}});
 globalThis.AudioContext=class{state='running';currentTime=0;destination=node();createGain=node;createDynamicsCompressor=node;createBufferSource=node;createStereoPanner=node;async resume(){this.state='running';}async suspend(){this.state='suspended';}async decodeAudioData(bytes){return{duration:5,clip:new TextDecoder().decode(bytes)};}};
 globalThis.fetch=url=>new Promise(resolve=>{const name=url.split('/').at(-1);assert.ok(!pending.has(name),'one fetch per clip');pending.set(name,()=>{pending.delete(name);resolve(new Response(name));});});
 const sound=await import(`../src/experience/sound.ts?loading=${t.name}`);
 t.after(async()=>{await sound.enableSound(false);for(const release of [...pending.values()])release();await delay(0);Object.assign(globalThis,saved);hooks.deregister();});
 return {sound,document,pending,starts,events,async release(name){assert.ok(pending.has(name),name+' requested');pending.get(name)();await delay(0);}};
}
const local={remote:false,distance:0,pan:0};

test('a decoded coffee clip becomes usable while unrelated effects are still pending',async t=>{
 const f=await delayedAudio(t);assert.equal(await f.sound.enableSound(true),true);
 assert.equal(f.pending.size,24,'enabling returns without waiting for all clips');
 const readyBefore=f.events.length;assert.equal(f.sound.playMachine(1,local),undefined);
 await f.release('coffee-machine.wav');
 assert.equal(f.events.length,readyBefore+1,'coffee decode wakes current room actions immediately');
 assert.equal(f.pending.size,23,'unrelated clips remain unresolved');
 assert.ok(f.sound.playMachine(1,local));
 assert.deepEqual(f.starts,[{clip:'coffee-machine.wav',args:[0,1,COFFEE_BREW_MS/1000-1]}]);
 await f.sound.enableSound(false);const muted=f.events.length;
 await f.sound.enableSound(true);assert.equal(f.events.length,muted+1,'cached sounds also wake ongoing actions when unmuted');
});

test('late decodes cannot notify or play while muted, effects disabled, or hidden',async t=>{
 const f=await delayedAudio(t);await f.sound.enableSound(true);await f.sound.enableSound(false);let count=f.events.length;
 await f.release('coffee-machine.wav');assert.equal(f.events.length,count);assert.equal(f.sound.playMachine(1,local),undefined);
 await f.sound.enableSound(true);f.sound.setActionSounds(false);count=f.events.length;
 await f.release('tea-pour.wav');assert.equal(f.events.length,count);assert.equal(f.sound.playTeaPour(0,2,local),undefined);
 f.sound.setActionSounds(true);f.document.hidden=true;f.document.dispatchEvent(new Event('visibilitychange'));count=f.events.length;
 await f.release('paper-wax-a.wav');assert.equal(f.events.length,count);assert.equal(f.sound.playMachine(1,local),undefined);
 assert.equal(f.starts.length,0);
});

test('finished coffee and tea intervals never schedule a late audio source',async t=>{
 const f=await delayedAudio(t);await f.sound.enableSound(true);await f.release('coffee-machine.wav');await f.release('tea-pour.wav');
 for(const offset of [COFFEE_BREW_MS/1000,COFFEE_BREW_MS/1000+1,Infinity,NaN])assert.equal(f.sound.playMachine(offset,local),undefined);
 for(const remaining of [0,-.1,NaN])assert.equal(f.sound.playTeaPour(1,remaining,local),undefined);
 assert.equal(f.starts.length,0);assert.ok(f.sound.playTeaPour(1,2,local));assert.equal(f.starts.length,1);
});
