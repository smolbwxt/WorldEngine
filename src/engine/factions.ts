import type { WorldState, Faction, Location, FactionAction } from './types.js';
import type { SeededRNG } from './rng.js';

/**
 * Each faction evaluates its situation and chooses an action.
 * The logic is *motivated* — factions act based on goals, resources, and threats.
 */
export function decideFactionAction(
  faction: Faction,
  state: WorldState,
  rng: SeededRNG
): FactionAction {
  switch (faction.type) {
    case 'empire':
      return decideEmpireAction(faction, state, rng);
    case 'noble':
      return decideNobleAction(faction, state, rng);
    case 'bandit':
      return decideBanditAction(faction, state, rng);
    case 'goblin':
      return decideGoblinAction(faction, state, rng);
    case 'merchant':
      return decideMerchantAction(faction, state, rng);
    default:
      return { type: 'lay_low' };
  }
}

function decideEmpireAction(faction: Faction, state: WorldState, rng: SeededRNG): FactionAction {
  // Empire priorities: deal with corruption, collect taxes, patrol

  // If corruption is critical, attempt reform
  if (faction.corruption > 80 && rng.chance(0.3)) {
    return { type: 'reform' };
  }

  // If gold is low, collect taxes
  if (faction.gold < 100) {
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

function decideNobleAction(faction: Faction, state: WorldState, rng: SeededRNG): FactionAction {
  const isAmbitious = faction.leaderTraits.includes('ambitious') || faction.leaderTraits.includes('calculating');
  const isPrincipled = faction.leaderTraits.includes('principled') || faction.leaderTraits.includes('brave');

  // Principled nobles prioritize defense
  if (isPrincipled) {
    const threatened = findThreatenedLocations(faction, state);
    if (threatened.length > 0) {
      // Fortify the most threatened location
      return { type: 'fortify', locationId: threatened[0].id };
    }
    // Recruit if power is low
    if (faction.power < faction.maxPower * 0.6) {
      return { type: 'recruit' };
    }
    // Patrol
    if (faction.controlledLocations.length > 0) {
      return { type: 'patrol', locationId: rng.pick(faction.controlledLocations) };
    }
  }

  // Ambitious nobles scheme and build power
  if (isAmbitious) {
    // Build strength
    if (faction.power < faction.maxPower * 0.8) {
      return { type: 'recruit' };
    }
    // Scheme if powerful enough
    if (faction.power > faction.maxPower * 0.7 && rng.chance(0.4)) {
      return { type: 'scheme' };
    }
    // Seek alliances with other powerful factions
    const potentialAlly = findPotentialAlly(faction, state);
    if (potentialAlly && rng.chance(0.3)) {
      return { type: 'seek_alliance', targetFactionId: potentialAlly.id };
    }
    // Fortify holdings
    if (faction.controlledLocations.length > 0) {
      return { type: 'fortify', locationId: rng.pick(faction.controlledLocations) };
    }
  }

  return { type: 'recruit' };
}

function decideBanditAction(faction: Faction, state: WorldState, rng: SeededRNG): FactionAction {
  const isWinter = state.season === 'Winter';
  const isDesperateForGold = faction.gold < 20;
  const isStrong = faction.power > 20;

  // Desperate: must raid
  if (isDesperateForGold || (isWinter && faction.gold < 40)) {
    const target = findRaidTarget(faction, state, rng);
    if (target) return { type: 'raid', targetLocationId: target.id };
  }

  // Check if empire patrols are nearby
  const empirePatrolNearby = isEmpirePatrolNearby(faction, state);
  if (empirePatrolNearby && rng.chance(0.6)) {
    // Lay low and recruit quietly
    return rng.chance(0.5) ? { type: 'lay_low' } : { type: 'recruit' };
  }

  // Strong enough to expand?
  if (isStrong && rng.chance(0.3)) {
    const expandTarget = findExpansionTarget(faction, state);
    if (expandTarget) {
      return { type: 'expand', targetLocationId: expandTarget.id };
    }
  }

  // Opportunistic raid
  if (rng.chance(0.5)) {
    const target = findRaidTarget(faction, state, rng);
    if (target) return { type: 'raid', targetLocationId: target.id };
  }

  // Recruit
  return { type: 'recruit' };
}

function decideGoblinAction(faction: Faction, state: WorldState, rng: SeededRNG): FactionAction {
  // Goblins: aggressive expansion, raiding, and strength building

  // If strong, expand into weak territory
  if (faction.power > 25 && rng.chance(0.4)) {
    const target = findExpansionTarget(faction, state);
    if (target) return { type: 'expand', targetLocationId: target.id };
  }

  // Raid accessible settlements
  if (rng.chance(0.5)) {
    const target = findRaidTarget(faction, state, rng);
    if (target) return { type: 'raid', targetLocationId: target.id };
  }

  // Build strength
  if (faction.power < faction.maxPower * 0.7) {
    return { type: 'recruit' };
  }

  // Fortify home base
  if (faction.controlledLocations.length > 0) {
    return { type: 'fortify', locationId: faction.controlledLocations[0] };
  }

  return { type: 'recruit' };
}

function decideMerchantAction(faction: Faction, state: WorldState, rng: SeededRNG): FactionAction {
  // Merchants: invest in safety, bribe for influence, hire mercs

  // If trade routes are threatened, hire mercenaries
  const threatsNearTrade = findThreatsNearTradeRoutes(faction, state);
  if (threatsNearTrade && faction.gold > 50) {
    return { type: 'hire_mercenaries' };
  }

  // Invest in prosperous locations
  if (faction.gold > 100 && rng.chance(0.4)) {
    const bestLoc = findBestInvestmentLocation(faction, state);
    if (bestLoc) return { type: 'invest', locationId: bestLoc.id };
  }

  // Bribe powerful factions for safety
  if (faction.gold > 150 && rng.chance(0.3)) {
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
    // Check if any enemy faction controls or is near adjacent locations
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
  // Find accessible locations that are prosperous and poorly defended
  const reachable = getReachableLocations(faction, state);
  const targets = reachable
    .filter(loc => {
      const controller = getLocationController(loc.id, state);
      return (!controller || controller.id !== faction.id) && loc.prosperity > 10;
    })
    .sort((a, b) => {
      // Prefer: high prosperity, low defense
      const scoreA = a.prosperity - a.defense;
      const scoreB = b.prosperity - b.defense;
      return scoreB - scoreA;
    });

  if (targets.length === 0) return null;

  // Pick from top targets with some randomness
  const topTargets = targets.slice(0, Math.min(3, targets.length));
  return rng.pick(topTargets);
}

function findExpansionTarget(faction: Faction, state: WorldState): Location | null {
  const reachable = getReachableLocations(faction, state);
  // Look for uncontrolled or weakly held ruins/villages
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
  // Check if any empire location is adjacent to bandit territory
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
    // Invest in locations with room to grow
    const score = (100 - loc.prosperity) + loc.population / 100;
    if (score > bestScore) {
      bestScore = score;
      best = loc;
    }
  }
  return best;
}

function findBribeTarget(faction: Faction, state: WorldState): Faction | null {
  // Bribe the strongest threatening faction
  return Object.values(state.factions).find(f =>
    f.type === 'noble' || f.type === 'empire'
  ) ?? null;
}

function getReachableLocations(faction: Faction, state: WorldState): Location[] {
  const reachable = new Set<string>();
  // Start from controlled locations and find adjacent ones
  for (const locId of faction.controlledLocations) {
    const loc = state.locations[locId];
    if (!loc) continue;
    for (const adjId of loc.connectedTo) {
      reachable.add(adjId);
    }
  }
  // Nomadic factions (no territory) can reach locations near their enemies/known areas
  if (faction.controlledLocations.length === 0) {
    // Can target any weakly defended location
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
