import * as T from 'three';
import {RectAreaLightUniformsLib} from 'three/addons/lights/RectAreaLightUniformsLib.js';
let initialized=false;

// Broad sources give fabric and timber a readable gradient instead of a white wash.
export function createLighting(scene:T.Scene){
  if(!initialized){RectAreaLightUniformsLib.init();initialized=true;}
  const ambient=new T.HemisphereLight('#dcebf4','#b1a28d',.75);scene.add(ambient);
  const sun=new T.DirectionalLight('#fff1d6',2.25);
  sun.position.set(-3.5,6,-7);sun.target.position.set(.5,0,2);scene.add(sun,sun.target);
  sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.radius=3;
  Object.assign(sun.shadow.camera,{left:-8,right:8,top:8,bottom:-8,near:.5,far:30});
  sun.shadow.bias=-.00015;sun.shadow.normalBias=.015;
  const window=new T.RectAreaLight('#e3f1ff',2.3,10.5,3.3);
  window.width=14;window.position.set(0,2.4,-5.83);window.lookAt(0,1.1,2);scene.add(window);
  const ceiling=new T.RectAreaLight('#fff1da',.85,6,5);
  ceiling.position.set(-.5,4.24,.5);ceiling.lookAt(-.5,0,.5);scene.add(ceiling);
  const bounce=new T.DirectionalLight('#fff7e8',.35);bounce.position.set(1,2.5,6);scene.add(bounce);
  return {setWarm(warm:boolean){
    ambient.intensity=warm?.48:.75;sun.color.set(warm?'#ffc28a':'#fff1d6');sun.intensity=warm?1.5:2.25;
    window.color.set(warm?'#ffe0b8':'#e3f1ff');window.intensity=warm?1.35:2.3;
    ceiling.intensity=warm?1.45:.85;bounce.intensity=warm?.25:.35;
  }};
}
