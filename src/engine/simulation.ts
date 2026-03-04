import type { WorldState, WorldEvent, TurnResult, Faction, FactionAction } from './types.js';
import { advanceSeason, clamp } from './world-state.js';
import { SeededRNG } from './rng.js';
import { processEconomy } from './economy.js';
import { decideFactionAction, getLocationController } from './factions.js';
import { resolveRaid, resolveCombat } from './combat.js';
import { processRandomEvents, processStoryHooks } from './events.js';
import type { SimulationConfig } from './config.js';
import { DEFAULT_CONFIG } from './config.js';

/**
 * Main turn resolution loop.
 * Processes one season (turn) and returns the result.
 */
export function resolveTurn(state: WorldState, config: SimulationConfig = DEFAULT_CONFIG): TurnResult {
  const rng = new SeededRNG(state.rngSeed + state.turn * 7919);

  advanceSeason(state);

  const events: WorldEvent[] = [];
  const factionChanges: Record<string, Partial<Faction>> = {};
  const locationChanges: Record<string, Partial<any>> = {};

  // 1. Empire Decay Phase
  events.push(...processEmpireDecay(state, rng, config));

  // 2. Economy Phase
  events.push(...processEconomy(state, rng, config));

  // 3. Faction Decision Phase + 4. Conflict Resolution Phase
  const factionActions = new Map<string, FactionAction>();
  for (const faction of Object.values(state.factions)) {
    const action = decideFactionAction(faction, state, rng, config);
    factionActions.set(faction.id, action);
  }

  // Execute faction actions and resolve conflicts
  for (const [factionId, action] of factionActions) {
    const faction = state.factions[factionId];
    if (!faction) continue;

    const actionEvents = executeFactionAction(faction, action, state, rng, config);
    events.push(...actionEvents);

    // Record the action
    const actionDesc = describeFactionAction(faction, action);
    faction.recentActions = [actionDesc, ...faction.recentActions.slice(0, 4)];
  }

  // 5. Consequence Phase — update relationships based on events
  processConsequences(state, events, rng, config);

  // 6. Random Events Phase
  events.push(...processRandomEvents(state, rng, config));

  // 7. Story Hook Phase
  events.push(...processStoryHooks(state));

  // Record all events
  state.eventLog.push(...events);

  // Advance the RNG seed
  state.rngSeed = rng.getSeed();

  // Build story hooks summary
  const storyHooks = events
    .filter(e => e.hookPotential >= 4)
    .map(e => e.text);

  // Generate DM brief
  const dmBrief = generateDMBrief(state, events);

  return {
    turn: state.turn,
    season: state.season,
    year: state.year,
    events,
    factionChanges,
    locationChanges,
    storyHooks,
    dmBrief,
  };
}

/** Process multiple turns at once */
export function simulateTurns(state: WorldState, count: number, config: SimulationConfig = DEFAULT_CONFIG): TurnResult[] {
  const results: TurnResult[] = [];
  for (let i = 0; i < count; i++) {
    results.push(resolveTurn(state, config));
  }
  return results;
}

function processEmpireDecay(state: WorldState, rng: SeededRNG, config: SimulationConfig): WorldEvent[] {
  const events: WorldEvent[] = [];
  const dc = config.decay;

  for (const faction of Object.values(state.factions)) {
    if (faction.type !== 'empire') continue;

    // Corruption ticks up slowly
    if (rng.chance(dc.corruptionTickChance)) {
      faction.corruption = clamp(faction.corruption + rng.int(dc.corruptionTickRange[0], dc.corruptionTickRange[1]), 0, 100);
    }

    // Power erodes based on corruption
    const corruptionPenalty = Math.floor(faction.corruption / dc.corruptionPowerDivisor);
    if (corruptionPenalty > 0 && rng.chance(dc.powerErosionChance)) {
      faction.power = clamp(faction.power - corruptionPenalty, 0, faction.maxPower);
      events.push({
        id: `decay_${faction.id}_t${state.turn}`,
        turn: state.turn,
        season: state.season,
        year: state.year,
        type: 'scandal',
        text: `Corruption continues to hollow the ${faction.name}. Troops go unpaid, officials take bribes, and the rot deepens.`,
        icon: '🏛️',
        factionId: faction.id,
        consequences: [`${faction.name} power -${corruptionPenalty}`],
        hookPotential: faction.corruption > 85 ? 3 : 1,
      });
    }

    // Treasury drain from corruption
    const drain = Math.floor(faction.gold * faction.corruption / dc.treasuryDrainDivisor);
    if (drain > 0) {
      faction.gold = Math.max(0, faction.gold - drain);
    }

    // Morale decay
    if (faction.corruption > dc.moraleDecayCorruptionThreshold && rng.chance(dc.moraleDecayChance)) {
      faction.morale = clamp(faction.morale - dc.moraleDecayAmount, 0, 100);
    }
  }

  return events;
}

function executeFactionAction(
  faction: Faction,
  action: FactionAction,
  state: WorldState,
  rng: SeededRNG,
  config: SimulationConfig
): WorldEvent[] {
  const events: WorldEvent[] = [];
  const rc = config.raid;
  const dc = config.diplomacy;
  const rec = config.recruitment;
  const decay = config.decay;

  switch (action.type) {
    case 'raid': {
      const target = state.locations[action.targetLocationId];
      if (!target) break;
      const defender = getLocationController(target.id, state);
      const result = resolveRaid(faction, target, defender, rng, config);

      if (result.success) {
        faction.gold += result.lootGold;
        target.prosperity = clamp(target.prosperity - result.prosperityDamage, 0, 100);
        faction.power = clamp(faction.power - result.raiderLosses, 0, faction.maxPower);
        target.population = Math.max(0, target.population - rng.int(rc.populationDamageRange[0], rc.populationDamageRange[1]));

        events.push({
          id: `raid_${faction.id}_${target.id}_t${state.turn}`,
          turn: state.turn,
          season: state.season,
          year: state.year,
          type: 'raid',
          text: `${faction.name} raids ${target.name}! They seize ${result.lootGold} gold and leave destruction in their wake.`,
          icon: '🔥',
          factionId: faction.id,
          locationId: target.id,
          consequences: [
            `${target.name} prosperity -${result.prosperityDamage}`,
            `${faction.name} gold +${result.lootGold}`,
          ],
          hookPotential: target.population > 500 ? 4 : 3,
        });

        // Worsen relationship with defender
        if (defender) {
          faction.relationships[defender.id] = clamp(
            (faction.relationships[defender.id] ?? 0) + rc.raiderRelationshipDamage, -100, 100
          );
          defender.relationships[faction.id] = clamp(
            (defender.relationships[faction.id] ?? 0) + rc.defenderRelationshipDamage, -100, 100
          );
        }
      } else {
        faction.power = clamp(faction.power - result.raiderLosses, 0, faction.maxPower);
        events.push({
          id: `raid_fail_${faction.id}_${target.id}_t${state.turn}`,
          turn: state.turn,
          season: state.season,
          year: state.year,
          type: 'raid',
          text: `${faction.name} attempts to raid ${target.name} but is repelled! Their raiders limp back with nothing.`,
          icon: '🛡️',
          factionId: faction.id,
          locationId: target.id,
          consequences: [`${faction.name} power -${result.raiderLosses}`],
          hookPotential: 2,
        });
      }
      break;
    }

    case 'recruit': {
      const recruited = rng.int(rec.recruitRange[0], rec.recruitRange[1]);
      faction.power = clamp(faction.power + recruited, 0, faction.maxPower);
      faction.gold = Math.max(0, faction.gold - recruited * rec.recruitCost);
      events.push({
        id: `recruit_${faction.id}_t${state.turn}`,
        turn: state.turn,
        season: state.season,
        year: state.year,
        type: 'recruitment',
        text: `${faction.name} recruits new members, growing their strength.`,
        icon: '⚔️',
        factionId: faction.id,
        consequences: [`${faction.name} power +${recruited}`],
        hookPotential: 1,
      });
      break;
    }

    case 'fortify': {
      const loc = state.locations[action.locationId];
      if (!loc) break;
      const amount = rng.int(rec.fortifyRange[0], rec.fortifyRange[1]);
      loc.defense = clamp(loc.defense + amount, 0, 100);
      faction.gold = Math.max(0, faction.gold - rec.fortifyCost);
      events.push({
        id: `fortify_${faction.id}_${loc.id}_t${state.turn}`,
        turn: state.turn,
        season: state.season,
        year: state.year,
        type: 'fortification',
        text: `${faction.name} reinforces the defenses at ${loc.name}.`,
        icon: '🏰',
        factionId: faction.id,
        locationId: loc.id,
        consequences: [`${loc.name} defense +${amount}`],
        hookPotential: 1,
      });
      break;
    }

    case 'patrol': {
      const loc = state.locations[action.locationId];
      if (!loc) break;
      loc.defense = clamp(loc.defense + rec.patrolDefenseBoost, 0, 100);
      events.push({
        id: `patrol_${faction.id}_${loc.id}_t${state.turn}`,
        turn: state.turn,
        season: state.season,
        year: state.year,
        type: 'patrol',
        text: `${faction.name} patrols the area around ${loc.name}, bringing a measure of security.`,
        icon: '🛡️',
        factionId: faction.id,
        locationId: loc.id,
        consequences: [`${loc.name} defense +${rec.patrolDefenseBoost}`],
        hookPotential: 1,
      });
      break;
    }

    case 'collect_taxes': {
      const ec = config.economy;
      let taxes = 0;
      for (const locId of faction.controlledLocations) {
        const loc = state.locations[locId];
        if (!loc) continue;
        const locTax = Math.floor(loc.prosperity * ec.taxCollectionRate);
        taxes += locTax;
        // Heavy taxation hurts prosperity slightly
        loc.prosperity = clamp(loc.prosperity - ec.taxProsperityDamage, 0, 100);
      }
      // Corruption eats some taxes
      const effective = Math.floor(taxes * (1 - faction.corruption / ec.corruptionTaxDivisor));
      faction.gold += effective;
      events.push({
        id: `tax_${faction.id}_t${state.turn}`,
        turn: state.turn,
        season: state.season,
        year: state.year,
        type: 'trade',
        text: `${faction.name} collects ${effective} gold in taxes${faction.corruption > 50 ? ' (corruption claims the rest)' : ''}.`,
        icon: '💰',
        factionId: faction.id,
        consequences: [`${faction.name} gold +${effective}`],
        hookPotential: 1,
      });
      break;
    }

    case 'scheme': {
      // Noble scheming — weakens the empire or rivals
      const empire = state.factions['aurelian_crown'];
      if (empire) {
        empire.corruption = clamp(empire.corruption + rng.int(dc.schemeCorruptionRange[0], dc.schemeCorruptionRange[1]), 0, 100);
        faction.gold = Math.max(0, faction.gold - dc.schemeCost);
        events.push({
          id: `scheme_${faction.id}_t${state.turn}`,
          turn: state.turn,
          season: state.season,
          year: state.year,
          type: 'scandal',
          text: `${faction.leader} works behind the scenes, manipulating court politics and deepening the empire's dysfunction.`,
          icon: '🗡️',
          factionId: faction.id,
          consequences: ['Imperial corruption increases'],
          hookPotential: 3,
        });
      }
      break;
    }

    case 'seek_alliance': {
      const target = state.factions[action.targetFactionId];
      if (!target) break;
      const currentRelation = faction.relationships[target.id] ?? 0;
      if (currentRelation > dc.allianceThreshold && rng.chance(dc.allianceSuccessChance)) {
        faction.alliances.push(target.id);
        target.alliances.push(faction.id);
        faction.relationships[target.id] = clamp(currentRelation + dc.allianceRelationshipBoost, -100, 100);
        target.relationships[faction.id] = clamp(
          (target.relationships[faction.id] ?? 0) + dc.allianceRelationshipBoost, -100, 100
        );
        events.push({
          id: `alliance_${faction.id}_${target.id}_t${state.turn}`,
          turn: state.turn,
          season: state.season,
          year: state.year,
          type: 'alliance',
          text: `${faction.name} and ${target.name} forge an alliance!`,
          icon: '🤝',
          factionId: faction.id,
          consequences: ['New alliance formed'],
          hookPotential: 4,
        });
      } else {
        events.push({
          id: `alliance_fail_${faction.id}_${target.id}_t${state.turn}`,
          turn: state.turn,
          season: state.season,
          year: state.year,
          type: 'diplomacy',
          text: `${faction.name} extends an offer of alliance to ${target.name}, but is rebuffed.`,
          icon: '💬',
          factionId: faction.id,
          consequences: [],
          hookPotential: 2,
        });
      }
      break;
    }

    case 'invest': {
      const loc = state.locations[action.locationId];
      if (!loc) break;
      const investment = Math.min(rec.investmentCap, faction.gold);
      faction.gold -= investment;
      loc.prosperity = clamp(loc.prosperity + Math.floor(investment / rec.investmentEfficiency), 0, 100);
      events.push({
        id: `invest_${faction.id}_${loc.id}_t${state.turn}`,
        turn: state.turn,
        season: state.season,
        year: state.year,
        type: 'trade',
        text: `${faction.name} invests in ${loc.name}, boosting its prosperity.`,
        icon: '📈',
        factionId: faction.id,
        locationId: loc.id,
        consequences: [`${loc.name} prosperity +${Math.floor(investment / rec.investmentEfficiency)}`],
        hookPotential: 1,
      });
      break;
    }

    case 'bribe': {
      const target = state.factions[action.targetFactionId];
      if (!target) break;
      const bribeAmount = Math.min(dc.bribeCost, faction.gold);
      faction.gold -= bribeAmount;
      faction.relationships[target.id] = clamp(
        (faction.relationships[target.id] ?? 0) + dc.briberRelationshipGain, -100, 100
      );
      target.relationships[faction.id] = clamp(
        (target.relationships[faction.id] ?? 0) + dc.bribeTargetRelationshipGain, -100, 100
      );
      events.push({
        id: `bribe_${faction.id}_${target.id}_t${state.turn}`,
        turn: state.turn,
        season: state.season,
        year: state.year,
        type: 'diplomacy',
        text: `${faction.name} sends "gifts" to ${target.name}, improving relations.`,
        icon: '💰',
        factionId: faction.id,
        consequences: ['Relations improved'],
        hookPotential: 1,
      });
      break;
    }

    case 'expand': {
      const target = state.locations[action.targetLocationId];
      if (!target) break;
      const defender = getLocationController(target.id, state);
      if (defender) {
        const result = resolveCombat(faction, defender, target, rng, config);
        if (result.territoryChanged) {
          defender.controlledLocations = defender.controlledLocations.filter(id => id !== target.id);
          faction.controlledLocations.push(target.id);
        }
        faction.power = clamp(faction.power - result.attackerLosses, 0, faction.maxPower);
        defender.power = clamp(defender.power - result.defenderLosses, 0, defender.maxPower);
        events.push({
          id: `expand_${faction.id}_${target.id}_t${state.turn}`,
          turn: state.turn,
          season: state.season,
          year: state.year,
          type: 'battle',
          text: result.territoryChanged
            ? `${faction.name} seizes ${target.name} from ${defender.name}! ${result.outcome.replace('_', ' ')}.`
            : `${faction.name} attacks ${target.name} but fails to take it. ${result.outcome.replace('_', ' ')}.`,
          icon: '⚔️',
          factionId: faction.id,
          locationId: target.id,
          consequences: [
            `${faction.name} losses: ${result.attackerLosses}`,
            `${defender.name} losses: ${result.defenderLosses}`,
          ],
          hookPotential: 4,
        });
      } else {
        // Uncontrolled — just claim it
        faction.controlledLocations.push(target.id);
        events.push({
          id: `claim_${faction.id}_${target.id}_t${state.turn}`,
          turn: state.turn,
          season: state.season,
          year: state.year,
          type: 'battle',
          text: `${faction.name} claims the undefended ${target.name}.`,
          icon: '🚩',
          factionId: faction.id,
          locationId: target.id,
          consequences: [`${target.name} now controlled by ${faction.name}`],
          hookPotential: 3,
        });
      }
      break;
    }

    case 'hire_mercenaries': {
      if (faction.gold >= rec.mercenaryCost) {
        faction.gold -= rec.mercenaryCost;
        faction.power = clamp(faction.power + rec.mercenaryPower, 0, faction.maxPower);
        events.push({
          id: `mercs_${faction.id}_t${state.turn}`,
          turn: state.turn,
          season: state.season,
          year: state.year,
          type: 'recruitment',
          text: `${faction.name} hires mercenaries to protect their interests.`,
          icon: '💂',
          factionId: faction.id,
          consequences: [`${faction.name} power +${rec.mercenaryPower}, gold -${rec.mercenaryCost}`],
          hookPotential: 2,
        });
      }
      break;
    }

    case 'reform': {
      const success = rng.chance(decay.reformSuccessChance);
      if (success) {
        faction.corruption = clamp(faction.corruption - rng.int(decay.reformAmountRange[0], decay.reformAmountRange[1]), 0, 100);
        faction.morale = clamp(faction.morale + decay.reformMoraleGain, 0, 100);
        events.push({
          id: `reform_${faction.id}_t${state.turn}`,
          turn: state.turn,
          season: state.season,
          year: state.year,
          type: 'reform',
          text: `${faction.leader} pushes through reforms, rooting out some corruption. Progress is slow but real.`,
          icon: '⚖️',
          factionId: faction.id,
          consequences: ['Corruption reduced', 'Morale improved'],
          hookPotential: 3,
        });
      } else {
        faction.gold = Math.max(0, faction.gold - decay.reformFailCost);
        events.push({
          id: `reform_fail_${faction.id}_t${state.turn}`,
          turn: state.turn,
          season: state.season,
          year: state.year,
          type: 'reform',
          text: `${faction.leader}'s reform attempts are blocked by entrenched interests. The corrupt officials close ranks.`,
          icon: '⚖️',
          factionId: faction.id,
          consequences: ['Reform failed, gold wasted'],
          hookPotential: 2,
        });
      }
      break;
    }

    case 'trade': {
      const loc = state.locations[action.locationId];
      if (!loc) break;
      const income = Math.floor(loc.prosperity * rec.tradeIncomeRate) + rng.int(rec.tradeRandomRange[0], rec.tradeRandomRange[1]);
      faction.gold += income;
      events.push({
        id: `trade_${faction.id}_t${state.turn}`,
        turn: state.turn,
        season: state.season,
        year: state.year,
        type: 'trade',
        text: `${faction.name} conducts profitable trade from ${loc.name}.`,
        icon: '📦',
        factionId: faction.id,
        locationId: loc.id,
        consequences: [`${faction.name} gold +${income}`],
        hookPotential: 1,
      });
      break;
    }

    case 'lay_low': {
      faction.morale = clamp(faction.morale + rec.layLowMoraleGain, 0, 100);
      break;
    }
  }

  return events;
}

function processConsequences(state: WorldState, events: WorldEvent[], rng: SeededRNG, config: SimulationConfig): void {
  const ec = config.events;
  // Raids create refugees that flow to nearby towns
  for (const event of events) {
    if (event.type === 'raid' && event.locationId && event.text.includes('raids')) {
      const raidedLoc = state.locations[event.locationId];
      if (!raidedLoc) continue;
      // Refugees flow to connected locations
      const refugees = rng.int(ec.refugeeRange[0], ec.refugeeRange[1]);
      for (const adjId of raidedLoc.connectedTo) {
        const adj = state.locations[adjId];
        if (adj && adj.population > 100) {
          adj.population += Math.floor(refugees / raidedLoc.connectedTo.length);
          adj.prosperity = clamp(adj.prosperity - ec.refugeeProsperityCost, 0, 100);
        }
      }
    }
  }
}

function describeFactionAction(faction: Faction, action: FactionAction): string {
  switch (action.type) {
    case 'raid':
      return `Raided ${action.targetLocationId}`;
    case 'recruit':
      return 'Recruited new members';
    case 'fortify':
      return `Fortified ${action.locationId}`;
    case 'patrol':
      return `Patrolled ${action.locationId}`;
    case 'collect_taxes':
      return 'Collected taxes';
    case 'scheme':
      return 'Schemed against rivals';
    case 'seek_alliance':
      return `Sought alliance with ${action.targetFactionId}`;
    case 'invest':
      return `Invested in ${action.locationId}`;
    case 'bribe':
      return `Bribed ${action.targetFactionId}`;
    case 'expand':
      return `Expanded into ${action.targetLocationId}`;
    case 'hire_mercenaries':
      return 'Hired mercenaries';
    case 'reform':
      return 'Attempted reforms';
    case 'trade':
      return `Traded at ${action.locationId}`;
    case 'lay_low':
      return 'Laid low';
    default:
      return 'Unknown action';
  }
}

function generateDMBrief(state: WorldState, events: WorldEvent[]): string {
  const importantEvents = events.filter(e => e.hookPotential >= 3);
  const raids = events.filter(e => e.type === 'raid');
  const battles = events.filter(e => e.type === 'battle');
  const storyEvents = events.filter(e => e.type === 'story_hook');

  const lines: string[] = [];
  lines.push(`=== ${state.season}, Year ${state.year} (Turn ${state.turn}) ===`);
  lines.push('');

  if (storyEvents.length > 0) {
    lines.push('STORY BEATS:');
    for (const e of storyEvents) lines.push(`  * ${e.text}`);
    lines.push('');
  }

  if (raids.length > 0 || battles.length > 0) {
    lines.push('CONFLICT:');
    for (const e of [...raids, ...battles]) lines.push(`  * ${e.text}`);
    lines.push('');
  }

  if (importantEvents.length > 0) {
    lines.push('KEY EVENTS:');
    for (const e of importantEvents) {
      if (!storyEvents.includes(e) && !raids.includes(e) && !battles.includes(e)) {
        lines.push(`  * ${e.text}`);
      }
    }
    lines.push('');
  }

  // Faction status summary
  lines.push('FACTION STATUS:');
  for (const f of Object.values(state.factions)) {
    const status = f.power <= 5 ? '(CRITICAL)' : f.power <= 15 ? '(WEAK)' : '';
    lines.push(`  ${f.name}: Power ${f.power}/${f.maxPower} | Gold ${f.gold} | Morale ${f.morale} ${status}`);
  }

  return lines.join('\n');
}
