import test from 'node:test';
import assert from 'node:assert/strict';
import {Scene,Group,Mesh,BoxGeometry,MeshBasicMaterial,PerspectiveCamera,Raycaster,Vector3} from 'three';
import {floorDestination,pickSceneTarget,isVisibleInScene,selectionSurface,stationInArea} from '../src/experience/three/sceneInteraction.ts';
import {createSightFade} from '../src/experience/three/sightFade.ts';

test('mouse clicks above the stone bowl walk to the visible floor while touch keeps the large target',()=>{
 const scene=new Scene(),basket=new Group(),bowl=new Mesh(),proxy=new Mesh(),floor=new Mesh();
 scene.add(basket,proxy,floor);basket.add(bowl);basket.userData={station:'stone',directSurface:true};
 proxy.userData.station='stone';floor.userData.walkSurface=true;
 const hits=[{object:proxy,distance:1}],ground={object:floor,distance:5},model={object:bowl,distance:2};
 assert.equal(pickSceneTarget(hits,ground,scene,'pantry',true),undefined);
 assert.equal(pickSceneTarget(hits,ground,scene,'pantry',false).object,proxy);
 for(const precise of [true,false])assert.equal(pickSceneTarget(hits,model,scene,'pantry',precise).object,basket);
 for(const mesh of [bowl,proxy,floor]){mesh.geometry.dispose();mesh.material.dispose();}
});

test('a tap on visible floor beside the fridge stops just clear of the door swing',()=>{
 const floor={x:-5.5,z:3.45},point=floorDestination(floor,'pantry');
 assert.equal(point.x,floor.x);assert.ok(Math.abs(point.z-3.18)<.001);
 assert.deepEqual(floorDestination({x:-4,z:4},'pantry'),{x:-4,z:4});
 assert.equal(floorDestination({x:-2.25,z:1},'pantry'),null);
 assert.equal(floorDestination({x:20,z:20},'pantry'),null);
});
test('a decorative canopy passes taps through while a faded solid cabinet still blocks them',()=>{
 const scene=new Scene(),leaf=new Mesh(),floor=new Mesh(),cabinet=new Mesh();
 scene.add(leaf,cabinet,floor);
 leaf.userData.decorativeCanopy=true;floor.userData.walkSurface=true;cabinet.userData.blocksSelection=true;
 const hits=[{object:leaf,distance:1},{object:floor,distance:6}];
 assert.equal(selectionSurface(hits,scene),hits[1]);
 leaf.material.opacity=.08;
 assert.equal(selectionSurface(hits,scene),hits[1]);
 cabinet.material.transparent=true;cabinet.material.opacity=.09;
 hits.splice(1,0,{object:cabinet,distance:4});
 assert.equal(selectionSurface(hits,scene).object,cabinet);
 for(const m of [leaf,cabinet,floor]){m.geometry.dispose();m.material.dispose();}
});

test('decorative leaves skip mesh raycasting before, during, and after fading without disabling watering leaves',()=>{
 const scene=new Scene(),canopy=new Group(),geometry=new BoxGeometry(),material=new MeshBasicMaterial();
 const leaf=new Mesh(geometry,material),wateringLeaf=new Mesh(geometry,material);
 canopy.add(leaf);scene.add(canopy,wateringLeaf);wateringLeaf.position.z=-2;
 wateringLeaf.userData={action:'leaf',station:'plant',directSurface:true};
 const kit={materials:new Map()},fade=createSightFade(kit,canopy,true,.08),camera=new PerspectiveCamera();
 camera.position.set(0,0,3);scene.updateMatrixWorld(true);
 const ray=new Raycaster(camera.position,new Vector3(0,0,-1));
 for(const actor of [null,{x:0,z:-2},null]){
  fade(camera,actor,true);
  assert.notEqual(leaf.raycast,Mesh.prototype.raycast);
  const hits=ray.intersectObjects(scene.children,true);
  assert.ok(hits.length>0);assert.ok(hits.every(hit=>hit.object===wateringLeaf));
  assert.equal(selectionSurface(hits,scene).object,wateringLeaf);
  assert.equal(wateringLeaf.raycast,Mesh.prototype.raycast);
  assert.equal(wateringLeaf.material.opacity,1);
 }
 geometry.dispose();material.dispose();for(const material of kit.materials.values())material.dispose();
});

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
