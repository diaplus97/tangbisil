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

for(const [rate,interval]of [[2,250],[1,500]])test(`Shorts wrap from 15.3s is recognized at ${rate}x with ${interval}ms polling`,()=>{
 const boundary=createTvBoundary(),sample=(time,at)=>boundary.sample({time,at,rate,duration:15.721,expectedDuration:15.721,state:1});
 for(let i=0;i<=8;i++)assert.equal(sample(11.3+i*.5,i*interval),false);
 assert.equal(sample(.079,9*interval),true);
 assert.equal(sample(.579,10*interval),false,'the same boundary fires only once');
});

test('a near-end backward seek faster than measured playback does not count as a wrap',()=>{
 const boundary=createTvBoundary(),sample=(time,at)=>boundary.sample({time,at,rate:2,duration:15.721,expectedDuration:15.721,state:1});
 for(let i=0;i<=8;i++)assert.equal(sample(11.3+i*.5,i*250),false);
 assert.equal(sample(.079,2100),false,'0.5s of media cannot pass in 100ms at 2x');
});
test('pause, hidden tab, mismatched duration, seeking and long buffering never advance',()=>{
 for(const override of [{state:2},{eligible:false},{duration:30},{time:0},{at:8000}]){
  const {sample}=run();assert.equal(sample(15.5,4000,override),false);assert.equal(sample(.029,4250),false);
 }
 const {boundary,sample}=run();boundary.reset();assert.equal(sample(.029,4250),false);
 const a=createTvBoundary();assert.equal(a.sample({time:15.5,at:1,duration:15.721,expectedDuration:15.721,state:1}),false);assert.equal(a.sample({time:0,at:250,duration:15.721,expectedDuration:15.721,state:1}),false);
});
