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
  | 'dungeon'
  | 'catacombs'
  | 'port'
  | 'shrine'
  | 'outpost';

export type Season = 'Spring' | 'Summer' | 'Autumn' | 'Winter';

export const SEASONS: Season[] = ['Spring', 'Summer', 'Autumn', 'Winter'];

export interface FactionPersonality {
  dealmaking: number;   // 0-1, preference for negotiation over violence
  aggression: number;   // 0-1, preference for raids/expansion
  greed: number;        // 0-1, how much they value gold accumulation
}

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
  personality: FactionPersonality;

  // Territory
  controlledLocations: string[];

  // Relationships
  relationships: Record<string, number>; // faction_id -> sentiment (-100 to 100)
  alliances: string[];
  enemies: string[];

  // Treaties
  treaties: Treaty[];

  // History
  recentActions: string[];
}

// === Treaty System ===

export type TreatyType =
  | 'gold_for_peace'       // I pay you X gold/turn, you don't attack me
  | 'gold_for_protection'  // I pay you X gold/turn, you lend me Y power
  | 'gold_for_territory'   // I give you X gold, you cede a location
  | 'mutual_defense'       // both sides defend each other
  | 'trade_agreement'      // both sides get income bonus
  | 'tribute';             // weaker pays stronger to avoid war

export interface Treaty {
  id: string;
  type: TreatyType;
  parties: [string, string];     // [proposer, acceptor]
  terms: {
    goldPerTurn?: number;
    lumpSumGold?: number;
    locationId?: string;
    powerLent?: number;
    duration: number;            // turns remaining (-1 = indefinite)
  };
  createdTurn: number;
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
  | 'weather'
  | 'treaty';

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
  characters: Record<string, Character>;
  activeTreaties: Treaty[];
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
  | { type: 'hire_mercenaries' }
  | { type: 'propose_treaty'; targetFactionId: string; treatyType: TreatyType; terms: Treaty['terms'] };

// === Character / NPC System ===

export type CharacterRole =
  | 'commander'     // military leader — combat bonuses
  | 'spymaster'     // intelligence — sabotage, scouting
  | 'diplomat'      // negotiation — treaty bonuses
  | 'champion'      // personal combatant — duels, morale
  | 'advisor'       // governance — economy, corruption
  | 'warchief';     // goblin/bandit leader — raid bonuses

export type CharacterStatus = 'active' | 'wounded' | 'captured' | 'dead';

export interface CharacterAbility {
  id: string;
  name: string;
  description: string;
  passive: boolean;      // always active vs triggered
  combatBonus?: number;  // added to rolls when present
  moraleBonus?: number;  // morale boost to faction
  economyBonus?: number; // gold income multiplier
}

export interface Character {
  id: string;
  name: string;
  title: string;
  role: CharacterRole;
  factionId: string;
  locationId: string;     // current location

  // Core stats (1-10 scale, like ability scores)
  prowess: number;        // martial skill — combat rolls
  cunning: number;        // subterfuge — raids, schemes, survival
  authority: number;      // leadership — morale, diplomacy, governance

  // State
  status: CharacterStatus;
  renown: number;         // 0-100, grows with victories
  loyalty: number;        // 0-100, to their faction
  woundedUntilTurn: number; // turn when wounds heal (0 = not wounded)

  // Identity
  description: string;
  traits: string[];
  abilities: CharacterAbility[];

  // History
  killCount: number;
  battlesWon: number;
  battlesLost: number;
  deathTurn?: number;
  deathCause?: string;
}

export interface CombatResult {
  attackerRoll: number;
  defenderRoll: number;
  margin: number;
  outcome: 'decisive_victory' | 'victory' | 'pyrrhic_victory' | 'repelled' | 'routed';
  attackerLosses: number;
  defenderLosses: number;
  territoryChanged: boolean;
  // Character combat results
  attackerCharacter?: { id: string; name: string; bonus: number; survived: boolean; deathNarrative?: string };
  defenderCharacter?: { id: string; name: string; bonus: number; survived: boolean; deathNarrative?: string };
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
