import test from 'node:test';
import assert from 'node:assert/strict';
import {Group} from 'three';
import {Workshop,label} from '../src/experience/three/assets.ts';

test('repeated bottle-label lifetimes reuse texture/material and release each geometry',t=>{
 const original=globalThis.document;t.after(()=>globalThis.document=original);
 globalThis.document={createElement:()=>({getContext:()=>({fillRect(){},fillText(){},measureText:()=>({width:100,actualBoundingBoxAscent:30,actualBoundingBoxDescent:6})})})};
 const kit=new Workshop();t.after(()=>kit.dispose());let first;
 for(let i=0;i<60;i++){const parent=new Group(),mesh=label(kit,parent,'오늘의 물',.4,.12,0,0,0);first??=mesh.material;assert.equal(mesh.material,first);kit.release(parent);assert.equal(kit.geometries.size,0);assert.equal(kit.textures.size,1);assert.equal(kit.materials.size,1);}
 label(kit,new Group(),'오늘의 물',.4,.12,0,0,0,'#fff');assert.equal(kit.textures.size,2);
});
