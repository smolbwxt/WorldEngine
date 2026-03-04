import type { Location, LocationType } from './types.js';
import { SeededRNG } from './rng.js';

// ============================================================
// Procedural Town Map Generator
// Creates a navigable tile-based layout for any location.
// Deterministic — same location always produces the same map.
// ============================================================

export type TileType =
  | 'road'
  | 'building'
  | 'market'
  | 'tavern'
  | 'temple'
  | 'wall'
  | 'gate'
  | 'water'
  | 'park'
  | 'ruins'
  | 'tower'
  | 'barracks'
  | 'warehouse'
  | 'residential'
  | 'well'
  | 'bridge'
  | 'field'
  | 'empty'
  | 'keep'
  | 'mine_entrance'
  | 'smithy'
  | 'stable'
  | 'inn'
  | 'graveyard'
  | 'dungeon_entrance';

export interface Tile {
  type: TileType;
  label?: string;     // e.g. "The Rusty Anchor Inn", "North Gate"
  passable: boolean;
  x: number;
  y: number;
}

export interface PointOfInterest {
  x: number;
  y: number;
  name: string;
  type: TileType;
  description: string;
}

export interface TownMap {
  locationId: string;
  width: number;
  height: number;
  tiles: Tile[][];
  pointsOfInterest: PointOfInterest[];
  districts: District[];
}

export interface District {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

// Grid sizing by location type
function getGridSize(loc: Location): { w: number; h: number } {
  switch (loc.type) {
    case 'capital':   return { w: 28, h: 28 };
    case 'fortress':  return { w: 18, h: 18 };
    case 'castle':    return { w: 16, h: 16 };
    case 'town':      return { w: 22, h: 22 };
    case 'village':   return { w: 12, h: 12 };
    case 'ruins':     return { w: 14, h: 14 };
    case 'lair':      return { w: 12, h: 12 };
    case 'temple':    return { w: 14, h: 14 };
    case 'mine':      return { w: 12, h: 12 };
    case 'tower':     return { w: 10, h: 10 };
    case 'dungeon':   return { w: 16, h: 16 };
    default:          return { w: 14, h: 14 };
  }
}

/** Generate a deterministic town map for a location */
export function generateTownMap(loc: Location): TownMap {
  // Seed from location ID for determinism
  let seed = 0;
  for (let i = 0; i < loc.id.length; i++) {
    seed = ((seed << 5) - seed + loc.id.charCodeAt(i)) | 0;
  }
  const rng = new SeededRNG(Math.abs(seed));

  const { w, h } = getGridSize(loc);
  const tiles: Tile[][] = [];
  const pois: PointOfInterest[] = [];
  const districts: District[] = [];

  // Initialize empty grid
  for (let y = 0; y < h; y++) {
    tiles[y] = [];
    for (let x = 0; x < w; x++) {
      tiles[y][x] = { type: 'empty', passable: true, x, y };
    }
  }

  // Build based on location type
  switch (loc.type) {
    case 'capital':
      buildCapital(tiles, w, h, loc, rng, pois, districts);
      break;
    case 'fortress':
      buildFortress(tiles, w, h, loc, rng, pois, districts);
      break;
    case 'castle':
      buildCastle(tiles, w, h, loc, rng, pois, districts);
      break;
    case 'town':
      buildTown(tiles, w, h, loc, rng, pois, districts);
      break;
    case 'village':
      buildVillage(tiles, w, h, loc, rng, pois, districts);
      break;
    case 'ruins':
      buildRuins(tiles, w, h, loc, rng, pois, districts);
      break;
    case 'lair':
      buildLair(tiles, w, h, loc, rng, pois, districts);
      break;
    case 'temple':
      buildTemple(tiles, w, h, loc, rng, pois, districts);
      break;
    case 'mine':
      buildMine(tiles, w, h, loc, rng, pois, districts);
      break;
    case 'tower':
      buildTower(tiles, w, h, loc, rng, pois, districts);
      break;
    case 'dungeon':
      buildDungeon(tiles, w, h, loc, rng, pois, districts);
      break;
  }

  return { locationId: loc.id, width: w, height: h, tiles, pointsOfInterest: pois, districts };
}

// === Helpers ===

function setTile(tiles: Tile[][], x: number, y: number, type: TileType, label?: string) {
  if (y >= 0 && y < tiles.length && x >= 0 && x < tiles[0].length) {
    tiles[y][x] = {
      type,
      label,
      passable: type !== 'wall',
      x,
      y,
    };
  }
}

function fillRect(tiles: Tile[][], x1: number, y1: number, w: number, h: number, type: TileType, label?: string) {
  for (let y = y1; y < y1 + h; y++) {
    for (let x = x1; x < x1 + w; x++) {
      setTile(tiles, x, y, type, label);
    }
  }
}

function drawRoad(tiles: Tile[][], x1: number, y1: number, x2: number, y2: number) {
  // Horizontal then vertical
  const sx = Math.min(x1, x2), ex = Math.max(x1, x2);
  const sy = Math.min(y1, y2), ey = Math.max(y1, y2);
  for (let x = sx; x <= ex; x++) {
    setTile(tiles, x, y1, 'road');
  }
  for (let y = sy; y <= ey; y++) {
    setTile(tiles, x2, y, 'road');
  }
}

function drawWalls(tiles: Tile[][], x1: number, y1: number, w: number, h: number) {
  for (let x = x1; x < x1 + w; x++) {
    setTile(tiles, x, y1, 'wall');
    setTile(tiles, x, y1 + h - 1, 'wall');
  }
  for (let y = y1; y < y1 + h; y++) {
    setTile(tiles, x1, y, 'wall');
    setTile(tiles, x1 + w - 1, y, 'wall');
  }
}

function addPOI(pois: PointOfInterest[], x: number, y: number, name: string, type: TileType, desc: string) {
  pois.push({ x, y, name, type, description: desc });
}

function placeRandomBuildings(
  tiles: Tile[][],
  x1: number, y1: number, w: number, h: number,
  rng: SeededRNG,
  density: number
) {
  for (let y = y1; y < y1 + h; y++) {
    for (let x = x1; x < x1 + w; x++) {
      if (tiles[y]?.[x]?.type === 'empty' && rng.chance(density)) {
        setTile(tiles, x, y, 'residential');
      }
    }
  }
}

// Name generators
const TAVERN_NAMES = [
  'The Golden Flagon', 'The Rusty Anchor', 'The Weary Traveler',
  'The Prancing Pony', 'The Laughing Bear', 'The Silver Tankard',
  'The Red Rooster', 'The Sleeping Giant', 'The Broken Wheel',
  'The Merry Monk', 'The Iron Kettle', 'The Wandering Minstrel',
];

const SHOP_NAMES = [
  'General Goods', 'The Apothecary', 'Blacksmith\'s Forge',
  'Fletcher & Bowyer', 'Provisions', 'Chandler\'s Shop',
];

// === Location Type Builders ===

function buildCapital(
  tiles: Tile[][], w: number, h: number, loc: Location,
  rng: SeededRNG, pois: PointOfInterest[], districts: District[]
) {
  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2);

  // Outer walls
  drawWalls(tiles, 0, 0, w, h);
  // Gates
  setTile(tiles, cx, 0, 'gate', 'North Gate');
  addPOI(pois, cx, 0, 'North Gate', 'gate', 'Main northern entrance to the city');
  setTile(tiles, cx, h - 1, 'gate', 'South Gate');
  addPOI(pois, cx, h - 1, 'South Gate', 'gate', 'Southern entrance, leads to the countryside');
  setTile(tiles, 0, cy, 'gate', 'West Gate');
  addPOI(pois, 0, cy, 'West Gate', 'gate', 'Western gate toward the frontier');
  setTile(tiles, w - 1, cy, 'gate', 'East Gate');
  addPOI(pois, w - 1, cy, 'East Gate', 'gate', 'Eastern gate, trade road');

  // Main cross roads
  drawRoad(tiles, 1, cy, w - 2, cy);
  drawRoad(tiles, cx, 1, cx, h - 2);

  // Palace/Keep district (center-north)
  const keepX = cx - 3, keepY = 2;
  drawWalls(tiles, keepX, keepY, 7, 6);
  fillRect(tiles, keepX + 1, keepY + 1, 5, 4, 'keep', 'Imperial Palace');
  setTile(tiles, cx, keepY + 5, 'gate', 'Palace Gate');
  districts.push({ name: 'Palace District', x: keepX, y: keepY, w: 7, h: 6 });
  addPOI(pois, cx, keepY + 2, 'Imperial Palace', 'keep', 'Seat of Emperor Marius IV. Grand but crumbling.');

  // Market district (southeast)
  const mkX = cx + 2, mkY = cy + 2;
  fillRect(tiles, mkX, mkY, 6, 5, 'market');
  districts.push({ name: 'Market District', x: mkX, y: mkY, w: 6, h: 5 });
  addPOI(pois, mkX + 3, mkY + 2, 'Grand Market', 'market', 'Bustling marketplace — what\'s left of it.');

  // Temple district (southwest)
  const tmX = 2, tmY = cy + 2;
  fillRect(tiles, tmX, tmY, 4, 4, 'temple', 'Great Temple');
  setTile(tiles, tmX + 2, tmY + 4, 'road');
  districts.push({ name: 'Temple District', x: tmX, y: tmY, w: 4, h: 4 });
  addPOI(pois, tmX + 2, tmY + 2, 'Great Temple', 'temple', 'Ancient house of worship. A place of refuge for the weary.');

  // Barracks (northwest)
  fillRect(tiles, 2, 2, 4, 3, 'barracks', 'City Garrison');
  districts.push({ name: 'Military Quarter', x: 2, y: 2, w: 4, h: 3 });
  addPOI(pois, 4, 3, 'City Garrison', 'barracks', 'Undermanned and underfunded. The soldiers do their best.');

  // Tavern
  const tavName = rng.pick(TAVERN_NAMES);
  setTile(tiles, cx + 1, cy + 1, 'tavern', tavName);
  addPOI(pois, cx + 1, cy + 1, tavName, 'tavern', 'Popular gathering place near the crossroads.');

  // Inn
  setTile(tiles, cx - 2, cy - 1, 'inn', 'Pilgrim\'s Rest Inn');
  addPOI(pois, cx - 2, cy - 1, 'Pilgrim\'s Rest Inn', 'inn', 'Rooms for travelers. Has seen better days.');

  // Well
  setTile(tiles, cx, cy, 'well', 'Central Fountain');
  addPOI(pois, cx, cy, 'Central Fountain', 'well', 'Once-grand fountain at the crossroads. Still flows, barely.');

  // Fill residential
  placeRandomBuildings(tiles, 1, 9, cx - 2, h - 11, rng, 0.35);
  placeRandomBuildings(tiles, cx + 2, 2, w - cx - 4, cy - 3, rng, 0.3);
  placeRandomBuildings(tiles, cx + 8, cy + 2, w - cx - 10, h - cy - 4, rng, 0.25);
  districts.push({ name: 'Residential Quarter', x: 1, y: 9, w: cx - 2, h: h - 11 });

  // Graveyard (south)
  fillRect(tiles, 2, h - 4, 3, 2, 'graveyard', 'City Cemetery');
  addPOI(pois, 3, h - 3, 'City Cemetery', 'graveyard', 'Growing fuller each year.');
}

function buildFortress(
  tiles: Tile[][], w: number, h: number, _loc: Location,
  rng: SeededRNG, pois: PointOfInterest[], districts: District[]
) {
  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2);

  // Thick outer walls
  drawWalls(tiles, 0, 0, w, h);
  drawWalls(tiles, 1, 1, w - 2, h - 2);

  // Corner towers
  for (const [tx, ty, name] of [
    [1, 1, 'NW Tower'], [w - 2, 1, 'NE Tower'],
    [1, h - 2, 'SW Tower'], [w - 2, h - 2, 'SE Tower'],
  ] as [number, number, string][]) {
    setTile(tiles, tx, ty, 'tower', name);
    addPOI(pois, tx, ty, name, 'tower', 'Watchtower with commanding view.');
  }

  // Single gate (south)
  setTile(tiles, cx, h - 1, 'gate', 'Main Gate');
  setTile(tiles, cx, h - 2, 'gate');
  addPOI(pois, cx, h - 1, 'Main Gate', 'gate', 'Heavily fortified entrance. Reinforced ironwood doors.');

  // Main road from gate to keep
  drawRoad(tiles, cx, 3, cx, h - 3);
  drawRoad(tiles, 3, cy, w - 3, cy);

  // Central keep
  drawWalls(tiles, cx - 2, 2, 5, 4);
  fillRect(tiles, cx - 1, 3, 3, 2, 'keep', 'Central Keep');
  setTile(tiles, cx, 5, 'gate');
  districts.push({ name: 'The Keep', x: cx - 2, y: 2, w: 5, h: 4 });
  addPOI(pois, cx, 4, 'Central Keep', 'keep', 'Heart of the fortress. Commander\'s quarters above.');

  // Barracks (west)
  fillRect(tiles, 3, 3, 3, 3, 'barracks', 'Barracks');
  districts.push({ name: 'Barracks', x: 3, y: 3, w: 3, h: 3 });
  addPOI(pois, 4, 4, 'Garrison Barracks', 'barracks', 'Bunks for the soldiers. Spartan but functional.');

  // Armory / smithy
  setTile(tiles, w - 4, 4, 'smithy', 'Armory');
  addPOI(pois, w - 4, 4, 'Armory & Smithy', 'smithy', 'Weapons and armor. The forge burns day and night.');

  // Stable
  setTile(tiles, 3, h - 4, 'stable', 'Stables');
  addPOI(pois, 3, h - 4, 'Stables', 'stable', 'Warhorses and supply mounts.');

  // Well
  setTile(tiles, cx, cy, 'well', 'Courtyard Well');
  addPOI(pois, cx, cy, 'Courtyard Well', 'well', 'Critical water supply.');

  placeRandomBuildings(tiles, 3, cy + 1, w - 6, h - cy - 4, rng, 0.2);
}

function buildCastle(
  tiles: Tile[][], w: number, h: number, _loc: Location,
  rng: SeededRNG, pois: PointOfInterest[], districts: District[]
) {
  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2);

  // Walls
  drawWalls(tiles, 1, 1, w - 2, h - 2);
  setTile(tiles, cx, h - 2, 'gate', 'Castle Gate');
  addPOI(pois, cx, h - 2, 'Castle Gate', 'gate', 'Arched gate with portcullis.');

  // Main road
  drawRoad(tiles, cx, 3, cx, h - 3);

  // Keep (top center)
  fillRect(tiles, cx - 2, 2, 5, 3, 'keep', 'Lord\'s Keep');
  districts.push({ name: 'The Keep', x: cx - 2, y: 2, w: 5, h: 3 });
  addPOI(pois, cx, 3, 'Lord\'s Keep', 'keep', 'The lord\'s residence and great hall.');

  // Small courtyard
  setTile(tiles, cx, cy, 'well', 'Courtyard');
  addPOI(pois, cx, cy, 'Courtyard Well', 'well', 'Open courtyard with a stone well.');

  // Tavern
  const tavName = rng.pick(TAVERN_NAMES);
  setTile(tiles, cx + 2, cy + 2, 'tavern', tavName);
  addPOI(pois, cx + 2, cy + 2, tavName, 'tavern', 'Where the off-duty guards drink.');

  // Barracks
  fillRect(tiles, 2, 2, 3, 2, 'barracks', 'Guard Barracks');
  addPOI(pois, 3, 3, 'Guard Barracks', 'barracks', 'Quarters for the castle guard.');

  // Chapel
  setTile(tiles, w - 4, 3, 'temple', 'Castle Chapel');
  addPOI(pois, w - 4, 3, 'Castle Chapel', 'temple', 'Small chapel. Candles always burning.');

  // Stable
  setTile(tiles, 3, h - 4, 'stable', 'Stables');
  addPOI(pois, 3, h - 4, 'Stables', 'stable', 'Horses and a grumpy stablehand.');

  placeRandomBuildings(tiles, 2, cy, cx - 3, h - cy - 3, rng, 0.3);
  placeRandomBuildings(tiles, cx + 2, cy - 2, w - cx - 4, 4, rng, 0.25);
  districts.push({ name: 'Servants\' Quarter', x: 2, y: cy, w: cx - 3, h: h - cy - 3 });
}

function buildTown(
  tiles: Tile[][], w: number, h: number, loc: Location,
  rng: SeededRNG, pois: PointOfInterest[], districts: District[]
) {
  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2);

  // Walls if defense > 20
  if (loc.defense > 20) {
    drawWalls(tiles, 0, 0, w, h);
    setTile(tiles, cx, 0, 'gate', 'North Gate');
    setTile(tiles, cx, h - 1, 'gate', 'South Gate');
    setTile(tiles, 0, cy, 'gate', 'West Gate');
    addPOI(pois, cx, 0, 'North Gate', 'gate', 'Northern town entrance.');
    addPOI(pois, cx, h - 1, 'South Gate', 'gate', 'Southern entrance.');
  }

  // Main roads
  drawRoad(tiles, 1, cy, w - 2, cy);
  drawRoad(tiles, cx, 1, cx, h - 2);

  // Central market square
  fillRect(tiles, cx - 2, cy - 2, 5, 5, 'market');
  setTile(tiles, cx, cy, 'well', 'Town Square Fountain');
  districts.push({ name: 'Market Square', x: cx - 2, y: cy - 2, w: 5, h: 5 });
  addPOI(pois, cx, cy, 'Town Square', 'well', 'Heart of the town. Market days are lively.');

  // Tavern
  const tavName = rng.pick(TAVERN_NAMES);
  setTile(tiles, cx + 3, cy - 1, 'tavern', tavName);
  addPOI(pois, cx + 3, cy - 1, tavName, 'tavern', 'The town\'s favorite watering hole.');

  // Inn
  setTile(tiles, cx - 3, cy + 1, 'inn', 'Traveler\'s Inn');
  addPOI(pois, cx - 3, cy + 1, 'Traveler\'s Inn', 'inn', 'Clean beds, warm meals, fair prices.');

  // Temple
  setTile(tiles, cx - 1, 2, 'temple', 'Town Chapel');
  setTile(tiles, cx, 2, 'temple');
  addPOI(pois, cx - 1, 2, 'Town Chapel', 'temple', 'Modest but well-tended place of worship.');

  // Smithy
  setTile(tiles, cx + 3, cy + 3, 'smithy', 'Blacksmith');
  addPOI(pois, cx + 3, cy + 3, 'Blacksmith', 'smithy', 'The ring of hammer on anvil. Practical work.');

  // Warehouse
  setTile(tiles, 2, h - 3, 'warehouse', 'Warehouse');
  setTile(tiles, 3, h - 3, 'warehouse');
  addPOI(pois, 2, h - 3, 'Trade Warehouse', 'warehouse', 'Goods awaiting transport or sale.');

  // Residential fill
  placeRandomBuildings(tiles, 1, 1, cx - 2, cy - 2, rng, 0.35);
  placeRandomBuildings(tiles, cx + 3, 1, w - cx - 4, cy - 2, rng, 0.3);
  placeRandomBuildings(tiles, 1, cy + 3, w - 2, h - cy - 5, rng, 0.3);
  districts.push({ name: 'Residential Area', x: 1, y: 1, w: cx - 2, h: cy - 2 });
}

function buildVillage(
  tiles: Tile[][], w: number, h: number, _loc: Location,
  rng: SeededRNG, pois: PointOfInterest[], _districts: District[]
) {
  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2);

  // Simple dirt road through the middle
  drawRoad(tiles, 0, cy, w - 1, cy);

  // Village green / well
  setTile(tiles, cx, cy, 'well', 'Village Well');
  addPOI(pois, cx, cy, 'Village Well', 'well', 'Gathering spot. News and gossip traded here.');

  // Small chapel
  setTile(tiles, cx + 2, cy - 2, 'temple', 'Village Chapel');
  addPOI(pois, cx + 2, cy - 2, 'Village Chapel', 'temple', 'Tiny chapel. The heart of village life.');

  // Tavern/inn
  const tavName = rng.pick(TAVERN_NAMES);
  setTile(tiles, cx - 2, cy - 1, 'tavern', tavName);
  addPOI(pois, cx - 2, cy - 1, tavName, 'tavern', 'More common room than proper tavern.');

  // Scatter houses
  placeRandomBuildings(tiles, 1, 1, w - 2, cy - 1, rng, 0.2);
  placeRandomBuildings(tiles, 1, cy + 1, w - 2, h - cy - 2, rng, 0.2);

  // Fields at edges
  fillRect(tiles, 0, 0, 3, 3, 'field');
  fillRect(tiles, w - 3, h - 3, 3, 3, 'field');
}

function buildRuins(
  tiles: Tile[][], w: number, h: number, _loc: Location,
  rng: SeededRNG, pois: PointOfInterest[], _districts: District[]
) {
  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2);

  // Broken walls (gaps)
  drawWalls(tiles, 1, 1, w - 2, h - 2);
  // Collapse sections
  for (let i = 0; i < 8; i++) {
    const x = rng.int(1, w - 2);
    const y = rng.int(1, h - 2);
    if (tiles[y][x].type === 'wall') {
      setTile(tiles, x, y, 'ruins', 'Collapsed Wall');
    }
  }

  // Ruined buildings
  for (let i = 0; i < 6; i++) {
    const rx = rng.int(2, w - 4);
    const ry = rng.int(2, h - 4);
    setTile(tiles, rx, ry, 'ruins');
    setTile(tiles, rx + 1, ry, 'ruins');
  }

  // Overgrown road
  drawRoad(tiles, 1, cy, w - 2, cy);
  // Break up the road
  for (let x = 1; x < w - 1; x++) {
    if (rng.chance(0.3)) setTile(tiles, x, cy, 'empty');
  }

  // Central ruin
  fillRect(tiles, cx - 1, cy - 1, 3, 3, 'ruins', 'Ruined Hall');
  addPOI(pois, cx, cy, 'Ruined Hall', 'ruins', 'Whatever stood here once was important. Now it\'s rubble and memory.');

  // Something interesting buried
  const sx = rng.int(2, w - 3);
  const sy = rng.int(2, h - 3);
  setTile(tiles, sx, sy, 'well', 'Old Cellar');
  addPOI(pois, sx, sy, 'Old Cellar Entrance', 'well', 'A hole in the ground, stairs descending into darkness.');
}

function buildLair(
  tiles: Tile[][], w: number, h: number, _loc: Location,
  rng: SeededRNG, pois: PointOfInterest[], districts: District[]
) {
  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2);

  // Cave walls (irregular)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const distFromCenter = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (distFromCenter > Math.min(w, h) / 2 - 1) {
        setTile(tiles, x, y, 'wall');
      }
    }
  }

  // Entrance
  setTile(tiles, cx, h - 2, 'gate', 'Cave Mouth');
  setTile(tiles, cx, h - 1, 'empty');
  addPOI(pois, cx, h - 2, 'Cave Entrance', 'gate', 'Gaping cave mouth. The stench is considerable.');

  // Central chamber
  fillRect(tiles, cx - 2, cy - 2, 5, 4, 'empty');
  addPOI(pois, cx, cy, 'Main Chamber', 'empty', 'Large cavern. Crude totems and campfire remains.');
  districts.push({ name: 'Main Chamber', x: cx - 2, y: cy - 2, w: 5, h: 4 });

  // Tunnels
  drawRoad(tiles, cx, cy + 2, cx, h - 2);
  drawRoad(tiles, 3, cy, cx - 2, cy);

  // Side chambers
  fillRect(tiles, 2, cy - 2, 3, 3, 'empty');
  addPOI(pois, 3, cy - 1, 'Chieftain\'s Den', 'empty', 'Larger side chamber. Crude throne of bones.');

  placeRandomBuildings(tiles, cx - 3, 2, 7, cy - 3, rng, 0.15);
}

function buildTemple(
  tiles: Tile[][], w: number, h: number, _loc: Location,
  rng: SeededRNG, pois: PointOfInterest[], districts: District[]
) {
  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2);

  // Low walls
  drawWalls(tiles, 1, 1, w - 2, h - 2);
  setTile(tiles, cx, h - 2, 'gate', 'Monastery Gate');
  addPOI(pois, cx, h - 2, 'Monastery Gate', 'gate', 'Open to all who seek shelter or healing.');

  // Path from gate to temple
  drawRoad(tiles, cx, 3, cx, h - 3);

  // Main temple
  fillRect(tiles, cx - 2, 2, 5, 4, 'temple', 'Main Chapel');
  districts.push({ name: 'Chapel', x: cx - 2, y: 2, w: 5, h: 4 });
  addPOI(pois, cx, 4, 'Chapel', 'temple', 'Peaceful stone chapel. Light streams through stained glass.');

  // Gardens
  fillRect(tiles, 2, 3, 3, 3, 'park', 'Herb Garden');
  addPOI(pois, 3, 4, 'Herb Garden', 'park', 'Medicinal herbs tended by the brothers and sisters.');

  // Hospice
  setTile(tiles, w - 4, 4, 'building', 'Hospice');
  setTile(tiles, w - 4, 5, 'building');
  addPOI(pois, w - 4, 4, 'Hospice', 'building', 'The sick and wounded find care here.');

  // Well
  setTile(tiles, cx, cy + 1, 'well', 'Blessed Spring');
  addPOI(pois, cx, cy + 1, 'Blessed Spring', 'well', 'Clear, cold water. Locals say it has healing properties.');

  // Monk quarters
  placeRandomBuildings(tiles, 2, cy, w - 4, h - cy - 3, rng, 0.25);
  districts.push({ name: 'Living Quarters', x: 2, y: cy, w: w - 4, h: h - cy - 3 });

  // Graveyard
  fillRect(tiles, w - 4, h - 4, 2, 2, 'graveyard', 'Memorial Garden');
  addPOI(pois, w - 3, h - 3, 'Memorial Garden', 'graveyard', 'Peaceful resting place. Well-tended graves.');
}

function buildMine(
  tiles: Tile[][], w: number, h: number, _loc: Location,
  rng: SeededRNG, pois: PointOfInterest[], _districts: District[]
) {
  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2);

  // Surface area (top half)
  drawRoad(tiles, 0, cy, w - 1, cy);

  // Mine entrance
  setTile(tiles, cx, cy, 'mine_entrance', 'Mine Entrance');
  addPOI(pois, cx, cy, 'Main Shaft Entrance', 'mine_entrance', 'Wooden frame supports. Rumbling from below.');

  // Surface buildings
  setTile(tiles, cx - 3, cy - 1, 'building', 'Foreman\'s Office');
  addPOI(pois, cx - 3, cy - 1, 'Foreman\'s Office', 'building', 'Where the shifts are managed.');

  setTile(tiles, cx + 2, cy - 2, 'smithy', 'Tool Shed');
  addPOI(pois, cx + 2, cy - 2, 'Tool Shed', 'smithy', 'Picks, shovels, lanterns.');

  setTile(tiles, cx - 2, cy - 3, 'warehouse', 'Ore Storage');
  addPOI(pois, cx - 2, cy - 3, 'Ore Storage', 'warehouse', 'Raw ore awaiting transport.');

  // Tunnels below (bottom half)
  drawRoad(tiles, cx, cy + 1, cx, h - 2);
  drawRoad(tiles, 2, cy + 3, w - 3, cy + 3);
  drawRoad(tiles, 3, cy + 3, 3, h - 2);
  drawRoad(tiles, w - 4, cy + 3, w - 4, h - 2);

  // Cave-ins / danger
  const dangerX = rng.int(2, w - 3);
  setTile(tiles, dangerX, h - 2, 'ruins', 'Collapsed Tunnel');
  addPOI(pois, dangerX, h - 2, 'Collapsed Tunnel', 'ruins', 'Recent cave-in. Workers are nervous.');

  // Worker camp
  placeRandomBuildings(tiles, 1, 1, w - 2, cy - 2, rng, 0.15);

  const tavName = rng.pick(TAVERN_NAMES);
  setTile(tiles, cx + 3, 2, 'tavern', tavName);
  addPOI(pois, cx + 3, 2, tavName, 'tavern', 'Miners drink here after long shifts.');
}

function buildTower(
  tiles: Tile[][], w: number, h: number, _loc: Location,
  rng: SeededRNG, pois: PointOfInterest[], _districts: District[]
) {
  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2);

  // The tower itself (center)
  drawWalls(tiles, cx - 2, cy - 2, 5, 5);
  fillRect(tiles, cx - 1, cy - 1, 3, 3, 'tower', 'Watch Tower');
  setTile(tiles, cx, cy + 2, 'gate', 'Tower Door');
  addPOI(pois, cx, cy, 'Watch Tower', 'tower', 'Stone signal tower. Fire beacon at the top.');
  addPOI(pois, cx, cy + 2, 'Tower Door', 'gate', 'Heavy iron-bound door.');

  // Path to tower
  drawRoad(tiles, cx, cy + 3, cx, h - 1);

  // Small outbuilding
  setTile(tiles, cx - 3, cy + 1, 'stable', 'Small Stable');
  setTile(tiles, cx + 3, cy, 'building', 'Supply Shed');

  placeRandomBuildings(tiles, 1, 1, w - 2, cy - 3, rng, 0.05);
}

function buildDungeon(
  tiles: Tile[][], w: number, h: number, _loc: Location,
  rng: SeededRNG, pois: PointOfInterest[], districts: District[]
) {
  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2);

  // Fill with walls, carve out rooms
  fillRect(tiles, 0, 0, w, h, 'wall');

  // Entrance
  setTile(tiles, cx, 0, 'dungeon_entrance', 'Entrance');
  setTile(tiles, cx, 1, 'road');
  addPOI(pois, cx, 0, 'Dungeon Entrance', 'dungeon_entrance', 'A yawning crack in the earth. Cold air rises from below.');

  // Main corridor
  drawRoad(tiles, cx, 1, cx, h - 2);

  // Rooms
  const rooms: { x: number; y: number; w: number; h: number; name: string }[] = [
    { x: 2, y: 2, w: 4, h: 3, name: 'Entry Chamber' },
    { x: w - 6, y: 3, w: 4, h: 3, name: 'Guard Room' },
    { x: 2, y: cy - 1, w: 5, h: 4, name: 'Great Hall' },
    { x: w - 6, y: cy, w: 4, h: 3, name: 'Prison Cells' },
    { x: cx - 3, y: h - 5, w: 7, h: 4, name: 'Deep Chamber' },
  ];

  for (const room of rooms) {
    fillRect(tiles, room.x, room.y, room.w, room.h, 'empty');
    drawRoad(tiles, cx, room.y + 1, room.x + Math.floor(room.w / 2), room.y + 1);
    districts.push({ name: room.name, x: room.x, y: room.y, w: room.w, h: room.h });
    addPOI(pois, room.x + Math.floor(room.w / 2), room.y + Math.floor(room.h / 2),
      room.name, 'empty', '');
  }

  // Add descriptions to POIs
  const descs = [
    'Rubble-strewn chamber. Something passed through recently.',
    'Old iron shackles on the wall. Long abandoned.',
    'Vast dark space. The ceiling is lost in shadow.',
    'Rusted cages. An unsettling silence.',
    'The deepest point. Ancient carvings cover the walls.',
  ];
  pois.forEach((p, i) => { if (i > 0 && !p.description) p.description = descs[i - 1] ?? ''; });

  // Random debris
  for (let i = 0; i < 4; i++) {
    const rx = rng.int(2, w - 3);
    const ry = rng.int(2, h - 3);
    if (tiles[ry][rx].type === 'empty') {
      setTile(tiles, rx, ry, 'ruins', 'Rubble');
    }
  }
}
