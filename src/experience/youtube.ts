export type YouTubePlayer={
  loadVideoById:(clip:{videoId:string;startSeconds:number})=>void;
  cueVideoById:(clip:{videoId:string;startSeconds:number})=>void;
  playVideo:()=>void;pauseVideo:()=>void;mute:()=>void;destroy:()=>void;
  getPlayerState:()=>number;
};
type PlayerOptions={events:{onReady:(event:{target:YouTubePlayer})=>void;onStateChange:(event:{data:number})=>void;onError:(event:{data:number})=>void;onAutoplayBlocked:()=>void}};
type YouTubeApi={Player:new(element:HTMLIFrameElement,options:PlayerOptions)=>YouTubePlayer};
declare global{interface Window{YT?:YouTubeApi;onYouTubeIframeAPIReady?:()=>void}}
let loading:Promise<YouTubeApi>|null=null;
// Called only after the visitor accepts the external-player notice.
export function loadYouTube():Promise<YouTubeApi>{
  if(window.YT?.Player)return Promise.resolve(window.YT);
  if(loading)return loading;
  loading=new Promise((resolve,reject)=>{
    const script=document.createElement('script'),previous=window.onYouTubeIframeAPIReady;
    const finish=()=>{clearTimeout(timer);script.onerror=null;};
    const fail=()=>{finish();script.remove();loading=null;window.onYouTubeIframeAPIReady=previous;reject(Error('YouTube 연결을 열지 못했어요.'));};
    const timer=setTimeout(fail,12000);
    window.onYouTubeIframeAPIReady=()=>{finish();previous?.();if(window.YT?.Player)resolve(window.YT);else fail();};
    script.src='https://www.youtube.com/iframe_api';script.async=true;script.referrerPolicy='strict-origin-when-cross-origin';script.onerror=fail;document.head.append(script);
  });return loading;
}
export const youtubeError=(code:number)=>code===100?'영상이 삭제되었거나 공개되지 않았어요.':code===101||code===150?'이 영상은 외부 화면에서 볼 수 없어요.':code===153?'YouTube가 이 화면의 접속 주소를 확인하지 못했어요.':code===5?'이 브라우저에서 영상을 재생하지 못했어요.':'영상을 불러오지 못했어요.';
