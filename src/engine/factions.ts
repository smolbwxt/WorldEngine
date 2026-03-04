import type { WorldState, Faction, Location, FactionAction } from './types.js';
import type { SeededRNG } from './rng.js';
import type { SimulationConfig } from './config.js';

/**
 * Each faction evaluates its situation and chooses an action.
 * The logic is *motivated* — factions act based on goals, resources, and threats.
 */
export function decideFactionAction(
  faction: Faction,
  state: WorldState,
  rng: SeededRNG,
  config: SimulationConfig
): FactionAction {
  switch (faction.type) {
    case 'empire':
      return decideEmpireAction(faction, state, rng, config);
    case 'noble':
      return decideNobleAction(faction, state, rng, config);
    case 'bandit':
      return decideBanditAction(faction, state, rng, config);
    case 'goblin':
      return decideGoblinAction(faction, state, rng, config);
    case 'merchant':
      return decideMerchantAction(faction, state, rng, config);
    default:
      return { type: 'lay_low' };
  }
}

function decideEmpireAction(faction: Faction, state: WorldState, rng: SeededRNG, config: SimulationConfig): FactionAction {
  const ai = config.factionAI.empire;

  // If corruption is critical, attempt reform
  if (faction.corruption > ai.reformCorruptionThreshold && rng.chance(ai.reformChance)) {
    return { type: 'reform' };
  }

  // If gold is low, collect taxes
  if (faction.gold < ai.taxGoldThreshold) {
    return { type: 'collect_taxes' };
  }

  // Patrol to suppress threats near controlled locations
  const threatenedLocations = findThreatenedLocations(faction, state);
  if (threatenedLocations.length > 0) {
    return { type: 'patrol', locationId: rng.pick(threatenedLocations).id };
  }

  // Default: collect taxes
  return { type: 'collect_taxes' };
}

function decideNobleAction(faction: Faction, state: WorldState, rng: SeededRNG, config: SimulationConfig): FactionAction {
  const ai = config.factionAI.noble;
  const isAmbitious = faction.leaderTraits.includes('ambitious') || faction.leaderTraits.includes('calculating');
  const isPrincipled = faction.leaderTraits.includes('principled') || faction.leaderTraits.includes('brave');

  // Principled nobles prioritize defense
  if (isPrincipled) {
    const threatened = findThreatenedLocations(faction, state);
    if (threatened.length > 0) {
      return { type: 'fortify', locationId: threatened[0].id };
    }
    if (faction.power < faction.maxPower * ai.principledRecruitThreshold) {
      return { type: 'recruit' };
    }
    if (faction.controlledLocations.length > 0) {
      return { type: 'patrol', locationId: rng.pick(faction.controlledLocations) };
    }
  }

  // Ambitious nobles scheme and build power
  if (isAmbitious) {
    if (faction.power < faction.maxPower * ai.ambitiousRecruitThreshold) {
      return { type: 'recruit' };
    }
    if (faction.power > faction.maxPower * ai.schemePowerThreshold && rng.chance(ai.schemeChance)) {
      return { type: 'scheme' };
    }
    const potentialAlly = findPotentialAlly(faction, state);
    if (potentialAlly && rng.chance(ai.allianceChance)) {
      return { type: 'seek_alliance', targetFactionId: potentialAlly.id };
    }
    if (faction.controlledLocations.length > 0) {
      return { type: 'fortify', locationId: rng.pick(faction.controlledLocations) };
    }
  }

  return { type: 'recruit' };
}

function decideBanditAction(faction: Faction, state: WorldState, rng: SeededRNG, config: SimulationConfig): FactionAction {
  const ai = config.factionAI.bandit;
  const isWinter = state.season === 'Winter';
  const isDesperateForGold = faction.gold < ai.desperateGoldThreshold;
  const isStrong = faction.power > ai.expansionPowerThreshold;

  // Desperate: must raid
  if (isDesperateForGold || (isWinter && faction.gold < ai.winterGoldThreshold)) {
    const target = findRaidTarget(faction, state, rng);
    if (target) return { type: 'raid', targetLocationId: target.id };
  }

  // Check if empire patrols are nearby
  const empirePatrolNearby = isEmpirePatrolNearby(faction, state);
  if (empirePatrolNearby && rng.chance(ai.cautionChance)) {
    return rng.chance(0.5) ? { type: 'lay_low' } : { type: 'recruit' };
  }

  // Strong enough to expand?
  if (isStrong && rng.chance(ai.expansionChance)) {
    const expandTarget = findExpansionTarget(faction, state);
    if (expandTarget) {
      return { type: 'expand', targetLocationId: expandTarget.id };
    }
  }

  // Opportunistic raid
  if (rng.chance(ai.raidChance)) {
    const target = findRaidTarget(faction, state, rng);
    if (target) return { type: 'raid', targetLocationId: target.id };
  }

  return { type: 'recruit' };
}

function decideGoblinAction(faction: Faction, state: WorldState, rng: SeededRNG, config: SimulationConfig): FactionAction {
  const ai = config.factionAI.goblin;

  // If strong, expand into weak territory
  if (faction.power > ai.expansionPowerThreshold && rng.chance(ai.expansionChance)) {
    const target = findExpansionTarget(faction, state);
    if (target) return { type: 'expand', targetLocationId: target.id };
  }

  // Raid accessible settlements
  if (rng.chance(ai.raidChance)) {
    const target = findRaidTarget(faction, state, rng);
    if (target) return { type: 'raid', targetLocationId: target.id };
  }

  // Build strength
  if (faction.power < faction.maxPower * ai.recruitPowerThreshold) {
    return { type: 'recruit' };
  }

  // Fortify home base
  if (faction.controlledLocations.length > 0) {
    return { type: 'fortify', locationId: faction.controlledLocations[0] };
  }

  return { type: 'recruit' };
}

function decideMerchantAction(faction: Faction, state: WorldState, rng: SeededRNG, config: SimulationConfig): FactionAction {
  const ai = config.factionAI.merchant;

  // If trade routes are threatened, hire mercenaries
  const threatsNearTrade = findThreatsNearTradeRoutes(faction, state);
  if (threatsNearTrade && faction.gold > ai.hireGoldThreshold) {
    return { type: 'hire_mercenaries' };
  }

  // Invest in prosperous locations
  if (faction.gold > ai.investGoldThreshold && rng.chance(ai.investChance)) {
    const bestLoc = findBestInvestmentLocation(faction, state);
    if (bestLoc) return { type: 'invest', locationId: bestLoc.id };
  }

  // Bribe powerful factions for safety
  if (faction.gold > ai.bribeGoldThreshold && rng.chance(ai.bribeChance)) {
    const bribeTarget = findBribeTarget(faction, state);
    if (bribeTarget) return { type: 'bribe', targetFactionId: bribeTarget.id };
  }

  // Trade
  if (faction.controlledLocations.length > 0) {
    return { type: 'trade', locationId: faction.controlledLocations[0] };
  }

  return { type: 'lay_low' };
}

// === Helper Functions ===

function findThreatenedLocations(faction: Faction, state: WorldState): Location[] {
  const threatened: Location[] = [];
  for (const locId of faction.controlledLocations) {
    const loc = state.locations[locId];
    if (!loc) continue;
    for (const adjId of loc.connectedTo) {
      const adjLoc = state.locations[adjId];
      if (!adjLoc) continue;
      const controller = getLocationController(adjId, state);
      if (controller && faction.enemies.includes(controller.id)) {
        threatened.push(loc);
        break;
      }
    }
  }
  return threatened;
}

function findRaidTarget(faction: Faction, state: WorldState, rng: SeededRNG): Location | null {
  const reachable = getReachableLocations(faction, state);
  const targets = reachable
    .filter(loc => {
      const controller = getLocationController(loc.id, state);
      return (!controller || controller.id !== faction.id) && loc.prosperity > 10;
    })
    .sort((a, b) => {
      const scoreA = a.prosperity - a.defense;
      const scoreB = b.prosperity - b.defense;
      return scoreB - scoreA;
    });

  if (targets.length === 0) return null;

  const topTargets = targets.slice(0, Math.min(3, targets.length));
  return rng.pick(topTargets);
}

function findExpansionTarget(faction: Faction, state: WorldState): Location | null {
  const reachable = getReachableLocations(faction, state);
  const candidates = reachable.filter(loc => {
    const controller = getLocationController(loc.id, state);
    return (!controller || controller.power < faction.power * 0.5) &&
      (loc.type === 'ruins' || loc.type === 'village') &&
      loc.defense < 20;
  });
  return candidates.length > 0 ? candidates[0] : null;
}

function findPotentialAlly(faction: Faction, state: WorldState): Faction | null {
  return Object.values(state.factions).find(f =>
    f.id !== faction.id &&
    !faction.enemies.includes(f.id) &&
    !faction.alliances.includes(f.id) &&
    (faction.relationships[f.id] ?? 0) > 0 &&
    f.type !== 'bandit' && f.type !== 'goblin'
  ) ?? null;
}

function isEmpirePatrolNearby(faction: Faction, state: WorldState): boolean {
  const empire = state.factions['aurelian_crown'];
  if (!empire) return false;
  for (const locId of faction.controlledLocations) {
    const loc = state.locations[locId];
    if (!loc) continue;
    for (const adjId of loc.connectedTo) {
      if (empire.controlledLocations.includes(adjId)) return true;
    }
  }
  return false;
}

function findThreatsNearTradeRoutes(faction: Faction, state: WorldState): boolean {
  for (const locId of faction.controlledLocations) {
    const loc = state.locations[locId];
    if (!loc) continue;
    for (const tradeId of loc.tradeRoutes) {
      const tradeLoc = state.locations[tradeId];
      if (!tradeLoc) continue;
      for (const adjId of tradeLoc.connectedTo) {
        const controller = getLocationController(adjId, state);
        if (controller && (controller.type === 'bandit' || controller.type === 'goblin')) {
          return true;
        }
      }
    }
  }
  return false;
}

function findBestInvestmentLocation(faction: Faction, state: WorldState): Location | null {
  let best: Location | null = null;
  let bestScore = -1;
  for (const locId of faction.controlledLocations) {
    const loc = state.locations[locId];
    if (!loc) continue;
    const score = (100 - loc.prosperity) + loc.population / 100;
    if (score > bestScore) {
      bestScore = score;
      best = loc;
    }
  }
  return best;
}

function findBribeTarget(faction: Faction, state: WorldState): Faction | null {
  return Object.values(state.factions).find(f =>
    f.type === 'noble' || f.type === 'empire'
  ) ?? null;
}

function getReachableLocations(faction: Faction, state: WorldState): Location[] {
  const reachable = new Set<string>();
  for (const locId of faction.controlledLocations) {
    const loc = state.locations[locId];
    if (!loc) continue;
    for (const adjId of loc.connectedTo) {
      reachable.add(adjId);
    }
  }
  if (faction.controlledLocations.length === 0) {
    for (const loc of Object.values(state.locations)) {
      if (loc.defense < 20 && loc.prosperity > 10) {
        reachable.add(loc.id);
      }
    }
  }
  return Array.from(reachable)
    .map(id => state.locations[id])
    .filter((l): l is Location => l !== undefined);
}

export function getLocationController(locationId: string, state: WorldState): Faction | null {
  for (const faction of Object.values(state.factions)) {
    if (faction.controlledLocations.includes(locationId)) {
      return faction;
    }
  }
  return null;
}
