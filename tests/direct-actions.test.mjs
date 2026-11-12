import test from 'node:test';
import assert from 'node:assert/strict';
import {directAction,directActionKey} from '../src/experience/directActions.ts';

function state(){return{receivedAt:Date.now(),serverTime:10000,self:{id:'me',pantry:{coffee:{stage:'carried'},candy:null,bottle:null,rest:{sprayer:false,stone:null,tea:null,sand:null,vase:null}}},room:{area:'pantry',members:[{id:'me',area:'pantry',seat:null,station:'tea'}],fixtures:{fridge:{open:false}}}};}
test('empty and non-object targets from seat focus have no direct action',()=>{
 const s=state();s.room.members[0].station=null;s.room.members[0].seat=0;
 for(const target of [null,undefined,'','seat-1','unknown'])assert.equal(directAction(s,target),null);
 assert.equal(directAction(s,'cup').type,'cup-sip');
 assert.equal(directAction(s,'snack').type,'snack');
});
test('carried tea and stone only expose seated use; their stations expose return instead',()=>{
 const s=state(),p=s.self.pantry;p.rest.stone={id:'stone',held:true};
 assert.equal(directAction(s,'held'),null);assert.equal(directAction(s,'stone-basket').type,'stone-return');
 s.room.members[0].seat=1;assert.equal(directAction(s,'held').type,'stone-press');
 p.rest.stone=null;p.rest.tea={id:'tea',held:true,location:'personal',volume:.7,pourAt:0};
 s.room.members[0].seat=null;assert.equal(directAction(s,'held'),null);assert.equal(directAction(s,'tea-cup').type,'tea-place');
 s.room.members[0].seat=1;assert.equal(directAction(s,'held').type,'tea-sip');
});
test('separate tea objects preserve optional pour, stop, add, remove and take actions',()=>{
 const s=state();s.self.pantry.rest.tea={id:'tea',location:'station',held:false,volume:0,bagUsed:false,bagIn:false,pourAt:0};const t=s.self.pantry.rest.tea;
 assert.equal(directAction(s,'tea-kettle'),null);assert.equal(directAction(s,'tea-tin').type,'tea-bag');
 Object.assign(t,{bagUsed:true,bagIn:true});assert.equal(directAction(s,'tea-tin'),null);assert.equal(directAction(s,'tea-kettle').type,'tea-pour');
 Object.assign(t,{pourAt:10000,pourEnd:13000});assert.equal(directAction(s,'tea-kettle').type,'tea-stop');
 Object.assign(t,{pourAt:0,volume:.3});assert.equal(directAction(s,'tea-kettle').type,'tea-pour');assert.equal(directAction(s,'tea-bag').type,'tea-remove');
 assert.equal(directAction(s,'tea-cup').type,'tea-take');
 Object.assign(t,{volume:1,bagIn:false});assert.equal(directAction(s,'tea-kettle'),null);assert.equal(directAction(s,'tea-bag'),null);
});
test('object action cooldown follows state transitions and retains exact flower choice',()=>{
 const s=state();assert.equal(directAction(s,'plant-stand').type,'plant-take');s.self.pantry.rest.sprayer=true;assert.equal(directAction(s,'plant-stand').type,'plant-put');assert.equal(directAction(s,'leaf').type,'plant-spray');
 for(const flower of ['cosmos','poppy','cornflower'])assert.equal(directAction(s,'flower-'+flower).extra.flower,flower);
 s.self.pantry.candy={id:'c',held:true,state:'wrapped'};const key=directActionKey(s,'held');s.self.pantry.candy.state='open';assert.notEqual(key,directActionKey(s,'held'));
 s.self.pantry.coffee.stage='brewing';assert.equal(directAction(s,'coffee').type,'stand');
});
