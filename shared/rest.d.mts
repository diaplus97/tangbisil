import type {PantryItems,Tea} from '../src/experience/types';
export function emptyRest():PantryItems['rest'];
export function sampleTea(tea:Tea|null,now:number):Tea|null;
export function heldName(p:PantryItems,except?:string):string|null;
