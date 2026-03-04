import { SeededRNG } from './rng.js';
import type { Location } from './types.js';

// ============================================================
// Procedural Terrain Generator — "Rice Scatter" Method
//
// 1. Scatter seed points ("rice grains") across the map
// 2. Cluster nearby seeds into landmasses
// 3. Layer on elevation via noise + distance from coast
// 4. Assign biomes from elevation, latitude, moisture
// 5. Add rivers, lakes, and geographic features
// ============================================================

export type TerrainType =
  | 'deep_water'
  | 'shallow_water'
  | 'sand'
  | 'plains'
  | 'grassland'
  | 'forest'
  | 'dense_forest'
  | 'hills'
  | 'mountains'
  | 'snow'
  | 'swamp'
  | 'moor'
  | 'river';

export interface TerrainCell {
  terrain: TerrainType;
  elevation: number;    // 0–1
  moisture: number;     // 0–1
  x: number;
  y: number;
}

export interface TerrainMap {
  width: number;
  height: number;
  cellSize: number;
  cells: TerrainCell[][];
  rivers: { x: number; y: number }[][];
}

// Colors — muted, dark-fantasy parchment style
export const TERRAIN_COLORS: Record<TerrainType, string> = {
  deep_water:   '#0c1825',
  shallow_water:'#132a40',
  sand:         '#4a4030',
  plains:       '#2e3820',
  grassland:    '#364225',
  forest:       '#243018',
  dense_forest: '#1a2612',
  hills:        '#48422e',
  mountains:    '#4a4a48',
  snow:         '#6a6a68',
  swamp:        '#252e1e',
  moor:         '#332f20',
  river:        '#1a3555',
};

// Grid resolution: 2 SVG units per cell → 50×50 grid for 100×100 map
const CELL_SIZE = 2;
const GRID_W = 50;
const GRID_H = 50;

// === Value Noise ===

function hash2d(x: number, y: number, seed: number): number {
  let h = seed;
  h = Math.imul(h ^ (x * 374761393), 1103515245);
  h = Math.imul(h ^ (y * 668265263), 1103515245);
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

function smoothNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  // Smooth interpolation
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);

  const v00 = hash2d(ix, iy, seed);
  const v10 = hash2d(ix + 1, iy, seed);
  const v01 = hash2d(ix, iy + 1, seed);
  const v11 = hash2d(ix + 1, iy + 1, seed);

  const top = v00 + sx * (v10 - v00);
  const bot = v01 + sx * (v11 - v01);
  return top + sy * (bot - top);
}

/** Multi-octave value noise */
function fractalNoise(x: number, y: number, seed: number, octaves: number = 4): number {
  let val = 0;
  let amp = 1;
  let freq = 1;
  let max = 0;
  for (let i = 0; i < octaves; i++) {
    val += smoothNoise(x * freq, y * freq, seed + i * 1000) * amp;
    max += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return val / max;
}

// === Rice Scatter Method ===

interface Grain {
  x: number;
  y: number;
  weight: number;
}

function scatterRice(rng: SeededRNG, locations: Location[]): Grain[] {
  const grains: Grain[] = [];

  // Phase 1: scatter ~180 random grains, biased toward center
  for (let i = 0; i < 180; i++) {
    // Bias toward center of map for a single continent feel
    let x = rng.next() * 100;
    let y = rng.next() * 100;
    // Pull toward center
    x = x * 0.7 + 15;
    y = y * 0.7 + 15;
    // Slight random perturbation
    x += (rng.next() - 0.5) * 20;
    y += (rng.next() - 0.5) * 20;
    grains.push({ x, y, weight: 0.5 + rng.next() * 0.5 });
  }

  // Phase 2: cluster grains near populated locations (civilization = land)
  for (const loc of locations) {
    const count = loc.type === 'capital' ? 12 :
                  loc.type === 'town' ? 8 :
                  loc.type === 'fortress' || loc.type === 'castle' ? 6 :
                  4;
    for (let i = 0; i < count; i++) {
      const angle = rng.next() * Math.PI * 2;
      const dist = rng.next() * 8 + 2;
      grains.push({
        x: loc.x + Math.cos(angle) * dist,
        y: loc.y + Math.sin(angle) * dist,
        weight: 0.7 + rng.next() * 0.3,
      });
    }
  }

  return grains;
}

/** For each grid cell, measure "land density" from nearby rice grains */
function computeLandDensity(
  grains: Grain[],
  gx: number, gy: number,
  radius: number
): number {
  const wx = gx * CELL_SIZE + CELL_SIZE / 2;
  const wy = gy * CELL_SIZE + CELL_SIZE / 2;
  let density = 0;

  for (const g of grains) {
    const dx = wx - g.x;
    const dy = wy - g.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < radius) {
      // Falloff with distance
      const strength = (1 - dist / radius) * g.weight;
      density += strength;
    }
  }

  return density;
}

// === Terrain Assignment ===

function assignBiome(
  elevation: number,
  moisture: number,
  latitude: number,    // 0 = north, 1 = south
  isCoastal: boolean,
): TerrainType {
  if (elevation < 0.0) return 'deep_water';
  if (elevation < 0.08) return 'shallow_water';
  if (isCoastal && elevation < 0.15) return 'sand';

  if (elevation > 0.85) return 'snow';
  if (elevation > 0.7) return 'mountains';
  if (elevation > 0.55) return 'hills';

  // Lowland biomes by moisture + latitude
  if (moisture > 0.7 && elevation < 0.25) return 'swamp';
  if (moisture > 0.6) return 'dense_forest';
  if (moisture > 0.42) return 'forest';

  if (latitude > 0.7 && moisture < 0.3) return 'moor';
  if (moisture < 0.3) return 'plains';

  return 'grassland';
}

// === Feature Detection ===

function isWater(t: TerrainType): boolean {
  return t === 'deep_water' || t === 'shallow_water' || t === 'river';
}

function computeCoastDistance(landMask: boolean[][]): number[][] {
  const dist: number[][] = [];
  for (let y = 0; y < GRID_H; y++) {
    dist[y] = [];
    for (let x = 0; x < GRID_W; x++) {
      dist[y][x] = landMask[y][x] ? 999 : 0;
    }
  }

  // Simple BFS-like distance propagation
  let changed = true;
  while (changed) {
    changed = false;
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        if (dist[y][x] === 0) continue;
        let minNeighbor = dist[y][x];
        if (y > 0) minNeighbor = Math.min(minNeighbor, dist[y - 1][x] + 1);
        if (y < GRID_H - 1) minNeighbor = Math.min(minNeighbor, dist[y + 1][x] + 1);
        if (x > 0) minNeighbor = Math.min(minNeighbor, dist[y][x - 1] + 1);
        if (x < GRID_W - 1) minNeighbor = Math.min(minNeighbor, dist[y][x + 1] + 1);
        if (minNeighbor < dist[y][x]) {
          dist[y][x] = minNeighbor;
          changed = true;
        }
      }
    }
  }

  return dist;
}

// === River Generation ===

function generateRivers(
  elevation: number[][],
  landMask: boolean[][],
  rng: SeededRNG,
): { x: number; y: number }[][] {
  const rivers: { x: number; y: number }[][] = [];

  // Start rivers from moderate-high elevation, flow downhill to water
  const starts: { x: number; y: number; elev: number }[] = [];
  for (let y = 3; y < GRID_H - 3; y++) {
    for (let x = 3; x < GRID_W - 3; x++) {
      if (landMask[y][x] && elevation[y][x] > 0.45 && elevation[y][x] < 0.8) {
        starts.push({ x, y, elev: elevation[y][x] });
      }
    }
  }
  starts.sort((a, b) => b.elev - a.elev);

  // Generate 2-4 rivers
  const riverCount = Math.min(4, Math.max(2, Math.floor(starts.length / 20)));
  const used = new Set<string>();

  for (let r = 0; r < riverCount && r < starts.length; r++) {
    // Pick from top elevation candidates, spaced apart
    let start = starts[rng.int(0, Math.min(starts.length - 1, 12))];
    // Ensure river starts are spaced from each other
    let attempts = 0;
    while (attempts < 10) {
      const candidate = starts[rng.int(0, Math.min(starts.length - 1, 15))];
      let tooClose = false;
      for (const key of used) {
        const [ux, uy] = key.split(',').map(Number);
        if (Math.abs(candidate.x - ux) + Math.abs(candidate.y - uy) < 8) {
          tooClose = true;
          break;
        }
      }
      if (!tooClose) { start = candidate; break; }
      attempts++;
    }

    if (used.has(`${start.x},${start.y}`)) continue;

    const path: { x: number; y: number }[] = [{ x: start.x, y: start.y }];
    let cx = start.x, cy = start.y;
    let currentElev = elevation[cy][cx];
    const visited = new Set<string>();
    visited.add(`${cx},${cy}`);

    for (let step = 0; step < 120; step++) {
      // Collect all valid neighbors with a preference for downhill
      const candidates: { x: number; y: number; elev: number; score: number }[] = [];
      const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]];

      for (const [dx, dy] of dirs) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H) continue;
        if (visited.has(`${nx},${ny}`)) continue;
        const nElev = elevation[ny][nx];
        // Score: lower elevation = better. Allow slight uphill with penalty.
        let score = (currentElev - nElev) * 10; // positive = downhill
        // Penalize going uphill but allow it slightly
        if (nElev > currentElev) score -= 2;
        // Bonus for heading toward water (non-land)
        if (!landMask[ny][nx]) score += 5;
        // Small random jitter to avoid straight lines
        score += rng.next() * 1.5;
        candidates.push({ x: nx, y: ny, elev: nElev, score });
      }

      if (candidates.length === 0) break;

      // Pick the best-scoring candidate
      candidates.sort((a, b) => b.score - a.score);
      const chosen = candidates[0];

      cx = chosen.x;
      cy = chosen.y;
      currentElev = Math.min(currentElev, chosen.elev); // River carves downhill
      visited.add(`${cx},${cy}`);
      used.add(`${cx},${cy}`);
      path.push({ x: cx, y: cy });

      // Stop if we hit water
      if (!landMask[cy][cx]) break;
    }

    if (path.length > 5) rivers.push(path);
  }

  return rivers;
}

// === Main Generator ===

export function generateTerrain(locations: Location[], worldSeed: number = 42): TerrainMap {
  const rng = new SeededRNG(worldSeed);

  // Step 1: Scatter rice grains
  const grains = scatterRice(rng, locations);

  // Step 2: Compute land density + noise for each cell
  const density: number[][] = [];
  const landMask: boolean[][] = [];
  const rawElevation: number[][] = [];

  const landThreshold = 1.8;
  const radius = 14;

  for (let gy = 0; gy < GRID_H; gy++) {
    density[gy] = [];
    landMask[gy] = [];
    rawElevation[gy] = [];
    for (let gx = 0; gx < GRID_W; gx++) {
      const d = computeLandDensity(grains, gx, gy, radius);
      // Add noise to break up uniform shapes
      const noise = fractalNoise(gx * 0.15, gy * 0.15, worldSeed, 4) * 0.8;
      density[gy][gx] = d + noise;

      // Edge falloff — push edges toward water
      const edgeDist = Math.min(gx, gy, GRID_W - 1 - gx, GRID_H - 1 - gy);
      const edgeFalloff = Math.min(1, edgeDist / 5);

      landMask[gy][gx] = (density[gy][gx] * edgeFalloff) > landThreshold;
      rawElevation[gy][gx] = 0;
    }
  }

  // Ensure locations are on land
  for (const loc of locations) {
    const gx = Math.floor(loc.x / CELL_SIZE);
    const gy = Math.floor(loc.y / CELL_SIZE);
    // Fill a small area around each location
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = gx + dx, ny = gy + dy;
        if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H) {
          landMask[ny][nx] = true;
        }
      }
    }
  }

  // Step 3: Compute distance from coast (for elevation)
  const coastDist = computeCoastDistance(landMask);

  // Step 4: Compute elevation
  for (let gy = 0; gy < GRID_H; gy++) {
    for (let gx = 0; gx < GRID_W; gx++) {
      if (!landMask[gy][gx]) {
        // Underwater depth
        const edgeDist = Math.min(gx, gy, GRID_W - 1 - gx, GRID_H - 1 - gy);
        rawElevation[gy][gx] = -0.1 - (1 - Math.min(1, edgeDist / 8)) * 0.3;
        continue;
      }
      const cdist = coastDist[gy][gx];
      // Base elevation from coast distance
      let elev = Math.min(1, cdist / 12) * 0.6;
      // Add noise for variety
      elev += fractalNoise(gx * 0.12, gy * 0.12, worldSeed + 500, 5) * 0.4;
      // Mountain bias in the west (frontier)
      if (gx < GRID_W * 0.3) elev += 0.15;
      // Northern ridge
      if (gy < GRID_H * 0.25 && gx > GRID_W * 0.3 && gx < GRID_W * 0.7) elev += 0.1;

      rawElevation[gy][gx] = Math.max(0, Math.min(1, elev));
    }
  }

  // Ensure mine locations have high elevation
  for (const loc of locations) {
    if (loc.type === 'mine') {
      const gx = Math.floor(loc.x / CELL_SIZE);
      const gy = Math.floor(loc.y / CELL_SIZE);
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const nx = gx + dx, ny = gy + dy;
          if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H) {
            rawElevation[ny][nx] = Math.max(rawElevation[ny][nx], 0.6);
          }
        }
      }
    }
  }

  // Step 5: Compute moisture
  const moisture: number[][] = [];
  for (let gy = 0; gy < GRID_H; gy++) {
    moisture[gy] = [];
    for (let gx = 0; gx < GRID_W; gx++) {
      // Base moisture from proximity to water
      const cdist = coastDist[gy][gx];
      let m = Math.max(0, 1 - cdist / 10) * 0.5;
      // Add noise
      m += fractalNoise(gx * 0.1, gy * 0.1, worldSeed + 1000, 3) * 0.5;
      // Eastern side is wetter (coastal influence)
      if (gx > GRID_W * 0.65) m += 0.1;
      // Forest areas near Ashwood / Shepherd's Rest
      if (gx < GRID_W * 0.25 && gy > GRID_H * 0.4) m += 0.15;

      moisture[gy][gx] = Math.max(0, Math.min(1, m));
    }
  }

  // Add moisture around lake locations (Willowmere)
  for (const loc of locations) {
    if (loc.description.toLowerCase().includes('lake') || loc.name.toLowerCase().includes('mere')) {
      const gx = Math.floor(loc.x / CELL_SIZE);
      const gy = Math.floor(loc.y / CELL_SIZE);
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const nx = gx + dx, ny = gy + dy;
          if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H) {
            moisture[ny][nx] = Math.min(1, moisture[ny][nx] + 0.3);
            // Small lake
            if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && !(dx === 0 && dy === 0)) {
              landMask[ny][nx] = false;
              rawElevation[ny][nx] = -0.05;
            }
          }
        }
      }
      // Keep the location itself on land
      const lx = Math.floor(loc.x / CELL_SIZE);
      const ly = Math.floor(loc.y / CELL_SIZE);
      landMask[ly][lx] = true;
      rawElevation[ly][lx] = 0.12;
    }
  }

  // Step 6: Generate rivers
  const rivers = generateRivers(rawElevation, landMask, rng);

  // Mark river cells
  const riverSet = new Set<string>();
  for (const path of rivers) {
    for (const p of path) {
      if (landMask[p.y]?.[p.x]) {
        riverSet.add(`${p.x},${p.y}`);
        // Add moisture near rivers
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = p.x + dx, ny = p.y + dy;
            if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H) {
              moisture[ny][nx] = Math.min(1, moisture[ny][nx] + 0.2);
            }
          }
        }
      }
    }
  }

  // Step 7: Assign biomes
  const cells: TerrainCell[][] = [];
  for (let gy = 0; gy < GRID_H; gy++) {
    cells[gy] = [];
    for (let gx = 0; gx < GRID_W; gx++) {
      const elev = rawElevation[gy][gx];
      const moist = moisture[gy][gx];
      const lat = gy / GRID_H;  // 0=north, 1=south

      // Check if coastal (land cell adjacent to water)
      let coastal = false;
      if (landMask[gy][gx]) {
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const nx = gx + dx, ny = gy + dy;
          if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H || !landMask[ny][nx]) {
            coastal = true;
            break;
          }
        }
      }

      let terrain: TerrainType;
      if (riverSet.has(`${gx},${gy}`)) {
        terrain = 'river';
      } else {
        terrain = assignBiome(elev, moist, lat, coastal);
      }

      cells[gy][gx] = { terrain, elevation: elev, moisture: moist, x: gx, y: gy };
    }
  }

  return { width: GRID_W, height: GRID_H, cellSize: CELL_SIZE, cells, rivers };
}
