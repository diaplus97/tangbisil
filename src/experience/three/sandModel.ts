import * as T from 'three';
import {Workshop} from './assets';
export function sandModel(kit:Workshop,parent:T.Object3D){
 const group=new T.Group();parent.add(group);
 kit.box(group,.72,.038,.48,0,.02,0,'#b99d75',.04);
 for(const x of[-.35,.35])kit.box(group,.032,.055,.48,x,.055,0,'#b99d75',.012);
 for(const z of[-.225,.225])kit.box(group,.72,.055,.03,0,.055,z,'#c7ae87',.012);
 kit.box(group,.65,.025,.405,0,.045,0,'#ddcfab',.015);
 for(const [x,z,size]of[[-.18,-.09,.038],[.18,-.06,.05],[.1,.13,.043]]){const stone=kit.sphere(group,size,x,.075,z,'#88988c',1,.57,.85);stone.rotation.y=x*3;}
 return{group};
}
