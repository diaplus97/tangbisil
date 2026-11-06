import test from 'node:test';
import assert from 'node:assert/strict';
import {Scene,Group,Mesh,BoxGeometry,MeshBasicMaterial} from 'three';
import {isVisibleInScene,stationInArea} from '../src/experience/three/sceneInteraction.ts';

test('a fridge in the detached pantry helper scene is never a healing room target',()=>{
 const healing=new Scene(),pantryHelper=new Scene(),door=new Group(),surface=new Mesh(new BoxGeometry(),new MeshBasicMaterial());
 pantryHelper.add(door);door.add(surface);door.userData.station='fridge';
 assert.equal(surface.visible,true);assert.equal(pantryHelper.visible,true);
 assert.equal(isVisibleInScene(surface,healing),false);
 assert.equal(stationInArea('healing',door.userData.station),null);
 assert.equal(isVisibleInScene(surface,pantryHelper),true);
 assert.equal(stationInArea('pantry',door.userData.station),'fridge');
 surface.geometry.dispose();surface.material.dispose();
});

test('live scene targets respect hidden ancestors and removal during a room change',()=>{
 const scene=new Scene(),parent=new Group(),target=new Group();scene.add(parent);parent.add(target);
 assert.equal(isVisibleInScene(target,scene),true);
 parent.visible=false;assert.equal(isVisibleInScene(target,scene),false);
 parent.visible=true;parent.removeFromParent();assert.equal(isVisibleInScene(target,scene),false);
 scene.add(parent);assert.equal(isVisibleInScene(target,scene),true);
});

test('only real station IDs in the current room can become hover or approach targets',()=>{
 for(const invalid of [undefined,null,'undefined','','constructor','toString','station-fridge'])assert.equal(stationInArea('pantry',invalid),null);
 for(const id of ['candy','coffee','plant','stone','tea','fridge']){assert.equal(stationInArea('pantry',id),id);assert.equal(stationInArea('healing',id),null);}
 for(const id of ['sand','flower']){assert.equal(stationInArea('healing',id),id);assert.equal(stationInArea('pantry',id),null);}
});
