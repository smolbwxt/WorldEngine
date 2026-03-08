// ============================================================
// Behavioral Tag System
//
// Tags are the primary driver of faction AI behavior.
// Each tag maps to behavioral priorities and stat modifiers.
// Multiple tags stack additively with diminishing returns.
// ============================================================

export type TagCategory =
  | 'disposition'
  | 'economic'
  | 'political'
  | 'social'
  | 'military'
  | 'compound';

export interface TagBehavior {
  tag: string;
  category: TagCategory;
  description: string;
  priorities: {
    raid?: number;
    fortify?: number;
    trade?: number;
    expand?: number;
    diplomacy?: number;
    reform?: number;
    recruit?: number;
    scheme?: number;
    invest?: number;
    bribe?: number;
    patrol?: number;
    layLow?: number;
    collectTaxes?: number;
    hireMercenaries?: number;
  };
  modifiers?: {
    incomeRate?: number;
    upkeepRate?: number;
    raidLoot?: number;
    corruptionRate?: number;
    moraleDecay?: number;
    combatPower?: number;
    defenseBonus?: number;
    recruitEfficiency?: number;
    tradeIncome?: number;
    schemeEffect?: number;
    allianceChance?: number;
  };
}

// ============================================================
// Built-in Tag Definitions
// ============================================================

export const BUILTIN_TAGS: TagBehavior[] = [
  // === Disposition ===
  {
    tag: 'aggressive', category: 'disposition',
    description: 'Prefers violence and direct action over negotiation',
    priorities: { raid: 0.3, expand: 0.3, recruit: 0.1, diplomacy: -0.2 },
    modifiers: { combatPower: 0.1 },
  },
  {
    tag: 'defensive', category: 'disposition',
    description: 'Prioritizes holding territory and protecting what they have',
    priorities: { fortify: 0.4, patrol: 0.3, recruit: 0.1, raid: -0.2, expand: -0.1 },
    modifiers: { defenseBonus: 0.15 },
  },
  {
    tag: 'cautious', category: 'disposition',
    description: 'Avoids risk, prefers safe options and laying low',
    priorities: { layLow: 0.2, fortify: 0.2, patrol: 0.1, raid: -0.2, expand: -0.2 },
  },
  {
    tag: 'reckless', category: 'disposition',
    description: 'Acts impulsively, high risk high reward',
    priorities: { raid: 0.2, expand: 0.2, layLow: -0.3, fortify: -0.1 },
    modifiers: { combatPower: 0.05, raidLoot: 0.1 },
  },
  {
    tag: 'patient', category: 'disposition',
    description: 'Plays the long game, invests in growth and diplomacy',
    priorities: { invest: 0.2, diplomacy: 0.2, fortify: 0.1, raid: -0.1 },
  },
  {
    tag: 'opportunistic', category: 'disposition',
    description: 'Exploits weakness, adapts quickly to changing situations',
    priorities: { raid: 0.1, expand: 0.1, bribe: 0.1, scheme: 0.1 },
  },

  // === Economic ===
  {
    tag: 'trading', category: 'economic',
    description: 'Generates wealth through commerce and trade routes',
    priorities: { trade: 0.4, invest: 0.2, bribe: 0.1, raid: -0.2 },
    modifiers: { tradeIncome: 0.3, incomeRate: 0.1 },
  },
  {
    tag: 'hoarding', category: 'economic',
    description: 'Accumulates resources, reluctant to spend',
    priorities: { collectTaxes: 0.3, trade: 0.2, invest: -0.1, hireMercenaries: -0.1 },
    modifiers: { incomeRate: 0.1 },
  },
  {
    tag: 'generous', category: 'economic',
    description: 'Shares wealth freely, boosting morale and diplomacy',
    priorities: { invest: 0.2, bribe: 0.2, diplomacy: 0.1, collectTaxes: -0.1 },
    modifiers: { moraleDecay: -0.1 },
  },
  {
    tag: 'exploitative', category: 'economic',
    description: 'Extracts maximum value regardless of consequences',
    priorities: { collectTaxes: 0.3, raid: 0.1, invest: -0.1 },
    modifiers: { incomeRate: 0.2, corruptionRate: 0.1, moraleDecay: 0.1 },
  },
  {
    tag: 'self-sufficient', category: 'economic',
    description: 'Relies on own resources, minimal trade dependency',
    priorities: { fortify: 0.1, recruit: 0.1, trade: -0.1, bribe: -0.1 },
    modifiers: { upkeepRate: -0.1 },
  },
  {
    tag: 'parasitic', category: 'economic',
    description: 'Feeds off others, raids and pillages for sustenance',
    priorities: { raid: 0.4, expand: 0.1, trade: -0.3, invest: -0.2 },
    modifiers: { raidLoot: 0.2 },
  },
  {
    tag: 'industrious', category: 'economic',
    description: 'Productive and hardworking, strong economic base',
    priorities: { invest: 0.3, fortify: 0.1, trade: 0.1 },
    modifiers: { incomeRate: 0.15, recruitEfficiency: 0.1 },
  },

  // === Political ===
  {
    tag: 'diplomatic', category: 'political',
    description: 'Prefers negotiation and alliances over conflict',
    priorities: { diplomacy: 0.4, bribe: 0.2, trade: 0.1, raid: -0.2, expand: -0.1 },
    modifiers: { allianceChance: 0.2 },
  },
  {
    tag: 'isolationist', category: 'political',
    description: 'Avoids foreign entanglements, focuses inward',
    priorities: { fortify: 0.3, layLow: 0.2, diplomacy: -0.3, bribe: -0.2, expand: -0.2 },
  },
  {
    tag: 'expansionist', category: 'political',
    description: 'Driven to grow territory and influence',
    priorities: { expand: 0.4, recruit: 0.2, fortify: 0.1, layLow: -0.2 },
  },
  {
    tag: 'imperialist', category: 'political',
    description: 'Seeks to dominate and rule over others',
    priorities: { expand: 0.3, collectTaxes: 0.2, patrol: 0.2, reform: 0.1, layLow: -0.2 },
    modifiers: { incomeRate: 0.1, corruptionRate: 0.05 },
  },
  {
    tag: 'revolutionary', category: 'political',
    description: 'Seeks to overthrow the established order',
    priorities: { scheme: 0.3, expand: 0.2, recruit: 0.2, diplomacy: -0.1 },
    modifiers: { moraleDecay: -0.1 },
  },
  {
    tag: 'scheming', category: 'political',
    description: 'Works through manipulation and covert action',
    priorities: { scheme: 0.4, bribe: 0.2, diplomacy: 0.1, raid: -0.1 },
    modifiers: { schemeEffect: 0.2 },
  },
  {
    tag: 'honorable', category: 'political',
    description: 'Bound by codes of conduct, keeps their word',
    priorities: { patrol: 0.2, fortify: 0.2, diplomacy: 0.1, scheme: -0.3, raid: -0.2 },
    modifiers: { moraleDecay: -0.15, allianceChance: 0.1 },
  },
  {
    tag: 'treacherous', category: 'political',
    description: 'Breaks promises, backstabs allies for advantage',
    priorities: { scheme: 0.3, raid: 0.1, bribe: 0.1, diplomacy: -0.2 },
    modifiers: { schemeEffect: 0.1, allianceChance: -0.15 },
  },

  // === Social ===
  {
    tag: 'corrupt', category: 'social',
    description: 'Riddled with internal corruption and dysfunction',
    priorities: { collectTaxes: 0.2, reform: 0.1, scheme: 0.1 },
    modifiers: { corruptionRate: 0.2, incomeRate: -0.1 },
  },
  {
    tag: 'disciplined', category: 'social',
    description: 'Well-organized with strong internal order',
    priorities: { patrol: 0.2, fortify: 0.1, recruit: 0.1 },
    modifiers: { combatPower: 0.1, moraleDecay: -0.1, recruitEfficiency: 0.1 },
  },
  {
    tag: 'fanatical', category: 'social',
    description: 'Driven by zealous belief, immune to doubt',
    priorities: { recruit: 0.2, expand: 0.1, raid: 0.1, bribe: -0.3 },
    modifiers: { moraleDecay: -0.2, combatPower: 0.05 },
  },
  {
    tag: 'fractured', category: 'social',
    description: 'Internal divisions weaken the faction',
    priorities: { layLow: 0.2, reform: 0.2, expand: -0.2, raid: -0.1 },
    modifiers: { moraleDecay: 0.15, combatPower: -0.1 },
  },
  {
    tag: 'unified', category: 'social',
    description: 'Strong internal cohesion and shared purpose',
    priorities: { recruit: 0.1, expand: 0.1 },
    modifiers: { moraleDecay: -0.1, combatPower: 0.05 },
  },
  {
    tag: 'decadent', category: 'social',
    description: 'Wealthy but soft, prioritizes luxury over strength',
    priorities: { collectTaxes: 0.2, invest: 0.1, recruit: -0.1, expand: -0.1 },
    modifiers: { corruptionRate: 0.1, moraleDecay: 0.1, incomeRate: 0.1 },
  },
  {
    tag: 'desperate', category: 'social',
    description: 'Backed into a corner, willing to take extreme measures',
    priorities: { raid: 0.3, recruit: 0.2, layLow: -0.2 },
    modifiers: { raidLoot: 0.1, combatPower: 0.05 },
  },
  {
    tag: 'zealous', category: 'social',
    description: 'Fervent believers who fight with conviction',
    priorities: { recruit: 0.2, expand: 0.1, bribe: -0.2 },
    modifiers: { moraleDecay: -0.15, combatPower: 0.05 },
  },

  // === Military ===
  {
    tag: 'raiding', category: 'military',
    description: 'Specializes in hit-and-run attacks and plunder',
    priorities: { raid: 0.4, expand: 0.1, fortify: -0.2 },
    modifiers: { raidLoot: 0.2 },
  },
  {
    tag: 'fortifying', category: 'military',
    description: 'Builds strong defensive positions',
    priorities: { fortify: 0.4, patrol: 0.2, raid: -0.1 },
    modifiers: { defenseBonus: 0.2 },
  },
  {
    tag: 'guerrilla', category: 'military',
    description: 'Uses unconventional tactics, avoids direct confrontation',
    priorities: { raid: 0.3, layLow: 0.1, expand: -0.2, fortify: -0.1 },
    modifiers: { raidLoot: 0.1, combatPower: -0.05 },
  },
  {
    tag: 'siege-capable', category: 'military',
    description: 'Can break fortified positions',
    priorities: { expand: 0.3, fortify: 0.1 },
    modifiers: { combatPower: 0.1 },
  },
  {
    tag: 'mercenary', category: 'military',
    description: 'Fights for pay, hires professional soldiers',
    priorities: { hireMercenaries: 0.3, trade: 0.1, collectTaxes: 0.1 },
    modifiers: { recruitEfficiency: 0.15 },
  },
  {
    tag: 'conscripting', category: 'military',
    description: 'Forces population into military service',
    priorities: { recruit: 0.4, expand: 0.1 },
    modifiers: { recruitEfficiency: 0.2, moraleDecay: 0.1 },
  },
  {
    tag: 'elite', category: 'military',
    description: 'Small but highly trained fighting force',
    priorities: { fortify: 0.1, patrol: 0.2, recruit: -0.1 },
    modifiers: { combatPower: 0.2, recruitEfficiency: -0.1 },
  },

  // === Compound Tags ===
  {
    tag: 'greedy', category: 'compound',
    description: 'Desperate + Exploitative: Prioritizes gold acquisition at any cost',
    priorities: { raid: 0.3, collectTaxes: 0.3, trade: 0.1, invest: -0.2 },
    modifiers: { raidLoot: 0.15, incomeRate: 0.15, corruptionRate: 0.1, moraleDecay: 0.1 },
  },
  {
    tag: 'tyrannical', category: 'compound',
    description: 'Imperialist + Corrupt + Aggressive: Expands through force, breeds internal rot',
    priorities: { expand: 0.3, collectTaxes: 0.3, patrol: 0.2, raid: 0.1, reform: -0.2 },
    modifiers: { combatPower: 0.1, corruptionRate: 0.15, moraleDecay: 0.1, incomeRate: 0.1 },
  },
  {
    tag: 'noble', category: 'compound',
    description: 'Honorable + Disciplined + Defensive: Defends territory, keeps word, slow to attack',
    priorities: { fortify: 0.3, patrol: 0.3, diplomacy: 0.2, raid: -0.3, scheme: -0.3 },
    modifiers: { defenseBonus: 0.15, moraleDecay: -0.2, combatPower: 0.05, allianceChance: 0.15 },
  },
  {
    tag: 'mercantile', category: 'compound',
    description: 'Trading + Opportunistic + Hoarding: Follows coin, plays all sides',
    priorities: { trade: 0.4, invest: 0.2, bribe: 0.2, collectTaxes: 0.1, raid: -0.3, expand: -0.2 },
    modifiers: { tradeIncome: 0.3, incomeRate: 0.15 },
  },
  {
    tag: 'insurgent', category: 'compound',
    description: 'Revolutionary + Guerrilla + Desperate: Raids supply lines, avoids pitched battle',
    priorities: { raid: 0.4, recruit: 0.2, scheme: 0.1, expand: -0.2, fortify: -0.1 },
    modifiers: { raidLoot: 0.15, moraleDecay: -0.1 },
  },
  {
    tag: 'hegemon', category: 'compound',
    description: 'Imperialist + Diplomatic + Patient: Expands through treaties and pressure',
    priorities: { diplomacy: 0.3, expand: 0.2, bribe: 0.2, invest: 0.1, raid: -0.2 },
    modifiers: { allianceChance: 0.2, incomeRate: 0.1 },
  },
  {
    tag: 'zealot', category: 'compound',
    description: 'Fanatical + Aggressive + Unified: Attacks based on ideology, immune to bribes',
    priorities: { expand: 0.3, recruit: 0.3, raid: 0.2, bribe: -0.4, diplomacy: -0.2 },
    modifiers: { moraleDecay: -0.25, combatPower: 0.1 },
  },
  {
    tag: 'pirate', category: 'compound',
    description: 'Raiding + Parasitic + Reckless: Hit-and-run, steals from trade routes',
    priorities: { raid: 0.5, trade: -0.2, fortify: -0.2, diplomacy: -0.2 },
    modifiers: { raidLoot: 0.3, combatPower: -0.05 },
  },
  {
    tag: 'feudal', category: 'compound',
    description: 'Honorable + Expansionist + Disciplined: Grows through loyalty and duty',
    priorities: { expand: 0.2, fortify: 0.2, patrol: 0.2, recruit: 0.1, scheme: -0.3 },
    modifiers: { combatPower: 0.1, moraleDecay: -0.1, defenseBonus: 0.1, recruitEfficiency: 0.1 },
  },
  {
    tag: 'shadow-broker', category: 'compound',
    description: 'Scheming + Trading + Treacherous: Manipulates others, sells information',
    priorities: { scheme: 0.4, bribe: 0.3, trade: 0.2, diplomacy: 0.1, raid: -0.2, expand: -0.2 },
    modifiers: { schemeEffect: 0.25, tradeIncome: 0.1 },
  },
  {
    tag: 'warlord', category: 'compound',
    description: 'Aggressive + Conscripting + Reckless: Pure military expansion',
    priorities: { expand: 0.4, recruit: 0.3, raid: 0.2, diplomacy: -0.3, trade: -0.2 },
    modifiers: { combatPower: 0.15, recruitEfficiency: 0.15, moraleDecay: 0.1 },
  },
  {
    tag: 'merchant-prince', category: 'compound',
    description: 'Trading + Diplomatic + Hoarding: Buys influence, avoids direct conflict',
    priorities: { trade: 0.3, bribe: 0.3, invest: 0.2, diplomacy: 0.2, raid: -0.3, expand: -0.2 },
    modifiers: { tradeIncome: 0.25, incomeRate: 0.15, allianceChance: 0.1 },
  },
  {
    tag: 'cultist', category: 'compound',
    description: 'Fanatical + Scheming + Zealous: Infiltrates, converts, subverts from within',
    priorities: { scheme: 0.4, recruit: 0.2, bribe: 0.1, raid: -0.1 },
    modifiers: { schemeEffect: 0.2, moraleDecay: -0.2 },
  },
  {
    tag: 'nomadic', category: 'compound',
    description: 'Self-sufficient + Guerrilla + Patient: Moves, avoids permanent holdings',
    priorities: { raid: 0.2, layLow: 0.2, recruit: 0.1, fortify: -0.3, invest: -0.2 },
    modifiers: { upkeepRate: -0.15, raidLoot: 0.1 },
  },
  {
    tag: 'decaying-empire', category: 'compound',
    description: 'Imperialist + Corrupt + Decadent: Holds vast territory but rotting from within',
    priorities: { collectTaxes: 0.3, patrol: 0.2, reform: 0.2, expand: -0.1 },
    modifiers: { corruptionRate: 0.2, incomeRate: 0.1, moraleDecay: 0.15, combatPower: -0.1 },
  },
];

// Build a lookup map for quick access
const TAG_MAP = new Map<string, TagBehavior>();
for (const t of BUILTIN_TAGS) {
  TAG_MAP.set(t.tag, t);
}

/** Get a tag definition by name (builtin only) */
export function getTagDef(tag: string): TagBehavior | undefined {
  return TAG_MAP.get(tag);
}

/** Get all builtin tags grouped by category */
export function getTagsByCategory(): Record<TagCategory, TagBehavior[]> {
  const result: Record<TagCategory, TagBehavior[]> = {
    disposition: [], economic: [], political: [], social: [], military: [], compound: [],
  };
  for (const t of BUILTIN_TAGS) {
    result[t.category].push(t);
  }
  return result;
}

/** Get all available tag names */
export function getAllTagNames(): string[] {
  return BUILTIN_TAGS.map(t => t.tag);
}

/**
 * Resolve combined behavior from multiple tags.
 * Priorities and modifiers stack additively with diminishing returns
 * after the first tag contributing to a given priority.
 */
export function resolveTagBehavior(
  tags: string[],
  customTags?: TagBehavior[]
): { priorities: Record<string, number>; modifiers: Record<string, number> } {
  const priorities: Record<string, number> = {};
  const modifiers: Record<string, number> = {};
  const priorityCounts: Record<string, number> = {};
  const modifierCounts: Record<string, number> = {};

  const allDefs = new Map(TAG_MAP);
  if (customTags) {
    for (const ct of customTags) {
      allDefs.set(ct.tag, ct);
    }
  }

  for (const tagName of tags) {
    const def = allDefs.get(tagName);
    if (!def) continue;

    // Stack priorities with diminishing returns
    for (const [key, value] of Object.entries(def.priorities)) {
      if (value === undefined) continue;
      const count = priorityCounts[key] ?? 0;
      const diminish = 1 / (1 + count * 0.3); // 1.0, 0.77, 0.63, 0.53...
      priorities[key] = (priorities[key] ?? 0) + value * diminish;
      priorityCounts[key] = count + 1;
    }

    // Stack modifiers with diminishing returns
    if (def.modifiers) {
      for (const [key, value] of Object.entries(def.modifiers)) {
        if (value === undefined) continue;
        const count = modifierCounts[key] ?? 0;
        const diminish = 1 / (1 + count * 0.3);
        modifiers[key] = (modifiers[key] ?? 0) + value * diminish;
        modifierCounts[key] = count + 1;
      }
    }
  }

  return { priorities, modifiers };
}

/**
 * Map old FactionType to equivalent tag sets for backwards compatibility.
 */
export function factionTypeToTags(type: string): string[] {
  switch (type) {
    case 'empire': return ['decaying-empire'];
    case 'noble': return ['feudal'];
    case 'bandit': return ['insurgent'];
    case 'goblin': return ['warlord'];
    case 'merchant': return ['mercantile'];
    case 'religious': return ['zealot'];
    case 'town': return ['defensive', 'industrious'];
    default: return [];
  }
}
