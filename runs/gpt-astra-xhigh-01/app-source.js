import * as THREE from './vendor/build/three.module.js';
import {createWorld,LANDMARKS} from './world.js';

(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  function fail(error){console.error(error);$('loading')?.classList.add('done');$('error').hidden=false;$('error-message').textContent=error instanceof Error?error.message:String(error);}
  window.addEventListener('error',e=>{if(!window.__MINIATURE__?.ready)fail(e.error||e.message);});
  window.addEventListener('unhandledrejection',e=>fail(e.reason));
  let renderer;
  try {renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});}catch(e){fail(new Error('이 장면은 WebGL 2 가 필요합니다. 브라우저에서 하드웨어 가속을 켠 뒤 새로고침하세요.'));return;}
  const canvas=renderer.domElement;canvas.tabIndex=0;canvas.setAttribute('aria-label','3D 광장. 드래그하여 궤도 회전, 우클릭 드래그로 이동, 스크롤로 줌. R 은 다시 중심, F 는 플라이오버, T 는 시간대, V 는 뷰, L 은 랜드마크.');$('world').appendChild(canvas);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.6));renderer.setSize(innerWidth,innerHeight);renderer.setClearColor('#d6e5e0');
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#ccdfeb');scene.fog=new THREE.Fog('#ccdfeb',430,1700);
  const camera=new THREE.PerspectiveCamera(40,innerWidth/innerHeight,.5,2600);
  const hemi=new THREE.HemisphereLight('#d9eeed','#9b9673',1.65);scene.add(hemi);
  const sun=new THREE.DirectionalLight('#fff0cc',2.8);sun.position.set(-150,250,115);sun.target.position.set(0,0,-15);scene.add(sun,sun.target);sun.castShadow=true;
  Object.assign(sun.shadow.camera,{left:-210,right:210,top:220,bottom:-210,near:10,far:650});sun.shadow.mapSize.set(4096,4096);sun.shadow.bias=-.00023;sun.shadow.normalBias=.1;sun.shadow.radius=3;
  const fill=new THREE.DirectionalLight('#b2d5db',.35);fill.position.set(170,120,-160);scene.add(fill);
  const churchLight=new THREE.PointLight('#ffcf83',0,86,1.2);churchLight.position.set(-9,10,0);scene.add(churchLight);
  const state={sunset:false,labels:false,flying:false,street:false,ready:false,frames:0,fps:0,elapsed:0};
  const target=new THREE.Vector3(-3,9,-9),wantedTarget=target.clone();
  const view={theta:-.18,phi:1.19,radius:346},wanted={...view};
  let world,last=0,animationId=0,flyStart=0,lighting=0,lodTick=0,toastTimer=0,frames=0,frameElapsed=0,pointerActive=false;
  const pointers=new Map();let pointerLast=null,pinchDistance=0;
  const labelNodes=LANDMARKS.map(l=>{const el=document.createElement('div');el.className='landmark';el.textContent=l.name;const small=document.createElement('small');small.textContent=l.sub;el.appendChild(small);$('labels').appendChild(el);el.style.display='none';return {...l,el,point:new THREE.Vector3(...l.p)};});
  function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2400);}
  function updateUI(){
    $('time-name').textContent=state.sunset?'골든아워':'맑은 낮';$('time-value').textContent=state.sunset?'19:15':'14:30';$('sun-symbol').textContent=state.sunset?'◒':'☀';
    $('fly-button').setAttribute('aria-pressed',String(state.flying));$('labels-button').setAttribute('aria-pressed',String(state.labels));$('view-button').setAttribute('aria-pressed',String(state.street));
    $('view-label').textContent=state.street?'항공 뷰':'거리 뷰';$('camera-mode').textContent=state.flying?'시네마틱':state.street?'거리 뷰':'항공 뷰';
    document.body.classList.toggle('sunset',state.sunset);$('labels').setAttribute('aria-hidden',String(!state.labels));
  }
  function stopFly(){if(state.flying){state.flying=false;Object.assign(wanted,view);wantedTarget.copy(target);updateUI();}}
  function recenter(){stopFly();state.street=false;Object.assign(wanted,{theta:-.18,phi:1.19,radius:346});wantedTarget.set(-3,9,-9);updateUI();toast('클루즈의 중심으로 돌아왔습니다');}
  function toggleTime(){state.sunset=!state.sunset;updateUI();toast(state.sunset?'골든아워 · 광장이 저녁으로 가라앉습니다':'맑은 낮 · 클루즈의 밝은 오후');}
  function toggleLabels(){state.labels=!state.labels;updateUI();toast(state.labels?'랜드마크 라벨 켜짐':'랜드마크 라벨 꺼짐');}
  function toggleFly(){state.flying=!state.flying;if(state.flying){flyStart=state.elapsed;state.street=false;toast('시네마틱 플라이오버 · 드래그하거나 F 키로 종료');}else{Object.assign(wanted,view);wantedTarget.copy(target);toast('플라이오버 일시정지');}updateUI();}
  function toggleView(){stopFly();state.street=!state.street;if(state.street){wantedTarget.set(-8,14,-25);const position=new THREE.Vector3(24,3.1,44),delta=position.sub(wantedTarget);wanted.radius=delta.length();wanted.theta=Math.atan2(delta.x,delta.z);wanted.phi=Math.acos(delta.y/wanted.radius);toast('거리 뷰 · 동상 옆');}else{wantedTarget.set(-3,9,-9);Object.assign(wanted,{theta:-.18,phi:1.19,radius:346});toast('항공 뷰');}updateUI();}
  $('reset-button').addEventListener('click',recenter);$('time-button').addEventListener('click',toggleTime);$('fly-button').addEventListener('click',toggleFly);$('labels-button').addEventListener('click',toggleLabels);$('view-button').addEventListener('click',toggleView);
  window.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey||e.repeat)return;if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;const action={r:recenter,t:toggleTime,f:toggleFly,l:toggleLabels,v:toggleView}[e.key.toLowerCase()];if(action){e.preventDefault();action();}});
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  function pan(dx,dy){const units=wanted.radius*.0014;wantedTarget.x-=Math.cos(wanted.theta)*dx*units;wantedTarget.z+=Math.sin(wanted.theta)*dx*units;wantedTarget.x+=Math.sin(wanted.theta)*dy*units;wantedTarget.z+=Math.cos(wanted.theta)*dy*units;wantedTarget.x=THREE.MathUtils.clamp(wantedTarget.x,-290,290);wantedTarget.z=THREE.MathUtils.clamp(wantedTarget.z,-310,310);}
  canvas.addEventListener('pointerdown',e=>{stopFly();canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});pointerLast={x:e.clientX,y:e.clientY,button:e.button};pointerActive=true;if(pointers.size===2){const p=[...pointers.values()];pinchDistance=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);}});
  canvas.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;const old=pointers.get(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});const dx=e.clientX-old.x,dy=e.clientY-old.y;
    if(pointers.size===2){const p=[...pointers.values()],dist=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);wanted.radius=THREE.MathUtils.clamp(wanted.radius*pinchDistance/Math.max(dist,1),18,680);pinchDistance=dist;pan(dx*.5,dy*.5);}else if(pointerLast?.button===2||e.shiftKey){pan(dx,dy);}else{wanted.theta-=dx*.004;wanted.phi=THREE.MathUtils.clamp(wanted.phi+dy*.003,.22,1.76);}pointerLast={x:e.clientX,y:e.clientY,button:pointerLast?.button||0};});
  function release(e){pointers.delete(e.pointerId);if(!pointers.size){pointerActive=false;pointerLast=null;}if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);}
  canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',e=>{pointers.delete(e.pointerId);pointerActive=pointers.size>0;});
  canvas.addEventListener('wheel',e=>{e.preventDefault();stopFly();wanted.radius=THREE.MathUtils.clamp(wanted.radius*Math.exp(e.deltaY*.001),18,680);},{passive:false});
  window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();cancelAnimationFrame(animationId);fail(new Error('The graphics context was interrupted. Reload to rebuild the miniature.'));});
  function contactShadows(){
    const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d'),gradient=ctx.createRadialGradient(32,32,2,32,32,32);gradient.addColorStop(0,'rgba(34,47,31,.34)');gradient.addColorStop(.45,'rgba(34,47,31,.19)');gradient.addColorStop(1,'rgba(34,47,31,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);const texture=new THREE.CanvasTexture(c);const mat=new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
    const items=world.occupancy.filter(r=>r.zone!=='A'&&r.zone!=='road'&&Math.hypot(r.x,r.z)<450);items.push({x:-8,z:-31,w:80,d:36},{x:-27,z:-51,w:18,d:18},{x:-7,z:11,w:24,d:16});
    const mesh=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),mat,items.length),dummy=new THREE.Object3D();items.forEach((r,i)=>{dummy.position.set(r.x,.235,r.z);dummy.rotation.set(-Math.PI/2,0,0);dummy.scale.set(r.w+9,r.d+9,1);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});mesh.computeBoundingSphere();scene.add(mesh);
  }
  function lightingUpdate(dt){const goal=state.sunset?1:0,previous=lighting;lighting=THREE.MathUtils.damp(lighting,goal,3,dt);if(Math.abs(lighting-goal)<.002)lighting=goal;if(previous===lighting)return;const u=lighting;
    sun.color.copy(new THREE.Color('#fff0cc').lerp(new THREE.Color('#ffc081'),u));sun.intensity=2.8-u*.25;sun.position.set(-150,250-u*207,115);hemi.intensity=1.65-u*.6;hemi.color.copy(new THREE.Color('#d9eeed').lerp(new THREE.Color('#96b0c5'),u));hemi.groundColor.copy(new THREE.Color('#9b9673').lerp(new THREE.Color('#677680'),u));
    scene.background.copy(new THREE.Color('#ccdfeb').lerp(new THREE.Color('#c5b5a7'),u));scene.fog.color.copy(scene.background);renderer.toneMappingExposure=1.05-u*.1;churchLight.intensity=u*72;world.setSunset(u);renderer.shadowMap.needsUpdate=true;
  }
  const projected=new THREE.Vector3();
  function updateLabels(){const used=[];
    for(const l of labelNodes){if(!state.labels||camera.position.distanceTo(l.point)>590){l.el.style.display='none';continue;}projected.copy(l.point).project(camera);const x=(projected.x*.5+.5)*innerWidth,y=(-projected.y*.5+.5)*innerHeight,w=l.name.length*5.4+26,h=42;
      const rect={x:x-w/2-5,y:y-h-8,w:w+10,h:h+22};const blocked=used.some(r=>rect.x<r.x+r.w&&rect.x+rect.w>r.x&&rect.y<r.y+r.h&&rect.y+rect.h>r.y);
      if(projected.z>1||projected.z<0||x<65||x>innerWidth-65||y<102||y>innerHeight-125||blocked){l.el.style.display='none';continue;}used.push(rect);l.el.style.display='block';l.el.style.left=x+'px';l.el.style.top=y+'px';
    }
  }
  function render(now){animationId=requestAnimationFrame(render);const rawDt=(now-last)/1000||.016,dt=Math.min(rawDt,.06);last=now;state.elapsed+=dt;state.frames++;
    if(state.flying){const f=state.elapsed-flyStart,phase=Math.min(1,f/30),rise=.5-.5*Math.cos(Math.min(1,Math.max(0,(f-12)/38))*Math.PI);wanted.theta=.43+f*.065;wanted.radius=160+rise*155;wanted.phi=1.39-rise*.52;wantedTarget.set(-5,8,-20);}
    const ease=1-Math.exp(-dt*(pointerActive?13:4.2));view.theta=THREE.MathUtils.lerp(view.theta,wanted.theta,ease);view.phi=THREE.MathUtils.lerp(view.phi,wanted.phi,ease);view.radius=THREE.MathUtils.lerp(view.radius,wanted.radius,ease);target.lerp(wantedTarget,ease);
    camera.position.set(target.x+Math.sin(view.theta)*Math.sin(view.phi)*view.radius,Math.max(2.5,target.y+Math.cos(view.phi)*view.radius),target.z+Math.cos(view.theta)*Math.sin(view.phi)*view.radius);camera.lookAt(target);camera.updateMatrixWorld();
    lightingUpdate(dt);world.animate(state.elapsed);if(now-lodTick>350){world.setLOD(camera);lodTick=now;}updateLabels();$('map-eye').setAttribute('transform',`translate(92 86) rotate(${-view.theta*180/Math.PI})`);renderer.render(scene,camera);
    frames++;frameElapsed+=rawDt;if(frameElapsed>1){state.fps=Math.round(frames/frameElapsed);$('fps').textContent=state.fps+' FPS';frames=0;frameElapsed=0;}
  }
  function start(){try{world=createWorld(scene);contactShadows();renderer.shadowMap.needsUpdate=true;updateUI();state.ready=true;$('loading').classList.add('done');setTimeout(()=>$('loading').remove(),900);
      window.__MINIATURE__={state,world,camera,renderer,scene,controls:{recenter,toggleTime,toggleView,toggleFly,toggleLabels},get ready(){return state.ready;},snapshot(){return {state:{...state},camera:camera.position.toArray(),target:target.toArray(),stats:world.stats,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,visibleLabels:labelNodes.filter(l=>l.el.style.display!=='none').map(l=>l.name),visiblePools:world.renderPools.filter(p=>p.mesh.visible).length};}};
      requestAnimationFrame(render);
    }catch(e){fail(e);}}
  // Let the browser paint the loading screen before constructing the city.
  requestAnimationFrame(()=>setTimeout(start,30));
  window.addEventListener('pagehide',()=>{cancelAnimationFrame(animationId);world?.dispose();renderer.dispose();});
})();
