import type { WorldState, Faction, Location, Character, WorldDefinition } from './types.js';
import { SEASONS } from './types.js';
import { AURELIAN_PRESET } from '../data/presets/aurelian.js';

/**
 * Create initial world state from a WorldDefinition (or default to Aurelian preset).
 * Supports legacy call: createInitialWorldState(42) — uses Aurelian preset with seed 42.
 * New call: createInitialWorldState(definition, seed)
 */
export function createInitialWorldState(seedOrDef?: number | WorldDefinition, seed?: number): WorldState {
  let definition: WorldDefinition;
  let rngSeed: number;

  if (typeof seedOrDef === 'object' && seedOrDef !== null) {
    definition = seedOrDef;
    rngSeed = seed ?? Date.now();
  } else {
    definition = AURELIAN_PRESET;
    rngSeed = seedOrDef ?? Date.now();
  }

  const factions: Record<string, Faction> = {};
  for (const f of definition.factions) {
    factions[f.id] = {
      ...f,
      tags: [...(f.tags ?? [])],
      treaties: [...(f.treaties ?? [])],
      alliances: [...(f.alliances ?? [])],
      enemies: [...(f.enemies ?? [])],
      controlledLocations: [...(f.controlledLocations ?? [])],
      recentActions: [...(f.recentActions ?? [])],
      leaderTraits: [...(f.leaderTraits ?? [])],
      goals: [...(f.goals ?? [])],
      relationships: { ...(f.relationships ?? {}) },
    };
  }

  const locations: Record<string, Location> = {};
  for (const l of definition.locations) {
    locations[l.id] = { ...l };
  }

  const characters: Record<string, Character> = {};
  for (const c of definition.characters) {
    characters[c.id] = { ...c, abilities: [...c.abilities] };
  }

  const seasonNames = definition.meta.seasonNames ?? SEASONS;
  const startingSeason = definition.meta.startingSeason ?? seasonNames[0];

  return {
    turn: 0,
    year: 1,
    season: startingSeason,
    factions,
    locations,
    characters,
    activeTreaties: [],
    eventLog: [],
    storyBeatsTriggered: [],
    rngSeed,
    definition,
  };
}

export function advanceSeason(state: WorldState): void {
  const seasonNames = state.definition?.meta.seasonNames ?? SEASONS;
  state.turn += 1;
  const seasonIndex = seasonNames.indexOf(state.season);
  const nextIndex = (seasonIndex + 1) % seasonNames.length;
  state.season = seasonNames[nextIndex];
  if (nextIndex === 0) {
    state.year += 1;
  }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function applyFactionChanges(
  faction: Faction,
  changes: Partial<Faction>
): void {
  if (changes.power !== undefined) faction.power = clamp(changes.power, 0, faction.maxPower);
  if (changes.morale !== undefined) faction.morale = clamp(changes.morale, 0, 100);
  if (changes.gold !== undefined) faction.gold = Math.max(0, changes.gold);
  if (changes.corruption !== undefined) faction.corruption = clamp(changes.corruption, 0, 100);
}

export function applyLocationChanges(
  location: Location,
  changes: Partial<Location>
): void {
  if (changes.population !== undefined) location.population = Math.max(0, changes.population);
  if (changes.defense !== undefined) location.defense = clamp(changes.defense, 0, 100);
  if (changes.prosperity !== undefined) location.prosperity = clamp(changes.prosperity, 0, 100);
}

export function serializeWorldState(state: WorldState): string {
  return JSON.stringify(state, null, 2);
}

export function deserializeWorldState(json: string): WorldState {
  return JSON.parse(json) as WorldState;
}
