import {useEffect,useRef,useState} from 'react';
import {tvQueue,tvJoinSeconds,type TvState} from '../../shared/room-media.mjs';
import {loadYouTube,youtubeError,type YouTubePlayer} from './youtube';
import type {Snapshot} from './types';
import './shared-tv.css';

type Props={state:Snapshot;active:boolean;busy:boolean;act:(type:string,extra?:Record<string,unknown>)=>Promise<unknown>;onClose:()=>void};
export default function SharedTV({state,active,busy,act,onClose}:Props){
  const mount=useRef<HTMLDivElement>(null),player=useRef<YouTubePlayer|null>(null),live=useRef({state,active,busy,act}),visible=useRef(false);
  live.current={state,active,busy,act};
  const [local,setLocal]=useState<TvState|null>(state.room.media?.tv??null),localRef=useRef(local),[status,setStatus]=useState('YouTube를 준비하고 있어요.'),[problem,setProblem]=useState(false),[ready,setReady]=useState(false),[retry,setRetry]=useState(0);
  const loadingNext=useRef(false),ended=useRef(false),advanceRef=useRef<()=>void>(()=>{});
  const clock=useRef({server:state.serverTime,local:Date.now()});
  useEffect(()=>{clock.current={server:state.serverTime,local:Date.now()};},[state.serverTime]);
  const now=()=>clock.current.server+Date.now()-clock.current.local;
  function show(clip:TvState,join:boolean){
    if(!player.current)return;localRef.current=clip;setLocal(clip);ended.current=false;setProblem(false);
    const item={videoId:clip.videoId,startSeconds:join?tvJoinSeconds(clip,now()):0};
    if(visible.current&&live.current.active&&!document.hidden){player.current.loadVideoById(item);setStatus('재생을 준비하고 있어요.');}
    else{player.current.cueVideoById(item);setStatus('재생 버튼을 누르면 이어 볼 수 있어요.');}
  }
  async function next(natural=false){
    if(loadingNext.current||live.current.busy||!player.current)return;
    const remote=live.current.state.room.media,shown=localRef.current;
    if(!remote?.tv||!shown)return;
    if(remote.tv.version!==shown.version){show(remote.tv,true);return;}
    loadingNext.current=true;
    try{
      const result=await live.current.act('tv-next',{sessionId:remote.sessionId,expectedVersion:shown.version}) as {state:Snapshot}|null;
      const clip=result?.state.room.media?.tv;
      if(clip&&clip.version!==shown.version)show(clip,false);
      else if(natural)setStatus('영상이 끝났어요. 다음 영상으로 이어갈 수 있어요.');
    }finally{loadingNext.current=false;}
  }
  advanceRef.current=()=>{if(!ended.current){ended.current=true;void next(true);}};
  useEffect(()=>{
    let disposed=false,created:YouTubePlayer|null=null;
    setReady(false);setProblem(false);setStatus('YouTube를 준비하고 있어요.');
    const host=mount.current!;
    const readyTimer=setTimeout(()=>{if(!disposed&&!player.current){setStatus('연결이 늦어지고 있어요. 다시 연결하거나 그만 볼 수 있어요.');setProblem(true);}},15000);
    const observer=new IntersectionObserver(entries=>{
      visible.current=(entries[0]?.intersectionRatio??0)>=.5;
      if(!visible.current)player.current?.pauseVideo();
    },{threshold:[0,.5,1]});observer.observe(host);
    const visibility=()=>{if(document.hidden){player.current?.pauseVideo();setStatus('쉬는 동안 멈췄어요. 재생 버튼으로 이어 보세요.');}};
    document.addEventListener('visibilitychange',visibility);
    void loadYouTube().then(api=>{
      if(disposed)return;
      const clip=live.current.state.room.media?.tv;if(!clip)return;
      const iframe=document.createElement('iframe');iframe.title='YouTube 공동 TV';iframe.referrerPolicy='strict-origin-when-cross-origin';iframe.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';iframe.allowFullscreen=true;
      iframe.src=`https://www.youtube-nocookie.com/embed/${clip.videoId}?enablejsapi=1&origin=${encodeURIComponent(location.origin)}&playsinline=1&autoplay=0&controls=1&rel=0`;
      host.replaceChildren(iframe);
      created=new api.Player(iframe,{events:{
        onReady(event){if(disposed)return;clearTimeout(readyTimer);player.current=event.target;setReady(true);event.target.mute();show(live.current.state.room.media?.tv??clip,true);},
        onStateChange(event){if(disposed)return;
          if(event.data===1){setStatus('소리·자막은 YouTube 안에서 조절해요.');setProblem(false);if(!visible.current||!live.current.active||document.hidden)player.current?.pauseVideo();}
          if(event.data===2)setStatus('내 화면은 일시정지 중 · 재생 버튼으로 이어 보기');
          if(event.data===0)advanceRef.current();
        },
        onError(event){if(disposed)return;setStatus(youtubeError(event.data)+' 다시 연결하거나 그만 볼 수 있어요.');setProblem(true);},
        onAutoplayBlocked(){if(disposed)return;setStatus('자동 재생이 멈췄어요. YouTube의 재생 버튼을 눌러 주세요.');},
      }});
    }).catch(()=>{if(!disposed){setStatus('YouTube에 연결하지 못했어요. 다시 연결하거나 풍경으로 돌아갈 수 있어요.');setProblem(true);}});
    return()=>{disposed=true;clearTimeout(readyTimer);observer.disconnect();document.removeEventListener('visibilitychange',visibility);created?.destroy();player.current=null;host.replaceChildren();};
  },[retry]);
  useEffect(()=>{if(!active)player.current?.pauseVideo();},[active]);
  const clip=tvQueue.find(item=>item.id===local?.videoId),pending=state.room.media?.tv?.version!==local?.version;
  return <section className="shared-tv" aria-label="함께 보는 TV" onPointerDown={e=>e.stopPropagation()} onKeyDown={e=>e.stopPropagation()}>
    <header><strong>{clip?.title??'잠깐의 영상'}</strong><a href={'https://www.youtube.com/watch?v='+local?.videoId} target="_blank" rel="noopener noreferrer" title={clip?.channel}>YouTube ↗</a></header>
    <div className="youtube-viewport" ref={mount}/>
    <p role="status">{pending&&!problem?'다음 편 준비됨 · 원할 때 함께 보기로 합류':status}</p>
    <div className="tv-actions">
      <button onClick={onClose}>그만 보기</button>
      {problem?<button onClick={()=>setRetry(value=>value+1)}>다시 연결</button>:<button disabled={!ready||busy||!active} onClick={()=>{const clip=state.room.media?.tv;if(clip)show(clip,true);}}>함께 보기로</button>}
      <button disabled={!ready||busy||!active} onClick={()=>void next()}>다음 영상</button>
    </div>
  </section>;
}
