import * as T from 'three';
import {Workshop,consolidate} from './assets';
import {flowers} from '../../../shared/vase.mjs';

export function vaseModel(kit:Workshop,parent:T.Object3D,flower='cosmos',position=0,tilt=0){
 const group=new T.Group();parent.add(group);
 const ceramic=kit.mat('#e3e4d9',.38),profile=[[0,.006],[.043,.006],[.058,.026],[.061,.075],[.043,.13],[.027,.153],[.025,.164],[.019,.164],[.02,.148],[.036,.124],[.05,.073],[.046,.025],[0,.019]].map(([r,y])=>new T.Vector2(r,y));
 kit.mesh(group,new T.LatheGeometry(profile,40),ceramic);
 kit.cylinder(group,.019,.019,.003,0,.148,0,'#839484');
 const stem=new T.Group();stem.position.set(position*.018,.154,0);stem.rotation.z=tilt;group.add(stem);
 kit.tube(stem,[new T.Vector3(0,-.02,0),new T.Vector3(-.009,.08,.002),new T.Vector3(.013,.18,.003),new T.Vector3(.006,.25,0)],.0032,'#76936a');
 for(const side of[-1,1]){const leaf=kit.mesh(stem,new T.SphereGeometry(1,20,12),kit.mat('#8da77a'),side*.027,.07+(side+1)*.025,.002);leaf.scale.set(.035,.012,.007);leaf.rotation.z=side*.45;}
 const bloom=new T.Group();bloom.position.set(.006,.252,0);bloom.rotation.x=.35;stem.add(bloom);
 const color=flowers.find(f=>f.id===flower)?.color??flowers[0].color,count=flower==='poppy'?5:flower==='cornflower'?12:8;
 for(let i=0;i<count;i++){
  const a=i/count*Math.PI*2,g=new T.Group();bloom.add(g);g.rotation.y=a;
  const petal=kit.mesh(g,new T.SphereGeometry(1,20,12),kit.mat(color,.74),0,.002,.032);petal.scale.set(flower==='poppy'?.028:flower==='cornflower'?.012:.018,.008,flower==='poppy'?.036:.032);petal.rotation.x=-.17;
  if(flower==='cornflower'){const tip=kit.mesh(g,new T.ConeGeometry(.009,.022,5),kit.mat('#a0bdd3'),0,.004,.065);tip.rotation.x=Math.PI/2;}
 }
 kit.sphere(bloom,.013,0,.012,0,flower==='poppy'?'#5c695b':'#d1b674',1,.65,1);
 for(let i=0;i<12;i++){const a=i*2.4,r=.004+i*.00065;kit.sphere(bloom,.0025,Math.cos(a)*r,.021,Math.sin(a)*r,'#ead09a');}
 consolidate(group,kit);return group;
}
