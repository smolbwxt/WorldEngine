import type { WorldState, Faction, Location, WorldEvent, Season } from './types.js';
import { clamp } from './world-state.js';
import type { SeededRNG } from './rng.js';
import type { SimulationConfig } from './config.js';

/** Process the economy phase: income, taxes, upkeep, trade */
export function processEconomy(state: WorldState, rng: SeededRNG, config: SimulationConfig): WorldEvent[] {
  const events: WorldEvent[] = [];
  const ec = config.economy;

  for (const faction of Object.values(state.factions)) {
    // Income from controlled locations
    let income = 0;
    for (const locId of faction.controlledLocations) {
      const loc = state.locations[locId];
      if (!loc) continue;

      // Base income from prosperity
      const locIncome = Math.floor(loc.prosperity * ec.baseIncomeRate);
      income += locIncome;

      // Trade route bonuses
      for (const tradeTarget of loc.tradeRoutes) {
        const target = state.locations[tradeTarget];
        if (target && target.prosperity > ec.tradeProsperityThreshold) {
          income += Math.floor(target.prosperity * ec.tradeRouteBonus);
        }
      }
    }

    // Tax collection (empire gets extra from taxation, reduced by corruption)
    if (faction.type === 'empire') {
      const taxEfficiency = 1 - faction.corruption / 100;
      income = Math.floor(income * (1 + taxEfficiency * ec.empireTaxBonus));
    }

    // Merchants get trade bonuses
    if (faction.type === 'merchant') {
      income = Math.floor(income * ec.merchantTradeMultiplier);
    }

    // Upkeep costs
    const upkeep = Math.floor(faction.power * ec.armyUpkeepRate) + faction.controlledLocations.length * ec.territoryUpkeepCost;
    const netIncome = income - upkeep;

    faction.gold = Math.max(0, faction.gold + netIncome);

    // If gold runs out, morale and power suffer
    if (faction.gold <= 0 && netIncome < 0) {
      faction.morale = clamp(faction.morale - ec.bankruptcyMoraleHit, 0, 100);
      faction.power = clamp(faction.power - ec.bankruptcyPowerHit, 0, faction.maxPower);
      events.push({
        id: `econ_crisis_${faction.id}_t${state.turn}`,
        turn: state.turn,
        season: state.season,
        year: state.year,
        type: 'trade',
        text: `${faction.name} struggles to pay its troops. Morale and strength are faltering.`,
        icon: '💰',
        factionId: faction.id,
        consequences: [`${faction.name} morale -${ec.bankruptcyMoraleHit}, power -${ec.bankruptcyPowerHit}`],
        hookPotential: 2,
      });
    }

    // Seasonal prosperity adjustments for locations
    for (const locId of faction.controlledLocations) {
      const loc = state.locations[locId];
      if (!loc) continue;

      // Natural prosperity recovery (slow)
      if (loc.prosperity < ec.prosperityRecoveryThreshold && rng.chance(ec.prosperityRecoveryChance)) {
        loc.prosperity = clamp(loc.prosperity + ec.prosperityRecoveryAmount, 0, 100);
      }
    }
  }

  // Seasonal effects on all locations
  applySeasonalEffects(state, rng, config);

  return events;
}

function applySeasonalEffects(state: WorldState, _rng: SeededRNG, config: SimulationConfig): void {
  const season = state.season;
  const sc = config.economy.seasonal;
  for (const loc of Object.values(state.locations)) {
    if (loc.population <= 0) continue;

    switch (season) {
      case 'Winter':
        loc.prosperity = clamp(loc.prosperity + sc.winterProsperityHit, 0, 100);
        break;
      case 'Spring':
        loc.prosperity = clamp(loc.prosperity + sc.springProsperityGain, 0, 100);
        break;
      case 'Summer':
        break;
      case 'Autumn':
        loc.prosperity = clamp(loc.prosperity + sc.autumnProsperityGain, 0, 100);
        break;
    }
  }
}
