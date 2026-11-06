export const SAND_WIDTH:number,SAND_HEIGHT:number;
export function initialStones():number[][];
export function decodeSand(value?:string):Uint8Array;
export function encodeSand(grid:Uint8Array):string;
export function rakeSand(grid:Uint8Array,points:number[][]):Uint8Array;
export function gentleStroke(revision?:number):number[][];
export function nextStonePosition(stone:number[]):number[];
