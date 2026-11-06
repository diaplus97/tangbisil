import type {Member} from './types';
import {sampleMotion} from '../../shared/space.mjs';
import {CUP_RETURN_MS} from './gestureTiming';
const visibleAction=(m:Member,now:number)=>now-m.actionAt<(m.action==='wave'?CUP_RETURN_MS:3500)?m.action:'rest';
type C=CanvasRenderingContext2D;
const pal={ink:'#344653',edge:'#66798a',blue:'#a9bccb',cream:'#f8f3df',wood:'#c8a67f',darkWood:'#907457'};
function rect(c:C,x:number,y:number,w:number,h:number,color:string){c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
function poly(c:C,points:number[][],color:string){c.fillStyle=color;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();}
function rounded(c:C,x:number,y:number,w:number,h:number,r:number,color:string){
  for(let row=0;row<h;row++){const dy=row<r?r-row:row>h-r?row-(h-r):0;const inset=dy?Math.round(r-Math.sqrt(Math.max(0,r*r-dy*dy))):0;rect(c,x+inset,y+row,w-inset*2,1,color);}
}
function noise(x:number,y:number){return Math.abs(Math.sin(x*127.1+y*311.7)*43758.5453)%1;}
function leaf(c:C,x:number,y:number,s=1){rect(c,x+2*s,y,4*s,2*s,'#4d7464');rect(c,x,y+2*s,8*s,3*s,'#547f65');rect(c,x+2*s,y+2*s,4*s,2*s,'#83a480');rect(c,x+3*s,y+5*s,3*s,2*s,'#4d7464');}
function plant(c:C,x:number,y:number,size=1){
  rect(c,x-8*size,y,16*size,3*size,'#ebdfc4');poly(c,[[x-7*size,y+3*size],[x+7*size,y+3*size],[x+5*size,y+16*size],[x-5*size,y+16*size]],'#b7b9ae');rect(c,x-5*size,y+4*size,3*size,10*size,'#dfe0cf');
  rect(c,x,y-21*size,2*size,23*size,'#6f8061');for(let i=0;i<7;i++)leaf(c,x+(i%2?-8:1)*size,y-(i*3+7)*size,size);
}
function packet(c:C,x:number,y:number,s=1){
  rect(c,x,y,23*s,27*s,'#64778c');rect(c,x+1*s,y+1*s,21*s,25*s,'#f5eac9');rect(c,x+2*s,y+3*s,19*s,4*s,'#9abac8');rect(c,x+2*s,y+21*s,19*s,3*s,'#9abac8');
  rect(c,x+4*s,y+8*s,14*s,9*s,'#dfb95d');rect(c,x+6*s,y+7*s,10*s,11*s,'#efd27d');rect(c,x+10*s,y+10*s,2*s,6*s,'#fff2b6');rect(c,x+7*s,y+12*s,8*s,2*s,'#fff2b6');
  for(let i=0;i<7;i++)rect(c,x+(i*3+1)*s,y+25*s,1*s,2*s,'#bac8ce');
}
export const seats=[{x:252,y:228},{x:395,y:228},{x:324,y:216},{x:227,y:302},{x:327,y:302},{x:428,y:302}];
export function pixelMemberPosition(m:Member,now=Date.now()){
  const pose=sampleMotion(m,now);return pose.phase==='seated'&&m.seat!=null?seats[m.seat]:{x:80+(pose.x+5.6)/11.25*490,y:286+(pose.z+3.85)/7*25};
}
export function drawAvatar(c:C,x:number,y:number,variant:number,action='rest',back=false,now=0){
  const skin='#e8bfa0',light='#f5d5b5',hair=variant?'#614c3f':'#343640',shirt=variant?'#b8b6a4':'#4c6079';
  // Feet, trousers, blouse, separate arms and hair silhouette are deliberately pixel-authored.
  rect(c,x-10,y+10,8,19,variant?'#5c6572':'#c7bba6');rect(c,x+2,y+10,8,19,variant?'#505a66':'#b5a993');
  rect(c,x-11,y+29,10,4,'#eee9d9');rect(c,x+2,y+29,10,4,'#eee9d9');rect(c,x-11,y+33,10,2,'#777c81');rect(c,x+2,y+33,10,2,'#777c81');
  rect(c,x-11,y-13,22,26,pal.ink);rect(c,x-10,y-13,20,24,shirt);rect(c,x-8,y-10,4,21,variant?'#d2cbb8':'#5f748c');
  rect(c,x-3,y-15,6,8,skin);poly(c,[[x-6,y-13],[x,y-6],[x-2,y+2],[x-7,y-7]],'#e8e4d7');poly(c,[[x+6,y-13],[x,y-6],[x+2,y+2],[x+7,y-7]],'#e8e4d7');
  for(let i=0;i<3;i++)rect(c,x,y+i*6,1,1,'#ddd9c9');
  rect(c,x-12,y-40,24,23,hair);rect(c,x-9,y-43,18,3,hair);
  if(!back){
    rect(c,x-10,y-33,20,15,skin);rect(c,x-8,y-35,17,15,light);rect(c,x-7,y-20,14,3,skin);rect(c,x-4,y-17,8,2,skin);
    if(variant){poly(c,[[x-12,y-34],[x-12,y-42],[x-5,y-46],[x+3,y-43],[x+10,y-44],[x+13,y-38],[x+10,y-31],[x+6,y-36],[x+1,y-32],[x-2,y-38],[x-8,y-33]],hair);rect(c,x-7,y-42,10,2,'#8c6d51');}
    else{rect(c,x-13,y-39,4,25,hair);rect(c,x+9,y-39,4,25,hair);poly(c,[[x-10,y-38],[x+9,y-38],[x+9,y-31],[x+5,y-34],[x+1,y-31],[x-3,y-35],[x-9,y-31]],hair);rect(c,x-8,y-41,13,2,'#53525b');}
    const blink=Math.floor(now/150)%34===0;
    rect(c,x-6,y-28,3,blink?1:3,'#423f40');rect(c,x+4,y-28,3,blink?1:3,'#423f40');
    if(!blink){rect(c,x-5,y-28,1,1,'#fff2dc');rect(c,x+5,y-28,1,1,'#fff2dc');}
    rect(c,x-8,y-24,3,1,'#d89e8a');rect(c,x+7,y-24,2,1,'#d89e8a');rect(c,x-1,y-21,3,1,'#af7564');
  }else{rect(c,x-9,y-39,3,18,variant?'#80624d':'#4c4a53');rect(c,x-5,y-16,10,3,hair);}
  const raised=action==='wave'||action==='bite';
  rect(c,x-15,y-10,6,17,shirt);rect(c,x-14,y+6,6,4,skin);
  if(raised){rect(c,x+10,y-18,5,18,shirt);rect(c,x+11,y-23,5,6,light);if(action==='wave')cup(c,x+17,y-22,'tea',0);else{rect(c,x+8,y-25,9,6,'#deb465');rect(c,x+8,y-22,9,2,'#fff0c6');}}
  else{rect(c,x+10,y-9,6,14,shirt);rect(c,x+11,y+5,6,4,skin);}
  if(action==='open'){rect(c,x-6,y+3,15,9,'#92b5c5');rect(c,x-4,y+4,11,6,'#f2dca0');rect(c,x-10,y+4,5,4,light);rect(c,x+8,y+4,5,4,light);}
  if(action==='offer'||action==='sample'){rect(c,x+12,y-6,16,5,shirt);rect(c,x+26,y-6,4,4,light);rect(c,x+25,y-9,15,2,'#eef0dc');rect(c,x+28,y-14,8,5,'#e0b567');}
}
function cup(c:C,x:number,y:number,drink:string,now:number){
  rect(c,x+7,y-7,4,7,'#5c7182');rect(c,x+7,y-5,2,3,'#dbe3df');rect(c,x-7,y-10,14,14,'#6e869b');rect(c,x-6,y-9,12,12,drink==='coffee'?'#c7b299':'#b4cfdb');rect(c,x-5,y-9,10,3,drink==='coffee'?'#654e43':drink==='tea'?'#b5a66b':'#d6e5e1');rect(c,x-5,y-4,2,6,'#e5eddf');rect(c,x-8,y+4,17,2,'#e7e5d9');
  if(drink!=='water')for(let i=0;i<3;i++){const dy=(now/170+i*5)%15;rect(c,x-4+i*4+Math.round(Math.sin(now/500+i)),y-13-dy,1,3,'#eef2e5');}
}
function chair(c:C,x:number,y:number,front=false){rect(c,x-15,y+17,3,21,'#8a7764');rect(c,x+12,y+17,3,21,'#8a7764');rect(c,x-17,y-5,34,25,'#61798b');rect(c,x-15,y-3,30,21,'#a1b7c6');rect(c,x-12,y-1,24,3,'#becbd0');if(front){rect(c,x-16,y-8,32,22,'#6c8395');rect(c,x-14,y-6,28,18,'#a4bac9');}}

export function drawRoom(c:C,allMembers:Member[],myId:string|undefined,offerCount:number,now:number,motionNow=now){
  const members=allMembers.filter(m=>sampleMotion(m,motionNow).phase==='seated');
  c.imageSmoothingEnabled=false;
  rect(c,0,0,640,360,'#d4dedf');rect(c,0,0,640,11,'#8195a5');rect(c,0,11,640,4,'#f1efdf');
  for(let x=0;x<640;x+=41){rect(c,x,15,1,183,'#c5d2d6');rect(c,x+1,15,1,183,'#dfe5e3');}
  rect(c,0,196,640,6,'#8094a3');rect(c,0,202,640,158,'#c9c6ba');
  for(let y=205;y<360;y+=22){rect(c,0,y,640,1,'#b1b4af');for(let x=(y%44?0:26);x<640;x+=54)rect(c,x,y,1,22,'#b4b7b0');}
  poly(c,[[273,206],[423,206],[556,360],[321,360]],'#e5ddc5');
  for(let k=0;k<4;k++)poly(c,[[286+k*35,206],[292+k*35,206],[354+k*50,360],[344+k*50,360]],'#c3c4b7');
  for(let j=0;j<700;j++){const x=Math.floor(noise(j,2)*640),y=204+Math.floor(noise(j,6)*156);rect(c,x,y,2,1,noise(j,3)>.5?'#cecabd':'#c3c1b6');}
  // Deep window frame, city layers, moving single cloud.
  rect(c,213,22,282,139,'#6c8295');rect(c,218,25,272,128,'#e5e7db');rect(c,223,30,262,118,'#9ac4d8');
  rect(c,224,31,260,40,'#b3d7e1');
  [[229,92,25,56],[260,75,22,73],[285,101,32,47],[324,83,23,65],[352,64,29,84],[386,99,20,49],[413,80,34,68],[456,91,27,57]].forEach(([x,y,w,h],i)=>{
    rect(c,x,y,w,h,['#93afc0','#8ca7ba','#adc3cc'][i%3]);for(let yy=y+5;yy<145;yy+=9)for(let xx=x+3;xx<x+w-2;xx+=6)rect(c,xx,yy,2,4,'#d0dce0');
  });
  rect(c,235,50,33,5,'#eaf0e8');rect(c,241,46,20,5,'#eaf0e8');rect(c,411,45,36,5,'#eaf0e8');rect(c,418,41,16,5,'#eaf0e8');
  rect(c,306,28,5,124,'#e5e7db');rect(c,398,28,5,124,'#e5e7db');rect(c,220,149,270,6,'#9baeb9');rect(c,208,155,292,6,'#f0ebd7');rect(c,211,161,286,4,'#9caeae');
  plant(c,474,146,1.3);
  // Window joinery, distant antennas and small reflected highlights.
  rect(c,220,28,3,121,'#526f83');rect(c,482,28,3,121,'#718da1');rect(c,226,32,1,114,'#d0e0df');
  rect(c,309,31,2,114,'#a7bbc1');rect(c,401,31,2,114,'#a7bbc1');rect(c,307,89,3,10,'#78909c');rect(c,400,89,3,10,'#78909c');
  for(const bx of [267,335,364,432]){rect(c,bx,68+(bx%4)*9,1,12,'#8ba9b8');rect(c,bx-3,71+(bx%4)*9,7,1,'#8ba9b8');}
  rect(c,241,44,11,2,'#eaf0e8');rect(c,233,49,3,2,'#eaf0e8');rect(c,263,49,3,3,'#eaf0e8');
  rect(c,345,151,26,3,'#eadfc4');rect(c,347,146,21,5,'#a8b1a4');rect(c,348,147,19,2,'#e6ddc5');
  // Pantry cabinet and coffee machine.
  poly(c,[[0,148],[177,134],[177,208],[0,244]],'#91aabb');poly(c,[[0,143],[173,130],[180,137],[0,156]],'#f5edda');
  for(let x=6;x<170;x+=41){rect(c,x,160,1,57,'#718b9f');rect(c,x+25,164,9,2,'#d9e0d8');}
  for(let x=8;x<170;x+=41){rect(c,x,177,31,1,'#a8bdc6');rect(c,x,178,1,30,'#a8bdc6');rect(c,x+30,178,1,24,'#839eaf');}
  rect(c,2,230,24,3,'#6d8797');rect(c,52,217,24,3,'#6d8797');rect(c,103,205,24,3,'#6d8797');
  rect(c,17,96,36,45,'#556876');rect(c,20,94,31,13,'#abb6ba');rect(c,22,109,27,29,'#2f414c');rect(c,26,109,18,8,'#8d999a');rect(c,33,117,4,10,'#c4c5b4');rect(c,23,136,26,4,'#bbc5c1');cup(c,35,130,'coffee',now);
  rect(c,60,123,15,15,'#b8d0d6');rect(c,62,121,11,3,'#e9eadd');rect(c,81,117,12,21,'#cbd9cc');rect(c,84,119,6,15,'#e9dfb0');
  rect(c,11,62,78,4,'#c5a47d');rect(c,15,66,2,8,'#8d765f');rect(c,80,66,2,8,'#8d765f');plant(c,26,47,.7);cup(c,52,56,'water',0);cup(c,72,56,'water',0);
  rect(c,70,83,18,26,'#758995');rect(c,72,85,14,22,'#f0e7ce');rect(c,75,89,8,1,'#c4bda7');rect(c,75,93,8,1,'#c4bda7');rect(c,75,97,5,1,'#c4bda7');rect(c,78,82,3,3,'#ba9d6d');
  rect(c,3,127,8,16,'#d8c7a2');for(let j=0;j<4;j++)rect(c,4+j*2,119+j%2,1,13,'#9a7856');
  // Three tidy rows of individually drawn packets.
  rect(c,105,71,72,66,'#8d745e');rect(c,109,75,64,58,'#d7c1a0');
  for(let i=0;i<3;i++)packet(c,111+i*20,78,.7);
  for(let i=0;i<3;i++)packet(c,111+i*20,104,.7);
  rect(c,106,99,71,4,'#aa8c6c');rect(c,106,130,71,5,'#aa8c6c');
  rect(c,119,69,44,6,'#f0e7cc');rect(c,127,71,28,2,'#7b929b');
  // Fridge with readable hinges and frosted glass.
  rect(c,181,78,26,121,'#7c93a4');rect(c,183,80,22,116,'#c4d1d2');rect(c,186,84,16,75,'#8daebd');rect(c,187,86,13,69,'#b1c8d0');
  for(let i=0;i<3;i++){rect(c,186,104+i*18,16,2,'#e1e6de');rect(c,189,93+i*18,4,10,'#e3ddbd');rect(c,196,96+i*18,3,7,'#c5a1a0');}rect(c,200,163,2,13,'#718995');
  // The hand-play nook and corridor door are background props in this slice.
  rect(c,523,78,48,81,'#9e8a72');rect(c,526,81,42,74,'#e0d4bb');
  for(let i=0;i<3;i++){rect(c,523,104+i*25,48,3,'#a28c71');for(let j=0;j<3;j++){rect(c,529+j*12,91+i*25,7,10,['#b2a3bf','#b2c1a3','#d4b78d'][j]);rect(c,531+j*12,89+i*25,3,3,'#e5decb');}}
  rect(c,515,177,63,32,'#7d96a9');rect(c,519,168,55,33,'#abc1cd');rect(c,520,200,5,18,'#8c7764');rect(c,568,200,5,18,'#8c7764');rect(c,528,173,29,17,'#e6dfc7');for(let x=531;x<556;x+=7)rect(c,x,173,2,17,'#aabccb');
  rect(c,593,55,43,150,'#6e8496');rect(c,596,58,37,144,'#a8bdca');rect(c,599,61,30,134,'#b9cbd1');rect(c,600,78,26,37,'#839daa');rect(c,602,80,22,32,'#c8d8db');rect(c,600,133,9,2,'#718493');rect(c,601,132,2,7,'#718493');
  plant(c,578,191,1.2);
  // Small wall clock and fabric stitching give the room lived-in detail.
  rect(c,543,32,22,22,'#7d8c8c');rect(c,545,34,18,18,'#eee7d2');rect(c,553,37,1,8,'#536f80');rect(c,553,44,6,1,'#536f80');for(const [tx,ty] of [[554,35],[554,50],[546,43],[560,43]])rect(c,tx,ty,1,2,'#a8a78f');
  for(let yy=171;yy<192;yy+=4)rect(c,562,yy,7,1,'#d5d6be');
  // Pendant and quiet pixel shadows.
  rect(c,322,0,1,21,'#617786');poly(c,[[314,22],[332,22],[341,34],[305,34]],'#718da2');rect(c,306,34,34,3,'#4f6d81');rect(c,312,37,22,2,'#f9e9ba');
  // Back chairs and bodies are behind the table; front visitors sit in front.
  for(let i=0;i<3;i++){const s=seats[i];chair(c,s.x,s.y);const m=members.find(m=>m.seat===i);if(m)drawAvatar(c,s.x,s.y,m.avatar,visibleAction(m,now),false,now);}
  poly(c,[[178,295],[512,295],[524,311],[169,312]],'#b0ad9d');
  rect(c,195,265,8,61,'#9c7d5a');rect(c,482,265,8,61,'#9c7d5a');rect(c,210,266,5,47,'#c2a27a');rect(c,468,266,5,47,'#c2a27a');
  poly(c,[[184,231],[480,231],[515,277],[165,277]],'#866e56');poly(c,[[184,224],[480,224],[515,270],[165,270]],'#d4b68e');
  poly(c,[[187,226],[477,226],[509,267],[170,267]],'#e1c8a1');
  for(let y=229;y<266;y+=8){rect(c,182-(y-229)*.3,y,298+(y-229)*1.1,1,'#c9ab86');for(let j=0;j<8;j++)rect(c,187+j*39+(y%3)*3,y+2,15,1,'#e8d2ae');}
  poly(c,[[277,225],[338,225],[351,268],[280,268]],'#98afbc');for(let y=228;y<267;y+=4)rect(c,282,y,55,1,'#b9cbd0');
  // Personal trays, real cup state, and center shared plate.
  members.filter(m=>m.seat!=null&&m.seat<3).forEach(m=>{const s=seats[m.seat!];const xx=s.x,yy=m.seat===2?232:247;rect(c,xx-25,yy-5,46,16,'#b99a78');rect(c,xx-23,yy-4,42,12,'#ede6d2');if(visibleAction(m,now)!=='wave')cup(c,xx-14,yy+1,m.drink,now);if(m.food?.state==='sealed')packet(c,xx+1,yy-10,.55);else if(m.food?.state==='open'){rect(c,xx+1,yy-5,14,7,'#d9aa58');rect(c,xx+1,yy-2,14,2,'#f8ebbd');}});
  rect(c,320,259,37,8,'#b1a78f');rect(c,318,257,40,7,'#eff0da');rect(c,324,255,28,4,'#f9f4df');
  if(offerCount){rect(c,328,250,17,8,'#d9ac58');rect(c,328,254,17,2,'#fff0be');rect(c,331,248,11,2,'#eac47b');}
  for(let i=3;i<6;i++){const s=seats[i];const m=members.find(m=>m.seat===i);if(m)drawAvatar(c,s.x,s.y-5,m.avatar,visibleAction(m,now),true,now);chair(c,s.x,s.y,true);}
  for(const m of allMembers.filter(m=>!members.includes(m))){const p=pixelMemberPosition(m,motionNow);drawAvatar(c,p.x,p.y,m.avatar,visibleAction(m,now),false,now);}
  // Tiny plant and a mug left on a shelf are decor, never fake visitors.
  plant(c,34,302,2);rect(c,4,333,61,7,'#8c9985');
}

export function drawPie(c:C,x:number,y:number,w=140,bites=0,sample=false){
  const destination=c,layer=document.createElement('canvas');layer.width=320;layer.height=200;c=layer.getContext('2d')!;
  const width=sample?w*.7:w,h=65;
  rounded(c,x+2,y+32,width-4,32,10,'#a56d35');rounded(c,x+3,y+30,width-6,29,10,'#c58a40');rounded(c,x+6,y+33,width-12,20,8,'#dfad63');
  rounded(c,x+2,y+24,width-4,23,10,'#d0ad67');rounded(c,x,y+23,width,19,9,'#efdeb2');
  for(let j=0;j<width-12;j+=6){rounded(c,x+6+j,y+24+(j%3),9,17-(j%3),3,'#fff0cd');rect(c,x+6+j,y+40+(j%2),6,3,'#dba63a');rect(c,x+7+j,y+40+(j%2),4,1,'#efcd61');}
  rounded(c,x,y+1,width,31,12,'#bd8238');rounded(c,x+1,y,width-2,28,12,'#dba14c');rounded(c,x+4,y-3,width-8,26,11,'#e9bc69');rounded(c,x+13,y-3,width-26,7,4,'#f0ce87');
  for(let j=0;j<210;j++){const px=9+Math.floor(noise(j,16)*(width-18)),py=4+Math.floor(noise(j,3)*19);rect(c,x+px,y+py,noise(j,6)>.8?2:1,1,noise(j,1)>.55?'#f9dea0':'#d7a15b');}
  for(let stripe=0;stripe<(sample?2:4);stripe++){const xx=x+18+stripe*27;for(let p=0;p<8;p++){rect(c,xx+p*2,y+4+p*2,4,2,'#fff2c9');rect(c,xx+p*2,y+6+p*2,3,1,'#dcbb7c');}}
  for(let j=0;j<70;j++)rect(c,x+11+noise(j,7)*(width-22),y+47+noise(j,9)*9,1,1,j%3?'#f0c77f':'#bf8e4f');
  if(bites>0){c.globalCompositeOperation='destination-out';for(const [bx,by,br] of [[x+width-4,y+7,20],[x+width-18,y-1,13],...(bites>1?[[x+4,y+42,22],[x+19,y+54,12]]:[])]){c.beginPath();c.arc(bx,by,br,0,Math.PI*2);c.fill();}}
  destination.drawImage(layer,0,0);
}
export function drawFood(c:C,progress:number,bites:number,empty:boolean,sample:boolean,t:number){
  rect(c,0,0,320,200,'#efe9d8');for(let y=0;y<200;y+=7)rect(c,0,y,320,1,'#e9e0ce');
  // Linen, ceramic plate and pixel rings.
  rect(c,14,17,292,166,'#dedfcd');rect(c,17,20,286,160,'#eeeedf');
  for(let i=0;i<28;i++){rect(c,18+i*10,20,1,160,'#e4e6d7');rect(c,17,21+i*6,286,1,'#e5e5d4');}
  const ring=(x:number,y:number,w:number,h:number,col:string)=>{c.fillStyle=col;c.beginPath();c.ellipse(x,y,w,h,0,0,Math.PI*2);c.fill();};
  ring(161,141,131,38,'#bec4bf');ring(160,136,132,38,'#f9f7e9');ring(160,135,114,29,'#b2c5c9');ring(160,133,111,27,'#e6ebe0');ring(160,130,103,24,'#f3f2df');
  const x=90,y=75;
  // Opened foil stays beneath the pie.
  poly(c,[[57,98],[83,65],[252,82],[265,133],[239,152],[60,148]],'#aabcc5');
  poly(c,[[61,96],[86,69],[248,85],[260,130],[236,147],[66,144]],'#d6dfe0');
  for(let i=0;i<9;i++)rect(c,62+i*21,136,10,2,'#eff1df');
  if(!empty)drawPie(c,x,y,sample?127:140,bites,sample);
  else for(let i=0;i<20;i++)rect(c,102+noise(i,10)*108,95+noise(i,12)*40,2,1,i%2?'#d2a360':'#b98d53');
  if(progress<1){
    const w=204*(1-progress);
    c.save();c.beginPath();c.rect(56,53,w,97);c.clip();
    rect(c,56,53,204,97,'#688c9f');rect(c,58,55,200,93,'#c9dbe0');rect(c,64,59,187,85,'#faf0c9');
    for(let i=0;i<12;i++)poly(c,[[64+i*17,59],[70+i*17,59],[89+i*17,143],[83+i*17,143]],'#f1dfaa');
    rect(c,64,59,187,16,'#94b5c5');rect(c,64,127,187,17,'#8fabb9');
    for(let j=0;j<34;j++){rect(c,58+j*6,55,2,4,'#eff0da');rect(c,58+j*6,144,2,4,'#819da9');}
    ring(100,102,19,17,'#dfba54');ring(100,102,15,13,'#f3d47c');
    for(let i=0;i<6;i++){const a=i*Math.PI/3;poly(c,[[100,102],[100+Math.cos(a)*13,102+Math.sin(a)*11],[100+Math.cos(a+.12)*13,102+Math.sin(a+.12)*11]],'#fff0b1');}
    rect(c,94,82,11,3,'#768f69');
    c.fillStyle='#456a7b';c.font='bold 13px monospace';c.fillText('LEMON',130,98);c.font='9px monospace';c.fillText('SANDWICH PIE',130,112);
    c.restore();
    const edge=56+w;
    poly(c,[[edge,53],[edge+17+progress*30,42-progress*9],[edge+23+progress*25,132],[edge,150]],'#a6bbc5');
    poly(c,[[edge,53],[edge+10+progress*30,48-progress*9],[edge+16+progress*25,132],[edge,150]],'#e0e9e7');
    rect(c,edge+6,77,14,23,'#7198aa');rect(c,edge+9,80,8,17,'#aac5cc');
  }
  if(t>0&&t<600){for(let i=0;i<6;i++)rect(c,160+Math.sin(i*2)*t/12,100+Math.cos(i*2)*t/17,2,2,'#d8b66f');}
}
