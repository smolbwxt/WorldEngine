import type { Character, WorldState, WorldEvent, Faction, CombatResult } from './types.js';
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
): { survived: boolean; narrative: string } {
  // Base death chance by outcome severity
  const deathChance: Record<string, number> = {
    decisive_victory: wasAttacking ? 0.02 : 0.15,  // winners rarely die, losers often
    victory: wasAttacking ? 0.03 : 0.10,
    pyrrhic_victory: 0.08,                          // pyrrhic = bloody for everyone
    repelled: wasAttacking ? 0.10 : 0.03,
    routed: wasAttacking ? 0.18 : 0.02,
  };

  let chance = deathChance[combatOutcome] ?? 0.05;

  // Cunning reduces death chance (skilled survivors)
  chance *= Math.max(0.3, 1 - char.cunning * 0.07);

  // Champions die more often (they're in the thick of it)
  if (char.role === 'champion') chance *= 1.4;

  // Advisors/diplomats rarely die (they're not on the front line)
  if (char.role === 'advisor' || char.role === 'diplomat') chance *= 0.3;

  // Wounded characters are more vulnerable
  if (char.status === 'wounded') chance *= 1.8;

  const survived = !rng.chance(chance);

  if (!survived) {
    const deathNarratives = [
      `${char.name} fell in the fighting, cut down in the chaos of battle.`,
      `${char.name} was slain — ${char.title} is no more.`,
      `A stray arrow found ${char.name}. They died before anyone could reach them.`,
      `${char.name} fought to the last, surrounded and overwhelmed.`,
      `${char.name} was killed leading a desperate charge.`,
    ];
    return { survived: false, narrative: rng.pick(deathNarratives) };
  }

  // Wound chance (if survived, might still get wounded)
  const woundChance = chance * 2.5; // wounds are more common than deaths
  if (rng.chance(woundChance) && char.status === 'active') {
    return {
      survived: true,
      narrative: `${char.name} was wounded in the fighting and will need time to recover.`,
    };
  }

  return { survived: true, narrative: '' };
}

/**
 * Apply character death — updates state and generates consequences.
 * Some deaths have cascading effects (faction leader death = morale crash).
 */
export function applyCharacterDeath(
  char: Character,
  cause: string,
  turn: number,
  state: WorldState,
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

    // Power loss from leadership vacuum
    faction.power = clamp(faction.power - Math.floor(faction.power * 0.15), 0, faction.maxPower);
  } else {
    faction.morale = clamp(faction.morale - moraleLoss, 0, 100);

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

  return events;
}

/** Apply wound to a character */
export function applyCharacterWound(char: Character, currentTurn: number): void {
  char.status = 'wounded';
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
