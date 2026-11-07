export const movementCodes=new Set(['KeyW','KeyA','KeyS','KeyD']);
const bearingThreshold = Math.cos(18 * Math.PI / 180);
export function bearingChanged(a:{x:number;z:number}, b:{x:number;z:number}) {
 const lengths = Math.hypot(a.x,a.z) * Math.hypot(b.x,b.z);
 return lengths > .001 && a.x*b.x + a.z*b.z < lengths*bearingThreshold;
}
export function keyboardVector(keys:Set<string>,forward:{x:number;z:number},right:{x:number;z:number}):[number,number]|null{
 const f=Number(keys.has('KeyW'))-Number(keys.has('KeyS')),s=Number(keys.has('KeyD'))-Number(keys.has('KeyA'));
 if(!f&&!s)return null;
 const fl=Math.hypot(forward.x,forward.z)||1,rl=Math.hypot(right.x,right.z)||1;
 const x=f*forward.x/fl+s*right.x/rl,z=f*forward.z/fl+s*right.z/rl,length=Math.hypot(x,z);
 return length>.001?[x/length,z/length]:null;
}

export function createKeyboardWalk(options:{ready?:()=>boolean;direction:(keys:Set<string>)=>[number,number]|null;move:(direction:[number,number])=>Promise<unknown>;stop:()=>Promise<unknown>}){
 const keys=new Set<string>();let previous:[number,number]|null=null,pending:Promise<void>|null=null,needsStop=false,lastSent=-Infinity,lastStop=-Infinity;let wake:ReturnType<typeof setTimeout>|undefined,disposed=false;
 function later(){if(!wake&&!disposed)wake=setTimeout(()=>{wake=undefined;void tick(performance.now());},100);}
 function tick(now:number):Promise<void>{
  if(pending)return pending;
  if(disposed)return Promise.resolve();
  const direction=options.direction(keys);
  if(!direction&&!needsStop)return Promise.resolve();
  if(options.ready&&!options.ready()){later();return Promise.resolve();}
  if(direction&&previous&&direction[0]*previous[0]+direction[1]*previous[1]>.994)return Promise.resolve();
  if(direction&&now-lastSent<250||!direction&&now-lastStop<200){later();return Promise.resolve();}
  lastSent=now;
  const run=async()=>{
   if(direction){needsStop=true;const result=await options.move(direction);if(result)previous=direction;else{keys.clear();previous=null;}}
   else{lastStop=now;const result=await options.stop();if(result){needsStop=false;previous=null;}else later();}
  };
  pending=run().finally(()=>{pending=null;if(direction&&!keys.size&&needsStop)void tick(performance.now());});
  return pending;
 }
 return{keys,tick,press(code:string){if(movementCodes.has(code))keys.add(code);},release(code:string){keys.delete(code);},
  async stop(){keys.clear();await pending;await tick(performance.now());},dispose(){disposed=true;keys.clear();clearTimeout(wake);},get active(){return keys.size>0||needsStop;}};
}
