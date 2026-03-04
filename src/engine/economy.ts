import type { WorldState, Faction, Location, WorldEvent, Season } from './types.js';
import { clamp } from './world-state.js';
import type { SeededRNG } from './rng.js';

/** Process the economy phase: income, taxes, upkeep, trade */
export function processEconomy(state: WorldState, rng: SeededRNG): WorldEvent[] {
  const events: WorldEvent[] = [];

  for (const faction of Object.values(state.factions)) {
    // Income from controlled locations
    let income = 0;
    for (const locId of faction.controlledLocations) {
      const loc = state.locations[locId];
      if (!loc) continue;

      // Base income from prosperity
      const locIncome = Math.floor(loc.prosperity * 0.3);
      income += locIncome;

      // Trade route bonuses
      for (const tradeTarget of loc.tradeRoutes) {
        const target = state.locations[tradeTarget];
        if (target && target.prosperity > 20) {
          income += Math.floor(target.prosperity * 0.05);
        }
      }
    }

    // Tax collection (empire gets extra from taxation, reduced by corruption)
    if (faction.type === 'empire') {
      const taxEfficiency = 1 - faction.corruption / 100;
      income = Math.floor(income * (1 + taxEfficiency * 0.5));
    }

    // Merchants get trade bonuses
    if (faction.type === 'merchant') {
      income = Math.floor(income * 1.5);
    }

    // Upkeep costs
    const upkeep = Math.floor(faction.power * 0.5) + faction.controlledLocations.length * 3;
    const netIncome = income - upkeep;

    faction.gold = Math.max(0, faction.gold + netIncome);

    // If gold runs out, morale and power suffer
    if (faction.gold <= 0 && netIncome < 0) {
      faction.morale = clamp(faction.morale - 5, 0, 100);
      faction.power = clamp(faction.power - 2, 0, faction.maxPower);
      events.push({
        id: `econ_crisis_${faction.id}_t${state.turn}`,
        turn: state.turn,
        season: state.season,
        year: state.year,
        type: 'trade',
        text: `${faction.name} struggles to pay its troops. Morale and strength are faltering.`,
        icon: '💰',
        factionId: faction.id,
        consequences: [`${faction.name} morale -5, power -2`],
        hookPotential: 2,
      });
    }

    // Seasonal prosperity adjustments for locations
    for (const locId of faction.controlledLocations) {
      const loc = state.locations[locId];
      if (!loc) continue;

      // Natural prosperity recovery (slow)
      if (loc.prosperity < 50 && rng.chance(0.3)) {
        loc.prosperity = clamp(loc.prosperity + 2, 0, 100);
      }
    }
  }

  // Seasonal effects on all locations
  applySeasonalEffects(state, rng);

  return events;
}

function applySeasonalEffects(state: WorldState, _rng: SeededRNG): void {
  const season = state.season;
  for (const loc of Object.values(state.locations)) {
    if (loc.population <= 0) continue;

    switch (season) {
      case 'Winter':
        // Winter is hard on prosperity
        loc.prosperity = clamp(loc.prosperity - 2, 0, 100);
        break;
      case 'Spring':
        // Spring recovery
        loc.prosperity = clamp(loc.prosperity + 1, 0, 100);
        break;
      case 'Summer':
        // Summer is stable
        break;
      case 'Autumn':
        // Harvest time — small boost
        loc.prosperity = clamp(loc.prosperity + 2, 0, 100);
        break;
    }
  }
}
