// Time-derived liquid state is shared by the server and the rendered cup.
export const emptyRest=()=>({sprayer:false,sprayAt:0,brushAt:0,stone:null,tea:null,sand:null,vase:null,lastPlaced:null});
export function sampleTea(tea,now){
 if(!tea)return null;
 const t={...tea};
 if(t.pourAt){t.volume=Math.min(1,t.volume+Math.max(0,Math.min(now,t.pourEnd)-t.pourAt)/3000);t.pourAt=now<t.pourEnd?now:0;}
 if(t.bagIn&&t.steepAt){t.strength=Math.min(1,t.strength+Math.max(0,now-t.steepAt)/9000);t.steepAt=now;}
 return t;
}
export function heldName(p,except){
 if(except!=='vase'&&p.rest?.vase?.held)return '꽃병';
 if(except!=='sand'&&p.rest?.sand?.held)return '모래 트레이';
 if(except!=='sprayer'&&p.rest?.sprayer)return '분무기';
 if(except!=='stone'&&p.rest?.stone?.held)return '말랑돌';
 if(except!=='tea'&&p.rest?.tea?.held)return '찻잔';
 if(except!=='candy'&&p.candy?.held&&p.candy.state!=='eaten')return '사탕';
 if(except!=='bottle'&&p.bottle?.held&&p.bottle.sips<3)return '음료 병';
 return null;
}
