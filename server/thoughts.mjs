import {createHash} from 'node:crypto';
import {thoughtPhrases,thoughtLifetime,thoughtInterval,normalizeThought} from '../shared/smoking.mjs';
import {GameError} from '../shared/errors.mjs';

// Only this room's short-lived state knows who posted or responded. Nothing
// here enters the activity feed, personal checkpoint, or discovery database.
export function expireThoughts(room,now=Date.now()){
 let changed=false;
 for(const key of ['thoughts','thoughtCards'])if(room[key]?.some(t=>t.until<=now)){room[key]=room[key].filter(t=>t.until>now);changed=true;}
 if(room.thoughtReceipts)room.thoughtReceipts=room.thoughtReceipts.filter(r=>r.until>now);
 return changed;
}
export function nextThoughtExpiry(room){
 const notes=[...(room.thoughts??[]),...(room.thoughtCards??[])];return notes.length?Math.min(...notes.map(t=>t.until)):0;
}
export function visibleThoughts(room,viewer,now=Date.now()){
 if(viewer?.area!=='smoking')return [];
 // Older clients render only thoughtPhrases[phrase]. Never send them free text.
 return (room.thoughts??[]).filter(t=>t.until>now&&Object.hasOwn(thoughtPhrases,t.phrase)).map(t=>({
  id:t.id,phrase:t.phrase,until:t.until,mine:t.author===viewer.id,
  echoed:t.echoes.includes(viewer.id),hasEcho:t.echoes.length>0
 }));
}
export function visibleMessages(room,viewer,now=Date.now()){
 if(viewer?.area!=='smoking')return [];
 return [...(room.thoughts??[]),...(room.thoughtCards??[])].filter(t=>t.until>now).sort((a,b)=>a.until-b.until).map(t=>({
  id:t.id,text:t.text??thoughtPhrases[t.phrase],createdAt:t.createdAt??t.until-thoughtLifetime,until:t.until,mine:t.author===viewer.id,
  echoed:t.echoes.includes(viewer.id),hasEcho:t.echoes.length>0
 }));
}
export function thoughtAction(room,m,input,now=Date.now()){
 if(m.area!=='smoking'||m.travel)throw new GameError('흡연실에서 잠시 머물 때 할 수 있어요.');
 expireThoughts(room,now);
 const notes=room.thoughts??=[];
 if(input.type==='thought-say'){
  const text=normalizeThought(input.text);
  if(!text)throw new GameError('한마디는 1~80자로 적어 주세요.',400);
  if(typeof input.requestId!=='string'||!/^[\w-]{8,80}$/.test(input.requestId))throw new GameError('요청 번호를 확인해 주세요.',400);
  const signature=createHash('sha256').update(JSON.stringify([input.type,text,input.sentAt])).digest('hex');
  const receipts=(room.thoughtReceipts??[]).filter(r=>r.until>now),old=receipts.find(r=>r.author===m.id&&r.requestId===input.requestId);
  if(old){if(old.signature!==signature)throw new GameError('같은 요청 번호의 내용이 달라요.');return {ok:true,replay:true};}
  if(!Number.isSafeInteger(input.sentAt)||input.sentAt>now+5000||input.sentAt<now-20000)throw new GameError('잠시 지났어요. 한마디를 다시 보내 주세요.');
  const last=receipts.filter(r=>r.author===m.id).at(-1);
  if(last&&now-last.at<thoughtInterval)throw new GameError('한마디 뒤에 잠깐 여백을 두어요.');
  const cards=room.thoughtCards??[];
  if([...notes,...cards].filter(t=>t.author!==m.id).length>=6)throw new GameError('잠시 놓인 한마디가 많아요. 조금 뒤에 다시 와 주세요.');
  room.thoughts=notes.filter(t=>t.author!==m.id);
  room.thoughtCards=[...cards.filter(t=>t.author!==m.id),{id:crypto.randomUUID(),author:m.id,requestId:input.requestId,text,createdAt:now,until:now+thoughtLifetime,echoes:[]}];
  // Receipts contain a digest, never an archived copy of the expired message.
  room.thoughtReceipts=[...receipts,{author:m.id,requestId:input.requestId,signature,at:now,until:now+thoughtLifetime}].slice(-128);
  return {ok:true};
 }
 if(input.type==='thought-echo'){
  const note=[...notes,...(room.thoughtCards??[])].find(t=>t.id===input.noteId);
  if(!note)throw new GameError('이미 흩어진 한마디예요.');
  if(note.author===m.id)throw new GameError('동료의 한마디에 공감할 수 있어요.');
  if(note.echoes.includes(m.id))return {replay:true};
  note.echoes.push(m.id);return {ok:true};
 }
 if(input.type!=='thought-leave')throw new GameError('한마디를 다시 확인해 주세요.',400);
 if(!Object.hasOwn(thoughtPhrases,input.phrase)||typeof input.phrase!=='string')throw new GameError('한마디를 다시 골라 주세요.',400);
 if(room.thoughtCards?.some(t=>t.author===m.id))throw new GameError('앞선 한마디가 흩어지면 다시 놓을 수 있어요.');
 const old=notes.find(t=>t.author===m.id);
 if(old){
  if(old.requestId===input.requestId&&old.phrase===input.phrase)return {replay:true};
  throw new GameError('앞선 한마디가 흩어지면 다시 놓을 수 있어요.');
 }
 // A late retry cannot re-create an expired thought. Clients use server time.
 if(!Number.isSafeInteger(input.sentAt)||input.sentAt>now+5000||input.sentAt<now-20000)throw new GameError('잠시 지났어요. 한마디를 다시 골라 주세요.');
 if(notes.length+(room.thoughtCards?.length??0)>=6)throw new GameError('잠시 놓인 한마디가 많아요. 조금 뒤에 다시 와 주세요.');
 notes.push({id:crypto.randomUUID(),author:m.id,requestId:input.requestId,phrase:input.phrase,until:now+thoughtLifetime,echoes:[]});
 return {ok:true};
}
