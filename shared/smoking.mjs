// The terrace has six individually reserved places and a clear path behind each row.
export const smokingSeats=[
 [-2.9,-1.40,2.85],[-1.60,-1.65,2.98],[-.30,-1.75,Math.PI],
 [.98,-1.68,-3.04],[-1.75,1.38,2.75],[-.42,1.24,2.91]
];
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
