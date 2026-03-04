import type { Faction, Location, CombatResult } from './types.js';
import type { SeededRNG } from './rng.js';
import type { SimulationConfig } from './config.js';

export function resolveCombat(
  attacker: Faction,
  defender: Faction,
  targetLocation: Location | null,
  rng: SeededRNG,
  config: SimulationConfig
): CombatResult {
  const cc = config.combat;
  const moraleBonus = (f: Faction) =>
    f.morale > cc.highMoraleThreshold ? cc.moraleModifier :
    f.morale < cc.lowMoraleThreshold ? -cc.moraleModifier : 0;

  const attackerRoll =
    rng.d20() +
    Math.floor(attacker.power / cc.powerRollDivisor) +
    moraleBonus(attacker);

  let defenderRoll =
    rng.d20() +
    Math.floor(defender.power / cc.powerRollDivisor) +
    moraleBonus(defender);

  // Location bonuses for defender
  if (targetLocation) {
    defenderRoll += Math.floor(targetLocation.defense / cc.fortificationDivisor);
    if (targetLocation.type === 'fortress') defenderRoll += cc.fortressBonus;
    if (targetLocation.type === 'castle') defenderRoll += cc.castleBonus;
    if (targetLocation.type === 'lair') defenderRoll += cc.lairBonus;
  }

  const margin = attackerRoll - defenderRoll;

  let outcome: CombatResult['outcome'];
  let attackerLosses: number;
  let defenderLosses: number;
  let territoryChanged: boolean;

  if (margin > cc.decisiveVictoryMargin) {
    outcome = 'decisive_victory';
    attackerLosses = Math.floor(attacker.power * cc.losses.decisiveVictory[0]);
    defenderLosses = Math.floor(defender.power * cc.losses.decisiveVictory[1]);
    territoryChanged = true;
  } else if (margin > cc.victoryMargin) {
    outcome = 'victory';
    attackerLosses = Math.floor(attacker.power * cc.losses.victory[0]);
    defenderLosses = Math.floor(defender.power * cc.losses.victory[1]);
    territoryChanged = targetLocation?.type === 'village' || targetLocation?.type === 'ruins';
  } else if (margin > 0) {
    outcome = 'pyrrhic_victory';
    attackerLosses = Math.floor(attacker.power * cc.losses.pyrrhicVictory[0]);
    defenderLosses = Math.floor(defender.power * cc.losses.pyrrhicVictory[1]);
    territoryChanged = false;
  } else if (margin > -cc.victoryMargin) {
    outcome = 'repelled';
    attackerLosses = Math.floor(attacker.power * cc.losses.repelled[0]);
    defenderLosses = Math.floor(defender.power * cc.losses.repelled[1]);
    territoryChanged = false;
  } else {
    outcome = 'routed';
    attackerLosses = Math.floor(attacker.power * cc.losses.routed[0]);
    defenderLosses = Math.floor(defender.power * cc.losses.routed[1]);
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
  rng: SeededRNG,
  config: SimulationConfig
): { success: boolean; lootGold: number; prosperityDamage: number; raiderLosses: number } {
  const rc = config.raid;
  const raidRoll = rng.d20() + Math.floor(raider.power / rc.raiderPowerDivisor);
  const defenseRoll = rng.d20() + Math.floor(targetLocation.defense / rc.defenseRollDivisor) +
    (defenderFaction ? Math.floor(defenderFaction.power / rc.garrisonPowerDivisor) : 0);

  const margin = raidRoll - defenseRoll;

  if (margin > 0) {
    const lootGold = Math.floor(targetLocation.prosperity * rc.lootProsperityRate) + rng.int(rc.lootRandomRange[0], rc.lootRandomRange[1]);
    const prosperityDamage = rng.int(rc.prosperityDamageRange[0], rc.prosperityDamageRange[1]);
    const raiderLosses = margin > rc.cleanRaidMargin ? 0 : rng.int(rc.raiderWinLossRange[0], rc.raiderWinLossRange[1]);
    return { success: true, lootGold, prosperityDamage, raiderLosses };
  } else {
    return { success: false, lootGold: 0, prosperityDamage: 0, raiderLosses: rng.int(rc.raiderFailLossRange[0], rc.raiderFailLossRange[1]) };
  }
}
