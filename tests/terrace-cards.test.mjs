import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {thoughtAction,visibleThoughts,visibleMessages,expireThoughts,nextThoughtExpiry} from '../server/thoughts.mjs';
import {normalizeThought,thoughtPhrases,smokingVisual,smokingPhase,SMOKE_PUFF_MS,SMOKE_MAX_PUFFS,smokingAshtray,smokingCenter} from '../shared/smoking.mjs';
import {smokingAction} from '../server/smoking.mjs';
import {getSpace,findPath,clearSegment,sampleMotion,isWalkable} from '../shared/space.mjs';
import {migrateSmokingLayout} from '../server/smoking-layout.mjs';
const member=id=>({id,area:'smoking'}),message=(text,sentAt=100000)=>({type:'thought-say',text,sentAt,requestId:randomUUID()});

test('short messages normalize Korean and whitespace without accepting empty, oversized or control text',()=>{
 assert.equal(normalizeThought('  한글\n안녕\t! '),'한글 안녕 !');
 assert.equal(normalizeThought('🙂'.repeat(80)),'🙂'.repeat(80));
 for(const v of ['🙂'.repeat(81),'가'.repeat(81),'\u200b\u200d','  ','a\u0000b','a\u202eb',{},null])assert.equal(normalizeThought(v),null);
 // Markup remains plain text; React renders it as text, never HTML.
 assert.equal(normalizeThought('<img src=x onerror=alert(1)>'),'<img src=x onerror=alert(1)>');
});
test('free cards replace only their author; replay survives member recreation without reviving old text',()=>{
 const room={},a=member('a'),b=member('b'),first=message('첫 한마디');
 thoughtAction(room,a,first,100000);const initial=visibleMessages(room,b,100000)[0];
 assert.equal(thoughtAction(room,member('a'),first,100001).replay,true);
 assert.throws(()=>thoughtAction(room,a,{...first,text:'바뀐 내용'},100001));
 assert.throws(()=>thoughtAction(room,a,message('연달아',100001),100001));
 thoughtAction(room,b,message('다른 사람'),100000);
 thoughtAction(room,a,message('새 한마디',103000),103000);
 assert.equal(visibleMessages(room,b,103000).length,2);
 const saved=JSON.parse(JSON.stringify(room));
 assert.equal(thoughtAction(saved,member('a'),first,130000).replay,true);
 assert.deepEqual(visibleMessages(saved,b,130000),visibleMessages(room,b,130000));
 assert.equal(visibleMessages(saved,b,130000).some(n=>n.id===initial.id),false);
 assert.equal(JSON.stringify(saved.thoughtReceipts).includes('한마디'),false);
 assert.equal(nextThoughtExpiry(saved),145000);expireThoughts(saved,148000);
 assert.equal(nextThoughtExpiry(saved),0);assert.throws(()=>thoughtAction(saved,a,first,148000));
});
test('legacy and free cards share a cap, privacy boundary and echoes without legacy fake phrases',()=>{
 const room={},a=member('a'),b=member('b'),at=100000;
 thoughtAction(room,a,{type:'thought-leave',phrase:'quiet',sentAt:at,requestId:randomUUID()},at);
 thoughtAction(room,b,message('안녕'),at);
 assert.equal(visibleThoughts(room,a,at).length,1);assert.equal(visibleThoughts(room,a,at)[0].phrase,'quiet');
 assert.deepEqual(visibleMessages(room,a,at).map(m=>m.text),[thoughtPhrases.quiet,'안녕']);
 assert.deepEqual(Object.keys(visibleMessages(room,a,at)[0]).sort(),['createdAt','echoed','hasEcho','id','mine','text','until']);
 for(const area of ['pantry','healing']){assert.deepEqual(visibleMessages(room,{...a,area},at),[]);assert.throws(()=>thoughtAction(room,{...a,area},message('no'),at));}
 assert.throws(()=>thoughtAction(room,{...a,travel:{}},message('no'),at));
 const id=visibleMessages(room,a,at).find(n=>!n.mine).id;thoughtAction(room,a,{type:'thought-echo',noteId:id},at);
 assert.equal(visibleMessages(room,b,at).find(n=>n.mine).hasEcho,true);
 assert.equal(thoughtAction(room,a,{type:'thought-echo',noteId:id},at).replay,true);
 for(let i=0;i<4;i++)thoughtAction(room,member('extra'+i),message('함께'),at);
 assert.throws(()=>thoughtAction(room,member('seventh'),message('가득'),at));
 assert.throws(()=>thoughtAction(room,member('seventh'),{type:'thought-leave',phrase:'tired',sentAt:at},at));
 thoughtAction(room,a,message('직접 적었어요',103000),103000);
 assert.equal(visibleMessages(room,a,103000).length,6);assert.deepEqual(visibleThoughts(room,a,103000),[]);
});
test('every round-table seat has clear paths and ashtrays rest on its shared surface',()=>{
 const map=getSpace('smoking'),points=[map.portal.approach,...map.approaches];
 for(const a of points)for(const b of points){const path=findPath(a,b,'smoking');assert.ok(path);for(let i=1;i<path.length;i++)assert.ok(clearSegment(path[i-1],path[i],'smoking'));}
 for(let i=0;i<4;i++){const t=smokingAshtray(i);assert.ok(Math.hypot(t.x-smokingCenter.x,t.z-smokingCenter.z)<smokingCenter.radius-.10);}
 assert.equal(map.seats.length,6);
});
test('saved row-layout routes migrate once, preserving reservations and pending room travel',()=>{
 const members=[{id:'seat',area:'smoking',seat:2,motion:{old:true},arriveAt:999},
 {id:'walk',area:'smoking',seat:null,motion:{points:[{x:smokingCenter.x,z:smokingCenter.z}]}},
 {id:'exit',area:'smoking',seat:null,travel:{to:'pantry',enterAt:900}},
 {id:'incoming',area:'pantry',seat:0,travel:{to:'smoking',enterAt:1200}}];
 const room={members:new Map(members.map(m=>[m.id,m]))};
 assert.equal(migrateSmokingLayout(room,1000),true);assert.equal(members[0].motion,null);assert.equal(members[0].seat,2);
 assert.ok(isWalkable(sampleMotion(members[1],1000),'smoking'));assert.equal(members[2].travel.to,'pantry');assert.equal(members[2].travel.enterAt,1420);
 assert.deepEqual(members[3],{id:'incoming',area:'pantry',seat:0,travel:{to:'smoking',enterAt:1200}});
 assert.equal(migrateSmokingLayout(room,2000),false);
});
test('one server-clock cycle burns paper, reaches the ashtray, sheds ash and exhausts after seven puffs',()=>{
 const m={...member('a'),seat:0};let now=10000;
 const act=type=>smokingAction(m,{type,requestId:randomUUID(),revision:m.smoking?.revision??0,...(m.smoking?{itemId:m.smoking.id}:{})},now);
 act('smoke-take');now+=1200;let previous=.077;
 for(let p=1;p<=SMOKE_MAX_PUFFS;p++){
  act('smoke-puff');const start=smokingVisual(m.smoking,now),inhaled=smokingVisual(m.smoking,now+1000),ash=smokingVisual(m.smoking,now+3700),dropped=smokingVisual(m.smoking,now+4000);
  assert.ok(Math.abs(start.paperLength-previous)<1e-8);assert.ok(inhaled.lift>.9);assert.ok(ash.paperLength<previous);assert.equal(ash.ashReach,1);assert.ok(ash.ashLength>dropped.ashLength);assert.ok(dropped.ashDrop>0);assert.equal(dropped.ashReach,1);
  previous=ash.paperLength;now+=SMOKE_PUFF_MS;
 }
 assert.equal(smokingPhase(m.smoking,now),'idle');assert.equal(smokingVisual(m.smoking,now).finished,true);assert.ok(previous>0);
 assert.throws(()=>act('smoke-puff'));assert.throws(()=>act('smoke-out'));const old=m.smoking.id;act('smoke-take');assert.notEqual(m.smoking.id,old);
});
