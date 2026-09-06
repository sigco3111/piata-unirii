// The fixed geography of Piata Unirii.
//
// +X is east, +Z is south, +Y is up. The origin sits at the centre of the square.
// Everything downstream (ground, facades, traffic, labels) reads these numbers, so the
// landmarks never move between generations - only the dressing is seeded-random.

import { makeNoise2D } from './rng.js';

// The square itself: ~220 m east-west by ~160 m north-south.
export const SQUARE = { x0: -110, x1: 110, z0: -80, z1: 80 };

// Pedestrian plaza inside the perimeter carriageway.
export const PLAZA = { x0: -96, x1: 96, z0: -66, z1: 66 };

// Perimeter carriageway centre-lines (a ring just inside the frontages).
export const RING = { x: 103, z: 73, width: 8 };

// --- Zone A: St Michael's church -------------------------------------------
export const CHURCH = {
  // nave (hall church, three aisles of equal height)
  nave: { x0: -16, x1: 44, z0: -32, z1: -9 },
  eave: 21.0,
  ridge: 38.5,
  // polygonal sanctuary to the east
  apse: { x0: 44, x1: 55, z0: -30.5, z1: -10.5 },
  // neo-Gothic bell tower on the north half of the west front
  tower: { x0: -28, x1: -16, z0: -32, z1: -20 },
  towerTop: 62.0,     // top of the stone tower before the spire
  spireTop: 78.0,
  crossTop: 80.5,
  centre: [14, -20.5],
};

// --- Zone B: Matthias Corvinus ensemble + Roman window ----------------------
export const MONUMENT = {
  centre: [-20, 14],
  pedestal: { x0: -28.5, x1: -11.5, z0: 8.5, z1: 19.5 },
  pedestalTop: 5.6,
  riderTop: 11.6,
};

export const ROMAN_WINDOW = { x0: -50, x1: -38.5, z0: 24, z1: 31, depth: 2.2 };

// --- Fountains --------------------------------------------------------------
export const FOUNTAIN = { x0: 6, x1: 48, z0: 36, z1: 58 };
export const WATER_TABLES = [
  { x0: -64, x1: -50, z0: 44, z1: 52 },
  { x0: -64, x1: -50, z0: 56, z1: 64 },
];

// --- Church grounds (grass) -------------------------------------------------
export const CHURCH_GRASS = [
  { x0: -30, x1: 46, z0: -42, z1: -34 },     // north strip
  { x0: 46, x1: 62, z0: -40, z1: -2 },       // around the apse
  { x0: -22, x1: 30, z0: -7, z1: -1 },       // south strip by the nave
];

// --- Detailed ground extent -------------------------------------------------
export const MAP = { x0: -340, x1: 340, z0: -340, z1: 340 };
export const FAR = 2600; // radius of the distant basin backdrop

// ---------------------------------------------------------------------------
// Street network. Widths are carriageway widths; a 3 m footway is painted on
// either side by the ground builder.
// ---------------------------------------------------------------------------
export const STREETS = [
  // perimeter ring around the plaza (anticlockwise)
  { name: 'ring-n', width: RING.width, ring: true, pts: [[-RING.x, -RING.z], [RING.x, -RING.z]] },
  { name: 'ring-e', width: RING.width, ring: true, pts: [[RING.x, -RING.z], [RING.x, RING.z]] },
  { name: 'ring-s', width: RING.width, ring: true, pts: [[RING.x, RING.z], [-RING.x, RING.z]] },
  { name: 'ring-w', width: RING.width, ring: true, pts: [[-RING.x, RING.z], [-RING.x, -RING.z]] },

  // radiating streets
  { name: 'Str. Matei Corvin', width: 11, pts: [[-60, -76], [-60, -132], [-66, -196]] },
  { name: 'Str. Regele Ferdinand', width: 14, pts: [[70, -76], [73, -142], [86, -214], [96, -300]] },
  { name: 'Str. Iuliu Maniu', width: 13, pts: [[104, 33], [206, 31], [330, 34]] },
  { name: 'Bd. Eroilor', width: 19, pts: [[96, 76], [152, 100], [244, 118], [330, 126]] },
  { name: 'Str. Memorandumului', width: 12, pts: [[-104, -34], [-196, -40], [-330, -34]] },
  { name: 'Str. Napoca', width: 12, pts: [[-104, 51], [-196, 72], [-292, 104], [-330, 122]] },
  { name: 'Str. Universitatii', width: 11, pts: [[-52, 76], [-56, 164], [-64, 262], [-62, 330]] },
  { name: 'Str. 21 Decembrie', width: 13, pts: [[73, -142], [120, -176], [186, -206], [268, -216]] },

  // secondary old-town fabric (deliberately irregular)
  { name: 'lane-a', width: 8, pts: [[-196, -40], [-186, 44], [-196, 128], [-186, 226]] },
  { name: 'lane-b', width: 8, pts: [[-330, 138], [-206, 128], [-96, 146], [4, 152], [104, 142], [214, 128]] },
  { name: 'lane-c', width: 9, pts: [[-330, -132], [-206, -140], [-104, -128], [-6, -136], [96, -128], [206, -142]] },
  { name: 'lane-d', width: 8, pts: [[196, -300], [206, -142], [200, -22], [212, 96], [204, 226]] },
  { name: 'lane-e', width: 8, pts: [[-116, -196], [-60, -196], [40, -206], [140, -190]] },
  { name: 'lane-f', width: 7, pts: [[-146, 226], [-62, 234], [40, 226], [136, 240]] },
  { name: 'lane-g', width: 8, pts: [[-292, 104], [-300, 8], [-292, -96], [-300, -196]] },
  { name: 'lane-h', width: 7, pts: [[-186, 44], [-104, 40], [-4, 46]], ped: true },
  { name: 'lane-i', width: 7, pts: [[4, 152], [10, 246], [4, 330]] },
  { name: 'lane-j', width: 8, pts: [[104, 142], [110, 236], [116, 330]] },
  { name: 'lane-k', width: 9, pts: [[330, -128], [214, -128], [104, -142]] },
];

// Streets that carry traffic (the plaza and the pedestrianised lanes do not).
export const CAR_ROUTES = STREETS.filter((s) => !s.ped);

// ---------------------------------------------------------------------------
// Perimeter frontage plan. Each side lists the runs of building between street
// mouths; the hero buildings claim named slots.
// ---------------------------------------------------------------------------
export const FRONTAGE = {
  north: { line: SQUARE.z0, axis: 'x', depth: 22, runs: [[-110, -66], [-54, 62], [78, 112]] },
  east:  { line: SQUARE.x1, axis: 'z', depth: 26, runs: [[-82, 26], [40, 82]] },
  south: { line: SQUARE.z1, axis: 'x', depth: 24, runs: [[-110, -58], [-46, 86]] },
  west:  { line: SQUARE.x0, axis: 'z', depth: 22, runs: [[-82, -40], [-28, 44], [58, 82]] },
};

// ---------------------------------------------------------------------------
// Terrain. The square is flat; the surrounding old town tilts gently, rising to
// the north-west and falling away to the south-east, quantised into 0.25 m
// voxel terraces.
// ---------------------------------------------------------------------------
const tn = makeNoise2D('cluj-terrain');

function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Distance outside the square footprint (0 inside). */
export function outsideSquare(x, z) {
  const dx = Math.max(SQUARE.x0 - x, 0, x - SQUARE.x1);
  const dz = Math.max(SQUARE.z0 - z, 0, z - SQUARE.z1);
  return Math.sqrt(dx * dx + dz * dz);
}

export function terrainRaw(x, z) {
  const tilt = -0.0092 * z - 0.0050 * x;
  const n = (tn.fbm(x / 210 + 11, z / 210 + 7, 3) - 0.5) * 3.2
          + (tn.fbm(x / 74 + 3, z / 74 + 19, 2) - 0.5) * 0.9;
  const blend = smoothstep(0, 46, outsideSquare(x, z));
  return (tilt + n) * blend;
}

export function terrainHeight(x, z) {
  return Math.round(terrainRaw(x, z) * 4) / 4;
}

// --- geometry helpers -------------------------------------------------------

export function distToSegment(px, pz, ax, az, bx, bz) {
  const vx = bx - ax, vz = bz - az;
  const wx = px - ax, wz = pz - az;
  const L = vx * vx + vz * vz;
  let t = L > 0 ? (wx * vx + wz * vz) / L : 0;
  t = Math.max(0, Math.min(1, t));
  const dx = px - (ax + vx * t), dz = pz - (az + vz * t);
  return Math.sqrt(dx * dx + dz * dz);
}

export function distToPolyline(px, pz, pts) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = distToSegment(px, pz, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
    if (d < best) best = d;
  }
  return best;
}

export function polylineLength(pts) {
  let L = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    L += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
  }
  return L;
}

/** Point and tangent at arc-length s along a polyline. */
export function polylineAt(pts, s) {
  let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const dx = pts[i + 1][0] - pts[i][0], dz = pts[i + 1][1] - pts[i][1];
    const L = Math.hypot(dx, dz);
    if (acc + L >= s || i === pts.length - 2) {
      const t = L > 0 ? Math.max(0, Math.min(1, (s - acc) / L)) : 0;
      return { x: pts[i][0] + dx * t, z: pts[i][1] + dz * t, dx: dx / (L || 1), dz: dz / (L || 1) };
    }
    acc += L;
  }
  return { x: pts[0][0], z: pts[0][1], dx: 1, dz: 0 };
}

/** Bounding box of a street polyline expanded by half its width. */
export function streetBounds(s, extra = 0) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const p of s.pts) {
    x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]);
    z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]);
  }
  const r = s.width / 2 + extra;
  return { x0: x0 - r, x1: x1 + r, z0: z0 - r, z1: z1 + r };
}

// ---------------------------------------------------------------------------
// Occupancy grid used to reserve building footprints without overlaps.
// ---------------------------------------------------------------------------
export class Occupancy {
  constructor(cell = 2) {
    this.cell = cell;
    this.w = Math.ceil((MAP.x1 - MAP.x0) / cell);
    this.h = Math.ceil((MAP.z1 - MAP.z0) / cell);
    this.grid = new Uint8Array(this.w * this.h);
  }
  idx(x, z) {
    const i = Math.floor((x - MAP.x0) / this.cell);
    const j = Math.floor((z - MAP.z0) / this.cell);
    if (i < 0 || j < 0 || i >= this.w || j >= this.h) return -1;
    return j * this.w + i;
  }
  markRect(x0, z0, x1, z1, v = 1) {
    const i0 = Math.max(0, Math.floor((x0 - MAP.x0) / this.cell));
    const i1 = Math.min(this.w - 1, Math.ceil((x1 - MAP.x0) / this.cell));
    const j0 = Math.max(0, Math.floor((z0 - MAP.z0) / this.cell));
    const j1 = Math.min(this.h - 1, Math.ceil((z1 - MAP.z0) / this.cell));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) this.grid[j * this.w + i] = v;
  }
  freeRect(x0, z0, x1, z1) {
    const i0 = Math.max(0, Math.floor((x0 - MAP.x0) / this.cell));
    const i1 = Math.min(this.w - 1, Math.ceil((x1 - MAP.x0) / this.cell));
    const j0 = Math.max(0, Math.floor((z0 - MAP.z0) / this.cell));
    const j1 = Math.min(this.h - 1, Math.ceil((z1 - MAP.z0) / this.cell));
    if (i1 < i0 || j1 < j0) return false;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (this.grid[j * this.w + i]) return false;
    return true;
  }
  at(x, z) { const i = this.idx(x, z); return i < 0 ? 1 : this.grid[i]; }
}

// ---------------------------------------------------------------------------
// Landmarks used by the label layer. Anchors are world positions.
// ---------------------------------------------------------------------------
export const LANDMARKS = [
  { id: 'church', text: '성 미하일 성당', sub: 'Biserica Sfântul Mihail', pos: [-22, 84, -26], priority: 10, maxDist: 1400 },
  { id: 'monument', text: '마차이 코르비누스 동상', sub: '마테이 코르빈', pos: [-20, 15.5, 14], priority: 9, maxDist: 900 },
  { id: 'banffy', text: '반피 궁전', sub: '미술관(Muzeul de Artă)', pos: [130, 27, -33], priority: 8, maxDist: 800 },
  { id: 'mirror', text: '미러 빌딩', sub: 'Palatele Statusului Romano-Catolic', pos: [128, 30, 33], priority: 8, maxDist: 800 },
  { id: 'continental', text: '구 호텔 콘티넨탈', sub: '구 뉴욕 호텔(New York Hotel)', pos: [-124, 29, 90], priority: 8, maxDist: 800 },
  { id: 'roman', text: '로마 나포카 발굴 창', sub: '고대 로마 발굴 전시', pos: [-44, 3.4, 27.5], priority: 6, maxDist: 420 },
  { id: 'fountain', text: '남쪽 분수대', pos: [27, 4.0, 47], priority: 5, maxDist: 500 },
  { id: 'townhall', text: '구 시청', sub: '카사 스파툴루이(Casa Sfatului)', pos: [-4, 24, 92], priority: 7, maxDist: 700 },
  { id: 'bank', text: '국립은행', pos: [46, 26, 94], priority: 6, maxDist: 620 },
  { id: 'rhedey', text: '레데이 궁전', pos: [-122, 24, -6], priority: 6, maxDist: 620 },
  { id: 'josika', text: '요시카 궁전', pos: [-122, 23, 24], priority: 5, maxDist: 560 },
  { id: 'hintz', text: '마우크시-힌츠 하우스', pos: [-42, 22, -92], priority: 6, maxDist: 620 },
  { id: 'kemeny', text: '케메니 궁전', pos: [10, 23, -92], priority: 5, maxDist: 560 },
  { id: 'rucska', text: '루치카 하우스', pos: [44, 22, -92], priority: 4, maxDist: 520 },
  { id: 'st-maniu', text: '이울리우 마니우 거리', street: true, pos: [168, 6, 32], priority: 4, maxDist: 620 },
  { id: 'st-eroilor', text: '에로이러르 대로', street: true, pos: [170, 6, 104], priority: 4, maxDist: 620 },
  { id: 'st-ferdinand', text: '레겔레 페르디난드 거리', street: true, pos: [74, 6, -150], priority: 4, maxDist: 620 },
  { id: 'st-memo', text: '메모란둘무루이 거리', street: true, pos: [-180, 6, -39], priority: 3, maxDist: 600 },
  { id: 'st-napoca', text: '나포카 거리', street: true, pos: [-176, 6, 66], priority: 3, maxDist: 600 },
  { id: 'st-corvin', text: '마테이 코르빈 거리', street: true, pos: [-60, 6, -120], priority: 3, maxDist: 560 },
  { id: 'st-univ', text: '우니베르시타치이 거리', street: true, pos: [-55, 6, 150], priority: 3, maxDist: 560 },
];
