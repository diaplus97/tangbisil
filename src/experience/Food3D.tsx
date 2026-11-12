import {passPointerToRoom} from './stagePointer';
import {useEffect,useRef} from 'react';
import * as T from 'three';
import {Workshop,makeRenderer,consolidate} from './three/assets';
import {snackFood,snackPackaging,recipe,type FoodIdentity} from './three/snackModels';
import {snackBiteSound,stopSnackSound} from './sound';

type Props={food:FoodIdentity;progress:number;bites:number;empty:boolean;sample:boolean;crunch:number;label:string;onUnavailable:()=>void};
export default function Food3D(props:Props){
 const canvas=useRef<HTMLCanvasElement>(null),latest=useRef(props),update=useRef<(()=>void)|null>(null);latest.current=props;
 useEffect(()=>{update.current?.();},[props.progress,props.bites,props.empty,props.sample,props.crunch]);
 useEffect(()=>{
  let renderer:T.WebGLRenderer;try{renderer=makeRenderer(canvas.current!);}catch{latest.current.onUnavailable();return;}
  renderer.toneMapping=T.NeutralToneMapping;renderer.toneMappingExposure=1.05;
  const kit=new Workshop(),scene=new T.Scene(),camera=new T.OrthographicCamera(-1.9,1.9,1.25,-1.25,.1,30);camera.position.set(.7,3.3,5.8);camera.lookAt(0,.70,0);
  scene.add(new T.HemisphereLight('#fff9ed','#b4c5c0',1.5));const sun=new T.DirectionalLight('#fff2df',2.1);sun.position.set(-3,6,4);sun.castShadow=true;sun.shadow.mapSize.set(512,512);Object.assign(sun.shadow.camera,{left:-3,right:3,top:3,bottom:-3,near:.1,far:15});sun.shadow.bias=-.001;sun.shadow.normalBias=.015;scene.add(sun);
  const fill=new T.DirectionalLight('#e6eff5',.75);fill.position.set(3,2,-1);scene.add(fill);
  const plate=new T.Group();scene.add(plate);plate.scale.z=.84;kit.cylinder(plate,1.22,1.15,.08,0,.04,0,'#eee9dc');kit.cylinder(plate,1.12,1.12,.012,0,.087,0,'#e2e7da');const rim=kit.mesh(plate,new T.TorusGeometry(1.18,.032,8,56),kit.mat('#ece8da'),0,.09,0);rim.rotation.x=Math.PI/2;
  const wrap=snackPackaging(kit,scene,latest.current.food);wrap.group.position.y=.11;
  const lift=new T.Group();scene.add(lift);lift.position.y=.13;
  let food:T.Group|null=null,key='',frame=0,seenCrunch=0,biteStart=-Infinity,sounded=false;
  // A quiet hand follows the food, with curled fingers rather than a floating prop.
  const hand=new T.Group();lift.add(hand);hand.position.set(.4,.03,.42);hand.rotation.set(.05,0,-.3);
  kit.sphere(hand,.19,.02,0,0,'#dfb798',1.05,.48,1.35);for(let i=0;i<4;i++){const finger=kit.mesh(hand,new T.CapsuleGeometry(.038,.20,4,8),kit.mat('#dfb798'),-.12+i*.07,.015,-.14);finger.rotation.x=1.25;}const thumb=kit.mesh(hand,new T.CapsuleGeometry(.05,.17,4,8),kit.mat('#dfb798'),-.20,.06,.01);thumb.rotation.z=-.8;kit.cylinder(hand,.12,.14,.42,.07,-.10,.27,'#c4d6cf').rotation.x=1.25;hand.visible=false;
  function render(){
   const p=latest.current,r=recipe(p.food);let reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;try{reduced||=localStorage.getItem('tangbisil:reduce-motion')==='on';}catch{}
   if(p.crunch&&p.crunch!==seenCrunch){seenCrunch=p.crunch;biteStart=performance.now();sounded=false;}
   const age=performance.now()-biteStart,animating=!reduced&&age<1450,contact=age>=460;
   const bites=animating&&!contact?Math.max(0,p.bites-1):p.bites,empty=p.empty&&(!animating||contact),next=`${bites}/${empty}/${p.sample}`;
   if(key!==next){if(food)kit.release(food);food=snackFood(kit,lift,{...p.food,state:empty?'empty':'open',bites,portions:p.sample?1:3});consolidate(food,kit);key=next;}
   wrap.update(p.progress);wrap.group.visible=!p.sample;
   const up=animating?T.MathUtils.smoothstep(Math.min(age/410,(1450-age)/600),0,1):0;
   lift.position.set(up*.24,.13+up*.65,up*.62);lift.rotation.set(-up*.28,up*.13,-up*.07);
   if(food){const soft=r.kind==='fruitMochi'||r.kind==='dubaiCookie'||r.kind==='layeredMochi',press=soft&&animating?Math.sin(T.MathUtils.clamp((age-300)/350,0,1)*Math.PI)*.055:0;food.scale.set(1+press,.999-press,1+press*.3);}
   hand.visible=animating&&up>.03;
   if(!sounded&&seenCrunch&&(contact||reduced)){sounded=true;snackBiteSound(r.kind);}
   renderer.render(scene,camera);canvas.current!.dataset.drawCalls=String(renderer.info.render.calls);canvas.current!.dataset.triangles=String(renderer.info.render.triangles);
   if(animating)frame=requestAnimationFrame(render);
  }
  const sync=()=>{cancelAnimationFrame(frame);render();};update.current=sync;
  const element=canvas.current!,resize=()=>{const parent=element.parentElement!,width=parent.clientWidth,aspect=1.6;camera.left=-1.85;camera.right=1.85;camera.top=1.85/aspect;camera.bottom=-1.85/aspect;camera.updateProjectionMatrix();renderer.setSize(width,width/aspect,false);sync();};
  const observer=new ResizeObserver(resize);observer.observe(element.parentElement!);const lost=(e:Event)=>{e.preventDefault();latest.current.onUnavailable();};element.addEventListener('webglcontextlost',lost);
  const ray=new T.Raycaster(),down=(event:PointerEvent)=>{const rect=element.getBoundingClientRect();ray.setFromCamera(new T.Vector2((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2),camera);if(!ray.intersectObjects(scene.children,true).some(h=>{for(let o:T.Object3D|null=h.object;o;o=o.parent)if(!o.visible)return false;return true;}))passPointerToRoom(event,element);};element.addEventListener('pointerdown',down);
  resize();element.dataset.ready='true';
  return()=>{cancelAnimationFrame(frame);stopSnackSound();element.removeEventListener('pointerdown',down);element.removeEventListener('webglcontextlost',lost);observer.disconnect();update.current=null;kit.dispose();renderer.dispose();renderer.forceContextLoss();};
 },[]);
 return <canvas ref={canvas} width="640" height="400" className="food-three-canvas" aria-label={props.label}/>;
}
