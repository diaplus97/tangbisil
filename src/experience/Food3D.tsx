import {useEffect,useRef} from 'react';
import * as T from 'three';
import {Workshop,makeRenderer,pie} from './three/assets';

type Props={progress:number;bites:number;empty:boolean;sample:boolean;crunch:number;label:string;onUnavailable:()=>void};
export default function Food3D(props:Props){
  const canvas=useRef<HTMLCanvasElement>(null),latest=useRef(props),update=useRef<(()=>void)|null>(null);latest.current=props;
  useEffect(()=>{update.current?.();},[props.progress,props.bites,props.empty,props.sample]);
  useEffect(()=>{
    let renderer:T.WebGLRenderer;
    try{renderer=makeRenderer(canvas.current!);}catch{latest.current.onUnavailable();return;}
    renderer.toneMapping=T.NeutralToneMapping;renderer.toneMappingExposure=1;
    const kit=new Workshop(),scene=new T.Scene(),camera=new T.OrthographicCamera(-1.9,1.9,1.19,-1.19,.1,30);
    camera.position.set(2.5,3.5,5.6);camera.lookAt(0,.25,0);
    scene.add(new T.HemisphereLight('#fff9ed','#b4c5c0',1.25));
    const sun=new T.DirectionalLight('#fff2d8',2);sun.position.set(-3,6,2);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);
    Object.assign(sun.shadow.camera,{left:-3,right:3,top:3,bottom:-3,near:.1,far:15});sun.shadow.bias=-.001;sun.shadow.normalBias=.015;sun.shadow.radius=3;scene.add(sun);
    const fill=new T.DirectionalLight('#f5f9ed',.65);fill.position.set(3,2,5);scene.add(fill);
    // Transparent foreground: the room remains visible around the plate.
    const linen=kit.box(scene,3.3,.025,2.45,0,.005,0,'#d3d8c7',.045);linen.rotation.y=-.08;
    for(let i=0;i<24;i++)kit.box(scene,3.08,.001,.006,0,.02,-1.12+i*.096,'#c6ceba',.001);
    const plate=new T.Group();plate.scale.z=.8;scene.add(plate);
    kit.cylinder(plate,1.35,1.18,.1,0,.09,0,'#f0eddb');kit.cylinder(plate,1.2,1.2,.012,0,.145,0,'#9fb8b9');
    kit.cylinder(plate,1.15,1.15,.015,0,.155,0,'#eae9d7');
    const rim=kit.mesh(plate,new T.TorusGeometry(1.29,.045,8,64),kit.mat('#f4f0df'),0,.16,0);rim.rotation.x=Math.PI/2;
    const foil=kit.box(scene,2.24,.014,1.34,0,.185,0,'#c2cecc',.07);foil.rotation.y=.045;
    for(let i=0;i<8;i++){const crease=kit.box(scene,.008,.009,1.27,-1.02+i*.29,.198,0,'#dce1d9',.001);crease.rotation.y=.07;}
    let food:T.Group|null=null,foodKey='';
    const crumbs=new T.Group();scene.add(crumbs);
    for(let i=0;i<14;i++)kit.sphere(crumbs,.012+(i%3)*.005,Math.sin(i*53.4)*.85,.208,Math.sin(i*12.7)*.45,i%2?'#bf8e50':'#dcb26a',1,.55,1);
    const coverMaterial=new T.MeshStandardMaterial({roughness:.9,side:T.DoubleSide,map:kit.texture(c=>{
      c.fillStyle='#f2e7c5';c.fillRect(0,0,1024,512);
      c.fillStyle='#e8d9a7';for(let i=0;i<20;i++){c.beginPath();c.moveTo(i*65-200,0);c.lineTo(i*65-175,0);c.lineTo(i*65+35,512);c.lineTo(i*65+10,512);c.fill();}
      c.fillStyle='#8da9b6';c.fillRect(0,0,1024,65);c.fillRect(0,442,1024,70);
      c.fillStyle='#d4ac51';c.beginPath();c.ellipse(264,250,95,98,-.2,0,Math.PI*2);c.fill();
      c.fillStyle='#edd07a';c.beginPath();c.arc(264,250,76,0,Math.PI*2);c.fill();
      c.strokeStyle='#fff0b5';c.lineWidth=9;for(let i=0;i<6;i++){const a=i*Math.PI/3;c.beginPath();c.moveTo(264,250);c.lineTo(264+Math.cos(a)*68,250+Math.sin(a)*68);c.stroke();}
      c.fillStyle='#78966b';c.beginPath();c.ellipse(278,141,30,12,-.3,0,Math.PI*2);c.fill();
      c.fillStyle='#456c7d';c.font='600 64px Georgia';c.fillText('LEMON',433,250);c.font='24px sans-serif';c.fillText('GLAZED SANDWICH PIE',435,295);
      c.font='18px sans-serif';c.fillStyle='#6f8a96';c.fillText('a little break, a little sunshine',435,338);
    },1024,512)});
    kit.materials.set('wrapper',coverMaterial);
    const coverGeometry=new T.PlaneGeometry(2.2,1.32,48,8);coverGeometry.rotateX(-Math.PI/2);
    const original=coverGeometry.attributes.position.array.slice();
    const cover=kit.mesh(scene,coverGeometry,coverMaterial,0,.49,0);cover.castShadow=true;
    const edges=new T.Group();scene.add(edges);
    for(const sign of [-1,1]){
      const geometry=new T.PlaneGeometry(2.2,1,48,8),positions=geometry.attributes.position;
      for(let i=0;i<positions.count;i++){
        const x=positions.getX(i),v=positions.getY(i)+.5,bulge=1-Math.pow(Math.abs(x)/1.1,6);
        positions.setXYZ(i,x,.49+(v-.5)*.5*bulge,sign*(.52+.14*v+.1*Math.sin(Math.PI*v)));
      }
      geometry.computeVertexNormals();
      const material=kit.mat('#e6d9b1');material.side=T.DoubleSide;kit.mesh(edges,geometry,material);
    }
    const side=kit.box(scene,.11,.025,1.34,1.1,.49,0,'#8ea9b3',.008);
    const left=kit.box(scene,.11,.025,1.34,-1.1,.49,0,'#8ea9b3',.008);
    const foldedEnd=kit.box(scene,.06,.015,1.36,1.17,.49,0,'#c5d2d0',.004);
    function sync(){
      const p=latest.current,newKey=`${p.bites}/${p.empty}/${p.sample}`;
      // Give the lifted wrapper headroom, then return smoothly as it settles open.
      const lift=matchMedia('(prefers-reduced-motion: reduce)').matches?0:Math.sin(Math.PI*p.progress);camera.position.y=3.5+.18*lift;camera.lookAt(0,.25+.18*lift,0);
      camera.zoom=1/(1+.12*lift);camera.updateProjectionMatrix();
      if(newKey!==foodKey){
        if(food)kit.release(food);
        food=p.empty?null:pie(kit,scene,p.bites,p.sample);if(food)food.position.y=.22;foodKey=newKey;
      }
      crumbs.visible=p.bites>0||p.empty;
      const open=p.progress>=.999||p.sample||p.empty;
      cover.visible=edges.visible=side.visible=foldedEnd.visible=!open;left.visible=!open&&p.progress<.02;
      const remaining=Math.max(.001,1-p.progress);edges.scale.x=remaining;edges.position.x=p.progress*1.1;
      const position=coverGeometry.attributes.position,edge=-1.1+p.progress*2.2;
      for(let i=0;i<position.count;i++){
        const x=original[i*3],z=original[i*3+2],distance=Math.max(0,edge-x),radius=.16;
        const rise=.25*(1-Math.pow(Math.abs(x)/1.1,6));
        const peeled=p.progress>0&&x<edge-.00001;
        position.setXYZ(i,peeled?edge-Math.sin(distance/radius)*radius:x,peeled?.25+radius*(1-Math.cos(distance/radius)):rise,z);
      }
      position.needsUpdate=true;coverGeometry.computeVertexNormals();
      renderer.render(scene,camera);
    }
    update.current=sync;
    function resize(){const parent=canvas.current!.parentElement!,width=parent.clientWidth,ratio=getComputedStyle(parent).aspectRatio.split('/').map(Number),aspect=Number.isFinite(ratio[0])?ratio[0]/(ratio[1]||1):1.6,height=width/aspect;camera.left=-1.7;camera.right=1.7;camera.top=1.7/aspect;camera.bottom=-1.7/aspect;camera.updateProjectionMatrix();renderer.setSize(width,height,false);sync();}
    const observer=new ResizeObserver(resize);observer.observe(canvas.current!.parentElement!);
    const lost=(event:Event)=>{event.preventDefault();latest.current.onUnavailable();};const element=canvas.current!;element.addEventListener('webglcontextlost',lost);
    resize();element.dataset.ready='true';
    return()=>{observer.disconnect();element.removeEventListener('webglcontextlost',lost);update.current=null;kit.dispose();renderer.dispose();renderer.forceContextLoss();};
  },[]);
  return <canvas ref={canvas} width="640" height="400" className="food-three-canvas" aria-label={props.label}/>;
}
