import * as T from 'three';
import {Workshop,mug,pie,consolidate} from './assets';
import {softBox} from './detailGeometry';
import type {Member} from '../types';
import type {Pose} from '../../../shared/space.mjs';
import {armReach} from './armReach';
import {CUP_RETURN_MS,SIP_RETURN_MS} from '../gestureTiming';
import {misterModel,stoneModel,teaModel} from './restModels';
import {candyModel,bottleModel} from './stations';

export function createCharacter(kit:Workshop,member:Member){
  const group=new T.Group(),body=new T.Group();group.add(body);
  const shirt=kit.mat(member.avatar?'#bcb39a':'#516e7e',.95),pants=kit.mat(member.avatar?'#596b70':'#b9aa90',.94),skin=kit.mat('#dfb599',.8),hair=kit.mat(member.avatar?'#735741':'#353d3e',.9);
  const jacket=softBox(kit,body,.47,.55,.32,.085,shirt);jacket.position.y=.285;
  const inner=softBox(kit,body,.16,.4,.018,.007,kit.mat('#eee9d8'));inner.position.set(0,.34,.167);
  for(const x of [-.1,.1]){const collar=softBox(kit,body,.135,.13,.035,.012,kit.mat('#eee9d8'));collar.position.set(x,.52,.17);collar.rotation.z=x<0?.37:-.37;}
  for(let i=0;i<3;i++)kit.sphere(body,.012,.13,.42-i*.11,.166,'#d4d1c0');
  kit.cylinder(body,.069,.075,.13,0,.6,0,'#dfb599');
  const head=new T.Group();head.position.set(0,.86,.005);body.add(head);
  const headGeo=new T.SphereGeometry(1,32,24),hp=headGeo.getAttribute('position');
  for(let i=0;i<hp.count;i++){const y=hp.getY(i);hp.setXYZ(i,hp.getX(i)*.222*(y<0?1+y*.13:1),y*.253,hp.getZ(i)*.19);}headGeo.computeVertexNormals();
  kit.mesh(head,headGeo,skin);
  const cap=kit.mesh(head,new T.SphereGeometry(.238,32,20,0,Math.PI*2,0,Math.PI*.58),hair,0,.06,-.026);cap.scale.set(1,1,.85);
  for(const x of [-.219,.219]){const ear=kit.mesh(head,new T.SphereGeometry(.044,14,10),skin,x,-.014,0);ear.scale.set(.6,1,.7);}
  if(member.avatar){
    for(let i=0;i<4;i++){
      const tuft=kit.mesh(head,new T.SphereGeometry(.1,18,12),hair,-.12+i*.065,.16,.116);tuft.scale.set(.8,.65,.55);tuft.rotation.z=-.35;
    }
  }else{
    for(const x of [-.19,.19]){const lock=kit.mesh(head,new T.CapsuleGeometry(.055,.19,6,12),hair,x,-.04,-.07);lock.rotation.z=x<0?-.05:.05;}
    const back=kit.mesh(head,new T.SphereGeometry(.225,28,18),hair,0,-.025,-.12);back.scale.set(1,.94,.43);
  }
  const eyes:T.Mesh[]=[];
  for(const x of [-.083,.083]){
    const eye=kit.sphere(head,.018,x,.008,.181,'#344541',.8,1.15,.46);eyes.push(eye);
    kit.sphere(head,.005,x-.004,.014,.191,'#f2ecdb',1,1,.5);
    kit.tube(head,[new T.Vector3(x-.028,.059,.174),new T.Vector3(x,.068,.18),new T.Vector3(x+.025,.061,.174)],.005,member.avatar?'#735741':'#353d3e');
    kit.sphere(head,.032,x*1.35,-.06,.16,'#d79c87',1,.3,.2);
  }
  kit.mesh(head,new T.SphereGeometry(.026,14,10),skin,0,-.037,.188).scale.set(.65,.9,.7);
  kit.tube(head,[new T.Vector3(-.025,-.108,.165),new T.Vector3(0,-.115,.172),new T.Vector3(.025,-.108,.165)],.004,'#986d5b');
  const legs:{hip:T.Group;knee:T.Group;ankle:T.Group;side:number}[]=[];
  for(const side of [-1,1]){
    const hip=new T.Group();hip.position.x=side*.125;group.add(hip);
    const thigh=softBox(kit,hip,.19,.45,.2,.025,pants);thigh.position.y=-.21;
    const knee=new T.Group();knee.position.y=-.42;hip.add(knee);
    kit.mesh(knee,new T.SphereGeometry(.094,20,14),pants).scale.set(1,1.15,1);
    const shin=softBox(kit,knee,.17,.57,.17,.025,pants);shin.position.y=-.275;
    const ankle=new T.Group();ankle.position.y=-.55;knee.add(ankle);
    const shoe=softBox(kit,ankle,.205,.12,.32,.045,kit.mat('#e6e1d4',.65));shoe.position.set(0,-.065,.075);
    const sole=softBox(kit,ankle,.213,.027,.328,.011,kit.mat('#8e9993'));sole.position.set(0,-.125,.075);
    for(let i=0;i<3;i++)kit.box(ankle,.11,.012,.015,0,-.012,.05+i*.035,'#c8cec5',.005);
    legs.push({hip,knee,ankle,side});
  }
  function arm(side:number){
    const shoulder=new T.Group();shoulder.position.set(side*.29,.51,0);body.add(shoulder);
    const sleeve=softBox(kit,shoulder,.145,.3,.17,.055,shirt);sleeve.position.y=-.145;
    const elbow=new T.Group();elbow.position.y=-.29;shoulder.add(elbow);
    const forearm=softBox(kit,elbow,.135,.265,.15,.045,shirt);forearm.position.y=-.13;
    kit.mesh(elbow,new T.SphereGeometry(.072,16,12),shirt);
    const wrist=new T.Group();wrist.position.y=-.27;elbow.add(wrist);
    const palm=kit.mesh(wrist,new T.SphereGeometry(.071,16,12),skin,0,-.012,.025);palm.scale.set(.85,.68,1);
    return {shoulder,elbow,wrist};
  }
  const left=arm(-1),right=arm(1),carry=new T.Group();left.wrist.add(carry);carry.position.set(0,.035,.06);
  let heldCup=mug(kit,right.wrist,0,.012,.04,member.drink,.68);heldCup.visible=false;
  const heldBite=pie(kit,right.wrist,0,true);consolidate(heldBite,kit);heldBite.scale.setScalar(.15);heldBite.position.set(0,.03,.04);heldBite.visible=false;
  const ring=kit.mesh(group,new T.RingGeometry(.27,.29,48),new T.MeshBasicMaterial({color:'#87a698',transparent:true,opacity:.4,depthWrite:false}),0,-.018,0);ring.rotation.x=-Math.PI/2;ring.castShadow=false;ring.receiveShadow=false;
  // Batch each rigid part independently, preserving the actual moving joints.
  const joints:T.Group[]=[];group.traverse(o=>{if(o instanceof T.Group)joints.push(o);});
  for(const joint of joints){const meshes=joint.children.filter(o=>o instanceof T.Mesh&&o!==ring&&!eyes.includes(o));if(meshes.length<2)continue;const rigid=new T.Group();joint.add(rigid);for(const mesh of meshes)rigid.add(mesh);consolidate(rigid,kit);}
  const rake=new T.Group();right.wrist.add(rake);rake.position.set(0,-.02,.08);
  kit.cylinder(rake,.011,.011,.19,0,.09,0,'#b7986b');kit.box(rake,.14,.012,.014,0,-.005,0,'#ae8f62',.004);for(const x of[-.055,0,.055])kit.box(rake,.008,.035,.009,x,-.02,0,'#b7986b',.003);rake.visible=false;
  let sandBlend=0;
  let drink=member.drink,last=0,initialized=false,yaw=0,itemKey='',heldItem:T.Group|null=null;
  let restTea:ReturnType<typeof teaModel>|null=null,restStone:ReturnType<typeof stoneModel>|null=null;
  const seed=[...member.id].reduce((n,c)=>n+c.charCodeAt(0),0);
  function update(m:Member,pose:Pose,time:number,now:number,reduced:boolean,isMe:boolean){
    if(drink!==m.drink){kit.release(heldCup);heldCup=mug(kit,right.wrist,0,.012,.04,m.drink,.68);drink=m.drink;}
    const dt=last?Math.min((time-last)/1000,.1):1;last=time;
    const turn=Math.atan2(Math.sin(pose.yaw-yaw),Math.cos(pose.yaw-yaw));yaw=initialized?yaw+turn*(1-Math.exp(-dt*12)):pose.yaw;initialized=true;
    group.position.set(pose.x,0,pose.z);group.rotation.y=yaw;
    const walking=pose.phase==='walking',sit=pose.sit,phase=pose.distance/ .72*Math.PI*2;
    const reclined=m.area==='healing'&&(pose.inSeat??m.seat??0)<4;
    const seatHip=m.area==='healing'?(reclined?.41:.61):.755;
    const hipY=T.MathUtils.lerp(1.083,seatHip,sit)+(walking&&!reduced?Math.cos(phase*2)*.008-.02:0);
    body.position.y=hipY;body.rotation.z=walking&&!reduced?Math.sin(phase)*.018:0;
    body.rotation.x=-.2*sit*(reclined?1:0)+((pose.phase==='rising'||pose.phase==='sitting')?Math.sin(sit*Math.PI)*.12:0);
    for(const leg of legs){
      const cycle=phase+(leg.side===1?Math.PI:0),swing=walking&&!reduced?Math.sin(cycle):0;
      const targetY=.113+Math.max(0,swing)*.07,targetZ=T.MathUtils.lerp(swing*.15,.43,sit),dy=hipY-targetY;
      const d=Math.min(.969,Math.hypot(dy,targetZ)),upper=Math.atan2(targetZ,dy)+Math.acos(T.MathUtils.clamp((.42*.42+d*d-.55*.55)/(2*.42*d),-1,1));
      const bend=Math.PI-Math.acos(T.MathUtils.clamp((.42*.42+.55*.55-d*d)/(2*.42*.55),-1,1));
      leg.hip.position.y=hipY;leg.hip.rotation.x=-upper;leg.knee.rotation.x=bend;leg.ankle.rotation.x=upper-bend;
    }
    const age=now-m.actionAt,gestureLength=['cup-sip','tea-sip','bottle-sip'].includes(m.action)?SIP_RETURN_MS:CUP_RETURN_MS,gesture=age>=0&&age<gestureLength&&['cup-sip','wave','bite','candy-eat','bottle-sip','tea-sip'].includes(m.action);
    const amount=gesture?Math.min(1,age/400,(gestureLength-age)/350):0;
    const c=m.pantry?.candy,b=m.pantry?.bottle,holdCandy=Boolean(c?.held&&c.state!=='eaten'||gesture&&m.action==='candy-eat'),holdBottle=!holdCandy&&Boolean(b?.held&&b.sips<3&&pose.inSeat==null||gesture&&m.action==='bottle-sip');
    const rest=m.pantry.rest,kind=rest?.sprayer?'sprayer':rest?.stone?.held?'stone':rest?.tea&&(rest.tea.held&&pose.inSeat==null||gesture&&m.action==='tea-sip')?'tea':'';
    const nextItem=JSON.stringify([kind,holdCandy,holdBottle,c?.progress,b?.sips]);
    if(itemKey!==nextItem){restTea?.dispose();restTea=null;restStone=null;if(heldItem)kit.release(heldItem);heldItem=kind==='sprayer'?misterModel(kit,right.wrist):kind==='stone'?(restStone=stoneModel(kit,right.wrist)).group:kind==='tea'?(restTea=teaModel(kit,right.wrist)).group:holdCandy?candyModel(kit,right.wrist,c?.progress??1):holdBottle?bottleModel(kit,right.wrist,b?.sips??0):null;itemKey=nextItem;if(heldItem){heldItem.scale.setScalar(holdCandy?.65:.7);heldItem.position.set(0,.025,.04);if(kind==='sprayer')heldItem.rotation.y=Math.PI;}}
    restTea?.update(rest?.tea??null,now,time,reduced);if(restStone&&rest?.stone)restStone.deform(now-rest.stone.pressAt,rest.stone.point,reduced);
    const contact=m.connected&&m.contact&&m.contact.until>now&&rest.sand?.held&&sit>.95?m.contact:null;
    const sandActive=Boolean(contact);sandBlend+=(Number(sandActive)-sandBlend)*(1-Math.exp(-dt*18));
    rake.visible=Boolean(contact?.kind==='rake');
    body.rotation.x+=sandBlend*.4;
    const standing=1-sit,carryPose=standing>.05;
    for(const [a,side]of [[left,-1],[right,1]] as const){
      const spraying=kind==='sprayer'&&m.action==='plant-spray'&&age>=0&&age<650?Math.sin(age/650*Math.PI)*.65:0;
      const holding=(side===-1&&carryPose)||(side===1&&(holdCandy||holdBottle||Boolean(kind))),active=side===1?Math.max(amount,spraying):0;
      const swing=walking&&!reduced?Math.sin(phase+(side===1?0:Math.PI))*.28:0;
      const upper=T.MathUtils.lerp(holding?-.45:T.MathUtils.lerp(swing,-.35,sit),-1.2,active);
      const lower=T.MathUtils.lerp(holding?-1.1:T.MathUtils.lerp(-.15,-.6,sit),-1.35,active);
      a.shoulder.rotation.x=upper;a.shoulder.rotation.z=side*.035;a.elbow.rotation.x=lower;a.wrist.rotation.x=-upper-lower;
      if(sandBlend>.001&&side===1){
        // Reach onto the low tray; one small forearm stroke only while contact is live.
        const sweep=reduced?0:Math.sin(time*.006)*.11;
        a.shoulder.rotation.x=T.MathUtils.lerp(upper,-1.1+sweep*.35,sandBlend);a.shoulder.rotation.z=T.MathUtils.lerp(side*.035,-.16+sweep,sandBlend);
        a.elbow.rotation.x=T.MathUtils.lerp(lower,-.58-sweep*.4,sandBlend);a.wrist.rotation.x=-a.shoulder.rotation.x-a.elbow.rotation.x;
      }
    }
    if(gesture&&['cup-sip','tea-sip','bottle-sip','candy-eat','bite'].includes(m.action)){
      const y=['cup-sip','tea-sip'].includes(m.action)?.60:m.action==='bottle-sip'?.56:.72,reach=armReach(right.shoulder.position,new T.Vector3(.075,y,.25));
      right.shoulder.quaternion.slerp(reach.shoulder,amount);right.elbow.quaternion.slerp(reach.elbow,amount);
      right.wrist.quaternion.copy(right.shoulder.quaternion).multiply(right.elbow.quaternion).invert();
    }
    heldCup.visible=gesture&&['cup-sip','wave'].includes(m.action);heldCup.rotation.x=gesture&&m.action==='cup-sip'?-.3*amount:0;heldBite.visible=gesture&&m.action==='bite';
    head.rotation.y=0;head.rotation.z=0;
    const blink=((time+seed*31)%5200);for(const eye of eyes)eye.scale.y=(!reduced&&blink<130)?.12:1.15;
    ring.visible=isMe&&sit<.95;group.updateMatrixWorld(true);
    return {cupRaised:heldCup.visible,sit,carry};
  }
  return {group,update,labelPosition(pose:Pose){return new T.Vector3(pose.x,2.32-pose.sit*(member.area==='healing'?((pose.inSeat??0)<4?.67:.465):.32),pose.z);},dispose(){restTea?.dispose();(ring.material as T.Material).dispose();kit.release(group);}};
}
