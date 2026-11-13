import test from 'node:test';
import assert from 'node:assert/strict';
import {snackBiteMotion,snackBiteProfiles} from '../src/experience/snackBiteMotion.ts';

test('layered rice and chewy shell have distinct contact, compression and recovery',()=>{
 assert.equal(snackBiteMotion('layeredMochi',400).contact,true);
 assert.equal(snackBiteMotion('dubaiCookie',400).contact,false);
 assert.ok(snackBiteMotion('layeredMochi',390).press>.1);
 assert.equal(snackBiteMotion('layeredMochi',700).press,0);
 assert.ok(snackBiteMotion('dubaiCookie',700).press>.1);
 assert.ok(snackBiteMotion('dubaiCookie',1140).rebound>0);
 for(const [kind,profile]of Object.entries(snackBiteProfiles)){
  assert.ok(profile.contact>0&&profile.contact<profile.duration);
  assert.equal(snackBiteMotion(kind,profile.contact-1).contact,false);
  assert.equal(snackBiteMotion(kind,profile.contact).contact,true);
  for(const age of [-1,profile.duration,profile.duration+100]){const m=snackBiteMotion(kind,age);assert.equal(m.active,false);assert.equal(m.lift,0);assert.equal(m.press,0);assert.equal(m.rebound,0);}
  const reduced=snackBiteMotion(kind,0,true);assert.equal(reduced.active,false);assert.equal(reduced.contact,true);assert.equal(reduced.lift,0);
 }
});
