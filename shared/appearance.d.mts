type Outfit={name:string;coat:string;sleeve:string;pants:string;shoe:string;quilt:boolean};
export const outfits:Outfit[];
export function avatarChoice(value:unknown):number;
export function appearance(avatar:number,id:string):Outfit&{choice:number;cut:number;bun:boolean;part:number;tone:number;hem:number;hair:string};
