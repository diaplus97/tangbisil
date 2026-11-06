import seaUrl from '../../assets/environments/pantry-sea-v1.jpg';
import seaMp4 from '../../assets/environments/pantry-sea-loop.mp4';
import seaWebm from '../../assets/environments/pantry-sea-loop.webm';

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
