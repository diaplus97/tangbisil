// The terrace has six individually reserved places and a clear path behind each row.
export const smokingSeats=[
 [-2.9,-1.40,2.85],[-1.60,-1.65,2.98],[-.30,-1.75,Math.PI],
 [.98,-1.68,-3.04],[-1.75,1.38,2.75],[-.42,1.24,2.91]
];
export function smokingTable(index){
 const [x,z,yaw]=smokingSeats[index],side=.05,front=.82;
 return {x:x+Math.cos(yaw)*side+Math.sin(yaw)*front,y:1.02,z:z+Math.cos(yaw)*front-Math.sin(yaw)*side,yaw};
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
export const SMOKE_LIGHT_MS=1200;
export const SMOKE_PUFF_MS=3200;
export const SMOKE_OUT_MS=700;
export function smokingPhase(smoking,now){
  if(!smoking)return 'idle';
  if(smoking.endedAt)return smoking.ending&&now<smoking.endedAt+SMOKE_OUT_MS?'ending':'idle';
  if(now<smoking.litAt+SMOKE_LIGHT_MS)return 'lighting';
  if(smoking.puffAt&&now<smoking.puffAt+SMOKE_PUFF_MS)return 'puffing';
  return 'ready';
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
