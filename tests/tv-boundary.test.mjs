import test from 'node:test';
import assert from 'node:assert/strict';
import {createTvBoundary} from '../shared/tv-boundary.mjs';

function run(changes={}){
 const boundary=createTvBoundary(),sample=(time,at,extra={})=>boundary.sample({time,at,duration:15.721,expectedDuration:15.721,state:1,...extra});
 for(let i=0;i<16;i++)assert.equal(sample(11.5+i*.25,i*250),false);
 return {boundary,sample};
}
test('Shorts continuous natural wrap is recognized once, including brief buffering',()=>{
 const {sample}=run();assert.equal(sample(15.5,4000),false);assert.equal(sample(15.5,4050,{state:3}),false);assert.equal(sample(.029,4250),true);assert.equal(sample(.279,4500),false);
});
test('pause, hidden tab, mismatched duration, seeking and long buffering never advance',()=>{
 for(const override of [{state:2},{eligible:false},{duration:30},{time:0},{at:8000}]){
  const {sample}=run();assert.equal(sample(15.5,4000,override),false);assert.equal(sample(.029,4250),false);
 }
 const {boundary,sample}=run();boundary.reset();assert.equal(sample(.029,4250),false);
 const a=createTvBoundary();assert.equal(a.sample({time:15.5,at:1,duration:15.721,expectedDuration:15.721,state:1}),false);assert.equal(a.sample({time:0,at:250,duration:15.721,expectedDuration:15.721,state:1}),false);
});
