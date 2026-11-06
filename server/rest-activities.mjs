import {flowers,validArrangement} from '../shared/vase.mjs';
import {randomUUID} from 'node:crypto';
import {decodeSand,encodeSand,rakeSand,initialStones} from '../shared/sand.mjs';
import {heldName} from '../shared/rest.mjs';

export function freeHand(p,input,except,GameError){
 const held=heldName(p,except);
 if(held&&!input.stow)throw new GameError(`${held}을 내려놓고 바꿔 집어 주세요.`);
 if(!held)return;
 if(p.candy)p.candy.held=false;if(p.bottle)p.bottle.held=false;
 p.rest.sprayer=false;if(p.rest.sand)p.rest.sand.held=false;if(p.rest.vase)p.rest.vase.held=false;if(p.rest.stone)p.rest.stone.held=false;if(p.rest.tea)p.rest.tea.held=false;
}
export function restAction({p,input,member,pose,room,now,near,GameError}){
 const {type,itemId}=input,r=p.rest;
 const hand=except=>freeHand(p,input,except,GameError);
 const own=(item,name)=>{if(!item||item.id!==itemId)throw new GameError(`내 ${name}을 다시 확인해 주세요.`);};
 const atSeat=()=>{if(pose.inSeat==null)throw new GameError('자리에 앉으면 이어서 만질 수 있어요.');};
 const teaHere=()=>{near(member,'tea',now);own(r.tea,'찻잔');if(r.tea.location!=='station'||r.tea.roomId!==room.id)throw new GameError('차 트레이에 내 잔을 먼저 놓아 주세요.');};
 if(type==='items-stow'){atSeat();freeHand(p,{stow:true},null,GameError);}
 else if(type==='vase-take'){
  near(member,'flower',now);if(!flowers.some(f=>f.id===input.flower))throw new GameError('선반에서 꽃 한 송이를 골라 주세요.',400);hand('vase');
  r.vase??={id:randomUUID(),held:false,flower:input.flower,position:0,tilt:0,revision:0};r.vase.flower=input.flower;r.vase.held=true;r.vase.revision++;
 }
 else if(type==='vase-hold'){own(r.vase,'꽃병');atSeat();if(typeof input.held!=='boolean')throw new GameError('손에 든 상태를 확인해 주세요.',400);if(input.held){if(member.area!=='healing')throw new GameError('꽃병은 힐링방에 놓아 두어요.');hand('vase');}r.vase.held=input.held;if(!input.held)r.lastPlaced='vase';}
 else if(type==='vase-edit'){
  own(r.vase,'꽃병');atSeat();if(member.area!=='healing'||!r.vase.held)throw new GameError('내 꽃병을 먼저 집어 주세요.');
  if(input.revision!==r.vase.revision)throw new GameError('다른 화면에서 꽃병이 바뀌었어요. 지금 배치에서 이어 주세요.');
  if(!validArrangement(input.position,input.tilt))throw new GameError('꽃병 안에서 살짝 움직여 주세요.',400);
  r.vase.position=input.position;r.vase.tilt=input.tilt;r.vase.revision++;
 }
 else if(type==='sand-take'){near(member,'sand',now);hand('sand');r.sand??={id:randomUUID(),held:false,revision:0,surface:encodeSand(decodeSand()),stones:initialStones(),changedAt:0};r.sand.held=true;}
 else if(type==='sand-hold'){own(r.sand,'모래 트레이');atSeat();if(typeof input.held!=='boolean')throw new GameError('손에 든 상태를 확인해 주세요.',400);if(input.held){if(member.area!=='healing')throw new GameError('모래는 힐링방의 낮은 테이블에서 만져요.');hand('sand');}r.sand.held=input.held;if(!input.held)r.lastPlaced='sand';}
 else if(type==='sand-edit'){
  own(r.sand,'모래 트레이');atSeat();if(member.area!=='healing'||!r.sand.held)throw new GameError('힐링방 자리에 트레이를 먼저 놓아 주세요.');
  if(input.revision!==r.sand.revision)throw new GameError('다른 화면에서 모래가 바뀌었어요. 지금 표면에서 이어 주세요.');
  if(input.operation==='stroke'){
   const points=input.points;if(!Array.isArray(points)||points.length<2||points.length>64||points.some(p=>!Array.isArray(p)||p.length!==2||p.some(v=>typeof v!=='number'||!Number.isFinite(v)||v<.03||v>.97)))throw new GameError('모래 위의 선을 확인해 주세요.',400);
   r.sand.surface=encodeSand(rakeSand(decodeSand(r.sand.surface),points));
  }else if(input.operation==='stone'){
   if(!Number.isInteger(input.stone)||input.stone<0||input.stone>2||!Array.isArray(input.position)||input.position.length!==2||input.position.some(v=>typeof v!=='number'||!Number.isFinite(v)||v<.1||v>.9))throw new GameError('돌을 트레이 안에 놓아 주세요.',400);
   r.sand.stones[input.stone]=input.position;
  }else if(input.operation==='smooth')r.sand.surface=encodeSand(decodeSand());
  else throw new GameError('모래 조작을 다시 확인해 주세요.',400);
  r.sand.revision++;r.sand.changedAt=now;r.sand.changedKind=input.operation;
 }
 else if(type==='plant-take'){near(member,'plant',now);hand('sprayer');r.sprayer=true;}
 else if(type==='plant-spray'){
  near(member,'plant',now);if(!r.sprayer)throw new GameError('분무기를 먼저 집어 주세요.');
  if(r.sprayAt&&now-r.sprayAt<800)return false;r.sprayAt=now;
 }else if(type==='plant-put'){near(member,'plant',now);r.sprayer=false;}
 else if(type==='plant-brush'){near(member,'plant',now);if(r.sprayer)throw new GameError('분무기를 내려놓고 잎을 만져요.');if(r.brushAt&&now-r.brushAt<800)return false;hand('sprayer');r.brushAt=now;}
 else if(type==='stone-take'){near(member,'stone',now);hand('stone');r.stone??={id:randomUUID(),held:false,pressAt:0,point:[0,0]};r.stone.held=true;}
 else if(type==='stone-press'){
  own(r.stone,'말랑돌');atSeat();if(!r.stone.held)throw new GameError('말랑돌을 먼저 집어 주세요.');
  const point=input.point??[0,0];if(!Array.isArray(point)||point.length!==2||point.some(v=>typeof v!=='number'||!Number.isFinite(v)||Math.abs(v)>1))throw new GameError('누른 자리를 확인해 주세요.',400);
  if(r.stone.pressAt&&now-r.stone.pressAt<500)return false;r.stone.pressAt=now;r.stone.point=point;
 }else if(type==='stone-hold'){own(r.stone,'말랑돌');atSeat();if(typeof input.held!=='boolean')throw new GameError('손에 든 상태를 확인해 주세요.',400);if(input.held)hand('stone');r.stone.held=input.held;}
 else if(type==='stone-return'){near(member,'stone',now);own(r.stone,'말랑돌');r.stone=null;}
 else if(type==='tea-place'){
  near(member,'tea',now);hand('tea');r.tea??={id:randomUUID(),location:'personal',roomId:null,held:false,bagIn:false,bagUsed:false,volume:0,strength:0,pourAt:0,pourEnd:0,steepAt:0};
  if(r.tea.location==='station')throw new GameError('내 잔이 이미 놓여 있어요.');Object.assign(r.tea,{location:'station',roomId:room.id,held:false});
 }else if(type==='tea-bag'){teaHere();if(r.tea.bagUsed)throw new GameError('이 잔에는 티백을 이미 담았어요.');Object.assign(r.tea,{bagIn:true,bagUsed:true,steepAt:r.tea.volume>0?now:0});}
 else if(type==='tea-pour'){
  teaHere();const t=r.tea;if(!t.bagUsed)throw new GameError('티백을 먼저 담아 주세요.');if(t.pourAt||t.volume>=1)throw new GameError('물 붓기가 이미 진행됐어요.');
  t.pourAt=now;t.pourEnd=now+(1-t.volume)*3000;if(t.bagIn&&!t.steepAt)t.steepAt=now;
 }else if(type==='tea-stop'){teaHere();r.tea.pourAt=0;r.tea.pourEnd=0;}
 else if(type==='tea-remove'){teaHere();if(!r.tea.bagIn)throw new GameError('티백은 이미 받침에 있어요.');r.tea.bagIn=false;r.tea.steepAt=0;}
 else if(type==='tea-take'){teaHere();hand('tea');Object.assign(r.tea,{location:'personal',roomId:null,held:true,pourAt:0,pourEnd:0});}
 else if(type==='tea-hold'){own(r.tea,'찻잔');atSeat();if(r.tea.location!=='personal'||typeof input.held!=='boolean')throw new GameError('내 자리에 있는 잔을 집어 주세요.');if(input.held)hand('tea');r.tea.held=input.held;}
 else if(type==='tea-sip'){own(r.tea,'찻잔');atSeat();if(!r.tea.held||r.tea.volume<=0)throw new GameError('차가 든 잔을 먼저 집어 주세요.');r.tea.volume=Math.max(0,r.tea.volume-.16);}
 else throw new GameError('알 수 없는 휴식 행동이에요.',400);
}
