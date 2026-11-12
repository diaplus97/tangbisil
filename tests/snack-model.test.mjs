import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {Group,Box3,Raycaster,Vector3} from 'three';
import {Workshop,consolidate} from '../src/experience/three/assets.ts';
import {snackCatalog} from '../shared/snacks.mjs';

test('recipe solids survive batching, cuts remove depth, and repeated openings release geometry',async t=>{
 const hook=registerHooks({resolve(specifier,context,next){return specifier==='./assets'&&context.parentURL?.endsWith('/snackModels.ts')?next('./assets.ts',context):next(specifier,context);}});t.after(()=>hook.deregister());
 const previous=globalThis.document;t.after(()=>globalThis.document=previous);
 const noop=()=>{},ctx=new Proxy({createLinearGradient:()=>({addColorStop:noop})},{get:(target,key)=>target[key]??noop,set:(target,key,value)=>(target[key]=value,true)});
 globalThis.document={createElement:()=>({getContext:()=>ctx})};const{snackFood,snackPackaging}=await import('../src/experience/three/snackModels.ts');
 const kit=new Workshop();t.after(()=>kit.dispose());
 for(const r of snackCatalog){let fullDepth=0;
  for(const bites of[0,1,2,3]){const parent=new Group(),model=snackFood(kit,parent,{snack_id:r.id,state:bites===3?'empty':'open',bites});let triangles=0;
   model.traverse(o=>{if(o.isMesh){if(Array.isArray(o.material))assert.ok(o.geometry.groups.length<=2);assert.ok([...o.geometry.attributes.position.array].every(Number.isFinite));triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});
   if(bites<3){assert.ok(triangles>0);const bounds=new Box3().setFromObject(model),depth=bounds.max.z-bounds.min.z;if(bites===0)fullDepth=depth;else if(r.kind!=='lemonPie')assert.ok(depth<fullDepth,`${r.id} retains a smaller solid after bite ${bites}`);consolidate(model,kit);assert.ok(model.children.length>0);assert.ok(model.children.length<=12);}else assert.equal(triangles,0);
   kit.release(parent);assert.equal(kit.geometries.size,0);
  }
  const textureCount=kit.textures.size;
  for(let n=0;n<8;n++){const parent=new Group(),wrapper=snackPackaging(kit,parent,{snack_id:r.id});for(const p of[0,.2,.5,1])wrapper.update(p);kit.release(parent);assert.equal(kit.geometries.size,0);}
  assert.ok(kit.textures.size-textureCount<=2,'wrapper resources are shared across repeated visits');
  if(r.kind==='dubaiCookie'){
   const parent=new Group();snackFood(kit,parent,{snack_id:r.id,state:'open'});const wrapper=snackPackaging(kit,parent,{snack_id:r.id}),covered=new Set();wrapper.group.traverse(o=>covered.add(o));parent.updateMatrixWorld(true);
   for(let i=0;i<16;i++)for(const y of[.15,.35,.55]){const a=i*Math.PI/8,from=new Vector3(Math.sin(a)*4,y,Math.cos(a)*4),direction=new Vector3(0,y,0).sub(from).normalize(),first=new Raycaster(from,direction).intersectObject(parent,true)[0];assert.ok(first&&covered.has(first.object),'sealed wax flaps cover the food from angle '+i+' at height '+y);}
   kit.release(parent);assert.equal(kit.geometries.size,0);
  }
 }
});
