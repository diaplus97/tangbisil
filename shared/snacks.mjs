// Definitions are immutable once a version has shipped. Shelf rotation never
// changes an owned serving, including its original portion count and shape.
export const LEGACY_SNACK_ID='lemon-sandwich-pie';
export const SNACK_CATALOG_REVISION=1;
export const snackCatalog=Object.freeze([
 Object.freeze({id:LEGACY_SNACK_ID,version:1,name:'레몬 샌드파이',kind:'lemonPie',portions:3,opening:'peel',openingLabel:'포장 끝을 오른쪽으로 당겨요',description:'겹겹이 바삭한 파이 사이 레몬 크림'}),
 Object.freeze({id:'hanjungsun-strawberry-mochi',version:1,name:'한정선 생딸기 찹쌀떡',kind:'fruitMochi',portions:3,opening:'gather',openingLabel:'묶음을 풀고 종이를 양옆으로 펼쳐요',description:'얇은 흰 떡피와 앙금 속 통딸기'}),
 Object.freeze({id:'layered-chocolate-mochi',version:1,name:'겹겹이 초코 찹쌀떡',kind:'layeredMochi',portions:3,opening:'slide',openingLabel:'종이 슬리브를 왼쪽으로 밀어요',description:'얇은 떡과 초콜릿이 겹쳐진 단면'}),
 Object.freeze({id:'dubai-chewy-cookie',version:1,name:'두쫀쿠',kind:'dubaiCookie',portions:3,opening:'fold',openingLabel:'종이 포장을 양옆으로 펼쳐요',description:'쫀득한 외피 안의 피스타치오 카다이프'}),
]);
export function snackDefinition(id,version=1){return snackCatalog.find(s=>s.id===id&&s.version===version)??null;}
const DAY=86400000,SEOUL=9*3600000,epoch=Math.floor((Date.UTC(2026,10,11,15)+SEOUL)/DAY);
export function snackDisplay(now=Date.now()){
 const day=Math.floor((now+SEOUL)/DAY),cycle=((day-epoch)%12+12)%12,slots=[1,2,3];let reserve=0;
 // Exchange one slot per day, including the final day of the 12-day cycle.
 for(let step=1;step<=cycle;step++){const slot=(step-1)%3,old=slots[slot];slots[slot]=reserve;reserve=old;}
 const dayId=new Date(day*DAY).toISOString().slice(0,10);
 return{catalogRevision:SNACK_CATALOG_REVISION,dayId,displayId:`daily-${SNACK_CATALOG_REVISION}:${dayId}`,nextChangeAt:(day+1)*DAY-SEOUL,
  slots:slots.map((index,slot)=>({slot,snackId:snackCatalog[index].id,definitionVersion:snackCatalog[index].version}))};
}
