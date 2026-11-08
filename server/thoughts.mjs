import {thoughtPhrases,thoughtLifetime} from '../shared/smoking.mjs';
import {GameError} from '../shared/errors.mjs';

// Only this room's short-lived state knows who posted or responded. Nothing
// here enters the activity feed, personal checkpoint, or discovery database.
export function expireThoughts(room,now=Date.now()){
 const existing=room.thoughts??[];
 if(!existing.some(t=>t.until<=now))return false;
 room.thoughts=existing.filter(t=>t.until>now);
 return true;
}
export function nextThoughtExpiry(room){
 return room.thoughts?.length?Math.min(...room.thoughts.map(t=>t.until)):0;
}
export function visibleThoughts(room,viewer,now=Date.now()){
 if(viewer?.area!=='smoking')return [];
 return (room.thoughts??[]).filter(t=>t.until>now).map(t=>({
  id:t.id,phrase:t.phrase,until:t.until,mine:t.author===viewer.id,
  echoed:t.echoes.includes(viewer.id),hasEcho:t.echoes.length>0
 }));
}
export function thoughtAction(room,m,input,now=Date.now()){
 if(m.area!=='smoking'||m.travel)throw new GameError('흡연실에서 잠시 머물 때 할 수 있어요.');
 expireThoughts(room,now);
 const notes=room.thoughts??=[];
 if(input.type==='thought-echo'){
  const note=notes.find(t=>t.id===input.noteId);
  if(!note)throw new GameError('이미 흩어진 한마디예요.');
  if(note.author===m.id)throw new GameError('동료의 한마디에 공감할 수 있어요.');
  if(note.echoes.includes(m.id))return {replay:true};
  note.echoes.push(m.id);return {ok:true};
 }
 if(!Object.hasOwn(thoughtPhrases,input.phrase)||typeof input.phrase!=='string')throw new GameError('한마디를 다시 골라 주세요.',400);
 const old=notes.find(t=>t.author===m.id);
 if(old){
  if(old.requestId===input.requestId&&old.phrase===input.phrase)return {replay:true};
  throw new GameError('앞선 한마디가 흩어지면 다시 놓을 수 있어요.');
 }
 // A late retry cannot re-create an expired thought. Clients use server time.
 if(!Number.isSafeInteger(input.sentAt)||input.sentAt>now+5000||input.sentAt<now-20000)throw new GameError('잠시 지났어요. 한마디를 다시 골라 주세요.');
 if(notes.length>=6)throw new GameError('잠시 놓인 한마디가 많아요. 조금 뒤에 다시 와 주세요.');
 notes.push({id:crypto.randomUUID(),author:m.id,requestId:input.requestId,phrase:input.phrase,until:now+thoughtLifetime,echoes:[]});
 return {ok:true};
}
