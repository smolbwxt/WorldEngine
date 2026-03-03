import type { WorldState, Faction, Location } from './types.js';
import { SEASONS } from './types.js';
import factionsData from '../data/factions.json';
import locationsData from '../data/locations.json';

export function createInitialWorldState(seed?: number): WorldState {
  const factions: Record<string, Faction> = {};
  for (const f of factionsData as unknown as Faction[]) {
    factions[f.id] = { ...f };
  }

  const locations: Record<string, Location> = {};
  for (const l of locationsData as unknown as Location[]) {
    locations[l.id] = { ...l };
  }

  return {
    turn: 0,
    year: 1,
    season: 'Spring',
    factions,
    locations,
    eventLog: [],
    storyBeatsTriggered: [],
    rngSeed: seed ?? Date.now(),
  };
}

export function advanceSeason(state: WorldState): void {
  state.turn += 1;
  const seasonIndex = SEASONS.indexOf(state.season);
  const nextIndex = (seasonIndex + 1) % 4;
  state.season = SEASONS[nextIndex];
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
