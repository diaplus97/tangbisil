import {heldName} from '../shared/rest.mjs';
import {sampleMotion} from '../shared/space.mjs';
import {GameError} from '../shared/errors.mjs';

export const actionNames={take:'간식을 골랐어요',open:'포장을 열었어요',bite:'한입 먹었어요',offer:'시식을 놓았어요',sample:'시식을 가져갔어요',wave:'컵을 들었어요',drink:'음료를 골랐어요'};
export function validateSnackAction(store,m,input){
  if(m.area==='healing'&&['take','offer','sample','retract'].includes(input.type))throw new GameError('간식과 공용 시식은 탕비실에서 준비해 주세요.');
  if(m.travel||sampleMotion(m,Date.now()).moving)throw new GameError('도착하면 이어서 할 수 있어요.');
  if(input.type==='wave'&&heldName(store.activities.get(m.id)))throw new GameError('손에 든 물건을 내려놓고 컵을 들어 주세요.');
  if(input.type==='wave'&&store.activities.get(m.id).coffee.stage!=='carried')throw new GameError('컵을 가져와 자리에 앉은 뒤 들어 주세요.');
  if(input.type==='drink')throw new GameError('커피 머신이나 냉장고 앞으로 걸어가 음료를 준비해 주세요.');
}
export function roomSnapshot(store,r,id,version,connected=m=>m.streams.size>0){
  const area=r.members.get(id)?.area??'pantry',members=[...r.members.values()],counts={pantry:members.filter(m=>(m.area??'pantry')==='pantry').length,healing:members.filter(m=>m.area==='healing').length};
  return {version,serverTime:Date.now(),self:store.self(id),room:{id:r.id,area,total:members.length,counts,name:area==='healing'?'힐링방':r.id==='window'?'창가 탕비실':'우리 탕비실',
    members:members.filter(m=>(m.area??'pantry')===area).map(m=>{
      const u=store.getUser(m.id),s=store.serving(m.id);
      return {id:m.id,area:m.area??'pantry',travel:m.travel??null,enteredAt:m.enteredAt??0,name:u.name,avatar:u.avatar,drink:u.drink,seat:m.seat,slot:m.slot,motion:m.motion,station:m.station,pantry:store.activities.public(m.id),connected:connected(m),contact:m.contact&&m.contact.until>Date.now()?m.contact:null,action:m.action,actionAt:m.actionAt,food:s?{state:s.state,open_progress:s.open_progress,bites:s.bites,portions:s.portions}:null};
    }),fixtures:area==='pantry'?r.fixtures:{fridge:{open:false,owner:null,changedAt:0}},offers:area==='pantry'?store.offers(r.id,id):[],history:r.history.filter(h=>(h.area??'pantry')===area)}};
}
