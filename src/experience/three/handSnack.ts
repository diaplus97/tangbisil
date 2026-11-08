import * as T from 'three';
import {Workshop,consolidate} from './assets';

// A small separated piece fits between the fingertips. Its two biscuit
// layers, cream and lemon curd all follow the same broken edge.
export function handSnack(kit:Workshop,parent:T.Group,bitten:boolean){
 const group=new T.Group();parent.add(group);
 const shape=new T.Shape();shape.moveTo(-.085,-.047);shape.quadraticCurveTo(-.095,-.06,-.056,-.064);
 shape.quadraticCurveTo(.052,-.085,.091,-.032);shape.quadraticCurveTo(.101,.008,.083,.042);
 if(bitten){shape.quadraticCurveTo(.062,.023,.049,.042);shape.quadraticCurveTo(.026,.014,.011,.043);shape.lineTo(-.009,.064);}
 else shape.quadraticCurveTo(.055,.074,-.009,.064);
 shape.lineTo(-.036,.058);shape.lineTo(-.041,.048);shape.lineTo(-.061,.053);shape.lineTo(-.084,.034);shape.closePath();
 for(const [y,h,c] of [[0,.022,'#bd8047'],[.022,.009,'#e6ae31'],[.031,.023,'#ffe8b8'],[.054,.029,'#dca75f']] as const){
  const geo=new T.ExtrudeGeometry(shape,{depth:h,bevelEnabled:true,bevelThickness:.0025,bevelSize:.003,bevelSegments:2,curveSegments:8});
  geo.rotateX(-Math.PI/2);kit.mesh(group,geo,kit.mat(c),0,y,0);
 }
 for(const [x,z] of [[.011,.032],[-.03,.018],[.058,.011],[-.051,-.004],[.024,-.009]]){
  kit.sphere(group,.004,x,.084,z,'#bb8549',1,.35,.7);
 }
 consolidate(group,kit);return group;
}
