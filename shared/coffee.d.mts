export const COFFEE_BREW_MS:number;
export const CUP_PLACE_MS:number;
export const CUP_LIFT_MS:number;
export const CUP_SIPS:number;
export function coffeePhase(stage:string|undefined,readyAt:number,now:number):{progress:number;pouring:boolean;finished:boolean};
