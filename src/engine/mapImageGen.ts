import type { WorldState, Faction, WorldEvent } from './types.js';
import type { TerrainMap, TerrainType } from './terrain.js';
import { TERRAIN_COLORS } from './terrain.js';

// ============================================================
// Artistic Map Generator
//
// 1. Renders procedural terrain to a canvas PNG (spatial reference)
// 2. Builds a narrative prompt from the live WorldState
// 3. Sends both to Nano Banana 2 (Gemini) as img2img
// 4. Returns the artistic map image
// ============================================================

const GEMINI_MODEL = 'gemini-3.1-flash-image-preview';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

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
      // Find overlapping or adjacent territories
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

  // Find region descriptions
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

  // Determine the overall mood
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

// === Gemini API Call ===

export interface MapGenResult {
  imageBase64: string;
  mimeType: string;
  prompt: string;
}

export async function generateArtisticMap(
  terrain: TerrainMap,
  state: WorldState,
  apiKey: string,
): Promise<MapGenResult> {
  // Step 1: Render terrain to PNG
  const terrainBase64 = await renderTerrainToPNG(terrain);

  // Step 2: Build narrative prompt
  const prompt = buildMapPrompt(state);

  // Step 3: Call Gemini API
  const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: 'image/jpeg',
              data: terrainBase64,
            },
          },
        ],
      }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: {
          aspectRatio: '1:1',
          imageSize: '1K',
        },
      },
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errBody}`);
  }

  const data = await response.json();

  // Extract image from response
  const candidate = data.candidates?.[0];
  if (!candidate) throw new Error('No candidates in Gemini response');

  const parts = candidate.content?.parts ?? [];
  const imagePart = parts.find((p: { inline_data?: unknown }) => p.inline_data);
  if (!imagePart?.inline_data) {
    throw new Error('No image in Gemini response. Text: ' + parts.map((p: { text?: string }) => p.text).filter(Boolean).join(' '));
  }

  return {
    imageBase64: imagePart.inline_data.data,
    mimeType: imagePart.inline_data.mimeType || 'image/png',
    prompt,
  };
}
