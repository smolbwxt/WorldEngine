import type { Faction, Location, CombatResult } from './types.js';
import type { SeededRNG } from './rng.js';

export function resolveCombat(
  attacker: Faction,
  defender: Faction,
  targetLocation: Location | null,
  rng: SeededRNG
): CombatResult {
  const moraleBonus = (f: Faction) => (f.morale > 60 ? 2 : f.morale < 30 ? -2 : 0);

  const attackerRoll =
    rng.d20() +
    Math.floor(attacker.power / 5) +
    moraleBonus(attacker);

  let defenderRoll =
    rng.d20() +
    Math.floor(defender.power / 5) +
    moraleBonus(defender);

  // Location bonuses for defender
  if (targetLocation) {
    defenderRoll += Math.floor(targetLocation.defense / 10); // fortification bonus
    // Terrain: fortresses and castles give extra bonus
    if (targetLocation.type === 'fortress') defenderRoll += 3;
    if (targetLocation.type === 'castle') defenderRoll += 2;
    if (targetLocation.type === 'lair') defenderRoll += 2; // home turf
  }

  const margin = attackerRoll - defenderRoll;

  let outcome: CombatResult['outcome'];
  let attackerLosses: number;
  let defenderLosses: number;
  let territoryChanged: boolean;

  if (margin > 10) {
    outcome = 'decisive_victory';
    attackerLosses = Math.floor(attacker.power * 0.05);
    defenderLosses = Math.floor(defender.power * 0.3);
    territoryChanged = true;
  } else if (margin > 5) {
    outcome = 'victory';
    attackerLosses = Math.floor(attacker.power * 0.1);
    defenderLosses = Math.floor(defender.power * 0.2);
    territoryChanged = targetLocation?.type === 'village' || targetLocation?.type === 'ruins';
  } else if (margin > 0) {
    outcome = 'pyrrhic_victory';
    attackerLosses = Math.floor(attacker.power * 0.2);
    defenderLosses = Math.floor(defender.power * 0.15);
    territoryChanged = false;
  } else if (margin > -5) {
    outcome = 'repelled';
    attackerLosses = Math.floor(attacker.power * 0.1);
    defenderLosses = Math.floor(defender.power * 0.05);
    territoryChanged = false;
  } else {
    outcome = 'routed';
    attackerLosses = Math.floor(attacker.power * 0.25);
    defenderLosses = Math.floor(defender.power * 0.03);
    territoryChanged = false;
  }

  return {
    attackerRoll,
    defenderRoll,
    margin,
    outcome,
    attackerLosses,
    defenderLosses,
    territoryChanged,
  };
}

/** Resolve a raid — lighter than a full battle */
export function resolveRaid(
  raider: Faction,
  targetLocation: Location,
  defenderFaction: Faction | null,
  rng: SeededRNG
): { success: boolean; lootGold: number; prosperityDamage: number; raiderLosses: number } {
  const raidRoll = rng.d20() + Math.floor(raider.power / 5);
  const defenseRoll = rng.d20() + Math.floor(targetLocation.defense / 3) +
    (defenderFaction ? Math.floor(defenderFaction.power / 10) : 0);

  const margin = raidRoll - defenseRoll;

  if (margin > 0) {
    const lootGold = Math.floor(targetLocation.prosperity * 0.3) + rng.int(5, 15);
    const prosperityDamage = rng.int(5, 15);
    const raiderLosses = margin > 10 ? 0 : rng.int(1, 3);
    return { success: true, lootGold, prosperityDamage, raiderLosses };
  } else {
    return { success: false, lootGold: 0, prosperityDamage: 0, raiderLosses: rng.int(2, 5) };
  }
}
