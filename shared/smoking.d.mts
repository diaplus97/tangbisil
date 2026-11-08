export const thoughtPhrases:Record<'meetings'|'messages'|'tired'|'quiet',string>;
export const thoughtLifetime:number;
export function ribbonState(notes:ReadonlyArray<{until:number;hasEcho:boolean}>|undefined,now:number):0|1|2;
