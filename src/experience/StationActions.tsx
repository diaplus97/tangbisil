import {PersonalItems} from './PersonalItems';
import {RestActions} from './RestActions';
import {heldName} from '../../shared/rest.mjs';
import type {Snapshot} from './types';
import {playSound} from './sound';
import {snackDefinition} from '../../shared/snacks.mjs';

type Props={state:Snapshot;busy:boolean;online:boolean;onExplore:()=>void;onSnack:(choice?:Record<string,unknown>)=>void;snackLabel:string;act:(type:string,extra?:Record<string,unknown>)=>Promise<unknown>};
export function StationActions({state,busy,online,onExplore,onSnack,snackLabel,act}:Props){
  const me=state.room.members.find(m=>m.id===state.self.id)!,p=state.self.pantry,c=p.candy,b=p.bottle,station=me.station,disabled=busy||!online;
  async function openCandy(){if(!c||disabled)return;const result=await act('candy-unwrap',{itemId:c.id,progress:1});if(result)playSound('open');}
  const action=(type:string,extra:Record<string,unknown>={})=>void act(type,extra);
  const rest=p.rest,held=heldName(p);
  if(state.room.area==='healing'||['plant','stone','tea','sand'].includes(station??'')||!station&&(rest?.stone||rest?.tea||rest?.sand)&&!c?.held&&!b?.held)return <RestActions state={state} disabled={disabled} act={act} onExplore={onExplore} onSnack={onSnack} snackLabel={snackLabel}/>;
  const pickup=(text:string,except:string)=>{const old=heldName(p,except);return old?old+' 내려놓고 '+text:text;};
  const pick=(type:string,except:string,extra:Record<string,unknown>={})=>action(type,{...extra,stow:Boolean(heldName(p,except))});
  let title='',content;
  const candyActions=c&&c.state!=='eaten'&&c.held?<>
    {c.state==='wrapped'?<button className="primary candy-open" disabled={disabled} onClick={()=>void openCandy()}>포장 열기</button>:<button className="primary" disabled={disabled} onClick={()=>action('candy-eat',{itemId:c.id})}>사탕 한 알 먹기</button>}
    {!station&&(rest?.stone||rest?.tea)&&<PersonalItems label="휴식 도구">{rest.stone&&!rest.stone.held&&<button disabled={disabled} onClick={()=>pick('stone-hold','stone',{itemId:rest.stone!.id,held:true})}>{pickup('말랑돌 다시 집기','stone')}</button>}{rest.tea&&!rest.tea.held&&<button disabled={disabled} onClick={()=>pick('tea-hold','tea',{itemId:rest.tea!.id,held:true})}>{pickup('찻잔 다시 집기','tea')}</button>}</PersonalItems>}{!station&&<button className="quiet-action" disabled={disabled} onClick={()=>action('candy-hold',{itemId:c.id,held:false})}>사탕 내려놓기</button>}
  </>:null;
  if(station==='snacks'){
    title='오늘은 이 세 가지';content=state.room.snackDisplay?.slots.map(slot=><button key={slot.slot} disabled={disabled} onClick={()=>onSnack({snackId:slot.snackId,definitionVersion:slot.definitionVersion,displayId:state.room.snackDisplay!.displayId})}>{snackDefinition(slot.snackId,slot.definitionVersion)?.name}</button>);
  }else if(station==='candy'){
    title=c?.state==='eaten'?'사탕을 맛봤어요. 기록에 남겨뒀어요.':c?.state==='open'?'레몬꿀 사탕 · 한 알 먹어볼까요?':c?'레몬꿀 사탕 · 포장을 열어 한 알':'작고 달콤한 쉼표';
    content=candyActions??(c&&c.state!=='eaten'?<button className="primary" disabled={disabled} onClick={()=>pick('candy-hold','candy',{itemId:c.id,held:true})}>{pickup('내 사탕 다시 집기','candy')}</button>:<button className="primary" disabled={disabled} onClick={()=>pick('candy-take','candy')}>{pickup('사탕 하나 집기','candy')}</button>);
  }else if(station==='coffee'){
    const stage=p.coffee.stage;
    title=stage==='brewing'?'커피가 천천히 내려지고 있어요.':stage==='ready'?'따뜻한 커피가 준비됐어요.':stage==='placed'?'컵을 놓았어요. 버튼을 눌러요.':me.action==='coffee-take'?'내 컵을 들고 편한 자리로.':'내 컵으로 한 잔';
    content=stage==='brewing'?<span className="brew-status" role="status"><i/>커피 내리는 중</span>:<button className={me.action==='coffee-take'&&stage==='carried'?'secondary':'primary'} disabled={disabled} onClick={()=>me.action==='coffee-take'&&stage==='carried'?onExplore():pick(stage==='carried'?'coffee-place':stage==='placed'?'coffee-brew':'coffee-take','coffee')}>{stage==='carried'?(me.action==='coffee-take'?'앉을 자리 고르기':pickup('컵 놓기','coffee')):stage==='placed'?'추출 버튼 누르기':'컵 가져오기'}</button>;
  }else if(station==='fridge'){
    const open=state.room.fixtures.fridge.open;
    title=open?'차갑게 보관한 청포도 음료':'시원한 한 모금';
    content=!open?<button className="primary" disabled={disabled} onClick={()=>action('fridge-open')}>냉장고 문 열기</button>:<>{(!b||b.sips>=3)&&<button className="primary" disabled={disabled} onClick={()=>pick('bottle-take','bottle')}>{pickup('음료 한 병 꺼내기','bottle')}</button>}<button className={b&&b.sips<3?'primary':'quiet-action'} disabled={disabled} onClick={()=>action('fridge-close')}>문 닫기</button></>;
  }else{
    title=c&&c.state!=='eaten'?'내 자리에 두고 천천히 즐겨요.':b&&b.sips<3?'청포도 음료 · '+(3-b.sips)+'모금 남음':'';
    content=<>{candyActions}{c&&c.state!=='eaten'&&!c.held&&<button className="secondary" disabled={disabled} onClick={()=>pick('candy-hold','candy',{itemId:c.id,held:true})}>{pickup('사탕 다시 집기','candy')}</button>}{b&&b.sips<3&&<><button className={b.held?'primary':'secondary'} disabled={disabled} onClick={()=>pick(b.held?'bottle-sip':'bottle-hold','bottle',b.held?{itemId:b.id}:{itemId:b.id,held:true})}>{b.held?'음료 한 모금':pickup('음료 다시 집기','bottle')}</button>{b.held&&<button className="quiet-action" disabled={disabled} onClick={()=>action('bottle-hold',{itemId:b.id,held:false})}>병 내려놓기</button>}</>}</>;
  }
  if(!station&&!title)return null;
  return <section className="object-actions" aria-label="오브젝트 조작"><p role="status">{title}</p><div className="object-action-buttons">{content}{!station&&<button className="quiet-action" disabled={disabled} onClick={()=>onSnack()}>{snackLabel}</button>}</div></section>;
}
