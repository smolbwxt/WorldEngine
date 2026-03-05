import type { WorldState, Location, Faction, WorldEvent } from './types.js';
import type { TerrainMap, TerrainType } from './terrain.js';
import { TERRAIN_COLORS } from './terrain.js';
import type { TownMap, TileType } from './townmap.js';

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

    // Add terrain annotations as colored labels for the AI to understand
    ctx.font = `${scale * 1.5}px sans-serif`;
    ctx.textAlign = 'center';
    const labeled = new Set<string>();
    const BIOME_LABELS: Partial<Record<TerrainType, string>> = {
      mountains: 'MTN',
      snow: 'SNOW',
      forest: 'FOREST',
      dense_forest: 'FOREST',
      swamp: 'SWAMP',
      moor: 'MOOR',
      plains: 'PLAINS',
    };

    for (let gy = 2; gy < terrain.height - 2; gy += 6) {
      for (let gx = 2; gx < terrain.width - 2; gx += 6) {
        const cell = terrain.cells[gy][gx];
        const label = BIOME_LABELS[cell.terrain];
        if (label && !labeled.has(label + Math.floor(gx / 12) + ',' + Math.floor(gy / 12))) {
          labeled.add(label + Math.floor(gx / 12) + ',' + Math.floor(gy / 12));
          ctx.fillStyle = 'rgba(255,255,255,0.4)';
          ctx.fillText(label, gx * scale + scale / 2, gy * scale + scale);
        }
      }
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
    `IMPORTANT: Preserve the exact spatial layout of the reference image — coastlines, mountain positions, river paths, and forest regions must match. Add artistic detail, texture, and atmosphere, but do not rearrange the geography. The map should look like something a court cartographer would present to a worried king.`,
  ].join('\n');
}

// === Puter.js helpers ===

export interface MapGenResult {
  imageBase64: string;
  mimeType: string;
  prompt: string;
}

/** Extract base64 data and mime type from an HTMLImageElement's data URL src */
function extractImageData(img: HTMLImageElement): { base64: string; mimeType: string } {
  const src = img.src;
  const match = src.match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (match) {
    return { mimeType: match[1], base64: match[2] };
  }
  // Fallback: draw to canvas to extract base64
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width || 512;
  canvas.height = img.naturalHeight || img.height || 512;
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
): Promise<MapGenResult> {
  const terrainBase64 = await renderTerrainToPNG(terrain);
  const prompt = buildMapPrompt(state);

  const img = await puter.ai.txt2img(prompt, {
    model: PUTER_MODEL,
    input_image: terrainBase64,
    input_image_mime_type: 'image/jpeg',
  });

  const { base64, mimeType } = extractImageData(img);
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
    `Transform this procedural tile map of "${loc.name}" into a richly detailed fantasy illustration, as if painted by a master artist for a tabletop RPG campaign book.`,
    ``,
    `This is ${typeDesc}. ${loc.description}`,
    ``,
    `Art style: Detailed digital painting in a classic fantasy RPG style — warm lighting, rich textures, atmospheric depth. Think concept art for a Baldur's Gate or Pillars of Eternity game. Bird's-eye / isometric perspective showing the full layout of the settlement. Each building should be distinct and architecturally detailed. Include people, animals, carts, market activity where appropriate.`,
    ``,
    `Season and atmosphere: ${seasonDesc}. It is ${state.season} of Year ${state.year}.`,
    `${mood}`,
    ``,
    `${factionDesc}`,
    ``,
    rumors,
    ``,
    `IMPORTANT: Use the tile map reference image as a spatial guide for the layout — match the positions of roads, buildings, walls, gates, water features, and open areas. Transform the flat colored tiles into a richly detailed overhead view with depth, shadows, and architectural detail. Every building should look hand-crafted, not uniform. Add environmental storytelling — laundry on lines, carts in the road, torches in brackets, weathering on stone.`,
  ].join('\n');
}

// === Location Artistic Image Generation ===

export async function generateArtisticLocation(
  townMap: TownMap,
  loc: Location,
  state: WorldState,
): Promise<MapGenResult> {
  const townBase64 = renderTownMapToPNG(townMap);
  const prompt = buildLocationPrompt(loc, state);

  const img = await puter.ai.txt2img(prompt, {
    model: PUTER_MODEL,
    input_image: townBase64,
    input_image_mime_type: 'image/jpeg',
  });

  const { base64, mimeType } = extractImageData(img);
  return { imageBase64: base64, mimeType, prompt };
}

/** Generate a scene illustration for a location (text-only, no reference image) */
export async function generateLocationScene(
  loc: Location,
  state: WorldState,
): Promise<MapGenResult> {
  const prompt = buildLocationPrompt(loc, state);

  const img = await puter.ai.txt2img(prompt, {
    model: PUTER_MODEL,
  });

  const { base64, mimeType } = extractImageData(img);
  return { imageBase64: base64, mimeType, prompt };
}
