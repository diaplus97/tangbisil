import {useEffect,useRef,useState,type ReactNode} from 'react';
import type {LandscapeId} from '../../shared/room-media.mjs';
import * as T from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {makeRenderer} from './three/assets';
import {anchors,createRoomScene} from './three/roomScene';
import {exitsFrom,getSpace,seatedView,stations as pantryStations,type Area,type StationId} from '../../shared/space.mjs';
import type {SeaPlaybackStatus} from './three/seaPlayback';
import type {LandscapeStatus} from './three/environment';
import {windowViews} from './three/windowView';
import {fridgeShelfView,tableCenter} from './three/layout';
import {floorDestination,pickSceneTarget,selectionSurface,stationInArea} from './three/sceneInteraction';
import {createFollowCamera} from './three/followCamera';
import {createExploreCamera} from './three/exploreCamera';
import {createFirstPersonCamera,type Eye} from './three/firstPersonCamera';
import {createKeyboardWalk,keyboardVector,movementCodes,bearingChanged} from './keyboardWalk';
import {useInputMethod} from './useInputMethod';
import {placeTableActions} from './tableActionPlacement';
import {ObjectAccess} from './ObjectAccess';
import {directAction,directActionKey} from './directActions';
import {coffeePhase} from '../../shared/coffee.mjs';
import {tableDrink} from '../../shared/table-drink.mjs';
import {heldName} from '../../shared/rest.mjs';
import ExploreDestinations from './ExploreDestinations';
import type {Snapshot} from './types';

type Props={reduceMotion:boolean;cameraMemory:Map<string,{yaw:number;pitch:number}>;inputReady:()=>boolean;keyboardEnabled:boolean;onSteer:(direction:[number,number])=>Promise<unknown>;onExplore:()=>void;onUse:(target:string)=>Promise<unknown>;contextContent?:ReactNode;landscapeId:LandscapeId;tvOpen:boolean;windowContent?:ReactNode;onTv?:()=>void;onTravel:(to:Area)=>Promise<unknown>;onToolsMount:(element:HTMLDivElement|null)=>void;onApproach:(station:StationId)=>Promise<unknown>;seaMotion:boolean;waves:boolean;onWaves:()=>void;state:Snapshot|null;debug:boolean;movementMode:boolean;foodInHand:boolean;onFinishMove:()=>void;sampleAvailable:boolean;sampleLabel:string;onShelf:()=>void;onPlate:()=>void;onDrink:()=>void;disabled:boolean;onFallback:()=>void;onMove:(x:number,z:number)=>Promise<unknown>;onSit:(seat:number)=>Promise<unknown>;onStand:()=>Promise<unknown>};
type Study='diorama'|'inside'|'table'|'lounge'|'map'|'third';
type Framing=Study|'seated'|'walking'|'activity'|'choosing';
const frames:Record<Study,string>={inside:'입구 시점',table:'테이블 시점',lounge:'창가 자리',diorama:'전체 배치',map:'개발용 평면',third:'이전 3인칭'};
export default function Room3D({reduceMotion,cameraMemory,inputReady,keyboardEnabled,onSteer,onExplore,onUse,contextContent,landscapeId,tvOpen,windowContent,onTv,onTravel,onToolsMount,onApproach,seaMotion,waves,onWaves,state,debug,movementMode,foodInHand,onFinishMove,sampleAvailable,sampleLabel,onShelf,onPlate,onDrink,disabled,onFallback,onMove,onSit,onStand}:Props){
  const input=useInputMethod(),reduceRef=useRef(reduceMotion);reduceRef.current=reduceMotion;
  const [intro,setIntro]=useState(false),[discovery,setDiscovery]=useState<StationId|null>(null),[arrival,setArrival]=useState(false);
  const cueFocus=useRef(false),beacon=useRef<HTMLSpanElement>(null),brewProgress=useRef<HTMLProgressElement>(null);
  const cueState=useRef({input,intro,hovered:null as string|null,discovery});
  useEffect(()=>onToolsMount(null),[onToolsMount]);
  const area=state?.room.area??'pantry',map=getSpace(area),seats=map.seats,stations=map.stations as typeof pantryStations;
  const portal=map.portal,exits=exitsFrom(area);
  const seaVideo=useRef<HTMLVideoElement>(null),canvas=useRef<HTMLCanvasElement>(null),container=useRef<HTMLDivElement>(null);
  const latest=useRef(state),world=useRef<ReturnType<typeof createRoomScene>|null>(null),labels=useRef(new Map<string,HTMLElement>());
  const [playback,setPlayback]=useState<SeaPlaybackStatus>('paused'),[landscape,setLandscape]=useState<LandscapeStatus>('loading');
  const [error,setError]=useState(''),[ready,setReady]=useState(false),[warm,setWarm]=useState(false),[hovered,setHovered]=useState<string|null>(null);
  const [study,setStudy]=useState<Study>(()=>{const value=new URLSearchParams(location.search).get('camera');return value&&value in frames?value as Study:'inside';});
  const [arrived,setArrived]=useState(''),[walkHint,setWalkHint]=useState(''),[showHint,setShowHint]=useState(()=>{try{return !sessionStorage.getItem('pantry:direct-hint');}catch{return true;}});
  const context=useRef<HTMLDivElement>(null),floorTap=useRef<HTMLSpanElement>(null);
  function dismissHint(){setShowHint(false);try{sessionStorage.setItem('pantry:direct-hint','1');}catch{}}
  const [target,setTarget]=useState<number|null>(null),[objectTarget,setObjectTarget]=useState<StationId|null>(null);
  const requesting=useRef(false),origin=useRef<number|null>(null);
  const stopKeyboard=useRef<()=>Promise<void>>(async()=>{});
  const moveButton=useRef<HTMLButtonElement>(null);
  const [destinationList,setDestinationList]=useState(false);
  const focusObject=useRef<((target:string)=>void)|null>(null);
  const interactionState=useRef({movementMode,destinationList,hovered});interactionState.current={movementMode,destinationList,hovered};
  const intentGeneration=useRef(0);
  const cancelNavigation=useRef<Promise<unknown>>(Promise.resolve());
  const pendingUse=useRef<{station:StationId;target:string;type:string}|null>(null);
  useEffect(()=>{if(!movementMode)setDestinationList(false);},[movementMode]);
  function closeDestinations(){pendingUse.current=null;intentGeneration.current++;nextFloor.current=null;if(moving)cancelNavigation.current=stopKeyboard.current().then(()=>stand());world.current?.destination.clear();onFinishMove();requestAnimationFrame(()=>moveButton.current?.focus({preventScroll:true}));}
  function openDestinations(){void stopKeyboard.current().then(()=>onExplore());}
  const usingObject=useRef(false),usedAt=useRef(-Infinity),usedTarget=useRef('');
  async function useNearObject(id:string){
    const step=directActionKey(latest.current,id);
    if(disabled&&id!=='cup'||usingObject.current||usedTarget.current===step&&performance.now()-usedAt.current<380)return;
    if(id==='held'&&latest.current&&!directAction(latest.current,id)){const p=latest.current.self.pantry;if(p.rest.tea?.held||p.rest.stone?.held)setWalkHint('편한 자리에 앉아서 사용해요.');return;}
    usingObject.current=true;setIntro(false);
    try{return await onUse(id);}
    finally{usedAt.current=performance.now();usedTarget.current=step;usingObject.current=false;}
  }
  const me=state?.room.members.find(m=>m.id===state.self.id),seat=me?.seat??0;
  const tabledDrink=me?.seat!=null&&state&&(tableDrink(state.self.pantry)==='tea'&&heldName(state.self.pantry)==='찻잔'||tableDrink(state.self.pantry)==='bottle'&&heldName(state.self.pantry)==='음료 병');
  useEffect(()=>{if(['tea-hold','bottle-hold'].includes(me?.action??''))container.current?.querySelectorAll<HTMLDetailsElement>('details[open]').forEach(d=>{d.open=false;});},[me?.actionAt]);
  const moving=Boolean(me?.travel||me?.motion&&me.motion.id!==arrived&&state&&me.motion.endsAt>state.serverTime);
  cueState.current={input,intro,hovered,discovery};
  useEffect(()=>{if(!state?.self.id)return;const key='pantry:direct-objects:v1:'+state.self.id+':'+area;try{if(sessionStorage.getItem(key))return;}catch{}setIntro(true);const timer=setTimeout(()=>{setIntro(false);try{sessionStorage.setItem(key,'1');}catch{}},6500);return()=>clearTimeout(timer);},[state?.self.id,area]);
  useEffect(()=>{setArrival(Boolean(me?.station&&!moving));if(!me?.station||moving)return;const timer=setTimeout(()=>setArrival(false),1800);return()=>clearTimeout(timer);},[me?.station,moving]);
  useEffect(()=>{if(!walkHint)return;const timer=setTimeout(()=>setWalkHint(''),3600);return()=>clearTimeout(timer);},[walkHint]);
  const framing:Framing=debug?study:movementMode?'choosing':moving||me&&me.seat==null&&!me.station?'walking':me?.station?'activity':'seated';
  const framingRef=useRef(framing),foodRef=useRef(foodInHand),seaMotionRef=useRef(seaMotion);
  latest.current=state;framingRef.current=framing;foodRef.current=tvOpen;seaMotionRef.current=seaMotion;
  const pointView=useRef<((target:'coffee'|'window-seat')=>void)|null>(null);
  const cameraUpdate=useRef<((f:Framing)=>void)|null>(null),lookAtSea=useRef<(()=>void)|null>(null);
  const originOwner=state?.room.members.find(m=>m.seat===origin.current&&m.id!==state.self.id);
  function rememberSeat(){if(!moving&&me?.seat!=null)origin.current=me.seat;}
  async function stand(){pendingUse.current=null;world.current?.destination.clear();rememberSeat();const brewing=state?.self.pantry.coffee.stage==='brewing';const result=await onStand();if(result){setTarget(null);setObjectTarget(null);setWalkHint(brewing?'추출을 멈추고 컵을 챙겼어요.':'');}return result;}
  async function returnToRest(){const index=origin.current!=null&&!originOwner?origin.current:seats.findIndex((_,i)=>!state?.room.members.some(m=>m.seat===i));if(index>=0){await chooseSeat(index);if(originOwner)setWalkHint('원래 자리에 동료가 있어 가까운 빈 자리로 가요.');}}
  async function chooseSeat(index:number){
    if(disabled||requesting.current)return;
    pendingUse.current=null;intentGeneration.current++;
    await cancelNavigation.current;await stopKeyboard.current();rememberSeat();requesting.current=true;world.current?.destination.set(map.approaches[index],'pending');
    try{if(await onSit(index)){world.current?.destination.set(map.approaches[index],'moving');setTarget(index);setObjectTarget(null);setWalkHint('');onFinishMove();}else world.current?.destination.set(map.approaches[index],'blocked');}finally{requesting.current=false;}
  }
  async function chooseObject(id:StationId,use?:string){
    if(!stationInArea(area,id)||disabled||requesting.current)return;
    if(!moving&&me?.station===id){await useNearObject(use??id);return;}
    const generation=++intentGeneration.current;pendingUse.current=null;
    await cancelNavigation.current;await stopKeyboard.current();if(generation!==intentGeneration.current)return;
    pendingUse.current=use&&latest.current?{station:id,target:use,type:directAction(latest.current,use)?.type??''}:null;rememberSeat();requesting.current=true;world.current?.destination.set(stations[id].approach,'pending');
    try{const accepted=await onApproach(id);if(generation!==intentGeneration.current)return;if(accepted){world.current?.destination.set(stations[id].approach,'moving');setObjectTarget(id);setTarget(null);setWalkHint('');onFinishMove();}else{pendingUse.current=null;world.current?.destination.set(stations[id].approach,'blocked');}}finally{requesting.current=false;}
  }
  async function choosePortal(to:Area=portal.to){if(disabled||requesting.current)return;pendingUse.current=null;intentGeneration.current++;await stopKeyboard.current();requesting.current=true;try{if(await onTravel(to)){setTarget(null);setObjectTarget(null);onFinishMove();}}finally{requesting.current=false;}}
  const floorInFlight=useRef(false),nextFloor=useRef<{x:number;z:number}|null>(null);
  async function walkTo(x:number,z:number){
    if(requesting.current||disabled&&!floorInFlight.current)return;
    pendingUse.current=null;intentGeneration.current++;
    const scene=world.current;if(!scene)return;
    nextFloor.current={x,z};scene.destination.set(nextFloor.current,'pending');
    if(floorInFlight.current)return;
    floorInFlight.current=true;
    try{
      await stopKeyboard.current();rememberSeat();dismissHint();
      while(world.current===scene&&nextFloor.current){
        const point=nextFloor.current;nextFloor.current=null;
        const moved=await onMove(point.x,point.z);
        if(world.current!==scene||nextFloor.current)continue;
        scene.destination.set(point,moved?'moving':'blocked');
        if(moved){setTarget(null);setObjectTarget(null);setWalkHint('');onFinishMove();}
        else setWalkHint('그쪽으로는 지나갈 수 없어요. 다른 바닥을 골라 주세요.');
      }
    }finally{floorInFlight.current=false;}
  }
  const actions=useRef({onMove:walkTo,chooseSeat,chooseObject,choosePortal,onUse:useNearObject,onStand:stand,onSteer,keyboardEnabled,inputReady,tvOpen,disabled,debug,onCancelMove:closeDestinations});
  actions.current={onMove:walkTo,chooseSeat,chooseObject,choosePortal,onUse:useNearObject,onStand:stand,onSteer,keyboardEnabled,inputReady,tvOpen,disabled,debug,onCancelMove:closeDestinations};
  useEffect(()=>{
    if(!me?.motion||!state)return;
    const timer=setTimeout(()=>setArrived(me.motion!.id),Math.max(0,me.motion.endsAt-state.serverTime)+40);return()=>clearTimeout(timer);
  },[me?.motion?.id,state?.serverTime]);
  useEffect(()=>{if(!moving){setTarget(null);setObjectTarget(null);}},[moving]);
  useEffect(()=>{const intent=pendingUse.current;if(!state||moving||disabled||!intent||me?.station!==intent.station)return;pendingUse.current=null;if(directAction(state,intent.target)?.type===intent.type)void useNearObject(intent.target);},[moving,me?.station,state,disabled]);
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
    let chooser:ReturnType<typeof createFirstPersonCamera>|null=null;
    let savedView:{first:ReturnType<typeof createFirstPersonCamera>|null;follower:ReturnType<typeof createFollowCamera>|null;camera:T.OrthographicCamera|T.PerspectiveCamera;framing:Framing|undefined;seat:number|null|undefined}|null=null;
    let camera:T.OrthographicCamera|T.PerspectiveCamera,first:ReturnType<typeof createFirstPersonCamera>|null=null,third:ReturnType<typeof createExploreCamera>|null=null;
    const raycaster=new T.Raycaster(),floor=new T.Plane(new T.Vector3(0,1,0),area==='healing'?-.008:.025);
    renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
    let labelTime=0,shadowTime=0,shadowState:Snapshot|null=null;
    const ribbons=area==='smoking'?room.scene.getObjectByName('terrace-ribbons'):null;
    const ribbonBox=new T.Box3(),ribbonCorner=new T.Vector3();
    const labelCamera=new T.Matrix4();let labelSnapshot:Snapshot|null=null,labelCue='';
    let previousFraming:Framing|undefined,previousMotion:string|undefined,previousSeat:number|null|undefined,previousOwner:string|undefined,raf=0,last=0,visible=true;
    const frameInterval=1000/(matchMedia('(pointer:coarse)').matches?30:60);let nextFrame=0;
    const isPersonal=(f:Framing)=>f==='seated'||f==='walking'||f==='activity';
    let cameraAspect=container.current!.clientWidth/Math.max(1,container.current!.clientHeight);
    function eyeFor(f:Framing):Eye{
      const current=latest.current,m=current?.room.members.find(m=>m.id===current.self.id),p=m?room.pose(m.id):null;
      if(f==='activity'&&m?.station){const station=stations[m.station],fridge=m.station==='fridge',closeTea=m.station==='tea'&&matchMedia('(max-width:650px)').matches;return{x:station.x-Math.sin(station.yaw)*(fridge?2.45:m.station==='coffee'?1.45:m.station==='tea'?(closeTea?.9:1.3):1.65),y:m.station==='coffee'?2.02:m.station==='tea'?1.95:1.75,z:station.z-Math.cos(station.yaw)*(fridge?2.45:m.station==='coffee'?1.45:m.station==='tea'?(closeTea?.9:1.3):1.65),yaw:station.yaw,pitch:m.station==='coffee'?-.31:m.station==='sand'?-.3:fridge?-.24:m.station==='stone'?-.42:m.station==='tea'?(closeTea?-.48:-.36):m.station==='plant'?-.28:-.15};}
      if(f==='walking'&&p)return{x:p.x,y:T.MathUtils.lerp(1.78,area==='healing'?(m?.seat!=null&&m.seat<4?1.27:1.48):1.623,p.sit),z:p.z,yaw:p.yaw,pitch:-.06};
      const seat=m?.seat??0,seated=seatedView(seat,area);
      if(area==='pantry'){
        const yaw=seats[seat][2],companion=seats[seat^1];
        const across=companion?Math.atan2(companion[0]-seated.x,companion[1]-seated.z):yaw;
        const portrait=1-T.MathUtils.smoothstep(cameraAspect,.72,1.35);
        return{...seated,yaw:yaw+.12*portrait*Math.atan2(Math.sin(across-yaw),Math.cos(across-yaw)),pitch:-.20};
      }
      return{...seated,pitch:matchMedia('(max-width:650px)').matches?-.23:-.12};
    }
    const machine=room.scene.getObjectByName('pantry-coffee-machine');
    const machineBounds=machine?new T.Box3().setFromObject(machine):null;
    const corner=new T.Vector3();
    function machineOnScreen(width:number,height:number){
      if(!machineBounds)return null;
      let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
      for(const x of [machineBounds.min.x,machineBounds.max.x])for(const y of [machineBounds.min.y,machineBounds.max.y])for(const z of [machineBounds.min.z,machineBounds.max.z]){
        const p=corner.set(x,y,z).project(camera);if(p.z<=-1||p.z>=1)continue;
        const sx=(p.x+1)*width/2,sy=(1-p.y)*height/2;
        left=Math.min(left,sx);right=Math.max(right,sx);top=Math.min(top,sy);bottom=Math.max(bottom,sy);
      }
      return right>0&&left<width&&bottom>0&&top<height?{left,right,top,bottom}:null;
    }
    function positionLabels(){
      if(!container.current||!canvas.current)return;
      const points:Record<string,T.Vector3>={...anchors},width=container.current!.clientWidth,height=container.current!.clientHeight;
      for(const id of labels.current.keys())if(id.startsWith('access-')){const point=room.objectPoint(id.slice(7));if(point)points[id]=point;}
      const smoke=room.smokingPositions();if(smoke){points['smoke-cigarette']=smoke.cigarette;points['smoke-ashtray']=smoke.ashtray;}
      const snack=room.snackPosition();if(snack)points['my-snack']=snack;const cup=room.cupPosition();if(cup)points['my-cup']=cup;
      const member=latest.current?.room.members.find(m=>m.id===latest.current?.self.id),currentCue=cueState.current;
      const stationId=stationInArea(area,member?.station),travelling=Boolean(member?.motion&&member.motion.endsAt>room.now());
      const next:StationId|null=null;
      if(travelling&&!stationId&&member?.seat!=null){const [x,z]=seats[member.seat];points.destination=new T.Vector3(x,1.35,z);}
      for(const m of latest.current?.room.members??[]){const point=room.labelPosition(m.id);if(point)points[m.id]=point;}
      const appliance=machineOnScreen(width,height);
      const occupied:{x:number;y:number;w:number;h:number}[]=[];
      const root=container.current!.getBoundingClientRect();
      const overlays=[...container.current!.querySelectorAll<HTMLElement>('.scene-toolbar>*,.direct-hint,.room-assist,.object-context,.tv-entry')];
      if(area==='smoking')overlays.push(...(container.current.closest('.game-space')?.querySelectorAll<HTMLElement>('.terrace-note,.thought-picker summary,.thought-picker[open]>div')??[]));
      const toolbarRects=overlays.filter(e=>getComputedStyle(e).visibility!=='hidden').map(e=>{const a=e.getBoundingClientRect();return{x:a.left-root.left,y:a.top-root.top,w:a.width,h:a.height};}).filter(a=>a.w>0&&a.h>0);
      if(ribbons?.children.some(strip=>strip.visible)){
        ribbonBox.setFromObject(ribbons);
        let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
        for(const x of [ribbonBox.min.x,ribbonBox.max.x])for(const y of [ribbonBox.min.y,ribbonBox.max.y])for(const z of [ribbonBox.min.z,ribbonBox.max.z]){
          const p=ribbonCorner.set(x,y,z).project(camera);if(p.z<=0||p.z>=1)continue;
          const px=(p.x+1)*width*.5,py=(1-p.y)*height*.5;
          left=Math.min(left,px);right=Math.max(right,px);top=Math.min(top,py);bottom=Math.max(bottom,py);
        }
        if(right>left)toolbarRects.push({x:left,y:top,w:right-left,h:bottom-top});
      }
      const m=latest.current?.room.members.find(m=>m.id===latest.current?.self.id),station=m?.station&&stations[m.station];
      if(context.current&&station){let point=new T.Vector3(station.x,station.y,station.z).project(camera);
        for(const [front,side,up]of [[0,0,0],[.3,0,.2],[.3,.3,.2],[.3,-.3,.2],[.2,0,.45]]){const candidate=new T.Vector3(station.x-Math.sin(station.yaw)*front+Math.cos(station.yaw)*side,station.y+up,station.z-Math.cos(station.yaw)*front-Math.sin(station.yaw)*side).project(camera);if(hitAt(root.left+(candidate.x+1)*width/2,root.top+(1-candidate.y)*height/2)?.object.userData.station===m?.station){point=candidate;break;}}
        const cw=context.current.offsetWidth,ch=context.current.offsetHeight;context.current.style.setProperty('--context-x',Math.max(12,Math.min(width-cw-12,(point.x+1)*width/2-cw/2))+'px');context.current.style.setProperty('--context-y',Math.max(88,Math.min(height-ch-76,first&&m?.station==='coffee'&&appliance?appliance.bottom+36:(1-point.y)*height/2+55))+'px');const visibleTarget=hitAt(root.left+(point.x+1)*width/2,root.top+(1-point.y)*height/2)?.object.userData;const onScreen=point.z>-1&&point.z<1&&Math.abs(point.x)<1.15&&Math.abs(point.y)<1.15&&visibleTarget?.station===m?.station;
        if(!onScreen&&reduceRef.current){
          context.current.style.setProperty('--context-x',Math.max(12,(width-cw)/2)+'px');
          context.current.style.setProperty('--context-y',Math.max(88,height-ch-86)+'px');
        }
        context.current.style.visibility=onScreen||reduceRef.current?'visible':'hidden';}else if(context.current)context.current.style.visibility='visible';
      const right=new T.Vector3().setFromMatrixColumn(camera.matrixWorld,0),entries=[...labels.current].filter(([id])=>points[id]).sort(([a],[b])=>camera.position.distanceToSquared(points[a])-camera.position.distanceToSquared(points[b]));
      const bodies:{x:number;y:number;w:number;h:number;distance:number}[]=[];
      const tableLabels=entries.filter(([id])=>id==='my-snack'||id==='my-cup').map(([id,el])=>{
        const p=points[id].clone().project(camera);
        return {id,x:(p.x+1)*width/2,y:(1-p.y)*height/2,w:el.offsetWidth,h:el.offsetHeight,onScreen:p.z>0&&p.z<1&&Math.abs(p.x)<1&&Math.abs(p.y)<1};
      }).filter(l=>l.onScreen).sort((a,b)=>a.x-b.x);
      const tableSlots=new Map<string,{x:number;y:number}>();
      if(tableLabels.length){
        const avoid=[...toolbarRects];
        // Reserve the seated head and the entire hand-to-mouth path. These
        // bounds stay fixed throughout a sip, so the next button stays put.
        for(const visitor of latest.current?.room.members??[]){
          if(first&&visitor.id===latest.current?.self.id)continue;
          const pose=room.pose(visitor.id);if(pose?.inSeat==null)continue;
          const crown=room.labelPosition(visitor.id);if(!crown)continue;
          const corners=[];
          for(const side of [-.34,.34])for(const depth of [-.32,.66])for(const down of [0,.75]){
            const v=new T.Vector3(crown.x+side*Math.cos(pose.yaw)+depth*Math.sin(pose.yaw),crown.y-down,crown.z+depth*Math.cos(pose.yaw)-side*Math.sin(pose.yaw)).project(camera);
            if(v.z>0&&v.z<1)corners.push([(v.x+1)*width/2,(1-v.y)*height/2]);
          }
          if(corners.length){const xx=corners.map(c=>c[0]),yy=corners.map(c=>c[1]),x=Math.min(...xx),y=Math.min(...yy);avoid.push({x,y,w:Math.max(...xx)-x,h:Math.max(...yy)-y});}
        }
        const w=tableLabels.reduce((sum,l)=>sum+l.w,0)+12*(tableLabels.length-1),h=Math.max(...tableLabels.map(l=>l.h));
        const slot=placeTableActions(tableLabels.reduce((sum,l)=>sum+l.x,0)/tableLabels.length,Math.min(...tableLabels.map(l=>l.y))-h-10,w,h,width,height,avoid);
        if(slot){let x=slot.x;for(const label of tableLabels){tableSlots.set(label.id,{x,y:slot.y});x+=label.w+12;}}
      }
      for(const [id,el]of entries){
        const point=points[id],p=point.clone().project(camera),w=el.offsetWidth,h=el.offsetHeight,distance=camera.position.distanceToSquared(point);
        if(id.startsWith('access-')){el.style.setProperty('--object-x',Math.max(12,Math.min(width-220,(p.x+1)*width/2-90))+'px');el.style.setProperty('--object-y',Math.max(100,Math.min(height-130,(1-p.y)*height/2-60))+'px');continue;}
        const table=id==='my-snack'||id==='my-cup',slot=tableSlots.get(id);
        const rawX=(p.x+1)*width/2-w/2,rawY=(1-p.y)*height/2-h-8;
        let x=slot?.x??(['discovery','destination','smoke-cigarette','smoke-ashtray'].includes(id)?Math.max(10,Math.min(width-w-10,rawX)):rawX);
        let y=slot?.y??(id==='smoke-ashtray'?(1-p.y)*height/2+26:rawY);
        if(id==='smoke-ashtray'&&width>=650){
          // The wide lens puts the bowl at the bottom edge: use its free left side, keeping the bowl clickable.
          const side=point.clone().addScaledVector(right,-.35).project(camera);
          x=Math.max(10,Math.min(width-w-10,(side.x+1)*width/2-w/2));
        }
        if(id==='discovery'&&appliance&&x<appliance.right+4&&x+w>appliance.left-4&&y<appliance.bottom+4&&y+h>appliance.top-4){
          y=appliance.top-h-8>=110?appliance.top-h-8:appliance.bottom+8;
        }
        const rect={x,y,w,h};
        const intersects=(a:{x:number;y:number;w:number;h:number})=>x<a.x+a.w+8&&x+w>a.x-8&&y<a.y+a.h+6&&y+h>a.y-6;
        const overlap=occupied.some(intersects)||bodies.some(b=>b.distance<distance*.88&&intersects(b));
        const toolbar=toolbarRects.some(intersects);
        const cueHit=id==='discovery'&&!travelling?hitAt(root.left+(p.x+1)*width/2,root.top+(1-p.y)*height/2):null;
        const show=p.z> -1&&p.z<1&&(!table||!!slot)&&(id!=='discovery'||travelling||cueHit?.object.userData.station===next)&&x>=10&&x+w<=width-10&&y>=110&&y+h<=height-12&&!overlap&&!toolbar;
        if(id==='my-snack')el.style.setProperty('--pointer-x',Math.max(16,Math.min(w-28,(p.x+1)*width/2-x-7))+'px');
        el.style.visibility=show?'visible':'hidden';el.style.left=x+'px';el.style.top=y+'px';
        if(show)occupied.push(rect);
        if(p.z>-1&&p.z<1&&!['my-snack','my-cup','plate','discovery','destination','smoke-cigarette','smoke-ashtray'].includes(id)){
          const edge=point.clone().addScaledVector(right,.34).project(camera),bottom=point.clone().add(new T.Vector3(0,-1.2,0)).project(camera),half=Math.abs(edge.x-p.x)*width/2;
          bodies.push({x:(p.x+1)*width/2-half,y,w:half*2,h:Math.max(h,(p.y-bottom.y)*height/2+h),distance});
        }
      }
      const marked=next?'discovery':stationId?'station':'my-snack',s=stationId&&stations[stationId];
      const point=marked==='station'&&s?new T.Vector3(s.x,s.y,s.z):points[marked];
      const coffee=latest.current?.self.pantry.coffee;
      if(point&&marked==='station'&&stationId==='coffee')point.set(stations.coffee.x+.38,coffee?.stage==='placed'?1.99:1.54,stations.coffee.z);
      const canUse=marked!=='station'||latest.current&&stationId&&Boolean(directAction(latest.current,stationId));
      if(beacon.current){const p=point?.clone().project(camera);
        const snackVisible=marked!=='my-snack'||p&&hitAt(root.left+(p.x+1)*width/2,root.top+(1-p.y)*height/2)?.object.userData.action==='snack';
        const label=marked==='station'?context.current:labels.current.get(marked);beacon.current.style.visibility=!(first&&m?.station==='coffee')&&canUse&&snackVisible&&p&&p.z>-1&&p.z<1&&Math.abs(p.x)<.95&&Math.abs(p.y)<.8&&label?.style.visibility==='visible'?'visible':'hidden';if(p){beacon.current.style.left=(p.x+1)*width/2+'px';beacon.current.style.top=(1-p.y)*height/2+'px';}beacon.current.dataset.target=marked==='discovery'?next!:marked;}
      if(brewProgress.current){const coffee=latest.current?.self.pantry.coffee;brewProgress.current.value=coffeePhase(coffee?.stage,coffee?.readyAt??0,room.now()).progress;}
    }
    function resize(){
      if(!container.current||!canvas.current)return;
      const {width,height}=container.current.getBoundingClientRect();if(!width||!height||!camera)return;
      container.current!.closest<HTMLElement>('.game-space')?.style.setProperty('--rendered-scene-height',height+'px');
      const aspect=width/height,f=framingRef.current;cameraAspect=aspect;
      if(chooser)chooser.resize(aspect);
      else if(follower&&isPersonal(f))follower.resize(aspect,f==='walking');
      else if(first&&isPersonal(f)){
        first.resize(aspect,f==='seated'&&area==='pantry');
        if(f==='seated'){const eye=eyeFor(f);first.frame(eye.yaw,eye.pitch);if(reduceRef.current)first.update(1,true);}
      }
      else if(third&&f==='third')third.resize(aspect);
      else if(camera instanceof T.OrthographicCamera){const half=Math.max(f==='map'?6.3:6.2,(f==='map'?8.9:11.5)/aspect);Object.assign(camera,{left:-half*aspect,right:half*aspect,top:half,bottom:-half});}
      else{const vertical=2*Math.atan(Math.tan(T.MathUtils.degToRad(30))*Math.max(1,1.8/aspect));camera.aspect=aspect;camera.fov=Math.min(92,T.MathUtils.radToDeg(vertical));}
      camera.updateProjectionMatrix();camera.updateMatrixWorld();renderer.setSize(width,height,false);positionLabels();renderer.render(room.scene,camera);
    }
    function setCamera(f:Framing){
      const reduced=reduceRef.current;
      const current=latest.current,m=current?.room.members.find(m=>m.id===current.self.id),personal=isPersonal(f);
      const atEye=personal&&Boolean(m)&&(f==='seated'||(f==='activity'&&m?.station==='coffee'));
      if(f==='choosing'&&!debug){
        if(!chooser){
          savedView={first,follower,camera,framing:previousFraming,seat:previousSeat};
          const p=area==='smoking'?{x:2.65,y:2.3,z:3.5,yaw:-2.55,pitch:-.13}:area==='healing'?{x:3.95,y:2.35,z:3.8,yaw:-2.35,pitch:-.18}:{x:1,y:2.45,z:6.5,yaw:-2.9,pitch:-.14};
          chooser=createFirstPersonCamera(p);first=null;follower=null;
        }
        camera=chooser.camera;
      }else if(chooser&&savedView&&savedView.framing===f&&savedView.seat===m?.seat){
        ({first,follower,camera}=savedView);chooser=null;savedView=null;
      }else if(atEye&&!debug){
        chooser=null;savedView=null;
        if(follower&&previousOwner===m?.id&&m)cameraMemory.set(m.id+'/'+area,follower.angles);
        follower=null;
        if(!first||f!==previousFraming||m?.seat!==previousSeat||current?.self.id!==previousOwner){
          first=createFirstPersonCamera(eyeFor(f));
        }
        camera=first.camera;
      }else if(personal&&!debug){
        chooser=null;savedView=null;
        if(!follower||current?.self.id!==previousOwner){
          const pose=m?room.pose(m.id):null,memory=m?cameraMemory.get(m.id+'/'+area):null;
          const bearing=memory?.yaw??(pose&&area==='pantry'&&!m?.enteredAt?Math.atan2(stations.coffee.x-pose.x,stations.coffee.z-pose.z)-.5:Math.PI);
          follower=createFollowCamera(pose??{x:0,z:2},bearing,area,room.constrainCamera);
          if(memory)follower.aim(memory.yaw,memory.pitch);
        }
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
      room.firstPerson(first?current?.self.id??null:null,foodRef.current);room.reveal(camera,null,true);room.tick(performance.now(),current,reduced);
      Object.assign(container.current!.dataset,{perspective:f,firstPerson:String(Boolean(first)),cameraMode:chooser?'choose':first?'eye':follower?'follow':'study',cameraSeat:String(m?.seat??0),area});
      resize();
    }
    pointView.current=target=>{
      if(!first)return;
      const members=latest.current?.room.members??[];
      const windowSeat=map.seatTables.findIndex((table,i)=>map.tables[table]?.id==='window'&&!members.some(m=>m.seat===i));
      const point=target==='coffee'?new T.Vector3(stations.coffee.x,stations.coffee.y,stations.coffee.z):
        windowSeat>=0?new T.Vector3(seats[windowSeat][0],1.0,seats[windowSeat][1]):null;
      if(!point)return;
      point.sub(camera.position);
      first.aim(Math.atan2(point.x,point.z),Math.atan2(point.y,Math.hypot(point.x,point.z)));
      if(reduceRef.current)first.update(1,true);
      basisDirty=true;
    };
    cameraUpdate.current=setCamera;lookAtSea.current=()=>{basisDirty=true;follower?.aim(Math.PI,-.13);first?.aim(Math.PI,-.02);if(reduceRef.current)first?.update(1,true);};setCamera(framingRef.current);
    focusObject.current=id=>{const point=room.objectPoint(id.replace(/^action-/,''));if(!point)return;const p=point.clone().project(camera);if(p.z<0||p.z>1||Math.abs(p.x)>.8||Math.abs(p.y)>.7){const v=point.clone().sub(camera.position);(chooser||first||follower)?.aim(Math.atan2(v.x,v.z),Math.atan2(v.y,Math.hypot(v.x,v.z)));basisDirty=true;}labelSnapshot=null;};
    const element=canvas.current!;
    let down:{x:number;y:number;lastX:number;lastY:number;id:number;slop:number;touch:boolean;dragged:boolean}|null=null;
    let lastHover=0,basisDirty=false;
    function pickAt(x:number,y:number,precise=cueState.current.input==='mouse'){
      if(!canvas.current)return;
      const rect=canvas.current.getBoundingClientRect();
      raycaster.setFromCamera(new T.Vector2((x-rect.left)/rect.width*2-1,1-(y-rect.top)/rect.height*2),camera);
      const member=latest.current?.room.members.find(m=>m.id===latest.current?.self.id);
      const objects=room.objectTargets.filter(o=>!(o.userData.station==='fridge'&&member?.station==='fridge'));
      const hits=raycaster.intersectObjects([...room.interactionTargets(),...room.portalTargets,...objects,...room.seatTargets.filter(o=>o.userData.seat!==member?.seat),...room.seatMarkers.markers],true);
      const surface=selectionSurface(raycaster.intersectObjects(room.scene.children,true),room.scene);
      const hit=pickSceneTarget(hits,surface,room.scene,area,precise);
      return {hit:hit?.object.userData.seat===member?.seat?undefined:hit,surface};
    }
    function hitAt(x:number,y:number){return pickAt(x,y)?.hit;}
    function markerClear(marker:T.Object3D){
      const direction=marker.position.clone().sub(camera.position),distance=direction.length();
      raycaster.set(camera.position,direction.normalize());
      const surface=selectionSurface(raycaster.intersectObjects(room.scene.children,true),room.scene);
      return !surface||surface.distance>=distance-.06;
    }
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
        if(d.dragged&&(chooser||follower||first)){const rect=element.getBoundingClientRect();(chooser||follower||first)!.drag(e.clientX-d.lastX,e.clientY-d.lastY,rect.width,rect.height);basisDirty=true;setHovered(null);element.style.cursor='grabbing';}
        d.lastX=e.clientX;d.lastY=e.clientY;return;
      }
      if(e.pointerType==='touch'||performance.now()-lastHover<80)return;lastHover=performance.now();
      const hit=pickAt(e.clientX,e.clientY,true)?.hit,data=hit?.object.userData;
      const self=latest.current?.room.members.find(m=>m.id===latest.current?.self.id),approach=data?.station&&(self?.station!==data.station||self&&room.pose(self.id)?.moving);
      setHovered(approach?'station-'+data.station:data?.action?'action-'+data.action:data?.portal?'portal-'+data.portal:data?.station?'station-'+data.station:data?.seat!=null?'seat-'+data.seat:null);element.style.cursor=hit?'pointer':'grab';
    };
    const pointerUp=(e:PointerEvent)=>{
      const start=down;if(!start||start.id!==e.pointerId)return;
      down=null;element.style.cursor='grab';
      if(element.hasPointerCapture(e.pointerId))element.releasePointerCapture(e.pointerId);
      if(start.dragged||Math.hypot(e.clientX-start.x,e.clientY-start.y)>start.slop)return;
      const pick=pickAt(start.touch?start.x:e.clientX,start.touch?start.y:e.clientY,!start.touch);
      if(!pick)return;
      const {hit,surface}=pick;
      if(interactionState.current.movementMode&&!interactionState.current.destinationList){
        let index=hit?.object.userData.seat;
        if(index==null){
          const rect=element.getBoundingClientRect();let best=26;
          room.seatMarkers.markers.forEach((marker,i)=>{if(!marker.visible)return;const p=marker.position.clone().project(camera),x=rect.left+(p.x+1)*rect.width/2,y=rect.top+(1-p.y)*rect.height/2,d=Math.hypot(x-e.clientX,y-e.clientY);if(p.z>0&&p.z<1&&d<best&&markerClear(marker)){index=i;best=d;}});
        }
        if(index!=null&&!latest.current?.room.members.some(m=>m.seat===index))void actions.current.chooseSeat(index);else actions.current.onCancelMove();
        return;
      }
      // A steering request may still be in flight when an object is tapped.
      // Stop it first, then use the latest render's action callbacks.
      if(keyboard.active&&(hit?.object.userData.station||hit?.object.userData.seat!=null)){
        const data={...hit.object.userData},generation=++intentGeneration.current;pendingUse.current=null;
        void keyboard.stop().then(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()))).then(()=>{
          if(generation!==intentGeneration.current)return;
          if(data.station)void actions.current.chooseObject(data.station,data.action??data.station);
          else if(!latest.current?.room.members.some(m=>m.seat===data.seat))void actions.current.chooseSeat(data.seat);
        });return;
      }
      const retargeting=floorInFlight.current&&!hit&&surface?.object.userData.walkSurface;
      if(actions.current.disabled&&!retargeting&&hit?.object.userData.action!=='cup')return;
      if(hit?.object.userData.smokingSeat!=null){
        const own=latest.current?.room.members.find(m=>m.id===latest.current?.self.id),index=hit.object.userData.smokingSeat;
        if(own?.seat!==index){
          if(latest.current?.room.members.some(m=>m.seat===index)){setWalkHint('동료가 쉬고 있는 자리예요.');return;}
          void actions.current.chooseSeat(index);return;
        }
      }
      if(hit?.object.userData.action){dismissHint();setIntro(false);const data=hit.object.userData,m=latest.current?.room.members.find(m=>m.id===latest.current?.self.id);if(data.station&&(m?.station!==data.station||m&&room.pose(m.id)?.moving))void actions.current.chooseObject(data.station,data.action);else void actions.current.onUse(data.action);return;}
      if(hit?.object.userData.portal){void actions.current.choosePortal(hit.object.userData.portal);return;}
      if(hit?.object.userData.station){void actions.current.chooseObject(hit.object.userData.station,hit.object.userData.station);return;}
      if(hit?.object.userData.seat!=null){const index=hit.object.userData.seat;
        if(latest.current?.room.members.some(m=>m.seat===index)){setWalkHint('이미 누군가 앉아 있는 자리예요.');return;}
        void actions.current.chooseSeat(index);return;
      }
      const destination=surface?.object.userData.walkSurface?floorDestination(surface.point,area):null;
      if(destination){
        const marker=floorTap.current,rect=element.getBoundingClientRect();
        if(marker){
          marker.style.left=(e.clientX-rect.left)+'px';marker.style.top=(e.clientY-rect.top)+'px';
          marker.getAnimations().forEach(animation=>animation.cancel());
          marker.animate([{opacity:1,offset:0},{opacity:1,offset:.65},{opacity:0}],{duration:500});
        }
        void actions.current.onMove(destination.x,destination.z);
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
      const controls=chooser||follower||first;if(!controls||e.ctrlKey||e.metaKey||e.altKey)return;
      const delta:Record<string,[number,number]>={ArrowLeft:[.12,0],ArrowRight:[-.12,0],ArrowUp:[0,.08],ArrowDown:[0,-.08]};
      if(e.key==='Escape'){e.preventDefault();if(interactionState.current.movementMode)actions.current.onCancelMove();else if(keyboard.active)void keyboard.stop();else void actions.current.onStand();return;}
      if(e.key==='Home'){e.preventDefault();controls.aim(Math.PI,-.13);basisDirty=true;return;}
      if(delta[e.key]){e.preventDefault();setHovered(null);controls.turn(...delta[e.key]);basisDirty=true;}
    };
    const forward=new T.Vector3(),right=new T.Vector3(),visibleForward=new T.Vector3();
    const captureKeyboardBasis=()=>{camera.getWorldDirection(forward);right.setFromMatrixColumn(camera.matrixWorld,0);basisDirty=false;};captureKeyboardBasis();
    const keyboardBlocked=()=>!actions.current.keyboardEnabled||actions.current.tvOpen||document.hidden||Boolean(document.querySelector('dialog[open],details[open]'))||Boolean(document.activeElement?.closest('input,textarea,select,[contenteditable=true],[role=textbox]'));
    const keyboard=createKeyboardWalk({ready:()=>actions.current.inputReady(),direction:keys=>{if(keyboardBlocked())return null;return keyboardVector(keys,forward,right);},move:async direction=>{const current=latest.current,m=current?.room.members.find(m=>m.id===current.self.id);if(m?.seat!=null&&!room.pose(m.id)?.moving)origin.current=m.seat;pendingUse.current=null;intentGeneration.current++;room.destination.clear();return await actions.current.onSteer(direction);},stop:()=>actions.current.onStand()});
    stopKeyboard.current=()=>keyboard.stop();
    const walkKeyDown=(event:KeyboardEvent)=>{if(event.code==='Escape'&&keyboard.active&&!keyboardBlocked()){event.preventDefault();void keyboard.stop();return;}if(!movementCodes.has(event.code)||event.ctrlKey||event.metaKey||event.altKey||keyboardBlocked())return;event.preventDefault();if(!event.repeat){captureKeyboardBasis();keyboard.press(event.code);void keyboard.tick(performance.now());}};
    const walkKeyUp=(event:KeyboardEvent)=>{if(!movementCodes.has(event.code))return;captureKeyboardBasis();keyboard.release(event.code);void keyboard.tick(performance.now());};
    const stopWalking=()=>{void keyboard.stop();};
    const focusWalking=()=>{if(keyboardBlocked())stopWalking();};
    window.addEventListener('keydown',walkKeyDown);window.addEventListener('keyup',walkKeyUp);window.addEventListener('blur',stopWalking);document.addEventListener('visibilitychange',stopWalking);document.addEventListener('focusin',focusWalking);
    element.addEventListener('pointerdown',pointerDown);element.addEventListener('pointermove',pointerMove);element.addEventListener('pointerup',pointerUp);element.addEventListener('pointercancel',pointerCancel);element.addEventListener('lostpointercapture',pointerCancel);element.addEventListener('pointerleave',pointerLeave);element.addEventListener('keydown',keyDown);
    const gameSpace=container.current!.closest('.game-space');
    const overlayObserver=area==='smoking'&&gameSpace?new MutationObserver(records=>{
      if(records.some(r=>r.target instanceof Element&&r.target.closest('.terrace-thoughts,.smoking-action')||
        [...r.addedNodes,...r.removedNodes].some(n=>n instanceof Element&&n.matches('.terrace-thoughts,.smoking-action'))))labelSnapshot=null;
    }):null;
    if(overlayObserver&&gameSpace)overlayObserver.observe(gameSpace,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});
    const observer=new ResizeObserver(resize);observer.observe(container.current!);
    const intersection=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??true;});intersection.observe(container.current!);
    function frame(time:number){
      const reduced=reduceRef.current;
      if(!container.current||!canvas.current)return;
      if(keyboardBlocked()&&keyboard.active)void keyboard.stop();
      const active=visible&&!document.hidden&&!actions.current.tvOpen&&!document.querySelector('dialog[open]');room.active(active);
      if(active&&time>=nextFrame-.5){
        const current=latest.current,self=current?.self.id,pose=self?room.pose(self):null,f=framingRef.current,dt=last?(time-last)/1000:1/30;
        chooser?.update(dt,reduced);
        if(first&&isPersonal(f)){first.anchor(eyeFor(f));first.update(dt,reduced);}
        if(third&&f==='third'&&pose)third.follow(pose,dt,reduced);
        if(follower&&pose){const station=current?.room.members.find(m=>m.id===self)?.station;follower.follow({...pose,stableHeading:f==='walking',steering:keyboard.keys.size>0,focus:f==='walking'?null:station==='fridge'?fridgeShelfView:station?stations[station]:null},dt,reduced);}
        if(basisDirty || (keyboard.keys.size && bearingChanged(forward,camera.getWorldDirection(visibleForward)))) {
          captureKeyboardBasis();
        }
        void keyboard.tick(time);
        room.firstPerson(first?self??null:null,foodRef.current);room.tick(time,current,reduced);
        room.reveal(camera,(follower||f==='third')&&pose?pose:null,reduced);
        room.foreground(camera,current,Boolean(first)&&!foodRef.current,null,reduced);
        const choice=interactionState.current,h=choice.hovered?.startsWith('seat-')?Number(choice.hovered.slice(5)):null;room.seatMarkers.update(current,choice.movementMode&&!choice.destinationList,h,camera,container.current.clientHeight);
        Object.assign(container.current!.dataset,{cameraX:camera.position.x.toFixed(4),cameraY:camera.position.y.toFixed(4),cameraZ:camera.position.z.toFixed(4),cameraFov:camera instanceof T.PerspectiveCamera?String(camera.fov):'ortho',cameraYaw:(chooser||follower||first)?.angles.yaw.toFixed(4)??'',cameraPitch:(chooser||follower||first)?.angles.pitch.toFixed(4)??'',actorX:pose?.x.toFixed(3)??'',actorZ:pose?.z.toFixed(3)??''});
        const now=room.now(),animated=current?.room.members.some(m=>m.motion&&m.motion.endsAt>now||now-m.actionAt<4500||m.pantry.coffee.stage==='brewing'||Boolean(m.pantry.rest.tea?.pourAt));
        if(shadowState!==current||animated&&time-shadowTime>100){renderer.shadowMap.needsUpdate=true;shadowState=current;shadowTime=time;}
        const cue=JSON.stringify([cueState.current,framingRef.current,foodRef.current,reduced]);
        if(time-labelTime>120&&(labelSnapshot!==current||area==='smoking'&&animated||labelCue!==cue||!labelCamera.equals(camera.matrixWorld))){positionLabels();labelTime=time;labelSnapshot=current;labelCue=cue;labelCamera.copy(camera.matrixWorld);}
        if(brewProgress.current){const c=current?.self.pantry.coffee;brewProgress.current.value=coffeePhase(c?.stage,c?.readyAt??0,now).progress;}
        renderer.render(room.scene,camera);last=time;nextFrame=Math.max(nextFrame+frameInterval,time+frameInterval*.25);container.current.dataset.destination=room.destination.status;
      }
      raf=requestAnimationFrame(frame);
    }
    const lost=(e:Event)=>{e.preventDefault();setError('3D 화면 연결이 끊겼어요. 도트 화면으로 이어갈 수 있어요.');};element.addEventListener('webglcontextlost',lost);
    resize();setReady(true);raf=requestAnimationFrame(frame);
    return()=>{if(previousOwner&&follower)cameraMemory.set(previousOwner+'/'+area,follower.angles);void keyboard.stop().finally(()=>keyboard.dispose());stopKeyboard.current=async()=>{};window.removeEventListener('keydown',walkKeyDown);window.removeEventListener('keyup',walkKeyUp);window.removeEventListener('blur',stopWalking);document.removeEventListener('visibilitychange',stopWalking);document.removeEventListener('focusin',focusWalking);cancelAnimationFrame(raf);overlayObserver?.disconnect();observer.disconnect();intersection.disconnect();element.removeEventListener('webglcontextlost',lost);element.removeEventListener('pointerdown',pointerDown);element.removeEventListener('pointermove',pointerMove);element.removeEventListener('pointerup',pointerUp);element.removeEventListener('pointercancel',pointerCancel);element.removeEventListener('lostpointercapture',pointerCancel);element.removeEventListener('pointerleave',pointerLeave);element.removeEventListener('keydown',keyDown);room.dispose();reflection.dispose();renderer.dispose();renderer.forceContextLoss();world.current=null;cameraUpdate.current=null;lookAtSea.current=null;pointView.current=null;};
  },[area]);
  const ref=(key:string)=>(el:HTMLElement|null)=>{if(el)labels.current.set(key,el);else labels.current.delete(key);};
  const hoverStation=stationInArea(area,hovered?.startsWith('station-')?hovered.slice(8):null),hoverSeat=hovered?.startsWith('seat-')?Number(hovered.slice(5)):null;
  const hoverOwner=state?.room.members.find(m=>m.id!==state.self.id&&(hoverStation?m.station===hoverStation:hoverSeat!=null&&m.seat===hoverSeat));
  const hoverText=hovered?.startsWith('action-')&&state?directAction(state,hovered.slice(7))?.label??'':hovered?.startsWith('portal-')?(exits.find(e=>e.to===hovered.slice(7))?.name??portal.name)+(area==='healing'&&(state?.self.pantry.rest.sand?.held||state?.self.pantry.rest.vase?.held)?' · 내 휴식 도구는 여기에 보관돼요':' · 눌러서 이동'):hovered?(hoverStation?stations[hoverStation]?.name??map.name:`${(hoverSeat??0)+1}번 자리`)+(hoverOwner?' · 이용 중':(hoverStation===me?.station&&!moving?' · '+(state?directAction(state,hoverStation!)?.label??'천천히 기다려요':''):' · 눌러서 이동')):input==='touch'?'손가락으로 밀어 둘러보기':input==='keyboard'?'방향키로 둘러보기 · Home은 풍경':'드래그로 둘러보기';
  const destination=me?.travel?exits.find(e=>e.to===me.travel!.to)?.name:objectTarget?stations[objectTarget]?.name??null:target!=null?`${target+1}번 자리`:null;
  const showFloorHint=showHint&&Boolean(me)&&me?.seat==null&&!me?.station&&!moving;
  return <>
    <div className={`room-frame room-three framing-${framing} ${warm?'late-light':''}`} ref={container}>
      <canvas ref={canvas} className="room-three-canvas" tabIndex={0} role="img" aria-label={input==='touch'?'내 눈높이의 휴식 공간. 손가락으로 밀어 둘러보고 사물을 톡 누르면 이동해요.':input==='keyboard'?'내 눈높이의 탕비실. 방향키로 둘러보고 Home으로 풍경을 봅니다.':'내 눈높이의 탕비실. 드래그로 둘러보고 사물을 누르면 이동합니다.'} data-ready={ready} data-landscape={landscape} data-playback={playback} data-view={landscapeId}/>
      <span ref={floorTap} className="floor-tap-feedback" aria-hidden="true"/>
      <video ref={seaVideo} className="sea-video-source" muted playsInline preload="none" aria-hidden="true" tabIndex={-1}/>
      <div className="scene-toolbar"><div className="scene-label">{moving?(destination?destination+' · 이동 중':'이동 중'):me?.station?stations[me.station]?.name??map.name:map.name}{debug&&<span className="scene-label-sub">{frames[study]}</span>}</div><button className="sea-sound-toggle" aria-pressed={waves} onClick={onWaves}>{waves?'파도 소리 끄기':'파도 소리 켜기'}</button></div>
      {playback==='fallback'&&<span className="sea-playback-note" role="status">지금은 고요한 풍경으로 쉬어가요.</span>}
      {!ready&&!error&&<div className="three-message">창가의 빛을 들이는 중…</div>}
      {error?<div className="three-message" role="alert"><p>{error}</p><button className="primary" onClick={onFallback}>도트로 이어가기</button>{area!=='pantry'&&<button disabled={disabled} onClick={()=>void choosePortal()}>탕비실로 돌아가기</button>}</div>:<>
        {debug&&<><button ref={ref('shelf')} className="hotspot three-hotspot" onClick={onShelf} disabled={disabled}>오늘의 레몬파이</button><button ref={ref('drink')} className="hotspot three-hotspot" onClick={onDrink} disabled={disabled}>한 잔</button></>}
        {!debug&&state&&!tvOpen&&!foodInHand&&<ObjectAccess state={state} disabled={disabled} moving={moving} sampleAvailable={sampleAvailable} onUse={id=>void useNearObject(id)} onSeat={id=>void chooseSeat(id)} anchor={ref} onFocus={id=>{setHovered(id);if(id)focusObject.current?.(id);}}/>}
        {state?.room.members.filter(m=>debug||m.id!==state.self.id).map(m=><div ref={ref(m.id)} key={m.id} className={`visitor-name three-name ${!m.connected?'reconnecting':''}`}><span className="presence-dot"/>{m.name}</div>)}
      </>}
      {onTv&&!tvOpen&&<button className="tv-entry" disabled={disabled||moving||me?.seat==null} onClick={onTv}>TV 함께 보기</button>}
      {!debug&&!tvOpen&&!foodInHand&&state&&area!=='smoking'&&!moving&&!tabledDrink&&<div ref={context} className={'object-context'+(me?.station?' at-station':' held-context')} aria-label="가까이 있는 물건">
        {arrival&&me?.station&&!(me.station==='coffee'&&state.self.pantry.coffee.stage==='brewing')&&<span className="arrival-note" role="status">도착했어요</span>}
        {me?.station==='coffee'&&state.self.pantry.coffee.stage==='brewing'&&<div className="brew-feedback"><span role="status">커피가 차오르고 있어요</span><progress ref={brewProgress} max={1} value={0} aria-label="커피 추출"/></div>}
        {(me?.station||heldName(state.self.pantry)||state.self.pantry.rest.stone||state.self.pantry.rest.tea||state.self.pantry.rest.sand||state.self.pantry.rest.vase||state.self.pantry.candy&&state.self.pantry.candy.state!=='eaten'||state.self.pantry.bottle&&state.self.pantry.bottle.sips<3)&&<details className="object-options" onKeyDown={e=>{if(e.key==='Escape'){e.currentTarget.open=false;e.currentTarget.querySelector('summary')?.focus();e.stopPropagation();}}} onToggle={e=>{if(e.currentTarget.open)dismissHint();}}><summary aria-label="이 물건의 다른 행동">{me?.station||heldName(state.self.pantry)?'더보기':'내 물건'}</summary><div className="object-options-panel">{contextContent}</div></details>}
      </div>}
      {!debug&&!tvOpen&&<div className={'room-assist'+(me?.station?' at-object':'')+(foodInHand?' with-wrapper':'')}>
        {!foodInHand&&moving&&<button disabled={disabled} onClick={()=>void stand()}>멈추기</button>}
        <button ref={moveButton} className="move-primary" disabled={disabled} aria-pressed={movementMode} onClick={movementMode?closeDestinations:openDestinations}><svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true"><path d="M3 10h13m-5-5 5 5-5 5M3 4v12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>{movementMode?'이동 취소':moving?'목적지 바꾸기':'자리 옮기기'}</button>{movementMode&&<button className="destination-list-toggle" aria-haspopup="dialog" onClick={()=>setDestinationList(true)}>목록으로 고르기</button>}
      </div>}
      {!debug&&!tvOpen&&!foodInHand&&(movementMode&&!destinationList||intro||showFloorHint||walkHint||hovered)&&<div className="direct-hint" role="status">{walkHint||(movementMode?'빈 의자를 눌러 앉아요':hovered?hoverText:intro?'물건은 톡 누르고, 풍경은 밀어서 둘러봐요':input==='touch'?'바닥을 누르면 걸어가요':'WASD로 걷거나 바닥을 누르세요')}{showFloorHint&&!hovered&&<button aria-label="조작 안내 닫기" onClick={dismissHint}>×</button>}</div>}
      {windowContent}
      {debug&&<div className="camera-switch" role="group" aria-label="개발용 시점">{(Object.keys(frames) as Study[]).map(f=><button key={f} aria-pressed={study===f} onClick={()=>setStudy(f)}>{frames[f]}</button>)}</div>}
      {debug&&<button className="light-switch" onClick={()=>setWarm(v=>!v)}>조명 비교</button>}
    </div>
    <div className={"room-navigation"+(foodInHand?" food-navigation":"")}>
    {state&&!foodInHand&&!tvOpen&&movementMode&&destinationList&&<ExploreDestinations onTravel={choosePortal} state={state} disabled={disabled} moving={moving} canReturn={origin.current!=null&&!originOwner&&(me?.seat!==origin.current||moving)} onReturn={returnToRest} onStand={stand} onClose={closeDestinations} onSelected={onFinishMove} onSeat={chooseSeat} onObject={chooseObject}/>}</div>
    {debug&&sampleAvailable&&!moving&&<button className="shared-sample-action secondary" onClick={onPlate} disabled={disabled}>{sampleLabel}</button>}
    {debug&&moving&&<div className="walk-actions" role="group" aria-label="이동 중"><button className="secondary" disabled={disabled} onClick={()=>{setTarget(null);setObjectTarget(null);void stand();}}>멈추기</button>{origin.current!=null&&!originOwner&&<button className="secondary" disabled={disabled} onClick={()=>void chooseSeat(origin.current!)}>원래 자리로</button>}</div>}
  </>;
}
