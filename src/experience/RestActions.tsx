import {Fragment} from 'react';
import {useCompactLayout} from './useInputMethod';
import {PersonalItems} from './PersonalItems';
import type {Snapshot} from './types';
import {gentleStroke,nextStonePosition} from '../../shared/sand.mjs';
import {sandStrokeSound,playSound} from './sound';
import {flowers} from '../../shared/vase.mjs';
import {heldName} from '../../shared/rest.mjs';
type Props={state:Snapshot;disabled:boolean;act:(type:string,extra?:Record<string,unknown>)=>Promise<unknown>;onExplore:()=>void;onSnack:()=>void;snackLabel:string};
export function RestActions({state,disabled,act,onExplore,onSnack,snackLabel}:Props){
 const compact=useCompactLayout();
 const p=state.self.pantry,r=p.rest,me=state.room.members.find(m=>m.id===state.self.id)!,station=me.station,tea=r.tea,stone=r.stone,sand=r.sand,vase=r.vase,healing=state.room.area==='healing',hasSnack=!healing||Boolean(state.self.serving&&state.self.serving.state!=='empty');
 const resting=healing?(r.lastPlaced==='vase'&&vase?'vase':sand?'sand':vase?'vase':null):null;
 const action=(type:string,extra:Record<string,unknown>={})=>{void act(type,type==='sand-edit'?{...extra,gesture:true}:extra).then(result=>{if(!result||type!=='sand-edit')return;if(extra.operation==='stone')playSound('sandStone');else sandStrokeSound();});};
 const pickup=(label:string,type:string,except:string,extra:Record<string,unknown>={},primary=true)=>{const held=heldName(p,except);return <button className={primary?'primary':'quiet-action'} disabled={disabled} onClick={()=>action(type,{...extra,stow:Boolean(held)})}>{held?held+' 내려놓고 '+label:label}</button>;};
 let title='',content;
 if(station==='flower'){
  title=vase?.held?'한 송이를 골랐어요. 자리에 놓고 편하게 바라보세요.':'마음에 드는 한 송이. 내 작은 꽃병에 담아요.';
  content=<>{vase?.held?<button className="primary" onClick={onExplore}>앉을 자리 고르기</button>:pickup('하얀 꽃 고르기','vase-take','vase',{flower:'cosmos'})}<PersonalItems label="꽃 고르기" dockable={false}>{flowers.map(f=><Fragment key={f.id}>{pickup(f.name,'vase-take','vase',{flower:f.id},false)}</Fragment>)}</PersonalItems></>;
 }else if(station==='sand'){
  title=sand?.held?'편한 자리에 가져가 천천히 선을 그어보세요.':'흔적을 남기고 지워도 좋은 작은 모래밭.';
  content=sand?.held?<button className="primary" onClick={onExplore}>앉을 자리 고르기</button>:pickup(sand?'내 모래 트레이 집기':'모래 트레이 가져오기','sand-take','sand');
 }else if(station==='plant'){
  title=r.sprayer?'가볍게 한 번. 잎 위에 작은 물방울이 맺혀요.':'초록은 여기서 느긋하게 기다려요.';
  content=r.sprayer?<><button className="primary" disabled={disabled} onClick={()=>action('plant-spray')}>물 한 번 뿌리기</button><button className="quiet-action" disabled={disabled} onClick={()=>action('plant-put')}>분무기 내려놓기</button></>:<>{pickup('분무기 집기','plant-take','sprayer')}{(!compact||!heldName(p))&&<button className="quiet-action" disabled={disabled||Boolean(heldName(p))} onClick={()=>action('plant-brush')}>잎 살짝 쓸기</button>}{!compact&&<button className="quiet-action" onClick={onExplore}>자리로 돌아가기</button>}</>;
 }else if(station==='stone'){
  title=sand?.held?'선을 긋거나 돌을 옮겨보세요. 모래는 그대로 남아요.':stone?.held?'편한 자리에 가져가 손에 쥐어보세요.':'부드러운 말랑돌. 필요한 동안 곁에 두어요.';
  content=<>{stone?.held?<button className="primary" onClick={onExplore}>앉을 자리 고르기</button>:pickup(stone?'내 말랑돌 집기':'말랑돌 하나 집기','stone-take','stone')}{stone&&<button className="quiet-action" disabled={disabled} onClick={()=>action('stone-return',{itemId:stone.id})}>바구니에 반납하기</button>}</>;
 }else if(station==='tea'){
  const here=tea?.location==='station',pouring=Boolean(tea?.pourAt);
  title=!here?'따뜻한 보리차를 내 잔에 준비해요.':!tea.bagUsed?'비어 있는 잔. 티백 하나를 담아요.':pouring?'따뜻한 물이 천천히 차올라요.':tea.volume>0?'차 색이 천천히 번져요. 원할 때 가져가세요.':'원하는 만큼 물을 부어요.';
  content=!here?(tea?.held&&me.action==='tea-take'?<><button className="primary" onClick={onExplore}>앉을 자리 고르기</button><button className="quiet-action" disabled={disabled} onClick={()=>action('tea-place')}>찻잔 다시 놓기</button></>:pickup(tea?'내 찻잔 놓기':'찻잔 놓기','tea-place','tea')):<>
   {!tea.bagUsed?<button className="primary" disabled={disabled} onClick={()=>action('tea-bag',{itemId:tea.id})}>티백 담기</button>:pouring?<button className="primary" disabled={disabled} onClick={()=>action('tea-stop',{itemId:tea.id})}>물 붓기 멈추기</button>:tea.volume<.99?<button className="primary" disabled={disabled} onClick={()=>action('tea-pour',{itemId:tea.id})}>{tea.volume>0?'물 조금 더 붓기':'물 붓기'}</button>:tea.bagIn?<button className="primary" disabled={disabled} onClick={()=>action('tea-remove',{itemId:tea.id})}>티백 받침에 놓기</button>:null}
   {tea.volume>0&&tea.bagIn&&tea.volume<.99&&!pouring&&<button className="quiet-action" disabled={disabled} onClick={()=>action('tea-remove',{itemId:tea.id})}>티백 받침에 놓기</button>}
   {pickup('찻잔 가져오기','tea-take','tea',{itemId:tea.id},!compact)}
  </>;
  if(compact&&here&&tea.bagUsed&&!pouring&&tea.volume>0)content=<>
   {pickup('찻잔 가져오기','tea-take','tea',{itemId:tea.id})}
   {(tea.volume<.99||tea.bagIn)&&<PersonalItems label="차 더하기" dockable={false}>
    {tea.volume<.99&&<button disabled={disabled} onClick={()=>action('tea-pour',{itemId:tea.id})}>물 조금 더 붓기</button>}
    {tea.bagIn&&<button disabled={disabled} onClick={()=>action('tea-remove',{itemId:tea.id})}>티백 받침에 놓기</button>}
   </PersonalItems>}
  </>;
 }else{
  title=vase?.held?'줄기를 밀면 위치, 꽃잎을 밀면 기울기가 바뀌어요.':sand?.held?(healing?'선을 긋거나 돌을 옮겨보세요. 모래는 그대로 남아요.':'모래 트레이는 힐링방에 보관해 두어요.'):stone?.held?'말랑돌을 톡 눌러보세요. 천천히 제 모습으로 돌아와요.':tea?.held?'따뜻한 잔과 함께, 잠깐.':'내려둔 물건은 그대로 있어요.';
  content=<>
   {vase?.held&&<><PersonalItems label="꽃 자리 조절" dockable={false}><button disabled={disabled} onClick={()=>action('vase-edit',{itemId:vase.id,revision:vase.revision,position:vase.position>.1?-.4:.4,tilt:vase.tilt})}>줄기 옮기기</button><button disabled={disabled} onClick={()=>action('vase-edit',{itemId:vase.id,revision:vase.revision,position:vase.position,tilt:vase.tilt>.05?-.2:.2})}>살짝 기울이기</button><button disabled={disabled} onClick={()=>action('vase-edit',{itemId:vase.id,revision:vase.revision,position:0,tilt:0})}>가운데 놓기</button></PersonalItems><button className="primary" disabled={disabled} aria-label="꽃병 내려놓고 쉬기" onClick={()=>action('vase-hold',{itemId:vase.id,held:false})}>내려놓고 쉬기</button></>}
   {sand?.held&&!healing&&<button className="primary" disabled={disabled} onClick={()=>action('sand-hold',{itemId:sand.id,held:false})}>모래 트레이 보관하기</button>}
   {sand?.held&&healing&&<><button className="primary" disabled={disabled||!healing} onClick={()=>action('sand-edit',{itemId:sand.id,revision:sand.revision,operation:'stroke',points:gentleStroke(sand.revision)})}>선 한 번 긋기</button><PersonalItems label="모래 다듬기" dockable={false}><button disabled={disabled||!healing} onClick={()=>action('sand-edit',{itemId:sand.id,revision:sand.revision,operation:'smooth'})}>모래 표면 고르기</button>{sand.stones.map((point,i)=><button key={i} disabled={disabled||!healing} onClick={()=>action('sand-edit',{itemId:sand.id,revision:sand.revision,operation:'stone',stone:i,position:nextStonePosition(point)})}>{i+1}번 조약돌 옮기기</button>)}</PersonalItems><button className="quiet-action" disabled={disabled} aria-label="모래 트레이 내려놓기" onClick={()=>action('sand-hold',{itemId:sand.id,held:false})}>내려놓기</button></>}
   {healing&&p.candy?.held&&p.candy.state!=='eaten'&&<><button className="primary" disabled={disabled} onClick={()=>action(p.candy!.state==='wrapped'?'candy-unwrap':'candy-eat',{itemId:p.candy!.id,progress:1})}>{p.candy.state==='wrapped'?'포장 열기':'사탕 한 알 먹기'}</button><button className="quiet-action" disabled={disabled} onClick={()=>action('candy-hold',{itemId:p.candy!.id,held:false})}>사탕 내려놓기</button></>}
   {healing&&p.bottle?.held&&p.bottle.sips<3&&<><button className="primary" disabled={disabled} onClick={()=>action('bottle-sip',{itemId:p.bottle!.id})}>음료 한 모금</button><button className="quiet-action" disabled={disabled} onClick={()=>action('bottle-hold',{itemId:p.bottle!.id,held:false})}>병 내려놓기</button></>}
   {stone?.held&&<><button className="primary" disabled={disabled} aria-label="말랑돌 한 번 누르기" onClick={()=>action('stone-press',{itemId:stone.id,point:[0,0]})}>{compact?'말랑돌 누르기':'말랑돌 한 번 누르기'}</button><button className="quiet-action" disabled={disabled} aria-label="말랑돌 내려놓기" onClick={()=>action('stone-hold',{itemId:stone.id,held:false})}>{compact?'내려놓기':'말랑돌 내려놓기'}</button></>}
   {tea?.held&&<><button className="primary" disabled={disabled||tea.volume<=0} onClick={()=>action('tea-sip',{itemId:tea.id})}>{tea.volume>0?'차 한 모금':'다 마신 찻잔'}</button><button className="quiet-action" disabled={disabled} aria-label="찻잔 내려놓기" onClick={()=>action('tea-hold',{itemId:tea.id,held:false})}>{compact?'내려놓기':'찻잔 내려놓기'}</button></>}
   {(compact||healing||sand)&&!heldName(p)&&<button className="primary" disabled={disabled} onClick={resting?()=>action(resting+'-hold',{itemId:resting==='vase'?vase!.id:sand!.id,held:true}):hasSnack?onSnack:()=>action('approach',{station:'sand'})}>{resting==='vase'?'꽃병 다시 만지기':resting==='sand'?'모래 다시 만지기':hasSnack?snackLabel:'모래 트레이 가져오러 가기'}</button>}
   <PersonalItems>
    {healing&&vase&&!vase.held&&pickup('꽃병 다시 만지기','vase-hold','vase',{itemId:vase.id,held:true})}
    {healing&&sand&&!sand.held&&pickup('모래 트레이 다시 집기','sand-hold','sand',{itemId:sand.id,held:true})}
    {stone&&!stone.held&&pickup('말랑돌 다시 집기','stone-hold','stone',{itemId:stone.id,held:true})}
    {tea&&!tea.held&&tea.location==='personal'&&pickup('찻잔 다시 집기','tea-hold','tea',{itemId:tea.id,held:true})}
    {p.candy&&!p.candy.held&&p.candy.state!=='eaten'&&pickup('사탕 다시 집기','candy-hold','candy',{itemId:p.candy.id,held:true})}
    {p.bottle&&!p.bottle.held&&p.bottle.sips<3&&pickup('음료 다시 집기','bottle-hold','bottle',{itemId:p.bottle.id,held:true})}
    {hasSnack&&<button className="quiet-action" disabled={disabled} onClick={onSnack}>{snackLabel}</button>}
   </PersonalItems>
  </>;
 }
 return <section className="object-actions rest-actions" aria-label="휴식 도구"><p role="status">{title}</p><div className="object-action-buttons">{content}</div></section>;
}
