import rustleA from '../assets/audio/rustle-a.wav';
import rustleB from '../assets/audio/rustle-b.wav';
import rustleC from '../assets/audio/rustle-c.wav';
import touch from '../assets/audio/foil-touch.wav';
import open from '../assets/audio/wrapper-open.wav';
import cup from '../assets/audio/cup-down.wav';
import pour from '../assets/audio/tea-pour.wav';
import bite from '../assets/audio/biscuit-bite.wav';
import seaUrl from '../assets/environments/sea-waves.wav';
import coffeeMachine from '../assets/audio/coffee-machine.wav';
import fridgeOpen from '../assets/audio/fridge-open.wav';
import spray from '../assets/audio/plant-spray.wav';
import {COFFEE_BREW_MS} from '../../shared/coffee.mjs';
import fridgeClose from '../assets/audio/fridge-close.wav';

import sandA from '../assets/audio/sand-a.wav';
import sandB from '../assets/audio/sand-b.wav';
import sandC from '../assets/audio/sand-c.wav';
import sandStone from '../assets/audio/sand-stone.wav';

const urls={sandA,sandB,sandC,sandStone,rustleA,rustleB,rustleC,touch,open,cup,pour,bite,coffeeMachine,fridgeOpen,fridgeClose,spray};
type Clip=keyof typeof urls;
type Voice={source:AudioBufferSourceNode;gain:GainNode;panner:StereoPannerNode;remote:boolean;rustle:boolean;stop:()=>void};
let context:AudioContext|undefined,master:GainNode|undefined,limiter:DynamicsCompressorNode|undefined;
let enabled=false,actions=true,mouth=false,others=true,volume=.6,generation=0,loading:Promise<void>|undefined;
const buffers=new Map<Clip,AudioBuffer>(),voices=new Set<Voice>();
let lastPeer=-Infinity,lastGrain=-Infinity,variant=0,dragTimer:ReturnType<typeof setTimeout>|undefined;
let seaWanted=false,seaVolume=.4,seaGeneration=0,seaBuffer:AudioBuffer|undefined,seaLoading:Promise<AudioBuffer>|undefined;
let seaVoice:{source:AudioBufferSourceNode;gain:GainNode}|undefined;
function stopSea(){
  const voice=seaVoice;seaVoice=undefined;if(!voice||!context)return;
  voice.gain.gain.cancelAndHoldAtTime(context.currentTime);voice.gain.gain.linearRampToValueAtTime(0,context.currentTime+.3);
  try{voice.source.stop(context.currentTime+.31);}catch{}
}
function startSea(){
  if(!enabled||!seaWanted||!context||!master||!seaBuffer||seaVoice)return;
  const source=context.createBufferSource(),gain=context.createGain();source.buffer=seaBuffer;source.loop=true;
  source.loopStart=0;source.loopEnd=seaBuffer.duration;
  gain.gain.setValueAtTime(0,context.currentTime);gain.gain.linearRampToValueAtTime(seaVolume,context.currentTime+1.2);
  source.connect(gain).connect(master);source.onended=()=>{source.disconnect();gain.disconnect();};seaVoice={source,gain};source.start();
}
export function setSeaVolume(value:number){seaVolume=Math.max(0,Math.min(1,value));if(context&&seaVoice){seaVoice.gain.gain.cancelAndHoldAtTime(context.currentTime);seaVoice.gain.gain.linearRampToValueAtTime(seaVolume,context.currentTime+.08);}}
export async function setSeaSound(on:boolean){
  seaWanted=on;const ticket=++seaGeneration;
  if(!on){stopSea();return true;}
  if(!context||!enabled)return false;
  try{
    seaLoading??=fetch(seaUrl).then(async response=>{if(!response.ok)throw new Error('Sea audio unavailable');return context!.decodeAudioData(await response.arrayBuffer());});
    seaBuffer=await seaLoading;
    if(ticket!==seaGeneration||!seaWanted||!enabled)return true;
    startSea();return true;
  }catch{if(ticket===seaGeneration)seaWanted=false;seaLoading=undefined;return false;}
}
export function setSoundVolume(value:number){volume=Math.max(0,Math.min(1,value));if(context&&master){master.gain.cancelAndHoldAtTime(context.currentTime);master.gain.linearRampToValueAtTime(enabled?volume:0,context.currentTime+.04);}}
export function setBiteSound(on:boolean){mouth=on;}
export function setOtherSounds(on:boolean){others=on;if(!on)for(const v of voices)if(v.remote)v.stop();}
export function setActionSounds(on:boolean){actions=on;if(!on){stopRoomSounds();document.dispatchEvent(new Event('pantry-audio-muted'));}else document.dispatchEvent(new Event('pantry-audio-ready'));}
export function stopRoomSounds(){stopSandSound();stopWrapperSound();for(const voice of voices)voice.stop();}
export async function enableSound(on:boolean){
  enabled=on;const ticket=++generation;
  if(!on){seaWanted=false;seaGeneration++;stopSea();stopSandSound();stopWrapperSound();for(const v of voices)v.stop();document.dispatchEvent(new Event('pantry-audio-muted'));if(context&&master)master.gain.setTargetAtTime(0,context.currentTime,.015);return true;}
  try{
    if(!context){
      context=new AudioContext();master=context.createGain();master.gain.value=volume;
      limiter=context.createDynamicsCompressor();limiter.threshold.value=-18;limiter.knee.value=9;limiter.ratio.value=4;limiter.attack.value=.005;limiter.release.value=.16;
      limiter.connect(master).connect(context.destination);
      document.addEventListener('visibilitychange',()=>{if(document.hidden){stopSandSound();stopWrapperSound();for(const v of voices)v.stop();document.dispatchEvent(new Event('pantry-audio-muted'));void context?.suspend();}else if(enabled)void context?.resume().then(()=>document.dispatchEvent(new Event('pantry-audio-ready')));});
    }
    master!.gain.setTargetAtTime(volume,context.currentTime,.025);if(!document.hidden)await context.resume();
    loading??=Promise.allSettled(Object.entries(urls).map(async([key,url])=>{
      const response=await fetch(url);if(!response.ok)throw new Error('Audio unavailable');
      buffers.set(key as Clip,await context!.decodeAudioData(await response.arrayBuffer()));
    })).then(results=>{if(results.some(result=>result.status==='rejected'))loading=undefined;if(enabled)document.dispatchEvent(new Event('pantry-audio-ready'));});
    // Ocean playback must not wait for (or fail with) an unrelated object clip.
    return enabled&&ticket===generation;
  }catch{if(ticket===generation)enabled=false;loading=undefined;return false;}
}
function play(clip:Clip,{gain=1,rate=1,pan=0,remote=false,rustle=false,offset=0,duration}:{gain?:number;rate?:number;pan?:number;remote?:boolean;rustle?:boolean;offset?:number;duration?:number}={}){
  if(!enabled||!actions||document.hidden||!context||context.state!=='running'||!limiter||!buffers.has(clip)||(remote&&!others))return;
  if(remote&&(voices.size>=4||[...voices].filter(v=>v.remote).length>=2))return;
  if(voices.size>=6){const old=[...voices].find(v=>v.remote)||[...voices][0];old?.stop();}
  const a=context,buffer=buffers.get(clip)!,source=a.createBufferSource(),g=a.createGain(),panner=a.createStereoPanner();
  source.buffer=buffer;source.playbackRate.value=rate;panner.pan.value=Math.max(-.65,Math.min(.65,pan));
  const length=Math.min(duration??buffer.duration-offset,buffer.duration-offset),seconds=length/rate,now=a.currentTime;
  g.gain.setValueAtTime(0,now);g.gain.linearRampToValueAtTime(gain,now+Math.min(.014,seconds/4));
  g.gain.setValueAtTime(gain,now+Math.max(.015,seconds-.055));g.gain.linearRampToValueAtTime(0,now+seconds);
  source.connect(g).connect(panner).connect(limiter);
  let stopped=false;
  const voice:Voice={source,gain:g,panner,remote,rustle,stop(){
    if(stopped)return;stopped=true;g.gain.cancelAndHoldAtTime(a.currentTime);g.gain.linearRampToValueAtTime(0,a.currentTime+.04);try{source.stop(a.currentTime+.045);}catch{}
  }};
  source.onended=()=>{voices.delete(voice);source.disconnect();g.disconnect();panner.disconnect();};voices.add(voice);
  source.start(now,offset,length);return voice;
}
export type SoundKind='sandStone'|'open'|'bite'|'cup'|'paper'|'pour'|'putdown'|'candy'|'fridgeOpen'|'fridgeClose'|'spray'|'teabag';
export function playSound(kind:SoundKind,options:{remote?:boolean;distance?:number;pan?:number}={}){
  if(kind==='bite'&&(!mouth||options.remote))return;
  if(options.remote){const now=performance.now();if(now-lastPeer<360)return;lastPeer=now;}
  const clip:Clip=kind==='teabag'?'touch':kind==='paper'?'touch':kind==='putdown'?'cup':kind==='candy'?'rustleB':kind;
  const strength=kind==='sandStone'?1:kind==='teabag'?.25:kind==='spray'?.65:kind==='putdown'?.7:kind==='bite'?.75:.95;
  const gain=strength*(options.remote?.22/(1+(options.distance??0)*.4):1);
  play(clip,{gain:kind==='candy'?gain*.6:gain,remote:options.remote,pan:options.pan,rate:(kind==='putdown'?.9:kind==='candy'?1.22:1)+(Math.random()-.5)*.05,...(kind==='candy'?{duration:.18,offset:.35}:kind==='paper'?{duration:.18,offset:.1}:{})});
}
export function playMachine(offset:number,options:{remote:boolean;distance:number;pan:number}){
  return play('coffeeMachine',{offset:Math.max(0,offset),duration:Math.max(.01,COFFEE_BREW_MS/1000-offset),gain:options.remote?.18/(1+options.distance*.3):.8,remote:options.remote,pan:options.pan});
}
export function playTeaPour(offset:number,seconds:number,options:{remote:boolean;distance:number;pan:number}){const rate=2.15/3;return play('pour',{offset:Math.max(0,offset*rate),duration:Math.max(.01,seconds*rate),rate,gain:options.remote?.17/(1+options.distance*.4):.65,remote:options.remote,pan:options.pan});}
export function candyWrapperMotion(){const now=performance.now();if(now-lastGrain<120)return;lastGrain=now;play('rustleA',{rustle:true,duration:.15,offset:.2,gain:.5,rate:1.22});}
export function wrapperMotion(speed:number,progress:number){
  if(!enabled||speed<.015){stopWrapperSound();return;}
  clearTimeout(dragTimer);dragTimer=setTimeout(stopWrapperSound,90);
  const now=performance.now();if(now-lastGrain<100)return;lastGrain=now;
  const key=(['rustleA','rustleB','rustleC'] as const)[variant++%3],buffer=buffers.get(key);if(!buffer)return;
  const offset=((progress*.81+variant*.27)%1)*Math.max(0,buffer.duration-.26);
  const grains=[...voices].filter(v=>v.rustle);while(grains.length>=2)grains.shift()?.stop();
  play(key,{rustle:true,duration:.18,offset,gain:Math.min(.78,.15+Math.sqrt(speed)*.27),rate:Math.min(1.13,.92+speed*.045)});
}
export function stopWrapperSound(){clearTimeout(dragTimer);for(const v of voices)if(v.rustle)v.stop();lastGrain=-Infinity;}
let sandVariant=0,lastSand=-Infinity,sandTimer:ReturnType<typeof setTimeout>|undefined;
const sandVoices=new Set<Voice>();
export function stopSandSound(){clearTimeout(sandTimer);for(const v of sandVoices)v.stop();sandVoices.clear();lastSand=-Infinity;}
export function sandMotion(speed:number){
 if(speed<.006)return;
 clearTimeout(sandTimer);sandTimer=setTimeout(stopSandSound,100);
 const now=performance.now();if(now-lastSand<125)return;lastSand=now;
 // Two short overlapping grains, subtle speed response and an immediate release fade.
 for(const v of [...sandVoices])if(!voices.has(v))sandVoices.delete(v);
 if(sandVoices.size>=2){const first=[...sandVoices][0];first.stop();sandVoices.delete(first);}
 const voice=play((['sandA','sandB','sandC'] as const)[sandVariant++%3],{duration:.24,offset:(sandVariant%3)*.06,gain:.6+Math.min(.2,speed*.12),rate:.96+Math.min(.08,speed*.025)});
 if(voice)sandVoices.add(voice);
}
export function peerSandSound(distance:number,pan:number){
 return play((['sandA','sandB','sandC'] as const)[sandVariant++%3],{remote:true,duration:.24,offset:.06,gain:.2/(1+distance*.5),rate:1,pan});
}
export function sandStrokeSound(){
 const voice=play((['sandA','sandB','sandC'] as const)[sandVariant++%3],{duration:.3,offset:.05,gain:.7,rate:1});
 if(voice){sandVoices.add(voice);voice.source.addEventListener('ended',()=>sandVoices.delete(voice),{once:true});}
}
