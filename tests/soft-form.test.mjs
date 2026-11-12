import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {softFormGeometry} from '../src/experience/three/softForm.ts';

test('soft forearms expose outward faces and both closed ends with FrontSide rendering',()=>{
 const geometry=softFormGeometry([[-1,0,0,.3,.2],[0,.05,0,.25,.18],[1,.1,.02,.2,.15]]),material=new T.MeshBasicMaterial(),mesh=new T.Mesh(geometry,material);
 mesh.updateMatrixWorld();
 try{for(const point of [[2,0,0],[-2,0,0],[0,0,2],[0,0,-2],[.1,2,.02],[0,-2,0]]){
  const from=new T.Vector3(...point),toward=new T.Vector3(.05,0,0).sub(from).normalize(),hit=new T.Raycaster(from,toward).intersectObject(mesh)[0];
  assert.ok(hit,'the outside must be visible from '+point);assert.ok(hit.face.normal.dot(toward)<0);
 }}finally{geometry.dispose();material.dispose();}
});

test('skin geometry batches with stock finger primitives without losing surfaces',()=>{
 const skin=softFormGeometry([[-.06,0,.01,.025,.02],[0,0,0,.034,.02],[.04,0,0,.025,.015]]),finger=new T.SphereGeometry(.008,8,6),parts=[skin.toNonIndexed(),finger.toNonIndexed()];
 let merged;
 try{merged=mergeGeometries(parts,false);assert.ok(merged);assert.equal(merged.getAttribute('position').count,parts.reduce((n,g)=>n+g.getAttribute('position').count,0));
  assert.equal(merged.getAttribute('uv').count,merged.getAttribute('position').count);assert.ok([...merged.getAttribute('normal').array].every(Number.isFinite));
 }finally{skin.dispose();finger.dispose();parts.forEach(g=>g.dispose());merged?.dispose();}
});
