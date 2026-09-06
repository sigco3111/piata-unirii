// World orchestrator: builds the static scene in phases and owns the dynamic agents.
import * as THREE from 'three';
import { Palette, Sink } from './voxel.js';
import { Ground } from './ground.js';
import { SQ, PLAZA, SIDEWALK, ROAD, STREETS, CHURCH, MONUMENT, ARCH, FOUNTAIN, elevation, Occupancy, OCC, offsetPolyline } from './layout.js';
import { CLASS_INFO } from './materials.js';
import { makeRng } from './rng.js';
import { meshModel } from './voxel.js';
import { buildChurch } from './church.js';
import { buildMonument } from './monument.js';
import { buildPerimeter } from './perimeter.js';
import { buildBuilding } from './buildings.js';
import { buildCity, buildHills, paintRiver } from './city.js';
import { makeInstanced, unitPrototypes } from './instancing.js';
import { buildProps } from './props.js';
import { buildAgents } from './agents.js';

const CHUNK = 224;
export const chunkKey = (cls, x, z) => `${cls}|${Math.floor((x + 4000) / CHUNK)}|${Math.floor((z + 4000) / CHUNK)}`;

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

export class World {
  constructor({ scene, materials, seed = 'piata-unirii' }) {
    this.scene = scene;
    this.materials = materials;
    this.seed = seed;
    this.rng = makeRng(seed);
    this.palette = new Palette();
    this.group = new THREE.Group();
    this.group.name = 'world';
    this.dynamic = new THREE.Group();
    this.dynamic.name = 'dynamic';
    this.disposables = [];
    this.updaters = [];
    this.occ = new Occupancy(560, 1);
    this.stats = { quads: 0, meshes: 0 };
    this.sink = new Sink(this.palette);
    this.coarseSink = new Sink(this.palette);
    this.landmarks = {};
    this.nightLights = [];
    this.buildings = [];
    this.protos = unitPrototypes(this.palette);
    this.night = 0;
    this.built = false;
  }

  /** Ground height (m) at a world position, preferring the fine plaza grid. */
  groundHeightAt(x, z) {
    const g = this.plazaGround;
    const ix = g.toIx(x), iz = g.toIz(z);
    if (g.inBounds(ix, iz)) return g.h[g.idx(ix, iz)] * g.hq;
    return this.outerGround.heightAt(x, z);
  }
  /** Force a flat terrace under a landmark footprint (both grids). */
  flattenGround(x0, z0, x1, z1, y, { occl = false } = {}) {
    for (const g of [this.plazaGround, this.outerGround]) {
      g.forRect(x0, z0, x1, z1, (i) => { g.h[i] = Math.round(y / g.hq); if (occl) g.occl[i] = 1; });
    }
  }
  markOccluder(x0, z0, x1, z1) {
    for (const g of [this.plazaGround, this.outerGround]) g.forRect(x0, z0, x1, z1, (i) => { g.occl[i] = 1; });
  }
  /**
   * Build and place a building at world (x, z) with yaw rot. Returns placement info or null
   * when the footprint collides (secondary buildings only; fixed ones always succeed).
   */
  placeBuilding(spec, x, z, rot, rng, { fixed = false, extras = null, coarse = false, occupy = true } = {}) {
    const w = spec.w, d = spec.d;
    if (!fixed && !this.occ.rectFree(x, z, rot, w, d)) return null;
    // secondary buildings never intrude into the square block ring
    if (!fixed) {
      const cr0 = Math.cos(rot), sr0 = Math.sin(rot);
      for (const [lx, lz] of [[0, 0], [w, 0], [0, d], [w, d], [w / 2, d / 2]]) {
        const wx = x + lx * cr0 + lz * sr0, wz = z - lx * sr0 + lz * cr0;
        if (wx > SQ.x0 - 0.5 && wx < SQ.x1 + 0.5 && wz > SQ.z0 - 0.5 && wz < SQ.z1 + 0.5) return null;
      }
    }
    const cr = Math.cos(rot), sr = Math.sin(rot);
    // base height: sidewalk just in front of the frontage centre
    const fx = x + (w / 2) * cr + (-1.5) * sr;
    const fz = z - (w / 2) * sr + (-1.5) * cr;
    const baseY = Math.round(this.groundHeightAt(fx, fz) / 0.25) * 0.25;
    const built = buildBuilding(spec, this.palette, rng || this.rng);
    if (extras) extras(built.model, built, this.palette);
    this.addModel(built.model, { x, y: baseY, z, rot }, { coarse });
    if (occupy) this.occ.markRot(x, z, rot, w, d, OCC.BUILDING);
    // contact AO on the surrounding ground
    for (let lx = 0.25; lx < w; lx += 0.5) {
      for (let lz = 0.25; lz < d; lz += 0.5) {
        const wx = x + lx * cr + lz * sr, wz = z - lx * sr + lz * cr;
        this.setOcclAt(wx, wz);
      }
    }
    const info = { spec, x, z, rot, w, d, H: built.H, baseY, roofTop: built.roofTop, name: spec.name };
    this.buildings.push(info);
    return info;
  }
  setOcclAt(x, z) {
    for (const g of [this.plazaGround, this.outerGround]) {
      const ix = g.toIx(x), iz = g.toIz(z);
      if (g.inBounds(ix, iz)) g.occl[g.idx(ix, iz)] = 1;
    }
  }

  /** Mesh a voxel model into the static sink (or the coarse sink for far LOD). */
  addModel(model, transform, { coarse = false } = {}) {
    meshModel(model, coarse ? this.coarseSink : this.sink, transform, coarse ? (cls) => `${cls}|far` : chunkKey);
  }
  /** Add an InstancedMesh of a prototype geometry; returns the mesh. */
  addInstanced(geometry, material, items, opts = {}) {
    const mesh = makeInstanced(geometry, material, items, opts);
    if (!mesh) return null;
    (opts.dynamic ? this.dynamic : this.group).add(mesh);
    this.stats.meshes++;
    return mesh;
  }

  mat(hex, cls = 'wall') { return this.palette.get(hex, cls); }

  async build(onProgress = () => {}) {
    const phases = [
      ['석재 포장을 깔다', () => this.buildGround()],
      ['성 미하일 성당을 올리다', () => this.buildChurch()],
      ['마차이 코르비누스 동상을 주조하다', () => this.buildMonument()],
      ['광장 둘레 파사드를 짓다', () => this.buildPerimeter()],
      ['구시가지 패브릭을 자라게 하다', () => this.buildCity()],
      ['트란실바니아 구릉을 빚다', () => this.buildHills()],
      ['보리수와 양버즘나무를 심다', () => this.buildProps()],
      ['복셀 지오메트리를 병합하다', () => this.finalizeStatic()],
      ['광장에 사람들을 배치하다', () => this.buildAgents()],
    ];
    for (let i = 0; i < phases.length; i++) {
      const [label, fn] = phases[i];
      onProgress(label, i / phases.length);
      await nextFrame();
      const t0 = performance.now();
      await fn();
      console.info(`[world] ${label}: ${(performance.now() - t0).toFixed(0)} ms`);
    }
    onProgress('준비 완료', 1);
    this.scene.add(this.group);
    this.scene.add(this.dynamic);
    this.built = true;
  }

  // ------------------------------------------------------------------ ground
  buildGround() {
    const P = this.palette;
    const ids = this.groundIds = {
      pave: P.get('#d8d2c4', 'pave'),
      paveWarm: P.get('#dccfb8', 'pave'),
      paveDark: P.get('#bfb9ad', 'pave'),
      sidewalk: P.get('#cfc9bd', 'pave'),
      road: P.get('#7d7a76', 'road'),
      roadOuter: P.get('#858280', 'road'),
      curb: P.get('#bdb7ab', 'stone'),
      grass: P.get('#6b8a45', 'grass'),
      grassLight: P.get('#71904a', 'grass'),
      courtyard: P.get('#b9b3a6', 'pave'),
      earth: P.get('#8a7a62', 'grass'),
      pitFloor: P.get('#6e6559', 'stone'),
      pitWall: P.get('#8d8375', 'stone'),
      basin: P.get('#7f8a90', 'stone'),
      step: P.get('#cbc5b8', 'stone'),
    };

    // Outer 1 m ground covering the old town, with a hole where the finer plaza grid sits.
    const outer = new Ground({ cell: 1, hq: 0.25, x0: -560, z0: -560, nx: 1120, nz: 1120, defaultMat: ids.courtyard });
    const plazaRect = { x0: SQ.x0 - 2, z0: SQ.z0 - 2, x1: SQ.x1 + 2, z1: SQ.z1 + 2 };
    outer.hole = plazaRect;
    outer.setHeightFn(elevation);
    // Fine 0.5 m ground for the square itself.
    const plaza = new Ground({ cell: 0.5, hq: 0.25, x0: plazaRect.x0, z0: plazaRect.z0, nx: (plazaRect.x1 - plazaRect.x0) * 2, nz: (plazaRect.z1 - plazaRect.z0) * 2, defaultMat: ids.pave });
    plaza.setHeightFn(elevation);
    this.outerGround = outer;
    this.plazaGround = plaza;

    // --- streets outside the square ---
    for (const st of STREETS) {
      const sw = st.width >= 14 ? 3.5 : st.width >= 11 ? 2.5 : 1.8;
      this.occ.markPolyline(st.pts, st.width, OCC.SIDEWALK);
      this.occ.markPolyline(st.pts, st.width - 2 * sw, OCC.ROAD);
      this.paintPolyline(outer, st.pts, st.width, { mat: ids.sidewalk });
      this.paintPolyline(outer, st.pts, st.width - 2 * sw, { mat: ids.roadOuter, dh: -0.25 });
      st.sidewalk = sw;
    }
    // --- the square: mark as plaza in occupancy, paint perimeter sidewalks + roads ---
    this.occ.markRect(SQ.x0 - 1, SQ.z0 - 1, SQ.x1 + 1, SQ.z1 + 1, OCC.PLAZA);
    plaza.setRect(SQ.x0 - 2, SQ.z0 - 2, SQ.x1 + 2, SQ.z1 + 2, { mat: ids.sidewalk });
    const r0 = { x0: SQ.x0 + SIDEWALK, z0: SQ.z0 + SIDEWALK, x1: SQ.x1 - SIDEWALK, z1: SQ.z1 - SIDEWALK };
    plaza.setRect(r0.x0, r0.z0, r0.x1, r0.z1, { mat: ids.road, fn: (x, z) => true });
    // lower the carriageway by one step to create curbs
    plaza.forRect(r0.x0, r0.z0, r0.x1, r0.z1, (i, cx, cz) => {
      if (cx >= PLAZA.x0 && cx < PLAZA.x1 && cz >= PLAZA.z0 && cz < PLAZA.z1) return;
      plaza.h[i] -= 1;
      plaza.wallMat[i] = ids.curb;
    });
    // pedestrian crossings (flush ramps) at the middle of each side and corners
    const crossing = (x0, z0, x1, z1) => plaza.forRect(x0, z0, x1, z1, (i, cx, cz) => {
      if (cx >= PLAZA.x0 && cx < PLAZA.x1 && cz >= PLAZA.z0 && cz < PLAZA.z1) return;
      plaza.h[i] += 1; plaza.mat[i] = ids.paveDark; plaza.wallMat[i] = ids.curb;
    });
    for (const cx of [-70, -14, 40, 88]) crossing(cx - 3, SQ.z1 - SIDEWALK - ROAD - 1, cx + 3, SQ.z1 - SIDEWALK);
    for (const cx of [-90, -30, 30, 90]) crossing(cx - 3, SQ.z0 + SIDEWALK, cx + 3, SQ.z0 + SIDEWALK + ROAD + 1);
    for (const cz of [-50, 0, 50]) crossing(SQ.x1 - SIDEWALK - ROAD - 1, cz - 3, SQ.x1 - SIDEWALK, cz + 3);
    for (const cz of [-50, 0, 50]) crossing(SQ.x0 + SIDEWALK, cz - 3, SQ.x0 + SIDEWALK + ROAD + 1, cz + 3);
    // curb material along plaza edge
    plaza.forRect(PLAZA.x0, PLAZA.z0, PLAZA.x1, PLAZA.z1, (i) => { plaza.wallMat[i] = ids.curb; });

    // --- plaza paving design: pale stone with darker guiding bands ---
    plaza.forRect(PLAZA.x0, PLAZA.z0, PLAZA.x1, PLAZA.z1, (i, cx, cz) => {
      const bandX = ((cx - PLAZA.x0) % 24) < 1.0;
      const bandZ = ((cz - PLAZA.z0) % 24) < 1.0;
      if (bandX || bandZ) plaza.mat[i] = ids.paveDark;
      else if (Math.abs(cz - 8) < 26 && cx > -70 && cx < 60) plaza.mat[i] = ids.paveWarm; // warm carpet around the monument
    });

    // --- church grounds: grass with paths on the north and east ---
    const gz0 = PLAZA.z0 + 1, gz1 = CHURCH.z0 - 3;
    plaza.setRect(CHURCH.towerX0 - 6, gz0, CHURCH.x1 + CHURCH.apseLen + 22, gz1, { mat: ids.grass });
    plaza.setRect(CHURCH.x1 + CHURCH.apseLen + 3, gz0, CHURCH.x1 + CHURCH.apseLen + 22, CHURCH.z1 + 3, { mat: ids.grass });
    // south-east lawn wedge
    plaza.setRect(CHURCH.x1 + 2, CHURCH.z1 + 4, CHURCH.x1 + CHURCH.apseLen + 22, CHURCH.z1 + 14, { mat: ids.grass });
    // lighter mowing stripes
    plaza.forRect(CHURCH.towerX0 - 6, gz0, CHURCH.x1 + CHURCH.apseLen + 22, CHURCH.z1 + 14, (i, cx) => {
      if (plaza.mat[i] === ids.grass && Math.floor((cx + 200) / 3) % 2 === 0) plaza.mat[i] = ids.grassLight;
    });
    // paths across the grass: ring path 2.5 m from the church walls + two north-south links
    const ring = 3;
    plaza.setRect(CHURCH.towerX0 - ring, CHURCH.z0 - ring - 2, CHURCH.x1 + CHURCH.apseLen + ring + 3, CHURCH.z0 - 1, { mat: ids.pave });
    plaza.setRect(CHURCH.x1 + CHURCH.apseLen + 1, CHURCH.z0 - ring - 2, CHURCH.x1 + CHURCH.apseLen + ring + 3, CHURCH.z1 + ring + 4, { mat: ids.pave });
    plaza.setRect(CHURCH.x1 - 2, CHURCH.z1 + 1, CHURCH.x1 + CHURCH.apseLen + ring + 3, CHURCH.z1 + ring + 4, { mat: ids.pave });
    for (const px of [-30, 10, 44]) plaza.setRect(px - 1.5, gz0 - 1, px + 1.5, gz1 + 1, { mat: ids.pave });
    plaza.setRect(CHURCH.x1 + CHURCH.apseLen + 8, PLAZA.z0, CHURCH.x1 + CHURCH.apseLen + 11, CHURCH.z1 + 14, { mat: ids.pave });
    // keep a paved apron directly around the walls
    plaza.setRect(CHURCH.towerX0 - 1.5, CHURCH.z0 - 1.5, CHURCH.x1 + CHURCH.apseLen + 1.5, CHURCH.z1 + 1.5, { mat: ids.pave });

    // --- archaeological window: sunken pit with stone walls ---
    const ax0 = ARCH.cx - ARCH.w / 2, ax1 = ARCH.cx + ARCH.w / 2, az0 = ARCH.cz - ARCH.d / 2, az1 = ARCH.cz + ARCH.d / 2;
    plaza.forRect(ax0, az0, ax1, az1, (i) => { plaza.h[i] -= 9; plaza.mat[i] = ids.pitFloor; });
    plaza.forRect(ax0 - 1, az0 - 1, ax1 + 1, az1 + 1, (i, cx, cz) => {
      if (cx >= ax0 && cx < ax1 && cz >= az0 && cz < az1) return;
      plaza.wallMat[i] = ids.pitWall;
    });

    // --- fountain: shallow geometric basins flush with the paving ---
    const fx0 = FOUNTAIN.cx - FOUNTAIN.w / 2, fz0 = FOUNTAIN.cz - FOUNTAIN.d / 2;
    const basins = [
      [fx0, fz0 + 2, fx0 + 13, fz0 + 8], [fx0 + 15, fz0, fx0 + 32, fz0 + 6], [fx0 + 4, fz0 + 10, fx0 + 22, fz0 + 16], [fx0 + 24, fz0 + 9, fx0 + 32, fz0 + 14],
    ];
    this.fountainBasins = basins;
    for (const [bx0, bz0, bx1, bz1] of basins) {
      plaza.forRect(bx0, bz0, bx1, bz1, (i) => { plaza.h[i] -= 1; plaza.mat[i] = ids.basin; plaza.wallMat[i] = ids.step; plaza.water[i] = plaza.h[i] + 1; });
    }
    // low seating steps: two long stone ledges (south of the fountain and along the west plaza edge)
    plaza.forRect(fx0 - 2, fz0 + 20, fx0 + 34, fz0 + 21.5, (i) => { plaza.h[i] += 2; plaza.mat[i] = ids.step; plaza.wallMat[i] = ids.step; });
    plaza.forRect(PLAZA.x0 + 12, 20, PLAZA.x0 + 13.5, 62, (i) => { plaza.h[i] += 2; plaza.mat[i] = ids.step; plaza.wallMat[i] = ids.step; });
    plaza.forRect(PLAZA.x1 - 14, -40, PLAZA.x1 - 12.5, 10, (i) => { plaza.h[i] += 2; plaza.mat[i] = ids.step; plaza.wallMat[i] = ids.step; });

    // --- occupancy for fixed landmarks (never overwritten by secondary placement) ---
    this.occ.markRect(CHURCH.towerX0 - 4, CHURCH.z0 - 4, CHURCH.x1 + CHURCH.apseLen + 4, CHURCH.z1 + 4, OCC.RESERVED);
    this.occ.markRect(MONUMENT.cx - MONUMENT.w / 2 - 3, MONUMENT.cz - MONUMENT.d / 2 - 3, MONUMENT.cx + MONUMENT.w / 2 + 3, MONUMENT.cz + MONUMENT.d / 2 + 3, OCC.RESERVED);
    this.occ.markRect(ax0 - 2, az0 - 2, ax1 + 2, az1 + 2, OCC.RESERVED);
    this.occ.markRect(fx0 - 2, fz0 - 2, fx0 + FOUNTAIN.w + 2, fz0 + FOUNTAIN.d + 6, OCC.RESERVED);
  }

  /** Paint a thick polyline onto a Ground. */
  paintPolyline(ground, pts, width, { mat, dh = 0 }) {
    const hw = width / 2;
    for (let i = 0; i + 1 < pts.length; i++) {
      const [ax, az] = pts[i];
      const [bx, bz] = pts[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const dx = (bx - ax) / len, dz = (bz - az) / len;
      const minX = Math.min(ax, bx) - hw, maxX = Math.max(ax, bx) + hw;
      const minZ = Math.min(az, bz) - hw, maxZ = Math.max(az, bz) + hw;
      ground.forRect(minX, minZ, maxX, maxZ, (idx, cx, cz) => {
        const px = cx - ax, pz = cz - az;
        const t = Math.max(0, Math.min(len, px * dx + pz * dz));
        const qx = px - dx * t, qz = pz - dz * t;
        if (qx * qx + qz * qz > hw * hw) return;
        if (ground.mat[idx] === mat) return;
        ground.mat[idx] = mat;
        ground.wallMat[idx] = this.groundIds.curb;
        if (dh) ground.h[idx] = Math.round(elevation(cx, cz) / ground.hq) + Math.round(dh / ground.hq);
      });
    }
  }

  buildChurch() { buildChurch(this); }
  buildMonument() { buildMonument(this); }
  buildPerimeter() { buildPerimeter(this); }
  buildCity() { paintRiver(this); buildCity(this); }
  buildHills() { buildHills(this); }
  buildProps() { buildProps(this); }
  buildAgents() { buildAgents(this); }

  // ------------------------------------------------------------- finalize
  finalizeStatic() {
    const keyFn = chunkKey;
    this.plazaGround.mesh(this.palette, this.sink, keyFn);
    this.outerGround.mesh(this.palette, this.sink, keyFn);
    this.addSinkMeshes(this.sink, true);
    this.addSinkMeshes(this.coarseSink, false);
  }

  addSinkMeshes(sink, detailed) {
    const M = this.materials;
    for (const { key, geometry } of sink.build()) {
      const cls = key.split('|')[0];
      const material = M[cls] || M.wall;
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = key;
      const info = CLASS_INFO[cls] || { shadow: true };
      mesh.castShadow = detailed && info.shadow;
      mesh.receiveShadow = true;
      if (material.transparent) mesh.renderOrder = cls === 'water' ? 3 : 2;
      this.group.add(mesh);
      this.disposables.push(geometry);
      this.stats.meshes++;
    }
    this.stats.quads += sink.quadCount;
  }

  /** 0 = day, 1 = sunset/evening: scales lamps and warm point lights. */
  setNight(level) {
    if (level === this.night) return;
    this.night = level;
    const on = level > 0.02;
    for (const { light, intensity } of this.nightLights) {
      light.intensity = intensity * level;
      light.visible = on; // lights outside the scene cost nothing in the shaders by day
    }
  }
  /** Compile both shader variants (with and without evening lights) so the first toggle is smooth. */
  warmShaders(renderer, camera) {
    for (const { light } of this.nightLights) light.visible = true;
    renderer.compile(this.scene, camera);
    for (const { light } of this.nightLights) light.visible = this.night > 0.02;
    renderer.compile(this.scene, camera);
  }

  update(dt, elapsed, camera) {
    for (const u of this.updaters) u(dt, elapsed, camera);
  }

  dispose() {
    this.scene.remove(this.group);
    this.scene.remove(this.dynamic);
    for (const d of this.disposables) d.dispose();
    this.disposables.length = 0;
    this.updaters.length = 0;
  }
}
