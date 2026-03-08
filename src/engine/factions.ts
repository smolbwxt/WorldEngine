import type { WorldState, Faction, Location, FactionAction } from './types.js';
import type { SeededRNG } from './rng.js';
import type { SimulationConfig } from './config.js';
import { resolveTagBehavior, factionTypeToTags } from './tags.js';

/**
 * Tag-based faction AI.
 * Each faction's tags are resolved into behavioral priorities,
 * which are then combined with situational context to choose an action.
 */
export function decideFactionAction(
  faction: Faction,
  state: WorldState,
  rng: SeededRNG,
  config: SimulationConfig
): FactionAction {
  const tags = faction.tags?.length > 0 ? faction.tags : factionTypeToTags(faction.type);
  const customTags = state.definition?.customTags;
  const { priorities } = resolveTagBehavior(tags, customTags);
  const ai = config.factionAI.generic;

  // Build weighted action candidates based on tag priorities + situational context
  const candidates: Array<{ action: FactionAction; weight: number }> = [];

  // --- REFORM ---
  if (faction.corruption > ai.reformCorruptionThreshold) {
    const w = (priorities.reform ?? 0) + 0.3;
    if (w > 0) candidates.push({ action: { type: 'reform' }, weight: w });
  }

  // --- COLLECT TAXES ---
  if (faction.controlledLocations.length > 0) {
    const urgency = faction.gold < ai.taxGoldThreshold ? 0.3 : 0;
    const w = (priorities.collectTaxes ?? 0) + urgency + 0.1;
    if (w > 0) candidates.push({ action: { type: 'collect_taxes' }, weight: w });
  }

  // --- RAID ---
  {
    const desperateBonus = faction.gold < ai.desperateGoldThreshold ? 0.4 : 0;
    const seasonNames = state.definition?.meta.seasonNames ?? ['Spring', 'Summer', 'Autumn', 'Winter'];
    const winterSeason = seasonNames[seasonNames.length - 1] ?? 'Winter';
    const winterBonus = state.season === winterSeason
      && faction.gold < ai.winterGoldThreshold ? 0.2 : 0;
    const w = (priorities.raid ?? 0) + desperateBonus + winterBonus;
    if (w > 0) {
      const target = findRaidTarget(faction, state, rng);
      if (target) candidates.push({ action: { type: 'raid', targetLocationId: target.id }, weight: w });
    }
  }

  // --- EXPAND ---
  if (faction.power > ai.expansionPowerThreshold) {
    const w = (priorities.expand ?? 0) + 0.05;
    if (w > 0) {
      const target = findExpansionTarget(faction, state);
      if (target) candidates.push({ action: { type: 'expand', targetLocationId: target.id }, weight: w });
    }
  }

  // --- RECRUIT ---
  if (faction.power < faction.maxPower * ai.recruitPowerThreshold) {
    const w = (priorities.recruit ?? 0) + 0.15;
    if (w > 0) candidates.push({ action: { type: 'recruit' }, weight: w });
  }

  // --- FORTIFY ---
  if (faction.controlledLocations.length > 0) {
    const threatened = findThreatenedLocations(faction, state);
    const urgency = threatened.length > 0 ? 0.3 : 0;
    const w = (priorities.fortify ?? 0) + urgency;
    if (w > 0) {
      const locId = threatened.length > 0 ? rng.pick(threatened).id : rng.pick(faction.controlledLocations);
      candidates.push({ action: { type: 'fortify', locationId: locId }, weight: w });
    }
  }

  // --- PATROL ---
  if (faction.controlledLocations.length > 0) {
    const w = (priorities.patrol ?? 0) + 0.05;
    if (w > 0) {
      candidates.push({
        action: { type: 'patrol', locationId: rng.pick(faction.controlledLocations) },
        weight: w,
      });
    }
  }

  // --- SEEK ALLIANCE ---
  {
    const w = (priorities.diplomacy ?? 0) + 0.05;
    if (w > 0) {
      const ally = findPotentialAlly(faction, state);
      if (ally) candidates.push({ action: { type: 'seek_alliance', targetFactionId: ally.id }, weight: w });
    }
  }

  // --- SCHEME ---
  {
    const w = (priorities.scheme ?? 0);
    if (w > 0 && faction.power > faction.maxPower * ai.schemePowerThreshold) {
      candidates.push({ action: { type: 'scheme' }, weight: w });
    }
  }

  // --- INVEST ---
  if (faction.gold > ai.investGoldThreshold && faction.controlledLocations.length > 0) {
    const w = (priorities.invest ?? 0) + 0.05;
    if (w > 0) {
      const loc = findBestInvestmentLocation(faction, state);
      if (loc) candidates.push({ action: { type: 'invest', locationId: loc.id }, weight: w });
    }
  }

  // --- BRIBE ---
  if (faction.gold > ai.bribeGoldThreshold) {
    const w = (priorities.bribe ?? 0);
    if (w > 0) {
      const target = findBribeTarget(faction, state);
      if (target) candidates.push({ action: { type: 'bribe', targetFactionId: target.id }, weight: w });
    }
  }

  // --- TRADE ---
  if (faction.controlledLocations.length > 0) {
    const w = (priorities.trade ?? 0);
    if (w > 0) {
      candidates.push({ action: { type: 'trade', locationId: faction.controlledLocations[0] }, weight: w });
    }
  }

  // --- HIRE MERCENARIES ---
  if (faction.gold > ai.hireGoldThreshold) {
    const w = (priorities.hireMercenaries ?? 0);
    if (w > 0) candidates.push({ action: { type: 'hire_mercenaries' }, weight: w });
  }

  // --- LAY LOW ---
  {
    const w = (priorities.layLow ?? 0) + 0.02;
    if (w > 0) candidates.push({ action: { type: 'lay_low' }, weight: w });
  }

  // Filter to positive weights only
  const viable = candidates.filter(c => c.weight > 0);

  if (viable.length === 0) {
    return { type: 'lay_low' };
  }

  // Weighted random pick with personality modifiers
  const personalityMod = (c: { action: FactionAction; weight: number }) => {
    let w = c.weight;
    if (c.action.type === 'raid' || c.action.type === 'expand') {
      w *= 1 + faction.personality.aggression;
    }
    if (c.action.type === 'seek_alliance' || c.action.type === 'bribe' || c.action.type === 'scheme') {
      w *= 1 + faction.personality.dealmaking;
    }
    if (c.action.type === 'collect_taxes' || c.action.type === 'trade' || c.action.type === 'raid') {
      w *= 1 + faction.personality.greed * 0.5;
    }
    return Math.max(0.01, w);
  };

  return rng.weightedPick(viable.map(c => ({ item: c.action, weight: personalityMod(c) })));
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
      loc.defense < 20;
  });
  return candidates.length > 0 ? candidates[0] : null;
}

function findPotentialAlly(faction: Faction, state: WorldState): Faction | null {
  return Object.values(state.factions).find(f =>
    f.id !== faction.id &&
    !faction.enemies.includes(f.id) &&
    !faction.alliances.includes(f.id) &&
    (faction.relationships[f.id] ?? 0) > 0
  ) ?? null;
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
    f.id !== faction.id &&
    !faction.alliances.includes(f.id) &&
    (faction.relationships[f.id] ?? 0) > -50
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
