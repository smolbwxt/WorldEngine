import type { WorldState, Faction, Location, WorldEvent, Season, Treaty } from './types.js';
import { clamp } from './world-state.js';
import type { SeededRNG } from './rng.js';
import type { SimulationConfig } from './config.js';

/** Process the economy phase: income, taxes, upkeep, trade, treaties */
export function processEconomy(state: WorldState, rng: SeededRNG, config: SimulationConfig): WorldEvent[] {
  const events: WorldEvent[] = [];
  const ec = config.economy;
  const lb = config.locationBonuses;

  for (const faction of Object.values(state.factions)) {
    // Income from controlled locations (with location type bonuses)
    let income = 0;
    for (const locId of faction.controlledLocations) {
      const loc = state.locations[locId];
      if (!loc) continue;

      // Base income from prosperity × location type multiplier
      const typeMultiplier = lb[loc.type] ?? 1.0;
      const locIncome = Math.floor(loc.prosperity * ec.baseIncomeRate * typeMultiplier);
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

  // Process active treaties — gold transfers
  events.push(...processTreatyPayments(state, config));

  // Seasonal effects on all locations
  applySeasonalEffects(state, rng, config);

  return events;
}

/** Process treaty payments and expirations */
function processTreatyPayments(state: WorldState, config: SimulationConfig): WorldEvent[] {
  const events: WorldEvent[] = [];
  const remaining: Treaty[] = [];

  for (const treaty of state.activeTreaties) {
    // Expire treaties
    if (treaty.terms.duration > 0) {
      treaty.terms.duration--;
      if (treaty.terms.duration <= 0) {
        events.push({
          id: `treaty_expire_${treaty.id}_t${state.turn}`,
          turn: state.turn, season: state.season, year: state.year,
          type: 'treaty',
          text: `The ${treaty.type.replace(/_/g, ' ')} between ${state.factions[treaty.parties[0]]?.name ?? treaty.parties[0]} and ${state.factions[treaty.parties[1]]?.name ?? treaty.parties[1]} has expired.`,
          icon: '📜', consequences: ['Treaty expired'], hookPotential: 2,
        });
        continue; // don't keep
      }
    }

    // Process gold-per-turn transfers
    if (treaty.terms.goldPerTurn) {
      const payer = state.factions[treaty.parties[0]];
      const payee = state.factions[treaty.parties[1]];
      if (payer && payee) {
        const amount = Math.min(treaty.terms.goldPerTurn, payer.gold);
        payer.gold -= amount;
        payee.gold += amount;
      }
    }

    // Trade agreements: both sides get a small income bonus
    if (treaty.type === 'trade_agreement') {
      const f1 = state.factions[treaty.parties[0]];
      const f2 = state.factions[treaty.parties[1]];
      if (f1 && f2) {
        const bonus = 5;
        f1.gold += bonus;
        f2.gold += bonus;
      }
    }

    remaining.push(treaty);
  }

  state.activeTreaties = remaining;
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
