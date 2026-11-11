import {sampleMotion} from '../shared/space.mjs';
import {smokingPhase} from '../shared/smoking.mjs';
import {GameError} from '../shared/errors.mjs';

export function stopSmoking(member,now=Date.now()){
  if(member.smoking&&!member.smoking.endedAt){
    member.smoking={...member.smoking,endedAt:now,ending:false,puffAt:0,revision:member.smoking.revision+1};
  }
}

export function smokingAction(member,input,now=Date.now()){
  if(!['smoke-take','smoke-puff','smoke-out'].includes(input.type))throw new GameError('담배 동작을 다시 확인해 주세요.',400);
  if(member.area!=='smoking')throw new GameError('흡연실 자리에서 이용해 주세요.');
  const signature=JSON.stringify([input.type,input.itemId,input.revision]);
  const receipts=member.smokeReceipts??[];
  const old=receipts.find(r=>r.requestId===input.requestId);
  if(old){
    if(old.signature!==signature)throw new GameError('같은 요청 번호의 내용이 달라요.',409);
    return {ok:true,replay:true};
  }
  const pose=sampleMotion(member,now),s=member.smoking??null;
  if(member.travel||pose.moving||pose.inSeat==null||pose.inSeat!==member.seat)throw new GameError('자리에 앉으면 이용할 수 있어요.');
  if(!Number.isSafeInteger(input.revision)||input.revision!==(s?.revision??0)||(input.itemId??null)!==(s?.id??null))throw new GameError('담배 상태가 바뀌었어요. 지금 동작에서 이어 주세요.');
  const phase=smokingPhase(s,now);
  if(input.type==='smoke-take'){
    if(phase!=='idle')throw new GameError('손에 든 담배를 먼저 꺼 주세요.');
    member.smoking={id:crypto.randomUUID(),seat:member.seat,litAt:now,puffAt:0,puffs:0,endedAt:0,ending:false,revision:(s?.revision??0)+1};
  }else{
    if(!s||s.endedAt)throw new GameError('담배를 먼저 집어 주세요.');
    if(input.type==='smoke-puff'){
      if(phase!=='ready')throw new GameError('한 모금 뒤에 천천히 이어 주세요.');
      member.smoking={...s,puffAt:now,puffs:s.puffs+1,revision:s.revision+1};
    }else member.smoking={...s,puffAt:0,endedAt:now,ending:true,revision:s.revision+1};
  }
  member.smokeReceipts=[...receipts,{requestId:input.requestId,signature}].slice(-32);
  member.action=input.type;member.actionAt=now;
  return {ok:true};
}
