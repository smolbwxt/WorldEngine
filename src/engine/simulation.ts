import type { WorldState, WorldEvent, TurnResult, Faction, FactionAction, Treaty } from './types.js';
import { advanceSeason, clamp } from './world-state.js';
import { SeededRNG } from './rng.js';
import { processEconomy } from './economy.js';
import { decideFactionAction, getLocationController } from './factions.js';
import { resolveRaid, resolveCombat } from './combat.js';
import { processRandomEvents, processStoryHooks } from './events.js';
import { decideTreatyProposal, evaluateTreatyProposal, executeTreaty } from './treaties.js';
import {
  processCharacterPhase,
  getCharacterAtLocation,
  rollCharacterSurvival,
  applyCharacterDeath,
  applyCharacterWound,
  updateCharacterRenown,
  getFactionMoraleBonus,
  rollCharacterProgression,
} from './characters.js';
import { generateNarrativeRecap } from './narrative.js';
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

  // 4b. Treaty Proposal Phase — factions with high dealmaking try negotiations
  for (const faction of Object.values(state.factions)) {
    const proposal = decideTreatyProposal(faction, state, rng, config);
    if (proposal) {
      const target = state.factions[proposal.targetId];
      if (target) {
        const accepted = evaluateTreatyProposal(faction, target, proposal.type, proposal.terms, state, rng, config);
        if (accepted) {
          const treaty: Treaty = {
            id: `treaty_${faction.id}_${target.id}_t${state.turn}`,
            type: proposal.type,
            parties: [faction.id, target.id],
            terms: proposal.terms,
            createdTurn: state.turn,
          };
          events.push(...executeTreaty(faction, target, treaty, state));
        } else {
          events.push({
            id: `treaty_reject_${faction.id}_${target.id}_t${state.turn}`,
            turn: state.turn, season: state.season, year: state.year,
            type: 'treaty',
            text: `${faction.name} proposes a ${proposal.type.replace(/_/g, ' ')} to ${target.name}, but is refused.`,
            icon: '📜', factionId: faction.id,
            consequences: [], hookPotential: 2,
          });
        }
      }
    }
  }

  // 5. Consequence Phase — update relationships based on events
  processConsequences(state, events, rng, config);

  // 5b. Character Phase — wound recovery, movement, morale bonuses, progression
  if (state.characters) {
    events.push(...processCharacterPhase(state, rng));

    // Character progression — surviving characters gain traits, abilities, stat boosts
    for (const char of Object.values(state.characters)) {
      events.push(...rollCharacterProgression(char, state, rng));
    }

    // Apply passive morale bonuses from living characters
    for (const faction of Object.values(state.factions)) {
      const moraleBonus = getFactionMoraleBonus(faction.id, state);
      if (moraleBonus > 0) {
        // Apply a fraction each turn (not the full bonus — it's a persistent effect)
        faction.morale = clamp(faction.morale + Math.floor(moraleBonus * 0.1), 0, 100);
      }
    }
  }

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

  // Generate narrative flavor text
  const narrative = generateNarrativeRecap(state, events, rng);

  return {
    turn: state.turn,
    season: state.season,
    year: state.year,
    events,
    factionChanges,
    locationChanges,
    storyHooks,
    dmBrief,
    narrative,
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
        // Apply raid loot multiplier for bandits/goblins
        const am = config.actionMultipliers;
        const lootMult = faction.type === 'bandit' ? am.bandit.raidLoot
                       : faction.type === 'goblin' ? am.goblin.raidLoot : 1;
        const boostedLoot = Math.floor(result.lootGold * lootMult);
        faction.gold += boostedLoot;
        target.prosperity = clamp(target.prosperity - result.prosperityDamage, 0, 100);
        faction.power = clamp(faction.power - result.raiderLosses, 0, faction.maxPower);
        target.population = Math.max(0, target.population - rng.int(rc.populationDamageRange[0], rc.populationDamageRange[1]));

        events.push({
          id: `raid_${faction.id}_${target.id}_t${state.turn}`,
          turn: state.turn,
          season: state.season,
          year: state.year,
          type: 'raid',
          text: `${faction.name} raids ${target.name}! They seize ${boostedLoot} gold and leave destruction in their wake.`,
          icon: '🔥',
          factionId: faction.id,
          locationId: target.id,
          consequences: [
            `${target.name} prosperity -${result.prosperityDamage}`,
            `${faction.name} gold +${boostedLoot}`,
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
      const recruitCostMult = faction.type === 'bandit' ? config.actionMultipliers.bandit.recruitCost : 1;
      faction.power = clamp(faction.power + recruited, 0, faction.maxPower);
      faction.gold = Math.max(0, faction.gold - Math.floor(recruited * rec.recruitCost * recruitCostMult));
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
      const fortifyMult = faction.type === 'noble' ? config.actionMultipliers.noble.fortifyBonus : 1;
      const amount = Math.floor(rng.int(rec.fortifyRange[0], rec.fortifyRange[1]) * fortifyMult);
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
      const patrolMult = faction.type === 'empire' ? config.actionMultipliers.empire.patrolDefense : 1;
      const patrolBoost = Math.floor(rec.patrolDefenseBoost * patrolMult);
      loc.defense = clamp(loc.defense + patrolBoost, 0, 100);
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
        consequences: [`${loc.name} defense +${patrolBoost}`],
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
      const taxMult = faction.type === 'empire' ? config.actionMultipliers.empire.taxIncome : 1;
      const effective = Math.floor(taxes * (1 - faction.corruption / ec.corruptionTaxDivisor) * taxMult);
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
      const investMult = faction.type === 'merchant' ? config.actionMultipliers.merchant.investEfficiency : 1;
      loc.prosperity = clamp(loc.prosperity + Math.floor(investment / rec.investmentEfficiency * investMult), 0, 100);
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
      const bribeMult = faction.type === 'merchant' ? config.actionMultipliers.merchant.bribeCost : 1;
      const bribeAmount = Math.min(Math.floor(dc.bribeCost * bribeMult), faction.gold);
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
        // Find characters present at the battle
        const atkChar = state.characters ? getCharacterAtLocation(faction.id, target.id, state)
                        ?? getCharacterAtLocation(faction.id, faction.controlledLocations[0], state)
                        : null;
        const defChar = state.characters ? getCharacterAtLocation(defender.id, target.id, state) : null;

        const result = resolveCombat(faction, defender, target, rng, config, atkChar, defChar);
        if (result.territoryChanged) {
          defender.controlledLocations = defender.controlledLocations.filter(id => id !== target.id);
          faction.controlledLocations.push(target.id);
        }
        faction.power = clamp(faction.power - result.attackerLosses, 0, faction.maxPower);
        defender.power = clamp(defender.power - result.defenderLosses, 0, defender.maxPower);

        // Character survival rolls and renown
        const charConsequences: string[] = [];
        if (atkChar && state.characters) {
          const attackerWon = result.outcome === 'decisive_victory' || result.outcome === 'victory' || result.outcome === 'pyrrhic_victory';
          updateCharacterRenown(atkChar, attackerWon, result.outcome);
          const survival = rollCharacterSurvival(atkChar, result.outcome, true, rng);
          if (!survival.survived) {
            events.push(...applyCharacterDeath(atkChar, `Killed in battle at ${target.name}`, state.turn, state));
            charConsequences.push(survival.narrative);
          } else if (survival.narrative) {
            applyCharacterWound(atkChar, state.turn);
            charConsequences.push(survival.narrative);
          }
        }
        if (defChar && state.characters) {
          const defenderWon = result.outcome === 'repelled' || result.outcome === 'routed';
          updateCharacterRenown(defChar, defenderWon, result.outcome);
          const survival = rollCharacterSurvival(defChar, result.outcome, false, rng);
          if (!survival.survived) {
            events.push(...applyCharacterDeath(defChar, `Killed defending ${target.name}`, state.turn, state));
            charConsequences.push(survival.narrative);
          } else if (survival.narrative) {
            applyCharacterWound(defChar, state.turn);
            charConsequences.push(survival.narrative);
          }
        }

        // Build battle narrative with character involvement
        const charText = atkChar || defChar ? (() => {
          const parts: string[] = [];
          if (atkChar) parts.push(`${atkChar.name} led the assault`);
          if (defChar) parts.push(`${defChar.name} commanded the defense`);
          return ' ' + parts.join('; ') + '.';
        })() : '';

        events.push({
          id: `expand_${faction.id}_${target.id}_t${state.turn}`,
          turn: state.turn,
          season: state.season,
          year: state.year,
          type: 'battle',
          text: (result.territoryChanged
            ? `${faction.name} seizes ${target.name} from ${defender.name}! ${result.outcome.replace('_', ' ')}.`
            : `${faction.name} attacks ${target.name} but fails to take it. ${result.outcome.replace('_', ' ')}.`)
            + charText,
          icon: '⚔️',
          factionId: faction.id,
          locationId: target.id,
          consequences: [
            `${faction.name} losses: ${result.attackerLosses}`,
            `${defender.name} losses: ${result.defenderLosses}`,
            ...charConsequences,
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
      const tradeMult = faction.type === 'merchant' ? config.actionMultipliers.merchant.tradeIncome : 1;
      const income = Math.floor((Math.floor(loc.prosperity * rec.tradeIncomeRate) + rng.int(rec.tradeRandomRange[0], rec.tradeRandomRange[1])) * tradeMult);
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
    case 'propose_treaty':
      return `Proposed ${action.treatyType.replace(/_/g, ' ')} to ${action.targetFactionId}`;
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

  // Character casualties and progression this turn
  if (state.characters) {
    const deaths = Object.values(state.characters).filter(c => c.deathTurn === state.turn);
    const wounded = Object.values(state.characters).filter(
      c => c.status === 'wounded' && c.woundedUntilTurn > state.turn - 1
    );
    const progressionEvents = events.filter(e => e.id.startsWith('progression_'));
    if (deaths.length > 0 || wounded.length > 0 || progressionEvents.length > 0) {
      lines.push('');
      lines.push('CHARACTERS:');
      for (const c of deaths) {
        lines.push(`  KILLED: ${c.name} (${c.title}) — ${c.deathCause}`);
      }
      for (const c of wounded) {
        lines.push(`  WOUNDED: ${c.name} (${c.title}) — recovers turn ${c.woundedUntilTurn}`);
      }
      for (const e of progressionEvents) {
        lines.push(`  GREW: ${e.text}`);
      }
    }
  }

  return lines.join('\n');
}
