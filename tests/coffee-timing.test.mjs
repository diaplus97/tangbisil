import test from 'node:test';
import assert from 'node:assert/strict';
import {coffeePhase,COFFEE_BREW_MS} from '../shared/coffee.mjs';
test('coffee fill and stream share start, finish and reload time',()=>{
 const start=1000,end=start+COFFEE_BREW_MS;
 assert.deepEqual(coffeePhase('placed',0,start),{progress:0,pouring:false,finished:false});
 assert.deepEqual(coffeePhase('brewing',end,start+449),{progress:0,pouring:false,finished:false});
 assert.equal(coffeePhase('brewing',end,start+450).pouring,true);
 assert.equal(coffeePhase('brewing',end,start+2250).progress,.5);
 assert.deepEqual(coffeePhase('brewing',end,start+4050),{progress:1,pouring:false,finished:false});
 assert.deepEqual(coffeePhase('brewing',end,end),{progress:1,pouring:false,finished:true});
 assert.deepEqual(coffeePhase('ready',end,end+5000),{progress:1,pouring:false,finished:true});
 assert.deepEqual(coffeePhase('carried',0,end),{progress:0,pouring:false,finished:false});
});
