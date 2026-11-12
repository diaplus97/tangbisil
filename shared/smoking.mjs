// Four inward-facing seats share a round table; two still face the sea.
export const smokingLayoutVersion=2;
export const smokingCenter={x:-.45,z:.25,y:1.02,radius:1.09};
export const smokingSeats=[
 [-1.69,1.49,Math.PI*.75],[.79,-.99,-Math.PI*.25],
 [.79,1.49,-Math.PI*.75],[-1.69,-.99,Math.PI*.25],
 [-2.4,-2.85,Math.PI],[1.65,-2.85,Math.PI]
];
export function smokingTable(index){
 const [x,z,yaw]=smokingSeats[index],side=.05,front=.82;
 return {x:x+Math.cos(yaw)*side+Math.sin(yaw)*front,y:1.02,z:z+Math.cos(yaw)*front-Math.sin(yaw)*side,yaw};
}
export function smokingAshtray(index){
 const t=smokingTable(index),x=-.085,z=.035;
 return {x:t.x+Math.cos(t.yaw)*x+Math.sin(t.yaw)*z,y:t.y+.030,z:t.z-Math.sin(t.yaw)*x+Math.cos(t.yaw)*z};
}
export const smokingBounds={minX:-4.18,maxX:4.15,minZ:-3.55,maxZ:3.62};
export const smokingEntrance={id:'smokingDoor',name:'흡연실로',to:'smoking',x:7.82,z:-4.8,y:1.5,approach:{x:7.08,z:-4.18},yaw:Math.PI/2};
export const smokingExit={id:'terraceExit',name:'탕비실로 돌아가기',to:'pantry',x:4.52,z:2.14,y:1.5,approach:{x:3.73,z:2.14},yaw:Math.PI/2};
export const thoughtPhrases={
 meetings:'회의가 길었어.',
 messages:'답장은 조금 이따 하고 싶어.',
 tired:'오늘은 유난히 기운이 없네.',
 quiet:'잠깐 혼자 있고 싶어.'
};
export const thoughtLifetime=45000;
export const thoughtFadeMs=10000;
export const thoughtMaxLength=80;
export const thoughtInterval=3000;
export function normalizeThought(value){
 if(typeof value!=='string'||value.length>thoughtMaxLength*4)return null;
 const text=value.normalize('NFC').replace(/[\r\n\t]+/g,' ').trim();
 if(!text||[...text].length>thoughtMaxLength||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(text)||!text.replace(/[\s\u200b-\u200f\ufeff]/gu,''))return null;
 return text;
}
export const SMOKE_LIGHT_MS=1200;
export const SMOKE_PUFF_MS=5200;
export const SMOKE_OUT_MS=700;
export const SMOKE_MAX_PUFFS=7;
export function smokingPhase(smoking,now){
  if(!smoking)return 'idle';
  if(smoking.endedAt)return smoking.ending&&now<smoking.endedAt+SMOKE_OUT_MS?'ending':'idle';
  if(smoking.puffs>=SMOKE_MAX_PUFFS&&smoking.puffAt&&now>=smoking.puffAt+SMOKE_PUFF_MS)return 'idle';
  if(now<smoking.litAt+SMOKE_LIGHT_MS)return 'lighting';
  if(smoking.puffAt&&now<smoking.puffAt+SMOKE_PUFF_MS)return 'puffing';
  return 'ready';
}
export function smokingVisual(s,now){
 const phase=smokingPhase(s,now),age=phase==='lighting'?now-s.litAt:phase==='puffing'?now-s.puffAt:phase==='ending'?now-s.endedAt:0;
 const clamp=v=>Math.max(0,Math.min(1,v)),smooth=v=>{const t=clamp(v);return t*t*(3-2*t);};
 const puffAge=s?.puffAt?Math.max(0,now-s.puffAt):Infinity,progress=smooth((puffAge-550)/750);
 const burnt=Math.min(SMOKE_MAX_PUFFS,Math.max(0,(s?.puffs??0)-(puffAge<1300?1-progress:0)));
 const finished=Boolean(s&&(s.endedAt||s.puffs>=SMOKE_MAX_PUFFS&&puffAge>=SMOKE_PUFF_MS));
 const lift=phase==='lighting'?smooth(Math.min(age/350,(SMOKE_LIGHT_MS-age)/350)):phase==='puffing'?smooth(age/500)*(1-smooth((age-1150)/650)):0;
 const ashReach=phase==='puffing'?smooth((age-2950)/550)*(1-smooth((age-4250)/650)):0;
 const tap=phase==='puffing'&&age>=3550&&age<4050?Math.sin((age-3550)/500*Math.PI*4)*.065:0;
 return{phase,age,lift,ashReach,tap,ashDrop:phase==='puffing'&&age>=3750&&age<4300?(age-3750)/550:-1,
  paperLength:.077-burnt*.0095,ashLength:phase==='puffing'&&age<3750?.002+progress*.010:.002,
  emberPull:phase==='puffing'?smooth((age-400)/200)*(1-smooth((age-1150)/250)):.14,
  active:phase==='lighting'||phase==='puffing'||phase==='ready',finished};
}
export function smokingDeadline(smoking,now){
  const phase=smokingPhase(smoking,now);
  return phase==='lighting'?smoking.litAt+SMOKE_LIGHT_MS:phase==='puffing'?smoking.puffAt+SMOKE_PUFF_MS:phase==='ending'?smoking.endedAt+SMOKE_OUT_MS:0;
}

// One visual state for the whole room, independent of author, note count or viewer.
export function ribbonState(notes,now){
  let state=0;
  for(const note of notes??[]){
    if(note.until<=now)continue;
    if(note.hasEcho)return 2;
    state=1;
  }
  return state;
}
