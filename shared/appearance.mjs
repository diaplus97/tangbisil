// The stored choice selects the outfit. The immutable visitor id tailors it
// identically in every room and on every viewer, including older accounts.
export const avatarDimensions=Object.freeze({legUpper:.34,legLower:.43,standHip:.892,headY:.76,headScale:1.18,footY:.122});
export function avatarEyeHeight(area='pantry',seat=null){
 const eyeY=avatarDimensions.headY+.008*avatarDimensions.headScale,eyeZ=.012+.195*avatarDimensions.headScale;
 if(seat==null)return avatarDimensions.standHip+eyeY;
 if(area==='healing')return seat<4?.41+eyeY*Math.cos(.2)+eyeZ*Math.sin(.2):.61+eyeY;
 return .755+eyeY;
}
export const outfits=[
 {name:'남색 카디건',coat:'#38556c',sleeve:'#38556c',pants:'#938578',shoe:'#ddd2bd',quilt:false},
 {name:'베이지 셔츠',coat:'#b5a38c',sleeve:'#d9c8ae',pants:'#5d6563',shoe:'#70665e',quilt:false},
 {name:'밤색 니트 카디건',coat:'#9d5033',sleeve:'#9d5033',pants:'#57463e',shoe:'#e4d9c7',quilt:false},
 {name:'라일락 누빔 조끼',coat:'#9f889e',sleeve:'#e3cfb2',pants:'#8b807a',shoe:'#655b5c',quilt:true}
];
export function avatarChoice(value){
 return Number.isInteger(value)&&value>=0&&value<outfits.length?value:0;
}
function dyed(hex,tone){
 const rgb=parseInt(hex.slice(1),16);
 const target=tone>0?[231,216,202]:[29,36,45];
 const parts=[rgb>>16,(rgb>>8)&255,rgb&255].map((v,i)=>Math.round(v+(target[i]-v)*Math.abs(tone)*.53).toString(16).padStart(2,'0'));
 return '#'+parts.join('');
}
export function appearance(avatar,id){
 const choice=avatarChoice(avatar);
 let hash=2166136261;
 for(const char of id)hash=Math.imul(hash^char.charCodeAt(0),16777619)>>>0;
 const cut=(hash>>>9)%4;
 const bun=choice===3||choice===1&&cut!==0||choice!==2&&cut===3;
 const outfit=outfits[choice],tone=((hash>>>16)&255)/255-.5;
 return {...outfit,coat:dyed(outfit.coat,tone),sleeve:dyed(outfit.sleeve,tone),pants:dyed(outfit.pants,tone*.6),choice,cut,bun,part:hash&1?1:-1,
  tone,hem:((hash>>>2)&15)/15,
  hair:['#433329','#504034','#5a4030','#392e2a'][(hash>>>5)&3]};
}
