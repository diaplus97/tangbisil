import {lazy,Suspense,useEffect,useRef,useState,type ReactNode} from 'react';
import {Room,Avatar} from './Room';
import {getSpace} from '../../shared/space.mjs';
import {heldName} from '../../shared/rest.mjs';
import {ToolsDockContext,closeOtherPickers} from './PersonalItems';
import {directAction} from './directActions';
import {StationActions} from './StationActions';
import {SnackTray} from './SnackTray';
import {usePantry,roomId} from './usePantry';
import {enableSound,playSound,setSoundVolume,setBiteSound,setOtherSounds,setSeaSound,setSeaVolume,setActionSounds,stopRoomSounds} from './sound';
import {useRoomSound} from './useRoomSound';
import {drawFood} from './pixelArt';
import {tvQueue,type LandscapeId} from '../../shared/room-media.mjs';
import './shared-tv.css';
import './experience.css';
import './play.css';
import './first-person.css';
import './direct-room.css';
const VaseStage=lazy(()=>import('./VaseStage'));
const SandStage=lazy(()=>import('./SandStage'));
const StoneStage=lazy(()=>import('./StoneStage'));
const Room3D=lazy(()=>import('./Room3D'));
const SharedTV=lazy(()=>import('./SharedTV'));
const landscapeLabels={sea:'바다',forest:'숲',fire:'모닥불'};
function preference(key:string){try{return localStorage.getItem(key);}catch{return null;}}

function Icon({name}:{name:string}){
 const paths:Record<string,ReactNode>={
   sliders:<><path d="M4 7h16M4 17h16M8 4v6m8 4v6"/></>,
   cup:<><path d="M4 8h12v9a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3zM16 9h2a3 3 0 0 1 0 6h-2M7 3v2m4-3v3m4-2v2"/></>,
   pie:<><path d="M3 8 12 3l9 5v11H3zM3 8h18M3 13h18M8 8v11m8-11v11"/></>,
   album:<><path d="M4 4h16v17H4zM8 4v17M12 8h4m-4 4h4M4 8H2m2 8H2"/></>,
   people:<><circle cx="8" cy="7" r="3"/><path d="M2 21v-5a6 6 0 0 1 12 0v5M16 4a3 3 0 0 1 0 6m1 3a5 5 0 0 1 5 5v3"/></>,
   sound:<><path d="m3 9 4 0 5-5v16l-5-5H3zM16 7a7 7 0 0 1 0 10m3-13a11 11 0 0 1 0 16"/></>,
   mute:<><path d="m3 9 4 0 5-5v16l-5-5H3zM17 9l5 6m0-6-5 6"/></>,
   share:<><path d="M9 15 15 9M8 16l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 10a4 4 0 0 0 6 0l4-4a4 4 0 0 0-6-6l-1 1"/></>,
   close:<path d="m5 5 14 14M19 5 5 19"/>,
   help:<><circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 4 3c-1 1-1 1-1 3m0 2v1"/></>,
 };
 return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]??paths.cup}</svg>;
}
function Modal({title,eyebrow,children,onClose,wide=false}:{title:string;eyebrow:string;children:ReactNode;onClose:()=>void;wide?:boolean}){
 const ref=useRef<HTMLDialogElement>(null),close=useRef(onClose);close.current=onClose;
 useEffect(()=>{ref.current?.showModal();return()=>ref.current?.close();},[]);
 return <dialog ref={ref} className={`dialog ${wide?'wide':''}`} aria-label={title} onCancel={()=>close.current()} onClick={e=>{if(e.target===ref.current){const r=ref.current.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close.current();}}}>
   <header className="dialog-head"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="닫고 탕비실로 돌아가기"><Icon name="close"/></button></header>{children}
 </dialog>;
}
function PiePreview(){const ref=useRef<HTMLCanvasElement>(null);useEffect(()=>{drawFood(ref.current!.getContext('2d')!,0,0,false,false,900);},[]);return <canvas className="pie-preview" ref={ref} width="320" height="200" aria-label="레몬 글라세 샌드파이"/>;}

export default function Experience(){
 const{state,status,error,busy,enter,act,contact,retry,clearError}=usePantry();
 const debug=new URLSearchParams(location.search).get('dev')==='1';
 const[name,setName]=useState(''),[avatar,setAvatar]=useState(0);
 const[panel,setPanel]=useState<'food'|'album'|'drink'|'help'|'settings'|'tv'|null>(null),[movementMode,setMovementMode]=useState(false);
 const[tvOpen,setTvOpen]=useState(false);
 const[landscapeChoice,setLandscapeChoice]=useState<'auto'|LandscapeId>(()=>{const value=preference('tangbisil:landscape');return value==='sea'||value==='forest'||value==='fire'?value:'auto';});
 const[sound,setSound]=useState(false),[toast,setToast]=useState('');
 const[volume,setVolume]=useState(.6),[actionSounds,setActions]=useState(true),[mouth,setMouth]=useState(false),[others,setOthers]=useState(true),[audioStatus,setAudioStatus]=useState('');
 const[seaMotion,setSeaMotion]=useState(()=>{const value=preference('tangbisil:landscape-motion');return value===null?!matchMedia('(prefers-reduced-motion: reduce)').matches:value==='on';}),[waves,setWaves]=useState(false),[waveVolume,setWaveVolume]=useState(.4);
 const waveTicket=useRef(0),motionOverride=useRef(preference('tangbisil:landscape-motion')!==null);
 useEffect(()=>{const preference=matchMedia('(prefers-reduced-motion: reduce)'),change=()=>{if(!motionOverride.current)setSeaMotion(!preference.matches);};preference.addEventListener('change',change);return()=>preference.removeEventListener('change',change);},[]);
 async function toggleWaves(){
   const on=!waves,ticket=++waveTicket.current;setWaves(on);setAudioStatus('');
   if(!on){await setSeaSound(false);return;}
   if(!sound){const audioTicket=++soundTicket.current;setSound(true);const ready=await enableSound(true);if(ticket!==waveTicket.current||audioTicket!==soundTicket.current)return;if(!ready){setWaves(false);setSound(false);setAudioStatus('소리를 준비하지 못했어요. 다시 시도해 주세요.');return;}}
   if(ticket!==waveTicket.current)return;
   setAudioStatus('파도 소리를 준비하고 있어요.');const ok=await setSeaSound(true);
   if(ticket!==waveTicket.current)return;
   if(!ok){setWaves(false);setAudioStatus('파도 소리를 불러오지 못했어요. 다시 켜서 시도해 주세요.');}else setAudioStatus('');
 }
 const menu=useRef<HTMLDetailsElement>(null),soundTicket=useRef(0);useRoomSound(state,status==='online'&&!tvOpen);
 useEffect(()=>{if(tvOpen){++waveTicket.current;setAudioStatus('');stopRoomSounds();void setSeaSound(false);}else if(waves&&sound)void setSeaSound(true);},[tvOpen]);
 async function chooseSound(mode:'mute'|'waves'|'all'){
   const ticket=++soundTicket.current;++waveTicket.current;const on=mode!=='mute';
   setSound(on);setWaves(on);setActions(mode==='all');setActionSounds(mode==='all');setAudioStatus(on?'소리를 준비하고 있어요.':'');
   const ok=await enableSound(on);if(ticket!==soundTicket.current)return;
   const seaOk=ok&&on?await setSeaSound(true):ok;if(ticket!==soundTicket.current)return;
   if(!ok||!seaOk){setSound(false);setWaves(false);await enableSound(false);setAudioStatus('소리를 준비하지 못했어요. 다시 눌러 주세요.');}else setAudioStatus('');
 }

 const[view,setView]=useState<'pixel'|'3d'>(()=>new URLSearchParams(location.search).get('view')==='pixel'?'pixel':'3d');
 function changeView(next:'pixel'|'3d'){setView(next);const url=new URL(location.href);url.searchParams.set('view',next);history.replaceState(null,'',url);}
 useEffect(()=>{if(status!=='online')stopRoomSounds();},[status]);
 const online=status==='online',me=state?.self,food=me?.serving,hasFood=Boolean(food&&food.state!=='empty'),lemonRecord=me?.discoveries.find(d=>d.snack_id==='lemon-sandwich-pie'),candyRecord=me?.discoveries.find(d=>d.snack_id==='honey-lemon-candy'),discovered=Boolean(lemonRecord);
 const area=state?.room.area??'pantry',space=getSpace(area),healing=area==='healing';
 const landscapeId=landscapeChoice==='auto'?(state?.room.media?.landscape??'sea'):landscapeChoice;
 useEffect(()=>{if(!healing||!online)setTvOpen(false);},[healing,online]);
 useEffect(()=>{if(healing&&view==='pixel')changeView('3d');},[healing,view]);
 const member=state?.room.members.find(m=>m.id===me?.id),walking=Boolean(member?.travel||member?.motion&&state&&member.motion.endsAt>state.serverTime);
 useEffect(()=>{if(walking)setTvOpen(false);},[walking]);
 const [toolsHost,setToolsHost]=useState<HTMLElement|null>(null);
 const hasObjects=Boolean(healing||me?.pantry.rest?.sand||me?.pantry.rest?.stone||me?.pantry.rest?.tea||me?.pantry?.candy&&me.pantry.candy.state!=='eaten'||me?.pantry?.bottle&&me.pantry.bottle.sips<3);
 const trayOpen=Boolean(state&&panel==='food'&&!walking&&!member?.station),own=state?.room.offers.find(o=>o.owner_id===me?.id);
 const availableSample=!hasFood?state?.room.offers.find(o=>o.owner_id!==me?.id&&!o.claimed):undefined;
 const resumeLabel=food?.state==='sealed'?(food.open_progress>0?'뜯던 간식 집기':'꺼낸 간식 집기'):'먹던 간식 집기';
 function closeMenu(){if(menu.current)menu.current.open=false;}
 function openPanel(next:typeof panel){closeMenu();setPanel(next);setMovementMode(false);}
 function putDown(){playSound('putdown');setPanel(null);requestAnimationFrame(()=>document.getElementById('pick-up-snack')?.focus({preventScroll:true}));}
 async function sample(){if(!availableSample)return;closeMenu();if(me&&heldName(me.pantry)&&!await act('items-stow'))return;const r=await act('sample',{offerId:availableSample.id});if(r){setPanel('food');setMovementMode(false);playSound('cup');}}
 useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(''),4500);return()=>clearTimeout(t);},[toast]);
 useEffect(()=>{const outside=(e:PointerEvent)=>{if(menu.current&&!menu.current.contains(e.target as Node))menu.current.open=false;};document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside);},[]);
 function explore(){closeMenu();setPanel(null);setMovementMode(true);}
 const held=me?heldName(me.pantry):null,snackLabel=(held?held+' 내려놓고 ':'')+(hasFood?resumeLabel:'간식 꺼내기');
 async function take(){if(member?.station&&!await act('stand'))return;if(held&&!await act('items-stow'))return;setMovementMode(false);if(hasFood){setPanel('food');return;}const r=await act('take');if(r){setPanel('food');playSound('paper');}}
 async function useObject(target:string){if(!state||busy||!online)return;const action=directAction(state,target);if(!action)return;if(action.type==='snack')return take();if(action.type==='shared')return sample();const result=await act(action.type,action.extra);if(result&&action.type==='candy-unwrap')playSound('open');return result;}
 async function bite(){const r=await act('bite',{servingId:food?.id});if(r)playSound('bite');return r;}
 async function offer(){const r=await act('offer');if(r)playSound('cup');return r;}
 async function copyInvite(){closeMenu();const url=new URL(location.href);url.search='';url.searchParams.set('room',roomId);try{await navigator.clipboard.writeText(url.href);setToast('함께 앉을 수 있는 링크를 복사했어요.');}catch{setPanel('help');}}
 const guide=hasFood?(food?.state==='sealed'?'꺼내 둔 간식이 기다리고 있어요.':'먹던 간식은 그대로 남아 있어요.'):'간식을 꺼내 포장을 열어보세요.';
 return <ToolsDockContext.Provider value={toolsHost}><main className={'pantry-app play-mode view-'+view+(debug?' dev-mode':view==='3d'?' first-person-mode':'')+(trayOpen?' snack-active':'')+(tvOpen?' tv-active':'')+(status==='welcome'?' is-welcome':'')}>
   <header className="app-header">
     <a className="brand" href={location.pathname+location.search} aria-label="탕비실"><span className="brand-mark"><Icon name="cup"/></span><span>{healing?'힐링방':'탕비실'}<small>{online?'함께 쉬는 중 · '+state?.room.members.filter(m=>m.connected).length+'명':'잠깐 쉬어가요'}</small></span></a>
     <div className="header-controls">
       <span className={'connection '+(online?'live':'')} role="status"><i/>{online?'여기 '+state?.room.members.filter(m=>m.connected).length+'명 · 전체 '+(state?.room.total??state?.room.members.length)+'명':status==='welcome'?'잠깐 쉬어가요':status==='paused'?'잠시 쉬는 중':status==='offline'?'다시 연결 중':'자리를 찾는 중'}</span>
       <button className="sound-toggle" aria-label={sound?'소리 끄기':'소리 켜기'} aria-pressed={sound} onClick={()=>void chooseSound(sound?'mute':'all')}><Icon name={sound?'sound':'mute'}/><span>{sound?'소리 켜짐':'소리 끔'}</span></button>
       <button className="desktop-help" onClick={()=>openPanel('help')}>도움말</button><button className="desktop-settings" onClick={()=>openPanel('settings')}>설정</button>
       <details ref={menu} className="play-menu" onToggle={e=>{if(e.currentTarget.open)closeOtherPickers(e.currentTarget);}} onKeyDown={e=>{if(e.key==='Escape'){closeMenu();menu.current?.querySelector('summary')?.focus();}}}>
         <summary>메뉴 <span aria-hidden="true">⋯</span></summary>
         <nav className="play-menu-content" aria-label="보조 메뉴">
           {me&&<button disabled={!online||busy} onClick={()=>{closeMenu();setPanel(null);void act('travel',{to:space.portal.to});}}>{space.portal.name}</button>}
           {healing&&(me?.pantry.rest.sand?.held||me?.pantry.rest.vase?.held)&&<small className="travel-storage-note">{me.pantry.rest.vase?.held?'꽃병과 꽃 배치':'모래 트레이와 선·돌'}는 힐링방에 보관돼요.</small>}
           {me&&<button onClick={()=>openPanel('album')}><Icon name="album"/>기록</button>}
           <button onClick={()=>openPanel('settings')}><Icon name="sliders"/>소리·풍경 설정</button>
           {healing&&<button onClick={()=>openPanel('tv')}>TV 안내·영상 목록</button>}
           {me&&<><button disabled={!online||busy||walking||member?.seat==null} onClick={()=>{closeMenu();setPanel(null);void (async()=>{if(held&&!await act('items-stow'))return;await act('wave');})();}}><Icon name="cup"/>{held?held+' 내려놓고 컵 들기':trayOpen?'간식 내려놓고 컵 들기':'컵 들기'}</button>
             {view==='3d'&&<button disabled={!online} onClick={explore}>갈곳 찾기</button>}
             {!healing&&availableSample&&<button disabled={!online||busy||walking||member?.seat==null} onClick={()=>void sample()}>{held?held+' 내려놓고 ':''}동료가 나눈 한 조각 맛보기</button>}
             {own&&<button disabled={!online||busy} onClick={()=>{closeMenu();void act('retract',{offerId:own.id});}}>나눈 간식 거두기</button>}
             <button onClick={()=>void copyInvite()}><Icon name="share"/>동료 초대</button></>}
           <button onClick={()=>openPanel('help')}><Icon name="help"/>이용 안내</button>
         </nav>
       </details>
     </div>
   </header>
   {audioStatus&&<p className="audio-status" role="status">{audioStatus}</p>}
   {debug&&<div className="view-bar"><span>개발용 화면 비교</span><div className="view-switch" role="group" aria-label="그림체 비교"><button aria-pressed={view==='pixel'} onClick={()=>changeView('pixel')}>2D 도트</button><button aria-pressed={view==='3d'} onClick={()=>changeView('3d')}>입체 탕비실</button></div></div>}
   <section className="game-space" aria-label="공용 탕비실">
     {view==='3d'?<Suspense fallback={<div className="room-frame three-loading">창가의 빛을 들이는 중…</div>}><Room3D onUse={useObject} contextContent={state?<StationActions state={state} busy={busy} online={online} onExplore={explore} onSnack={()=>void take()} snackLabel={snackLabel} act={act}/>:undefined} key={area} landscapeId={landscapeId} tvOpen={tvOpen} onTv={healing?()=>{closeMenu();setMovementMode(false);setPanel('tv');}:undefined} windowContent={tvOpen&&healing&&state?<Suspense fallback={<div className="shared-tv"><p>TV를 준비하고 있어요.</p><button onClick={()=>setTvOpen(false)}>그만 보기</button></div>}><SharedTV state={state} active={online&&!panel} busy={busy} act={act} onClose={()=>setTvOpen(false)}/></Suspense>:undefined} onTravel={to=>{setPanel(null);return act('travel',{to});}} onToolsMount={setToolsHost} onApproach={station=>{setPanel(null);return act('approach',{station});}} seaMotion={seaMotion&&Boolean(state)} waves={waves} onWaves={()=>void toggleWaves()} state={state} debug={debug} movementMode={movementMode} foodInHand={trayOpen} onFinishMove={()=>{setMovementMode(false);requestAnimationFrame(()=>document.querySelector<HTMLCanvasElement>('.room-three-canvas')?.focus({preventScroll:true}));}} sampleLabel={(held?held+' 내려놓고 ':'')+'동료가 나눈 한 조각 맛보기'} sampleAvailable={Boolean(availableSample)} disabled={!online||busy} onShelf={()=>void take()} onPlate={()=>void sample()} onDrink={()=>openPanel('drink')} onFallback={()=>changeView('pixel')} onMove={(x,z)=>{setPanel(null);return act('move',{x,z});}} onSit={seat=>{setPanel(null);return act('sit',{seat});}} onStand={()=>act('stand')}/></Suspense>:
       <Room state={state} simple={!debug} sampleAvailable={Boolean(availableSample)} disabled={!online||busy} onShelf={()=>void take()} onPlate={()=>void sample()} onDrink={()=>openPanel('drink')}/>}
   {view==='3d'&&!tvOpen&&state&&!trayOpen&&!walking&&member?.seat!=null&&me?.pantry.rest?.stone?.held&&<Suspense fallback={null}><StoneStage state={state} disabled={!online||busy} onPress={point=>act('stone-press',{itemId:me.pantry.rest.stone!.id,point})}/></Suspense>}
   {view==='3d'&&!tvOpen&&healing&&state&&!trayOpen&&!walking&&member?.seat!=null&&me?.pantry.rest?.vase?.held&&<Suspense fallback={null}><VaseStage vase={me.pantry.rest.vase} disabled={!online||busy} act={act}/></Suspense>}
   {view==='3d'&&!tvOpen&&healing&&state&&!trayOpen&&!walking&&member?.seat!=null&&me?.pantry.rest?.sand?.held&&<Suspense fallback={null}><SandStage state={state} disabled={!online||busy} connected={online} contact={contact} act={act}/></Suspense>}
   {!tvOpen&&trayOpen&&state&&<SnackTray state={state} appearance={view} busy={busy} online={online} onClose={putDown} onProgress={progress=>act('unwrap',{servingId:food?.id,progress})} onOpen={()=>act('open',{servingId:food?.id})} onBite={bite} onOffer={healing?undefined:offer}/>}
   </section>
   {status==='welcome'&&<section className="play-welcome" aria-label="탕비실 입장">
     <div><h1>잠깐, 쉬었다 갈까요?</h1><p>말없이 함께 앉아, 간식 한 조각.</p></div>
     <form onSubmit={e=>{e.preventDefault();void enter(name.trim()||'느긋한 동료',avatar);}}>
       <label className="welcome-name">불릴 이름 <span>선택</span><input value={name} onChange={e=>setName(e.target.value)} maxLength={12} placeholder="느긋한 동료" autoComplete="off"/></label>
       <button className="primary" disabled={busy} type="submit">{busy?'자리를 준비하는 중…':'앉아서 쉬기'} <span aria-hidden="true">↗</span></button>
       <details className="welcome-appearance"><summary>모습 고르기</summary><div className="avatar-choices">{[0,1].map(v=><button key={v} type="button" className={avatar===v?'selected':''} onClick={()=>setAvatar(v)} aria-pressed={avatar===v} aria-label={v?'베이지 셔츠 모습':'남색 카디건 모습'}><Avatar variant={v}/></button>)}</div></details>
     </form>
   </section>}
   {(view!=='3d'||debug)&&!tvOpen&&state&&!trayOpen&&!walking&&(member?.station||member?.seat!=null)&&<StationActions state={state} busy={busy} online={online} onExplore={explore} onSnack={()=>void take()} snackLabel={snackLabel} act={act}/>}
   {(view!=='3d'||debug)&&!tvOpen&&me&&!hasObjects&&!trayOpen&&!walking&&!member?.station&&member?.seat!=null&&<section className="play-next" aria-label="지금 할 수 있는 행동">
     <p>{guide}</p><button id="pick-up-snack" className="primary" onClick={()=>void take()} disabled={!online||busy}>{hasFood?resumeLabel:'간식 꺼내기'} <span aria-hidden="true">↗</span></button>
   </section>}
   {error&&<div className={'error-banner'+(status==='paused'?' connection-paused':'')} role="alert"><span>{error}</span>{status==='paused'?<div className="connection-options"><button onClick={retry}>다시 연결</button><select aria-label="다른 탕비실" defaultValue="" onChange={e=>{const url=new URL(location.href);url.searchParams.set('room',e.target.value);location.assign(url.href);}}><option value="" disabled>다른 방 고르기</option>{[['window','창가'],['breeze','바람'],['quiet','고요'],['sunset','노을']].filter(([id])=>id!==roomId).map(([id,label])=><option key={id} value={id}>{label} 탕비실</option>)}</select></div>:<button onClick={clearError} aria-label="오류 안내 닫기">×</button>}</div>}
   {toast&&<div className="toast" role="status"><span>✦</span>{toast}</div>}
   {panel==='tv'&&<Modal title="창가에서 함께 볼까요?" eyebrow="선택해서 켜는 YouTube TV" onClose={()=>setPanel(null)}><div className="tv-notice"><p>빠더너스·채널십오야·haha ha의 짧은 영상을 함께 봅니다. 2026년 11월 6일, 최근 게시일과 공개 조회·좋아요를 보고 고른 한국 채널 3편이에요. 한국 전체의 실시간 인기순위는 아닙니다. 말소리와 음악이 포함되며 처음에는 음소거로 시작해요.</p><p>켜면 YouTube 외부 플레이어와 연결되어 IP·기기 정보 등이 Google에 전달될 수 있어요. 개인정보 보호 강화 모드를 사용해도 정보 전송이 없는 것은 아닙니다.</p><p>TV 기능은 방이 함께 보는 영상 번호·시작 기준·순서를 저장합니다. YouTube 계정 로그인이나 개인별 시청 이력 수집은 하지 않아요. 광고·일시정지 때문에 재생 시점은 다를 수 있습니다.</p><ul><li><a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer">YouTube 이용약관 ↗</a></li><li><a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google 개인정보처리방침 ↗</a></li></ul><p>방 입장과 간식 기록에는 별명·브라우저 방문자 키와 게임 상태가 사용됩니다. 서버는 입장 제한을 위해 IP 해시와 당일 요청 수를 보관합니다.</p><details><summary>이번에 함께 보는 영상</summary><ul>{tvQueue.map(item=><li key={item.id}><a href={'https://www.youtube.com/watch?v='+item.id} target="_blank" rel="noopener noreferrer">{item.title} · {item.channel} ↗</a><small>{item.publishedAt} 게시 · {item.views.toLocaleString('ko-KR')}회 · 좋아요 {item.likes.toLocaleString('ko-KR')}개<br/>{item.verifiedOn} 공개 누적 수치 확인</small></li>)}</ul></details><p>다른 동료가 다음 편을 골라도 내 영상은 자연 종료까지 이어집니다. ‘함께 보기로’를 누르면 현재 함께 보는 편에 합류해요.</p><p>그만 보기는 내 화면만 풍경으로 돌려놓습니다. 간식이나 기록에 영향을 주지 않아요.</p><button className="primary" disabled={!online||busy||walking||member?.seat==null} onClick={()=>void(async()=>{if(tvOpen){setPanel(null);return;}if(await act('tv-join')){setPanel(null);setTvOpen(true);}})()}>{tvOpen?'TV로 돌아가기':'동의하고 TV 켜기'}</button></div></Modal>}
   {panel==='settings'&&<Modal title="소리·풍경 설정" eyebrow="내가 편안한 만큼" onClose={()=>setPanel(null)}><div className="settings-form">
     <div className="sound-presets" role="group" aria-label="소리 조합">
      {([['mute','무음'],['waves','파도만'],['all','파도와 행동']] as const).map(([mode,label])=><button key={mode} className="secondary" aria-pressed={mode==='mute'?!sound:sound&&waves&&(mode==='all'?actionSounds:!actionSounds)} onClick={()=>void chooseSound(mode)}>{label}</button>)}
     </div>
     <label>음량 <span>{Math.round(volume*100)}%</span><input aria-label="소리 음량" type="range" min="0" max="100" value={Math.round(volume*100)} onChange={e=>{const v=Number(e.target.value)/100;setVolume(v);setSoundVolume(v);}}/></label>
     <div className="sea-settings">
       <label className="sound-check"><input type="checkbox" checked={waves} onChange={()=>void toggleWaves()}/>파도 소리</label>
       <label>파도 음량 <span>{Math.round(waveVolume*100)}%</span><input aria-label="파도 음량" type="range" min="0" max="100" value={Math.round(waveVolume*100)} onChange={e=>{const value=Number(e.target.value)/100;setWaveVolume(value);setSeaVolume(value);}}/></label>
       <div className="landscape-choice" role="group" aria-label="내 창밖 풍경">{(['auto','sea','forest','fire'] as const).map(id=><button key={id} aria-pressed={landscapeChoice===id} onClick={()=>{setLandscapeChoice(id);try{localStorage.setItem('tangbisil:landscape',id);}catch{}}}>{id==='auto'?'방의 추천 풍경':landscapeLabels[id]}</button>)}</div><p className="landscape-note">추천은 서울 시간으로 낮에는 바다·숲, 저녁에는 모닥불을 골라요. 함께 머무는 동안 바뀌지 않습니다. 직접 고른 풍경은 내 화면에만 적용돼요.</p>
       <label className="sound-check"><input type="checkbox" disabled={landscapeId==='forest'} checked={landscapeId!=='forest'&&seaMotion} onChange={e=>{motionOverride.current=true;setSeaMotion(e.target.checked);try{localStorage.setItem('tangbisil:landscape-motion',e.target.checked?'on':'off');}catch{}}}/>풍경 움직임{landscapeId==='forest'?' · 숲은 선명한 정지 풍경':''}</label>
     </div>
     <label className="sound-check"><input type="checkbox" checked={actionSounds} onChange={e=>{setActions(e.target.checked);setActionSounds(e.target.checked);}}/>물건을 만지는 소리</label>
     <label className="sound-check"><input type="checkbox" disabled={!actionSounds} checked={others} onChange={e=>{setOthers(e.target.checked);setOtherSounds(e.target.checked);}}/>가까운 동료의 작은 소리</label>
     <label className="sound-check"><input type="checkbox" checked={mouth} onChange={e=>{setMouth(e.target.checked);setBiteSound(e.target.checked);}}/>내 간식 씹는 소리</label>
     <p>{sound?'동료의 소리는 내 소리보다 작게 들려요.':'화면 위 ‘소리 켜기’를 누르면 들을 수 있어요.'}</p>
   </div></Modal>}
   {panel==='album'&&me&&<Modal title="간식 기록" eyebrow="맛본 날의 작은 기억" onClose={()=>setPanel(null)}>
     <div className="album-page"><div className={'album-sticker '+(!discovered?'undiscovered':'')}><PiePreview/><span className="sticker-id">No. 001 / LEMON</span>{discovered&&<span className="album-stamp">맛본 날의 기록</span>}</div><h3>{discovered?'레몬 샌드파이':'아직 맛본 간식이 없어요'}</h3><p>{discovered?'레몬잼과 크림 사이, 오후에 찾은 작은 맛.':'간식을 한입 먹으면 여기에 남아요.'}</p>{discovered&&<div className="album-details"><span>첫 발견 <b>{new Date(lemonRecord!.discovered_at).toLocaleDateString('ko-KR')}</b></span><span>만난 곳 <b>{lemonRecord!.source==='shared'?'동료의 시식 접시':'창가의 간식 선반'}</b></span><span>내 탕비 예산 <b>{me.coins}</b></span></div>}{candyRecord&&<div className="candy-record"><span>🍬</span><div><strong>레몬꿀 사탕</strong><p>한 알의 달콤한 쉼표 · {new Date(candyRecord.discovered_at).toLocaleDateString('ko-KR')}</p></div></div>}<p className="small-print">같은 브라우저로 다시 오면 기록이 이어져요.</p></div>
   </Modal>}
   {panel==='drink'&&me&&<Modal title="한 잔을 준비하러 갈까요?" eyebrow="자리 고르기" onClose={()=>setPanel(null)}><div className="help-content"><p>커피 머신에 컵을 놓고 커피를 내리거나, 냉장고에서 시원한 음료를 꺼낼 수 있어요.</p><button className="primary" onClick={explore}>갈곳 찾기</button></div></Modal>}
   {panel==='help'&&<Modal title="잠깐 쉬어가는 방법" eyebrow="탕비실" onClose={()=>setPanel(null)}><div className="help-content"><p>앉아 있을 때도 손가락으로 화면을 밀거나 마우스로 드래그해 주변을 둘러보세요. 키보드 방향키도 사용할 수 있어요. 바닥을 톡 누르면 그곳으로 걷고, 물체를 누르면 가까이 갑니다. 가까이에서 다시 누르면 사용할 수 있어요. 빈 의자를 누르면 앉아요. W·A·S·D로 걸을 수도 있고 Esc로 멈춥니다. 메뉴의 ‘갈곳 찾기’에서도 목적지를 고를 수 있어요. 창가 식물에 물을 뿌리거나, 말랑돌을 가져오거나, 보리차를 준비해도 좋아요. 걷는 중에도 목적지를 바꾸거나 멈출 수 있어요.</p><p>사탕은 집은 뒤 ‘포장 열기’를 한 번 누르면 열립니다. 레몬파이는 간식을 꺼내 포장을 열고 한입 먹어보세요. 중간에 내려놓아도 뜯던 포장과 남은 간식이 그대로 이어져요.</p><p>포장을 연 뒤에는 ‘한 조각 나누기’로 공용 접시에 놓을 수 있어요. 다른 사람이 놓은 조각은 방 안의 ‘한 조각 맛보기’로 가져와요.</p><div className="help-invite"><strong>동료와 함께 쉬고 싶다면</strong><p>메뉴의 ‘동료 초대’로 링크를 복사하거나, 다른 방문자를 열어보세요.</p><button className="secondary" onClick={()=>{const u=new URL(location.href);u.search='';u.searchParams.set('visitor',crypto.randomUUID());u.searchParams.set('room',roomId);window.open(u.href,'_blank','noopener');}}>두 번째 방문자 열기 ↗</button></div></div></Modal>}
 </main></ToolsDockContext.Provider>;
}
