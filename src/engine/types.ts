// ============================================================
// Core Data Models for The Aurelian Decline
// ============================================================

export type FactionType =
  | 'empire'
  | 'noble'
  | 'bandit'
  | 'goblin'
  | 'town'
  | 'merchant'
  | 'religious';

export type LocationType =
  | 'capital'
  | 'fortress'
  | 'castle'
  | 'town'
  | 'village'
  | 'ruins'
  | 'lair'
  | 'temple'
  | 'mine'
  | 'tower'
  | 'dungeon';

export type Season = 'Spring' | 'Summer' | 'Autumn' | 'Winter';

export const SEASONS: Season[] = ['Spring', 'Summer', 'Autumn', 'Winter'];

export interface Faction {
  id: string;
  name: string;
  type: FactionType;

  // Resources
  power: number;
  maxPower: number;
  morale: number;
  gold: number;
  corruption: number;

  // Identity
  leader: string;
  leaderTraits: string[];
  goals: string[];
  attitude: string;
  description: string;

  // Territory
  controlledLocations: string[];

  // Relationships
  relationships: Record<string, number>; // faction_id -> sentiment (-100 to 100)
  alliances: string[];
  enemies: string[];

  // History
  recentActions: string[];
}

export interface Location {
  id: string;
  name: string;
  type: LocationType;

  x: number;
  y: number;

  population: number;
  defense: number;
  prosperity: number;

  connectedTo: string[];

  description: string;
  rumors: string[];

  resources: string[];
  tradeRoutes: string[];
}

export type EventType =
  | 'raid'
  | 'battle'
  | 'alliance'
  | 'betrayal'
  | 'scandal'
  | 'reform'
  | 'trade'
  | 'recruitment'
  | 'fortification'
  | 'migration'
  | 'disaster'
  | 'discovery'
  | 'omen'
  | 'plague'
  | 'story_hook'
  | 'patrol'
  | 'diplomacy'
  | 'festival'
  | 'famine'
  | 'weather';

export interface WorldEvent {
  id: string;
  turn: number;
  season: Season;
  year: number;
  type: EventType;
  text: string;
  narrative?: string;
  icon: string;
  factionId?: string;
  locationId?: string;
  consequences: string[];
  hookPotential: number; // 1-5
}

export interface TurnResult {
  turn: number;
  season: Season;
  year: number;
  events: WorldEvent[];
  factionChanges: Record<string, Partial<Faction>>;
  locationChanges: Record<string, Partial<Location>>;
  storyHooks: string[];
  dmBrief: string;
}

export interface WorldState {
  turn: number;
  year: number;
  season: Season;
  factions: Record<string, Faction>;
  locations: Record<string, Location>;
  eventLog: WorldEvent[];
  storyBeatsTriggered: string[];
  rngSeed: number;
}

export type FactionAction =
  | { type: 'raid'; targetLocationId: string }
  | { type: 'recruit' }
  | { type: 'fortify'; locationId: string }
  | { type: 'patrol'; locationId: string }
  | { type: 'collect_taxes' }
  | { type: 'seek_alliance'; targetFactionId: string }
  | { type: 'scheme' }
  | { type: 'invest'; locationId: string }
  | { type: 'bribe'; targetFactionId: string }
  | { type: 'expand'; targetLocationId: string }
  | { type: 'lay_low' }
  | { type: 'reform' }
  | { type: 'trade'; locationId: string }
  | { type: 'hire_mercenaries' };

export interface CombatResult {
  attackerRoll: number;
  defenderRoll: number;
  margin: number;
  outcome: 'decisive_victory' | 'victory' | 'pyrrhic_victory' | 'repelled' | 'routed';
  attackerLosses: number;
  defenderLosses: number;
  territoryChanged: boolean;
}

export interface EventTemplate {
  id: string;
  type: EventType;
  text: string;
  icon: string;
  conditions?: {
    minTurn?: number;
    season?: Season;
    requiresFaction?: FactionType;
  };
  effects: {
    targetType: 'faction' | 'location' | 'global';
    changes: Record<string, number>;
  };
  hookPotential: number;
  weight: number;
}
