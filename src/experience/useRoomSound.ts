import {useEffect,useRef,useState} from 'react';
import type {Member,Snapshot} from './types';
import {sampleMotion} from '../../shared/space.mjs';
import {playSound,playMachine,playTeaPour,stopRoomSounds,peerSandSound,snackOpenSound,type SoundKind} from './sound';
import {snackDefinition,LEGACY_SNACK_ID} from '../../shared/snacks.mjs';
import {CUP_RETURN_MS,SIP_RETURN_MS} from './gestureTiming';
import {COFFEE_BREW_MS,CUP_PLACE_MS} from '../../shared/coffee.mjs';
import {keepsCupContact} from './cupContact';

export function useRoomSound(state:Snapshot|null,online=true){
  const contacts=useRef(new Map<string,{at:number;voice:ReturnType<typeof peerSandSound>}>());
  useEffect(()=>{
   if(!state||!online){stopRoomSounds();return;}
   const started=performance.now();
   const update=()=>{
    const now=state.serverTime+performance.now()-started,self=state.room.members.find(v=>v.id===state.self.id);
    for(const [id,playing]of contacts.current){const m=state.room.members.find(v=>v.id===id);if(document.hidden||!m?.connected||!m.contact||m.contact.until<=now||m.contact.kind!=='rake'){playing.voice?.stop();contacts.current.delete(id);}}
    if(document.hidden||!self)return;
    for(const m of state.room.members){if(m.id===self.id||!m.connected||m.contact?.kind!=='rake'||m.contact.until<=now)continue;
     const old=contacts.current.get(m.id);if(old&&now-old.at<220)continue;
     const p=sampleMotion(m,now),q=sampleMotion(self,now);old?.voice?.stop();
     contacts.current.set(m.id,{at:now,voice:peerSandSound(Math.hypot(p.x-q.x,p.z-q.z),(p.x-q.x)/5)});
    }
   };update();const timer=setInterval(update,70);return()=>clearInterval(timer);
  },[state,online]);
  useEffect(()=>()=>{for(const item of contacts.current.values())item.voice?.stop();contacts.current.clear();},[]);
  const [audioReady,setAudioReady]=useState(0);
  useEffect(()=>{const ready=()=>setAudioReady(n=>n+1);document.addEventListener('pantry-audio-ready',ready);return()=>document.removeEventListener('pantry-audio-ready',ready);},[]);
  const seen=useRef(new Map<string,string>()),pending=useRef(new Map<string,{timer:ReturnType<typeof setTimeout>;action:string;at:number}>());
  const brews=useRef(new Map<string,{end:number;voice:ReturnType<typeof playMachine>}>()),fridge=useRef<Snapshot['room']['fixtures']['fridge']|null>(null),doorTimer=useRef<ReturnType<typeof setTimeout>>();
  useEffect(()=>{const mute=()=>{for(const b of brews.current.values())b.voice?.stop();brews.current.clear();for(const item of pending.current.values())clearTimeout(item.timer);pending.current.clear();};document.addEventListener('pantry-audio-muted',mute);return()=>document.removeEventListener('pantry-audio-muted',mute);},[]);
  const pours=useRef(new Map<string,{end:number;voice:ReturnType<typeof playTeaPour>}>());
  useEffect(()=>{if(!online){for(const item of pending.current.values())clearTimeout(item.timer);pending.current.clear();for(const b of brews.current.values())b.voice?.stop();brews.current.clear();for(const p of pours.current.values())p.voice?.stop();pours.current.clear();}},[online]);
  useEffect(()=>{const stop=()=>{for(const p of pours.current.values())p.voice?.stop();pours.current.clear();};document.addEventListener('pantry-audio-muted',stop);return()=>{stop();document.removeEventListener('pantry-audio-muted',stop);};},[]);
  useEffect(()=>{stopRoomSounds();seen.current.clear();for(const item of pending.current.values())clearTimeout(item.timer);pending.current.clear();clearTimeout(doorTimer.current);fridge.current=null;for(const b of brews.current.values())b.voice?.stop();brews.current.clear();for(const p of pours.current.values())p.voice?.stop();pours.current.clear();},[state?.room.area]);
  const latest=useRef({state,received:performance.now()});
  useEffect(()=>{
    if(latest.current.state!==state)latest.current={state,received:performance.now()};
    if(!state||!online)return;
    function playFor(m:Member,kind:SoundKind){
      const current=latest.current.state;if(!current||!current.room.members.some(v=>v.id===m.id))return;
      const remote=m.id!==current.self.id,now=current.serverTime+performance.now()-latest.current.received;
      const self=current.room.members.find(v=>v.id===current.self.id),p=sampleMotion(m,now),q=self?sampleMotion(self,now):p;
      const options={remote,distance:Math.hypot(p.x-q.x,p.z-q.z),pan:remote?(p.x-q.x)/5:0};
      if(kind==='open')snackOpenSound(snackDefinition(m.food?.snack_id??LEGACY_SNACK_ID,m.food?.definition_version??1)?.kind??'lemonPie',options);else playSound(kind,options);
    }
    const door=state.room.fixtures?.fridge,previous=fridge.current;fridge.current=door;
    if(previous&&door&&previous.open!==door.open){
      clearTimeout(doorTimer.current);const owner=state.room.members.find(m=>m.id===(door.owner??previous.owner));
      if(owner){if(door.open)playFor(owner,'fridgeOpen');else doorTimer.current=setTimeout(()=>playFor(owner,'fridgeClose'),300);}
    }
    const now=state.serverTime+performance.now()-latest.current.received;
    for(const [id,brew]of brews.current){const m=state.room.members.find(m=>m.id===id);if(!m?.connected||m.station!=='coffee'||m.pantry?.coffee.stage!=='brewing'||m.pantry.coffee.readyAt!==brew.end||brew.end<=now){brew.voice?.stop();brews.current.delete(id);}}
    for(const [id,p] of pours.current){const m=state.room.members.find(m=>m.id===id),t=m?.pantry.rest?.tea;if(!m?.connected||m.station!=='tea'||!t?.pourAt||t.pourEnd!==p.end||p.end<=now){p.voice?.stop();pours.current.delete(id);}}
    for(const m of state.room.members){const t=m.pantry.rest?.tea;if(!m.connected||m.station!=='tea'||!t?.pourAt||t.pourEnd<=now||pours.current.has(m.id))continue;const self=state.room.members.find(v=>v.id===state.self.id),p=sampleMotion(m,now),q=self?sampleMotion(self,now):p,remaining=(t.pourEnd-now)/1000;const voice=playTeaPour(Math.max(0,3-remaining),remaining,{remote:m.id!==state.self.id,distance:Math.hypot(p.x-q.x,p.z-q.z),pan:(p.x-q.x)/5});if(voice)pours.current.set(m.id,{end:t.pourEnd,voice});}
    for(const m of state.room.members){const coffee=m.pantry?.coffee;if(!m.connected||m.station!=='coffee'||coffee?.stage!=='brewing'||coffee.readyAt<=now||brews.current.has(m.id))continue;
      const self=state.room.members.find(v=>v.id===state.self.id),p=sampleMotion(m,state.serverTime),q=self?sampleMotion(self,state.serverTime):p;
      const voice=playMachine(Math.max(0,(COFFEE_BREW_MS-coffee.readyAt+now)/1000),{remote:m.id!==state.self.id,distance:Math.hypot(p.x-q.x,p.z-q.z),pan:(p.x-q.x)/5});if(voice)brews.current.set(m.id,{end:coffee.readyAt,voice});
    }
    for(const m of state.room.members){
      const key=m.actionAt+':'+m.action,old=seen.current.get(m.id);seen.current.set(m.id,key);
      const queued=pending.current.get(m.id);
      if(queued&&!keepsCupContact(queued,m)){clearTimeout(queued.timer);pending.current.delete(m.id);if(['cup-sip','tea-sip','bottle-sip'].includes(queued.action)&&m.connected&&['bite','open','unwrap'].includes(m.action)&&m.actionAt>queued.at&&m.actionAt-queued.at<SIP_RETURN_MS)playFor(m,'putdown');}
      if(!old||old===key||!m.connected||state.serverTime-m.actionAt>1600)continue;
      if(['cup-sip','tea-sip','bottle-sip','wave','coffee-place','coffee-take'].includes(m.action)){
        const contact=['cup-sip','tea-sip','bottle-sip'].includes(m.action)?SIP_RETURN_MS:m.action==='wave'?CUP_RETURN_MS:m.action==='coffee-place'?CUP_PLACE_MS:120;
        const delay=Math.max(0,m.actionAt+contact-now),deadline=performance.now()+delay;
        const source={action:m.action,at:m.actionAt};
        const timer=setTimeout(()=>{
          pending.current.delete(m.id);
          const current=latest.current.state?.room.members.find(v=>v.id===m.id);
          if(!current||!keepsCupContact(source,current)||performance.now()-deadline>250)return;
          playFor(current,source.action==='coffee-take'?'cup':'putdown');
        },delay);pending.current.set(m.id,{...source,timer});
        continue;
      }
      const objectKind:SoundKind|null=m.action==='sand-edit'&&m.pantry.rest.sand?.changedKind==='stone'&&m.id!==state.self.id?'sandStone':m.action==='plant-spray'?'spray':m.action==='tea-bag'?'teabag':['tea-place','tea-remove','tea-hold'].includes(m.action)?'putdown':['tea-take'].includes(m.action)?'cup':m.action==='candy-take'?'candy':m.action==='candy-unwrap'&&m.id!==state.self.id?'candy':m.action==='coffee-place'?'putdown':['coffee-take','bottle-take'].includes(m.action)?'cup':null;
      if(objectKind){playFor(m,objectKind);continue;}
      if(m.id===state.self.id)continue;
      const kind=m.action==='open'?'open':m.action==='take'?'paper':m.action==='drink'?'pour':['offer','sample'].includes(m.action)?'cup':null;
      if(kind)playFor(m,kind);
    }
    for(const id of seen.current.keys())if(!state.room.members.some(m=>m.id===id)){
      seen.current.delete(id);clearTimeout(pending.current.get(id)?.timer);pending.current.delete(id);
    }
  },[state,audioReady,online]);
  useEffect(()=>()=>{for(const item of pending.current.values())clearTimeout(item.timer);pending.current.clear();seen.current.clear();clearTimeout(doorTimer.current);for(const brew of brews.current.values())brew.voice?.stop();brews.current.clear();},[]);
}
