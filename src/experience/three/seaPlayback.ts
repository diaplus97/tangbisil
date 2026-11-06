import {windowView,type WindowView} from './windowView';

export type SeaPlaybackStatus='loading'|'playing'|'paused'|'blocked'|'fallback';

// A real silent media loop. Playback policy is independent of room/game state.
export function createSeaPlayback(video:HTMLVideoElement,onFrame:()=>void,onStatus:(status:SeaPlaybackStatus)=>void,view:Pick<WindowView,'mp4'|'webm'>=windowView){
  let disposed=false,wanted=false,visible=true,loaded=false,pending=false,failed=false,blocked=false;
  let sourceIndex=0,attempt=0;
  const sources=video.canPlayType('video/webm; codecs="vp9"')?[view.webm,view.mp4]:[view.mp4];
  video.muted=true;video.defaultMuted=true;video.loop=true;video.playsInline=true;
  video.preload='none';
  const allowed=()=>wanted&&visible&&!document.hidden&&!disposed;
  async function update(){
    if(disposed)return;
    if(!allowed()){
      video.pause();onStatus('paused');return;
    }
    if(failed){onStatus('fallback');return;}
    if(blocked){onStatus('blocked');return;}
    if(!loaded){loaded=true;video.preload='auto';video.src=sources[sourceIndex];video.load();}
    if(pending||!video.paused)return;
    pending=true;const ticket=++attempt;let aborted=false;onStatus('loading');
    try{await video.play();if(!allowed())video.pause();}
    catch(error){
      if(disposed||!allowed()||ticket!==attempt)return;
      if(error instanceof DOMException&&error.name==='NotAllowedError'){blocked=true;onStatus('blocked');}
      // AbortError is expected when pausing while a play request is pending.
      else if(error instanceof DOMException&&error.name==='AbortError')aborted=true;
      else fail();
    }finally{if(ticket===attempt){pending=false;if(aborted&&allowed())queueMicrotask(()=>void update());}}
  }
  function fail(){
    if(disposed)return;attempt++;
    if(sourceIndex+1<sources.length){sourceIndex++;loaded=false;pending=false;void update();}
    else{failed=true;video.pause();onStatus('fallback');}
  }
  const ready=()=>{if(!disposed){onFrame();if(allowed()&&!video.paused)onStatus('playing');}};
  const playing=()=>{if(!disposed){onFrame();onStatus('playing');}};
  const visibility=()=>{void update();};
  const retry=()=>{if(blocked&&allowed()){blocked=false;void update();}};
  video.addEventListener('loadeddata',ready);video.addEventListener('playing',playing);video.addEventListener('error',fail);
  document.addEventListener('visibilitychange',visibility);
  document.addEventListener('pointerdown',retry);document.addEventListener('keydown',retry);
  return {
    motion(on:boolean){const changed=wanted!==on;wanted=on;if(changed)blocked=false;void update();},
    active(on:boolean){if(visible===on)return;visible=on;void update();},
    dispose(){disposed=true;video.pause();video.removeEventListener('loadeddata',ready);video.removeEventListener('playing',playing);video.removeEventListener('error',fail);document.removeEventListener('visibilitychange',visibility);document.removeEventListener('pointerdown',retry);document.removeEventListener('keydown',retry);video.removeAttribute('src');video.load();},
  };
}
