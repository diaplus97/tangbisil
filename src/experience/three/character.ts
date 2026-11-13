import * as T from 'three';
import {Workshop,mug,consolidate} from './assets';
import {sculptColleague,avatarProportions} from './avatarSculpt';
import {snackDefinition} from '../../../shared/snacks.mjs';
import {snackBiteMotion,snackBiteProfiles} from '../snackBiteMotion';
import {snackFood} from './snackModels';
import type {Member} from '../types';
import type {Pose} from '../../../shared/space.mjs';
import {cigaretteModel,smokeGesture,smokePlume} from './smokeEffects';
import {lighterModel} from './smokingModels';
import {armReach} from './armReach';
import {smokingAshtray} from '../../../shared/smoking.mjs';
import {CUP_RETURN_MS,SIP_RETURN_MS} from '../gestureTiming';
import {misterModel,stoneModel,teaModel} from './restModels';
import {candyModel,bottleModel} from './stations';

export function createCharacter(kit:Workshop,member:Member){
  const {group,body,head,eyes,legs,left,right}=sculptColleague(kit,member.avatar,member.id);
  const heldHitMaterial=new T.MeshBasicMaterial({visible:false});
  const heldHit=kit.mesh(right.wrist,new T.BoxGeometry(.28,.24,.30),heldHitMaterial,0,.015,.04);heldHit.userData.action='held';heldHit.visible=false;heldHit.castShadow=false;heldHit.receiveShadow=false;
  const cupGrip=new T.Group(),cupSocket=new T.Group();
  left.wrist.add(cupGrip);cupGrip.position.set(.016,-.055,.030);cupGrip.add(cupSocket);
  // The handle is on the thumb side of the left hand.
  cupSocket.position.set(.13*.75,-.139*.75,0);cupSocket.rotation.y=Math.PI;
  let heldCup=mug(kit,cupSocket,0,0,0,member.drink,.75,1,false);heldCup.visible=false;
  let whole=new T.Group(),bitten=new T.Group(),snackKey='';
  const ring=kit.mesh(group,new T.RingGeometry(.27,.29,48),new T.MeshBasicMaterial({color:'#87a698',transparent:true,opacity:.4,depthWrite:false}),0,-.018,0);ring.rotation.x=-Math.PI/2;ring.castShadow=false;ring.receiveShadow=false;
  const resting=[left,right].map((arm,i)=>armReach(arm.shoulder.position,new T.Vector3(i?.19:-.20,.49,.48)));
  const mouthShift=avatarProportions.headY-.84-.122*(avatarProportions.headScale-1);
  const sipReach=armReach(left.shoulder.position,new T.Vector3(-.111,.718+mouthShift,.27));
  const biteReach=armReach(right.shoulder.position,new T.Vector3(.083,.692+mouthShift,.201));
  const rake=new T.Group();right.wrist.add(rake);rake.position.set(0,-.02,.08);
  kit.cylinder(rake,.011,.011,.19,0,.09,0,'#b7986b');kit.box(rake,.14,.012,.014,0,-.005,0,'#ae8f62',.004);for(const x of[-.055,0,.055])kit.box(rake,.008,.035,.009,x,-.02,0,'#b7986b',.003);rake.visible=false;
  const cigarette=member.area==='smoking'?cigaretteModel(kit,right.wrist):null;
  const smoke=member.area==='smoking'?smokePlume(kit,group):null;
  const mouth=new T.Vector3(0,1.52,.26);
  if(cigarette){cigarette.group.position.set(-.012,-.047,.025);cigarette.group.rotation.x=-.1;}
  const cigaretteRest=armReach(right.shoulder.position,new T.Vector3(.24,.30,.31));
  const cigaretteMouth=armReach(right.shoulder.position,new T.Vector3(.045,.70+mouthShift,.27));
  const matchPoint=new T.Vector3();
  const trayPoint=new T.Vector3(),tipOffset=new T.Vector3(),down=new T.Vector3(),bodyWorld=new T.Quaternion(),wristTilt=new T.Quaternion(),targetTilt=new T.Quaternion();
  const lighterProp=lighterModel(kit,left.wrist),lighter=lighterProp.group;lighter.position.set(0,-.016,.02);
  const flameMaterial=new T.MeshBasicMaterial({color:'#ffcd76',transparent:true,opacity:.8});
  const flame=kit.mesh(lighter,new T.SphereGeometry(.01,10,8),flameMaterial,-.007,.057,0);flame.scale.set(.55,1.5,.55);lighter.visible=false;
  let sandBlend=0;
  let drink=member.drink,last=0,initialized=false,yaw=0,itemKey='',heldItem:T.Group|null=null;
  let gaitDistance=0,gaitBlend=0,previousPosition:{x:number;z:number}|null=null;
  let restTea:ReturnType<typeof teaModel>|null=null,restStone:ReturnType<typeof stoneModel>|null=null;
  const seed=[...member.id].reduce((n,c)=>n+c.charCodeAt(0),0);
  function update(m:Member,pose:Pose,time:number,now:number,reduced:boolean,isMe:boolean){
    if(drink!==m.drink){kit.release(heldCup);heldCup=mug(kit,cupSocket,0,0,0,m.drink,.75,1,false);drink=m.drink;}
    const dt=last?Math.min((time-last)/1000,.1):1;last=time;
    const turn=Math.atan2(Math.sin(pose.yaw-yaw),Math.cos(pose.yaw-yaw));yaw=initialized?yaw+turn*(1-Math.exp(-dt*12)):pose.yaw;initialized=true;
    group.position.set(pose.x,0,pose.z);group.rotation.y=yaw;
    const walking=pose.phase==='walking',sit=pose.sit;
    if(walking&&previousPosition){const step=Math.hypot(pose.x-previousPosition.x,pose.z-previousPosition.z);if(step<.5)gaitDistance+=step;}
    previousPosition={x:pose.x,z:pose.z};const phase=gaitDistance/.94*Math.PI*2;
    // Stop translation immediately, but let the last stride settle without resetting its phase.
    gaitBlend=reduced?0:gaitBlend+(Number(walking)-gaitBlend)*(1-Math.exp(-dt*18));
    if(gaitBlend<.001)gaitBlend=0;
    const reclined=m.area==='healing'&&(pose.inSeat??m.seat??0)<4;
    const seatHip=m.area==='healing'?(reclined?.41:.61):.755;
    const hipY=T.MathUtils.lerp(avatarProportions.standHip,seatHip,sit)+(Math.cos(phase*2)*.006-.012)*gaitBlend;
    body.position.set(0,hipY,sit*(reclined?0:.065));body.rotation.z=Math.sin(phase)*.018*gaitBlend;
    body.rotation.x=-.2*sit*(reclined?1:0)+((pose.phase==='rising'||pose.phase==='sitting')?Math.sin(sit*Math.PI)*.12:0);
    for(const leg of legs){
      const cycle=phase+(leg.side===1?Math.PI:0),swing=Math.sin(cycle)*gaitBlend;
      const targetY=avatarProportions.footY+Math.max(0,swing)*.055+.15*sit,targetZ=T.MathUtils.lerp(swing*.15,.49,sit),dy=hipY-targetY;
      const a=avatarProportions.legUpper,b=avatarProportions.legLower,d=Math.min(a+b-.001,Math.hypot(dy,targetZ)),upper=Math.atan2(targetZ,dy)+Math.acos(T.MathUtils.clamp((a*a+d*d-b*b)/(2*a*d),-1,1));
      const bend=Math.PI-Math.acos(T.MathUtils.clamp((a*a+b*b-d*d)/(2*a*b),-1,1));
      leg.hip.position.y=hipY;leg.hip.rotation.x=-upper;leg.knee.rotation.x=bend;leg.ankle.rotation.x=upper-bend;
    }
    const kindFood=snackDefinition(m.food?.snack_id??'',m.food?.definition_version??1)?.kind??'lemonPie';
    const age=now-m.actionAt,biteMotion=snackBiteMotion(kindFood,age,reduced),gestureLength=m.action==='bite'?snackBiteProfiles[kindFood].duration:['cup-sip','tea-sip','bottle-sip'].includes(m.action)?SIP_RETURN_MS:CUP_RETURN_MS,gesture=age>=0&&age<gestureLength&&['cup-sip','wave','bite','candy-eat','bottle-sip','tea-sip'].includes(m.action);
    const amount=gesture?(m.action==='bite'?biteMotion.lift:T.MathUtils.smoothstep(Math.min(1,age/360,(gestureLength-age)/310),0,1)):0;
    const seatedDrink=gesture&&sit>.95&&['cup-sip','tea-sip','bottle-sip','wave'].includes(m.action);
    const drinking=seatedDrink||gesture&&['cup-sip','wave'].includes(m.action);
    const c=m.area==='smoking'?null:m.pantry?.candy,b=m.area==='smoking'?null:m.pantry?.bottle,holdCandy=Boolean(c?.held&&c.state!=='eaten'||gesture&&m.action==='candy-eat'),holdBottle=!holdCandy&&Boolean(b?.held&&b.sips<3&&pose.inSeat==null||gesture&&!seatedDrink&&m.action==='bottle-sip');
    const rest=m.pantry.rest,kind=m.area==='smoking'?'':rest?.sprayer?'sprayer':rest?.stone?.held?'stone':rest?.tea&&(rest.tea.held&&pose.inSeat==null||gesture&&!seatedDrink&&m.action==='tea-sip')?'tea':'';
    const nextItem=JSON.stringify([kind,holdCandy,holdBottle,c?.progress,b?.sips]);
    if(itemKey!==nextItem){restTea?.dispose();restTea=null;restStone=null;if(heldItem)kit.release(heldItem);heldItem=kind==='sprayer'?misterModel(kit,right.wrist):kind==='stone'?(restStone=stoneModel(kit,right.wrist)).group:kind==='tea'?(restTea=teaModel(kit,right.wrist)).group:holdCandy?candyModel(kit,right.wrist,c?.progress??1):holdBottle?bottleModel(kit,right.wrist,b?.sips??0):null;itemKey=nextItem;if(heldItem){heldItem.scale.setScalar(holdCandy?.65:.7);heldItem.position.set(0,.025,.04);if(kind==='sprayer')heldItem.rotation.y=Math.PI;}}
    if(heldItem)heldItem.userData={directSurface:isMe,action:isMe?'held':undefined};
    heldHit.visible=isMe&&Boolean(heldItem);
    restTea?.update(rest?.tea??null,now,time,reduced);if(restStone&&rest?.stone)restStone.deform(now-rest.stone.pressAt,rest.stone.point,reduced);
    const contact=m.connected&&m.contact&&m.contact.until>now&&rest.sand?.held&&sit>.95?m.contact:null;
    const sandActive=Boolean(contact);sandBlend+=(Number(sandActive)-sandBlend)*(1-Math.exp(-dt*18));
    rake.visible=Boolean(contact?.kind==='rake');
    body.rotation.x+=sandBlend*.4;
    const eating=gesture&&m.action==='bite';
    for(const [a,side]of [[left,-1],[right,1]] as const){
      const spraying=kind==='sprayer'&&m.action==='plant-spray'&&age>=0&&age<650?Math.sin(age/650*Math.PI)*.65:0;
      const holding=side===1&&(holdCandy||holdBottle||Boolean(kind)),active=side===1?Math.max(drinking?0:amount,spraying):0;
      const swing=Math.sin(phase+(side===1?0:Math.PI))*.43*gaitBlend;
      const upper=T.MathUtils.lerp(holding?-.45:T.MathUtils.lerp(swing,-.35,sit),-1.2,active);
      const lower=T.MathUtils.lerp(holding?-1.1:T.MathUtils.lerp(-.15,-.6,sit),-1.35,active);
      a.shoulder.rotation.set(upper,0,side*.095);a.elbow.rotation.set(lower,0,0);
      if(!holding&&sit>0&&!reclined){
        const rest=resting[side===1?1:0];a.shoulder.quaternion.slerp(rest.shoulder,sit);a.elbow.quaternion.slerp(rest.elbow,sit);
      }
      a.wrist.quaternion.copy(a.shoulder.quaternion).multiply(a.elbow.quaternion).invert();
      const grasp=holding||(side===-1?drinking:eating);
      a.open.visible=!grasp;a.grip.visible=grasp;
      if(side===1)a.wrist.userData={directSurface:isMe&&holding,action:isMe&&holding?'held':undefined};
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
    if(cigarette&&smoke){
      mouth.set(0,hipY+avatarProportions.headY-.116*avatarProportions.headScale,.28);
      const g=smokeGesture(m.smoking,now),present=m.area==='smoking'&&pose.inSeat!=null&&!pose.moving;
      cigarette.group.visible=present&&(g.active||g.phase==='ending');
      lighter.visible=present&&g.phase==='lighting';flame.visible=!reduced&&g.age>280&&g.age<820;
      if(cigarette.group.visible){
        const lift=reduced?0:g.lift;
        const lit=g.phase==='ending'?g.age<490:g.phase!=='lighting'||g.age>650;
        cigarette.update(lit,g.emberPull,g.paperLength,g.ashLength);
        right.shoulder.quaternion.copy(cigaretteRest.shoulder).slerp(cigaretteMouth.shoulder,lift);
        right.elbow.quaternion.copy(cigaretteRest.elbow).slerp(cigaretteMouth.elbow,lift);
        const reach=g.phase==='ending'?(reduced?1:T.MathUtils.smoothstep(g.age/490,0,1)):reduced?0:g.ashReach;
        wristTilt.identity();
        if(reach>0){
          body.position.z+=reach*.19;body.rotation.x+=reach*.38;
          body.updateWorldMatrix(true,true);body.getWorldQuaternion(bodyWorld);
          const tray=smokingAshtray(pose.inSeat!);trayPoint.set(tray.x,tray.y+(g.phase==='ending'?0:.106+g.tap*.10),tray.z);body.worldToLocal(trayPoint);
          down.set(0,-1,0).applyQuaternion(bodyWorld.invert());tipOffset.set(0,0,1).applyQuaternion(cigarette.group.quaternion);
          targetTilt.setFromUnitVectors(tipOffset,down);wristTilt.copy(targetTilt);
          tipOffset.copy(cigarette.tip).applyQuaternion(cigarette.group.quaternion).add(cigarette.group.position).applyQuaternion(wristTilt);
          trayPoint.sub(tipOffset);const ashReach=armReach(right.shoulder.position,trayPoint);
          right.shoulder.quaternion.slerp(ashReach.shoulder,reach);right.elbow.quaternion.slerp(ashReach.elbow,reach);
          wristTilt.identity().slerp(targetTilt,reach);
        }
        right.wrist.quaternion.copy(right.shoulder.quaternion).multiply(right.elbow.quaternion).invert().multiply(wristTilt);
        right.open.visible=false;right.grip.visible=true;
        if(lighter.visible){
          body.updateWorldMatrix(true,true);matchPoint.copy(cigarette.tip);cigarette.group.localToWorld(matchPoint);body.worldToLocal(matchPoint);matchPoint.sub(lighter.position).sub(lighterProp.flameTip);
          const matchReach=armReach(left.shoulder.position,matchPoint);
          left.shoulder.quaternion.copy(matchReach.shoulder);left.elbow.quaternion.copy(matchReach.elbow);left.wrist.quaternion.copy(left.shoulder.quaternion).multiply(left.elbow.quaternion).invert();left.open.visible=false;left.grip.visible=true;
        }
        body.updateWorldMatrix(true,true);matchPoint.copy(cigarette.tip);cigarette.group.localToWorld(matchPoint);group.worldToLocal(matchPoint);smoke.ember(matchPoint,now,lit&&m.connected,reduced);
      }else smoke.hide();
      if(present&&m.connected)smoke.update(mouth,0,g.phase==='puffing'?g.age:-1,reduced);else smoke.hide();
    }
    cupGrip.rotation.x=drinking?(m.action==='wave'?-.08:-.40)*amount:0;
    heldCup.visible=drinking&&!seatedDrink;
    const nextSnack=JSON.stringify([m.food?.snack_id,m.food?.definition_version,m.food?.bites,m.food?.portions]);
    if(eating&&snackKey!==nextSnack){kit.release(whole);kit.release(bitten);whole=snackFood(kit,right.wrist,{...m.food,state:'open'},Math.max(0,(m.food?.bites??1)-1));bitten=snackFood(kit,right.wrist,m.food??{});for(const piece of[whole,bitten]){consolidate(piece,kit);piece.position.set(-.045,-.045,.052);piece.scale.setScalar(.18);piece.rotation.set(-.30,0,-.16);}snackKey=nextSnack;}
    whole.visible=eating&&!biteMotion.contact;bitten.visible=eating&&biteMotion.contact;
    const press=biteMotion.press-biteMotion.rebound;for(const piece of [whole,bitten])piece.scale.set(.18*(1+press*.55),.18*(1-press),.18*(1+press*.25));
    head.rotation.x=gesture?amount*.045:0;
    const blink=((time+seed*31)%5200);for(const eye of eyes)eye.scale.y=!reduced&&blink<130?.004:.023;
    ring.visible=isMe&&sit<.95;group.updateMatrixWorld(true);
    return {cupSocket,lift:seatedDrink?amount:0,eating};
  }
  return {group,avatar:member.avatar,update,labelPosition(_pose:Pose){return head.getWorldPosition(new T.Vector3()).add(new T.Vector3(0,.295*avatarProportions.headScale+.10,0));},dispose(){heldHitMaterial.dispose();cigarette?.dispose();smoke?.dispose();flameMaterial.dispose();restTea?.dispose();(ring.material as T.Material).dispose();kit.release(group);}};
}
