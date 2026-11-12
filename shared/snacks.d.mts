export type SnackKind='lemonPie'|'fruitMochi'|'layeredMochi'|'dubaiCookie';
export type SnackDefinition={id:string;version:number;name:string;kind:SnackKind;portions:number;opening:'peel'|'gather'|'slide'|'fold';openingLabel:string;description:string};
export type SnackDisplay={catalogRevision:number;dayId:string;displayId:string;nextChangeAt:number;slots:{slot:number;snackId:string;definitionVersion:number}[]};
export const LEGACY_SNACK_ID:string;
export const SNACK_CATALOG_REVISION:number;
export const snackCatalog:readonly Readonly<SnackDefinition>[];
export function snackDefinition(id:string,version?:number):Readonly<SnackDefinition>|null;
export function snackDisplay(now?:number):SnackDisplay;
