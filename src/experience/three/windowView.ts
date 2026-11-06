import seaUrl from '../../assets/environments/pantry-sea-v1.jpg';
import seaMp4 from '../../assets/environments/pantry-sea-loop.mp4';
import seaWebm from '../../assets/environments/pantry-sea-loop.webm';
import forestUrl from '../../assets/environments/pantry-forest-v1.jpg';
import forestMp4 from '../../assets/environments/pantry-forest-loop.mp4';
import forestWebm from '../../assets/environments/pantry-forest-loop.webm';
import fireUrl from '../../assets/environments/pantry-fire-v1.jpg';
import fireMp4 from '../../assets/environments/pantry-fire-loop.mp4';
import fireWebm from '../../assets/environments/pantry-fire-loop.webm';
import type {LandscapeId} from '../../../shared/room-media.mjs';

// Keep the view's image, framing and accessible description together. A future
// forest or sky asset can change here without touching the room or its gameplay.
export const windowView={
  id:'sea',
  url:seaUrl,
  mp4:seaMp4,
  webm:seaWebm,
  description:'푸른 바다와 먼 섬, 넓은 하늘이 보이는 창가의 입체 탕비실.',
  center:[0,1.9] as const,
  size:[22,11] as const,
  fallbackLow:'#438fae',
  fallbackHigh:'#bdddf4',
};
export type WindowView=Omit<typeof windowView,'id'|'center'|'size'>&{id:LandscapeId;center:readonly [number,number];size:readonly [number,number]};
export const windowViews:Record<LandscapeId,WindowView>={
  sea:{...windowView,id:'sea'},
  forest:{...windowView,id:'forest',url:forestUrl,mp4:forestMp4,webm:forestWebm,description:'초록 숲과 이끼 낀 나무가 보이는 창가.',fallbackLow:'#324b35',fallbackHigh:'#a8bca8'},
  fire:{...windowView,id:'fire',url:fireUrl,mp4:fireMp4,webm:fireWebm,center:[0,2.4],size:[14,7],description:'저녁의 모닥불을 바라보는 창가.',fallbackLow:'#211d16',fallbackHigh:'#0d100d'},
};
