// Entry point: renderer, camera modes, HUD wiring and the frame loop.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createTextures, createMaterials } from './materials.js';
import { Sky } from './sky.js';
import { World } from './world.js';
import { CHURCH_CENTER, MONUMENT } from './layout.js';
import { Labels, buildLabelItems } from './labels.js';

const $ = (id) => document.getElementById(id);
const showError = (err) => {
  const el = $('error');
  el.style.display = 'block';
  el.textContent = 'Something went wrong:\n' + (err && err.stack ? err.stack : String(err));
  console.error(err);
};

// Focus point: between St. Michael's Church and the Matthias Corvinus monument.
const FOCUS = new THREE.Vector3((CHURCH_CENTER.x + MONUMENT.cx) / 2 - 2, 12, (CHURCH_CENTER.z + MONUMENT.cz) / 2 + 2);
const VIEWS = {
  hero: { pos: new THREE.Vector3(62, 90, 196), target: FOCUS.clone() },
  aerial: { pos: new THREE.Vector3(70, 380, 360), target: new THREE.Vector3(-10, 0, -10) },
  street: { pos: new THREE.Vector3(-2, 1.9, 46), target: new THREE.Vector3(-14, 7, -24) },
};

class App {
  constructor() {
    if (!window.WebGL2RenderingContext) throw new Error('WebGL2 is required for this scene.');
    const canvas = document.createElement('canvas');
    document.body.prepend(canvas);
    const gl = canvas.getContext('webgl2', { antialias: true, powerPreference: 'high-performance', alpha: false });
    if (!gl) throw new Error('Could not create a WebGL2 context.');
    this.renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(46, 1, 0.5, 9000);
    this.camera.position.copy(VIEWS.hero.pos);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.screenSpacePanning = false;
    this.controls.maxPolarAngle = Math.PI * 0.54;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 1800;
    this.controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    this.controls.target.copy(VIEWS.hero.target);
    this.controls.update();

    this.textures = createTextures();
    this.envMap = this.makeEnvironment();
    this.materials = createMaterials(this.textures, this.envMap);
    this.sky = new Sky(this.scene, this.renderer, this.materials);

    this.labels = new Labels($('labels'), this.camera);
    this.flyover = null;
    this.tween = null;
    this.viewToggle = 'aerial';
    this.timer = new THREE.Timer();
    this.fpsAcc = 0;
    this.fpsFrames = 0;
    this.fps = 0;
    this.seedIndex = 0;
    this.quality = 2; // 2 = full, 1 = reduced pixel ratio, 0 = also smaller shadow map
    this.lowStreak = 0;

    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.bindUI();
    canvas.addEventListener('pointerdown', () => { if (this.flyover) this.stopFlyover(); this.tween = null; });
    canvas.addEventListener('wheel', () => { if (this.flyover) this.stopFlyover(); this.tween = null; }, { passive: true });
  }

  makeEnvironment() {
    // Small procedural sky environment for reflections on glass, water and bronze.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envScene = new THREE.Scene();
    const geo = new THREE.SphereGeometry(50, 16, 8);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `varying vec3 vP; void main(){ float h = normalize(vP).y; vec3 sky = mix(vec3(0.75,0.82,0.92), vec3(0.18,0.38,0.85), pow(max(h,0.0),0.6)); vec3 ground = vec3(0.32,0.28,0.24); vec3 c = h < 0.0 ? mix(sky, ground, smoothstep(0.0,-0.2,h)) : sky; gl_FragColor = vec4(c, 1.0); }`,
    });
    envScene.add(new THREE.Mesh(geo, mat));
    const rt = pmrem.fromScene(envScene, 0.04);
    pmrem.dispose();
    geo.dispose();
    mat.dispose();
    return rt.texture;
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  bindUI() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === 'r') this.recenter();
      else if (k === 'f') this.toggleFlyover();
      else if (k === 't') this.toggleTime();
      else if (k === 'v') this.toggleView();
      else if (k === 'l') this.toggleLabels();
      else if (k === 'g') this.regenerate();
    });
    $('btn-labels').addEventListener('click', () => this.toggleLabels());
    $('btn-recenter').addEventListener('click', () => this.recenter());
    $('btn-fly').addEventListener('click', () => this.toggleFlyover());
    $('btn-time').addEventListener('click', () => this.toggleTime());
    $('btn-view').addEventListener('click', () => this.toggleView());
  }

  async loadWorld(seed) {
    const loading = $('loading');
    loading.classList.remove('hidden');
    const text = $('loading-text');
    const bar = $('loading-bar');
    const world = new World({ scene: this.scene, materials: this.materials, seed });
    await world.build((label, frac) => { text.textContent = label; bar.style.width = `${Math.round(frac * 100)}%`; });
    if (this.world) this.world.dispose();
    this.world = world;
    world.setNight(this.sky.blend);
    world.warmShaders(this.renderer, this.camera);
    this.labels.setItems(buildLabelItems(world));
    loading.classList.add('hidden');
    console.info('[world] stats', world.stats);
  }

  // ------------------------------------------------------------ camera modes
  flyTo(view, duration = 1.6) {
    this.stopFlyover();
    this.tween = {
      t: 0, duration,
      p0: this.camera.position.clone(), p1: view.pos.clone(),
      t0: this.controls.target.clone(), t1: view.target.clone(),
    };
  }
  recenter() { this.flyTo(VIEWS.hero, 1.8); }
  toggleView() {
    if (this.viewToggle === 'aerial') { this.flyTo(VIEWS.street, 2.2); this.viewToggle = 'street'; }
    else { this.flyTo(VIEWS.aerial, 2.2); this.viewToggle = 'aerial'; }
  }
  toggleLabels() {
    const on = this.labels.toggle();
    $('btn-labels').classList.toggle('active', on);
    $('labels-state').textContent = on ? '켜짐' : '꺼짐';
  }
  toggleTime() {
    this.sky.toggle();
    const sunset = this.sky.mode === 'sunset';
    $('mode-label').textContent = sunset ? '골든아워 노을' : '맑은 낮';
    $('btn-time').textContent = sunset ? '🌇 노을' : '☀ 낮';
  }
  toggleFlyover() {
    if (this.flyover) this.stopFlyover();
    else {
      this.tween = null;
      this.flyover = { t: 0, startPos: this.camera.position.clone(), startTarget: this.controls.target.clone() };
      this.controls.enabled = false;
      $('btn-fly').classList.add('active');
    }
  }
  stopFlyover() {
    if (!this.flyover) return;
    this.flyover = null;
    this.controls.enabled = true;
    this.controls.target.copy(this._lookAt || FOCUS);
    this.controls.update();
    $('btn-fly').classList.remove('active');
  }
  updateFlyover(dt) {
    const f = this.flyover;
    f.t += dt;
    const t = f.t;
    // Phase A (0-46 s): orbit at rooftop height. Phase B: climb into an aerial view. Loops.
    const cycle = 78;
    const u = t % cycle;
    const cx = CHURCH_CENTER.x + 6, cz = CHURCH_CENTER.z + 24;
    let radius, height, ang;
    if (u < 46) {
      const k = u / 46;
      ang = Math.PI * 0.5 + k * Math.PI * 2; // start from the south
      radius = 150 + 12 * Math.sin(k * Math.PI * 4);
      height = 34 + 10 * Math.sin(k * Math.PI * 2);
    } else {
      const k = (u - 46) / 32;
      const e = k * k * (3 - 2 * k);
      ang = Math.PI * 0.5 + Math.PI * 2 + e * Math.PI * 1.2;
      radius = 150 + e * 220;
      height = 34 + e * 300;
    }
    const target = new THREE.Vector3(cx, 20 + (height - 34) * 0.05, cz);
    const pos = new THREE.Vector3(cx + Math.cos(ang) * radius, height, cz + Math.sin(ang) * radius);
    // ease-in from wherever the camera was
    const blend = Math.min(1, t / 2.5);
    const eb = blend * blend * (3 - 2 * blend);
    this.camera.position.lerpVectors(f.startPos, pos, eb);
    const look = new THREE.Vector3().lerpVectors(f.startTarget, target, eb);
    this.camera.lookAt(look);
    this._lookAt = look;
  }
  updateTween(dt) {
    const tw = this.tween;
    tw.t += dt;
    const k = Math.min(1, tw.t / tw.duration);
    const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    this.camera.position.lerpVectors(tw.p0, tw.p1, e);
    this.controls.target.lerpVectors(tw.t0, tw.t1, e);
    if (k >= 1) this.tween = null;
  }

  /** Never let the orbit camera dip below the pavement. */
  keepAboveGround() {
    if (!this.world || !this.world.built) return;
    const p = this.camera.position;
    const minY = this.world.groundHeightAt(p.x, p.z) + 1.6;
    if (p.y < minY) {
      p.y = minY;
      if (this.controls.target.y > p.y + 30) this.controls.target.y = p.y + 30;
    }
  }

  /** Step down rendering cost if the frame rate stays low for a while (never steps back up). */
  adaptQuality() {
    if (!this.world || !this.world.built || this.loading) return;
    if (this.fps < 45) this.lowStreak++; else this.lowStreak = 0;
    if (this.lowStreak >= 6 && this.quality > 0) {
      this.quality--;
      this.lowStreak = 0;
      if (this.quality === 1) {
        this.renderer.setPixelRatio(1);
        this.resize();
      } else {
        this.sky.sun.shadow.mapSize.set(2048, 2048);
        if (this.sky.sun.shadow.map) { this.sky.sun.shadow.map.dispose(); this.sky.sun.shadow.map = null; }
      }
      console.info('[perf] reduced quality level to', this.quality);
    }
  }

  async regenerate() {
    if (this.loading) return;
    this.loading = true;
    try {
      this.seedIndex++;
      await this.loadWorld(`piata-unirii-${this.seedIndex}`);
    } catch (err) { showError(err); }
    this.loading = false;
  }

  start() {
    const loop = () => {
      requestAnimationFrame(loop);
      this.timer.update();
      const dt = Math.min(0.05, this.timer.getDelta());
      const elapsed = this.timer.getElapsed();
      if (this.flyover) this.updateFlyover(dt);
      else {
        if (this.tween) this.updateTween(dt);
        this.controls.update();
        this.keepAboveGround();
      }
      this.sky.update(dt, elapsed);
      if (this.world && this.world.built) { this.world.setNight(this.sky.blend); this.world.update(dt, elapsed, this.camera); }
      this.renderer.render(this.scene, this.camera);
      this.labels.update();
      this.fpsAcc += dt;
      this.fpsFrames++;
      if (this.fpsAcc >= 0.5) {
        this.fps = this.fpsFrames / this.fpsAcc;
        this.fpsAcc = 0;
        this.fpsFrames = 0;
        const info = this.renderer.info;
        const st = this.world && this.world.built ? this.world.stats : null;
        const extra = st ? ` · ${this.world.buildings.length} buildings · ${st.trees} trees · ${st.pedestrians} people · ${st.vehicles} vehicles` : '';
        $('status').textContent = `${this.fps.toFixed(0)} fps · ${info.render.calls} draw calls · ${(info.render.triangles / 1e6).toFixed(2)}M tris${extra}`;
        this.adaptQuality();
      }
    };
    loop();
  }
}

try {
  const app = new App();
  window.__app = app;
  app.start();
  app.loading = true;
  app.loadWorld('piata-unirii').then(() => { app.loading = false; }).catch(showError);
} catch (err) {
  showError(err);
}
