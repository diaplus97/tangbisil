import {visibleThoughts,visibleMessages} from './thoughts.mjs';
import {heldName} from '../shared/rest.mjs';
import {sampleMotion} from '../shared/space.mjs';
import {GameError} from '../shared/errors.mjs';

export const actionNames={take:'간식을 골랐어요',open:'포장을 열었어요',bite:'한입 먹었어요',offer:'시식을 놓았어요',sample:'시식을 가져갔어요',wave:'컵을 들었어요',drink:'음료를 골랐어요'};
export function validateSnackAction(store,m,input){
  if(input.type==='appearance')return;
  if(m.area==='healing'&&['take','offer','sample','retract'].includes(input.type))throw new GameError('간식과 공용 시식은 탕비실에서 준비해 주세요.');
  if(m.travel||sampleMotion(m,Date.now()).moving)throw new GameError('도착하면 이어서 할 수 있어요.');
  if(input.type==='wave'&&heldName(store.activities.get(m.id)))throw new GameError('손에 든 물건을 내려놓고 컵을 들어 주세요.');
  if(input.type==='wave'&&store.activities.get(m.id).coffee.stage!=='carried')throw new GameError('컵을 가져와 자리에 앉은 뒤 들어 주세요.');
  if(input.type==='drink')throw new GameError('커피 머신이나 냉장고 앞으로 걸어가 음료를 준비해 주세요.');
}
// One broadcast shares only the public view. Inventory and claimed offers stay per visitor.
export function roomSnapshotBatch(store,r,version,connected=m=>m.streams.size>0){
  const now=Date.now(),members=[...r.members.values()],counts={pantry:members.filter(m=>(m.area??'pantry')==='pantry').length,healing:members.filter(m=>m.area==='healing').length},areas=new Map();
  return id=>{
    const area=r.members.get(id)?.area??'pantry';
    if(!areas.has(area))areas.set(area,members.filter(m=>(m.area??'pantry')===area).map(m=>{
      const u=store.getUser(m.id),s=store.serving(m.id);
      return {id:m.id,smoking:m.area==='smoking'?m.smoking??null:null,area:m.area??'pantry',travel:m.travel??null,enteredAt:m.enteredAt??0,name:u.name,avatar:u.avatar,drink:u.drink,seat:m.seat,parkedSeat:m.parkedSeat??null,enteredFrom:m.enteredFrom??null,slot:m.slot,motion:m.motion,station:m.station,pantry:store.activities.public(m.id),connected:connected(m),contact:m.contact&&m.contact.until>now?m.contact:null,action:m.action,actionAt:m.actionAt,food:s?{state:s.state,open_progress:s.open_progress,bites:s.bites,portions:s.portions}:null};
    }));
    return {version,serverTime:now,self:store.self(id),room:{id:r.id,area,...(area==='smoking'?{thoughts:visibleThoughts(r,r.members.get(id),now),messages:visibleMessages(r,r.members.get(id),now)}:{}),media:r.media??null,total:members.length,counts:{...counts,...(members.some(m=>m.area==='smoking')?{smoking:members.filter(m=>m.area==='smoking').length}:{})},name:area==='smoking'?'흡연실':area==='healing'?'힐링방':r.id==='window'?'창가 탕비실':'우리 탕비실',members:areas.get(area),fixtures:area==='pantry'?r.fixtures:{fridge:{open:false,owner:null,changedAt:0}},offers:area==='pantry'?store.offers(r.id,id):[],history:r.history.filter(h=>(h.area??'pantry')===area)}};
  };
}
export function roomSnapshot(store,r,id,version,connected){return roomSnapshotBatch(store,r,version,connected)(id);}
