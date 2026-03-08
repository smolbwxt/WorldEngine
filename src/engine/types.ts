// ============================================================
// Core Data Models for WorldEngine
// ============================================================

import type { TagBehavior } from './tags.js';
import type { SimulationConfig } from './config.js';

/** Faction type is now a freeform string label (cosmetic only). */
export type FactionType = string;

/** Location type is now a freeform string label. */
export type LocationType = string;

export type Season = string;

export const SEASONS: string[] = ['Spring', 'Summer', 'Autumn', 'Winter'];

export interface FactionPersonality {
  dealmaking: number;   // 0-1, preference for negotiation over violence
  aggression: number;   // 0-1, preference for raids/expansion
  greed: number;        // 0-1, how much they value gold accumulation
}

export interface Faction {
  id: string;
  name: string;
  type: FactionType;
  tags: string[];
  color?: string;

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
  narrative: string;  // procedural flavor text recap of the turn
}

// === Player Intervention System ===

/** A single pending faction action that players can review/modify before execution */
export interface PendingAction {
  factionId: string;
  factionName: string;
  factionColor?: string;
  action: FactionAction;
  description: string;
  enabled: boolean;       // can be toggled off to cancel action
  playerNote?: string;    // optional GM annotation
}

/** Snapshot of a turn after decisions but before execution — the intervention point */
export interface PendingTurn {
  turn: number;
  season: Season;
  year: number;
  actions: PendingAction[];
  prePhaseEvents: WorldEvent[];   // decay + economy events already applied
  rngSeed: number;                // for resuming deterministic execution
  injectedEvents: WorldEvent[];   // player-added events to inject during resolution
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

export type CharacterRole = string;

export type CharacterStatus = 'active' | 'wounded' | 'captured' | 'dead';

export interface CharacterAbility {
  id: string;
  name: string;
  description: string;
  passive: boolean;      // always active vs triggered
  combatBonus?: number;  // added to rolls when present
  moraleBonus?: number;  // morale boost to faction
  economyBonus?: number; // gold income multiplier
  gainedTurn?: number;   // turn when this ability was earned (undefined = starting ability)
}

export interface CharacterVendetta {
  targetCharId: string;   // the character they want dead
  reason: string;         // e.g. "killed Ser Roland at Thornefield"
  createdTurn: number;
}

export interface CharacterTrophy {
  name: string;           // e.g. "Grak's Skull"
  fromCharId: string;     // the dead character this came from
  fromCharName: string;
  gainedTurn: number;
  combatBonus: number;    // typically 1
}

export type RelationshipType =
  | 'mentor'       // older character teaches younger
  | 'protege'      // younger character learns from older
  | 'rival'        // intra-faction rivalry
  | 'blood_oath'   // cross-faction sworn bond
  | 'nemesis';     // sworn enemy (personal, not faction)

export interface CharacterRelationship {
  targetCharId: string;
  type: RelationshipType;
  createdTurn: number;
  description: string;
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
  activeSince: number;    // turn when character entered play (0 = start)

  // Identity
  description: string;
  traits: string[];
  abilities: CharacterAbility[];

  // History
  killCount: number;
  battlesWon: number;
  battlesLost: number;
  timesWounded: number;
  deathTurn?: number;
  deathCause?: string;
  titleHistory: string[]; // previous titles, most recent first

  // Rivalries, trophies, relationships
  vendettas: CharacterVendetta[];
  trophies: CharacterTrophy[];
  relationships: CharacterRelationship[];

  // Last stand result (set on death in battle)
  lastStand?: {
    extraCasualties: number;
    flippedBattle: boolean;
    narrative: string;
  };
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
    requiresTag?: string;
  };
  effects: {
    targetType: 'faction' | 'location' | 'global';
    changes: Record<string, number>;
  };
  hookPotential: number;
  weight: number;
}

// === World Definition (for initialization & presets) ===

export interface WorldDefinition {
  meta: {
    name: string;
    description: string;
    theme: string;
    startingSeason: string;
    seasonNames: string[];
  };
  factions: Faction[];
  locations: Location[];
  characters: Character[];
  events: EventTemplate[];
  storyHooks: StoryHook[];
  availableTags: string[];
  customTags?: TagBehavior[];
  mapImage?: string;
  mapGrid?: MapGridConfig;
  config?: Partial<SimulationConfig>;
}

export interface StoryHook {
  id: string;
  triggerTurn: number;
  title: string;
  text: string;
  hookPotential: number;
}

export interface MapGridConfig {
  rows: number;
  cols: number;
  cells: MapCell[][];
}

export interface MapCell {
  terrain: string;
  color: string;
  owner?: string;
  locationId?: string;
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
  definition?: WorldDefinition;
}
