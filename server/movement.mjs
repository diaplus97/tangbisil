import {getSpace,isWalkable,planMotion,sampleMotion} from '../shared/space.mjs';
import {reservedSeats} from './travel.mjs';
import {GameError} from '../shared/errors.mjs';
import {steeringTarget} from '../shared/steering.mjs';

export function moveVisitor(room,member,input,now=Date.now()){
  if(typeof input.requestId!=='string'||!/^[\w-]{8,80}$/.test(input.requestId))throw new GameError('요청 번호를 확인해 주세요.',400);
  const signature=JSON.stringify([input.type,input.x,input.z,input.seat,input.station,input.to,...(input.direction!==undefined?[input.direction]:[])]),old=member.moves.get(input.requestId);
  if(old){if(old!==signature)throw new GameError('같은 요청 번호의 내용이 달라요.',400);return{replay:true};}
  const area=member.area??'pantry',{seats,approaches,stations,portal}=getSpace(area);
  let seat=null,destination,station=null,travel=null;
  if(input.type==='travel'){
    if(input.to!==portal.to)throw new GameError('출입구를 다시 확인해 주세요.',400);
    const occupied=reservedSeats(room,input.to,member.id),target=getSpace(input.to).seats.findIndex((_,i)=>!occupied.has(i));
    if(target<0)throw new GameError('빈 자리가 생기면 들어갈 수 있어요.');
    destination={...portal.approach,z:portal.approach.z+((member.slot??0)%3-1)*.12};travel={to:input.to,seat:target,id:input.requestId};
  }else
 if(input.type==='approach'){
    if(!Object.hasOwn(stations,input.station??''))throw new GameError('갈 곳을 다시 골라 주세요.',400);
    station=input.station;
    if([...room.members.values()].some(m=>m.id!==member.id&&(m.area??'pantry')===area&&m.station===station))throw new GameError('다른 동료가 이용하고 있어요. 잠깐 기다리거나 다른 곳을 골라 주세요.');
    if(member.station===station)return{replay:true};
    destination=stations[station].approach;
  }else if(input.type==='sit'){
    if(!Number.isInteger(input.seat)||input.seat<0||input.seat>=seats.length)throw new GameError('앉을 자리를 골라 주세요.',400);
    seat=input.seat;
    if(reservedSeats(room,area,member.id).has(seat))throw new GameError('다른 동료가 먼저 고른 자리예요. 빈 의자를 골라 주세요.');
    if(member.seat===seat)return{replay:true};
    destination=approaches[seat];
  }else if(input.type==='stand'){
    const current=sampleMotion(member,now);destination=current.inSeat!=null?approaches[current.inSeat]:{x:current.x,z:current.z};
  }else if(input.direction!==undefined){
    destination=steeringTarget(member,input.direction,now);
    if(!destination)throw new GameError('이동 방향을 다시 확인해 주세요.',400);
  }else{
    destination={x:input.x,z:input.z};
    if(!isWalkable(destination,area))throw new GameError('가구가 없는 바닥을 골라 주세요.',400);
  }
  const motion=planMotion(member,destination,seat,now,input.requestId);
  if(!motion)throw new GameError('그쪽으로는 지나가기 어려워요. 다른 바닥을 골라 주세요.');
  if(input.direction!==undefined)motion.keyboard=true;
  member.travel=travel?{...travel,enterAt:motion.endsAt+420}:null;
  member.seat=seat;member.station=station;member.motion=motion;member.moves.set(input.requestId,signature);
  if(member.moves.size>64)member.moves.delete(member.moves.keys().next().value);
  return{replay:false};
}
