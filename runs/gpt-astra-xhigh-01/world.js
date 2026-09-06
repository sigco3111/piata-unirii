import * as THREE from './vendor/build/three.module.js';

// Metres. East = +X, north = -Z. Architectural anchors never use randomness.
export const LANDMARKS = [
  {name:'성 미하일 성당',sub:'Biserica Sfântul Mihail',p:[-8,45,-30],rank:0},
  {name:'마차이 코르비누스 동상',sub:'기마 동상대 · 1902년',p:[-7,11,12],rank:1},
  {name:'반피 궁전',sub:'미술관(Muzeul de Artă)',p:[105,21,-64],rank:2},
  {name:'미러 빌딩',sub:'이울리우 마니우 거리(Strada Iuliu Maniu)',p:[99,29,21],rank:3},
  {name:'구 호텔 콘티넨탈',sub:'구 뉴욕 호텔',p:[-104,27,106],rank:4},
  {name:'로마 나포카 발굴 창',sub:'고대 로마 발굴 전시',p:[14,2,25],rank:5},
  {name:'남쪽 분수대',sub:'물과 공공 공간',p:[11,2,73],rank:6},
  {name:'에로이러르 대로',sub:'동쪽 구시가지로',p:[150,4,112],rank:7},
  {name:'메모란둘무루이 거리',sub:'서쪽 구시가지로',p:[-149,4,-103],rank:8},
  {name:'레겔레 페르디난드 거리',sub:'소메시 강 방향',p:[72,4,-181],rank:9},
  {name:'나포카 거리',sub:'남쪽 구시가지',p:[-165,4,125],rank:10}
];
export function seeded(seed=19021316){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const rng=seeded();
const pick=a=>a[Math.floor(rng()*a.length)];
const C={stone:'#d4cfb8',trim:'#ebe4cc',darkStone:'#a7a38f',glass:'#41585a',bronze:'#384f47',patina:'#506358',roof:'#a95232',roofLight:'#b7653c',wood:'#766347',road:'#9b9f94',pave:'#c7c6b5',grass:'#8a9862'};
const COLORS=['#dfd4b5','#d9ceaf','#d2bb8d','#cbbda5','#d8c3b7','#bac3a9','#dfddca','#b9c1ba','#d8c89f','#c5b2a5'];

export function createWorld(scene){
  const staticPools=new Map(), renderPools=[], reservations=[], occupancy=[];
  let boxCount=0;
  const kinds=['stone','plaster','terracotta','bronze','vegetation','pavement','glass','water','metal','wood','glow','window'];
  const atlasCanvas=document.createElement('canvas');atlasCanvas.width=512;atlasCanvas.height=128;
  const a=atlasCanvas.getContext('2d');const noise=seeded(111);
  for(let k=0;k<16;k++){const ox=(k%8)*64,oy=Math.floor(k/8)*64;a.fillStyle='#ffffff';a.fillRect(ox,oy,64,64);for(let n=0;n<320;n++){const v=Math.floor(218+noise()*37);a.fillStyle=`rgb(${v},${v},${v})`;a.fillRect(ox+noise()*64,oy+noise()*64,1+noise()*3,1+noise()*2);}if(k===2){a.strokeStyle='#cecece';a.lineWidth=.65;for(let y=0;y<64;y+=8){a.beginPath();a.moveTo(ox,oy+y);a.lineTo(ox+64,oy+y);a.stroke();}}}
  const atlas=new THREE.CanvasTexture(atlasCanvas);atlas.colorSpace=THREE.SRGBColorSpace;atlas.magFilter=THREE.NearestFilter;atlas.anisotropy=4;
  const materials={},geometries={};
  kinds.forEach((kind,k)=>{const geo=new THREE.BoxGeometry(1,1,1),uv=geo.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,((k%8)*64+1+uv.getX(i)*62)/512,(Math.floor(k/8)*64+1+uv.getY(i)*62)/128);geometries[kind]=geo;materials[kind]=new THREE.MeshLambertMaterial({map:atlas});});
  materials.glass=new THREE.MeshPhongMaterial({color:0x9bbabd,transparent:true,opacity:.35,shininess:110,depthWrite:false});
  materials.water=new THREE.MeshPhongMaterial({color:0x829e9b,transparent:true,opacity:.78,shininess:140,specular:0xdbe9db,depthWrite:false});
  materials.glow=new THREE.MeshLambertMaterial({color:0xffe5a1,emissive:0xffc465,emissiveIntensity:.08});
  const dummy=new THREE.Object3D(),col=new THREE.Color();
  function box(kind,x,y,z,w,h,d,color=C.stone,tier=2,ry=0,rx=0,rz=0){
    if(w<=0||h<=0||d<=0)return;
    const cx=Math.floor(x/180),cz=Math.floor(z/180),key=`${kind}:${tier}:${cx}:${cz}`;
    let pool=staticPools.get(key);if(!pool){pool={kind,tier,cx,cz,items:[]};staticPools.set(key,pool);}
    pool.items.push([x,y,z,w,h,d,color,ry,rx,rz]);boxCount++;
  }
  function local(x,z,rot=0,tier=2){const co=Math.cos(rot),si=Math.sin(rot);return {box(kind,lx,y,lz,w,h,d,color=C.stone,t=tier,r=0,rx=0,rz=0){box(kind,x+lx*co+lz*si,y,z-lx*si+lz*co,w,h,d,color,t,rot+r,rx,rz);},x,z,rot};}
  function reserve(name,x,z,w,d,zone='D',fixed=false){const r={name,x,z,w,d,zone};if(!fixed&&reservations.some(b=>Math.abs(b.x-x)<(b.w+w)/2-.12&&Math.abs(b.z-z)<(b.d+d)/2-.12))return false;reservations.push(r);if(zone!=='road')occupancy.push(r);return true;}
  reserve('Protected pedestrian square',0,0,160,220,'A',true);
  reserve('Church',-6,-30,78,43,'A',true);reserve('Monument',-7,11,21,13,'B',true);
  // The archaeological recess has a solid floor, with continuous earth beneath it.
  box('pavement',0,-3.4,0,6000,4,6000,'#adae95');
  function aroundExcavation(x,y,z,w,h,d,color){const l=x-w/2,r=x+w/2,n=z-d/2,s=z+d/2;for(const q of [[l,7.5,n,s],[20.5,r,n,s],[7.5,20.5,n,21],[7.5,20.5,29,s]]){const [ql,qr,qn,qs]=q;if(qr>ql&&qs>qn)box('pavement',(ql+qr)/2,y,(qn+qs)/2,qr-ql,h,qs-qn,color);}}
  aroundExcavation(0,-.7,0,6000,1.4,6000,'#adae95');
  aroundExcavation(0,.06,0,160,.25,220,C.pave);
  for(let z=-109;z<110;z+=4){if(z>20&&z<30)continue;box('pavement',0,.22,z,159,.012,.038,'#aeb19f',1);}
  for(let x=-79;x<80;x+=4){if(x>6&&x<22)continue;box('pavement',x,.221,0,.035,.012,219,'#b5b6a5',1);}
  // Refined, large stone slabs; quiet tonal variation, never oversized cobbles.
  const pavedCells=new Set();for(let n=0;n<700;n++){const x=Math.floor(rng()*40)*4-78,z=Math.floor(rng()*55)*4-108,key=x+','+z;if(pavedCells.has(key)||(x>5&&x<23&&z>18&&z<32))continue;pavedCells.add(key);box('pavement',x,.197,z,3.94,.025,3.94,pick(['#c8c7b7','#cac9b9','#c4c4b4','#ceccbb']),1);}
  const roads=[{x:-89,z:0,w:15,d:238,name:'West perimeter'}, {x:89,z:0,w:15,d:238,name:'East perimeter'}, {x:0,z:-119,w:192,d:15,name:'North perimeter'}, {x:0,z:119,w:192,d:15,name:'South perimeter'}, {x:240,z:21,w:296,d:14,name:'Iuliu Maniu'}, {x:280,z:116,w:385,d:18,name:'Eroilor'}, {x:-255,z:-112,w:331,d:18,name:'Memorandumului'}, {x:-258,z:124,w:329,d:15,name:'Napoca'}, {x:76,z:-282,w:18,d:315,name:'Regele Ferdinand'}, {x:-88,z:288,w:14,d:337,name:'Universității'}];
  for(const r of roads){reserve(r.name,r.x,r.z,r.w,r.d,'road',true);box('pavement',r.x,.08,r.z,r.w,.16,r.d,C.road);}
  for(const x of [-79.9,79.9])box('stone',x,.34,0,.45,.45,219,'#ddd9c8');
  for(const z of [-109.9,109.9])box('stone',0,.34,z,160,.45,.45,'#ddd9c8');
  // Subtle changes of grade form two low seating steps at the southern edge.
  for(let i=0;i<3;i++)box('stone',0,.24+i*.12,103+i*1.6,115,.22,1.55,'#bdbfad');
  for(const x of [-88.6,88.6])for(let z=-96;z<104;z+=17)box('pavement',x,.19,z,.18,.025,5,'#d6d5c4',1);
  for(let k=0;k<7;k++){box('pavement',-91+k*1.2,.2,88,.65,.028,6,'#dadacb');box('pavement',89,.2,-100+k*1.2,6,.028,.65,'#dadacb');}
  function roof(b,w,d,y,height,color=C.roof,tier=2){const step=tier===0?.3:tier===1?.4:.55;const alternate=new THREE.Color(color).multiplyScalar(.94).getStyle();for(let h=0;h<height;h+=step){const depth=Math.max(.25,d*(1-h/height));b.box('terracotta',0,y+h+step/2,0,w+.7,step,depth+.5,Math.round(h/step)%3===0?alternate:color,tier);}b.box('terracotta',0,y+height+.12,0,w+.95,.24,.47,color,tier);}
  function arch(b,x,bottom,z,w,h,color=C.glass,tier=0){const straight=h-w*.52;b.box('window',x,bottom+straight/2,z,w,straight,.17,color,tier);const step=.28;for(let rise=0;rise<w*.52;rise+=step){const half=w/2*Math.pow(1-rise/(w*.57),.65);b.box('window',x,bottom+straight+rise+step/2,z,half*2,step,.18,color,tier);b.box('stone',x-half-.15,bottom+straight+rise,z+.05,.3,step+.07,.31,C.trim,tier);b.box('stone',x+half+.15,bottom+straight+rise,z+.05,.3,step+.07,.31,C.trim,tier);}for(const side of [-1,1]){b.box('stone',x+side*(w/2+.16),bottom+straight/2,z+.05,.32,straight,.32,C.trim,tier);}b.box('stone',x,bottom-.18,z+.1,w+.7,.35,.5,C.trim,tier);}
  function pinnacle(b,x,y,z,height=4){b.box('stone',x,y+height*.28,z,.62,height*.56,.62,C.trim,0);for(let h=0;h<height*.5;h+=.3)b.box('stone',x,y+height*.56+h,z,Math.max(.1,.65*(1-h/(height*.5))),.31,Math.max(.1,.65*(1-h/(height*.5))),C.trim,0);b.box('stone',x,y+height+ .15,z,.15,.7,.15,C.trim,0);}
  function church(){
    const b=local(-8,-31,0,0);
    b.box('stone',-3,.7,0,64,1.25,29,'#aca991',2);
    b.box('stone',-3,12,0,64,23,26,C.stone,2);
    // East choir: a stepped polygonal apse, in masonry and tiled roof.
    for(let x=29;x<42;x+=.6){const dep=x<34?23:23-(x-34)*1.95;b.box('stone',x,11.8,0,.61,23.4,dep,C.stone,2);}
    const roofBase=local(-11,-31,0,0);roof(roofBase,65,29,23.7,18.1,'#a34d2e',2);
    for(let h=0;h<17.5;h+=.45){const dep=25*(1-h/18.4),len=17-h*.36;b.box('terracotta',30+len/2,24+h,0,len,.46,dep,pick(['#a45131','#aa5431','#b26037']),2);}
    // Visible tiled roof strips are small surface voxels, not a filled voxel volume.
    for(let x=-35;x<30;x+=1.45)for(let h=0;h<18;h+=.76){const z=14.7*(1-h/18.1);for(const s of [-1,1])b.box('terracotta',x,24.05+h,s*z,1.36,.12,.32,pick(['#a85732','#b26037','#b9693e','#94462e']),0);}
    for(const side of [-1,1]){
      for(let x=-32;x<=25;x+=9.5){
        const face=local(-8,-31+side*13.08,side===1?0:Math.PI,0);arch(face,side*x,6.8,0,4.8,13.3,'#465452');
        for(const dx of [-1.48,0,1.48])face.box('stone',side*x+dx,12.25,.2,.18,10.6,.22,'#bdbda8',0);
        for(let k=0;k<3;k++)face.box('stone',side*x,9.6+k*3.1,.19,4.5,.17,.23,'#a9b09d',0);
        for(const dx of [-.78,.78]){face.box('stone',side*x+dx,18.2,.24,.17,2.1,.18,C.trim,0,0,0,dx>0?-.48:.48);}
      }
      for(let x=-37;x<32;x+=9.5){
        for(let k=0;k<4;k++){const ht=6.1,dep=3.7-k*.6;b.box('stone',x,ht/2+k*5.7,side*(13+dep/2),1.75,ht,dep,k%2?C.stone:'#c7c4ac',2);b.box('stone',x,k*5.7+.48,side*(13+dep/2),2.08,.46,dep+.35,C.trim,1);}
        b.box('stone',x,23.15,side*14.4,2.15,.65,3.2,C.trim,1);pinnacle(b,x,23.5,side*14.1,2.8);
      }
      b.box('stone',-3,5.8,side*13.27,65,.36,.38,'#bab9a2',1);
      b.box('stone',-3,23.3,side*13.25,65,.72,.75,'#e1dcc4',2);
      // Restrained, staggered masonry seams and weathered blocks.
      for(let row=0;row<21;row++){for(let x=-34+(row%2)*1.3;x<30;x+=3.1){if(rng()<.36)b.box('stone',x,1.2+row,side*13.025,2.9,.85,.06,pick(['#c6c4ad','#d0ccb4','#d9d3bb']),0);}}
    }
    // Monumental west front, one broad nave rather than invented twin towers.
    const west=local(-43.02,-31,-Math.PI/2,0);arch(west,0,1.3,0,6,10.8,'#665d48');
    for(let r=0;r<3;r++){for(const s of [-1,1])west.box('stone',s*(3.5+r*.4),5.6,.3+r*.25,.3,9.6,.5,C.trim,0);}
    arch(west,0,14.4,.05,5.2,7.6);for(const s of [-1,1])arch(west,s*8,6,.05,3.1,13.8);
    for(let h=0;h<17;h+=.5)west.box('stone',0,24+h,-.1,27*(1-h/18),.51,.6,C.stone,2);
    pinnacle(west,0,41,0,2.6);
    const east=local(34.04,-31,Math.PI/2,0);arch(east,0,6,.1,3.5,13);
    for(const s of [-1,1]){const ab=local(30,-31+s*7.7,s===1?Math.PI/4:3*Math.PI/4,0);arch(ab,0,6,0,3.5,13);for(const [x,z]of [[34,12],[40,6.3]]){b.box('stone',x,11,s*z,1.2,22,1.6,C.stone,2);b.box('stone',x,21.9,s*z,1.5,.4,1.9,C.trim,1);pinnacle(b,x,22,s*z,2.4);}}
    // The single nineteenth-century north tower, offset from the west façade.
    const t=local(-27,-51,0,0);
    t.box('stone',0,3,0,13,6,13,'#c7c4b1',2);t.box('stone',0,24,0,11.2,44,11.2,'#d5d1bb',2);
    for(const y of [7,19,30,43,46.5,58])t.box('stone',0,y,0,12.2,.75,12.2,C.trim,2);
    t.box('stone',0,52,0,10.3,12,10.3,'#d9d6c0',2);
    for(const sx of [-1,1])for(const sz of [-1,1]){t.box('stone',sx*5.4,26,sz*5.4,1.5,51,1.5,'#bdbfac',2);pinnacle(t,sx*5.4,57.7,sz*5.4,7);}
    for(let face=0;face<4;face++){
      const side=local(-27,-51,face*Math.PI/2,0);arch(side,0,32,5.67,3.1,9,'#56635f');
      for(const s of [-1,1]){arch(side,s*2.45,48,5.31,2.3,8.1,'#445651');for(let y=49;y<54;y+=.65)side.box('stone',s*2.45,y,5.47,2.1,.15,.15,'#9daba0',0);}
      // Voxel clock dial, hands, indices; visible from every side.
      for(let x=-2.5;x<=2.5;x+=.36)for(let y=-2.5;y<=2.5;y+=.36){const rr=x*x+y*y;if(rr<6.25)side.box('stone',x,43.65+y,5.79,.37,.37,.17,rr>4.9?'#797c6b':'#e7dfc2',0);}
      for(let i=0;i<12;i++){const an=i*Math.PI/6;side.box('metal',Math.sin(an)*1.91,43.65+Math.cos(an)*1.91,5.94,.16,.34,.08,'#3c4943',0,0,0,-an);}
      side.box('metal',-.6,44.1,6.02,.14,1.7,.12,'#34493e',0,0,0,-.85);side.box('metal',.65,43.65,6.03,1.65,.13,.12,'#34493e',0);
      for(let x=-4.7;x<5;x+=.72)side.box('stone',x,59.1,5.65,.36,1.8,.4,C.trim,0);
    }
    for(let h=0;h<18.6;h+=.4){const w=9.8*Math.pow(1-h/19.2,1.15);t.box('metal',0,60+h,0,w,.41,w,pick(['#687d74','#718179','#617970']),2);}
    for(let face=0;face<4;face++){const side=local(-27,-51,face*Math.PI/2,0);for(let h=0;h<16;h+=.4)side.box('metal',0,61+h,4.55*Math.pow(1-h/18,1.15),.17,.42,.18,'#9ba697',0);}
    t.box('metal',0,80.1,0,.2,3.2,.2,'#665e43',2);t.box('metal',0,80.4,0,1.6,.18,.18,'#665e43',2);
    // Narrow lawns expose rather than conceal the architecture.
    for(const r of [[-11,-54,47,8],[-13,-11,64,5],[34,-35,10,25],[-49,-34,5,29]]){box('stone',r[0],.35,r[1],r[2]+.5,.35,r[3]+.5,'#c0c0a8');box('vegetation',r[0],.55,r[1],r[2],.21,r[3],C.grass);}
  }
  church();
  function bronzePerson(b,x,y,z,scale=1,pose=0){const s=scale;
    b.box('bronze',x,y+1.3*s,z,.7*s,1.5*s,.53*s,C.bronze,0);b.box('bronze',x,y+2.3*s,z,.43*s,.55*s,.43*s,C.patina,0);
    b.box('bronze',x,y+2.59*s,z,.55*s,.12*s,.51*s,C.bronze,0);
    for(const side of [-1,1]){b.box('bronze',x+side*.23*s,y+.43*s,z,.23*s,.9*s,.3*s,C.bronze,0,0,0,side*.12);b.box('bronze',x+side*.5*s,y+1.5*s,z,.25*s,1.1*s,.3*s,C.bronze,0,0,0,side*(pose?.7:.15));}
    b.box('bronze',x,y+1.1*s,z-.3*s,.9*s,1.4*s,.17*s,'#30473f',0);
  }
  function monument(){const b=local(-7,11,0,0);
    for(let i=0;i<4;i++)b.box('stone',0,.3+i*.34,0,21-i*1.4,.38,12-i*.9,i%2?'#bdbba5':'#d6d1b9',2);
    b.box('stone',0,2.3,0,10,2.5,5.3,'#d4d0b9',2);b.box('stone',0,4.35,0,8.9,2,4.6,'#ddd6bf',2);b.box('stone',0,5.4,0,9.7,.44,5.3,C.trim,2);
    b.box('stone',0,2.95,2.7,6.3,.86,.07,'#b8b69d',0);
    // Horse oriented west, with four distinct legs, neck, muzzle, mane and tail.
    b.box('bronze',0,7.2,0,4.5,1.65,1.45,C.bronze,2);
    b.box('bronze',-2.03,8.0,0,1.05,2,1.12,'#40574c',2,0,0,-.25);
    b.box('bronze',-2.74,8.87,0,1.6,.74,.84,C.patina,2,0,0,-.18);
    for(const sz of [-.51,.51])for(const sx of [-1.5,1.55]){b.box('bronze',sx,6.3,sz,.38,1.75,.37,C.bronze,2,0,0,sx<0?-.16:.12);b.box('bronze',sx-.06,5.52,sz,.61,.23,.43,'#2a4038',0);}
    for(const sz of [-.29,.29])b.box('bronze',-2.27,9.47,sz,.25,.57,.22,C.bronze,0,0,0,.2);
    b.box('bronze',2.44,6.95,0,.44,2.6,.37,'#2c433a',0,0,0,.36);
    b.box('bronze',0,8.02,0,1.4,.35,1.7,'#293e35',0);
    bronzePerson(b,.1,7.52,0,1.04,1);b.box('bronze',.4,8.6,-.76,1.5,1.8,.18,'#31493f',0);
    b.box('metal',-.65,8.73,.84,.1,2,.1,'#6c7560',0,0,0,-.8);
    for(let i=0;i<4;i++){const x=[-6.8,-4.8,4.8,6.8][i],z=i%2===0?1.4:3.1;bronzePerson(b,x,1.35,z,1.37,i%2);b.box('bronze',x+.84,4.5,z,.12,5.6,.12,'#526252',0,0,0,(i-1.5)*.07);if(i%2===0){for(let k=0;k<4;k++)b.box('bronze',x+1.2+k*.27,6.65-k*.1,z,.28,1.5-k*.14,.11,C.bronze,0);}}
    const lettering=labelTexture('MATTHIAS REX',256,48,'#8a8974','#d4d0b9');const plaque=new THREE.Mesh(new THREE.PlaneGeometry(5.6,.98),new THREE.MeshLambertMaterial({map:lettering}));plaque.position.set(-7,3,13.78);scene.add(plaque);
  }
  function labelTexture(text,w=256,h=64,ink='#ece6d1',bg='#455449'){const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);ctx.font=`${h*.42}px Georgia`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=ink;ctx.fillText(text,w/2,h/2);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}
  monument();
  function window(b,x,y,z,w=1.55,h=2.65,style=0,tier=1){
    b.box('stone',x,y,z,w+.5,h+.44,.26,'#ede4cb',tier);b.box('window',x,y,z+.16,w,h,.08,pick(['#4d6260','#536969','#637775','#6a7b76']),tier);
    b.box('stone',x,y-h/2-.24,z+.26,w+.8,.22,.51,C.trim,tier);b.box('wood',x,y,z+.23,.1,h,.09,'#d2d2b8',0);b.box('wood',x,y-.13,z+.23,w,.12,.09,'#d2d2b8',0);
    if(style>0){b.box('stone',x,y+h/2+.43,z+.12,w+.75,.24,.42,C.trim,tier);if(style===2)for(let k=0;k<4;k++)b.box('stone',x,y+h/2+.57+k*.13,z+.12,w+.65-k*.3,.15,.35,C.trim,0);}
  }
  function building(name,x,z,w,d,h,color,rot=0,style=0,hero=false,zone='C',roofColor=null){
    const rw=Math.abs(Math.cos(rot))*w+Math.abs(Math.sin(rot))*d,rd=Math.abs(Math.sin(rot))*w+Math.abs(Math.cos(rot))*d;
    if(!reserve(name,x,z,rw,rd,zone,hero)){if(zone==='C')throw new Error('Fixed frontage allocation failed: '+name);return null;}
    const b=local(x,z,rot,hero?0:1),tier=zone==='D'?2:1;
    b.box('plaster',0,h/2+.3,0,w,h,d,color,2);b.box('stone',0,1.05,0,w+.15,1.5,d+.18,'#b6b5a2',2);
    const f=d/2+.1;
    b.box('stone',0,h-.13,0,w+.66,.62,d+.55,C.trim,2);b.box('stone',0,h-.65,f,w+.3,.23,.38,'#a29f89',tier);
    const floors=Math.max(2,Math.round(h/4.1)),spacing=w/(Math.floor(w/4)+.4),n=Math.floor(w/spacing),bottom=3.1;
    for(let fl=1;fl<floors;fl++){const y=bottom+fl*(h-4)/floors;
      b.box('stone',0,y-1.9,f,w,.2,.33,'#c2baa1',tier);
      for(let i=0;i<n;i++)window(b,(i-(n-1)/2)*spacing,y,f,Math.min(1.75,spacing*.45),Math.min(2.5,(h-4)/floors*.65),style,tier);
    }
    for(let i=0;i<n;i++){const xx=(i-(n-1)/2)*spacing;arch(b,xx,.75,f+.06,Math.min(2.25,spacing*.62),3.25,i===Math.floor(n/2)?'#4b5147':'#5a6960',tier);}
    for(const side of [-1,1]){b.box('stone',side*(w/2-.48),h/2,f,.65,h,.27,C.trim,tier);for(let yy=2;yy<h;yy+=1.1)b.box('stone',side*(w/2-.48),yy,f+.13,.86,.32,.22,'#e4dbc3',0);}
    // Side and rear elevations remain convincing during a full orbit.
    if(zone==='C'){for(let yy=5.3;yy<h-1;yy+=4)for(let xx=-w/2+2;xx<w/2-1;xx+=4)b.box('window',xx,yy,-d/2-.05,1.4,2.15,.1,'#61736a',1);for(const side of [-1,1])for(let zz=-d/2+3;zz<d/2-2;zz+=4)for(let yy=5.5;yy<h-1;yy+=4)b.box('window',side*(w/2+.035),yy,zz,.1,2.15,1.4,'#687970',1);}
    else{for(let yy=4.9;yy<h-1;yy+=3.8){for(let xx=-w/2+2;xx<w/2-1;xx+=4.5)b.box('window',xx,yy,-d/2-.05,1.2,1.8,.1,'#788277',2);for(const side of [-1,1])for(let zz=-d/2+2.5;zz<d/2-2;zz+=5)b.box('window',side*(w/2+.04),yy,zz,.1,1.8,1.2,'#798579',2);}}
    roof(b,w,d,h+.23,Math.min(7,d*.34),roofColor||pick(['#a3583a','#b7643f','#a75133','#b16c47']),2);
    for(let i=0;i<Math.max(1,w/13);i++){const xx=-w/3+i*11;b.box('stone',xx,h+4.5,-d*.21,1.15,3,1.15,'#aa9c80',tier);b.box('stone',xx,h+6.06,-d*.21,1.43,.23,1.42,'#d3c2a2',tier);}
    if(style){for(let xx=-w/2+3;xx<w/2-1;xx+=6){b.box('plaster',xx,h+1.4,d*.25,1.9,2.3,1.4,color,1);b.box('window',xx,h+1.4,d*.25+.73,1.05,1.4,.1,C.glass,1);for(let j=0;j<4;j++)b.box('terracotta',xx,h+2.7+j*.25,d*.25,2.25-j*.5,.28,1.7,C.roof,1);}}
    if(style===2){for(let i=-1;i<=1;i++){const xx=i*spacing;b.box('stone',xx,6.7,f+.7,2.7,.3,1.4,C.trim,1);b.box('metal',xx,7.3,f+1.25,2.5,.12,.12,'#536254',0);for(let k=0;k<7;k++)b.box('metal',xx-1.15+k*.38,6.98,f+1.25,.09,.65,.1,'#536254',0);}}
    if(zone==='C'){b.box('wood',-w*.22,3.5,f+.3,w*.37,.63,.21,'#566352',1);}
    return b;
  }
  // Fixed, individual frontages preserve the irregular widths of the historic square.
  const west=[['Rhédey Palace',67,28,15.5,'#d5bf9c',2],['Jósika Palace',39,27,15,'#d9cbbc',2],['Wass House',15,20,12,'#d8c7ac',0],['Western townhouse',-6,21,13,'#c1c4ad',1],['Parish house',-31.5,29,13.4,'#e1d8c0',1],['Historic west frontage',-59.5,26,14.5,'#d6c7ab',2],['Western corner house',-87.5,29,12.4,'#d3b5a3',1]];
  for(const [name,z,w,h,c,s]of west)building(name,-112,z,w,29,h,c,Math.PI/2,s);
  const north=[['Mauksch-Hintz House',-64,28,11.2,'#e0d6b9',1],['Kemény Palace',-37,25,14.8,'#d6c497',2],['Rucska House',-12,24,13.2,'#c8d0ba',1],['North townhouse',12,23,12.1,'#d8c2a8',0],['Melody corner',42,35,17,'#ddd6c0',2]];
  for(const [name,x,w,h,c,s]of north)building(name,x,-140,w,26,h,c,0,s);
  building('Northeast frontage',111,-103,31,26,16,'#d9d1b9',-Math.PI/2,2);
  function banffy(){const b=building('Bánffy Palace',111,-61,51,27,13.8,'#ded3b4',-Math.PI/2,2,true);
    b.box('plaster',0,7.8,15.3,17,13.5,3.8,'#e4d9b8',2);
    for(let i=-1;i<=1;i++){arch(b,i*4.9,.8,17.27,3.55,5.1,'#4d584c');b.box('stone',i*4.9,6.3,17.8,4.9,.56,3.4,C.trim,0);arch(b,i*4.9,7.15,17.27,3.25,4.7,'#70745e');}
    for(let i=-2;i<=2;i++){b.box('stone',i*3.55,9.3,18.35,.66,5.7,.66,C.trim,0);b.box('stone',i*3.55,12.15,18.35,.97,.3,.95,C.trim,0);}
    b.box('stone',0,12.6,18.15,19,.55,2.8,C.trim,0);b.box('stone',0,14,17.8,18,1.7,.6,'#c5bfa3',0);
    for(let x=-24;x<=24;x+=4){b.box('stone',x,14.4,14.2,1.25,.5,1.25,C.trim,0);b.box('stone',x,15.35,14.2,.66,1.65,.58,C.trim,0);b.box('stone',x,16.45,14.2,.57,.58,.5,C.trim,0);b.box('stone',x+.35,15.5,14.2,.7,.3,.3,C.trim,0,0,0,.4);}
    for(let i=0;i<7;i++)b.box('stone',0,14.9+i*.35,18.02,13-i*1.6,.36,.75,C.trim,0);
    b.box('stone',0,17.2,18.5,2.4,2.3,.4,'#b6b397',0);
    // Palace wings enclose an open inner courtyard visible from above.
    building('Bánffy north wing',145,-80,41,13,12,'#d5cdb2',0,0,true,'D');building('Bánffy south wing',145,-42,41,13,12,'#d5cdb2',Math.PI,0,true,'D');building('Bánffy rear wing',160,-61,25,11,12,'#d5cdb2',Math.PI/2,0,true,'D');
    box('pavement',139.5,.3,-61,30,.4,25,'#b5b89f');
  }
  banffy();
  building('Palace adjoining frontage',112,-29,12,29,13.6,'#d4c4aa',-Math.PI/2,1);
  function roundedCorner(b,cx,cz,h,color,r=4){
    for(let i=0;i<10;i++){const an=i*Math.PI/20;b.box('plaster',cx+Math.sin(an)*r,h/2,cz+Math.cos(an)*r,1.1,h,1.1,color,2);}
    for(let yy=5;yy<h;yy+=4)for(let i=1;i<5;i++){const an=i*Math.PI/10;b.box('window',cx+Math.sin(an)*(r+.5),yy,cz+Math.cos(an)*(r+.5),1.2,2.4,.15,C.glass,0,an);}
    for(let y=0;y<6.5;y+=.4){const radius=r*1.18*Math.pow(1-y/7,.55);b.box('metal',cx,y+h+.4,cz,radius*2,.41,radius*2,pick(['#62726a','#58665f','#6e786c']),2);}
    b.box('metal',cx,h+7.6,cz,.2,2.2,.2,'#575d4f',0);
  }
  for(const [z,sign]of [[-4,-1],[47,1]]){const b=building('Mirror Building '+sign,113,z,36,32,19.5,'#dfd6bb',-Math.PI/2,2,true);roundedCorner(b,sign===-1?-16:16,13,19.5,'#dfd6bb',4);b.box('stone',0,18.6,16.4,36,.5,.5,C.trim,0);for(let i=0;i<10;i++)b.box('stone',-16+i*3.5,20.2,16.3,.7,1.4,.75,C.trim,0);}
  building('Wolphard-Kakas House',112,82,28,30,12.5,'#e1d4b4',-Math.PI/2,1);
  const continental=building('Former Hotel Continental',-114,99,35,32,19,'#d7c5b0',Math.PI/2,2,true,'C','#626d65');roundedCorner(continental,15,12,20,'#d6c6b1',4.5);
  for(const [name,x,w,h,c,s]of [['Old Town Hall',-63,34,14.5,'#e3d7b8',2],['National Bank',-23,43,18,'#d8d5c1',2],['Southern historic house',12,25,12,'#dbc6a7',1],['Southern ochre house',41,31,14,'#cdbb96',1],['Southern corner',69,23,14,'#e0d6bf',2]])building(name,x,143,w,32,h,c,Math.PI,s);
  // Street continuations, allocated before the background infill.
  for(const sign of [-1,1])for(let i=0;i<5;i++)building('Iuliu Maniu frontage',154+i*27,21+sign*25,26,31,14+(i%3)*2,COLORS[(i+4)%COLORS.length],sign===-1?0:Math.PI,i%3,false,'D');
  for(const sign of [-1,1])for(let i=0;i<5;i++)building('Eroilor frontage',157+i*32,116+sign*28,30,32,13+(i%3),COLORS[(i+2)%COLORS.length],sign===-1?0:Math.PI,0,false,'D');
  for(const roadZ of [-112,124])for(const sign of [-1,1])for(let i=0;i<5;i++)building('Western old town',-156-i*30,roadZ+sign*25,29,30,11+(i%3)*2,COLORS[(i+sign+10)%COLORS.length],sign===-1?0:Math.PI,0,false,'D');
  for(const sign of [-1,1])for(let i=0;i<6;i++)building('Ferdinand frontage',76+sign*25,-164-i*32,30,30,12+(i%4),COLORS[(i+3)%COLORS.length],sign===-1?Math.PI/2:-Math.PI/2,0,false,'D');
  // Bounded deterministic occupancy allocation. Every accepted building has a street-facing edge.
  for(let iz=-5;iz<=5;iz++)for(let ix=-6;ix<=6;ix++){
    if(Math.abs(ix)<2&&Math.abs(iz)<2)continue;
    const bx=ix*66+Math.sin(iz*1.7)*7,bz=iz*69+Math.sin(ix)*6;
    for(let face=0;face<2;face++)for(let j=0;j<2;j++){
      for(let attempt=0;attempt<10;attempt++){
        const x=bx+(j-.5)*25,z=bz+(face-.5)*38,w=24-attempt*.3,d=25-attempt*.25;
        if(building('Outer historic block',x,z,w,d,9+Math.floor(rng()*5),pick(COLORS),face===0?Math.PI:0,0,false,'D'))break;
      }
    }
    box('pavement',bx,bz<0?.02:.04,bz+34,65,.12,7,'#989f8e');
  }
  // A second, coarse tier of the city merges into the Transylvanian basin.
  for(let z=-650;z<=650;z+=52)for(let x=-700;x<=700;x+=48){if(Math.abs(x)<400&&Math.abs(z)<390)continue;if(rng()<.2)continue;const xx=x+rng()*10,zz=z+rng()*9,h=7+rng()*7,w=19+rng()*17,d=22+rng()*13;if(!reserve('Distant historic block',xx,zz,w,d,'D'))continue;const b=local(xx,zz,0,2);b.box('plaster',0,h/2,0,w,h,d,pick(COLORS));roof(b,w,d,h,5,C.roof,2);}
  function hillHeight(x,z){return 10+26*Math.sin(x*.003+1)**2+24*Math.cos(z*.004-x*.001)**2;}
  for(let z=-1080;z<=1080;z+=30)for(let x=-1080;x<=1080;x+=30){if(Math.hypot(x,z)<710)continue;const h=hillHeight(x,z)*Math.min(1,(Math.hypot(x,z)-670)/200);box('vegetation',x,h/2-1,z,31,h+2,31,pick(['#919e7a','#899a79','#94a180','#899977']),2);if(rng()<.32){box('vegetation',x+4,h+3,z+2,10,7,11,'#7c9274',2);box('vegetation',x-6,h+2,z-4,10,5,9,'#859776',2);}else if(rng()<.25&&reserve('Hillside residence',x,z,13,10,'D')){const b=local(x,z,0,2);b.box('plaster',0,h+3.5,0,13,7,10,'#c5c4ae');roof(b,13,10,h+7,3,'#ac7953',2);}}
  for(let i=0;i<14;i++){const x=-470+i*66,z=-630-Math.sin(i)*44,h=19+rng()*15;if(!reserve('Distant apartment building',x,z,21,13,'D'))continue;box('plaster',x,h/2+12,z,21,h,13,'#c5c9bb',2);for(let yy=16;yy<h+11;yy+=3.3)box('window',x,yy,z+6.6,18,.55,.1,'#8c9b92',2);}
  function tree(x,z,height=11,radius=5,tier=1){
    box('wood',x,height*.34,z,.65,height*.67,.68,'#756c52',tier);
    for(let branch=0;branch<5;branch++){const angle=rng()*Math.PI*2,rr=radius*.53,xx=x+Math.sin(angle)*rr,zz=z+Math.cos(angle)*rr;box('wood',(x+xx)/2,height*.54,(z+zz)/2,.32,height*.38,.35,'#756d51',tier,0,Math.cos(angle)*.5,Math.sin(angle)*.5);for(let n=0;n<10;n++){const a=rng()*Math.PI*2,r=Math.sqrt(rng())*radius*.6,yy=height*.72+rng()*height*.27;box('vegetation',xx+Math.cos(a)*r,yy,zz+Math.sin(a)*r,1.5+rng()*1.3,1.4+rng()*1.4,1.6+rng()*1.6,pick(['#758651','#7e9059','#8b985e','#6b8051','#91a16a']),tier);}}
    for(let n=0;n<8;n++)box('vegetation',x+(rng()-.5)*radius,height*.92+rng()*2,z+(rng()-.5)*radius,2,1.5,2,'#8b9b61',tier);
    box('stone',x,.35,z,2,.38,2,'#b7bca6',tier);
  }
  for(let z=-91;z<=94;z+=19){tree(-69,z,10.5+rng()*2,4.1);if(z<0||z>51)tree(69,z+2,10.4+rng()*2,4.2);}
  for(let x=-48;x<68;x+=19)tree(x,-99,10+rng()*2,4.1);
  for(const p of [[-47,-61,13,4.5],[34,-49,12,4],[42,-18,13,4.4],[-37,-8,10,3.5]])tree(...p);
  for(let i=0;i<48;i++){const x=(rng()-.5)*760,z=(rng()-.5)*760;if(Math.abs(x)<140&&Math.abs(z)<167)continue;if(!occupancy.some(r=>Math.abs(x-r.x)<r.w/2+3&&Math.abs(z-r.z)<r.d/2+3))tree(x,z,10,4,2);}
  const seating=[];
  function bench(x,z,rot=0){const b=local(x,z,rot,1);for(let n=0;n<4;n++)b.box('wood',0,.88,(n-1.5)*.18,3.2,.12,.14,'#86724f');for(let n=0;n<3;n++)b.box('wood',0,1.15+n*.2,-.45,3.2,.15,.12,'#8c7856');for(const side of [-1,1])b.box('metal',side*1.2,.51,0,.16,.85,.7,'#596658');seating.push({x,z,rot});}
  for(let z=-84;z<100;z+=22){bench(-61,z,Math.PI/2);bench(61,z,-Math.PI/2);}
  for(const x of [-40,-25,9,24])bench(x,-7,0);
  for(const x of [-18,5,28])bench(x,92,Math.PI);
  const lampPositions=[];
  function lamp(x,z){box('metal',x,3.6,z,.16,7.1,.16,'#596456',1);box('metal',x+.4,7.04,z,.94,.12,.35,'#5c6352',1);box('glow',x+.5,6.94,z,.8,.09,.3,'#fff1cd',1);box('metal',x,.5,z,.37,.6,.37,'#5a6557',1);lampPositions.push([x,z]);}
  for(let z=-97;z<103;z+=28){lamp(-77,z);lamp(77,z+5);}
  for(const x of [-36,-12,12,36])lamp(x,101);
  // Café terraces line the frontages, keeping the broad middle of the plaza clear.
  const cafeSeats=[];
  for(const side of [-1,1])for(let zz=40;zz<=85;zz+=15)for(let j=0;j<2;j++){
    const x=side*(72+j*4.6),z=zz;
    box('wood',x,.68,z,.12,1.2,.12,'#796a51',1);box('stone',x,1.23,z,1.8,.15,1.8,'#e0d4b7',1);
    for(const s of [-1,1]){box('wood',x+s*1.6,.65,z,.7,.15,.7,'#786a52',1);box('metal',x+s*1.6,.34,z,.1,.65,.1,'#606958',1);cafeSeats.push([x+s*1.6,z]);}
    if(j===0){box('wood',x,1.7,z,.11,3.4,.11,'#9d8e69',1);for(let y=0;y<.8;y+=.16)box('plaster',x,3.25+y,z,5-y*4,.17,5-y*4,pick(['#ebe2c7','#e3d9bd','#c7c6a7']),1);}
  }
  // Glass archaeology: dark reveal, lit masonry, slender mullions and stone seating.
  box('bronze',14,-1.19,25,13,.2,8,'#444e44',1);
  for(const x of [7.7,20.3])box('stone',x,-.4,25,.4,1.4,8,'#aaa996',1);for(const z of [21.2,28.8])box('stone',14,-.4,z,12.5,1.4,.4,'#aaa996',1);
  for(let i=0;i<4;i++){box('stone',11+i*1.5,-.77,25,1.05,.35,5.2,pick(['#a79777','#b2a487','#b6a689']),1);for(let j=0;j<5;j++)box('stone',10.5+i*1.5,-.52,22.8+j*1.1,.76,.25,.55,'#bbac89',0);}
  box('glow',14,-.61,22.1,10,.08,.13,'#f1c685',1);box('glass',14,.29,25,12.4,.055,7.5,'#b7d2cf',1);
  for(let x=7.8;x<=20.3;x+=2.48)box('metal',x,.35,25,.08,.08,7.5,'#52635b',1);for(const z of [21.26,28.74])box('metal',14,.35,z,12.6,.08,.11,'#54635c',1);
  for(const z of [20.4,29.6])box('stone',14,.57,z,14,.6,.7,'#d8d2ba',1);
  const jets=[];
  for(let k=0;k<3;k++){const x=-14+k*24,z=72;box('stone',x,.32,z,19,.45,8,'#b3b7a8',1);box('water',x,.58,z,17.8,.13,6.9,'#90aaa5',1);for(let j=0;j<6;j++){const xx=x-7+j*2.8;jets.push({x:xx,z,phase:rng()*6});box('metal',xx,.63,z,.3,.08,.3,'#788c83',1);}for(let j=0;j<6;j++)box('water',x-7+j*2.8,.68,z+2.4,1.3,.035,.04,'#d6e3d7',0);}
  // Bicycles are voxel rings with open centres and angular frames.
  function bicycle(x,z,rot=0,color='#495f53'){const b=local(x,z,rot,1);for(const xx of [-.65,.65])for(let a=0;a<12;a++){const an=a*Math.PI/6;b.box('metal',xx+Math.cos(an)*.41,.51+Math.sin(an)*.41,0,.17,.17,.1,'#4b584d',1);}b.box('metal',0,.74,0,1.15,.09,.09,color,1);b.box('metal',-.3,.73,0,.08,.65,.08,color,1,0,0,-.65);b.box('metal',.38,.91,0,.08,.83,.08,color,1,0,0,.36);b.box('wood',-.17,1.18,0,.39,.1,.25,'#4b5144',1);b.box('metal',.6,1.31,0,.12,.1,.53,'#525e50',1);}
  for(let i=0;i<7;i++)bicycle(-58,40+i*2.1,Math.PI/2);
  for(let i=0;i<4;i++)bicycle(60,-69+i*2.2,Math.PI/2);
  for(let z=-75;z<85;z+=28){box('metal',-65,.65,z,.62,1.3,.62,'#606b59',1);box('metal',65,.65,z+3,.62,1.3,.62,'#606b59',1);}
  // Small folded information signs, with human-scale metal fittings.
  for(const [x,z]of [[-30,12],[28,-4],[53,73]]){box('metal',x,.84,z,.08,1.65,.1,'#64705d',1);box('metal',x,1.65,z,1.5,.85,.09,'#647568',1,0,-.3);}
  // Population and traffic are animated through a few shared instance buffers.
  const dynamicMaterial=new THREE.MeshLambertMaterial({map:atlas});
  const people=[];const clothes=['#a45438','#486b76','#71804e','#d4bf97','#dfd2b5','#586058','#8a6470','#ba914b','#e9e1ca'];
  const routes=[[[ -48,36],[42,36]], [[-50,45],[49,46]], [[-42,86],[40,85]], [[-56,-80],[-55,79]], [[55,-83],[55,83]], [[-41,-71],[37,-71]], [[-31,0],[24,0]]];
  for(let i=0;i<78;i++){const route=routes[i%routes.length],t=rng();people.push({a:route[0],b:route[1],phase:t,speed:.5+rng()*.55,offset:(rng()-.5)*4,color:pick(clothes),skin:pick(['#c0a080','#d9b697','#ad896d']),scale:.88+rng()*.18,type:i<5?'photo':'walk'});}
  [[-24,25],[-17,30],[-30,8],[5,35],[26,35]].forEach((p,i)=>Object.assign(people[i],{a:p,b:p,speed:0,offset:0,rot:Math.PI}));
  for(let i=0;i<12;i++){const seat=seating[i*2];people.push({a:[seat.x,seat.z],b:[seat.x,seat.z],phase:0,speed:0,offset:0,color:pick(clothes),skin:'#c8aa8a',scale:1,type:'sit',rot:seat.rot});}
  for(const p of cafeSeats.slice(0,14))people.push({a:p,b:p,phase:0,speed:0,offset:0,color:pick(clothes),skin:'#c8aa8a',scale:.98,type:'sit',rot:0});
  for(let i=0;i<7;i++){const p=[-16+i*6,78];people.push({a:p,b:[p[0]+3,83],phase:rng(),speed:.45,offset:0,color:pick(clothes),skin:'#d4b293',scale:.64,type:'walk'});}
  for(let i=0;i<5;i++){const route=routes[3+i%2];people.push({a:route[0],b:route[1],phase:rng(),speed:2.3,offset:3,color:pick(clothes),skin:'#caa787',scale:.97,type:i===0?'delivery':'cycle'});}
  const peopleMesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),dynamicMaterial,people.length*34);peopleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);peopleMesh.frustumCulled=false;peopleMesh.castShadow=false;scene.add(peopleMesh);
  const cars=[];
  for(let i=0;i<10;i++)cars.push({axis:'z',lane:i%2?87:-87,phase:rng(),speed:2+rng()*2.6,color:i===0?'#d7b64c':pick(['#e4e2d3','#6d827e','#697275','#af6954','#d0c8b6']),type:i===2?'van':'car',direction:i%2?1:-1});
  cars.push({axis:'x',lane:-119,phase:.4,speed:3.5,color:'#789991',type:'bus',direction:1});cars.push({axis:'x',lane:123,phase:.8,speed:2.9,color:'#d0c5ad',type:'van',direction:-1});
  const carMesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),dynamicMaterial,cars.length*12);carMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);carMesh.frustumCulled=false;scene.add(carMesh);
  const jetMesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshPhongMaterial({color:0xd2e2dc,transparent:true,opacity:.65,shininess:100}),jets.length*4);jetMesh.frustumCulled=false;scene.add(jetMesh);
  const pigeons=Array.from({length:18},()=>({x:-35+rng()*72,z:31+rng()*30,phase:rng()*6}));const pigeonMesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),dynamicMaterial,pigeons.length*3);pigeonMesh.frustumCulled=false;scene.add(pigeonMesh);
  function dynamicBox(mesh,index,x,y,z,w,h,d,color,ry=0,rx=0,rz=0){dummy.position.set(x,y,z);dummy.rotation.set(rx,ry,rz);dummy.scale.set(w,h,d);dummy.updateMatrix();mesh.setMatrixAt(index,dummy.matrix);if(color)mesh.setColorAt(index,col.set(color));}
  function animate(t){let index=0;
    for(const p of people){const dx=p.b[0]-p.a[0],dz=p.b[1]-p.a[1],len=Math.hypot(dx,dz),phase=(p.phase+t*p.speed/Math.max(1,len)/2)%1,along=phase<.5?phase*2:2-phase*2,dir=phase<.5?1:-1;let x=p.a[0]+dx*along+p.offset,z=p.a[1]+dz*along;const yaw=len?Math.atan2(dx*dir,dz*dir):p.rot||0,s=p.scale,sit=p.type==='sit',cycle=p.type==='cycle'||p.type==='delivery',bob=sit?0:Math.sin(t*7+p.phase*20)*.022,base=cycle?.6:0,co=Math.cos(yaw),si=Math.sin(yaw);
      const part=(lx,y,lz,w,h,d,c,rx=0,rz=0)=>dynamicBox(peopleMesh,index++,x+(lx*co+lz*si)*s,.21+(y+bob+base)*s,z+(-lx*si+lz*co)*s,w*s,h*s,d*s,c,yaw,rx,rz);
      part(0,sit?.91:1.17,0,.48,.62,.29,p.color);part(0,sit?1.48:1.73,0,.31,.37,.3,p.skin);part(0,sit?1.67:1.93,-.035,.33,.12,.29,'#635a49');
      for(const side of [-1,1]){const swing=sit||cycle?0:Math.sin(t*6+p.phase*30)*.32*side;part(side*.135,sit?.47:.56,sit?.18:swing*.25,.16,sit?.56:.68,.18,'#58625c',swing);part(side*.135,.19,sit?.37:swing*.4,.19,.13,.31,'#665e4e');part(side*.33,sit?.9:1.1,0,.13,.58,.17,p.color,p.type==='photo'?-1.45:cycle?-1.0:-swing);}
      if(p.type==='photo')part(0,1.57,.38,.27,.18,.2,'#354d43');
      if(cycle){for(const zz of [-.66,.66])for(let k=0;k<8;k++){const an=k*Math.PI/4;part(0,.05+Math.sin(an)*.38,zz+Math.cos(an)*.38,.1,.13,.13,'#4c5c52');}part(0,.21,0,.09,.1,1.3,'#8f6c45');part(0,.53,.4,.09,.85,.1,'#566b56',.3);if(p.type==='delivery')part(0,1.18,-.43,.58,.67,.4,'#aa754b');}
    }peopleMesh.count=index;peopleMesh.instanceMatrix.needsUpdate=true;peopleMesh.instanceColor.needsUpdate=true;
    index=0;for(const c of cars){const extent=c.axis==='x'?320:99,along=((c.phase+t*c.speed/(extent*2))%1*2-1)*extent*c.direction,x=c.axis==='x'?along:c.lane,z=c.axis==='z'?along:c.lane,ry=c.axis==='x'?Math.PI/2:0,len=c.type==='bus'?10:c.type==='van'?5.4:4,co=Math.cos(ry),si=Math.sin(ry);const part=(xx,y,zz,w,h,d,color)=>dynamicBox(carMesh,index++,x+xx*co+zz*si,y,z-xx*si+zz*co,w,h,d,color,ry);
      part(0,.92,0,1.9,.85,len,c.color);part(0,1.62,-.25,1.7,c.type==='car'?.7:1.5,len*.65,c.color);part(0,1.64,len*.29,1.48,.52,.1,'#577575');part(0,1.63,-len*.37,1.48,.5,.1,'#577575');for(const s of [-1,1]){part(s*.88,1.68,-.17,.055,.52,len*.52,'#668281');for(const zz of [-len*.32,len*.32])part(s*.96,.51,zz,.23,.58,.68,'#465248');}if(c.color==='#d7b64c')part(0,2.09,-.2,.6,.2,.4,'#eadab0');
    }carMesh.count=index;carMesh.instanceMatrix.needsUpdate=true;carMesh.instanceColor.needsUpdate=true;
    index=0;for(const j of jets){const h=.45+(Math.sin(t*1.4+j.phase)*.5+.5)*1.8;dynamicBox(jetMesh,index++,j.x,.63+h/2,j.z,.1,h,.1);for(let k=0;k<3;k++){const yy=(t*1.2+j.phase+k*.4)%1;dynamicBox(jetMesh,index++,j.x+Math.sin(k*2+t)*yy*.25,.7+h*yy,j.z+Math.cos(k*2+t)*yy*.25,.1,.15,.1);}}jetMesh.instanceMatrix.needsUpdate=true;
    index=0;for(const p of pigeons){const x=p.x+Math.sin(t*.16+p.phase)*1.3,z=p.z+Math.cos(t*.14+p.phase);dynamicBox(pigeonMesh,index++,x,.38,z,.35,.24,.48,'#818c80');dynamicBox(pigeonMesh,index++,x,.56,z+.18,.15,.23,.15,'#5d706b');dynamicBox(pigeonMesh,index++,x,.39,z-.29,.23,.08,.22,'#65746c');}pigeonMesh.instanceMatrix.needsUpdate=true;pigeonMesh.instanceColor.needsUpdate=true;
  }
  function finalize(){for(const pool of staticPools.values()){
    const mesh=new THREE.InstancedMesh(geometries[pool.kind],materials[pool.kind],pool.items.length);
    for(let i=0;i<pool.items.length;i++){const [x,y,z,w,h,d,c,ry,rx,rz]=pool.items[i];dummy.position.set(x,y,z);dummy.rotation.set(rx,ry,rz);dummy.scale.set(w,h,d);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,col.set(c));}
    mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=!['glass','water','glow','window'].includes(pool.kind);mesh.receiveShadow=!['glass','water','glow'].includes(pool.kind);mesh.computeBoundingSphere();mesh.frustumCulled=true;scene.add(mesh);renderPools.push({mesh,tier:pool.tier,center:mesh.boundingSphere.center.clone(),radius:mesh.boundingSphere.radius});pool.items.length=0;
  }staticPools.clear();}
  finalize();animate(0);
  const fogCloudMaterial=new THREE.MeshLambertMaterial({color:0xf2f0df,transparent:true,opacity:.63,depthWrite:false});
  const cloudMesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),fogCloudMaterial,94);const cloudRand=seeded(777);for(let i=0;i<94;i++){const cl=Math.floor(i/9),an=cl*.69,x=Math.cos(an)*750,z=Math.sin(an)*850;dynamicBox(cloudMesh,i,x+(cloudRand()-.5)*140,113+cloudRand()*21,z+(cloudRand()-.5)*50,35+cloudRand()*40,8+cloudRand()*12,25+cloudRand()*30);}cloudMesh.computeBoundingSphere();scene.add(cloudMesh);
  function setLOD(camera){let visible=0;for(const p of renderPools){const dist=Math.max(0,camera.position.distanceTo(p.center)-p.radius);p.mesh.visible=p.tier===2||dist<(p.tier===0?430:620);if(p.mesh.visible)visible++;}return visible;}
  function setSunset(amount){materials.glow.emissiveIntensity=.08+amount*2.7;materials.window.emissive.set('#b08143');materials.window.emissiveIntensity=amount*.16;}
  function dispose(){const geometriesToDispose=new Set(),materialsToDispose=new Set(),textures=new Set();scene.traverse(o=>{if(o.geometry)geometriesToDispose.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material]){materialsToDispose.add(m);if(m.map)textures.add(m.map);}});for(const g of geometriesToDispose)g.dispose();for(const m of materialsToDispose)m.dispose();for(const t of textures)t.dispose();}
  return {animate,setLOD,setSunset,dispose,materials,reservations,occupancy,roads,lampPositions,stats:{staticVoxels:boxCount,staticPools:renderPools.length,pedestrians:people.length,vehicles:cars.length,landmarks:LANDMARKS.length},renderPools};
}
