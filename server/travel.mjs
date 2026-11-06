import {getSpace,planMotion} from '../shared/space.mjs';
export function reservedSeats(room,area,except){return new Set([...room.members.values()].filter(m=>m.id!==except).flatMap(m=>[(m.area??'pantry')===area?m.seat:null,m.travel?.to===area?m.travel.seat:null]).filter(n=>n!=null));}
export function completeTravel(member,now=Date.now()){
 const trip=member.travel;if(!trip||now<trip.enterAt)return false;
 const space=getSpace(trip.to),point=space.portal.approach,yaw=space.portal.yaw+Math.PI;
 const entry={area:trip.to,seat:null,station:null,motion:{id:trip.id+'-entry',start:{...point,yaw,sit:0},points:[point],fromSeat:null,toSeat:null,startedAt:now,departMs:0,walkMs:0,arriveMs:0,endsAt:now}};
 const motion=planMotion(entry,space.approaches[trip.seat],trip.seat,now,trip.id+'-inside');
 if(!motion)throw Error('Invalid entrance route');
 Object.assign(member,{area:trip.to,seat:trip.seat,station:null,motion,travel:null,enteredAt:now,action:'enter',actionAt:now});return true;
}
