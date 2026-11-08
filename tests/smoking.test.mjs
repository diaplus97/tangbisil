import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {getSpace,exitsFrom,findPath} from '../shared/space.mjs';
import {moveVisitor} from '../server/movement.mjs';
import {completeTravel} from '../server/travel.mjs';
import {thoughtAction,visibleThoughts,expireThoughts,nextThoughtExpiry} from '../server/thoughts.mjs';
import {thoughtLifetime,ribbonState} from '../shared/smoking.mjs';

test('the terrace ribbon reflects live anonymous notes once and resets at the deadline',()=>{
 const notes=[{until:75,hasEcho:false},{until:45,hasEcho:true}];
 assert.equal(ribbonState(undefined,0),0);assert.equal(ribbonState(notes,44),2);
 assert.equal(ribbonState(notes,45),1);assert.equal(ribbonState(notes,75),0);
});

test('six terrace seats connect to both sides of the correct door; returning restores the free seat',()=>{
 const m={id:'a',seat:5,area:'pantry',moves:new Map()},room={members:new Map([['a',m]])};
 const enter=exitsFrom('pantry').find(p=>p.to==='smoking'),exit=exitsFrom('smoking')[0];
 for(const approach of getSpace('pantry').approaches)assert.ok(findPath(approach,enter.approach,'pantry'));
 for(const approach of getSpace('smoking').approaches)assert.ok(findPath(exit.approach,approach,'smoking'));
 const go=(to,now)=>moveVisitor(room,m,{type:'travel',to,requestId:randomUUID()},now);
 go('smoking',1000);completeTravel(m,m.travel.enterAt);
 assert.equal(m.area,'smoking');assert.deepEqual(m.motion.points[0],exit.approach);
 assert.throws(()=>go('healing',20000));go('pantry',20000);completeTravel(m,m.travel.enterAt);
 assert.equal(m.seat,5);assert.deepEqual(m.motion.points[0],enter.approach);
});
test('thoughts and echoes are room-scoped, expire together and never expose visitor ids or totals',()=>{
 const room={},a={id:'author',area:'smoking'},b={id:'listener',area:'smoking'},at=123456;
 const post={type:'thought-leave',phrase:'meetings',sentAt:at,requestId:randomUUID()};
 assert.throws(()=>thoughtAction(room,{...a,area:'pantry'},post,at));
 assert.throws(()=>thoughtAction(room,{...a,travel:{}},post,at));assert.throws(()=>thoughtAction(room,a,{...post,phrase:'free text'},at));
 thoughtAction(room,a,post,at);assert.equal(thoughtAction(room,a,post,at+1).replay,true);
 const [note]=visibleThoughts(room,b,at);assert.deepEqual(Object.keys(note).sort(),['echoed','hasEcho','id','mine','phrase','until']);
 assert.deepEqual(visibleThoughts(room,{...b,area:'healing'},at),[]);assert.deepEqual(visibleThoughts({},b,at),[]);
 const echo={type:'thought-echo',noteId:note.id,requestId:randomUUID()};
 assert.throws(()=>thoughtAction(room,a,echo,at));thoughtAction(room,b,echo,at);assert.equal(thoughtAction(room,b,echo,at).replay,true);
 assert.equal(visibleThoughts(room,a,at)[0].hasEcho,true);assert.equal(visibleThoughts(room,b,at)[0].echoed,true);
 assert.equal(nextThoughtExpiry(room),at+thoughtLifetime);assert.equal(expireThoughts(room,at+thoughtLifetime),true);
 assert.deepEqual(room.thoughts,[]);assert.throws(()=>thoughtAction(room,a,post,at+thoughtLifetime));
 assert.throws(()=>thoughtAction(room,b,echo,at+thoughtLifetime));assert.equal(nextThoughtExpiry(room),0);
});
