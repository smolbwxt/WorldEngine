import { SeededRNG } from './rng.js';
import type { TileType, PointOfInterest } from './townmap.js';

// ============================================================
// Building Interior Map Generator
//
// Generates a tile-based interior suitable for tactical combat:
// - LOS blockers (pillars, walls, furniture)
// - Environmental hazards (fire pits, acid pools, collapsed floor)
// - Cover positions
// - Entry/exit points
// ============================================================

export type InteriorTileType =
  | 'floor_stone'
  | 'floor_wood'
  | 'floor_dirt'
  | 'wall'
  | 'wall_damaged'
  | 'door'
  | 'door_locked'
  | 'pillar'
  | 'stairs_up'
  | 'stairs_down'
  | 'table'
  | 'chair'
  | 'counter'         // bar counter, shop counter
  | 'barrel'
  | 'crate'
  | 'bookshelf'
  | 'altar'
  | 'hearth'          // fireplace — hazard: fire damage adjacent
  | 'fire_pit'        // open flame — hazard
  | 'acid_pool'       // hazard
  | 'pit_trap'        // hidden hazard
  | 'collapsed_floor' // hazard: fall damage
  | 'rubble'          // difficult terrain, partial cover
  | 'water_shallow'   // difficult terrain
  | 'bed'
  | 'chest'
  | 'weapon_rack'
  | 'throne'
  | 'cage'
  | 'sarcophagus';

export interface InteriorTile {
  type: InteriorTileType;
  passable: boolean;
  blocksLOS: boolean;      // blocks line of sight
  isHazard: boolean;       // deals damage or has negative effect
  hazardType?: 'fire' | 'acid' | 'fall' | 'trap';
  hazardDamage?: number;   // damage dealt per turn
  providesCover: boolean;  // half-cover for adjacent units
  label?: string;
  x: number;
  y: number;
}

export interface BuildingInterior {
  width: number;
  height: number;
  tiles: InteriorTile[][];
  pointsOfInterest: InteriorPOI[];
  entryPoints: { x: number; y: number }[];
  buildingType: string;
  name: string;
}

export interface InteriorPOI {
  x: number;
  y: number;
  name: string;
  description: string;
}

// === Tile Properties ===

const TILE_PROPS: Record<InteriorTileType, { passable: boolean; blocksLOS: boolean; providesCover: boolean; isHazard: boolean }> = {
  floor_stone:     { passable: true,  blocksLOS: false, providesCover: false, isHazard: false },
  floor_wood:      { passable: true,  blocksLOS: false, providesCover: false, isHazard: false },
  floor_dirt:      { passable: true,  blocksLOS: false, providesCover: false, isHazard: false },
  wall:            { passable: false, blocksLOS: true,  providesCover: true,  isHazard: false },
  wall_damaged:    { passable: false, blocksLOS: true,  providesCover: true,  isHazard: false },
  door:            { passable: true,  blocksLOS: false, providesCover: false, isHazard: false },
  door_locked:     { passable: false, blocksLOS: true,  providesCover: false, isHazard: false },
  pillar:          { passable: false, blocksLOS: true,  providesCover: true,  isHazard: false },
  stairs_up:       { passable: true,  blocksLOS: false, providesCover: false, isHazard: false },
  stairs_down:     { passable: true,  blocksLOS: false, providesCover: false, isHazard: false },
  table:           { passable: false, blocksLOS: false, providesCover: true,  isHazard: false },
  chair:           { passable: true,  blocksLOS: false, providesCover: false, isHazard: false },
  counter:         { passable: false, blocksLOS: false, providesCover: true,  isHazard: false },
  barrel:          { passable: false, blocksLOS: true,  providesCover: true,  isHazard: false },
  crate:           { passable: false, blocksLOS: true,  providesCover: true,  isHazard: false },
  bookshelf:       { passable: false, blocksLOS: true,  providesCover: true,  isHazard: false },
  altar:           { passable: false, blocksLOS: false, providesCover: true,  isHazard: false },
  hearth:          { passable: false, blocksLOS: false, providesCover: false, isHazard: true },
  fire_pit:        { passable: true,  blocksLOS: false, providesCover: false, isHazard: true },
  acid_pool:       { passable: true,  blocksLOS: false, providesCover: false, isHazard: true },
  pit_trap:        { passable: true,  blocksLOS: false, providesCover: false, isHazard: true },
  collapsed_floor: { passable: true,  blocksLOS: false, providesCover: false, isHazard: true },
  rubble:          { passable: true,  blocksLOS: false, providesCover: true,  isHazard: false },
  water_shallow:   { passable: true,  blocksLOS: false, providesCover: false, isHazard: false },
  bed:             { passable: false, blocksLOS: false, providesCover: true,  isHazard: false },
  chest:           { passable: false, blocksLOS: false, providesCover: true,  isHazard: false },
  weapon_rack:     { passable: false, blocksLOS: false, providesCover: true,  isHazard: false },
  throne:          { passable: false, blocksLOS: false, providesCover: true,  isHazard: false },
  cage:            { passable: false, blocksLOS: false, providesCover: true,  isHazard: false },
  sarcophagus:     { passable: false, blocksLOS: true,  providesCover: true,  isHazard: false },
};

function makeTile(type: InteriorTileType, x: number, y: number): InteriorTile {
  const props = TILE_PROPS[type];
  const tile: InteriorTile = { type, x, y, ...props };
  if (type === 'hearth' || type === 'fire_pit') {
    tile.hazardType = 'fire';
    tile.hazardDamage = 2;
  } else if (type === 'acid_pool') {
    tile.hazardType = 'acid';
    tile.hazardDamage = 3;
  } else if (type === 'pit_trap') {
    tile.hazardType = 'trap';
    tile.hazardDamage = 4;
  } else if (type === 'collapsed_floor') {
    tile.hazardType = 'fall';
    tile.hazardDamage = 5;
  }
  return tile;
}

// === Layout Generators ===

type LayoutFn = (w: number, h: number, rng: SeededRNG) => { tiles: InteriorTileType[][]; pois: InteriorPOI[] };

function fillFloor(w: number, h: number, floor: InteriorTileType = 'floor_stone'): InteriorTileType[][] {
  const tiles: InteriorTileType[][] = [];
  for (let y = 0; y < h; y++) {
    tiles[y] = [];
    for (let x = 0; x < w; x++) {
      // Outer walls
      if (x === 0 || x === w - 1 || y === 0 || y === h - 1) {
        tiles[y][x] = 'wall';
      } else {
        tiles[y][x] = floor;
      }
    }
  }
  return tiles;
}

function addRoom(tiles: InteriorTileType[][], rx: number, ry: number, rw: number, rh: number, floor: InteriorTileType = 'floor_stone'): void {
  for (let y = ry; y < ry + rh && y < tiles.length; y++) {
    for (let x = rx; x < rx + rw && x < tiles[0].length; x++) {
      if (x === rx || x === rx + rw - 1 || y === ry || y === ry + rh - 1) {
        if (tiles[y][x] !== 'door') tiles[y][x] = 'wall';
      } else {
        tiles[y][x] = floor;
      }
    }
  }
}

function placeDoor(tiles: InteriorTileType[][], x: number, y: number): void {
  if (y >= 0 && y < tiles.length && x >= 0 && x < tiles[0].length) {
    tiles[y][x] = 'door';
  }
}

const layoutTavern: LayoutFn = (w, h, rng) => {
  const tiles = fillFloor(w, h, 'floor_wood');
  const pois: InteriorPOI[] = [];

  // Bar counter along the back wall
  const barY = 2;
  for (let x = 2; x < w - 4; x++) {
    tiles[barY][x] = 'counter';
  }
  pois.push({ x: Math.floor(w / 2), y: barY, name: 'The Bar', description: 'A well-worn counter stained with decades of spilled ale' });

  // Tables scattered around
  for (let i = 0; i < 4; i++) {
    const tx = rng.int(2, w - 3);
    const ty = rng.int(4, h - 3);
    if (tiles[ty][tx] === 'floor_wood') {
      tiles[ty][tx] = 'table';
      // Chairs around table
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const cx = tx + dx, cy = ty + dy;
        if (cy > 0 && cy < h - 1 && cx > 0 && cx < w - 1 && tiles[cy][cx] === 'floor_wood') {
          tiles[cy][cx] = 'chair';
        }
      }
    }
  }

  // Hearth
  const hx = w - 2, hy = Math.floor(h / 2);
  if (tiles[hy][hx] !== 'wall') tiles[hy][hx] = 'hearth';
  pois.push({ x: hx, y: hy, name: 'Fireplace', description: 'A roaring hearth that fills the room with warmth and flickering shadows' });

  // Back room with barrels
  addRoom(tiles, w - 5, 1, 5, 4, 'floor_wood');
  placeDoor(tiles, w - 5, 2);
  tiles[2][w - 3] = 'barrel';
  tiles[3][w - 3] = 'barrel';
  tiles[2][w - 2] = 'crate';

  // Stairs up to rooms
  tiles[h - 2][1] = 'stairs_up';
  pois.push({ x: 1, y: h - 2, name: 'Stairs Up', description: 'Narrow stairs leading to rooms for rent on the upper floor' });

  return { tiles, pois };
};

const layoutTemple: LayoutFn = (w, h, rng) => {
  const tiles = fillFloor(w, h, 'floor_stone');
  const pois: InteriorPOI[] = [];

  // Central nave with pillars
  const pillarSpacing = 3;
  for (let y = 3; y < h - 3; y += pillarSpacing) {
    tiles[y][3] = 'pillar';
    tiles[y][w - 4] = 'pillar';
  }

  // Altar at the far end
  const altarX = Math.floor(w / 2), altarY = 2;
  tiles[altarY][altarX] = 'altar';
  pois.push({ x: altarX, y: altarY, name: 'Sacred Altar', description: 'An ancient altar carved from a single block of white marble' });

  // Side rooms
  addRoom(tiles, 1, 1, 4, 4, 'floor_stone');
  placeDoor(tiles, 4, 2);
  tiles[2][2] = 'bookshelf';
  pois.push({ x: 2, y: 2, name: 'Scriptorium', description: 'Shelves of holy texts and scholarly works' });

  addRoom(tiles, w - 5, 1, 4, 4, 'floor_stone');
  placeDoor(tiles, w - 5, 2);
  tiles[2][w - 3] = 'chest';

  // Candle hazards near altar
  if (rng.chance(0.5)) {
    tiles[altarY + 1][altarX - 1] = 'fire_pit';
    tiles[altarY + 1][altarX + 1] = 'fire_pit';
  }

  return { tiles, pois };
};

const layoutBarracks: LayoutFn = (w, h, rng) => {
  const tiles = fillFloor(w, h, 'floor_stone');
  const pois: InteriorPOI[] = [];

  // Rows of beds
  for (let y = 2; y < h - 2; y += 2) {
    for (let x = 2; x < Math.floor(w / 2) - 1; x += 2) {
      tiles[y][x] = 'bed';
    }
  }

  // Weapon racks along one wall
  for (let y = 2; y < h - 2; y += 2) {
    tiles[y][w - 2] = 'weapon_rack';
  }
  pois.push({ x: w - 2, y: 2, name: 'Armory', description: 'Racks of swords, spears, and shields' });

  // Training area in center
  pois.push({ x: Math.floor(w / 2) + 1, y: Math.floor(h / 2), name: 'Training Floor', description: 'Open space with scuff marks from daily drills' });

  // Chest for valuables
  tiles[h - 2][1] = 'chest';
  if (rng.chance(0.3)) tiles[h - 2][2] = 'chest';

  return { tiles, pois };
};

const layoutCatacombs: LayoutFn = (w, h, rng) => {
  const tiles = fillFloor(w, h, 'floor_dirt');
  const pois: InteriorPOI[] = [];

  // Fill with walls, carve out corridors
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      tiles[y][x] = 'wall';
    }
  }

  // Main corridor
  const midY = Math.floor(h / 2);
  for (let x = 1; x < w - 1; x++) {
    tiles[midY][x] = 'floor_dirt';
    tiles[midY - 1][x] = 'floor_dirt';
  }

  // Branch corridors
  for (let x = 3; x < w - 3; x += rng.int(3, 5)) {
    const dir = rng.chance(0.5) ? -1 : 1;
    for (let dy = 0; dy < rng.int(2, 5); dy++) {
      const y = midY + dir * dy;
      if (y > 0 && y < h - 1) {
        tiles[y][x] = 'floor_dirt';
        tiles[y][x + 1] = 'floor_dirt';
      }
    }
    // Burial alcoves
    const endY = midY + dir * rng.int(3, 5);
    if (endY > 1 && endY < h - 2) {
      tiles[endY][x] = 'sarcophagus';
      if (rng.chance(0.4)) {
        pois.push({ x, y: endY, name: 'Ancient Tomb', description: 'A sealed stone sarcophagus bearing worn inscriptions' });
      }
    }
  }

  // Hazards
  for (let i = 0; i < 3; i++) {
    const hx = rng.int(2, w - 3);
    const hy = rng.int(2, h - 3);
    if (tiles[hy][hx] === 'floor_dirt') {
      tiles[hy][hx] = rng.chance(0.5) ? 'collapsed_floor' : 'pit_trap';
    }
  }

  // Stairs
  tiles[midY][1] = 'stairs_up';
  tiles[midY][w - 2] = 'stairs_down';
  pois.push({ x: w - 2, y: midY, name: 'Deeper Passage', description: 'Stairs descending into absolute darkness' });

  return { tiles, pois };
};

const layoutDungeon: LayoutFn = (w, h, rng) => {
  const tiles = fillFloor(w, h, 'floor_stone');
  const pois: InteriorPOI[] = [];

  // Fill, then carve rooms
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      tiles[y][x] = 'wall';
    }
  }

  // Central chamber
  const cx = Math.floor(w / 2), cy = Math.floor(h / 2);
  addRoom(tiles, cx - 3, cy - 3, 7, 7, 'floor_stone');

  // Side rooms connected by corridors
  const rooms: { x: number; y: number; w: number; h: number }[] = [];
  for (let i = 0; i < 4; i++) {
    const rw = rng.int(3, 5), rh = rng.int(3, 5);
    const rx = rng.int(2, w - rw - 2);
    const ry = rng.int(2, h - rh - 2);
    addRoom(tiles, rx, ry, rw, rh, 'floor_stone');
    rooms.push({ x: rx, y: ry, w: rw, h: rh });

    // Carve corridor to center
    let curX = rx + Math.floor(rw / 2);
    let curY = ry + Math.floor(rh / 2);
    while (curX !== cx) {
      tiles[curY][curX] = 'floor_stone';
      curX += curX < cx ? 1 : -1;
    }
    while (curY !== cy) {
      tiles[curY][curX] = 'floor_stone';
      curY += curY < cy ? 1 : -1;
    }
  }

  // Hazards in the rooms
  for (const room of rooms) {
    if (rng.chance(0.4)) {
      const hx = room.x + rng.int(1, room.w - 2);
      const hy = room.y + rng.int(1, room.h - 2);
      const hazard = rng.pick(['acid_pool', 'fire_pit', 'pit_trap', 'collapsed_floor'] as InteriorTileType[]);
      tiles[hy][hx] = hazard;
    }
    // Some cages or sarcophagi
    if (rng.chance(0.3)) {
      const fx = room.x + 1;
      const fy = room.y + 1;
      tiles[fy][fx] = rng.chance(0.5) ? 'cage' : 'sarcophagus';
      pois.push({ x: fx, y: fy, name: tiles[fy][fx] === 'cage' ? 'Iron Cage' : 'Stone Tomb', description: tiles[fy][fx] === 'cage' ? 'A rusted cage, its occupant long gone' : 'A sealed tomb that radiates cold' });
    }
  }

  // Entrance
  tiles[cy][1] = 'stairs_up';
  pois.push({ x: 1, y: cy, name: 'Entrance', description: 'The way back to the surface' });

  // Boss area in center
  tiles[cy][cx] = 'throne';
  pois.push({ x: cx, y: cy, name: 'The Dark Throne', description: 'A crude throne fashioned from bone and iron' });

  return { tiles, pois };
};

const layoutGeneric: LayoutFn = (w, h, rng) => {
  const tiles = fillFloor(w, h, 'floor_stone');
  const pois: InteriorPOI[] = [];

  // A few pillars for cover
  for (let i = 0; i < 3; i++) {
    const px = rng.int(3, w - 4);
    const py = rng.int(3, h - 4);
    tiles[py][px] = 'pillar';
  }

  // Some furniture
  for (let i = 0; i < 4; i++) {
    const fx = rng.int(2, w - 3);
    const fy = rng.int(2, h - 3);
    if (tiles[fy][fx] === 'floor_stone') {
      tiles[fy][fx] = rng.pick(['table', 'barrel', 'crate', 'chest'] as InteriorTileType[]);
    }
  }

  // A rubble patch
  if (rng.chance(0.4)) {
    const rx = rng.int(2, w - 4);
    const ry = rng.int(2, h - 4);
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 2; dx++) {
        if (tiles[ry + dy][rx + dx] === 'floor_stone') {
          tiles[ry + dy][rx + dx] = 'rubble';
        }
      }
    }
  }

  return { tiles, pois };
};

// Map building types to layout generators
const LAYOUT_MAP: Record<string, LayoutFn> = {
  tavern: layoutTavern,
  inn: layoutTavern,
  temple: layoutTemple,
  barracks: layoutBarracks,
  keep: layoutDungeon,
  dungeon_entrance: layoutDungeon,
  graveyard: layoutCatacombs,
};

// === Main Generator ===

export function generateBuildingInterior(
  poi: PointOfInterest,
  locationId: string,
): BuildingInterior {
  // Deterministic seed from POI name + location
  let seed = 0;
  for (let i = 0; i < (poi.name + locationId).length; i++) {
    seed = ((seed << 5) - seed + (poi.name + locationId).charCodeAt(i)) | 0;
  }
  const rng = new SeededRNG(Math.abs(seed));

  const w = 16;
  const h = 12;

  const layoutFn = LAYOUT_MAP[poi.type] ?? layoutGeneric;
  const { tiles: rawTiles, pois } = layoutFn(w, h, rng);

  // Convert to InteriorTile objects
  const tiles: InteriorTile[][] = [];
  for (let y = 0; y < h; y++) {
    tiles[y] = [];
    for (let x = 0; x < w; x++) {
      tiles[y][x] = makeTile(rawTiles[y][x], x, y);
    }
  }

  // Find entry points (doors on outer walls)
  const entryPoints: { x: number; y: number }[] = [];
  for (let x = 0; x < w; x++) {
    if (tiles[0][x].type === 'door') entryPoints.push({ x, y: 0 });
    if (tiles[h - 1][x].type === 'door') entryPoints.push({ x, y: h - 1 });
  }
  for (let y = 0; y < h; y++) {
    if (tiles[y][0].type === 'door') entryPoints.push({ x: 0, y });
    if (tiles[y][w - 1].type === 'door') entryPoints.push({ x: w - 1, y });
  }

  // Ensure at least one entry
  if (entryPoints.length === 0) {
    const doorY = Math.floor(h / 2);
    tiles[doorY][0] = makeTile('door', 0, doorY);
    entryPoints.push({ x: 0, y: doorY });
  }

  return {
    width: w,
    height: h,
    tiles,
    pointsOfInterest: pois,
    entryPoints,
    buildingType: poi.type,
    name: poi.name,
  };
}
