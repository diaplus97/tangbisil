// Curated official uploads only. The player streams directly from YouTube.
export const tvQueueVersion='kr-curated-2026-11-06';
export const tvQueue=[
  {id:'09uPwjRm7PY',title:'끝까지 보는 게 챌린지',originalTitle:'끝까지 보는 게 챌린지',channel:'빠더너스BDNS',duration:15.721,publishedAt:'2026-11-02',verifiedOn:'2026-11-06',views:410936,likes:13909},
  {id:'CB4Gize2K_g',title:'카톡 프사 있? 없?',originalTitle:'카톡 프사 있? 없?',channel:'채널십오야',duration:100.021,publishedAt:'2026-10-28',verifiedOn:'2026-11-06',views:1955363,likes:25355},
  {id:'ms-6zao6oE0',title:'점점 말을 안 듣는다',originalTitle:'점점 말을 안 듣는다',channel:'haha ha',duration:168.661,publishedAt:'2026-10-20',verifiedOn:'2026-11-06',views:348884,likes:14802},
];
export function recommendedLandscape(roomId,now=Date.now()){
  const seoul=new Date(now+9*3600000),hour=seoul.getUTCHours();
  if(hour>=18||hour<6)return 'fire';
  const day=Math.floor((now+9*3600000)/86400000),salt=[...roomId].reduce((sum,char)=>sum+char.charCodeAt(0),0);
  return (day+salt)%2?'forest':'sea';
}
export function startRoomMedia(r,now=Date.now()){
  // Keep a short disconnect/reload in the same session. No timer is needed.
  if(!r.media||(!r.members.size&&r.media.emptyAt!=null&&now-r.media.emptyAt>60000))
    r.media={sessionId:String(now)+'-'+r.id,landscape:recommendedLandscape(r.id,now),startedAt:now,emptyAt:null,tv:null};
  r.media.emptyAt=null;migrateTvQueue(r,now);return r.media;
}
// A deploy changes the shared queue once, without resetting personal playback.
// Existing clients keep their local clip until it ends or they choose to rejoin.
export function needsTvQueueMigration(r){
  const tv=r.media?.tv;if(!tv)return false;
  return tv.queueVersion!==tvQueueVersion||tvQueue[tv.index]?.id!==tv.videoId;
}
export function migrateTvQueue(r,now=Date.now()){
  if(!needsTvQueueMigration(r))return false;const tv=r.media.tv;
  const index=tvQueue.findIndex(item=>item.id===tv.videoId);
  const retained=index>=0,next=retained?index:0;
  r.media.tv={queueVersion:tvQueueVersion,index:next,videoId:tvQueue[next].id,startedAt:retained?tv.startedAt:now,version:tv.version+1};
  return true;
}
export function mediaAction(r,m,input,GameError,now=Date.now()){
  if(m.area!=='healing'||m.travel||m.seat==null||m.motion?.endsAt>now)throw new GameError('힐링방에 앉으면 함께 볼 수 있어요.');
  const media=r.media??startRoomMedia(r,now);
  if(input.type==='tv-join'){
    if(media.tv)return {ok:true,replay:true};
    media.tv={queueVersion:tvQueueVersion,index:0,videoId:tvQueue[0].id,startedAt:now,version:1};return {ok:true};
  }
  if(input.type!=='tv-next'||!Number.isSafeInteger(input.expectedVersion)||typeof input.sessionId!=='string')throw new GameError('TV 요청을 확인해 주세요.',400);
  const tv=media.tv;
  if(!tv||input.sessionId!==media.sessionId||input.expectedVersion!==tv.version)return {ok:true,replay:true};
  if(now-tv.startedAt<8000)throw new GameError('한 편을 잠깐 본 뒤 다음 영상을 골라 주세요.');
  const index=(tv.index+1)%tvQueue.length;
  media.tv={queueVersion:tvQueueVersion,index,videoId:tvQueue[index].id,startedAt:now,version:tv.version+1};
  return {ok:true};
}
// Advertisements and local pause/buffering are not part of this clock. Never
// continuously seek a player to it; use only on explicit join/rejoin.
export function tvJoinSeconds(tv,now=Date.now()){
  const clip=tvQueue.find(item=>item.id===tv.videoId),elapsed=Math.max(0,(now-tv.startedAt)/1000);
  return clip&&elapsed<clip.duration-3?elapsed:0;
}
