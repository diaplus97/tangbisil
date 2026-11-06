import * as T from 'three';
import {Workshop} from './assets';
import {windowView,windowViews,type WindowView} from './windowView';
import {windowOpening} from './layout';
import {createSeaPlayback,type SeaPlaybackStatus} from './seaPlayback';

export type LandscapeStatus='loading'|'ready'|'fallback';

// A window portal keeps the panorama inside the opening. In perspective views,
// rays meet a virtual background farther behind the wall, rather than a poster
// on the glass. The retained orthographic study uses the whole panorama.
export function windowLandscape(kit:Workshop,scene:T.Scene,onStatus:(status:LandscapeStatus)=>void,video:HTMLVideoElement,onPlayback:(status:SeaPlaybackStatus)=>void,opening=windowOpening,initialView:WindowView=windowViews.sea){
  let disposed=false,videoReady=false,generation=0,wanted=false,active=true,currentView=initialView;
  let texture:T.Texture|null=null,playback:ReturnType<typeof createSeaPlayback>|null=null;
  const material=new T.ShaderMaterial({
    uniforms:{landscape:{value:null as T.Texture|null},loaded:{value:0},videoSource:{value:0},warmth:{value:0},perspective:{value:0},
      viewCenter:{value:new T.Vector2(...windowView.center)},viewSize:{value:new T.Vector2(...windowView.size)},
      fallbackLow:{value:new T.Color(windowView.fallbackLow)},fallbackHigh:{value:new T.Color(windowView.fallbackHigh)}},
    vertexShader:`varying vec2 vUv;
      varying vec3 vWorld;
      void main(){vUv=uv;vec4 world=modelMatrix*vec4(position,1.0);vWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`,
    fragmentShader:`uniform sampler2D landscape;
      uniform float loaded;
      uniform float videoSource;
      uniform float warmth;
      uniform float perspective;
      uniform vec2 viewCenter;
      uniform vec2 viewSize;
      uniform vec3 fallbackLow;
      uniform vec3 fallbackHigh;
      varying vec2 vUv;
      varying vec3 vWorld;
      void main(){
        vec3 direction=vWorld-cameraPosition;
        float distanceToBackground=(-8.0-cameraPosition.z)/min(direction.z,-0.01);
        vec3 distant=cameraPosition+direction*distanceToBackground;
        vec2 projected=(distant.xy-viewCenter)/viewSize+0.5;
        vec2 sampleUv=clamp(mix(vUv,projected,perspective),vec2(0.002),vec2(0.998));
        vec3 fallback=mix(fallbackLow,fallbackHigh,smoothstep(0.2,0.72,vUv.y));
        vec4 sampled=texture2D(landscape,sampleUv);
        // Custom video uniforms need the inline transfer used by Three's map shader.
        if(videoSource>0.5)sampled=sRGBTransferEOTF(sampled);
        vec3 color=mix(fallback,sampled.rgb,loaded);
        color*=mix(vec3(1.0),vec3(1.06,0.86,0.69),warmth);
        gl_FragColor=vec4(color,1.0);
        #include <colorspace_fragment>
      }`,
    toneMapped:false,
  });
  const mesh=kit.mesh(scene,new T.PlaneGeometry(opening.width,opening.height),material,0,opening.y,opening.z);
  mesh.castShadow=false;mesh.receiveShadow=false;
  const videoTexture=new T.VideoTexture(video);videoTexture.colorSpace=T.SRGBColorSpace;
  function select(view:WindowView){
    currentView=view;const ticket=++generation;playback?.dispose();playback=null;if(texture){kit.textures.delete(texture);texture.dispose();}videoReady=false;
    material.uniforms.landscape.value=null;material.uniforms.loaded.value=0;material.uniforms.videoSource.value=0;
    material.uniforms.fallbackLow.value.set(view.fallbackLow);material.uniforms.fallbackHigh.value.set(view.fallbackHigh);onStatus('loading');
    material.uniforms.viewCenter.value.set(...view.center);material.uniforms.viewSize.value.set(...view.size);
    texture=new T.TextureLoader().load(view.url,loaded=>{
      if(disposed||ticket!==generation){loaded.dispose();return;}
      if(!videoReady){material.uniforms.landscape.value=loaded;material.uniforms.loaded.value=1;onStatus('ready');}
    },undefined,()=>{if(!disposed&&ticket===generation&&!videoReady)onStatus('fallback');});
    texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;kit.textures.add(texture);
    if(view.id==='forest'){onPlayback('paused');return;}
    playback=createSeaPlayback(video,()=>{
      if(disposed||ticket!==generation)return;videoReady=true;material.uniforms.landscape.value=videoTexture;material.uniforms.videoSource.value=1;material.uniforms.loaded.value=1;onStatus('ready');
    },status=>{
      if(disposed||ticket!==generation)return;
      if(status==='fallback'){videoReady=false;material.uniforms.videoSource.value=0;if(texture?.image){material.uniforms.landscape.value=texture;material.uniforms.loaded.value=1;}}
      onPlayback(status);
    },view);playback.active(active);playback.motion(wanted);
  }
  select(initialView);
  return {
    select,
    motion(on:boolean){wanted=on;playback?.motion(on&&currentView.id!=='forest');},
    active(on:boolean){active=on;playback?.active(on);},
    lighting(warm:boolean){material.uniforms.warmth.value=warm?1:0;},
    interior(enabled:boolean){material.uniforms.perspective.value=enabled?1:0;},
    dispose(){disposed=true;playback?.dispose();videoTexture.dispose();material.dispose();},
  };
}
