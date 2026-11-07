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
import {isVisibleInScene,selectionSurfaces,stationInArea} from './three/sceneInteraction';
import {createFollowCamera} from './three/followCamera';
import {createExploreCamera} from './three/exploreCamera';
import {createFirstPersonCamera,type Eye} from './three/firstPersonCamera';
import {createKeyboardWalk,keyboardVector,movementCodes,bearingChanged} from './keyboardWalk';
import {useInputMethod} from './useInputMethod';
import {directAction} from './directActions';
import {coffeePhase} from '../../shared/coffee.mjs';
import {tableDrink} from '../../shared/table-drink.mjs';
import {heldName} from '../../shared/rest.mjs';
import ExploreDestinations from './ExploreDestinations';
import type {Snapshot} from './types';

type Props={inputReady:()=>boolean;keyboardEnabled:boolean;onSteer:(direction:[number,number])=>Promise<unknown>;onExplore:()=>void;onUse:(target:string)=>Promise<unknown>;contextContent?:ReactNode;landscapeId:LandscapeId;tvOpen:boolean;windowContent?:ReactNode;onTv?:()=>void;onTravel:(to:Area)=>Promise<unknown>;onToolsMount:(element:HTMLDivElement|null)=>void;onApproach:(station:StationId)=>Promise<unknown>;seaMotion:boolean;waves:boolean;onWaves:()=>void;state:Snapshot|null;debug:boolean;movementMode:boolean;foodInHand:boolean;onFinishMove:()=>void;sampleAvailable:boolean;sampleLabel:string;onShelf:()=>void;onPlate:()=>void;onDrink:()=>void;disabled:boolean;onFallback:()=>void;onMove:(x:number,z:number)=>Promise<unknown>;onSit:(seat:number)=>Promise<unknown>;onStand:()=>Promise<unknown>};
type Study='diorama'|'inside'|'table'|'lounge'|'map'|'third';
type Framing=Study|'seated'|'walking'|'activity';
const frames:Record<Study,string>={inside:'입구 시점',table:'테이블 시점',lounge:'창가 자리',diorama:'전체 배치',map:'개발용 평면',third:'이전 3인칭'};
export default function Room3D({inputReady,keyboardEnabled,onSteer,onExplore,onUse,contextContent,landscapeId,tvOpen,windowContent,onTv,onTravel,onToolsMount,onApproach,seaMotion,waves,onWaves,state,debug,movementMode,foodInHand,onFinishMove,sampleAvailable,sampleLabel,onShelf,onPlate,onDrink,disabled,onFallback,onMove,onSit,onStand}:Props){
  const input=useInputMethod();
  const [intro,setIntro]=useState(false),[discovery,setDiscovery]=useState<StationId|null>(null),[arrival,setArrival]=useState(false);
  const cueFocus=useRef(false),beacon=useRef<HTMLSpanElement>(null),brewProgress=useRef<HTMLProgressElement>(null);
  const cueState=useRef({input,intro,hovered:null as string|null,discovery});
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
  const stopKeyboard=useRef<()=>Promise<void>>(async()=>{});
  const usingObject=useRef(false),usedAt=useRef(-Infinity),usedTarget=useRef('');
  async function useNearObject(id:string){if(disabled&&id!=='cup'||usingObject.current||usedTarget.current===id&&performance.now()-usedAt.current<380)return;usingObject.current=true;try{return await onUse(id);}finally{usedAt.current=performance.now();usedTarget.current=id;usingObject.current=false;}}
  const me=state?.room.members.find(m=>m.id===state.self.id),seat=me?.seat??0;
  const tabledDrink=me?.seat!=null&&state&&(tableDrink(state.self.pantry)==='tea'&&heldName(state.self.pantry)==='찻잔'||tableDrink(state.self.pantry)==='bottle'&&heldName(state.self.pantry)==='음료 병');
  useEffect(()=>{if(['tea-hold','bottle-hold'].includes(me?.action??''))container.current?.querySelectorAll<HTMLDetailsElement>('details[open]').forEach(d=>{d.open=false;});},[me?.actionAt]);
  const moving=Boolean(me?.travel||me?.motion&&me.motion.id!==arrived&&state&&me.motion.endsAt>state.serverTime);
  cueState.current={input,intro,hovered,discovery};
  useEffect(()=>{if(!state?.self.id)return;const key='pantry:first-action:'+state.self.id;try{if(sessionStorage.getItem(key))return;}catch{}setIntro(true);const timer=setTimeout(()=>{setIntro(false);try{sessionStorage.setItem(key,'1');}catch{}},6500);return()=>clearTimeout(timer);},[state?.self.id]);
  useEffect(()=>{setArrival(Boolean(me?.station&&!moving));if(!me?.station||moving)return;const timer=setTimeout(()=>setArrival(false),1800);return()=>clearTimeout(timer);},[me?.station,moving]);
  useEffect(()=>{if(!walkHint)return;const timer=setTimeout(()=>setWalkHint(''),3600);return()=>clearTimeout(timer);},[walkHint]);
  const framing:Framing=debug?study:moving||me&&me.seat==null&&!me.station?'walking':me?.station?'activity':'seated';
  const framingRef=useRef(framing),foodRef=useRef(foodInHand),seaMotionRef=useRef(seaMotion);
  latest.current=state;framingRef.current=framing;foodRef.current=tvOpen;seaMotionRef.current=seaMotion;
  const cameraUpdate=useRef<((f:Framing)=>void)|null>(null),lookAtSea=useRef<(()=>void)|null>(null);
  const originOwner=state?.room.members.find(m=>m.seat===origin.current&&m.id!==state.self.id);
  function rememberSeat(){if(!moving&&me?.seat!=null)origin.current=me.seat;}
  async function stand(){world.current?.destination.clear();rememberSeat();const brewing=state?.self.pantry.coffee.stage==='brewing';const result=await onStand();if(result){setTarget(null);setObjectTarget(null);setWalkHint(brewing?'추출을 멈추고 컵을 챙겼어요.':'');}return result;}
  async function returnToRest(){const index=origin.current!=null&&!originOwner?origin.current:seats.findIndex((_,i)=>!state?.room.members.some(m=>m.seat===i));if(index>=0){await chooseSeat(index);if(originOwner)setWalkHint('원래 자리에 동료가 있어 가까운 빈 자리로 가요.');}}
  async function chooseSeat(index:number){
    if(disabled||requesting.current)return;
    await stopKeyboard.current();rememberSeat();requesting.current=true;world.current?.destination.set(map.approaches[index],'pending');
    try{if(await onSit(index)){world.current?.destination.set(map.approaches[index],'moving');setTarget(index);setObjectTarget(null);setWalkHint('');onFinishMove();}else world.current?.destination.set(map.approaches[index],'blocked');}finally{requesting.current=false;}
  }
  async function chooseObject(id:StationId){
    if(!stationInArea(area,id)||disabled||requesting.current)return;
    if(!moving&&me?.station===id){await useNearObject(id);return;}
    await stopKeyboard.current();rememberSeat();requesting.current=true;world.current?.destination.set(stations[id].approach,'pending');
    try{if(await onApproach(id)){world.current?.destination.set(stations[id].approach,'moving');setObjectTarget(id);setTarget(null);setWalkHint('');onFinishMove();}else world.current?.destination.set(stations[id].approach,'blocked');}finally{requesting.current=false;}
  }
  async function choosePortal(){if(disabled||requesting.current)return;await stopKeyboard.current();requesting.current=true;try{if(await onTravel(portal.to)){setTarget(null);setObjectTarget(null);onFinishMove();}}finally{requesting.current=false;}}
  async function walkTo(x:number,z:number){if(disabled||requesting.current)return;await stopKeyboard.current();rememberSeat();dismissHint();const point={x,z};world.current?.destination.set(point,'pending');if(await onMove(x,z)){world.current?.destination.set(point,'moving');setTarget(null);setObjectTarget(null);setWalkHint('');onFinishMove();}else{world.current?.destination.set(point,'blocked');setWalkHint('그쪽으로는 지나갈 수 없어요. 다른 바닥을 골라 주세요.');}}
  const actions=useRef({onMove:walkTo,chooseSeat,chooseObject,choosePortal,onUse:useNearObject,onStand:stand,onSteer,keyboardEnabled,inputReady,tvOpen,disabled,debug});
  actions.current={onMove:walkTo,chooseSeat,chooseObject,choosePortal,onUse:useNearObject,onStand:stand,onSteer,keyboardEnabled,inputReady,tvOpen,disabled,debug};
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
    let follower:ReturnType<typeof createFollowCamera>|null=null;
    let camera:T.OrthographicCamera|T.PerspectiveCamera,first:ReturnType<typeof createFirstPersonCamera>|null=null,third:ReturnType<typeof createExploreCamera>|null=null;
    const raycaster=new T.Raycaster(),floor=new T.Plane(new T.Vector3(0,1,0),area==='healing'?-.008:.025);
    function visibleObject(o:T.Object3D):boolean{return isVisibleInScene(o,room.scene);}
    renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
    let labelTime=0,shadowTime=0,shadowState:Snapshot|null=null;
    const labelCamera=new T.Matrix4();let labelSnapshot:Snapshot|null=null,labelCue='';
    let previousFraming:Framing|undefined,previousMotion:string|undefined,previousSeat:number|null|undefined,previousOwner:string|undefined,raf=0,last=0,visible=true;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,frameInterval=1000/(matchMedia('(pointer:coarse)').matches?30:60);let nextFrame=0;
    const isPersonal=(f:Framing)=>f==='seated'||f==='walking'||f==='activity';
    function eyeFor(f:Framing):Eye{
      const current=latest.current,m=current?.room.members.find(m=>m.id===current.self.id),p=m?room.pose(m.id):null;
      if(f==='activity'&&m?.station){const station=stations[m.station],fridge=m.station==='fridge',closeTea=m.station==='tea'&&matchMedia('(max-width:650px)').matches;return{x:station.x-Math.sin(station.yaw)*(fridge?2.45:m.station==='coffee'?1.45:m.station==='tea'?(closeTea?.9:1.3):1.65),y:m.station==='coffee'?2.02:m.station==='tea'?1.95:1.75,z:station.z-Math.cos(station.yaw)*(fridge?2.45:m.station==='coffee'?1.45:m.station==='tea'?(closeTea?.9:1.3):1.65),yaw:station.yaw,pitch:m.station==='coffee'?-.31:m.station==='sand'?-.3:fridge?-.24:m.station==='stone'?-.42:m.station==='tea'?(closeTea?-.48:-.36):m.station==='plant'?-.28:-.15};}
      if(f==='walking'&&p)return{x:p.x,y:T.MathUtils.lerp(1.78,area==='healing'?(m?.seat!=null&&m.seat<4?1.27:1.48):1.623,p.sit),z:p.z,yaw:p.yaw,pitch:-.06};
      const seat=m?.seat??0,seated=seatedView(seat,area);
      return{...seated,yaw:area==='healing'?Math.PI:seated.yaw,pitch:matchMedia('(max-width:650px)').matches?-.23:-.12};
    }
    function positionLabels(){
      if(!container.current||!canvas.current)return;
      const points:Record<string,T.Vector3>={...anchors},width=container.current!.clientWidth,height=container.current!.clientHeight;
      const snack=room.snackPosition();if(snack)points['my-snack']=snack;const cup=room.cupPosition();if(cup)points['my-cup']=cup;
      const member=latest.current?.room.members.find(m=>m.id===latest.current?.self.id),currentCue=cueState.current;
      const stationId=stationInArea(area,member?.station),travelling=Boolean(member?.motion&&member.motion.endsAt>room.now());
      let next:StationId|null=null;
      if(stationId&&travelling)next=stationId;
      else if(!stationId&&!currentCue.intro){
        const hover=stationInArea(area,currentCue.hovered?.startsWith('station-')?currentCue.hovered.slice(8):null);
        if(cueFocus.current&&currentCue.discovery)next=currentCue.discovery;
        else if(hover&&stations[hover])next=hover;
        else if(currentCue.input!=='mouse'&&!(snack&&Math.abs(snack.clone().project(camera).x)<.9&&snack.clone().project(camera).y>-.65&&snack.clone().project(camera).z<1)){
          let best=.95;
          for(const [id,s]of Object.entries(stations)){
            if(latest.current?.room.members.some(m=>m.id!==latest.current?.self.id&&m.station===id))continue;
            const point=new T.Vector3(s.x,s.y,s.z),p=point.clone().project(camera),distance=point.distanceTo(camera.position);
            const score=Math.abs(p.x)+Math.abs(p.y)*.45+distance*.025;
            if(p.z>-1&&p.z<1&&Math.abs(p.x)<.8&&p.y<.64&&p.y>-.65&&distance<11&&score<best){const rect=canvas.current!.getBoundingClientRect(),hit=hitAt(rect.left+(p.x+1)*width/2,rect.top+(1-p.y)*height/2);if(hit?.object.userData.station===id){best=score;next=id as StationId;}}
          }
        }
      }
      if(next!==currentCue.discovery){cueState.current.discovery=next;setDiscovery(next);}
      if(next){const s=stations[next];points.discovery=new T.Vector3(s.x,s.y+.12,s.z);}
      if(travelling&&!stationId&&member?.seat!=null){const [x,z]=seats[member.seat];points.destination=new T.Vector3(x,1.35,z);}
      for(const m of latest.current?.room.members??[]){const point=room.labelPosition(m.id);if(point)points[m.id]=point;}
      const occupied:{x:number;y:number;w:number;h:number}[]=[];
      const root=container.current!.getBoundingClientRect(),toolbarRects=[...container.current!.querySelectorAll<HTMLElement>('.scene-toolbar>*,.direct-hint,.room-assist,.object-context')].filter(e=>getComputedStyle(e).visibility!=='hidden').map(e=>{const a=e.getBoundingClientRect();return{x:a.left-root.left,y:a.top-root.top,w:a.width,h:a.height};}).filter(a=>a.w>0&&a.h>0);
      const m=latest.current?.room.members.find(m=>m.id===latest.current?.self.id),station=m?.station&&stations[m.station];
      if(context.current&&station){let point=new T.Vector3(station.x,station.y,station.z).project(camera);
        for(const [front,side,up]of [[0,0,0],[.3,0,.2],[.3,.3,.2],[.3,-.3,.2],[.2,0,.45]]){const candidate=new T.Vector3(station.x-Math.sin(station.yaw)*front+Math.cos(station.yaw)*side,station.y+up,station.z-Math.cos(station.yaw)*front-Math.sin(station.yaw)*side).project(camera);if(hitAt(root.left+(candidate.x+1)*width/2,root.top+(1-candidate.y)*height/2)?.object.userData.station===m?.station){point=candidate;break;}}
        const cw=context.current.offsetWidth,ch=context.current.offsetHeight;context.current.style.setProperty('--context-x',Math.max(12,Math.min(width-cw-12,(point.x+1)*width/2-cw/2))+'px');context.current.style.setProperty('--context-y',Math.max(88,Math.min(height-ch-76,(1-point.y)*height/2+55))+'px');const visibleTarget=hitAt(root.left+(point.x+1)*width/2,root.top+(1-point.y)*height/2)?.object.userData;context.current.style.visibility=point.z>-1&&point.z<1&&Math.abs(point.x)<1.15&&Math.abs(point.y)<1.15&&visibleTarget?.station===m?.station?'visible':'hidden';}else if(context.current)context.current.style.visibility='visible';
      const right=new T.Vector3().setFromMatrixColumn(camera.matrixWorld,0),entries=[...labels.current].filter(([id])=>points[id]).sort(([a],[b])=>camera.position.distanceToSquared(points[a])-camera.position.distanceToSquared(points[b]));
      const bodies:{x:number;y:number;w:number;h:number;distance:number}[]=[];
      for(const [id,el]of entries){
        const point=points[id],p=point.clone().project(camera),w=el.offsetWidth,h=el.offsetHeight,distance=camera.position.distanceToSquared(point);
        let tableX:number|undefined;
        if((id==='my-snack'||id==='my-cup')&&points['my-snack']&&points['my-cup']&&labels.current.has('my-snack')&&labels.current.has('my-cup')){const a=points['my-snack'].clone().project(camera),b=points['my-cup'].clone().project(camera),sw=labels.current.get('my-snack')!.offsetWidth,cw=labels.current.get('my-cup')!.offsetWidth,total=sw+cw+16,left=Math.max(10,Math.min(width-total-10,((a.x+b.x)/2+1)*width/2-total/2)),snackLeft=a.x<b.x;tableX=left+((id==='my-snack')===snackLeft?0:(snackLeft?sw:cw)+16);}
        const rawX=tableX??(p.x+1)*width/2-w/2,rawY=(1-p.y)*height/2-h-8,x=['my-snack','my-cup','discovery','destination'].includes(id)?Math.max(10,Math.min(width-w-10,rawX)):rawX,y=rawY,rect={x,y,w,h};
        const intersects=(a:{x:number;y:number;w:number;h:number})=>x<a.x+a.w+8&&x+w>a.x-8&&y<a.y+a.h+6&&y+h>a.y-6;
        const overlap=occupied.some(intersects)||bodies.some(b=>b.distance<distance*.88&&intersects(b));
        const toolbar=toolbarRects.some(intersects);
        const cueHit=id==='discovery'&&!travelling?hitAt(root.left+(p.x+1)*width/2,root.top+(1-p.y)*height/2):null;
        const show=p.z> -1&&p.z<1&&(id!=='my-snack'||Math.abs(p.x)<1)&&(id!=='discovery'||travelling||cueHit?.object.userData.station===next)&&x>=10&&x+w<=width-10&&y>=110&&y+h<=height-12&&!overlap&&!toolbar;
        if(id==='my-snack')el.style.setProperty('--pointer-x',Math.max(16,Math.min(w-28,(p.x+1)*width/2-x-7))+'px');
        el.style.visibility=show?'visible':'hidden';el.style.left=x+'px';el.style.top=y+'px';
        if(show)occupied.push(rect);
        if(p.z>-1&&p.z<1&&!['my-snack','my-cup','plate','discovery','destination'].includes(id)){
          const edge=point.clone().addScaledVector(right,.34).project(camera),bottom=point.clone().add(new T.Vector3(0,-1.2,0)).project(camera),half=Math.abs(edge.x-p.x)*width/2;
          bodies.push({x:(p.x+1)*width/2-half,y,w:half*2,h:Math.max(h,(p.y-bottom.y)*height/2+h),distance});
        }
      }
      const marked=next?'discovery':stationId?'station':'my-snack',s=stationId&&stations[stationId];
      const point=marked==='station'&&s?new T.Vector3(s.x,s.y,s.z):points[marked];
      const coffee=latest.current?.self.pantry.coffee;
      if(point&&marked==='station'&&stationId==='coffee')point.set(stations.coffee.x+.38,coffee?.stage==='placed'?1.99:1.54,stations.coffee.z);
      const canUse=marked!=='station'||latest.current&&stationId&&Boolean(directAction(latest.current,stationId));
      if(beacon.current){const p=point?.clone().project(camera),label=marked==='station'?context.current:labels.current.get(marked);beacon.current.style.visibility=canUse&&p&&p.z>-1&&p.z<1&&Math.abs(p.x)<.95&&Math.abs(p.y)<.8&&label?.style.visibility==='visible'?'visible':'hidden';if(p){beacon.current.style.left=(p.x+1)*width/2+'px';beacon.current.style.top=(1-p.y)*height/2+'px';}beacon.current.dataset.target=marked==='discovery'?next!:marked;}
      if(brewProgress.current){const coffee=latest.current?.self.pantry.coffee;brewProgress.current.value=coffeePhase(coffee?.stage,coffee?.readyAt??0,room.now()).progress;}
    }
    function resize(){
      if(!container.current||!canvas.current)return;
      const {width,height}=container.current.getBoundingClientRect();if(!width||!height||!camera)return;
      container.current!.closest<HTMLElement>('.game-space')?.style.setProperty('--rendered-scene-height',height+'px');
      const aspect=width/height,f=framingRef.current;
      if(follower&&isPersonal(f))follower.resize(aspect);
      else if(first&&isPersonal(f))first.resize(aspect);
      else if(third&&f==='third')third.resize(aspect);
      else if(camera instanceof T.OrthographicCamera){const half=Math.max(f==='map'?6.3:6.2,(f==='map'?8.9:11.5)/aspect);Object.assign(camera,{left:-half*aspect,right:half*aspect,top:half,bottom:-half});}
      else{const vertical=2*Math.atan(Math.tan(T.MathUtils.degToRad(30))*Math.max(1,1.8/aspect));camera.aspect=aspect;camera.fov=Math.min(92,T.MathUtils.radToDeg(vertical));}
      camera.updateProjectionMatrix();camera.updateMatrixWorld();renderer.setSize(width,height,false);positionLabels();renderer.render(room.scene,camera);
    }
    function setCamera(f:Framing){
      const current=latest.current,m=current?.room.members.find(m=>m.id===current.self.id),personal=isPersonal(f);
      if(personal&&!debug){
        if(!follower||current?.self.id!==previousOwner)follower=createFollowCamera(m?room.pose(m.id)??{x:0,z:2}:{x:0,z:2},m?(room.pose(m.id)?.yaw??Math.PI)+.42:Math.PI,area,room.constrainCamera);
        camera=follower.camera;first=null;
      }else if(personal){
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
      room.firstPerson(personal&&debug?current?.self.id??null:null,foodRef.current);room.reveal(camera,null,true);room.tick(performance.now(),current,reduced);
      Object.assign(container.current!.dataset,{perspective:f,firstPerson:String(personal&&debug),cameraMode:follower?'follow':'study',cameraSeat:String(m?.seat??0),area});
      resize();
    }
    cameraUpdate.current=setCamera;lookAtSea.current=()=>{basisDirty=true;follower?.aim(Math.PI,-.13);first?.aim(Math.PI,-.02);if(reduced)first?.update(1,true);};setCamera(framingRef.current);
    const element=canvas.current!;
    let down:{x:number;y:number;lastX:number;lastY:number;id:number;slop:number;touch:boolean;dragged:boolean}|null=null;
    let lastHover=0,basisDirty=false;
    function pickAt(x:number,y:number){
      if(!canvas.current)return;
      const rect=canvas.current.getBoundingClientRect();
      raycaster.setFromCamera(new T.Vector2((x-rect.left)/rect.width*2-1,1-(y-rect.top)/rect.height*2),camera);
      const member=latest.current?.room.members.find(m=>m.id===latest.current?.self.id);
      const objects=room.objectTargets.filter(o=>!(o.userData.station==='fridge'&&member?.station==='fridge'));
      const hits=raycaster.intersectObjects([...room.interactionTargets(),...room.portalTargets,...objects,...room.seatTargets],true);
      const {surface,canopyDistance}=selectionSurfaces(raycaster.intersectObjects(room.scene.children,true),room.scene);
      for(const hit of hits){
        if(!visibleObject(hit.object)||canopyDistance<hit.distance-.005||surface&&surface.distance<hit.distance-.045)continue;
        let object:T.Object3D|null=hit.object;
        while(object&&!object.userData.action&&!object.userData.station&&!object.userData.portal&&object.userData.seat==null)object=object.parent;
        if(object&&(!object.userData.station||stationInArea(area,object.userData.station))){
          return {hit:{...hit,object},surface};
        }
      }
      return {hit:undefined,surface};
    }
    function hitAt(x:number,y:number){return pickAt(x,y)?.hit;}
    const pointerDown=(e:PointerEvent)=>{
      if(e.button!==0||!e.isPrimary)return;
      element.focus({preventScroll:true});
      const touch=e.pointerType==='touch';
      down={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,id:e.pointerId,slop:touch?12:5,touch,dragged:false};
      element.setPointerCapture(e.pointerId);
    };
    const pointerCancel=(e:PointerEvent)=>{
      if(down?.id!==e.pointerId)return;
      down=null;element.style.cursor='';
    };
    const pointerMove=(e:PointerEvent)=>{
      const d=down;
      if(d&&d.id===e.pointerId){
        if(Math.hypot(e.clientX-d.x,e.clientY-d.y)>d.slop)d.dragged=true;
        if(d.dragged&&(follower||first)){const rect=element.getBoundingClientRect();(follower||first)!.drag(e.clientX-d.lastX,e.clientY-d.lastY,rect.width,rect.height);basisDirty=true;setHovered(null);element.style.cursor='grabbing';}
        d.lastX=e.clientX;d.lastY=e.clientY;return;
      }
      if(e.pointerType==='touch'||performance.now()-lastHover<80)return;lastHover=performance.now();
      const hit=hitAt(e.clientX,e.clientY),data=hit?.object.userData;
      const self=latest.current?.room.members.find(m=>m.id===latest.current?.self.id),approach=data?.station&&(self?.station!==data.station||self&&room.pose(self.id)?.moving);
      setHovered(approach?'station-'+data.station:data?.action?'action-'+data.action:data?.portal?'portal':data?.station?'station-'+data.station:data?.seat!=null?'seat-'+data.seat:null);element.style.cursor=hit?'pointer':'grab';
    };
    const pointerUp=(e:PointerEvent)=>{
      const start=down;if(!start||start.id!==e.pointerId)return;
      down=null;element.style.cursor='grab';
      if(element.hasPointerCapture(e.pointerId))element.releasePointerCapture(e.pointerId);
      if(start.dragged||Math.hypot(e.clientX-start.x,e.clientY-start.y)>start.slop)return;
      const pick=pickAt(start.touch?start.x:e.clientX,start.touch?start.y:e.clientY);
      if(!pick)return;
      const {hit,surface}=pick;
      if(actions.current.disabled&&hit?.object.userData.action!=='cup')return;
      if(hit?.object.userData.action){dismissHint();const data=hit.object.userData,m=latest.current?.room.members.find(m=>m.id===latest.current?.self.id);if(data.station&&(m?.station!==data.station||m&&room.pose(m.id)?.moving))void actions.current.chooseObject(data.station);else void actions.current.onUse(data.action);return;}
      if(hit?.object.userData.portal){void actions.current.choosePortal();return;}
      if(hit?.object.userData.station){void actions.current.chooseObject(hit.object.userData.station);return;}
      if(hit?.object.userData.seat!=null){const index=hit.object.userData.seat;
        if(latest.current?.room.members.some(m=>m.seat===index)){setWalkHint('이미 누군가 앉아 있는 자리예요.');return;}
        void actions.current.chooseSeat(index);return;
      }
      if(surface?.object.userData.walkSurface&&isWalkable(surface.point,area)){
        void actions.current.onMove(surface.point.x,surface.point.z);
        return;
      }
      const p=raycaster.ray.intersectPlane(floor,new T.Vector3());
      if(p&&raycaster.ray.direction.y<-.025){
        room.destination.set(p,'blocked');
        setWalkHint('여기는 지나가기 어려워요. 빈 바닥을 골라 주세요.');
      }
    };
    const pointerLeave=(e:PointerEvent)=>{if(!down){if(!(e.relatedTarget instanceof Element&&e.relatedTarget.closest('.discovery-cue,.object-context')))setHovered(null);element.style.cursor='';}};
    const keyDown=(e:KeyboardEvent)=>{
      const controls=follower||first;if(!controls||e.ctrlKey||e.metaKey||e.altKey)return;
      const delta:Record<string,[number,number]>={ArrowLeft:[.12,0],ArrowRight:[-.12,0],ArrowUp:[0,.08],ArrowDown:[0,-.08]};
      if(e.key==='Escape'){e.preventDefault();if(keyboard.active)void keyboard.stop();else void actions.current.onStand();return;}
      if(e.key==='Home'){e.preventDefault();controls.aim(Math.PI,-.13);basisDirty=true;return;}
      if(delta[e.key]){e.preventDefault();setHovered(null);controls.turn(...delta[e.key]);basisDirty=true;}
    };
    const forward=new T.Vector3(),right=new T.Vector3(),visibleForward=new T.Vector3();
    const captureKeyboardBasis=()=>{camera.getWorldDirection(forward);right.setFromMatrixColumn(camera.matrixWorld,0);basisDirty=false;};captureKeyboardBasis();
    const keyboardBlocked=()=>!actions.current.keyboardEnabled||actions.current.tvOpen||document.hidden||Boolean(document.querySelector('dialog[open],details[open]'))||Boolean(document.activeElement?.closest('input,textarea,select,[contenteditable=true],[role=textbox]'));
    const keyboard=createKeyboardWalk({ready:()=>actions.current.inputReady(),direction:keys=>{if(keyboardBlocked())return null;return keyboardVector(keys,forward,right);},move:async direction=>{const current=latest.current,m=current?.room.members.find(m=>m.id===current.self.id);if(m?.seat!=null&&!room.pose(m.id)?.moving)origin.current=m.seat;room.destination.clear();return await actions.current.onSteer(direction);},stop:()=>actions.current.onStand()});
    stopKeyboard.current=()=>keyboard.stop();
    const walkKeyDown=(event:KeyboardEvent)=>{if(event.code==='Escape'&&keyboard.active&&!keyboardBlocked()){event.preventDefault();void keyboard.stop();return;}if(!movementCodes.has(event.code)||event.ctrlKey||event.metaKey||event.altKey||keyboardBlocked())return;event.preventDefault();if(!event.repeat){captureKeyboardBasis();keyboard.press(event.code);void keyboard.tick(performance.now());}};
    const walkKeyUp=(event:KeyboardEvent)=>{if(!movementCodes.has(event.code))return;captureKeyboardBasis();keyboard.release(event.code);void keyboard.tick(performance.now());};
    const stopWalking=()=>{void keyboard.stop();};
    const focusWalking=()=>{if(keyboardBlocked())stopWalking();};
    window.addEventListener('keydown',walkKeyDown);window.addEventListener('keyup',walkKeyUp);window.addEventListener('blur',stopWalking);document.addEventListener('visibilitychange',stopWalking);document.addEventListener('focusin',focusWalking);
    element.addEventListener('pointerdown',pointerDown);element.addEventListener('pointermove',pointerMove);element.addEventListener('pointerup',pointerUp);element.addEventListener('pointercancel',pointerCancel);element.addEventListener('lostpointercapture',pointerCancel);element.addEventListener('pointerleave',pointerLeave);element.addEventListener('keydown',keyDown);
    const observer=new ResizeObserver(resize);observer.observe(container.current!);
    const intersection=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??true;});intersection.observe(container.current!);
    function frame(time:number){
      if(!container.current||!canvas.current)return;
      if(keyboardBlocked()&&keyboard.active)void keyboard.stop();
      const active=visible&&!document.hidden&&!actions.current.tvOpen&&!document.querySelector('dialog[open]');room.active(active);
      if(active&&time>=nextFrame-.5){
        const current=latest.current,self=current?.self.id,pose=self?room.pose(self):null,f=framingRef.current,dt=last?(time-last)/1000:1/30;
        if(first&&isPersonal(f)){first.anchor(eyeFor(f));first.update(dt,reduced);}
        if(third&&f==='third'&&pose)third.follow(pose,dt,reduced);
        if(follower&&pose){const station=current?.room.members.find(m=>m.id===self)?.station;follower.follow({...pose,focus:station&&!pose.moving?stations[station]:null},dt,reduced);}
        if(basisDirty || (keyboard.keys.size && bearingChanged(forward,camera.getWorldDirection(visibleForward)))) {
          captureKeyboardBasis();
        }
        void keyboard.tick(time);
        room.firstPerson(isPersonal(f)&&debug?self??null:null,foodRef.current);room.tick(time,current,reduced);
        room.reveal(camera,(follower||f==='third')&&pose?pose:null,reduced);
        room.foreground(camera,current,debug&&isPersonal(f)&&f!=='walking'&&!foodRef.current,null,reduced);
        Object.assign(container.current!.dataset,{cameraX:camera.position.x.toFixed(4),cameraY:camera.position.y.toFixed(4),cameraZ:camera.position.z.toFixed(4),cameraFov:camera instanceof T.PerspectiveCamera?String(camera.fov):'ortho',cameraYaw:(follower||first)?.angles.yaw.toFixed(4)??'',cameraPitch:(follower||first)?.angles.pitch.toFixed(4)??'',actorX:pose?.x.toFixed(3)??'',actorZ:pose?.z.toFixed(3)??''});
        const now=room.now(),animated=current?.room.members.some(m=>m.motion&&m.motion.endsAt>now||now-m.actionAt<4500||m.pantry.coffee.stage==='brewing'||Boolean(m.pantry.rest.tea?.pourAt));
        if(shadowState!==current||animated&&time-shadowTime>100){renderer.shadowMap.needsUpdate=true;shadowState=current;shadowTime=time;}
        const cue=JSON.stringify([cueState.current,framingRef.current,foodRef.current]);
        if(time-labelTime>120&&(labelSnapshot!==current||labelCue!==cue||!labelCamera.equals(camera.matrixWorld))){positionLabels();labelTime=time;labelSnapshot=current;labelCue=cue;labelCamera.copy(camera.matrixWorld);}
        if(brewProgress.current){const c=current?.self.pantry.coffee;brewProgress.current.value=coffeePhase(c?.stage,c?.readyAt??0,now).progress;}
        renderer.render(room.scene,camera);last=time;nextFrame=Math.max(nextFrame+frameInterval,time+frameInterval*.25);container.current.dataset.destination=room.destination.status;
      }
      raf=requestAnimationFrame(frame);
    }
    const lost=(e:Event)=>{e.preventDefault();setError('3D 화면 연결이 끊겼어요. 도트 화면으로 이어갈 수 있어요.');};element.addEventListener('webglcontextlost',lost);
    resize();setReady(true);raf=requestAnimationFrame(frame);
    return()=>{void keyboard.stop().finally(()=>keyboard.dispose());stopKeyboard.current=async()=>{};window.removeEventListener('keydown',walkKeyDown);window.removeEventListener('keyup',walkKeyUp);window.removeEventListener('blur',stopWalking);document.removeEventListener('visibilitychange',stopWalking);document.removeEventListener('focusin',focusWalking);cancelAnimationFrame(raf);observer.disconnect();intersection.disconnect();element.removeEventListener('webglcontextlost',lost);element.removeEventListener('pointerdown',pointerDown);element.removeEventListener('pointermove',pointerMove);element.removeEventListener('pointerup',pointerUp);element.removeEventListener('pointercancel',pointerCancel);element.removeEventListener('lostpointercapture',pointerCancel);element.removeEventListener('pointerleave',pointerLeave);element.removeEventListener('keydown',keyDown);room.dispose();reflection.dispose();renderer.dispose();renderer.forceContextLoss();world.current=null;cameraUpdate.current=null;lookAtSea.current=null;};
  },[area]);
  const ref=(key:string)=>(el:HTMLElement|null)=>{if(el)labels.current.set(key,el);else labels.current.delete(key);};
  const hoverStation=stationInArea(area,hovered?.startsWith('station-')?hovered.slice(8):null),hoverSeat=hovered?.startsWith('seat-')?Number(hovered.slice(5)):null;
  const hoverOwner=state?.room.members.find(m=>m.id!==state.self.id&&(hoverStation?m.station===hoverStation:hoverSeat!=null&&m.seat===hoverSeat));
  const hoverText=hovered?.startsWith('action-')&&state?directAction(state,hovered.slice(7))?.label??'':hovered==='portal'?portal.name+(area==='healing'&&(state?.self.pantry.rest.sand?.held||state?.self.pantry.rest.vase?.held)?' · 내 휴식 도구는 여기에 보관돼요':' · 눌러서 이동'):hovered?(hoverStation?stations[hoverStation]?.name??map.name:`${(hoverSeat??0)+1}번 자리`)+(hoverOwner?' · 이용 중':(hoverStation===me?.station&&!moving?' · '+(state?directAction(state,hoverStation!)?.label??'천천히 기다려요':''):' · 눌러서 이동')):input==='touch'?'손가락으로 밀어 둘러보기':input==='keyboard'?'방향키로 둘러보기 · Home은 풍경':'드래그로 둘러보기';
  const destination=me?.travel?portal.name:objectTarget?stations[objectTarget]?.name??null:target!=null?`${target+1}번 자리`:null;
  const showFloorHint=showHint&&Boolean(me)&&me?.seat==null&&!me?.station&&!moving;
  return <>
    <div className={`room-frame room-three framing-${framing} ${warm?'late-light':''}`} ref={container}>
      <canvas ref={canvas} className="room-three-canvas" tabIndex={0} role="img" aria-label={input==='touch'?'내 눈높이의 휴식 공간. 손가락으로 밀어 둘러보고 사물을 톡 누르면 이동해요.':input==='keyboard'?'내 눈높이의 탕비실. 방향키로 둘러보고 Home으로 풍경을 봅니다.':'내 눈높이의 탕비실. 드래그로 둘러보고 사물을 누르면 이동합니다.'} data-ready={ready} data-landscape={landscape} data-playback={playback} data-view={landscapeId}/>
      <video ref={seaVideo} className="sea-video-source" muted playsInline preload="none" aria-hidden="true" tabIndex={-1}/>
      <div className="scene-toolbar"><div className="scene-label">{moving?(destination?destination+' · 이동 중':'이동 중'):me?.station?stations[me.station]?.name??map.name:map.name}{debug&&<span className="scene-label-sub">{frames[study]}</span>}</div><button className="sea-sound-toggle" aria-pressed={waves} onClick={onWaves}>{waves?'파도 소리 끄기':'파도 소리 켜기'}</button></div>
      {playback==='fallback'&&<span className="sea-playback-note" role="status">지금은 고요한 풍경으로 쉬어가요.</span>}
      {!ready&&!error&&<div className="three-message">창가의 빛을 들이는 중…</div>}
      {error?<div className="three-message" role="alert"><p>{error}</p><button className="primary" disabled={disabled} onClick={area==='healing'?()=>void choosePortal():onFallback}>{area==='healing'?'탕비실로 돌아가기':'도트로 이어가기'}</button></div>:<>
        {debug&&<><button ref={ref('shelf')} className="hotspot three-hotspot" onClick={onShelf} disabled={disabled}>오늘의 레몬파이</button><button ref={ref('drink')} className="hotspot three-hotspot" onClick={onDrink} disabled={disabled}>한 잔</button></>}
        {!debug&&state&&!tvOpen&&!foodInHand&&!moving&&!discovery&&me?.seat!=null&&area==='pantry'&&<button ref={ref('my-snack')} className="world-action snack-world-hint" disabled={disabled} onClick={()=>{setIntro(false);onShelf();}}>{intro?'간식을 눌러보세요':directAction(state,'snack')?.label}</button>}
        {!debug&&state&&!tvOpen&&!moving&&me?.seat!=null&&area==='pantry'&&<button ref={ref('my-cup')} className="world-action cup-world-hint" disabled={disabled&&!foodInHand} onClick={()=>void useNearObject('cup')}>{directAction(state,'cup')?.label??'잔 준비 중'}</button>}
        {!debug&&!tvOpen&&!foodInHand&&discovery&&stations[discovery]&&<button ref={ref('discovery')} className="world-action discovery-cue" onFocus={()=>{cueFocus.current=true;}} onBlur={()=>{cueFocus.current=false;}} disabled={disabled||moving||state?.room.members.some(m=>m.id!==state.self.id&&m.station===discovery)} onClick={()=>void chooseObject(discovery)}>{stations[discovery].name}{moving?' · 이동 중':' 가기'}</button>}
        {!debug&&!tvOpen&&!foodInHand&&moving&&me?.seat!=null&&!me.station&&<span ref={ref('destination')} className="world-status destination-cue" role="status">자리로 가는 중</span>}
        {!debug&&!tvOpen&&!foodInHand&&<span ref={beacon} className="target-beacon" aria-hidden="true"/>}
        {!debug&&sampleAvailable&&!intro&&!discovery&&!tvOpen&&!foodInHand&&!moving&&area==='pantry'&&<button ref={ref('plate')} className="world-action shared-world-hint" disabled={disabled} aria-label={sampleLabel} onClick={onPlate}>한 조각 맛보기</button>}
        {state?.room.members.filter(m=>debug||m.id!==state.self.id).map(m=><div ref={ref(m.id)} key={m.id} className={`visitor-name three-name ${!m.connected?'reconnecting':''}`}><span className="presence-dot"/>{m.name}</div>)}
      </>}
      {onTv&&!tvOpen&&<button className="tv-entry" disabled={disabled||moving||me?.seat==null} onClick={onTv}>TV 함께 보기</button>}
      {!debug&&!tvOpen&&!foodInHand&&state&&!moving&&!tabledDrink&&<div ref={context} className={'object-context'+(me?.station?' at-station':' held-context')} aria-label="가까이 있는 물건">
        {me?.station&&directAction(state,me.station)&&<button className="world-action" disabled={disabled} onClick={()=>void useNearObject(me.station!)}>{directAction(state,me.station)!.label}</button>}
        {arrival&&me?.station&&<span className="arrival-note" role="status">도착했어요</span>}
        {me?.station==='coffee'&&state.self.pantry.coffee.stage==='brewing'&&<div className="brew-feedback"><span role="status">커피가 차오르고 있어요</span><progress ref={brewProgress} max={1} value={0} aria-label="커피 추출"/><button className="world-action" disabled={disabled} onClick={()=>void stand()}>추출 멈추기</button></div>}
        {!me?.station&&heldName(state.self.pantry)&&directAction(state,'held')&&<button className="world-action" disabled={disabled} onClick={()=>void useNearObject('held')}>{directAction(state,'held')!.label}</button>}
        {(me?.station||heldName(state.self.pantry)||state.self.pantry.rest.stone||state.self.pantry.rest.tea||state.self.pantry.rest.sand||state.self.pantry.rest.vase||state.self.pantry.candy&&state.self.pantry.candy.state!=='eaten'||state.self.pantry.bottle&&state.self.pantry.bottle.sips<3)&&<details className="object-options" onKeyDown={e=>{if(e.key==='Escape'){e.currentTarget.open=false;e.currentTarget.querySelector('summary')?.focus();e.stopPropagation();}}} onToggle={e=>{if(e.currentTarget.open)dismissHint();}}><summary aria-label="이 물건의 다른 행동">{me?.station||heldName(state.self.pantry)?'더보기':'내 물건'}</summary><div className="object-options-panel">{contextContent}</div></details>}
      </div>}
      {!debug&&!tvOpen&&!foodInHand&&<div className={'room-assist'+(me?.station?' at-object':'')}>{!moving&&<button className="look-window" onClick={()=>lookAtSea.current?.()} aria-label="창밖 풍경 보기">풍경 보기</button>}{moving&&<><button disabled={disabled} onClick={()=>void stand()}>멈추기</button><button disabled={disabled} onClick={onExplore}>다른 곳</button></>}{(me?.station||origin.current!=null&&(moving||me?.seat==null))&&<button disabled={disabled} onClick={()=>void returnToRest()}>돌아가기</button>}{!moving&&me?.seat!=null&&<button disabled={disabled} onClick={()=>void stand()}>일어나기</button>}</div>}
      {!debug&&!tvOpen&&!foodInHand&&(showFloorHint||walkHint||hovered&&!hovered.startsWith('station-')&&hovered!=='action-snack')&&<div className="direct-hint" role="status">{walkHint||hovered&&hoverText||(input==='touch'?'바닥을 누르면 걸어가요':'WASD로 걷거나 바닥을 누르세요')}{showFloorHint&&!hovered&&<button aria-label="조작 안내 닫기" onClick={dismissHint}>×</button>}</div>}
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
