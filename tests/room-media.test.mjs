import test from 'node:test';
import assert from 'node:assert/strict';
import {recommendedLandscape,startRoomMedia,mediaAction,tvQueue,tvJoinSeconds} from '../shared/room-media.mjs';
import {GameError} from '../shared/errors.mjs';
const room=()=>({id:'window',members:new Map()});
const seated={area:'healing',seat:0,travel:null,motion:null};
test('Seoul recommendation boundaries and day choices use an explicit timezone',()=>{
  assert.equal(recommendedLandscape('window',Date.parse('2026-11-06T08:59:59Z'))==='fire',false);
  assert.equal(recommendedLandscape('window',Date.parse('2026-11-06T09:00:00Z')),'fire');
  assert.equal(recommendedLandscape('window',Date.parse('2026-11-05T20:59:59Z')),'fire');
  assert.notEqual(recommendedLandscape('window',Date.parse('2026-11-05T21:00:00Z')),'fire');
  assert.notEqual(recommendedLandscape('window',Date.parse('2026-11-06T00:00:00Z')),recommendedLandscape('window',Date.parse('2026-11-07T00:00:00Z')));
});
test('An occupied session never changes at sunset and short reloads preserve it',()=>{
  const r=room(),morning=Date.parse('2026-11-06T00:00:00Z'),evening=morning+12*3600000;
  const first=structuredClone(startRoomMedia(r,morning));r.members.set('a',{});startRoomMedia(r,evening);assert.deepEqual(r.media,first);
  r.members.clear();r.media.emptyAt=evening;startRoomMedia(r,evening+1000);assert.equal(r.media.sessionId,first.sessionId);
  r.media.emptyAt=evening;startRoomMedia(r,evening+61000);assert.equal(r.media.landscape,'fire');assert.notEqual(r.media.sessionId,first.sessionId);
});
test('TV next is a session-fenced compare-and-swap; duplicates cannot skip two clips',()=>{
  const r=room();startRoomMedia(r,1000);mediaAction(r,seated,{type:'tv-join'},GameError,1000);
  const input={type:'tv-next',sessionId:r.media.sessionId,expectedVersion:1};
  assert.throws(()=>mediaAction(r,seated,input,GameError,2000),/잠깐/);
  assert.equal(mediaAction(r,seated,input,GameError,10000).ok,true);
  assert.equal(mediaAction(r,seated,input,GameError,10000).replay,true);
  assert.equal(r.media.tv.videoId,tvQueue[1].id);assert.equal(r.media.tv.version,2);
  assert.equal(mediaAction(r,seated,{...input,sessionId:'old',expectedVersion:2},GameError,20000).replay,true);
});
test('TV requires a resting seat in the existing healing area and does not reset on join',()=>{
  const r=room();startRoomMedia(r,1000);
  for(const m of [{...seated,area:'pantry'},{...seated,seat:null},{...seated,travel:{}},{...seated,motion:{endsAt:3000}}])assert.throws(()=>mediaAction(r,m,{type:'tv-join'},GameError,2000));
  mediaAction(r,seated,{type:'tv-join'},GameError,2000);const before=structuredClone(r.media.tv);
  assert.equal(mediaAction(r,seated,{type:'tv-join'},GameError,5000).replay,true);assert.deepEqual(r.media.tv,before);
});
test('Joining uses a bounded content position; an old idle clock never seeks past the video',()=>{
  const tv={videoId:tvQueue[0].id,startedAt:10000};
  assert.equal(tvJoinSeconds(tv,5000),0);assert.equal(tvJoinSeconds(tv,15000),5);assert.equal(tvJoinSeconds(tv,999999),0);
});
