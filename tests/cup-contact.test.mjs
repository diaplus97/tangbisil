import test from 'node:test';
import assert from 'node:assert/strict';
import {keepsCupContact} from '../src/experience/cupContact.ts';
const member=(action,stage='carried',station=null)=>({action,actionAt:1080,connected:true,station,pantry:{coffee:{stage}}});
test('cup contact survives compatible fast followups but not cancellation or replacement',()=>{
 assert.equal(keepsCupContact({action:'coffee-place',at:1000},member('coffee-brew','brewing','coffee')),true);
 for(const toSeat of [null,1])assert.equal(keepsCupContact({action:'coffee-take',at:1000},{...member('rest'),motion:{startedAt:1080,walkMs:1800,toSeat}}),true);
 for(const source of ['coffee-place','coffee-take'])for(const action of ['stand','travel','candy-take','coffee-place'])assert.equal(keepsCupContact({action:source,at:1000},member(action)),false);
 assert.equal(keepsCupContact({action:'coffee-take',at:1000},{...member('sit'),connected:false}),false);
 assert.equal(keepsCupContact({action:'coffee-take',at:1000},{...member('sit'),actionAt:900}),false);
 assert.equal(keepsCupContact({action:'coffee-take',at:1000},{...member('rest'),motion:{startedAt:1080,walkMs:0}}),false);
 assert.equal(keepsCupContact({action:'coffee-take',at:1000},{...member('rest'),travel:{to:'healing'},motion:{startedAt:1080,walkMs:1800}}),false);
});
