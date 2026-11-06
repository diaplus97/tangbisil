import {useEffect,useRef,useState,type ReactNode} from 'react';
import type {LandscapeId} from '../../shared/room-media.mjs';
import * as T from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {makeRenderer} from './three/assets';
import {anchors,createRoomScene} from './three/roomScene';
import {isWalkable,getSpace,seatedView,stations as pantryStations,type Area,type StationId} from '../../shared/space.mjs';
import type {SeaPlaybackStatus} from './three/seaPlayback';
import type {LandscapeStatus} from './three/environment';
import {windowViews} from './three/windowView';
import {tableCenter} from './three/layout';
import {createExploreCamera} from './three/exploreCamera';
import {createFirstPersonCamera,type Eye} from './three/firstPersonCamera';
import {useInputMethod} from './useInputMethod';
import {directAction} from './directActions';
import {heldName} from '../../shared/rest.mjs';
import ExploreDestinations from './ExploreDestinations';
import type {Snapshot} from './types';

type Props={onUse:(target:string)=>Promise<unknown>;contextContent?:ReactNode;landscapeId:LandscapeId;tvOpen:boolean;windowContent?:ReactNode;onTv?:()=>void;onTravel:(to:Area)=>Promise<unknown>;onToolsMount:(element:HTMLDivElement|null)=>void;onApproach:(station:StationId)=>Promise<unknown>;seaMotion:boolean;waves:boolean;onWaves:()=>void;state:Snapshot|null;debug:boolean;movementMode:boolean;foodInHand:boolean;onFinishMove:()=>void;sampleAvailable:boolean;sampleLabel:string;onShelf:()=>void;onPlate:()=>void;onDrink:()=>void;disabled:boolean;onFallback:()=>void;onMove:(x:number,z:number)=>Promise<unknown>;onSit:(seat:number)=>Promise<unknown>;onStand:()=>Promise<unknown>};
type Study='diorama'|'inside'|'table'|'lounge'|'map'|'third';
type Framing=Study|'seated'|'walking'|'activity';
const frames:Record<Study,string>={inside:'입구 시점',table:'테이블 시점',lounge:'창가 자리',diorama:'전체 배치',map:'개발용 평면',third:'이전 3인칭'};
export default function Room3D({onUse,contextContent,landscapeId,tvOpen,windowContent,onTv,onTravel,onToolsMount,onApproach,seaMotion,waves,onWaves,state,debug,movementMode,foodInHand,onFinishMove,sampleAvailable,sampleLabel,onShelf,onPlate,onDrink,disabled,onFallback,onMove,onSit,onStand}:Props){
  const input=useInputMethod();
  useEffect(()=>onToolsMount(null),[onToolsMount]);
  const area=state?.room.area??'pantry',map=getSpace(area),seats=map.seats,stations=map.stations as typeof pantryStations;
  const portal=map.portal;
  const seaVideo=useRef<HTMLVideoElement>(null),canvas=useRef<HTMLCanvasElement>(null),container=useRef<HTMLDivElement>(null);
  const latest=useRef(state),world=useRef<ReturnType<typeof createRoomScene>|null>(null),labels=useRef(new Map<string,HTMLElement>());
  const [playback,setPlayback]=useState<SeaPlaybackStatus>('paused'),[landscape,setLandscape]=useState<LandscapeStatus>('loading');
  const [error,setError]=useState(''),[ready,setReady]=useState(false),[warm,setWarm]=useState(false),[hovered,setHovered]=useState<string|null>(null);
  const [study,setStudy]=useState<Study>(()=>{const value=new URLSearchParams(location.search).get('camera');return value&&value in frames?value as Study:'inside';});
  const [arrived,setArrived]=useState(''),[walkHint,setWalkHint]=useState(''),[showHint,setShowHint]=useState(()=>{try{return !sessionStorage.getItem('pantry:direct-hint');}catch{return true;}});
  const context=useRef<HTMLDivElement>(null);
  function dismissHint(){setShowHint(false);try{sessionStorage.setItem('pantry:direct-hint','1');}catch{}}
  const [target,setTarget]=useState<number|null>(null),[objectTarget,setObjectTarget]=useState<StationId|null>(null);
  const requesting=useRef(false),origin=useRef<number|null>(null);
  const me=state?.room.members.find(m=>m.id===state.self.id),seat=me?.seat??0;
  const moving=Boolean(me?.travel||me?.motion&&me.motion.id!==arrived&&state&&me.motion.endsAt>state.serverTime);
  const framing:Framing=debug?study:moving||me&&me.seat==null&&!me.station?'walking':me?.station?'activity':'seated';
  const framingRef=useRef(framing),foodRef=useRef(foodInHand),seaMotionRef=useRef(seaMotion);
  latest.current=state;framingRef.current=framing;foodRef.current=foodInHand||tvOpen;seaMotionRef.current=seaMotion;
  const cameraUpdate=useRef<((f:Framing)=>void)|null>(null),lookAtSea=useRef<(()=>void)|null>(null);
  const originOwner=state?.room.members.find(m=>m.seat===origin.current&&m.id!==state.self.id);
  function rememberSeat(){if(!moving&&me?.seat!=null)origin.current=me.seat;}
  async function stand(){rememberSeat();return onStand();}
  async function chooseSeat(index:number){
    if(disabled||requesting.current)return;
    rememberSeat();requesting.current=true;
    try{if(await onSit(index)){setTarget(index);setObjectTarget(null);setWalkHint('');onFinishMove();}}finally{requesting.current=false;}
  }
  async function chooseObject(id:StationId){
    if(disabled||requesting.current)return;
    if(!moving&&me?.station===id){await onUse(id);return;}
    rememberSeat();requesting.current=true;
    try{if(await onApproach(id)){setObjectTarget(id);setTarget(null);setWalkHint('');onFinishMove();}}finally{requesting.current=false;}
  }
  async function choosePortal(){if(disabled||requesting.current)return;requesting.current=true;try{if(await onTravel(portal.to)){setTarget(null);setObjectTarget(null);onFinishMove();}}finally{requesting.current=false;}}
  async function walkTo(x:number,z:number){if(disabled||requesting.current)return;rememberSeat();dismissHint();if(await onMove(x,z)){setTarget(null);setObjectTarget(null);setWalkHint('');onFinishMove();}}
  const actions=useRef({onMove:walkTo,chooseSeat,chooseObject,choosePortal,onUse,onStand:stand,tvOpen,disabled,debug});
  actions.current={onMove:walkTo,chooseSeat,chooseObject,choosePortal,onUse,onStand:stand,tvOpen,disabled,debug};
  useEffect(()=>{
    if(!me?.motion||!state)return;
    const timer=setTimeout(()=>setArrived(me.motion!.id),Math.max(0,me.motion.endsAt-state.serverTime)+40);return()=>clearTimeout(timer);
  },[me?.motion?.id,state?.serverTime]);
  useEffect(()=>{if(!moving){setTarget(null);setObjectTarget(null);}},[moving]);
  useEffect(()=>{world.current?.sync(state);},[state]);
  useEffect(()=>{origin.current=null;setTarget(null);setObjectTarget(null);setWalkHint('');},[area]);
  useEffect(()=>{world.current?.lighting(warm||landscapeId==='fire');},[warm,landscapeId]);
  useEffect(()=>{world.current?.landscape(windowViews[landscapeId]);},[landscapeId]);
  useEffect(()=>{if(tvOpen)lookAtSea.current?.();},[tvOpen]);
  useEffect(()=>{world.current?.seaMotion(seaMotion);},[seaMotion]);
  useEffect(()=>{setHovered(null);cameraUpdate.current?.(framing);},[framing,seat,me?.station,me?.motion?.id,state?.self.id]);
  useEffect(()=>{
    let renderer:T.WebGLRenderer;
    try{renderer=makeRenderer(canvas.current!);}catch{setError('이 브라우저에서 3D 화면을 열지 못했어요.');return;}
    renderer.toneMapping=T.NeutralToneMapping;renderer.toneMappingExposure=1;renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));
    const room=createRoomScene(setLandscape,seaVideo.current!,setPlayback,area,windowViews[landscapeId]);world.current=room;room.sync(latest.current);room.seaMotion(seaMotionRef.current);room.lighting(landscapeId==='fire');
    const studio=new RoomEnvironment(),pmrem=new T.PMREMGenerator(renderer),reflection=pmrem.fromScene(studio,.04);
    room.scene.environment=reflection.texture;room.scene.environmentIntensity=.35;studio.dispose();pmrem.dispose();
    let camera:T.OrthographicCamera|T.PerspectiveCamera,first:ReturnType<typeof createFirstPersonCamera>|null=null,third:ReturnType<typeof createExploreCamera>|null=null;
    renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
    let labelTime=0,shadowTime=0,shadowState:Snapshot|null=null;
    let previousFraming:Framing|undefined,previousMotion:string|undefined,previousSeat:number|null|undefined,previousOwner:string|undefined,raf=0,last=0,visible=true;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isPersonal=(f:Framing)=>f==='seated'||f==='walking'||f==='activity';
    function eyeFor(f:Framing):Eye{
      const current=latest.current,m=current?.room.members.find(m=>m.id===current.self.id),p=m?room.pose(m.id):null;
      if(f==='activity'&&m?.station){const station=stations[m.station],fridge=m.station==='fridge',closeTea=m.station==='tea'&&matchMedia('(max-width:650px)').matches;return{x:station.x-Math.sin(station.yaw)*(fridge?2.45:m.station==='tea'?(closeTea?.9:1.3):1.65),y:m.station==='tea'?1.95:1.75,z:station.z-Math.cos(station.yaw)*(fridge?2.45:m.station==='tea'?(closeTea?.9:1.3):1.65),yaw:station.yaw,pitch:m.station==='sand'?-.3:fridge?-.24:m.station==='stone'?-.42:m.station==='tea'?(closeTea?-.48:-.36):m.station==='plant'?-.28:-.15};}
      if(f==='walking'&&p)return{x:p.x,y:T.MathUtils.lerp(1.78,area==='healing'?(m?.seat!=null&&m.seat<4?1.27:1.48):1.623,p.sit),z:p.z,yaw:p.yaw,pitch:-.06};
      const seat=m?.seat??0,seated=seatedView(seat,area);
      return{...seated,yaw:area==='healing'?Math.PI:seated.yaw,pitch:matchMedia('(max-width:650px)').matches?-.23:-.12};
    }
    function positionLabels(){
      const points:Record<string,T.Vector3>={...anchors},width=container.current!.clientWidth,height=container.current!.clientHeight;
      const snack=room.snackPosition();if(snack)points['my-snack']=snack;
      for(const m of latest.current?.room.members??[]){const point=room.labelPosition(m.id);if(point)points[m.id]=point;}
      const occupied:{x:number;y:number;w:number;h:number}[]=[];
      const root=container.current!.getBoundingClientRect(),toolbarRects=[...container.current!.querySelectorAll<HTMLElement>('.scene-toolbar>*,.direct-hint,.room-assist,.object-context')].filter(e=>getComputedStyle(e).visibility!=='hidden').map(e=>{const a=e.getBoundingClientRect();return{x:a.left-root.left,y:a.top-root.top,w:a.width,h:a.height};}).filter(a=>a.w>0&&a.h>0);
      const m=latest.current?.room.members.find(m=>m.id===latest.current?.self.id),station=m?.station&&stations[m.station];
      if(context.current&&station){const point=new T.Vector3(station.x,station.y,station.z).project(camera);const cw=context.current.offsetWidth;context.current.style.setProperty('--context-x',Math.max(12,Math.min(width-cw-12,(point.x+1)*width/2-cw/2))+'px');context.current.style.setProperty('--context-y',Math.max(80,Math.min(height-125,(1-point.y)*height/2+55))+'px');context.current.style.visibility=point.z>-1&&point.z<1&&Math.abs(point.x)<1.15&&Math.abs(point.y)<1.15?'visible':'hidden';}else if(context.current)context.current.style.visibility='visible';
      const right=new T.Vector3().setFromMatrixColumn(camera.matrixWorld,0),entries=[...labels.current].filter(([id])=>points[id]).sort(([a],[b])=>camera.position.distanceToSquared(points[a])-camera.position.distanceToSquared(points[b]));
      const bodies:{x:number;y:number;w:number;h:number;distance:number}[]=[];
      for(const [id,el]of entries){
        const point=points[id],p=point.clone().project(camera),w=el.offsetWidth,h=el.offsetHeight,distance=camera.position.distanceToSquared(point);
        const rawX=(p.x+1)*width/2-w/2,rawY=(1-p.y)*height/2-h-8,x=id==='my-snack'?Math.max(10,Math.min(width-w-10,rawX)):rawX,y=rawY,rect={x,y,w,h};
        const intersects=(a:{x:number;y:number;w:number;h:number})=>x<a.x+a.w+8&&x+w>a.x-8&&y<a.y+a.h+6&&y+h>a.y-6;
        const overlap=occupied.some(intersects)||bodies.some(b=>b.distance<distance*.88&&intersects(b));
        const toolbar=toolbarRects.some(intersects);
        const show=p.z> -1&&p.z<1&&(id!=='my-snack'||Math.abs(p.x)<1)&&x>=10&&x+w<=width-10&&y>=110&&y+h<=height-12&&!overlap&&!toolbar;
        if(id==='my-snack')el.style.setProperty('--pointer-x',Math.max(16,Math.min(w-28,(p.x+1)*width/2-x-7))+'px');
        el.style.visibility=show?'visible':'hidden';el.style.left=x+'px';el.style.top=y+'px';
        if(show)occupied.push(rect);
        if(p.z>-1&&p.z<1&&id!=='my-snack'&&id!=='plate'){
          const edge=point.clone().addScaledVector(right,.34).project(camera),bottom=point.clone().add(new T.Vector3(0,-1.2,0)).project(camera),half=Math.abs(edge.x-p.x)*width/2;
          bodies.push({x:(p.x+1)*width/2-half,y,w:half*2,h:Math.max(h,(p.y-bottom.y)*height/2+h),distance});
        }
      }
    }
    function resize(){
      const {width,height}=container.current!.getBoundingClientRect();if(!width||!height||!camera)return;
      container.current!.closest<HTMLElement>('.game-space')?.style.setProperty('--rendered-scene-height',height+'px');
      const aspect=width/height,f=framingRef.current;
      if(first&&isPersonal(f))first.resize(aspect);
      else if(third&&f==='third')third.resize(aspect);
      else if(camera instanceof T.OrthographicCamera){const half=Math.max(f==='map'?6.3:6.2,(f==='map'?8.9:11.5)/aspect);Object.assign(camera,{left:-half*aspect,right:half*aspect,top:half,bottom:-half});}
      else{const vertical=2*Math.atan(Math.tan(T.MathUtils.degToRad(30))*Math.max(1,1.8/aspect));camera.aspect=aspect;camera.fov=Math.min(92,T.MathUtils.radToDeg(vertical));}
      camera.updateProjectionMatrix();camera.updateMatrixWorld();renderer.setSize(width,height,false);positionLabels();renderer.render(room.scene,camera);
    }
    function setCamera(f:Framing){
      const current=latest.current,m=current?.room.members.find(m=>m.id===current.self.id),personal=isPersonal(f);
      if(personal){
        // The welcome camera has no owner. Adopt the assigned seat immediately;
        // interpolating from seat 0 crosses the table and clips the first snack.
        const eye=eyeFor(f),fresh=!first||current?.self.id!==previousOwner;if(fresh)first=createFirstPersonCamera(eye);camera=first!.camera;first!.anchor(eye);
        if(m?.motion?.id!==previousMotion)first!.beginMove();
        if(f!==previousFraming||m?.motion?.id!==previousMotion||m?.seat!==previousSeat){
          if(f==='walking'&&m?.motion){const destination=m.motion.points.at(-1)!,pose=room.pose(m.id);if(pose&&Math.hypot(destination.x-pose.x,destination.z-pose.z)>.05)first!.frame(Math.atan2(destination.x-pose.x,destination.z-pose.z),-.06);}
          else first!.frame(eye.yaw,eye.pitch);
        }
        if(fresh||reduced)first!.update(1,true);
      }else{
        first=null;third=null;
        if(f==='map'||f==='diorama'){camera=new T.OrthographicCamera(-9,9,7,-7,.1,70);camera.position.set(...(f==='map'?[3,16,13]:[10,10,14]) as [number,number,number]);camera.lookAt(0,f==='map'?.6:1.3,.4);}
        else if(f==='third'){third=createExploreCamera(m?room.pose(m.id)??{x:0,z:2}:{x:0,z:2});camera=third.camera;}
        else{camera=new T.PerspectiveCamera(60,1,.05,70);if(f==='inside'){camera.position.set(0,2,6.6);camera.lookAt(0,1.6,-4.4);}else if(f==='lounge'){camera.position.set(4.85,1.65,.2);camera.lookAt(3.1,1.05,-3.45);}else{camera.position.set(tableCenter.x,1.95,tableCenter.z+2.75);camera.lookAt(tableCenter.x,1.4,tableCenter.z-1.45);}}
      }
      previousFraming=f;previousMotion=m?.motion?.id;previousSeat=m?.seat;previousOwner=current?.self.id;
      room.interior(f!=='diorama'&&f!=='map'&&f!=='third',f!=='diorama'&&f!=='map');
      room.firstPerson(personal?current?.self.id??null:null,foodRef.current);room.reveal(camera,null,true);room.tick(performance.now(),current,reduced);
      Object.assign(container.current!.dataset,{perspective:f,firstPerson:String(personal),cameraSeat:String(m?.seat??0),area});
      resize();
    }
    cameraUpdate.current=setCamera;lookAtSea.current=()=>{first?.aim(Math.PI,-.02);if(reduced)first?.update(1,true);};setCamera(framingRef.current);
    const element=canvas.current!,raycaster=new T.Raycaster(),floor=new T.Plane(new T.Vector3(0,1,0),.025);
    let down:{x:number;y:number;lastX:number;lastY:number;id:number;dragged:boolean}|null=null;
    let lastWalk=0;
    const visibleObject=(o:T.Object3D):boolean=>o.visible&&(!o.parent||visibleObject(o.parent));
    function hitAt(x:number,y:number){const rect=element.getBoundingClientRect();raycaster.setFromCamera(new T.Vector2((x-rect.left)/rect.width*2-1,1-(y-rect.top)/rect.height*2),camera);const hits=raycaster.intersectObjects([...room.interactionTargets(),...room.portalTargets,...room.objectTargets.filter(o=>!(o.userData.station==='fridge'&&latest.current?.room.members.find(m=>m.id===latest.current?.self.id)?.station==='fridge')),...room.seatTargets],true);for(const hit of hits){if(!visibleObject(hit.object))continue;let o:T.Object3D|null=hit.object;while(o&&!o.userData.action&&!o.userData.station&&!o.userData.portal&&o.userData.seat==null)o=o.parent;if(o)return{...hit,object:o};}return undefined;}
    const pointerDown=(e:PointerEvent)=>{if(e.button!==0||!e.isPrimary)return;element.focus({preventScroll:true});down={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,id:e.pointerId,dragged:false};element.setPointerCapture(e.pointerId);};
    const pointerCancel=()=>{down=null;element.style.cursor='';};
    const pointerMove=(e:PointerEvent)=>{
      const d=down;
      if(d&&d.id===e.pointerId){
        if(Math.hypot(e.clientX-d.x,e.clientY-d.y)>5)d.dragged=true;
        if(d.dragged&&first){const rect=element.getBoundingClientRect();first.drag(e.clientX-d.lastX,e.clientY-d.lastY,rect.width,rect.height);setHovered(null);element.style.cursor='grabbing';}
        d.lastX=e.clientX;d.lastY=e.clientY;return;
      }
      if(e.pointerType==='touch')return;
      const hit=hitAt(e.clientX,e.clientY),data=hit?.object.userData;
      setHovered(data?.action?'action-'+data.action:data?.portal?'portal':data?.station?'station-'+data.station:data?.seat!=null?'seat-'+data.seat:null);element.style.cursor=hit?'pointer':'grab';
    };
    const pointerUp=(e:PointerEvent)=>{
      const start=down;down=null;element.style.cursor='grab';
      if(element.hasPointerCapture(e.pointerId))element.releasePointerCapture(e.pointerId);
      if(!start||start.id!==e.pointerId||start.dragged||actions.current.disabled)return;
      const hit=hitAt(e.clientX,e.clientY);
      if(hit?.object.userData.action){dismissHint();const data=hit.object.userData,m=latest.current?.room.members.find(m=>m.id===latest.current?.self.id);if(data.station&&(m?.station!==data.station||m&&room.pose(m.id)?.moving))void actions.current.chooseObject(data.station);else void actions.current.onUse(data.action);return;}
      if(hit?.object.userData.portal){void actions.current.choosePortal();return;}
      if(hit?.object.userData.station){void actions.current.chooseObject(hit.object.userData.station);return;}
      if(hit?.object.userData.seat!=null){const index=hit.object.userData.seat;
        if(latest.current?.room.members.some(m=>m.seat===index)){setWalkHint('이미 누군가 앉아 있는 자리예요.');return;}
        void actions.current.chooseSeat(index);return;
      }
      // Only an un-dragged tap on a reachable floor point starts walking.
      const p=raycaster.ray.intersectPlane(floor,new T.Vector3());
      if(p&&raycaster.ray.direction.y<-.025&&isWalkable(p,area)){
        const surface=raycaster.intersectObjects(room.scene.children,true).find(h=>{if(!visibleObject(h.object)||!(h.object instanceof T.Mesh))return false;const material=Array.isArray(h.object.material)?h.object.material[h.face?.materialIndex??0]:h.object.material;return material?.visible;});
        if(surface&&Math.abs(surface.point.y+.025)<.06)void actions.current.onMove(p.x,p.z);
      }
    };
    const pointerLeave=()=>{if(!down){setHovered(null);element.style.cursor='';}};
    const keyDown=(e:KeyboardEvent)=>{
      if(!first||e.ctrlKey||e.metaKey||e.altKey)return;
      const delta:Record<string,[number,number]>={ArrowLeft:[.12,0],ArrowRight:[-.12,0],ArrowUp:[0,.08],ArrowDown:[0,-.08]};
      if(e.key==='Escape'){e.preventDefault();void actions.current.onStand();return;}
      const step:Record<string,[number,number]>={w:[0,1],s:[0,-1],a:[-1,0],d:[1,0]};
      if(step[e.key.toLowerCase()]&&!e.repeat&&!actions.current.disabled&&performance.now()-lastWalk>350){e.preventDefault();const current=latest.current,self=current?.self.id,pose=self?room.pose(self):null;if(pose){const [side,forward]=step[e.key.toLowerCase()],yaw=first.angles.yaw;for(const length of[1.8,1,.45]){const x=pose.x+(Math.sin(yaw)*forward-Math.cos(yaw)*side)*length,z=pose.z+(Math.cos(yaw)*forward+Math.sin(yaw)*side)*length;if(isWalkable({x,z},area)){lastWalk=performance.now();void actions.current.onMove(x,z);break;}}}return;}
      if(e.key==='Home'){e.preventDefault();first.aim(Math.PI,-.02);return;}
      if(delta[e.key]){e.preventDefault();first.turn(...delta[e.key]);}
    };
    element.addEventListener('pointerdown',pointerDown);element.addEventListener('pointermove',pointerMove);element.addEventListener('pointerup',pointerUp);element.addEventListener('pointercancel',pointerCancel);element.addEventListener('lostpointercapture',pointerCancel);element.addEventListener('pointerleave',pointerLeave);element.addEventListener('keydown',keyDown);
    const observer=new ResizeObserver(resize);observer.observe(container.current!);
    const intersection=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??true;});intersection.observe(container.current!);
    function frame(time:number){
      const active=visible&&!document.hidden&&!actions.current.tvOpen&&!document.querySelector('dialog[open]');room.active(active);
      if(active&&time-last>1000/30){
        const current=latest.current,self=current?.self.id,pose=self?room.pose(self):null,f=framingRef.current,dt=last?(time-last)/1000:1/30;
        if(first&&isPersonal(f)){first.anchor(eyeFor(f));first.update(dt,reduced);}
        if(third&&f==='third'&&pose)third.follow(pose,dt,reduced);
        room.firstPerson(isPersonal(f)?self??null:null,foodRef.current);room.tick(time,current,reduced);
        room.reveal(camera,f==='third'&&pose&&pose.sit<.5?pose:null,reduced);
        room.foreground(camera,current,isPersonal(f)&&f!=='walking'&&!foodRef.current,null);
        Object.assign(container.current!.dataset,{cameraX:camera.position.x.toFixed(4),cameraY:camera.position.y.toFixed(4),cameraZ:camera.position.z.toFixed(4),cameraFov:camera instanceof T.PerspectiveCamera?String(camera.fov):'ortho',cameraYaw:first?.angles.yaw.toFixed(4)??'',cameraPitch:first?.angles.pitch.toFixed(4)??'',actorX:pose?.x.toFixed(3)??'',actorZ:pose?.z.toFixed(3)??''});
        const now=room.now(),animated=current?.room.members.some(m=>m.motion&&m.motion.endsAt>now||now-m.actionAt<4500||m.pantry.coffee.stage==='brewing'||Boolean(m.pantry.rest.tea?.pourAt));
        if(shadowState!==current||animated&&time-shadowTime>100){renderer.shadowMap.needsUpdate=true;shadowState=current;shadowTime=time;}
        if(time-labelTime>120){positionLabels();labelTime=time;}renderer.render(room.scene,camera);last=time;
      }
      raf=requestAnimationFrame(frame);
    }
    const lost=(e:Event)=>{e.preventDefault();setError('3D 화면 연결이 끊겼어요. 도트 화면으로 이어갈 수 있어요.');};element.addEventListener('webglcontextlost',lost);
    resize();setReady(true);raf=requestAnimationFrame(frame);
    return()=>{cancelAnimationFrame(raf);observer.disconnect();intersection.disconnect();element.removeEventListener('webglcontextlost',lost);element.removeEventListener('pointerdown',pointerDown);element.removeEventListener('pointermove',pointerMove);element.removeEventListener('pointerup',pointerUp);element.removeEventListener('pointercancel',pointerCancel);element.removeEventListener('lostpointercapture',pointerCancel);element.removeEventListener('pointerleave',pointerLeave);element.removeEventListener('keydown',keyDown);room.dispose();reflection.dispose();renderer.dispose();renderer.forceContextLoss();world.current=null;cameraUpdate.current=null;lookAtSea.current=null;};
  },[area]);
  const ref=(key:string)=>(el:HTMLElement|null)=>{if(el)labels.current.set(key,el);else labels.current.delete(key);};
  const hoverStation=hovered?.startsWith('station-')?hovered.slice(8) as StationId:null,hoverSeat=hovered?.startsWith('seat-')?Number(hovered.slice(5)):null;
  const hoverOwner=state?.room.members.find(m=>m.id!==state.self.id&&(hoverStation?m.station===hoverStation:hoverSeat!=null&&m.seat===hoverSeat));
  const hoverText=hovered?.startsWith('action-')&&state?directAction(state,hovered.slice(7))?.label??'':hovered==='portal'?portal.name+(area==='healing'&&(state?.self.pantry.rest.sand?.held||state?.self.pantry.rest.vase?.held)?' · 내 휴식 도구는 여기에 보관돼요':' · 눌러서 이동'):hovered?(hoverStation?stations[hoverStation].name:`${(hoverSeat??0)+1}번 자리`)+(hoverOwner?' · 이용 중':(hoverStation===me?.station&&!moving?' · '+(state?directAction(state,hoverStation!)?.label??'천천히 기다려요':''):' · 눌러서 이동')):input==='touch'?'손가락으로 밀어 둘러보기':input==='keyboard'?'방향키로 둘러보기 · Home은 풍경':'드래그로 둘러보기';
  const destination=me?.travel?portal.name:objectTarget?stations[objectTarget].name:target!=null?`${target+1}번 자리`:null;
  const showFloorHint=showHint&&Boolean(me)&&me?.seat==null&&!me?.station&&!moving;
  return <>
    <div className={`room-frame room-three framing-${framing} ${warm?'late-light':''}`} ref={container}>
      <canvas ref={canvas} className="room-three-canvas" tabIndex={0} role="img" aria-label={input==='touch'?'내 눈높이의 휴식 공간. 손가락으로 밀어 둘러보고 사물을 톡 누르면 이동해요.':input==='keyboard'?'내 눈높이의 탕비실. 방향키로 둘러보고 Home으로 풍경을 봅니다.':'내 눈높이의 탕비실. 드래그로 둘러보고 사물을 누르면 이동합니다.'} data-ready={ready} data-landscape={landscape} data-playback={playback} data-view={landscapeId}/>
      <video ref={seaVideo} className="sea-video-source" muted playsInline preload="none" aria-hidden="true" tabIndex={-1}/>
      <div className="scene-toolbar"><div className="scene-label">{moving?(destination?destination+' · 이동 중':'이동 중'):me?.station?stations[me.station].name:map.name}{debug&&<span className="scene-label-sub">{frames[study]}</span>}</div><button className="sea-sound-toggle" aria-pressed={waves} onClick={onWaves}>{waves?'파도 소리 끄기':'파도 소리 켜기'}</button></div>
      {playback==='fallback'&&<span className="sea-playback-note" role="status">지금은 고요한 풍경으로 쉬어가요.</span>}
      {!ready&&!error&&<div className="three-message">창가의 빛을 들이는 중…</div>}
      {error?<div className="three-message" role="alert"><p>{error}</p><button className="primary" disabled={disabled} onClick={area==='healing'?()=>void choosePortal():onFallback}>{area==='healing'?'탕비실로 돌아가기':'도트로 이어가기'}</button></div>:<>
        {debug&&<><button ref={ref('shelf')} className="hotspot three-hotspot" onClick={onShelf} disabled={disabled}>오늘의 레몬파이</button><button ref={ref('drink')} className="hotspot three-hotspot" onClick={onDrink} disabled={disabled}>한 잔</button></>}
        {!debug&&state&&!tvOpen&&!foodInHand&&!moving&&me?.seat!=null&&area==='pantry'&&<button ref={ref('my-snack')} className="world-action snack-world-hint" disabled={disabled} onClick={onShelf}>{heldName(state.self.pantry)?heldName(state.self.pantry)+' 내려놓고 간식 집기':state.self.serving&&state.self.serving.state!=='empty'?'간식 집기':'간식을 눌러보세요'}</button>}
        {!debug&&sampleAvailable&&!tvOpen&&!foodInHand&&!moving&&area==='pantry'&&<button ref={ref('plate')} className="world-action shared-world-hint" disabled={disabled} aria-label={sampleLabel} onClick={onPlate}>한 조각 맛보기</button>}
        {state?.room.members.filter(m=>debug||m.id!==state.self.id).map(m=><div ref={ref(m.id)} key={m.id} className={`visitor-name three-name ${!m.connected?'reconnecting':''}`}><span className="presence-dot"/>{m.name}</div>)}
      </>}
      {onTv&&!tvOpen&&<button className="tv-entry" disabled={disabled||moving||me?.seat==null} onClick={onTv}>TV 함께 보기</button>}
      {!debug&&!tvOpen&&!foodInHand&&state&&!moving&&<div ref={context} className={'object-context'+(me?.station?' at-station':' held-context')} aria-label="가까이 있는 물건">
        {me?.station&&directAction(state,me.station)&&<button className="world-action" disabled={disabled} onClick={()=>void onUse(me.station!)}>{directAction(state,me.station)!.label}</button>}
        {me?.station==='coffee'&&state.self.pantry.coffee.stage==='brewing'&&<span className="world-status" role="status">커피 내리는 중…</span>}
        {!me?.station&&heldName(state.self.pantry)&&directAction(state,'held')&&<button className="world-action" disabled={disabled} onClick={()=>void onUse('held')}>{directAction(state,'held')!.label}</button>}
        {(me?.station||heldName(state.self.pantry)||state.self.pantry.rest.stone||state.self.pantry.rest.tea||state.self.pantry.rest.sand||state.self.pantry.rest.vase||state.self.pantry.candy&&state.self.pantry.candy.state!=='eaten'||state.self.pantry.bottle&&state.self.pantry.bottle.sips<3)&&<details className="object-options" onKeyDown={e=>{if(e.key==='Escape'){e.currentTarget.open=false;e.currentTarget.querySelector('summary')?.focus();e.stopPropagation();}}} onToggle={e=>{if(e.currentTarget.open)dismissHint();}}><summary aria-label="이 물건의 다른 행동">{me?.station||heldName(state.self.pantry)?'더보기':'내 물건'}</summary><div className="object-options-panel">{contextContent}</div></details>}
      </div>}
      {!debug&&!tvOpen&&!foodInHand&&<div className={'room-assist'+(me?.station?' at-object':'')}><button className="look-window" onClick={()=>lookAtSea.current?.()} aria-label="창밖 풍경 보기">풍경 보기</button>{moving&&<button disabled={disabled} onClick={()=>void stand()}>멈추기</button>}{!moving&&me?.station&&<button disabled={disabled} onClick={()=>{const index=origin.current!=null&&!originOwner?origin.current:seats.findIndex((_,i)=>!state?.room.members.some(m=>m.seat===i));if(index>=0)void chooseSeat(index);else void stand();}}>돌아가기</button>}{!moving&&me?.seat!=null&&<button disabled={disabled} onClick={()=>void stand()}>일어나기</button>}</div>}
      {!debug&&!tvOpen&&!foodInHand&&(showFloorHint||walkHint||hovered&&hovered!=='action-snack')&&<div className="direct-hint" role="status">{walkHint||hovered&&hoverText||'바닥을 누르면 걸어가요'}{showFloorHint&&!hovered&&<button aria-label="조작 안내 닫기" onClick={dismissHint}>×</button>}</div>}
      {windowContent}
      {debug&&<div className="camera-switch" role="group" aria-label="개발용 시점">{(Object.keys(frames) as Study[]).map(f=><button key={f} aria-pressed={study===f} onClick={()=>setStudy(f)}>{frames[f]}</button>)}</div>}
      {debug&&<button className="light-switch" onClick={()=>setWarm(v=>!v)}>조명 비교</button>}
    </div>
    <div className={"room-navigation"+(foodInHand?" food-navigation":"")}>{!debug&&<div className="look-controls"><p>{walkHint||hoverText}</p><button onClick={()=>lookAtSea.current?.()}>풍경 보기</button></div>}
    {state&&!foodInHand&&!tvOpen&&(debug||movementMode)&&<ExploreDestinations onTravel={choosePortal} state={state} disabled={disabled} showSeats={movementMode} onClose={onFinishMove} onSeat={chooseSeat} onObject={chooseObject} onSea={()=>lookAtSea.current?.()} waves={waves} onWaves={onWaves}/>}</div>
    {debug&&sampleAvailable&&!moving&&<button className="shared-sample-action secondary" onClick={onPlate} disabled={disabled}>{sampleLabel}</button>}
    {debug&&moving&&<div className="walk-actions" role="group" aria-label="이동 중"><button className="secondary" disabled={disabled} onClick={()=>{setTarget(null);setObjectTarget(null);void stand();}}>멈추기</button>{origin.current!=null&&!originOwner&&<button className="secondary" disabled={disabled} onClick={()=>void chooseSeat(origin.current!)}>원래 자리로</button>}</div>}
  </>;
}
