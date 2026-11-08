import * as T from 'three';
import {Workshop,mug} from './assets';
import {sculptColleague} from './avatarSculpt';
import {handSnack} from './handSnack';
import type {Member} from '../types';
import type {Pose} from '../../../shared/space.mjs';
import {armReach} from './armReach';
import {CUP_RETURN_MS,SIP_RETURN_MS} from '../gestureTiming';
import {misterModel,stoneModel,teaModel} from './restModels';
import {candyModel,bottleModel} from './stations';

export function createCharacter(kit:Workshop,member:Member){
  const {group,body,head,eyes,legs,left,right}=sculptColleague(kit,member.avatar,member.id);
  const cupGrip=new T.Group(),cupSocket=new T.Group();
  left.wrist.add(cupGrip);cupGrip.position.set(.016,-.055,.030);cupGrip.add(cupSocket);
  // The handle is on the thumb side of the left hand.
  cupSocket.position.set(.13*.75,-.139*.75,0);cupSocket.rotation.y=Math.PI;
  let heldCup=mug(kit,cupSocket,0,0,0,member.drink,.75,1,false);heldCup.visible=false;
  const whole=handSnack(kit,right.wrist,false),bitten=handSnack(kit,right.wrist,true);
  for(const piece of [whole,bitten]){piece.position.set(-.045,-.045,.052);piece.scale.setScalar(.8);piece.rotation.set(-.30,0,-.16);piece.visible=false;}
  const ring=kit.mesh(group,new T.RingGeometry(.27,.29,48),new T.MeshBasicMaterial({color:'#87a698',transparent:true,opacity:.4,depthWrite:false}),0,-.018,0);ring.rotation.x=-Math.PI/2;ring.castShadow=false;ring.receiveShadow=false;
  const resting=[left,right].map((arm,i)=>armReach(arm.shoulder.position,new T.Vector3(i?.19:-.20,.49,.48)));
  const sipReach=armReach(left.shoulder.position,new T.Vector3(-.111,.718,.27));
  const biteReach=armReach(right.shoulder.position,new T.Vector3(.083,.692,.201));
  const rake=new T.Group();right.wrist.add(rake);rake.position.set(0,-.02,.08);
  kit.cylinder(rake,.011,.011,.19,0,.09,0,'#b7986b');kit.box(rake,.14,.012,.014,0,-.005,0,'#ae8f62',.004);for(const x of[-.055,0,.055])kit.box(rake,.008,.035,.009,x,-.02,0,'#b7986b',.003);rake.visible=false;
  let sandBlend=0;
  let drink=member.drink,last=0,initialized=false,yaw=0,itemKey='',heldItem:T.Group|null=null;
  let restTea:ReturnType<typeof teaModel>|null=null,restStone:ReturnType<typeof stoneModel>|null=null;
  const seed=[...member.id].reduce((n,c)=>n+c.charCodeAt(0),0);
  function update(m:Member,pose:Pose,time:number,now:number,reduced:boolean,isMe:boolean){
    if(drink!==m.drink){kit.release(heldCup);heldCup=mug(kit,cupSocket,0,0,0,m.drink,.75,1,false);drink=m.drink;}
    const dt=last?Math.min((time-last)/1000,.1):1;last=time;
    const turn=Math.atan2(Math.sin(pose.yaw-yaw),Math.cos(pose.yaw-yaw));yaw=initialized?yaw+turn*(1-Math.exp(-dt*12)):pose.yaw;initialized=true;
    group.position.set(pose.x,0,pose.z);group.rotation.y=yaw;
    const walking=pose.phase==='walking',sit=pose.sit,phase=pose.distance/ .72*Math.PI*2;
    const reclined=m.area==='healing'&&(pose.inSeat??m.seat??0)<4;
    const seatHip=m.area==='healing'?(reclined?.41:.61):.755;
    const hipY=T.MathUtils.lerp(1.083,seatHip,sit)+(walking&&!reduced?Math.cos(phase*2)*.008-.02:0);
    body.position.set(0,hipY,sit*(reclined?0:.065));body.rotation.z=walking&&!reduced?Math.sin(phase)*.018:0;
    body.rotation.x=-.2*sit*(reclined?1:0)+((pose.phase==='rising'||pose.phase==='sitting')?Math.sin(sit*Math.PI)*.12:0);
    for(const leg of legs){
      const cycle=phase+(leg.side===1?Math.PI:0),swing=walking&&!reduced?Math.sin(cycle):0;
      const targetY=.113+Math.max(0,swing)*.07,targetZ=T.MathUtils.lerp(swing*.15,.43,sit),dy=hipY-targetY;
      const d=Math.min(.969,Math.hypot(dy,targetZ)),upper=Math.atan2(targetZ,dy)+Math.acos(T.MathUtils.clamp((.42*.42+d*d-.55*.55)/(2*.42*d),-1,1));
      const bend=Math.PI-Math.acos(T.MathUtils.clamp((.42*.42+.55*.55-d*d)/(2*.42*.55),-1,1));
      leg.hip.position.y=hipY;leg.hip.rotation.x=-upper;leg.knee.rotation.x=bend;leg.ankle.rotation.x=upper-bend;
    }
    const age=now-m.actionAt,gestureLength=m.action==='bite'?1550:['cup-sip','tea-sip','bottle-sip'].includes(m.action)?SIP_RETURN_MS:CUP_RETURN_MS,gesture=age>=0&&age<gestureLength&&['cup-sip','wave','bite','candy-eat','bottle-sip','tea-sip'].includes(m.action);
    const amount=gesture?T.MathUtils.smoothstep(Math.min(1,age/360,(gestureLength-age)/310),0,1):0;
    const seatedDrink=gesture&&sit>.95&&['cup-sip','tea-sip','bottle-sip','wave'].includes(m.action);
    const drinking=seatedDrink||gesture&&['cup-sip','wave'].includes(m.action);
    const c=m.pantry?.candy,b=m.pantry?.bottle,holdCandy=Boolean(c?.held&&c.state!=='eaten'||gesture&&m.action==='candy-eat'),holdBottle=!holdCandy&&Boolean(b?.held&&b.sips<3&&pose.inSeat==null||gesture&&!seatedDrink&&m.action==='bottle-sip');
    const rest=m.pantry.rest,kind=rest?.sprayer?'sprayer':rest?.stone?.held?'stone':rest?.tea&&(rest.tea.held&&pose.inSeat==null||gesture&&!seatedDrink&&m.action==='tea-sip')?'tea':'';
    const nextItem=JSON.stringify([kind,holdCandy,holdBottle,c?.progress,b?.sips]);
    if(itemKey!==nextItem){restTea?.dispose();restTea=null;restStone=null;if(heldItem)kit.release(heldItem);heldItem=kind==='sprayer'?misterModel(kit,right.wrist):kind==='stone'?(restStone=stoneModel(kit,right.wrist)).group:kind==='tea'?(restTea=teaModel(kit,right.wrist)).group:holdCandy?candyModel(kit,right.wrist,c?.progress??1):holdBottle?bottleModel(kit,right.wrist,b?.sips??0):null;itemKey=nextItem;if(heldItem){heldItem.scale.setScalar(holdCandy?.65:.7);heldItem.position.set(0,.025,.04);if(kind==='sprayer')heldItem.rotation.y=Math.PI;}}
    restTea?.update(rest?.tea??null,now,time,reduced);if(restStone&&rest?.stone)restStone.deform(now-rest.stone.pressAt,rest.stone.point,reduced);
    const contact=m.connected&&m.contact&&m.contact.until>now&&rest.sand?.held&&sit>.95?m.contact:null;
    const sandActive=Boolean(contact);sandBlend+=(Number(sandActive)-sandBlend)*(1-Math.exp(-dt*18));
    rake.visible=Boolean(contact?.kind==='rake');
    body.rotation.x+=sandBlend*.4;
    const eating=gesture&&m.action==='bite';
    for(const [a,side]of [[left,-1],[right,1]] as const){
      const spraying=kind==='sprayer'&&m.action==='plant-spray'&&age>=0&&age<650?Math.sin(age/650*Math.PI)*.65:0;
      const holding=side===1&&(holdCandy||holdBottle||Boolean(kind)),active=side===1?Math.max(drinking?0:amount,spraying):0;
      const swing=walking&&!reduced?Math.sin(phase+(side===1?0:Math.PI))*.43:0;
      const upper=T.MathUtils.lerp(holding?-.45:T.MathUtils.lerp(swing,-.35,sit),-1.2,active);
      const lower=T.MathUtils.lerp(holding?-1.1:T.MathUtils.lerp(-.15,-.6,sit),-1.35,active);
      a.shoulder.rotation.set(upper,0,side*.095);a.elbow.rotation.set(lower,0,0);
      if(!holding&&sit>0&&!reclined){
        const rest=resting[side===1?1:0];a.shoulder.quaternion.slerp(rest.shoulder,sit);a.elbow.quaternion.slerp(rest.elbow,sit);
      }
      a.wrist.quaternion.copy(a.shoulder.quaternion).multiply(a.elbow.quaternion).invert();
      const grasp=holding||(side===-1?drinking:eating);
      a.open.visible=!grasp;a.grip.visible=grasp;
      if(sandBlend>.001&&side===1){
        // Reach onto the low tray; one small forearm stroke only while contact is live.
        const sweep=reduced?0:Math.sin(time*.006)*.11;
        a.shoulder.rotation.x=T.MathUtils.lerp(upper,-1.1+sweep*.35,sandBlend);a.shoulder.rotation.z=T.MathUtils.lerp(side*.035,-.16+sweep,sandBlend);
        a.elbow.rotation.x=T.MathUtils.lerp(lower,-.58-sweep*.4,sandBlend);a.wrist.rotation.x=-a.shoulder.rotation.x-a.elbow.rotation.x;
      }
    }
    if(gesture){
      const arm=drinking?left:right,reach=drinking?sipReach:biteReach;
      arm.shoulder.quaternion.slerp(reach.shoulder,amount);arm.elbow.quaternion.slerp(reach.elbow,amount);
      arm.wrist.quaternion.copy(arm.shoulder.quaternion).multiply(arm.elbow.quaternion).invert();
    }
    cupGrip.rotation.x=drinking?(m.action==='wave'?-.08:-.40)*amount:0;
    heldCup.visible=drinking&&!seatedDrink;
    whole.visible=eating&&age<470;bitten.visible=eating&&age>=470;
    head.rotation.x=gesture?amount*.045:0;
    const blink=((time+seed*31)%5200);for(const eye of eyes)eye.scale.y=!reduced&&blink<130?.004:.023;
    ring.visible=isMe&&sit<.95;group.updateMatrixWorld(true);
    return {cupSocket,lift:seatedDrink?amount:0,eating};
  }
  return {group,avatar:member.avatar,update,labelPosition(pose:Pose){return new T.Vector3(pose.x,2.32-pose.sit*(member.area==='healing'?((pose.inSeat??0)<4?.67:.465):.32),pose.z);},dispose(){restTea?.dispose();(ring.material as T.Material).dispose();kit.release(group);}};
}
