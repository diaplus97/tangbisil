export type LandscapeId='sea'|'forest'|'fire';
export type TvState={queueVersion:string;index:number;videoId:string;startedAt:number;version:number};
export type RoomMedia={sessionId:string;landscape:LandscapeId;startedAt:number;emptyAt:number|null;tv:TvState|null};
export const tvQueueVersion:string;
export const tvQueue:{id:string;title:string;originalTitle:string;channel:string;duration:number;publishedAt:string;verifiedOn:string;views:number;likes:number}[];
export function recommendedLandscape(roomId:string,now?:number):LandscapeId;
export function tvJoinSeconds(tv:TvState,now?:number):number;
