import {getSpace,isWalkable} from '../shared/space.mjs';
import {smokingLayoutVersion} from '../shared/smoking.mjs';

// A saved route from the row layout must never run through the new round table.
// Keep seat reservations and pending room travel; resolve only the old local pose.
export function migrateSmokingLayout(room,now=Date.now()){
 if(room.smokingLayout===smokingLayoutVersion)return false;
 const map=getSpace('smoking');
 for(const m of room.members.values()){
  if(m.area!=='smoking')continue;
  if(m.seat!=null&&!m.travel){m.motion=null;m.arriveAt=0;continue;}
  let point=m.travel?map.portal.approach:m.motion?.points?.at(-1);
  if(!point||!isWalkable(point,'smoking'))point=map.portal.approach;
  m.motion={id:'terrace-layout-'+smokingLayoutVersion,start:{...point,yaw:Math.PI,sit:0},points:[{...point}],fromSeat:null,toSeat:null,startedAt:now,departMs:0,walkMs:0,arriveMs:0,endsAt:now};
  m.station=null;
  if(m.travel){m.travel.enterAt=Math.max(now+420,m.travel.enterAt);m.arriveAt=m.travel.enterAt+15;}else m.arriveAt=0;
 }
 room.smokingLayout=smokingLayoutVersion;return true;
}
