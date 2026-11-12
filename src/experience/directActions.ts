import {smokingPhase} from '../../shared/smoking.mjs';
import {tableDrink} from '../../shared/table-drink.mjs';
import {CUP_SIPS} from '../../shared/coffee.mjs';
import {heldName,sampleTea} from '../../shared/rest.mjs';
import {flowers} from '../../shared/vase.mjs';
import type {Snapshot} from './types';

export type DirectAction={label:string;type:string;extra?:Record<string,unknown>};
// A newly labelled button can be used immediately even on the same object.
export function directActionKey(state:Snapshot|null,target:string):string{
  if(target==='cup')return target;
  return state?directAction(state,target)?.type??target:target;
}

// World hits and their keyboard-accessible buttons use the same state transition.
// Scene taps and keyboard focus share the same existing transition.
export function directAction(state:Snapshot,target:string|null|undefined):DirectAction|null{
  if(typeof target!=='string'||!target)return null;
  if(target==='cigarette'||target==='ashtray'){
    const m=state.room.members.find(m=>m.id===state.self.id),s=m?.smoking;
    if(m?.area!=='smoking'||m.seat==null||m.travel)return null;
    const now=Date.now()+(state.receivedAt!==undefined?state.serverTime-state.receivedAt:0),phase=smokingPhase(s,now);
    const extra={revision:s?.revision??0,...(s?{itemId:s.id}:{})};
    if(target==='ashtray')return s&&!s.endedAt&&phase!=='idle'?{label:'담배 끄기',type:'smoke-out',extra}:null;
    if(phase==='idle')return{label:'담배 집기',type:'smoke-take',extra};
    return phase==='ready'?{label:'한 모금 피우기',type:'smoke-puff',extra}:null;
  }
  const p=state.self.pantry,r=p.rest,c=p.candy,b=p.bottle,t=sampleTea(r.tea,Date.now()+(state.receivedAt!==undefined?state.serverTime-state.receivedAt:0));
  const me=state.room.members.find(m=>m.id===state.self.id),seated=me?.seat!=null&&!me.travel;
  const pick=(label:string,type:string,except:string,extra:Record<string,unknown>={}):DirectAction=>({label,type,extra:{...extra,stow:Boolean(heldName(p,except))}});
  if(target==='stone-held')return r.stone&&!r.stone.held?pick('말랑돌 다시 집기','stone-hold','stone',{itemId:r.stone.id,held:true}):null;
  if(target==='sand-held')return r.sand&&!r.sand.held?pick('모래 트레이 다시 집기','sand-hold','sand',{itemId:r.sand.id,held:true}):null;
  if(target==='vase-held')return r.vase&&!r.vase.held?pick('꽃병 다시 만지기','vase-hold','vase',{itemId:r.vase.id,held:true}):null;
  if(target==='held'){const kind=c?.held&&c.state!=='eaten'?'candy':b?.held&&b.sips<3?'bottle':r.sprayer?'plant':t?.held?'tea-held':r.stone?.held?'stone':null;if(!kind)return null;target=kind;}
  if(target==='snack')return{label:state.self.serving?.state==='open'?'한입 먹기':state.self.serving?.state==='sealed'?'포장 열기':'간식 꺼내기',type:'snack'};
  if(target==='shared')return{label:'나눈 한 조각 집기',type:'shared'};
  if(target==='cup'){const drink=tableDrink(p);if(drink==='tea'&&t)return t.volume>0?{label:'보리차 한 모금',type:'tea-sip',extra:{itemId:t.id,table:true,volume:t.volume}}:{label:'빈 찻잔 · 다시 준비하기',type:'refill-tea'};if(drink==='bottle'&&b)return b.sips<3?{label:'음료 한 모금',type:'bottle-sip',extra:{itemId:b.id,table:true,sips:b.sips}}:{label:'빈 병 · 새 음료',type:'refill-bottle'};return p.coffee.stage==='carried'?{label:(p.coffee.sips??0)>=CUP_SIPS?'빈 잔 · 커피 준비하기':'한 모금',type:(p.coffee.sips??0)>=CUP_SIPS?'refill-cup':'cup-sip',extra:{sips:p.coffee.sips??0}}:null;}
  if(target==='candy'){
    if(!c||c.state==='eaten')return pick('사탕 하나 집기','candy-take','candy');
    if(!c.held)return pick('내 사탕 집기','candy-hold','candy',{itemId:c.id,held:true});
    return{label:c.state==='wrapped'?'포장 톡 열기':'사탕 먹기',type:c.state==='wrapped'?'candy-unwrap':'candy-eat',extra:{itemId:c.id,progress:1}};
  }
  if(target==='coffee'&&p.coffee.stage==='brewing')return{label:'추출 멈추고 컵 가져오기',type:'stand'};
  if(target==='coffee')return p.coffee.stage==='carried'&&state.room.members.find(m=>m.id===state.self.id)?.action==='coffee-take'?null:pick(p.coffee.stage==='carried'?'컵 놓기':p.coffee.stage==='placed'?'커피 내리기':'컵 가져오기',p.coffee.stage==='carried'?'coffee-place':p.coffee.stage==='placed'?'coffee-brew':'coffee-take','coffee');
  if(target==='fridge'&&state.room.fixtures.fridge.open&&(!b||b.sips>=3))return pick('음료 한 병 꺼내기','bottle-take','bottle');
  if(target==='fridge'||target==='fridge-door')return{label:state.room.fixtures.fridge.open?'문 닫기':'문 열기',type:state.room.fixtures.fridge.open?'fridge-close':'fridge-open'};
  if(target==='fridge-bottle')return state.room.fixtures.fridge.open?pick('음료 한 병 꺼내기','bottle-take','bottle'):null;
  if(target==='bottle')return b&&b.sips<3?(b.held?{label:'음료 한 모금',type:'bottle-sip',extra:{itemId:b.id}}:pick('내 음료 집기','bottle-hold','bottle',{itemId:b.id,held:true})):null;
  if(target==='plant')return r.sprayer?{label:'물 한 번 뿌리기',type:'plant-spray'}:pick('분무기 집기','plant-take','sprayer');
  if(target==='plant-stand')return r.sprayer?{label:'분무기 내려놓기',type:'plant-put'}:directAction(state,'plant');
  if(target==='leaf')return r.sprayer?{label:'물 한 번 뿌리기',type:'plant-spray'}:!heldName(p)?{label:'잎 살짝 쓸기',type:'plant-brush'}:null;
  if(target==='stone-basket')return r.stone?.held?{label:'바구니에 반납하기',type:'stone-return',extra:{itemId:r.stone.id}}:pick('말랑돌 집기','stone-take','stone');
  if(target==='stone')return r.stone?.held?(seated?{label:'말랑돌 누르기',type:'stone-press',extra:{itemId:r.stone.id,point:[0,0]}}:null):pick('말랑돌 집기','stone-take','stone');
  if(target==='tea-held'&&t&&!t.held)return pick('찻잔 집기','tea-hold','tea',{itemId:t.id,held:true});
  if(target==='tea-held')return seated&&t&&t.volume>0?{label:'차 한 모금',type:'tea-sip',extra:{itemId:t.id}}:null;
  if(target==='tea-cup')return t?.location==='station'?pick('찻잔 가져오기','tea-take','tea',{itemId:t.id}):pick('찻잔 놓기','tea-place','tea');
  if(target==='tea-kettle')return t?.location==='station'&&t.bagUsed?(t.pourAt?{label:'물 붓기 멈추기',type:'tea-stop',extra:{itemId:t.id}}:t.volume<.99?{label:t.volume>0?'물 조금 더 붓기':'물 붓기',type:'tea-pour',extra:{itemId:t.id}}:null):null;
  if(target==='tea-tin')return t?.location==='station'&&!t.bagUsed?{label:'티백 담기',type:'tea-bag',extra:{itemId:t.id}}:null;
  if(target==='tea-bag')return t?.location==='station'&&t.bagIn?{label:'티백 받침에 놓기',type:'tea-remove',extra:{itemId:t.id}}:null;
  if(target==='tea'){
    if(t?.held)return pick('찻잔 다시 놓기','tea-place','tea');
    if(!t||t.location!=='station')return pick('찻잔 놓기','tea-place','tea');
    const extra={itemId:t.id};
    if(!t.bagUsed)return{label:'티백 담기',type:'tea-bag',extra};
    if(t.pourAt)return{label:'물 붓기 멈추기',type:'tea-stop',extra};
    if(t.volume<=0)return{label:'물 붓기',type:'tea-pour',extra};
    if(t.bagIn)return{label:'티백 꺼내기',type:'tea-remove',extra};
    return pick('찻잔 가져오기','tea-take','tea',extra);
  }
  if(target==='sand')return r.sand?.held?null:pick('모래 트레이 집기','sand-take','sand');
  if(target==='flower')return r.vase?.held?null:pick('하얀 꽃 고르기','vase-take','vase',{flower:'cosmos'});
  if(target.startsWith('flower-')){const flower=flowers.find(f=>f.id===target.slice(7));return flower?pick(flower.name+' 고르기','vase-take','vase',{flower:flower.id}):null;}
  return null;
}
