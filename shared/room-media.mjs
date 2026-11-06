// Curated official uploads only. The player streams directly from YouTube.
export const tvQueueVersion='quiet-break-2026-11';
export const tvQueue=[
  {id:'-eNe1OmbbXc',title:'만에서 쉬는 해달',originalTitle:'Sea otter life in the bay | #shorts',channel:'Monterey Bay Aquarium',duration:49.081},
  {id:'KRi9yVx4uu0',title:'물결 따라 해파리',originalTitle:'Happy World Jellyfish Day!',channel:'Monterey Bay Aquarium',duration:73.641},
  {id:'Q3YYwIsMHzw',title:'밤의 지구를 천천히',originalTitle:'NASA | Earth at Night',channel:'NASA Goddard',duration:131.041},
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
  r.media.emptyAt=null;return r.media;
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
