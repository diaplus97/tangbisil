import test from 'node:test';
import assert from 'node:assert/strict';
import {Scene,Mesh} from 'three';
import {createDestinationMarker,destinationHeight} from '../src/experience/three/destinationMarker.ts';

test('click destination is above both floors and clears on arrival, rejection and cancellation',()=>{
 const scene=new Scene(),kit={mesh(parent,geometry,material,x=0,y=0,z=0){const m=new Mesh(geometry,material);m.position.set(x,y,z);parent.add(m);return m;}};
 const marker=createDestinationMarker(kit,scene),group=scene.children[0];
 try{
  marker.set({x:1,z:2},'pending');assert.equal(group.visible,true);assert.ok(destinationHeight>.04);assert.equal(group.position.y,destinationHeight);
  marker.set({x:2,z:3},'moving');marker.tick(performance.now()+300,true,true);assert.equal(marker.status,'moving');
  const at=performance.now()+400;marker.tick(at,false,true);assert.equal(marker.status,'arrived');marker.tick(at+700,false,true);assert.equal(group.visible,false);
  marker.set({x:1,z:2},'blocked');assert.equal(marker.status,'blocked');marker.tick(performance.now()+1500,false,true);assert.equal(marker.status,'hidden');
  marker.set({x:3,z:4},'moving');marker.clear();assert.equal(group.visible,false);
 }finally{marker.dispose();group.traverse(o=>o.geometry?.dispose());}
});
