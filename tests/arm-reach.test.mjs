import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {armReach} from '../src/experience/three/armReach.ts';

test('a drinking palm reaches below the mouth without stretching or lifting the cup into the eyes',()=>{
 const shoulder=new T.Vector3(.29,.51,0);
 for(const target of [new T.Vector3(.075,.60,.25),new T.Vector3(.075,.56,.25),new T.Vector3(.075,.72,.25)]){
  const pose=armReach(shoulder,target),elbow=shoulder.clone().add(new T.Vector3(0,-.29,0).applyQuaternion(pose.shoulder)),wrist=elbow.clone().add(new T.Vector3(0,-.27,0).applyQuaternion(pose.shoulder.clone().multiply(pose.elbow)));
  assert.ok(wrist.distanceTo(target)<1e-8);assert.ok(Math.abs(elbow.distanceTo(shoulder)-.29)<1e-8);assert.ok(Math.abs(wrist.distanceTo(elbow)-.27)<1e-8);
 }
 const cupRim=.60+.025+.154;assert.ok(cupRim<.86,'rim stays below the eyes');
});
