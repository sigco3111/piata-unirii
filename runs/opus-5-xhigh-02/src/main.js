// Piata Unirii, Cluj-Napoca - voxel miniature.
// Boot, build, light and run the scene.

import * as THREE from 'three';
import { VoxelWorld, Builder, meshWorld } from './voxel.js';
import { MaterialLibrary } from './materials.js';
import { buildAtlas } from './textures.js';
import {
  SQUARE, PLAZA, CHURCH, MONUMENT, ROMAN_WINDOW, FOUNTAIN, WATER_TABLES,
  MAP, LANDMARKS, STREETS, Occupancy, terrainHeight, distToPolyline, streetBounds,
} from './layout.js';
import { buildChurch } from './church.js';
import { buildMonument, buildRomanWindow } from './monument.js';
import { buildBanffy, buildMirrorBuildings, buildContinental, buildTownHall, buildNationalBank } from './heroes.js';
import { buildFrontages, buildOldTown, reserveInfrastructure } from './city.js';
import { buildGround, heightAt, walkable } from './ground.js';
import { buildTreeModels, planTrees, buildTrees } from './trees.js';
import { buildPropModels, planProps, buildProps, buildLampGlow, buildFountain, buildPlazaStructures } from './props.js';
import { buildPeopleModels, Crowd } from './people.js';
import { buildVehicleModels, Traffic } from './vehicles.js';
import { buildFarTerrain, buildDistantCity, buildClouds, Sky, farHeight } from './backdrop.js';
import { OrbitCam, Flyover } from './controls.js';
import { LabelLayer } from './labels.js';

const VIEWS = {
  aerial: { target: [-3, 25, -5], dist: 300, az: 0.50, pol: 1.115 },
  street: { target: [-14, 13, -6], dist: 62, az: 0.12, pol: 1.742 },
};

const SUN = {
  day: {
    // east-south-east at ~37 deg: three-quarter light on the church's south front
    // so the buttresses throw depth across it, with shadows raking west-north-west
    // over the open plaza rather than hiding behind the buildings
    dir: new THREE.Vector3(0.62, 0.60, 0.51).normalize(),
    colour: 0xfff3dd, intensity: 2.45,
    hemiSky: 0xbcd7f2, hemiGround: 0x8b8574, hemiInt: 0.78,
    ambient: 0x9fb3c8, ambInt: 0.26,
    fog: 0xc9d8e4, fogDensity: 0.00056,
    exposure: 0.96,
  },
  dusk: {
    dir: new THREE.Vector3(-0.86, 0.36, 0.36).normalize(),
    colour: 0xffa955, intensity: 3.35,
    hemiSky: 0xa08fb8, hemiGround: 0x8a6a48, hemiInt: 0.92,
    ambient: 0x8f83ad, ambInt: 0.46,
    fog: 0xe0a877, fogDensity: 0.00082,
    exposure: 1.14,
  },
};

const state = {
  tod: 0, todTarget: 0,
  view: 'aerial',
  labels: false,
  flyoverOn: false,
  helpOpen: true,
};

const el = (id) => document.getElementById(id);

function setStage(pct, text) {
  const bar = el('bar');
  if (bar) bar.style.width = Math.round(pct * 100) + '%';
  const t = el('stage');
  if (t) t.textContent = text;
}
const frame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

function fail(err) {
  console.error(err);
  const box = el('error');
  if (box) {
    box.style.display = 'block';
    box.textContent = 'Could not start the scene: ' + (err && err.message ? err.message : String(err));
  }
  const l = el('loading');
  if (l) l.classList.add('hidden');
}

async function boot() {
  const canvas = el('view');
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'high-performance' });
  if (!gl) throw new Error('WebGL2 is not available in this browser.');

  const renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = SUN.day.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;   // casters are static; refreshed on demand

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(SUN.day.fog, SUN.day.fogDensity);

  const camera = new THREE.PerspectiveCamera(39, window.innerWidth / window.innerHeight, 0.6, 12000);

  setStage(0.04, '석고·라임스톤·타일을 준비하는 중');
  await frame();
  buildAtlas();
  const matLib = new MaterialLibrary();

  // ---- lights -------------------------------------------------------------
  const sun = new THREE.DirectionalLight(SUN.day.colour, SUN.day.intensity);
  sun.castShadow = true;
  const SH = 3072;
  sun.shadow.mapSize.set(SH, SH);
  const sc = sun.shadow.camera;
  sc.left = -300; sc.right = 300; sc.top = 300; sc.bottom = -300;
  sc.near = 20; sc.far = 1700;
  sc.updateProjectionMatrix();   // three does not do this for us after resizing the frustum
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.35;
  sun.target.position.set(0, 8, -10);
  scene.add(sun, sun.target);

  const hemi = new THREE.HemisphereLight(SUN.day.hemiSky, SUN.day.hemiGround, SUN.day.hemiInt);
  scene.add(hemi);
  const amb = new THREE.AmbientLight(SUN.day.ambient, SUN.day.ambInt);
  scene.add(amb);

  // ---- voxel tiers --------------------------------------------------------
  const tiers = {
    fine: new VoxelWorld(0.15, 'fine'),      // LOD 0+  monument, Roman window
    hero: new VoxelWorld(0.25, 'hero'),      // LOD 0   church and the named palaces
    perim: new VoxelWorld(0.35, 'perim'),    // LOD 1   frontages of the square
    outer: new VoxelWorld(0.70, 'outer'),    // LOD 2   old-town fabric
    far: new VoxelWorld(1.60, 'far'),        // LOD 3   distant Cluj
  };
  const B = {
    fine: new Builder(tiers.fine), hero: new Builder(tiers.hero), perim: new Builder(tiers.perim),
    outer: new Builder(tiers.outer), far: new Builder(tiers.far),
  };

  const footprints = [];
  const occ = new Occupancy(2);
  reserveInfrastructure(occ);

  setStage(0.10, '성 미하일 성당을 올리는 중');
  await frame();
  buildChurch(B.hero);
  footprints.push(
    { x0: -28.8, z0: -32.8, x1: -15.2, z1: -19.2, base: 0, h: 78 },
    { x0: -16.8, z0: -33.0, x1: 44.8, z1: -8.3, base: 0, h: 38.5 },
    { x0: 43.5, z0: -31.2, x1: 55.6, z1: -9.8, base: 0, h: 33 },
    { x0: 1.4, z0: -9.6, x1: 10.6, z1: -5.0, base: 0, h: 13.6 },
    { x0: -14.2, z0: -9.6, x1: -5.8, z1: -3.9, base: 0, h: 12.2 },
    { x0: 41.2, z0: -36.0, x1: 45.8, z1: -31.0, base: 0, h: 32.6 },
  );

  setStage(0.20, '마차이 코르비누스 동상을 주조하는 중');
  await frame();
  buildMonument(B.fine);
  buildRomanWindow(B.fine);
  footprints.push({ x0: -31.8, z0: 5.2, x1: -8.2, z1: 22.8, base: 0 });

  setStage(0.28, '반피 궁전과 미러 빌딩을 짓는 중');
  await frame();
  for (const f of buildBanffy(B.hero)) footprints.push(Object.assign({ base: 0, h: 26 }, f));
  for (const f of buildMirrorBuildings(B.hero)) footprints.push(Object.assign({ base: 0, h: 24 }, f));

  setStage(0.34, '남서쪽 모서리를 고정하는 중');
  await frame();
  for (const f of buildContinental(B.hero)) footprints.push(Object.assign({ base: 0, h: 26 }, f));
  for (const f of buildTownHall(B.hero)) footprints.push(Object.assign({ base: 0, h: 22 }, f));
  for (const f of buildNationalBank(B.hero)) footprints.push(Object.assign({ base: 0, h: 25 }, f));
  for (const f of footprints) occ.markRect(f.x0 - 1, f.z0 - 1, f.x1 + 1, f.z1 + 1);

  setStage(0.42, '광장을 역사적 정면으로 둘러싸는 중');
  await frame();
  buildFrontages(B.perim, footprints);
  for (const f of footprints) occ.markRect(f.x0 - 1, f.z0 - 1, f.x1 + 1, f.z1 + 1);

  setStage(0.50, '클루즈 구시가지 바깥으로 퍼뜨리는 중');
  await frame();
  buildOldTown(B.outer, occ, footprints, 255);

  // props and trees must dodge roads, water and everything already standing
  const roadNear = (x, z) => {
    for (const s of STREETS) {
      const bb = streetBounds(s, 3);
      if (x < bb.x0 || x > bb.x1 || z < bb.z0 || z > bb.z1) continue;
      if (distToPolyline(x, z, s.pts) < s.width / 2 + 1.4) return true;
    }
    return false;
  };
  const inRect = (x, z, r, pad) => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;
  const blocked = (x, z) => {
    if (x < MAP.x0 + 6 || x > MAP.x1 - 6 || z < MAP.z0 + 6 || z > MAP.z1 - 6) return true;
    if (inRect(x, z, FOUNTAIN, 2.2)) return true;
    for (const t of WATER_TABLES) if (inRect(x, z, t, 2.0)) return true;
    if (inRect(x, z, ROMAN_WINDOW, 2.6)) return true;
    if (inRect(x, z, MONUMENT.pedestal, 5.0)) return true;
    for (const f of footprints) if (inRect(x, z, f, 1.6)) return true;
    return roadNear(x, z);
  };

  setStage(0.58, '보리수와 플라네타리 나무를 심는 중');
  await frame();
  const treeModels = buildTreeModels();
  const treePlan = planTrees(blocked);

  setStage(0.64, '벤치·가로등·카페 테라스를 배치하는 중');
  await frame();
  const propModels = buildPropModels();
  const propPlan = planProps(blocked);
  buildPlazaStructures(B.perim);

  setStage(0.70, 'Piața Unirii 에 포장을 깔다');
  await frame();
  const shadeBlobs = treePlan.map((t) => ({ x: t.x, z: t.z, r: 4.4 * t.scale }));
  shadeBlobs.push({ x: MONUMENT.centre[0], z: MONUMENT.centre[1], r: 12 });
  const ground = buildGround(footprints, shadeBlobs, matLib);
  scene.add(ground.group);

  setStage(0.76, '분수대에 물을 채우는 중');
  await frame();
  const fountain = buildFountain(B.perim, matLib, scene);

  setStage(0.80, '트란실바니아 분지를 스케치하는 중');
  await frame();
  buildDistantCity(B.far);
  const farTerrain = buildFarTerrain(matLib);
  scene.add(farTerrain);
  const sky = new Sky(scene);
  const clouds = buildClouds();
  scene.add(clouds);

  setStage(0.86, '복셀 표면을 병합하는 중');
  await frame();
  const staticRoot = new THREE.Group();
  staticRoot.name = 'voxels';
  scene.add(staticRoot);
  const tierMeshes = {};
  const SECTOR = { fine: 0, hero: 0, perim: 240, outer: 220, far: 0 };
  let totalTris = 0;
  for (const key of ['fine', 'hero', 'perim', 'outer', 'far']) {
    const parts = meshWorld(tiers[key], SECTOR[key]);
    const group = new THREE.Group();
    group.name = 'tier-' + key;
    for (const p of parts) {
      const mesh = new THREE.Mesh(p.geometry, matLib.get(p.group));
      mesh.name = key + ':' + p.group + ':' + p.sx + ',' + p.sz;
      mesh.castShadow = matLib.casts(p.group) && key !== 'far';
      mesh.receiveShadow = key !== 'far';
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
      totalTris += p.geometry.index.count / 3;
    }
    staticRoot.add(group);
    tierMeshes[key] = group;
    await frame();
  }
  for (const key of Object.keys(tiers)) tiers[key].dispose();

  setStage(0.92, '광장에 생기를 불어넣는 중');
  await frame();
  const trees = buildTrees(treeModels, treePlan, matLib, scene);
  const props = buildProps(propModels, propPlan.props, matLib, scene);
  const lampGlow = buildLampGlow(propPlan.lampPositions);
  scene.add(lampGlow);

  const peopleModels = buildPeopleModels();
  const crowd = new Crowd(peopleModels, matLib, scene, 170);
  const vehModels = buildVehicleModels();
  const traffic = new Traffic(vehModels, matLib, scene, 32);

  // ---- controls, labels, UI ----------------------------------------------
  const controls = new OrbitCam(camera, canvas, { groundAt: (x, z) => (Math.abs(x) < 330 && Math.abs(z) < 330 ? heightAt(x, z) : farHeight(x, z)) });
  const flyover = new Flyover();
  const labels = new LabelLayer(document.body, LANDMARKS);
  labels.setOccluders(footprints);
  const v = VIEWS.aerial;
  controls.setFraming(v.az, v.pol, v.dist, new THREE.Vector3().fromArray(v.target));

  const smallProps = new Set(['bicycle', 'bin', 'signpost', 'uplight', 'cafeSet', 'umbrella', 'bollard', 'planter', 'bench']);

  function applyTimeOfDay(t) {
    const a = SUN.day, b = SUN.dusk;
    const lerp = (p, q) => p + (q - p) * t;
    const dir = new THREE.Vector3().copy(a.dir).lerp(b.dir, t).normalize();
    sun.position.copy(dir).multiplyScalar(760).add(new THREE.Vector3(0, 8, -10));
    sun.color.setHex(a.colour).lerp(new THREE.Color(b.colour), t);
    sun.intensity = lerp(a.intensity, b.intensity) * (1 - 0.18 * t);
    hemi.color.setHex(a.hemiSky).lerp(new THREE.Color(b.hemiSky), t);
    hemi.groundColor.setHex(a.hemiGround).lerp(new THREE.Color(b.hemiGround), t);
    hemi.intensity = lerp(a.hemiInt, b.hemiInt);
    amb.color.setHex(a.ambient).lerp(new THREE.Color(b.ambient), t);
    amb.intensity = lerp(a.ambInt, b.ambInt);
    scene.fog.color.setHex(a.fog).lerp(new THREE.Color(b.fog), t);
    scene.fog.density = lerp(a.fogDensity, b.fogDensity);
    renderer.toneMappingExposure = lerp(a.exposure, b.exposure);
    matLib.setTimeOfDay(t);
    lampGlow.material.opacity = Math.max(0, t * t * 0.95);
    lampGlow.material.size = 4.4 + 1.6 * t;
    clouds.material.color.setRGB(1 - 0.02 * t, 1 - 0.10 * t, 1 - 0.22 * t);
    crowd.setShadowOpacity(0.30 - 0.16 * t);
    traffic.setShadowOpacity(0.28 - 0.15 * t);
    sky.update(t, dir);
    return dir;
  }
  applyTimeOfDay(0);
  renderer.shadowMap.needsUpdate = true;

  // ---- interaction ---------------------------------------------------------
  function goto(name, instant) {
    state.view = name;
    const p = VIEWS[name];
    if (instant) controls.setFraming(p.az, p.pol, p.dist, new THREE.Vector3().fromArray(p.target));
    else controls.flyTo({ az: p.az, pol: p.pol, dist: p.dist, target: p.target }, 1.8);
    hud();
  }
  function recentre() {
    const cx = (CHURCH.centre[0] + MONUMENT.centre[0]) / 2;
    const cz = (CHURCH.centre[1] + MONUMENT.centre[1]) / 2;
    controls.flyTo({ az: VIEWS.aerial.az, pol: VIEWS.aerial.pol, dist: state.view === 'street' ? 78 : 250, target: [cx, 24, cz] }, 1.5);
  }
  function toggleFlyover() {
    state.flyoverOn = !state.flyoverOn;
    if (state.flyoverOn) { flyover.start(controls.az); controls.enabled = false; }
    else {
      flyover.stop();
      controls.enabled = true;
      controls.flyTo({ az: controls.az, pol: VIEWS[state.view].pol, dist: VIEWS[state.view].dist, target: VIEWS[state.view].target }, 1.6);
    }
    hud();
  }

  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'r') { recentre(); e.preventDefault(); }
    else if (k === 'f') { toggleFlyover(); e.preventDefault(); }
    else if (k === 't') { state.todTarget = state.todTarget > 0.5 ? 0 : 1; hud(); e.preventDefault(); }
    else if (k === 'v') { goto(state.view === 'aerial' ? 'street' : 'aerial'); e.preventDefault(); }
    else if (k === 'l') { state.labels = !state.labels; labels.setVisible(state.labels); hud(); e.preventDefault(); }
    else if (k === 'h' || k === '?') { state.helpOpen = !state.helpOpen; el('help').classList.toggle('collapsed', !state.helpOpen); e.preventDefault(); }
  });
  el('help').addEventListener('click', () => {
    state.helpOpen = !state.helpOpen;
    el('help').classList.toggle('collapsed', !state.helpOpen);
  });

  function hud() {
    el('m-time').textContent = state.todTarget > 0.5 ? '골든아워' : '맑은 낮';
    el('m-view').textContent = state.flyoverOn ? '플라이오버' : (state.view === 'street' ? '거리 수준' : '항공');
    el('m-labels').textContent = state.labels ? '켜짐' : '꺼짐';
  }
  hud();

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    const pad = 10;
    const rectOf = (id) => {
      const r = el(id).getBoundingClientRect();
      return { x0: r.left - pad, y0: r.top - pad, x1: r.right + pad, y1: r.bottom + pad };
    };
    labels.setExclusions([rectOf('meter'), rectOf('help'), rectOf('title')]);
  }
  window.addEventListener('resize', resize);
  resize();

  // ---- loop ---------------------------------------------------------------
  const clock = new THREE.Clock();
  let last = performance.now();
  let fpsAcc = 0, fpsN = 0, fpsShown = 0, fpsTimer = 0;
  let lastLodPos = new THREE.Vector3(1e9, 0, 0);
  let shadowTimer = 0;
  let quality = Math.min(window.devicePixelRatio || 1, 1.75);
  const qualityMax = quality;
  let animFrame = 0;

  function tick() {
    animFrame = requestAnimationFrame(tick);
    const now = performance.now();
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;
    const time = clock.getElapsedTime();

    // time of day easing
    if (Math.abs(state.tod - state.todTarget) > 0.0008) {
      state.tod += (state.todTarget - state.tod) * Math.min(1, dt * 2.1);
      applyTimeOfDay(state.tod);
      shadowTimer += dt;
      if (shadowTimer > 0.14) { renderer.shadowMap.needsUpdate = true; shadowTimer = 0; }
    } else if (state.tod !== state.todTarget) {
      state.tod = state.todTarget;
      applyTimeOfDay(state.tod);
      renderer.shadowMap.needsUpdate = true;
    }

    flyover.update(dt, controls);
    controls.update(dt);
    const cam = camera.position;
    sky.setCameraPos(cam);

    // distance LOD
    if (cam.distanceTo(lastLodPos) > 6) {
      lastLodPos.copy(cam);
      trees.update(cam, 175);
      const dSq = Math.hypot(cam.x, cam.z) + Math.max(0, cam.y - 40) * 0.5;
      for (const p of props) if (smallProps.has(p.key)) p.pool.visible = dSq < 620;
      tierMeshes.fine.visible = dSq < 1100;
      crowd.setVisible(dSq < 900);
      traffic.setVisible(dSq < 1100);
    }

    fountain.update(time);
    if (crowd.pools.torso.visible) crowd.update(dt, time, cam);
    if (traffic.pools[0].visible) traffic.update(dt);

    labels.update(camera, cam, window.innerWidth, window.innerHeight);
    renderer.render(scene, camera);

    // adaptive resolution so the frame budget holds on slower GPUs
    fpsAcc += 1 / Math.max(dt, 1e-4); fpsN++; fpsTimer += dt;
    if (fpsTimer > 0.8) {
      fpsShown = fpsAcc / fpsN;
      if (fpsShown < 46 && quality > 0.82) { quality = Math.max(0.82, quality - 0.2); renderer.setPixelRatio(quality); }
      else if (fpsShown > 62 && quality < qualityMax) { quality = Math.min(qualityMax, quality + 0.15); renderer.setPixelRatio(quality); }
      el('m-fps').textContent = fpsShown.toFixed(0);
      el('m-calls').textContent = renderer.info.render.calls;
      fpsAcc = 0; fpsN = 0; fpsTimer = 0;
    }
  }

  el('m-tris').textContent = (totalTris / 1000).toFixed(0) + 'k';
  setStage(1, '준비 완료');
  await frame();
  el('loading').classList.add('hidden');
  tick();

  // expose a little state for debugging / automated checks
  window.__piata = { scene, renderer, camera, controls, state, matLib, totalTris };
}

boot().catch(fail);
