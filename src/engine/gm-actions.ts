// ============================================================
// Game Master Actions API
//
// Clean API for live state mutations during gameplay.
// Every action returns the updated WorldState and generates
// a chronicle event for tracking GM interventions.
// ============================================================

import type { WorldState, Faction, Location, Character, WorldEvent, FactionPersonality } from './types.js';
import { clamp } from './world-state.js';

function gmEvent(state: WorldState, text: string, extra?: Partial<WorldEvent>): WorldEvent {
  return {
    id: `gm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    turn: state.turn,
    season: state.season,
    year: state.year,
    type: 'story_hook',
    text: `[GM] ${text}`,
    icon: '🎲',
    consequences: [],
    hookPotential: 1,
    ...extra,
  };
}

// === Faction Operations ===

export function gmAddFaction(state: WorldState, faction: Faction): WorldState {
  state.factions[faction.id] = faction;
  // Initialize relationships for existing factions
  for (const existing of Object.values(state.factions)) {
    if (existing.id === faction.id) continue;
    if (!(faction.id in existing.relationships)) {
      existing.relationships[faction.id] = 0;
    }
    if (!(existing.id in faction.relationships)) {
      faction.relationships[existing.id] = 0;
    }
  }
  state.eventLog.push(gmEvent(state, `New faction "${faction.name}" emerges.`, { factionId: faction.id }));
  return state;
}

export function gmRemoveFaction(state: WorldState, factionId: string): WorldState {
  const faction = state.factions[factionId];
  if (!faction) return state;

  // Release controlled locations
  for (const locId of faction.controlledLocations) {
    // territory becomes unclaimed
  }

  // Remove from relationships
  for (const f of Object.values(state.factions)) {
    delete f.relationships[factionId];
    f.alliances = f.alliances.filter(id => id !== factionId);
    f.enemies = f.enemies.filter(id => id !== factionId);
  }

  // Remove faction characters
  for (const char of Object.values(state.characters)) {
    if (char.factionId === factionId) {
      char.status = 'dead';
      char.deathTurn = state.turn;
      char.deathCause = `Faction "${faction.name}" dissolved`;
    }
  }

  state.eventLog.push(gmEvent(state, `Faction "${faction.name}" has been eliminated.`, { factionId }));
  delete state.factions[factionId];
  return state;
}

export function gmEditFaction(state: WorldState, factionId: string, changes: Partial<Faction>): WorldState {
  const faction = state.factions[factionId];
  if (!faction) return state;

  const desc: string[] = [];
  if (changes.power !== undefined) { faction.power = clamp(changes.power, 0, faction.maxPower); desc.push(`power→${faction.power}`); }
  if (changes.maxPower !== undefined) { faction.maxPower = changes.maxPower; desc.push(`maxPower→${faction.maxPower}`); }
  if (changes.morale !== undefined) { faction.morale = clamp(changes.morale, 0, 100); desc.push(`morale→${faction.morale}`); }
  if (changes.gold !== undefined) { faction.gold = Math.max(0, changes.gold); desc.push(`gold→${faction.gold}`); }
  if (changes.corruption !== undefined) { faction.corruption = clamp(changes.corruption, 0, 100); desc.push(`corruption→${faction.corruption}`); }
  if (changes.name !== undefined) { faction.name = changes.name; }
  if (changes.leader !== undefined) { faction.leader = changes.leader; }
  if (changes.description !== undefined) { faction.description = changes.description; }
  if (changes.tags !== undefined) { faction.tags = changes.tags; }
  if (changes.personality !== undefined) { faction.personality = changes.personality; }
  if (changes.color !== undefined) { faction.color = changes.color; }

  if (desc.length > 0) {
    state.eventLog.push(gmEvent(state, `${faction.name} modified: ${desc.join(', ')}`, { factionId }));
  }
  return state;
}

// === Character Operations ===

export function gmAddCharacter(state: WorldState, character: Character): WorldState {
  state.characters[character.id] = character;
  state.eventLog.push(gmEvent(state, `${character.name} enters the world as ${character.title}.`, { factionId: character.factionId }));
  return state;
}

export function gmKillCharacter(state: WorldState, charId: string, narrative?: string): WorldState {
  const char = state.characters[charId];
  if (!char || char.status === 'dead') return state;

  char.status = 'dead';
  char.deathTurn = state.turn;
  char.deathCause = narrative ?? 'Struck down by fate';
  state.eventLog.push(gmEvent(state, `${char.name} has been killed. ${narrative ?? ''}`, { factionId: char.factionId }));
  return state;
}

export function gmEditCharacter(state: WorldState, charId: string, changes: Partial<Character>): WorldState {
  const char = state.characters[charId];
  if (!char) return state;

  if (changes.name !== undefined) char.name = changes.name;
  if (changes.title !== undefined) char.title = changes.title;
  if (changes.role !== undefined) char.role = changes.role;
  if (changes.factionId !== undefined) char.factionId = changes.factionId;
  if (changes.locationId !== undefined) char.locationId = changes.locationId;
  if (changes.prowess !== undefined) char.prowess = changes.prowess;
  if (changes.cunning !== undefined) char.cunning = changes.cunning;
  if (changes.authority !== undefined) char.authority = changes.authority;
  if (changes.status !== undefined) char.status = changes.status;
  if (changes.renown !== undefined) char.renown = changes.renown;
  if (changes.loyalty !== undefined) char.loyalty = changes.loyalty;
  if (changes.description !== undefined) char.description = changes.description;
  if (changes.traits !== undefined) char.traits = changes.traits;

  state.eventLog.push(gmEvent(state, `${char.name} has been modified by the fates.`, { factionId: char.factionId }));
  return state;
}

export function gmTransferCharacter(state: WorldState, charId: string, newFactionId: string): WorldState {
  const char = state.characters[charId];
  if (!char) return state;
  const oldFaction = state.factions[char.factionId];
  const newFaction = state.factions[newFactionId];
  if (!newFaction) return state;

  const oldName = oldFaction?.name ?? char.factionId;
  char.factionId = newFactionId;
  state.eventLog.push(gmEvent(state, `${char.name} defects from ${oldName} to ${newFaction.name}.`));
  return state;
}

// === Location Operations ===

export function gmAddLocation(state: WorldState, location: Location): WorldState {
  state.locations[location.id] = location;
  state.eventLog.push(gmEvent(state, `New location "${location.name}" has been discovered.`, { locationId: location.id }));
  return state;
}

export function gmEditLocation(state: WorldState, locationId: string, changes: Partial<Location>): WorldState {
  const loc = state.locations[locationId];
  if (!loc) return state;

  if (changes.name !== undefined) loc.name = changes.name;
  if (changes.type !== undefined) loc.type = changes.type;
  if (changes.population !== undefined) loc.population = Math.max(0, changes.population);
  if (changes.defense !== undefined) loc.defense = clamp(changes.defense, 0, 100);
  if (changes.prosperity !== undefined) loc.prosperity = clamp(changes.prosperity, 0, 100);
  if (changes.description !== undefined) loc.description = changes.description;
  if (changes.connectedTo !== undefined) loc.connectedTo = changes.connectedTo;
  if (changes.resources !== undefined) loc.resources = changes.resources;
  if (changes.tradeRoutes !== undefined) loc.tradeRoutes = changes.tradeRoutes;

  state.eventLog.push(gmEvent(state, `${loc.name} has been modified.`, { locationId }));
  return state;
}

export function gmRazeLocation(state: WorldState, locationId: string): WorldState {
  const loc = state.locations[locationId];
  if (!loc) return state;

  loc.population = 0;
  loc.defense = 0;
  loc.prosperity = 0;
  loc.type = 'ruins';

  // Remove from faction control
  for (const f of Object.values(state.factions)) {
    f.controlledLocations = f.controlledLocations.filter(id => id !== locationId);
  }

  state.eventLog.push(gmEvent(state, `${loc.name} has been razed to the ground.`, { locationId }));
  return state;
}

export function gmTransferTerritory(state: WorldState, locationId: string, newOwnerId: string | null): WorldState {
  const loc = state.locations[locationId];
  if (!loc) return state;

  // Remove from current owner
  for (const f of Object.values(state.factions)) {
    f.controlledLocations = f.controlledLocations.filter(id => id !== locationId);
  }

  // Assign to new owner
  if (newOwnerId && state.factions[newOwnerId]) {
    state.factions[newOwnerId].controlledLocations.push(locationId);
    state.eventLog.push(gmEvent(state, `${loc.name} is now controlled by ${state.factions[newOwnerId].name}.`, { locationId }));
  } else {
    state.eventLog.push(gmEvent(state, `${loc.name} is now unclaimed territory.`, { locationId }));
  }

  return state;
}

// === Event Operations ===

export function gmInjectEvent(state: WorldState, event: Omit<WorldEvent, 'id' | 'turn' | 'season' | 'year'>): WorldState {
  const fullEvent: WorldEvent = {
    id: `gm_event_${Date.now()}`,
    turn: state.turn,
    season: state.season,
    year: state.year,
    ...event,
  };
  state.eventLog.push(fullEvent);
  return state;
}

// === Helper: Create a blank faction template ===

export function createBlankFaction(id: string): Faction {
  return {
    id,
    name: 'New Faction',
    type: 'custom',
    tags: [],
    power: 20,
    maxPower: 50,
    morale: 50,
    gold: 100,
    corruption: 0,
    leader: 'Unknown Leader',
    leaderTraits: [],
    goals: [],
    attitude: 'Neutral',
    description: '',
    personality: { dealmaking: 0.5, aggression: 0.5, greed: 0.5 },
    controlledLocations: [],
    relationships: {},
    alliances: [],
    enemies: [],
    treaties: [],
    recentActions: [],
  };
}

export function createBlankCharacter(id: string, factionId: string, locationId: string): Character {
  return {
    id,
    name: 'New Character',
    title: 'Unknown',
    role: 'advisor',
    factionId,
    locationId,
    prowess: 5,
    cunning: 5,
    authority: 5,
    status: 'active',
    renown: 0,
    loyalty: 80,
    woundedUntilTurn: 0,
    activeSince: 0,
    description: '',
    traits: [],
    abilities: [],
    killCount: 0,
    battlesWon: 0,
    battlesLost: 0,
    timesWounded: 0,
    titleHistory: [],
    vendettas: [],
    trophies: [],
    relationships: [],
  };
}

export function createBlankLocation(id: string): Location {
  return {
    id,
    name: 'New Location',
    type: 'village',
    x: 50,
    y: 50,
    population: 100,
    defense: 10,
    prosperity: 20,
    connectedTo: [],
    description: '',
    rumors: [],
    resources: [],
    tradeRoutes: [],
  };
}
