import {sampleMotion} from '../shared/space.mjs';

// Ephemeral hand presence, never the private path or stone positions.
// Per-gesture sequence numbers reject late packets after release.
export function sandContact(member,sand,input,GameError,now=Date.now()){
 const {gestureId,sequence,active,kind}=input;
 if(typeof gestureId!=='string'||!/^[\w-]{8,80}$/.test(gestureId)||!Number.isSafeInteger(sequence)||sequence<0||typeof active!=='boolean'||!['rake','stone'].includes(kind))throw new GameError('손동작을 확인해 주세요.',400);
 member.contacts??=new Map();const previous=member.contacts.get(gestureId);
 if(previous!=null&&previous>=sequence)return false;
 if(active&&(member.area!=='healing'||member.travel||sampleMotion(member,now).inSeat==null||!sand?.held||sand.id!==input.itemId))throw new GameError('내 모래 트레이를 자리에 놓고 만져 주세요.');
 member.contacts.set(gestureId,sequence);if(member.contacts.size>24)member.contacts.delete(member.contacts.keys().next().value);
 if(active)member.contact={gestureId,kind,until:now+1100};
 else if(member.contact?.gestureId===gestureId)member.contact=null;
 return true;
}
