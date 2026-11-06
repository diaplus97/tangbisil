export const COFFEE_BREW_MS=4500;
export const CUP_PLACE_MS=260;
export const CUP_LIFT_MS=360;
export function coffeePhase(stage,readyAt,now){
 const elapsed=COFFEE_BREW_MS-(readyAt-now),finished=stage==='ready'||stage==='brewing'&&now>=readyAt;
 const progress=finished?1:stage==='brewing'?Math.max(0,Math.min(1,(elapsed-450)/3600)):0;
 return {progress,pouring:stage==='brewing'&&elapsed>=450&&elapsed<4050,finished};
}
