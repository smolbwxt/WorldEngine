import type { WorldState, Location, Faction, WorldEvent } from './types.js';
import type { TerrainMap, TerrainType } from './terrain.js';
import { TERRAIN_COLORS } from './terrain.js';
import type { TownMap, TileType } from './townmap.js';
import type { BuildingInterior, InteriorTileType } from './buildings.js';

// ============================================================
// Artistic Map Generator — powered by Puter.js
//
// 1. Renders procedural terrain to a canvas PNG (spatial reference)
// 2. Builds a narrative prompt from the live WorldState
// 3. Sends both to an AI image model via Puter.js (img2img)
// 4. Returns the artistic map image
//
// No API key required — Puter.js handles auth transparently.
// ============================================================

const PUTER_MODEL = 'gemini-2.5-flash-image-preview';

// === SVG Terrain → Canvas PNG ===

export function renderTerrainToPNG(terrain: TerrainMap): Promise<string> {
  return new Promise((resolve, reject) => {
    const scale = 8; // 50×50 grid × 8 = 400×400 pixel image
    const canvas = document.createElement('canvas');
    canvas.width = terrain.width * scale;
    canvas.height = terrain.height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return reject(new Error('Canvas context unavailable'));

    // Draw terrain cells
    for (let gy = 0; gy < terrain.height; gy++) {
      for (let gx = 0; gx < terrain.width; gx++) {
        const cell = terrain.cells[gy][gx];
        ctx.fillStyle = TERRAIN_COLORS[cell.terrain];
        ctx.fillRect(gx * scale, gy * scale, scale, scale);
      }
    }

    // Draw rivers
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const path of terrain.rivers) {
      if (path.length < 2) continue;
      ctx.beginPath();
      ctx.strokeStyle = TERRAIN_COLORS.river;
      ctx.lineWidth = scale * 0.6;
      ctx.moveTo(
        path[0].x * scale + scale / 2,
        path[0].y * scale + scale / 2,
      );
      for (let i = 1; i < path.length; i++) {
        ctx.lineTo(
          path[i].x * scale + scale / 2,
          path[i].y * scale + scale / 2,
        );
      }
      ctx.stroke();
    }

    // Export as base64 JPEG (smaller than PNG for API transfer)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const base64 = dataUrl.split(',')[1];
    resolve(base64);
  });
}

// === Narrative Prompt Builder ===

function describeFactionState(f: Faction): string {
  const strength = f.power > f.maxPower * 0.7 ? 'strong' :
                   f.power > f.maxPower * 0.4 ? 'moderate' : 'weakened';
  const mood = f.morale > 70 ? 'confident' :
               f.morale > 40 ? 'uneasy' : 'desperate';
  return `${f.name} (${strength}, ${mood})`;
}

function describeRecentEvents(events: WorldEvent[], count: number): string {
  const recent = events.slice(-count);
  if (recent.length === 0) return 'an uneasy calm';
  return recent
    .map(e => e.narrative || e.text)
    .join('. ');
}

function describeConflictZones(state: WorldState): string {
  const zones: string[] = [];
  for (const f of Object.values(state.factions)) {
    for (const enemyId of f.enemies) {
      const enemy = state.factions[enemyId];
      if (!enemy) continue;
      for (const locId of f.controlledLocations) {
        const loc = state.locations[locId];
        if (!loc) continue;
        for (const adjId of loc.connectedTo) {
          if (enemy.controlledLocations.includes(adjId)) {
            zones.push(`${loc.name} (contested between ${f.name} and ${enemy.name})`);
          }
        }
      }
    }
  }
  return zones.length > 0 ? zones.slice(0, 3).join('; ') : 'no active frontlines';
}

function describeGeography(state: WorldState): string {
  const parts: string[] = [];
  const locs = Object.values(state.locations);

  const westernLocs = locs.filter(l => l.x < 30);
  const easternLocs = locs.filter(l => l.x > 65);
  const centralLocs = locs.filter(l => l.x >= 30 && l.x <= 65 && l.y >= 25 && l.y <= 60);

  if (westernLocs.length > 0) {
    parts.push(`Western frontier: mountains, mines, and fortifications (${westernLocs.map(l => l.name).join(', ')})`);
  }
  if (centralLocs.length > 0) {
    parts.push(`Central heartland: the capital and river crossings (${centralLocs.map(l => l.name).join(', ')})`);
  }
  if (easternLocs.length > 0) {
    parts.push(`Eastern coast: trade towns and farming communities (${easternLocs.map(l => l.name).join(', ')})`);
  }

  return parts.join('. ');
}

export function buildMapPrompt(state: WorldState): string {
  const factions = Object.values(state.factions);
  const factionSummary = factions.map(describeFactionState).join(', ');
  const recentNarrative = describeRecentEvents(state.eventLog, 5);
  const conflicts = describeConflictZones(state);
  const geography = describeGeography(state);

  const avgCorruption = factions.reduce((s, f) => s + f.corruption, 0) / factions.length;
  const totalPower = factions.reduce((s, f) => s + f.power, 0);
  const maxTotalPower = factions.reduce((s, f) => s + f.maxPower, 0);
  const powerRatio = totalPower / maxTotalPower;

  const mood = avgCorruption > 50 ? 'a land succumbing to corruption and decay' :
               powerRatio < 0.4 ? 'a land exhausted by war and famine' :
               powerRatio > 0.7 ? 'a land still holding together, but tensions simmer beneath' :
               'a land in the midst of upheaval and shifting alliances';

  const empire = state.factions['aurelian_crown'];
  const empireState = empire
    ? (empire.power < empire.maxPower * 0.3
      ? 'The Aurelian Empire is crumbling — its borders shrink and its authority fades.'
      : empire.power < empire.maxPower * 0.6
      ? 'The Aurelian Empire struggles to maintain order as rivals circle.'
      : 'The Aurelian Empire still commands respect, but cracks are forming.')
    : '';

  return [
    `Transform this procedural terrain map into a richly detailed, hand-painted fantasy cartographic illustration.`,
    ``,
    `Art style: Parchment-aged medieval cartography with watercolor washes. Tolkien-esque, with hand-drawn mountains, forests depicted as individual tree clusters, rivers with flowing brushstrokes, and ocean waves. Warm sepia and earth tones for land, deep indigo-blue for water. Include cartographic flourishes — a compass rose, aged paper texture, subtle staining.`,
    ``,
    `TERRAIN TILE LEGEND — the reference image uses these color-coded tiles:`,
    `  Dark blue (#0c1825) = Deep ocean/water`,
    `  Medium-dark blue (#132a40) = Shallow coastal water`,
    `  Sandy brown (#4a4030) = Sandy beaches/shores`,
    `  Dark olive-green (#2e3820) = Open plains`,
    `  Olive-green (#364225) = Grassland`,
    `  Dark brown-green (#243018) = Forest — render as individual tree clusters`,
    `  Very dark green (#1a2612) = Dense/old-growth forest — thick canopy, dark and ancient`,
    `  Warm brown (#48422e) = Rolling hills — gentle elevation changes`,
    `  Grey stone (#4a4a48) = Mountains — jagged peaks, snow-capped where high`,
    `  Light grey (#6a6a68) = Snow-covered terrain`,
    `  Dark swampy green (#252e1e) = Swamp/marshland — murky water, dead trees, fog`,
    `  Brownish (#332f20) = Moor/heathland — sparse, windswept`,
    `  Blue stripe (#1a3555) = River — flowing water connecting to coast`,
    ``,
    `CRITICAL INSTRUCTIONS:`,
    `  - DO NOT write any text, labels, names, or words on the map. No town names, no region names, no legend text, no title. The map must be purely visual with ZERO text of any kind.`,
    `  - Pay special attention to TOWN AND SETTLEMENT LOCATIONS — they appear as small colored dots/markers on the reference image. Render each one as a distinct cluster of tiny buildings, a castle, a village, or appropriate settlement based on the surrounding terrain. Make them visually prominent and easy to spot.`,
    `  - Faithfully follow the terrain tile colors from the legend above. Each tile type should be rendered as its real-world equivalent with rich detail — mountains should look like mountains, forests like forests, swamps like swamps. Do not flatten or simplify terrain differences.`,
    ``,
    `This is ${mood}. It is ${state.season} of Year ${state.year} (Turn ${state.turn}).`,
    empireState,
    ``,
    `The powers that shape this world: ${factionSummary}.`,
    `Active conflict zones: ${conflicts}.`,
    ``,
    `Geography: ${geography}.`,
    ``,
    `Recent events casting shadows across the land: ${recentNarrative}.`,
    ``,
    `IMPORTANT: Preserve the exact spatial layout of the reference image — coastlines, mountain positions, river paths, and forest regions must match. Add artistic detail, texture, and atmosphere, but do not rearrange the geography. The map should look like something a court cartographer would present to a worried king. Remember: absolutely NO TEXT on the map.`,
  ].join('\n');
}

// === Puter.js helpers ===

export interface MapGenResult {
  imageBase64: string;
  mimeType: string;
  prompt: string;
}

/** Ensure an HTMLImageElement is fully loaded before we read from it */
function waitForImageLoad(img: HTMLImageElement): Promise<HTMLImageElement> {
  if (img.complete && img.naturalWidth > 0) return Promise.resolve(img);
  return new Promise((resolve, reject) => {
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image failed to load'));
  });
}

/** Extract base64 data and mime type from an HTMLImageElement */
async function extractImageData(img: HTMLImageElement): Promise<{ base64: string; mimeType: string }> {
  const src = img.src;

  // Fast path: already a data URL
  const dataMatch = src.match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (dataMatch) {
    return { mimeType: dataMatch[1], base64: dataMatch[2] };
  }

  // For blob/remote URLs: wait for load, then draw to canvas
  await waitForImageLoad(img);

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  if (canvas.width === 0 || canvas.height === 0) {
    throw new Error('Image has zero dimensions — generation may have failed');
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context unavailable');
  ctx.drawImage(img, 0, 0);
  const dataUrl = canvas.toDataURL('image/png');
  const fallbackMatch = dataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (fallbackMatch) {
    return { mimeType: fallbackMatch[1], base64: fallbackMatch[2] };
  }
  throw new Error('Could not extract image data');
}

// === World Map Generation ===

export async function generateArtisticMap(
  terrain: TerrainMap,
  state: WorldState,
  userDescription?: string,
): Promise<MapGenResult> {
  const terrainBase64 = await renderTerrainToPNG(terrain);
  let prompt = buildMapPrompt(state);
  if (userDescription) prompt += `\n\nAdditional details: ${userDescription}`;

  const img = await puter.ai.txt2img(prompt, {
    model: PUTER_MODEL,
    input_image: terrainBase64,
    input_image_mime_type: 'image/jpeg',
  });

  const { base64, mimeType } = await extractImageData(img);
  return { imageBase64: base64, mimeType, prompt };
}

// ============================================================
// Location / Town Artistic Image Generation
// ============================================================

const TILE_COLORS: Record<TileType, string> = {
  road:             '#8B7355',
  building:         '#6B4C3B',
  market:           '#B8860B',
  tavern:           '#8B4513',
  temple:           '#D4C5A9',
  wall:             '#4A4A4A',
  gate:             '#7B6B4F',
  water:            '#2E5090',
  park:             '#3A6B35',
  ruins:            '#5C5040',
  tower:            '#5A5A6A',
  barracks:         '#5B3A29',
  warehouse:        '#6B5B4F',
  residential:      '#7B5B43',
  well:             '#4A7A8C',
  bridge:           '#8B7B6B',
  field:            '#6B8E3A',
  empty:            '#2A2520',
  keep:             '#6B6B8B',
  mine_entrance:    '#3A3A2A',
  smithy:           '#8B4500',
  stable:           '#6B5030',
  inn:              '#7B5A3A',
  graveyard:        '#3A4A3A',
  dungeon_entrance: '#1A1A2E',
};

export function renderTownMapToPNG(townMap: TownMap): string {
  const cellSize = 16;
  const canvas = document.createElement('canvas');
  canvas.width = townMap.width * cellSize;
  canvas.height = townMap.height * cellSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context unavailable');

  for (let y = 0; y < townMap.height; y++) {
    for (let x = 0; x < townMap.width; x++) {
      const tile = townMap.tiles[y][x];
      ctx.fillStyle = TILE_COLORS[tile.type] ?? '#2A2520';
      ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);
    }
  }

  ctx.font = `${cellSize * 0.6}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const poi of townMap.pointsOfInterest) {
    ctx.strokeStyle = '#d4a843';
    ctx.lineWidth = 2;
    ctx.strokeRect(poi.x * cellSize, poi.y * cellSize, cellSize, cellSize);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = `${cellSize * 0.5}px sans-serif`;
    ctx.fillText(
      poi.name.substring(0, 12),
      poi.x * cellSize + cellSize / 2,
      poi.y * cellSize - cellSize * 0.3,
    );
  }

  ctx.font = `bold ${cellSize * 0.8}px sans-serif`;
  ctx.fillStyle = 'rgba(232,213,183,0.4)';
  for (const d of townMap.districts) {
    ctx.fillText(
      d.name,
      (d.x + d.w / 2) * cellSize,
      (d.y + d.h / 2) * cellSize,
    );
  }

  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  return dataUrl.split(',')[1];
}

// === Location Prompt Builder ===

const LOCATION_TYPE_DESCRIPTIONS: Record<string, string> = {
  capital:  'a grand imperial capital city with marble colonnades, domed palaces, wide plazas, and imposing walls',
  fortress: 'a massive military fortress with thick stone walls, guard towers, and a garrison courtyard',
  castle:   'a noble castle with a keep, curtain walls, a great hall, and surrounding village',
  town:     'a busy medieval market town with timber-framed buildings, cobbled streets, and a town square',
  village:  'a small rural village with thatched-roof cottages, a village green, and farmland',
  ruins:    'crumbling ruins overgrown with vegetation, collapsed walls and broken towers',
  lair:     'a dark and foreboding monster lair — caves, crude fortifications, and an ominous entrance',
  temple:   'a serene monastery or temple with cloisters, a chapel, herb gardens, and stone walls',
  mine:     'a mountainside mining settlement with mine shaft entrances, ore carts, and worker barracks',
  tower:    'a solitary watchtower on a high ridge, weathered stone, signal beacon at the top',
  dungeon:  'a sinister dungeon entrance — a deep chasm or cave mouth leading into darkness',
};

function describeLocationSeason(season: string): string {
  switch (season) {
    case 'Spring': return 'spring light, fresh green growth, wildflowers, soft rain puddles';
    case 'Summer': return 'warm golden sunlight, long shadows, dusty roads, bright banners';
    case 'Autumn': return 'amber and russet leaves, grey skies, harvest bales, lantern-light';
    case 'Winter': return 'frost-covered rooftops, bare trees, snowdrifts, chimney smoke, grey overcast';
    default: return 'muted daylight';
  }
}

function describeLocationMood(loc: Location, state: WorldState): string {
  const parts: string[] = [];

  if (loc.prosperity > 60) {
    parts.push('The settlement thrives — well-maintained buildings, freshly painted signs, bustling activity.');
  } else if (loc.prosperity > 30) {
    parts.push('The settlement endures — functional but worn, some disrepair, quiet tension.');
  } else if (loc.prosperity > 0) {
    parts.push('The settlement decays — boarded windows, crumbling walls, empty market stalls, despair.');
  }

  if (loc.defense > 60) {
    parts.push('Heavy military presence: guards on every wall, fortifications reinforced, weapons stockpiled.');
  } else if (loc.defense > 30) {
    parts.push('Moderate defenses: a few guards patrol, walls are intact but not impressive.');
  } else if (loc.defense > 0) {
    parts.push('Barely defended — a broken gate, no guards in sight, vulnerable.');
  }

  if (loc.population > 3000) {
    parts.push('Crowded streets, merchants hawking wares, a cacophony of city life.');
  } else if (loc.population > 500) {
    parts.push('Modest foot traffic, a few market stalls, people going about their business.');
  } else if (loc.population > 0) {
    parts.push('Nearly deserted — a handful of souls, eerie quiet.');
  } else {
    parts.push('Completely abandoned — only the wind moves here.');
  }

  const localEvents = state.eventLog
    .filter(e => e.locationId === loc.id)
    .slice(-3);
  if (localEvents.length > 0) {
    parts.push('Recent events: ' + localEvents.map(e => e.narrative || e.text).join('. '));
  }

  return parts.join(' ');
}

export function buildLocationPrompt(loc: Location, state: WorldState): string {
  const controller = Object.values(state.factions).find(f =>
    f.controlledLocations.includes(loc.id)
  );
  const factionDesc = controller
    ? `Controlled by ${controller.name}. Their banners and colors (${describeFactionState(controller)}) are visible throughout.`
    : 'No faction controls this place — it is neutral or abandoned.';

  const typeDesc = LOCATION_TYPE_DESCRIPTIONS[loc.type] ?? 'a fantasy location';
  const seasonDesc = describeLocationSeason(state.season);
  const mood = describeLocationMood(loc, state);

  const rumors = loc.rumors.length > 0
    ? `Local rumors: ${loc.rumors.map(r => `"${r}"`).join('; ')}`
    : '';

  return [
    `Transform this procedural tile map of a fantasy settlement into a richly detailed fantasy illustration, as if painted by a master artist for a tabletop RPG campaign book.`,
    ``,
    `This is ${typeDesc}. ${loc.description}`,
    ``,
    `TILE LEGEND — the reference image uses these color-coded tiles:`,
    `  Brown (#8B7355) = Roads and paths`,
    `  Dark brown (#6B4C3B) = Buildings — render as distinct structures with roofs, walls, windows`,
    `  Gold (#B8860B) = Marketplace — stalls, awnings, merchant carts`,
    `  Reddish-brown (#8B4513) = Tavern/inn — welcoming, with signs and warm light`,
    `  Beige (#D4C5A9) = Temple — ornate, with spires or religious iconography`,
    `  Dark grey (#4A4A4A) = Walls — stone defensive walls`,
    `  Grey-brown (#7B6B4F) = Gates — openings in walls with archways`,
    `  Blue (#2E5090) = Water — rivers, ponds, wells`,
    `  Green (#3A6B35) = Parks/gardens — trees, grass, hedges`,
    `  Purple-grey (#5A5A6A) = Towers — tall stone structures`,
    `  Dark brown (#5B3A29) = Barracks — military buildings`,
    `  Olive-green (#6B8E3A) = Fields — farmland, crops`,
    `  Purple (#6B6B8B) = Keep/castle — the central fortification`,
    ``,
    `Art style: Detailed digital painting in a classic fantasy RPG style — warm lighting, rich textures, atmospheric depth. Think concept art for a Baldur's Gate or Pillars of Eternity game. Bird's-eye / isometric perspective showing the full layout of the settlement. Each building should be distinct and architecturally detailed. Include people, animals, carts, market activity where appropriate.`,
    ``,
    `CRITICAL: DO NOT write any text, labels, names, signs with readable words, or lettering anywhere in the image. No building names, no street names, no title. The illustration must be purely visual.`,
    ``,
    `Season and atmosphere: ${seasonDesc}. It is ${state.season} of Year ${state.year}.`,
    `${mood}`,
    ``,
    `${factionDesc}`,
    ``,
    rumors,
    ``,
    `IMPORTANT: Use the tile map reference image as a spatial guide for the layout — match the positions of roads, buildings, walls, gates, water features, and open areas. Faithfully transform each colored tile into its real-world equivalent using the legend above. Every building should look hand-crafted, not uniform. Add environmental storytelling — laundry on lines, carts in the road, torches in brackets, weathering on stone. Remember: NO TEXT anywhere in the image.`,
  ].join('\n');
}

// === Location Artistic Image Generation ===

export async function generateArtisticLocation(
  townMap: TownMap,
  loc: Location,
  state: WorldState,
  userDescription?: string,
): Promise<MapGenResult> {
  const townBase64 = renderTownMapToPNG(townMap);
  let prompt = buildLocationPrompt(loc, state);
  if (userDescription) prompt += `\n\nAdditional details: ${userDescription}`;

  const img = await puter.ai.txt2img(prompt, {
    model: PUTER_MODEL,
    input_image: townBase64,
    input_image_mime_type: 'image/jpeg',
  });

  const { base64, mimeType } = await extractImageData(img);
  return { imageBase64: base64, mimeType, prompt };
}

/** Generate a scene illustration for a location (text-only, no reference image) */
export async function generateLocationScene(
  loc: Location,
  state: WorldState,
  userDescription?: string,
): Promise<MapGenResult> {
  let prompt = buildLocationPrompt(loc, state);
  if (userDescription) prompt += `\n\nAdditional details: ${userDescription}`;

  const img = await puter.ai.txt2img(prompt, {
    model: PUTER_MODEL,
  });

  const { base64, mimeType } = await extractImageData(img);
  return { imageBase64: base64, mimeType, prompt };
}

// ============================================================
// Building Interior Artistic Generation
// ============================================================

const INTERIOR_TILE_COLORS: Record<InteriorTileType, string> = {
  floor_stone:     '#3A3830',
  floor_wood:      '#5C4A35',
  floor_dirt:      '#3A3225',
  wall:            '#2A2A28',
  wall_damaged:    '#3A3835',
  door:            '#6B5A40',
  door_locked:     '#5A4A35',
  pillar:          '#4A4A48',
  stairs_up:       '#5A6A5A',
  stairs_down:     '#3A3A4A',
  table:           '#6B5030',
  chair:           '#5A4528',
  counter:         '#6B5A3A',
  barrel:          '#5A4020',
  crate:           '#5A4828',
  bookshelf:       '#4A3520',
  altar:           '#8A8A7A',
  hearth:          '#8B3A10',
  fire_pit:        '#A04010',
  acid_pool:       '#2A6A30',
  pit_trap:        '#1A1A15',
  collapsed_floor: '#2A2520',
  rubble:          '#4A4538',
  water_shallow:   '#2A4A6A',
  bed:             '#5A4A60',
  chest:           '#6A5A20',
  weapon_rack:     '#4A4A5A',
  throne:          '#6A5A30',
  cage:            '#3A3A3A',
  sarcophagus:     '#5A5A58',
};

export function renderInteriorToPNG(interior: BuildingInterior): string {
  const cellSize = 24;
  const canvas = document.createElement('canvas');
  canvas.width = interior.width * cellSize;
  canvas.height = interior.height * cellSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context unavailable');

  for (let y = 0; y < interior.height; y++) {
    for (let x = 0; x < interior.width; x++) {
      const tile = interior.tiles[y][x];
      ctx.fillStyle = INTERIOR_TILE_COLORS[tile.type] ?? '#2A2520';
      ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);

      if (tile.isHazard) {
        ctx.fillStyle = 'rgba(255,0,0,0.3)';
        ctx.fillRect(x * cellSize + 2, y * cellSize + 2, cellSize - 4, cellSize - 4);
      }

      if (tile.blocksLOS && tile.type !== 'wall') {
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x * cellSize + 1, y * cellSize + 1, cellSize - 2, cellSize - 2);
      }

      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);
    }
  }

  ctx.font = `${cellSize * 0.4}px sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.textAlign = 'center';
  for (const poi of interior.pointsOfInterest) {
    ctx.fillText(poi.name.substring(0, 10), poi.x * cellSize + cellSize / 2, poi.y * cellSize - 2);
  }

  ctx.fillStyle = 'rgba(100,255,100,0.5)';
  for (const entry of interior.entryPoints) {
    ctx.fillRect(entry.x * cellSize + 4, entry.y * cellSize + 4, cellSize - 8, cellSize - 8);
  }

  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  return dataUrl.split(',')[1];
}

export function buildInteriorPrompt(interior: BuildingInterior, loc: Location, state: WorldState): string {
  const hazards = interior.tiles.flat().filter(t => t.isHazard);
  const hazardDesc = hazards.length > 0
    ? `Environmental hazards present: ${[...new Set(hazards.map(h => h.hazardType))].join(', ')}.`
    : '';

  const coverCount = interior.tiles.flat().filter(t => t.providesCover).length;
  const losBlockers = interior.tiles.flat().filter(t => t.blocksLOS && t.type !== 'wall').length;

  const controller = Object.values(state.factions).find(f => f.controlledLocations.includes(loc.id));
  const factionDesc = controller
    ? `This building bears the marks of ${controller.name} — their colors, banners, and style.`
    : '';

  return [
    `Transform this procedural building interior map of "${interior.name}" (inside ${loc.name}) into a detailed top-down tactical RPG battle map illustration.`,
    ``,
    `This is a ${interior.buildingType} interior. ${loc.description}`,
    ``,
    `Art style: Detailed top-down digital painting suitable for a tabletop RPG battle map. Rich textures for stone floors, wooden planks, dirt. Individual tiles should be visible as a grid. Warm lighting from torches and hearths. Shadows cast by pillars and furniture. Think Roll20 or Foundry VTT quality battle map.`,
    ``,
    `Combat-relevant details: ${coverCount} cover positions (tables, pillars, barrels), ${losBlockers} line-of-sight blockers. ${hazardDesc}`,
    ``,
    `Season: ${state.season}. ${factionDesc}`,
    ``,
    `IMPORTANT: Preserve the exact tile layout — walls, doors, furniture positions, and open spaces must match the reference. Add rich texture, lighting, and atmosphere but keep the spatial layout for tactical gameplay. Every tile should be clearly defined for grid-based combat.`,
  ].join('\n');
}

export async function generateArtisticInterior(
  interior: BuildingInterior,
  loc: Location,
  state: WorldState,
  userDescription?: string,
): Promise<MapGenResult> {
  const interiorBase64 = renderInteriorToPNG(interior);
  let prompt = buildInteriorPrompt(interior, loc, state);
  if (userDescription) prompt += `\n\nAdditional details: ${userDescription}`;

  const img = await puter.ai.txt2img(prompt, {
    model: PUTER_MODEL,
    input_image: interiorBase64,
    input_image_mime_type: 'image/jpeg',
  });

  const { base64, mimeType } = await extractImageData(img);
  return { imageBase64: base64, mimeType, prompt };
}
