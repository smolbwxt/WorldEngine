import type { Character, CharacterAbility, WorldState, WorldEvent, Faction, CombatResult } from './types.js';
import type { SeededRNG } from './rng.js';
import { clamp } from './world-state.js';

// ============================================================
// Character Engine
//
// Characters are named NPCs attached to factions and locations.
// They influence battles, can be wounded or killed, and generate
// narrative events. Think Warhammer generals + Civ great people.
// ============================================================

/** Get all living characters for a faction */
export function getFactionCharacters(factionId: string, state: WorldState): Character[] {
  return Object.values(state.characters).filter(
    c => c.factionId === factionId && c.status !== 'dead'
  );
}

/** Get the best available character at a location for combat */
export function getCharacterAtLocation(
  factionId: string,
  locationId: string,
  state: WorldState,
): Character | null {
  const candidates = Object.values(state.characters).filter(
    c => c.factionId === factionId &&
         c.locationId === locationId &&
         c.status === 'active'
  );
  if (candidates.length === 0) return null;
  // Prefer commanders/warchiefs for battle, then champions, then others
  const rolePriority: Record<string, number> = {
    commander: 4, warchief: 4, champion: 3, spymaster: 2, diplomat: 1, advisor: 1,
  };
  candidates.sort((a, b) => (rolePriority[b.role] ?? 0) - (rolePriority[a.role] ?? 0));
  return candidates[0];
}

/** Calculate combat bonus from a character present at battle */
export function getCharacterCombatBonus(char: Character): number {
  let bonus = Math.floor(char.prowess / 3); // base from prowess (1-3)

  for (const ability of char.abilities) {
    if (ability.passive && ability.combatBonus) {
      bonus += ability.combatBonus;
    }
  }

  // Renown bonus: famous leaders inspire troops
  if (char.renown > 60) bonus += 1;
  if (char.renown > 80) bonus += 1;

  return bonus;
}

/** Calculate morale bonus from all active characters in a faction */
export function getFactionMoraleBonus(factionId: string, state: WorldState): number {
  let bonus = 0;
  for (const char of Object.values(state.characters)) {
    if (char.factionId !== factionId || char.status !== 'active') continue;
    for (const ability of char.abilities) {
      if (ability.passive && ability.moraleBonus) {
        bonus += ability.moraleBonus;
      }
    }
  }
  return bonus;
}

/**
 * Death roll — determines if a character dies after a battle.
 * Chance increases with battle severity and decreases with cunning.
 */
export function rollCharacterSurvival(
  char: Character,
  combatOutcome: CombatResult['outcome'],
  wasAttacking: boolean,
  rng: SeededRNG,
): { survived: boolean; wounded: boolean; narrative: string } {
  // Base death chance by outcome severity — significantly higher than before.
  // A character present at a battle is IN the battle. People die in battles.
  const deathChance: Record<string, number> = {
    decisive_victory: wasAttacking ? 0.05 : 0.25,  // losers of a rout die often
    victory: wasAttacking ? 0.08 : 0.18,
    pyrrhic_victory: 0.15,                          // pyrrhic = bloody for everyone
    repelled: wasAttacking ? 0.18 : 0.06,
    routed: wasAttacking ? 0.28 : 0.04,
  };

  let chance = deathChance[combatOutcome] ?? 0.10;

  // Cunning reduces death chance, but capped — you can't outsmart an arrow
  chance *= Math.max(0.5, 1 - char.cunning * 0.05);

  // Champions die more often (they're in the thick of it)
  if (char.role === 'champion') chance *= 1.5;

  // Warchiefs/commanders are exposed too — leading from the front
  if (char.role === 'warchief') chance *= 1.2;

  // Advisors/diplomats rarely die (they're not on the front line)
  if (char.role === 'advisor' || char.role === 'diplomat') chance *= 0.3;

  // Wounded characters are much more vulnerable
  if (char.status === 'wounded') chance *= 2.0;

  // High renown = bigger target. Fame attracts assassins and challengers.
  if (char.renown >= 70) chance *= 1.15;

  const survived = !rng.chance(chance);

  if (!survived) {
    const deathNarratives = [
      `${char.name} fell in the fighting, cut down in the chaos of battle.`,
      `${char.name} was slain — ${char.title} is no more.`,
      `A stray arrow found ${char.name}. They died before anyone could reach them.`,
      `${char.name} fought to the last, surrounded and overwhelmed.`,
      `${char.name} was killed leading a desperate charge.`,
      `${char.name} was pulled from the saddle and never stood again.`,
      `The enemy broke through to ${char.name}'s position. It was over quickly.`,
    ];
    return { survived: false, wounded: false, narrative: rng.pick(deathNarratives) };
  }

  // Wound chance — much more common than death. Wounds pile up and eventually kill.
  const woundChance = chance * 3.0;
  if (rng.chance(woundChance) && char.status === 'active') {
    return {
      survived: true,
      wounded: true,
      narrative: `${char.name} was wounded in the fighting and will need time to recover.`,
    };
  }

  return { survived: true, wounded: false, narrative: '' };
}

/**
 * Roll survival for a character during a raid (lighter than battle, but still risky).
 */
export function rollCharacterRaidSurvival(
  char: Character,
  raidSucceeded: boolean,
  wasRaider: boolean,
  rng: SeededRNG,
): { survived: boolean; wounded: boolean; narrative: string } {
  // Raids are less deadly than pitched battles, but characters can still die
  let chance: number;

  if (wasRaider) {
    chance = raidSucceeded ? 0.04 : 0.12; // failed raids are dangerous for raiders
  } else {
    chance = raidSucceeded ? 0.10 : 0.03; // defenders die when overrun
  }

  // Cunning helps more in raids (ambushes, escape routes)
  chance *= Math.max(0.4, 1 - char.cunning * 0.06);

  if (char.role === 'champion') chance *= 1.3;
  if (char.role === 'advisor' || char.role === 'diplomat') chance *= 0.2;
  if (char.status === 'wounded') chance *= 2.0;

  const survived = !rng.chance(chance);

  if (!survived) {
    const narratives = wasRaider ? [
      `${char.name} was caught in an ambush during the raid and killed.`,
      `${char.name} took an arrow leading the raiders. They didn't make it back.`,
      `${char.name} fell during the raid — a death unworthy of their legend.`,
    ] : [
      `${char.name} was killed defending against the raid.`,
      `${char.name} died in the fighting when raiders overran the defenses.`,
      `A raider's blade found ${char.name} in the chaos. They bled out before dawn.`,
    ];
    return { survived: false, wounded: false, narrative: rng.pick(narratives) };
  }

  const woundChance = chance * 2.5;
  if (rng.chance(woundChance) && char.status === 'active') {
    return {
      survived: true,
      wounded: true,
      narrative: `${char.name} was injured during the raid. A painful reminder of mortality.`,
    };
  }

  return { survived: true, wounded: false, narrative: '' };
}

/**
 * Non-combat death and misfortune events.
 * Called once per turn per character. Assassination, illness, accidents.
 * Chance scales with world danger (corruption, enemies, etc.)
 */
export function rollNonCombatPerils(
  char: Character,
  state: WorldState,
  rng: SeededRNG,
): WorldEvent[] {
  if (char.status !== 'active') return [];

  const events: WorldEvent[] = [];
  const faction = state.factions[char.factionId];
  if (!faction) return [];

  // --- Assassination attempts (enemies + high renown = target)
  const enemyCount = faction.enemies.length;
  const assassinationChance = 0.005 + enemyCount * 0.008 + (char.renown >= 70 ? 0.01 : 0);

  if (rng.chance(assassinationChance)) {
    // Cunning determines if they survive
    const survives = rng.chance(0.3 + char.cunning * 0.07);
    if (!survives) {
      applyCharacterDeath(
        char, `Assassinated at ${state.locations[char.locationId]?.name ?? 'an unknown location'}`,
        state.turn, state, true
      );
      events.push({
        id: `assassination_${char.id}_t${state.turn}`,
        turn: state.turn,
        season: state.season,
        year: state.year,
        type: 'betrayal',
        text: `${char.name} has been assassinated! A blade in the dark ends their story.`,
        icon: '🗡️',
        factionId: char.factionId,
        locationId: char.locationId,
        consequences: [`${faction.name} reels from the loss`],
        hookPotential: 5,
      });
      return events;
    } else {
      // Survived but wounded
      applyCharacterWound(char, state.turn);
      events.push({
        id: `assassination_survive_${char.id}_t${state.turn}`,
        turn: state.turn,
        season: state.season,
        year: state.year,
        type: 'betrayal',
        text: `An assassination attempt on ${char.name}! They survived, but barely — wounded by a poisoned blade.`,
        icon: '🗡️',
        factionId: char.factionId,
        locationId: char.locationId,
        consequences: [`${char.name} wounded by assassin`],
        hookPotential: 4,
      });
      return events;
    }
  }

  // --- Illness / fever (worse in winter, worse when wounded recently)
  const isWinter = state.season === 'Winter';
  const illnessChance = (isWinter ? 0.012 : 0.004) + ((char.timesWounded ?? 0) >= 2 ? 0.008 : 0);

  if (rng.chance(illnessChance)) {
    // Prowess (physical toughness) determines survival
    const survives = rng.chance(0.4 + char.prowess * 0.06);
    if (!survives) {
      applyCharacterDeath(
        char, `Died of fever in ${state.season}, Year ${state.year}`,
        state.turn, state, true
      );
      events.push({
        id: `illness_${char.id}_t${state.turn}`,
        turn: state.turn,
        season: state.season,
        year: state.year,
        type: 'plague',
        text: `${char.name} succumbs to a fever${isWinter ? ' in the bitter cold' : ''}. ${char.title} passes from this world.`,
        icon: '🦠',
        factionId: char.factionId,
        locationId: char.locationId,
        consequences: [`${faction.name} loses their ${char.role}`],
        hookPotential: 4,
      });
    } else {
      applyCharacterWound(char, state.turn);
      events.push({
        id: `illness_survive_${char.id}_t${state.turn}`,
        turn: state.turn,
        season: state.season,
        year: state.year,
        type: 'plague',
        text: `${char.name} falls gravely ill${isWinter ? ' as winter tightens its grip' : ''}. They will recover, but slowly.`,
        icon: '🤒',
        factionId: char.factionId,
        locationId: char.locationId,
        consequences: [`${char.name} bedridden`],
        hookPotential: 2,
      });
    }
  }

  return events;
}

/**
 * Apply character death — updates state and generates consequences.
 * Some deaths have cascading effects (faction leader death = morale crash).
 *
 * If `silent` is true, applies the state changes (death, morale, power)
 * but does NOT generate events — the caller is responsible for the narrative.
 */
export function applyCharacterDeath(
  char: Character,
  cause: string,
  turn: number,
  state: WorldState,
  silent = false,
): WorldEvent[] {
  const events: WorldEvent[] = [];

  char.status = 'dead';
  char.deathTurn = turn;
  char.deathCause = cause;

  const faction = state.factions[char.factionId];
  if (!faction) return events;

  // Morale hit from losing a character
  let moraleLoss = 5 + Math.floor(char.renown / 10);

  // Faction leader death = catastrophic
  if (faction.leader === char.name) {
    moraleLoss += 15;
    faction.morale = clamp(faction.morale - moraleLoss, 0, 100);
    // Power loss from leadership vacuum
    faction.power = clamp(faction.power - Math.floor(faction.power * 0.15), 0, faction.maxPower);

    if (!silent) {
      events.push({
        id: `char_death_leader_${char.id}_t${turn}`,
        turn,
        season: state.season,
        year: state.year,
        type: 'battle',
        text: `${char.name}, ${char.title}, has been killed! ${faction.name} is thrown into disarray.`,
        icon: '💀',
        factionId: faction.id,
        locationId: char.locationId,
        consequences: [
          `${faction.name} morale -${moraleLoss}`,
          `${faction.name} leadership in crisis`,
        ],
        hookPotential: 5,
      });
    }
  } else {
    faction.morale = clamp(faction.morale - moraleLoss, 0, 100);

    if (!silent) {
      events.push({
        id: `char_death_${char.id}_t${turn}`,
        turn,
        season: state.season,
        year: state.year,
        type: 'battle',
        text: `${char.name} has fallen. ${faction.name} mourns their ${char.role}.`,
        icon: '💀',
        factionId: faction.id,
        locationId: char.locationId,
        consequences: [`${faction.name} morale -${moraleLoss}`],
        hookPotential: 4,
      });
    }
  }

  return events;
}

/** Apply wound to a character */
export function applyCharacterWound(char: Character, currentTurn: number): void {
  char.status = 'wounded';
  char.timesWounded = (char.timesWounded ?? 0) + 1;
  char.woundedUntilTurn = currentTurn + 2 + Math.floor(Math.random() * 2); // 2-3 turns
}

/**
 * Process character phase — called each turn.
 * Handles wound recovery, movement toward action, renown decay.
 */
export function processCharacterPhase(state: WorldState, rng: SeededRNG): WorldEvent[] {
  const events: WorldEvent[] = [];

  for (const char of Object.values(state.characters)) {
    if (char.status === 'dead') continue;

    // Wound recovery
    if (char.status === 'wounded' && state.turn >= char.woundedUntilTurn) {
      char.status = 'active';
      events.push({
        id: `char_recover_${char.id}_t${state.turn}`,
        turn: state.turn,
        season: state.season,
        year: state.year,
        type: 'story_hook',
        text: `${char.name} has recovered from their wounds and returns to duty.`,
        icon: '🩹',
        factionId: char.factionId,
        locationId: char.locationId,
        consequences: [],
        hookPotential: 2,
      });
    }

    // Characters drift toward their faction's important locations
    if (char.status === 'active') {
      const faction = state.factions[char.factionId];
      if (!faction) continue;

      // Commanders/warchiefs move to threatened borders
      if (char.role === 'commander' || char.role === 'warchief') {
        const threats = findThreatenedLocations(faction, state);
        if (threats.length > 0 && rng.chance(0.3)) {
          const target = rng.pick(threats);
          if (target !== char.locationId) {
            char.locationId = target;
          }
        }
      }

      // Renown slowly decays if no action
      if (char.renown > 20 && rng.chance(0.1)) {
        char.renown = clamp(char.renown - 1, 0, 100);
      }
    }
  }

  return events;
}

/** Find locations that are adjacent to enemy territory */
function findThreatenedLocations(faction: Faction, state: WorldState): string[] {
  const threatened: string[] = [];
  for (const locId of faction.controlledLocations) {
    const loc = state.locations[locId];
    if (!loc) continue;
    for (const adjId of loc.connectedTo) {
      const adjController = getControllerOf(adjId, state);
      if (adjController && adjController !== faction.id && faction.relationships[adjController] < -30) {
        threatened.push(locId);
        break;
      }
    }
  }
  return threatened.length > 0 ? threatened : faction.controlledLocations;
}

function getControllerOf(locationId: string, state: WorldState): string | null {
  for (const f of Object.values(state.factions)) {
    if (f.controlledLocations.includes(locationId)) return f.id;
  }
  return null;
}

/**
 * After a battle, update renown for participating characters.
 */
export function updateCharacterRenown(
  char: Character,
  won: boolean,
  outcome: CombatResult['outcome'],
): void {
  if (won) {
    const renownGain = outcome === 'decisive_victory' ? 8 :
                       outcome === 'victory' ? 5 :
                       outcome === 'pyrrhic_victory' ? 3 : 1;
    char.renown = clamp(char.renown + renownGain, 0, 100);
    char.battlesWon++;
  } else {
    const renownLoss = outcome === 'routed' ? 5 : 2;
    char.renown = clamp(char.renown - renownLoss, 0, 100);
    char.battlesLost++;
  }
}

// ============================================================
// Character Progression System
//
// The longer a character survives, the more features they
// accumulate — traits, abilities, stat gains, title upgrades.
// Random each turn, weighted by what the character has done.
// Makes long-lived characters feel legendary.
// ============================================================

interface ProgressionEntry {
  weight: number;
  condition: (char: Character, state: WorldState) => boolean;
  apply: (char: Character, state: WorldState, rng: SeededRNG, turn: number) => string | null;
}

/** Traits that characters can gain from battle experience */
const BATTLE_TRAITS = [
  'battle-scarred', 'blood-soaked', 'unflinching', 'merciless',
  'war-weary', 'cold-eyed', 'death-dealer', 'last-one-standing',
];

/** Traits gained from surviving wounds */
const WOUND_TRAITS = [
  'scarred', 'one-eyed', 'limping', 'iron-jawed', 'phantom-pains',
  'half-deaf', 'burned', 'missing-fingers',
];

/** Traits gained from long survival / authority */
const VETERAN_TRAITS = [
  'grizzled', 'veteran', 'iron-willed', 'respected', 'weathered',
  'unyielding', 'old-campaigner', 'seen-it-all',
];

/** Traits gained from high cunning / scheming */
const CUNNING_TRAITS = [
  'shadow-walker', 'nobody-trusts', 'three-steps-ahead', 'knife-in-the-dark',
  'truth-reader', 'masked', 'unsettling', 'never-surprised',
];

/** Traits gained from high renown */
const RENOWN_TRAITS = [
  'legendary', 'the-peoples-hero', 'feared-by-all', 'living-legend',
  'songs-written-about', 'name-spoken-in-whispers', 'icon',
];

/** Earned ability pool — gained through experience */
const ABILITY_POOL: Array<{
  id: string;
  ability: CharacterAbility;
  condition: (char: Character) => boolean;
}> = [
  {
    id: 'bloodied_resolve',
    ability: {
      id: 'bloodied_resolve', name: 'Bloodied Resolve',
      description: 'Years of fighting have forged an iron will. Harder to break, harder to kill.',
      passive: true, combatBonus: 1, moraleBonus: 3,
    },
    condition: c => c.battlesWon >= 3 && c.prowess >= 5,
  },
  {
    id: 'survival_instinct',
    ability: {
      id: 'survival_instinct', name: 'Survival Instinct',
      description: 'Has been wounded enough times to know when to duck.',
      passive: true, combatBonus: 1,
    },
    condition: c => (c.timesWounded ?? 0) >= 2,
  },
  {
    id: 'tactical_adaptation',
    ability: {
      id: 'tactical_adaptation', name: 'Tactical Adaptation',
      description: 'Learned from defeat. Each loss taught a lesson that won\'t be repeated.',
      passive: true, combatBonus: 2,
    },
    condition: c => c.battlesLost >= 2 && c.battlesWon >= 1,
  },
  {
    id: 'aura_of_command',
    ability: {
      id: 'aura_of_command', name: 'Aura of Command',
      description: 'Troops instinctively follow this leader. Presence alone steadies the line.',
      passive: true, moraleBonus: 8,
    },
    condition: c => c.authority >= 7 && c.renown >= 50,
  },
  {
    id: 'old_soldiers_luck',
    ability: {
      id: 'old_soldiers_luck', name: 'Old Soldier\'s Luck',
      description: 'Should have died a dozen times over. Somehow, still standing.',
      passive: true, combatBonus: 1,
    },
    condition: c => c.battlesWon + c.battlesLost >= 5,
  },
  {
    id: 'network_of_informants',
    ability: {
      id: 'network_of_informants', name: 'Network of Informants',
      description: 'Years of cultivating contacts. Nothing happens without word reaching these ears.',
      passive: true, combatBonus: 1, economyBonus: 0.05,
    },
    condition: c => c.cunning >= 7 && (c.role === 'spymaster' || c.role === 'diplomat'),
  },
  {
    id: 'warlords_presence',
    ability: {
      id: 'warlords_presence', name: 'Warlord\'s Presence',
      description: 'The mere sight of this warrior on the field demoralizes the enemy.',
      passive: true, combatBonus: 2, moraleBonus: 5,
    },
    condition: c => c.prowess >= 8 && c.renown >= 70,
  },
  {
    id: 'economizers_eye',
    ability: {
      id: 'economizers_eye', name: 'Economizer\'s Eye',
      description: 'Knows how to stretch a coin. Faction income improved through shrewd management.',
      passive: true, economyBonus: 0.1,
    },
    condition: c => c.authority >= 6 && (c.role === 'advisor' || c.role === 'diplomat'),
  },
  {
    id: 'dread_reputation',
    ability: {
      id: 'dread_reputation', name: 'Dread Reputation',
      description: 'Enemies think twice before engaging. Fear is a weapon all its own.',
      passive: true, combatBonus: 2,
    },
    condition: c => c.renown >= 75 && c.prowess >= 6,
  },
  {
    id: 'unbreakable',
    ability: {
      id: 'unbreakable', name: 'Unbreakable',
      description: 'Has endured what would destroy lesser warriors. Nothing shakes this resolve.',
      passive: true, combatBonus: 1, moraleBonus: 6,
    },
    condition: c => (c.timesWounded ?? 0) >= 3 && c.battlesWon >= 2,
  },
];

/** Title upgrade thresholds */
const TITLE_UPGRADES: Array<{
  condition: (char: Character, yearsActive: number) => boolean;
  titleFn: (char: Character, state: WorldState) => string;
}> = [
  {
    condition: (c, y) => c.battlesWon >= 5 && c.renown >= 60 && y >= 2,
    titleFn: (c) => {
      if (c.role === 'commander' || c.role === 'warchief') return `Warlord of ${c.factionId.replace(/_/g, ' ')}`;
      if (c.role === 'champion') return 'Slayer';
      return `Veteran ${c.role}`;
    },
  },
  {
    condition: (c, y) => c.renown >= 80 && y >= 3,
    titleFn: (c, state) => {
      const faction = state.factions[c.factionId];
      if (c.role === 'commander') return `Grand Marshal of ${faction?.name ?? 'the realm'}`;
      if (c.role === 'warchief') return 'Conqueror';
      if (c.role === 'champion') return 'Legendary Champion';
      if (c.role === 'spymaster') return 'Shadowmaster';
      return `High ${c.role}`;
    },
  },
  {
    condition: (c) => (c.timesWounded ?? 0) >= 3 && c.battlesWon >= 3,
    titleFn: () => 'the Unkillable',
  },
  {
    condition: (c, y) => y >= 5 && c.renown >= 90,
    titleFn: () => 'the Undying',
  },
];

/** Build the progression table */
const PROGRESSION_TABLE: ProgressionEntry[] = [
  // --- TRAIT: Battle experience (need 2+ battles)
  {
    weight: 25,
    condition: (c) => c.battlesWon + c.battlesLost >= 2,
    apply: (char, _state, rng, turn) => {
      const available = BATTLE_TRAITS.filter(t => !char.traits.includes(t));
      if (available.length === 0) return null;
      const trait = rng.pick(available);
      char.traits.push(trait);
      return `${char.name} has become ${trait} — the mark of countless fights.`;
    },
  },

  // --- TRAIT: Wound scars (need wound history)
  {
    weight: 20,
    condition: (c) => (c.timesWounded ?? 0) >= 1,
    apply: (char, _state, rng, turn) => {
      const available = WOUND_TRAITS.filter(t => !char.traits.includes(t));
      if (available.length === 0) return null;
      const trait = rng.pick(available);
      char.traits.push(trait);
      return `${char.name} now bears the mark: ${trait}. A wound that never fully healed.`;
    },
  },

  // --- TRAIT: Veteran (4+ turns active)
  {
    weight: 15,
    condition: (c, state) => (state.turn - (c.activeSince ?? 0)) >= 4,
    apply: (char, _state, rng) => {
      const available = VETERAN_TRAITS.filter(t => !char.traits.includes(t));
      if (available.length === 0) return null;
      const trait = rng.pick(available);
      char.traits.push(trait);
      return `Time has changed ${char.name}. They are now ${trait}.`;
    },
  },

  // --- TRAIT: Cunning (cunning >= 6)
  {
    weight: 10,
    condition: (c) => c.cunning >= 6,
    apply: (char, _state, rng) => {
      const available = CUNNING_TRAITS.filter(t => !char.traits.includes(t));
      if (available.length === 0) return null;
      const trait = rng.pick(available);
      char.traits.push(trait);
      return `${char.name}'s reputation grows darker: ${trait}.`;
    },
  },

  // --- TRAIT: Renown (renown >= 65)
  {
    weight: 10,
    condition: (c) => c.renown >= 65,
    apply: (char, _state, rng) => {
      const available = RENOWN_TRAITS.filter(t => !char.traits.includes(t));
      if (available.length === 0) return null;
      const trait = rng.pick(available);
      char.traits.push(trait);
      return `${char.name} is now known as ${trait}. Their name carries weight.`;
    },
  },

  // --- STAT: Prowess increase from battle
  {
    weight: 15,
    condition: (c) => c.prowess < 10 && c.battlesWon >= 2,
    apply: (char) => {
      char.prowess = clamp(char.prowess + 1, 1, 10);
      return `${char.name}'s prowess grows to ${char.prowess}. Battle is the best teacher.`;
    },
  },

  // --- STAT: Cunning increase from survival
  {
    weight: 12,
    condition: (c) => c.cunning < 10 && ((c.timesWounded ?? 0) >= 1 || c.battlesLost >= 1),
    apply: (char) => {
      char.cunning = clamp(char.cunning + 1, 1, 10);
      return `${char.name}'s cunning sharpens to ${char.cunning}. Hard lessons learned.`;
    },
  },

  // --- STAT: Authority increase from renown
  {
    weight: 12,
    condition: (c) => c.authority < 10 && c.renown >= 50,
    apply: (char) => {
      char.authority = clamp(char.authority + 1, 1, 10);
      return `${char.name}'s authority solidifies at ${char.authority}. People listen when they speak.`;
    },
  },

  // --- ABILITY: Earned ability from experience
  {
    weight: 20,
    condition: (c) => c.battlesWon + c.battlesLost >= 1,
    apply: (char, _state, rng, turn) => {
      const existingIds = new Set(char.abilities.map(a => a.id));
      const eligible = ABILITY_POOL.filter(
        a => !existingIds.has(a.id) && a.condition(char)
      );
      if (eligible.length === 0) return null;
      const chosen = rng.pick(eligible);
      char.abilities.push({ ...chosen.ability, gainedTurn: turn });
      return `${char.name} gains a new ability: ${chosen.ability.name}. ${chosen.ability.description}`;
    },
  },

  // --- TITLE: Upgrade title based on achievements
  {
    weight: 8,
    condition: (c, state) => {
      const yearsActive = Math.floor((state.turn - (c.activeSince ?? 0)) / 4);
      return TITLE_UPGRADES.some(u => u.condition(c, yearsActive));
    },
    apply: (char, state, rng, turn) => {
      const yearsActive = Math.floor((state.turn - (char.activeSince ?? 0)) / 4);
      const eligible = TITLE_UPGRADES.filter(u => u.condition(char, yearsActive));
      if (eligible.length === 0) return null;
      const chosen = rng.pick(eligible);
      const newTitle = chosen.titleFn(char, state);
      if (newTitle === char.title) return null;
      if (!char.titleHistory) char.titleHistory = [];
      char.titleHistory.unshift(char.title);
      char.title = newTitle;
      return `${char.name} is now known as "${newTitle}". A new chapter in their legend.`;
    },
  },
];

/**
 * Roll character progression for a single character.
 * Called once per turn per living character.
 * Base chance increases with years active — longer lived = more progression.
 */
export function rollCharacterProgression(
  char: Character,
  state: WorldState,
  rng: SeededRNG,
): WorldEvent[] {
  if (char.status === 'dead') return [];

  const events: WorldEvent[] = [];
  const turnsActive = state.turn - (char.activeSince ?? 0);
  const yearsActive = Math.floor(turnsActive / 4);

  // Base progression chance: 15% per turn, +5% per year active (up to +25%)
  // So a 5-year veteran has 40% chance per turn of gaining something
  const baseChance = 0.15 + Math.min(0.25, yearsActive * 0.05);

  if (!rng.chance(baseChance)) return [];

  // Filter eligible progressions
  const eligible = PROGRESSION_TABLE.filter(p => p.condition(char, state));
  if (eligible.length === 0) return [];

  // Weighted pick
  const totalWeight = eligible.reduce((sum, p) => sum + p.weight, 0);
  let roll = rng.int(0, totalWeight - 1);
  let chosen: ProgressionEntry | null = null;
  for (const entry of eligible) {
    roll -= entry.weight;
    if (roll < 0) { chosen = entry; break; }
  }
  if (!chosen) return [];

  const narrative = chosen.apply(char, state, rng, state.turn);
  if (!narrative) return [];

  events.push({
    id: `progression_${char.id}_t${state.turn}`,
    turn: state.turn,
    season: state.season,
    year: state.year,
    type: 'story_hook',
    text: narrative,
    icon: '⭐',
    factionId: char.factionId,
    locationId: char.locationId,
    consequences: [],
    hookPotential: 3,
  });

  return events;
}
