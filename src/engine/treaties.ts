import type { WorldState, Faction, Treaty, TreatyType, WorldEvent } from './types.js';
import { clamp } from './world-state.js';
import type { SeededRNG } from './rng.js';
import type { SimulationConfig } from './config.js';

/** Evaluate whether a faction would accept a treaty proposal */
export function evaluateTreatyProposal(
  proposer: Faction,
  target: Faction,
  treatyType: TreatyType,
  terms: Treaty['terms'],
  state: WorldState,
  rng: SeededRNG,
  config: SimulationConfig,
): boolean {
  const dc = config.diplomacy;
  const relationship = target.relationships[proposer.id] ?? 0;

  // Too hostile to even consider
  if (relationship < dc.treatyMinRelationship) return false;

  // Base acceptance from config
  let chance = dc.treatyBaseAcceptChance;

  // Relationship modifier: +0.3 at max friendship, -0.3 at hostility
  chance += (relationship / 100) * 0.3;

  // Target personality: high dealmaking → more willing
  chance += target.personality.dealmaking * 0.2;

  // High greed targets need better financial terms
  if (target.personality.greed > 0.6 && treatyType !== 'trade_agreement') {
    const goldOffered = (terms.goldPerTurn ?? 0) * (terms.duration > 0 ? terms.duration : 8) + (terms.lumpSumGold ?? 0);
    if (goldOffered < 30) chance -= 0.2;
    if (goldOffered >= 80) chance += 0.15;
  }

  // Aggressive factions dislike peace treaties
  if (target.personality.aggression > 0.6 && (treatyType === 'gold_for_peace' || treatyType === 'tribute')) {
    chance -= 0.15;
  }

  // Power disparity: weak targets more likely to accept protection
  if (treatyType === 'gold_for_protection' || treatyType === 'tribute') {
    const powerRatio = proposer.power / Math.max(1, target.power);
    if (powerRatio > 2) chance += 0.2; // much stronger proposer
    if (powerRatio < 0.5) chance -= 0.3; // weaker proposer
  }

  // Territory trades need location to actually exist and be theirs
  if (treatyType === 'gold_for_territory' && terms.locationId) {
    if (!target.controlledLocations.includes(terms.locationId)) return false;
    // They need to really want the gold
    if (target.gold > 200) chance -= 0.2;
    if (target.gold < 50) chance += 0.2;
  }

  return rng.chance(clamp(chance, 0.05, 0.95));
}

/** Execute an accepted treaty — apply immediate effects and register it */
export function executeTreaty(
  proposer: Faction,
  target: Faction,
  treaty: Treaty,
  state: WorldState,
): WorldEvent[] {
  const events: WorldEvent[] = [];

  // Lump sum payment
  if (treaty.terms.lumpSumGold) {
    proposer.gold = Math.max(0, proposer.gold - treaty.terms.lumpSumGold);
    target.gold += treaty.terms.lumpSumGold;
  }

  // Territory transfer
  if (treaty.type === 'gold_for_territory' && treaty.terms.locationId) {
    target.controlledLocations = target.controlledLocations.filter(id => id !== treaty.terms.locationId);
    proposer.controlledLocations.push(treaty.terms.locationId!);
  }

  // Power lending
  if (treaty.type === 'gold_for_protection' && treaty.terms.powerLent) {
    // Borrower gains temporary power, lender loses it
    const lent = Math.min(treaty.terms.powerLent, target.power);
    target.power = clamp(target.power - lent, 0, target.maxPower);
    proposer.power = clamp(proposer.power + lent, 0, proposer.maxPower);
  }

  // Mutual defense → add to alliances
  if (treaty.type === 'mutual_defense') {
    if (!proposer.alliances.includes(target.id)) proposer.alliances.push(target.id);
    if (!target.alliances.includes(proposer.id)) target.alliances.push(proposer.id);
  }

  // Improve relationships
  proposer.relationships[target.id] = clamp((proposer.relationships[target.id] ?? 0) + 15, -100, 100);
  target.relationships[proposer.id] = clamp((target.relationships[proposer.id] ?? 0) + 10, -100, 100);

  // Register in global treaty list
  state.activeTreaties.push(treaty);
  proposer.treaties.push(treaty);
  target.treaties.push(treaty);

  events.push({
    id: `treaty_${treaty.id}`,
    turn: state.turn,
    season: state.season,
    year: state.year,
    type: 'treaty',
    text: describeTreaty(proposer, target, treaty),
    icon: '📜',
    factionId: proposer.id,
    consequences: [describeTreatyTerms(treaty)],
    hookPotential: treaty.type === 'gold_for_territory' ? 4 : 3,
  });

  return events;
}

function describeTreaty(proposer: Faction, target: Faction, treaty: Treaty): string {
  switch (treaty.type) {
    case 'gold_for_peace':
      return `${proposer.name} and ${target.name} agree to peace — ${proposer.name} will pay ${treaty.terms.goldPerTurn} gold per season.`;
    case 'gold_for_protection':
      return `${target.name} lends ${treaty.terms.powerLent} soldiers to ${proposer.name} in exchange for ${treaty.terms.goldPerTurn} gold per season.`;
    case 'gold_for_territory':
      return `${proposer.name} purchases territory from ${target.name} for ${treaty.terms.lumpSumGold} gold.`;
    case 'mutual_defense':
      return `${proposer.name} and ${target.name} sign a mutual defense pact.`;
    case 'trade_agreement':
      return `${proposer.name} and ${target.name} establish a trade agreement, enriching both parties.`;
    case 'tribute':
      return `${proposer.name} agrees to pay tribute of ${treaty.terms.goldPerTurn} gold per season to ${target.name}.`;
  }
}

function describeTreatyTerms(treaty: Treaty): string {
  const parts: string[] = [];
  if (treaty.terms.goldPerTurn) parts.push(`${treaty.terms.goldPerTurn} gold/turn`);
  if (treaty.terms.lumpSumGold) parts.push(`${treaty.terms.lumpSumGold} gold lump sum`);
  if (treaty.terms.powerLent) parts.push(`${treaty.terms.powerLent} power lent`);
  if (treaty.terms.locationId) parts.push(`territory: ${treaty.terms.locationId}`);
  if (treaty.terms.duration > 0) parts.push(`${treaty.terms.duration} turns`);
  return parts.join(', ');
}

/** AI: decide what treaty to propose, if any */
export function decideTreatyProposal(
  faction: Faction,
  state: WorldState,
  rng: SeededRNG,
  config: SimulationConfig,
): { targetId: string; type: TreatyType; terms: Treaty['terms'] } | null {
  // Only factions with dealmaking > 0.3 proactively propose treaties
  if (faction.personality.dealmaking < 0.3) return null;

  // Check existing treaties to avoid duplicates
  const hasActiveTreatyWith = (otherId: string) =>
    state.activeTreaties.some(t => t.parties.includes(faction.id) && t.parties.includes(otherId));

  const others = Object.values(state.factions).filter(f => f.id !== faction.id);

  // Trading-oriented factions: propose trade agreements with anyone positive
  const hasTradingTag = (faction.tags ?? []).some(t => ['trading', 'mercantile', 'merchant-prince'].includes(t)) || faction.type === 'merchant';
  if (hasTradingTag) {
    for (const other of others) {
      if (hasActiveTreatyWith(other.id)) continue;
      const rel = faction.relationships[other.id] ?? 0;
      if (rel > 0 && other.controlledLocations.length > 0 && rng.chance(0.3)) {
        return {
          targetId: other.id,
          type: 'trade_agreement',
          terms: { duration: 8 },
        };
      }
    }
    // Pay off threatening factions
    for (const other of others) {
      if (hasActiveTreatyWith(other.id)) continue;
      const otherAggressive = (other.tags ?? []).some(t => ['raiding', 'aggressive', 'warlord', 'insurgent', 'pirate'].includes(t))
        || other.type === 'bandit' || other.type === 'goblin';
      if (otherAggressive && faction.gold > 100) {
        const rel = faction.relationships[other.id] ?? 0;
        if (rel < -10 && rng.chance(0.25)) {
          return {
            targetId: other.id,
            type: 'gold_for_peace',
            terms: { goldPerTurn: Math.floor(5 + faction.gold * 0.02), duration: 4 },
          };
        }
      }
    }
  }

  // Weak factions: offer tribute to much stronger neighbors
  if (faction.power < 20) {
    for (const other of others) {
      if (hasActiveTreatyWith(other.id)) continue;
      if (other.power > faction.power * 2 && !faction.enemies.includes(other.id)) {
        if (rng.chance(faction.personality.dealmaking * 0.4)) {
          return {
            targetId: other.id,
            type: 'tribute',
            terms: { goldPerTurn: Math.floor(3 + faction.gold * 0.01), duration: 4 },
          };
        }
      }
    }
  }

  // Diplomatic/honorable factions: propose mutual defense with non-hostile factions
  const hasDiplomaticTag = (faction.tags ?? []).some(t => ['diplomatic', 'honorable', 'noble', 'feudal', 'hegemon'].includes(t)) || faction.type === 'noble';
  if (hasDiplomaticTag) {
    for (const other of others) {
      if (hasActiveTreatyWith(other.id)) continue;
      if (!faction.enemies.includes(other.id)) {
        const rel = faction.relationships[other.id] ?? 0;
        if (rel > 20 && rng.chance(0.2)) {
          return {
            targetId: other.id,
            type: 'mutual_defense',
            terms: { duration: 8 },
          };
        }
      }
    }
  }

  // Rich factions with high dealmaking: try to buy territory
  if (faction.gold > 200 && faction.personality.dealmaking > 0.5) {
    for (const other of others) {
      if (hasActiveTreatyWith(other.id)) continue;
      if (other.controlledLocations.length <= 1) continue; // don't buy their last territory
      const rel = faction.relationships[other.id] ?? 0;
      if (rel > -10 && rng.chance(0.1)) {
        // Pick a border location
        const buyable = other.controlledLocations.find(locId => {
          const loc = state.locations[locId];
          return loc && loc.type !== 'capital' && loc.type !== 'castle';
        });
        if (buyable) {
          const loc = state.locations[buyable];
          const price = Math.floor(50 + (loc?.prosperity ?? 0) * 2);
          if (faction.gold >= price) {
            return {
              targetId: other.id,
              type: 'gold_for_territory',
              terms: { lumpSumGold: price, locationId: buyable, duration: -1 },
            };
          }
        }
      }
    }
  }

  return null;
}
