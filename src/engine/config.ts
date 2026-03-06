// ============================================================
// Simulation Configuration — every tunable lever in one place
// ============================================================

export interface EconomyConfig {
  /** Multiplier on location prosperity for base income (default 0.3) */
  baseIncomeRate: number;
  /** Multiplier on trade partner prosperity for trade bonus (default 0.05) */
  tradeRouteBonus: number;
  /** Min prosperity on trade target for trade to flow (default 20) */
  tradeProsperityThreshold: number;
  /** Extra income multiplier ceiling for empires via tax efficiency (default 0.5) */
  empireTaxBonus: number;
  /** Flat income multiplier for merchants (default 1.5) */
  merchantTradeMultiplier: number;
  /** Gold cost per unit of power (default 0.5) */
  armyUpkeepRate: number;
  /** Gold cost per controlled location (default 3) */
  territoryUpkeepCost: number;
  /** Morale lost when faction is bankrupt (default 5) */
  bankruptcyMoraleHit: number;
  /** Power lost when faction is bankrupt (default 2) */
  bankruptcyPowerHit: number;
  /** Chance for a low-prosperity location to recover (default 0.3) */
  prosperityRecoveryChance: number;
  /** Prosperity threshold below which recovery can trigger (default 50) */
  prosperityRecoveryThreshold: number;
  /** Prosperity gained per recovery tick (default 2) */
  prosperityRecoveryAmount: number;

  /** Seasonal prosperity adjustments */
  seasonal: {
    winterProsperityHit: number;    // default -2
    springProsperityGain: number;   // default 1
    autumnProsperityGain: number;   // default 2
  };

  /** Tax collection rate as multiplier on prosperity (default 0.2) */
  taxCollectionRate: number;
  /** Prosperity lost per location when taxes are collected (default 1) */
  taxProsperityDamage: number;
  /** Corruption divisor for tax efficiency loss (default 200) */
  corruptionTaxDivisor: number;
}

export interface CombatConfig {
  /** Divisor for power-to-roll conversion (default 5) */
  powerRollDivisor: number;
  /** Morale threshold for combat bonus (default 60) */
  highMoraleThreshold: number;
  /** Morale threshold for combat penalty (default 30) */
  lowMoraleThreshold: number;
  /** Combat bonus/penalty from morale (default 2) */
  moraleModifier: number;
  /** Divisor for defense-to-roll conversion (default 10) */
  fortificationDivisor: number;
  /** Fixed bonus for fortress locations (default 3) */
  fortressBonus: number;
  /** Fixed bonus for castle locations (default 2) */
  castleBonus: number;
  /** Fixed bonus for lair locations (default 2) */
  lairBonus: number;

  /** Margin thresholds for outcome tiers */
  decisiveVictoryMargin: number;  // default 10
  victoryMargin: number;          // default 5

  /** Loss rates per outcome [attacker, defender] as fraction of power */
  losses: {
    decisiveVictory: [number, number];  // [0.05, 0.30]
    victory: [number, number];          // [0.10, 0.20]
    pyrrhicVictory: [number, number];   // [0.20, 0.15]
    repelled: [number, number];         // [0.10, 0.05]
    routed: [number, number];           // [0.25, 0.03]
  };
}

export interface RaidConfig {
  /** Divisor for raider power roll (default 5) */
  raiderPowerDivisor: number;
  /** Divisor for location defense roll (default 3) */
  defenseRollDivisor: number;
  /** Divisor for garrison faction power bonus (default 10) */
  garrisonPowerDivisor: number;
  /** Multiplier on target prosperity for loot (default 0.3) */
  lootProsperityRate: number;
  /** Random loot range [min, max] (default [5, 15]) */
  lootRandomRange: [number, number];
  /** Random prosperity damage range [min, max] (default [5, 15]) */
  prosperityDamageRange: [number, number];
  /** Raider losses on clean win range [min, max] (default [1, 3]) */
  raiderWinLossRange: [number, number];
  /** Raider losses on failed raid range [min, max] (default [2, 5]) */
  raiderFailLossRange: [number, number];
  /** Margin above which raid is clean (no losses) (default 10) */
  cleanRaidMargin: number;
  /** Population damage range per successful raid (default [10, 50]) */
  populationDamageRange: [number, number];
  /** Relationship damage to raider from defender's perspective (default -20) */
  defenderRelationshipDamage: number;
  /** Relationship damage to defender from raider's perspective (default -15) */
  raiderRelationshipDamage: number;
}

export interface DecayConfig {
  /** Chance corruption ticks up per turn (default 0.4) */
  corruptionTickChance: number;
  /** Corruption growth range per tick [min, max] (default [1, 3]) */
  corruptionTickRange: [number, number];
  /** Divisor for corruption-to-power-erosion (default 25) */
  corruptionPowerDivisor: number;
  /** Chance power erosion happens when corruption penalty > 0 (default 0.5) */
  powerErosionChance: number;
  /** Divisor for treasury drain from corruption (default 500) */
  treasuryDrainDivisor: number;
  /** Corruption threshold above which morale decays (default 60) */
  moraleDecayCorruptionThreshold: number;
  /** Chance morale decays when above corruption threshold (default 0.3) */
  moraleDecayChance: number;
  /** Morale lost per decay tick (default 2) */
  moraleDecayAmount: number;
  /** Chance reform succeeds (default 0.3) */
  reformSuccessChance: number;
  /** Corruption reduced on successful reform [min, max] (default [3, 8]) */
  reformAmountRange: [number, number];
  /** Morale gained on successful reform (default 3) */
  reformMoraleGain: number;
  /** Gold wasted on failed reform (default 10) */
  reformFailCost: number;
}

export interface DiplomacyConfig {
  /** Min relationship needed to attempt alliance (default 10) */
  allianceThreshold: number;
  /** Chance alliance attempt succeeds (default 0.5) */
  allianceSuccessChance: number;
  /** Relationship boost on successful alliance (default 20) */
  allianceRelationshipBoost: number;
  /** Max gold spent on bribe (default 20) */
  bribeCost: number;
  /** Relationship gain for briber (default 10) */
  briberRelationshipGain: number;
  /** Relationship gain for bribe target (default 5) */
  bribeTargetRelationshipGain: number;
  /** Corruption added to empire per scheme [min, max] (default [1, 3]) */
  schemeCorruptionRange: [number, number];
  /** Gold cost of scheming (default 15) */
  schemeCost: number;

  // Treaty system
  /** Relationship penalty for breaking a treaty */
  treatyBreakPenalty: number;
  /** Morale hit for breaking a treaty */
  treatyBreakMoraleCost: number;
  /** Base chance of accepting a treaty proposal (modified by personality) */
  treatyBaseAcceptChance: number;
  /** Minimum relationship to propose a treaty */
  treatyMinRelationship: number;
}

/** Per-location-type income multipliers */
export interface LocationBonusConfig {
  capital: number;
  fortress: number;
  castle: number;
  town: number;
  village: number;
  ruins: number;
  lair: number;
  temple: number;
  mine: number;
  tower: number;
  dungeon: number;
  catacombs: number;
  port: number;
  shrine: number;
  outpost: number;
}

/** Action effectiveness multipliers per faction type */
export interface ActionMultiplierConfig {
  empire: { taxIncome: number; patrolDefense: number; recruitEfficiency: number };
  noble: { schemeEffect: number; allianceChance: number; fortifyBonus: number };
  bandit: { raidLoot: number; recruitCost: number; expansionBonus: number };
  goblin: { raidLoot: number; expansionBonus: number; recruitEfficiency: number };
  merchant: { tradeIncome: number; bribeCost: number; investEfficiency: number };
}

export interface RecruitmentConfig {
  /** Recruit range per turn [min, max] (default [2, 5]) */
  recruitRange: [number, number];
  /** Gold cost per recruit (default 3) */
  recruitCost: number;
  /** Mercenary hire cost (default 25) */
  mercenaryCost: number;
  /** Power gained from hiring mercenaries (default 5) */
  mercenaryPower: number;
  /** Investment cap in gold per turn (default 30) */
  investmentCap: number;
  /** Prosperity gained per 5 gold invested (divisor, default 5) */
  investmentEfficiency: number;
  /** Fortify defense range [min, max] (default [3, 8]) */
  fortifyRange: [number, number];
  /** Fortify gold cost (default 10) */
  fortifyCost: number;
  /** Patrol defense boost (default 2) */
  patrolDefenseBoost: number;
  /** Morale gain from laying low (default 2) */
  layLowMoraleGain: number;
  /** Trade income rate on prosperity (default 0.15) */
  tradeIncomeRate: number;
  /** Trade random income range [min, max] (default [5, 15]) */
  tradeRandomRange: [number, number];
}

export interface FactionAIConfig {
  empire: {
    reformCorruptionThreshold: number;  // default 80
    reformChance: number;               // default 0.3
    taxGoldThreshold: number;           // default 100
  };
  noble: {
    principledRecruitThreshold: number; // default 0.6 (fraction of maxPower)
    ambitiousRecruitThreshold: number;  // default 0.8
    schemeChance: number;               // default 0.4
    schemePowerThreshold: number;       // default 0.7
    allianceChance: number;             // default 0.3
  };
  bandit: {
    desperateGoldThreshold: number;     // default 20
    winterGoldThreshold: number;        // default 40
    cautionChance: number;              // default 0.6
    expansionChance: number;            // default 0.3
    expansionPowerThreshold: number;    // default 20
    raidChance: number;                 // default 0.5
  };
  goblin: {
    expansionPowerThreshold: number;    // default 25
    expansionChance: number;            // default 0.4
    raidChance: number;                 // default 0.5
    recruitPowerThreshold: number;      // default 0.7
  };
  merchant: {
    hireGoldThreshold: number;          // default 50
    investGoldThreshold: number;        // default 100
    investChance: number;               // default 0.4
    bribeGoldThreshold: number;         // default 150
    bribeChance: number;                // default 0.3
  };
}

export interface EventsConfig {
  /** Max random events per turn (default 2, range is 0 to this) */
  maxEventsPerTurn: number;
  /** Refugee count range per raid [min, max] (default [10, 30]) */
  refugeeRange: [number, number];
  /** Prosperity cost to locations receiving refugees (default 1) */
  refugeeProsperityCost: number;
}

/** Master config containing every tunable parameter in the simulation */
export interface SimulationConfig {
  economy: EconomyConfig;
  combat: CombatConfig;
  raid: RaidConfig;
  decay: DecayConfig;
  diplomacy: DiplomacyConfig;
  recruitment: RecruitmentConfig;
  factionAI: FactionAIConfig;
  events: EventsConfig;
  locationBonuses: LocationBonusConfig;
  actionMultipliers: ActionMultiplierConfig;
}

/** Default configuration — rebalanced for healthier economy */
export const DEFAULT_CONFIG: SimulationConfig = {
  economy: {
    baseIncomeRate: 0.8,
    tradeRouteBonus: 0.15,
    tradeProsperityThreshold: 15,
    empireTaxBonus: 0.5,
    merchantTradeMultiplier: 1.5,
    armyUpkeepRate: 0.25,
    territoryUpkeepCost: 2,
    bankruptcyMoraleHit: 5,
    bankruptcyPowerHit: 2,
    prosperityRecoveryChance: 0.3,
    prosperityRecoveryThreshold: 50,
    prosperityRecoveryAmount: 2,
    seasonal: {
      winterProsperityHit: -2,
      springProsperityGain: 1,
      autumnProsperityGain: 2,
    },
    taxCollectionRate: 0.2,
    taxProsperityDamage: 1,
    corruptionTaxDivisor: 200,
  },

  combat: {
    powerRollDivisor: 5,
    highMoraleThreshold: 60,
    lowMoraleThreshold: 30,
    moraleModifier: 2,
    fortificationDivisor: 10,
    fortressBonus: 3,
    castleBonus: 2,
    lairBonus: 2,
    decisiveVictoryMargin: 10,
    victoryMargin: 5,
    losses: {
      decisiveVictory: [0.05, 0.30],
      victory: [0.10, 0.20],
      pyrrhicVictory: [0.20, 0.15],
      repelled: [0.10, 0.05],
      routed: [0.25, 0.03],
    },
  },

  raid: {
    raiderPowerDivisor: 5,
    defenseRollDivisor: 3,
    garrisonPowerDivisor: 10,
    lootProsperityRate: 0.3,
    lootRandomRange: [5, 15],
    prosperityDamageRange: [5, 15],
    raiderWinLossRange: [1, 3],
    raiderFailLossRange: [2, 5],
    cleanRaidMargin: 10,
    populationDamageRange: [10, 50],
    defenderRelationshipDamage: -20,
    raiderRelationshipDamage: -15,
  },

  decay: {
    corruptionTickChance: 0.4,
    corruptionTickRange: [1, 3],
    corruptionPowerDivisor: 25,
    powerErosionChance: 0.5,
    treasuryDrainDivisor: 1000,
    moraleDecayCorruptionThreshold: 60,
    moraleDecayChance: 0.3,
    moraleDecayAmount: 2,
    reformSuccessChance: 0.3,
    reformAmountRange: [3, 8],
    reformMoraleGain: 3,
    reformFailCost: 10,
  },

  diplomacy: {
    allianceThreshold: 10,
    allianceSuccessChance: 0.5,
    allianceRelationshipBoost: 20,
    bribeCost: 20,
    briberRelationshipGain: 10,
    bribeTargetRelationshipGain: 5,
    schemeCorruptionRange: [1, 3],
    schemeCost: 15,
    treatyBreakPenalty: -40,
    treatyBreakMoraleCost: 10,
    treatyBaseAcceptChance: 0.4,
    treatyMinRelationship: -20,
  },

  recruitment: {
    recruitRange: [2, 5],
    recruitCost: 3,
    mercenaryCost: 25,
    mercenaryPower: 5,
    investmentCap: 30,
    investmentEfficiency: 5,
    fortifyRange: [3, 8],
    fortifyCost: 10,
    patrolDefenseBoost: 2,
    layLowMoraleGain: 2,
    tradeIncomeRate: 0.15,
    tradeRandomRange: [5, 15],
  },

  factionAI: {
    empire: {
      reformCorruptionThreshold: 80,
      reformChance: 0.3,
      taxGoldThreshold: 100,
    },
    noble: {
      principledRecruitThreshold: 0.6,
      ambitiousRecruitThreshold: 0.8,
      schemeChance: 0.4,
      schemePowerThreshold: 0.7,
      allianceChance: 0.3,
    },
    bandit: {
      desperateGoldThreshold: 20,
      winterGoldThreshold: 40,
      cautionChance: 0.6,
      expansionChance: 0.3,
      expansionPowerThreshold: 20,
      raidChance: 0.5,
    },
    goblin: {
      expansionPowerThreshold: 25,
      expansionChance: 0.4,
      raidChance: 0.5,
      recruitPowerThreshold: 0.7,
    },
    merchant: {
      hireGoldThreshold: 50,
      investGoldThreshold: 100,
      investChance: 0.4,
      bribeGoldThreshold: 150,
      bribeChance: 0.3,
    },
  },

  events: {
    maxEventsPerTurn: 2,
    refugeeRange: [10, 30],
    refugeeProsperityCost: 1,
  },

  locationBonuses: {
    capital: 2.0,
    fortress: 0.5,
    castle: 1.2,
    town: 1.0,
    village: 0.7,
    ruins: 0.1,
    lair: 0.2,
    temple: 0.8,
    mine: 2.5,
    tower: 0.2,
    dungeon: 0.0,
    catacombs: 0.0,
    port: 1.8,
    shrine: 0.5,
    outpost: 0.3,
  },

  actionMultipliers: {
    empire: { taxIncome: 1.5, patrolDefense: 2.0, recruitEfficiency: 1.0 },
    noble: { schemeEffect: 1.5, allianceChance: 1.5, fortifyBonus: 1.3 },
    bandit: { raidLoot: 1.5, recruitCost: 0.5, expansionBonus: 1.2 },
    goblin: { raidLoot: 1.3, expansionBonus: 1.4, recruitEfficiency: 1.2 },
    merchant: { tradeIncome: 2.0, bribeCost: 0.7, investEfficiency: 1.5 },
  },
};

/** Create a config with partial overrides merged onto defaults */
export function createConfig(overrides?: DeepPartial<SimulationConfig>): SimulationConfig {
  if (!overrides) return { ...DEFAULT_CONFIG };
  return deepMerge(DEFAULT_CONFIG as unknown as PlainObj, overrides as unknown as PlainObj) as unknown as SimulationConfig;
}

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

type PlainObj = Record<string, unknown>;

function deepMerge(target: PlainObj, source: PlainObj): PlainObj {
  const result: PlainObj = { ...target };
  for (const key of Object.keys(source)) {
    const sourceVal = source[key];
    const targetVal = target[key];
    if (
      sourceVal !== null &&
      typeof sourceVal === 'object' &&
      !Array.isArray(sourceVal) &&
      targetVal !== null &&
      typeof targetVal === 'object' &&
      !Array.isArray(targetVal)
    ) {
      result[key] = deepMerge(targetVal as PlainObj, sourceVal as PlainObj);
    } else {
      result[key] = sourceVal;
    }
  }
  return result;
}
