import * as T from 'three';
import {Workshop,label,consolidate} from './assets';
import {snackModel} from './snackModels';
import {snackDefinition,type SnackDisplay} from '../../../shared/snacks.mjs';

export function snackShelf(kit:Workshop,scene:T.Scene){
 let group:T.Group|null=null,key='';const hits:T.Object3D[]=[],hitMaterial=new T.MeshBasicMaterial({visible:false});
 function sync(display?:SnackDisplay){
  const next=JSON.stringify(display?.slots);if(next===key)return;key=next;if(group)kit.release(group);hits.length=0;
  group=new T.Group();group.position.set(-7.18,1.86,.65);group.rotation.y=Math.PI/2;scene.add(group);
  kit.box(group,1.94,.055,.48,0,0,0,'#bea280',.02);kit.box(group,1.94,.20,.025,0,.1,-.21,'#e8dfca',.012);
  for(const slot of display?.slots??[]){
   const r=snackDefinition(slot.snackId,slot.definitionVersion);if(!r)continue;
   const x=(slot.slot-1)*.64,food=snackModel(kit,group,{snack_id:r.id,definition_version:r.version,state:'sealed',bites:0,open_progress:0});food.position.set(x,.04,.015);food.scale.setScalar(.27);consolidate(food,kit);
   const short={lemonPie:'레몬파이',fruitMochi:'딸기모찌',layeredMochi:'겹겹초코',dubaiCookie:'두쫀쿠'}[r.kind];
   const tag=label(kit,group,short,.60,.145,x,-.07,.245,'#554f43','#f3e9d2',84);
   tag.userData={action:'snack-slot-'+slot.slot,station:'snacks',directSurface:true};
   food.userData={action:'snack-slot-'+slot.slot,station:'snacks',directSurface:true};
   const hit=kit.mesh(group,new T.BoxGeometry(.60,.6,.46),hitMaterial,x,.24,0);hit.castShadow=hit.receiveShadow=false;hit.userData={action:'snack-slot-'+slot.slot,station:'snacks'};
   hits.push(food,tag,hit);
  }
 }
 return{sync,hits,dispose(){if(group)kit.release(group);hitMaterial.dispose();}};
}
