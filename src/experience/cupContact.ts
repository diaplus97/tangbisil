import type {Member} from './types';
export function keepsCupContact(source:{action:string;at:number},member:Member){
 if(!member.connected)return false;
 if(member.action===source.action&&member.actionAt===source.at)return true;
 if(member.actionAt<source.at)return false;
 if(source.action==='coffee-place')return member.action==='coffee-brew'&&member.station==='coffee'&&member.pantry.coffee.stage==='brewing';
 // Both runtimes publish movement as "rest"; its timed route distinguishes
 // a normal departure from stand/cancel (zero walking time) and room travel.
 if(source.action==='coffee-take')return member.action==='rest'&&!member.travel&&Boolean(member.motion&&member.motion.startedAt>=source.at&&member.motion.walkMs>0)&&member.pantry.coffee.stage==='carried';
 return false;
}
