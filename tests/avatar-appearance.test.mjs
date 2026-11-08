import test from 'node:test';
import assert from 'node:assert/strict';
import {appearance,avatarChoice} from '../shared/appearance.mjs';
import {moveVisitor} from '../server/movement.mjs';
import {randomUUID} from 'node:crypto';
import {placeTableActions} from '../src/experience/tableActionPlacement.ts';

test('outfits retain legacy IDs and use only the immutable visitor id for tailoring',()=>{
 for(const slot of [0,1,2,3]){
  assert.equal(avatarChoice(slot),slot);
  const ids=['11770dd8-6b15-48ee-b614-a1de1744b4da','05996463-dbd8-407a-a084-499f2731ed39'];
  const [first,other]=ids.map(id=>appearance(slot,id));
  assert.equal(first.choice,other.choice);
  assert.notEqual(first.coat,other.coat);
  assert.deepEqual(first,appearance(slot,ids[0]));
 }
 for(const invalid of [null,4,'1',-1,NaN])assert.equal(avatarChoice(invalid),0);
});

test('standing parks the tray until another visitor claims the seat; walking again cannot reclaim it',()=>{
 const a={id:'a',seat:0,area:'pantry',moves:new Map()},b={id:'b',seat:1,area:'pantry',moves:new Map()};
 const room={members:new Map([[a.id,a],[b.id,b]])};
 const step=(m,input,now)=>moveVisitor(room,m,{...input,requestId:randomUUID()},now);
 step(a,{type:'stand'},100);assert.equal(a.parkedSeat,0);
 step(a,{type:'move',x:-4.8,z:1},1500);assert.equal(a.parkedSeat,0);
 step(b,{type:'sit',seat:0},1600);assert.equal(a.parkedSeat,null);assert.equal(b.parkedSeat,1);
 step(b,{type:'stand'},b.motion.endsAt+10);assert.equal(b.parkedSeat,0);
 step(b,{type:'sit',seat:0},b.motion.endsAt+50);assert.equal(b.parkedSeat,0);
});

test('the two stable table actions fit a portrait view clear of a seated visitor',()=>{
 const headAndHands={x:131,y:328,w:122,h:110};
 const spot=placeTableActions(218,322,163,44,390,844,[headAndHands]);
 assert.ok(spot&&spot.x>=10&&spot.x+spot.w<=380);
 assert.ok(spot.y+spot.h<headAndHands.y||spot.y>headAndHands.y+headAndHands.h||spot.x+spot.w<headAndHands.x||spot.x>headAndHands.x+headAndHands.w);
 assert.deepEqual(spot,placeTableActions(218,322,163,44,390,844,[headAndHands]));
});
