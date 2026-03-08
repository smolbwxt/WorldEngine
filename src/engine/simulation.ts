import type { WorldState, WorldEvent, TurnResult, Faction, FactionAction, Treaty, PendingTurn, PendingAction } from './types.js';
import { advanceSeason, clamp } from './world-state.js';
import { SeededRNG } from './rng.js';
import { processEconomy } from './economy.js';
import { decideFactionAction, getLocationController } from './factions.js';
import { resolveRaid, resolveCombat } from './combat.js';
import { processRandomEvents, processStoryHooks } from './events.js';
import { decideTreatyProposal, evaluateTreatyProposal, executeTreaty } from './treaties.js';
import { resolveTagBehavior, factionTypeToTags } from './tags.js';
import {
  processCharacterPhase,
  getCharacterAtLocation,
  rollCharacterSurvival,
  rollCharacterRaidSurvival,
  rollNonCombatPerils,
  applyCharacterDeath,
  applyCharacterWound,
  updateCharacterRenown,
  getFactionMoraleBonus,
  rollCharacterProgression,
  createVendettas,
  rollLastStand,
  awardTrophy,
  generateSuccessor,
  processWarCouncils,
  processRelationships,
  processRelationshipDeathEffects,
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

    // Non-combat perils — assassination, illness, accidents
    for (const char of Object.values(state.characters)) {
      const perilEvents = rollNonCombatPerils(char, state, rng);
      events.push(...perilEvents);
      // Handle succession for non-combat deaths
      if (char.status === 'dead' && char.deathTurn === state.turn) {
        events.push(...processRelationshipDeathEffects(char, state, rng));
        if (state.factions[char.factionId]?.leader === char.name) {
          const { successor, events: succEvents } = generateSuccessor(char, state, rng);
          state.characters[successor.id] = successor;
          events.push(...succEvents);
        }
      }
    }

    // War council events — multiple characters at same location
    events.push(...processWarCouncils(state, rng));

    // Relationship formation and evolution
    events.push(...processRelationships(state, rng));

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

// ============================================================
// Player Intervention System — Split Turn Resolution
// ============================================================

/**
 * Phase 1: Prepare a turn up to the intervention point.
 * Advances the season, runs decay & economy, then generates faction decisions
 * WITHOUT executing them. Returns a PendingTurn that the player can review/modify.
 *
 * IMPORTANT: This MUTATES state (season advance, decay, economy) but does NOT
 * execute faction actions, treaties, random events, or character phases.
 */
export function prepareTurn(state: WorldState, config: SimulationConfig = DEFAULT_CONFIG): PendingTurn {
  const rng = new SeededRNG(state.rngSeed + state.turn * 7919);

  advanceSeason(state);

  const prePhaseEvents: WorldEvent[] = [];

  // 1. Empire Decay Phase (runs immediately — these are background processes)
  prePhaseEvents.push(...processEmpireDecay(state, rng, config));

  // 2. Economy Phase (runs immediately — income/upkeep are automatic)
  prePhaseEvents.push(...processEconomy(state, rng, config));

  // 3. Faction Decision Phase — generate decisions but DON'T execute
  const actions: PendingAction[] = [];
  for (const faction of Object.values(state.factions)) {
    const action = decideFactionAction(faction, state, rng, config);
    actions.push({
      factionId: faction.id,
      factionName: faction.name,
      factionColor: faction.color,
      action,
      description: describeFactionAction(faction, action),
      enabled: true,
    });
  }

  // Save RNG state so execution is deterministic from this point
  return {
    turn: state.turn,
    season: state.season,
    year: state.year,
    actions,
    prePhaseEvents,
    rngSeed: rng.getSeed(),
    injectedEvents: [],
  };
}

/**
 * Phase 2: Execute a prepared turn after player intervention.
 * Takes the (possibly modified) PendingTurn and finishes resolution:
 * faction action execution, treaties, consequences, characters, random events.
 */
export function executePreparedTurn(state: WorldState, pending: PendingTurn, config: SimulationConfig = DEFAULT_CONFIG): TurnResult {
  const rng = new SeededRNG(pending.rngSeed);

  const events: WorldEvent[] = [...pending.prePhaseEvents];
  const factionChanges: Record<string, Partial<Faction>> = {};
  const locationChanges: Record<string, Partial<any>> = {};

  // Add any player-injected events first
  if (pending.injectedEvents.length > 0) {
    events.push(...pending.injectedEvents);
  }

  // Execute enabled faction actions
  for (const pending_action of pending.actions) {
    if (!pending_action.enabled) continue;
    const faction = state.factions[pending_action.factionId];
    if (!faction) continue;

    const actionEvents = executeFactionAction(faction, pending_action.action, state, rng, config);
    events.push(...actionEvents);

    const actionDesc = pending_action.description;
    faction.recentActions = [actionDesc, ...faction.recentActions.slice(0, 4)];

    // Add player note as a GM chronicle entry
    if (pending_action.playerNote) {
      events.push({
        id: `gm_note_${pending_action.factionId}_t${state.turn}`,
        turn: state.turn, season: state.season, year: state.year,
        type: 'story_hook',
        text: `[GM] ${pending_action.playerNote}`,
        icon: '🎲', factionId: pending_action.factionId,
        consequences: [], hookPotential: 3,
      });
    }
  }

  // 4b. Treaty Proposal Phase
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

  // 5. Consequence Phase
  processConsequences(state, events, rng, config);

  // 5b. Character Phase
  if (state.characters) {
    events.push(...processCharacterPhase(state, rng));
    for (const char of Object.values(state.characters)) {
      const perilEvents = rollNonCombatPerils(char, state, rng);
      events.push(...perilEvents);
      if (char.status === 'dead' && char.deathTurn === state.turn) {
        events.push(...processRelationshipDeathEffects(char, state, rng));
        if (state.factions[char.factionId]?.leader === char.name) {
          const { successor, events: succEvents } = generateSuccessor(char, state, rng);
          state.characters[successor.id] = successor;
          events.push(...succEvents);
        }
      }
    }
    events.push(...processWarCouncils(state, rng));
    events.push(...processRelationships(state, rng));
    for (const char of Object.values(state.characters)) {
      events.push(...rollCharacterProgression(char, state, rng));
    }
    for (const faction of Object.values(state.factions)) {
      const moraleBonus = getFactionMoraleBonus(faction.id, state);
      if (moraleBonus > 0) {
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
  state.rngSeed = rng.getSeed();

  const storyHooks = events.filter(e => e.hookPotential >= 4).map(e => e.text);
  const dmBrief = generateDMBrief(state, events);
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

function processEmpireDecay(state: WorldState, rng: SeededRNG, config: SimulationConfig): WorldEvent[] {
  const events: WorldEvent[] = [];
  const dc = config.decay;

  for (const faction of Object.values(state.factions)) {
    // Apply decay to any faction with corruption > 30 (not just empires)
    if (faction.corruption < 30) continue;

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

/** Get tag-based modifier for a stat, falling back to 0 */
function getTagModifier(faction: Faction, state: WorldState, stat: string): number {
  const tags = faction.tags?.length > 0 ? faction.tags : factionTypeToTags(faction.type);
  const { modifiers } = resolveTagBehavior(tags, state.definition?.customTags);
  return modifiers[stat] ?? 0;
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

      // Find characters involved in the raid
      const raiderChar = state.characters ? getCharacterAtLocation(faction.id, faction.controlledLocations[0], state) : null;
      const defenderChar = defender && state.characters ? getCharacterAtLocation(defender.id, target.id, state) : null;

      const raidCharConsequences: string[] = [];

      if (result.success) {
        // Apply raid loot multiplier from tags
        const lootMult = 1 + getTagModifier(faction, state, 'raidLoot');
        const boostedLoot = Math.floor(result.lootGold * lootMult);
        faction.gold += boostedLoot;
        target.prosperity = clamp(target.prosperity - result.prosperityDamage, 0, 100);
        faction.power = clamp(faction.power - result.raiderLosses, 0, faction.maxPower);
        target.population = Math.max(0, target.population - rng.int(rc.populationDamageRange[0], rc.populationDamageRange[1]));

        // Character survival during raid
        if (raiderChar) {
          const survival = rollCharacterRaidSurvival(raiderChar, true, true, rng);
          if (!survival.survived) {
            events.push(...applyCharacterDeath(raiderChar, `Killed raiding ${target.name}`, state.turn, state));
            raidCharConsequences.push(survival.narrative);
            if (defenderChar && defenderChar.status !== 'dead') {
              events.push(...createVendettas(raiderChar, defenderChar, state, target.name));
              events.push(...awardTrophy(defenderChar, raiderChar, state.turn));
            }
            events.push(...processRelationshipDeathEffects(raiderChar, state, rng));
            if (state.factions[raiderChar.factionId]?.leader === raiderChar.name) {
              const { successor, events: succEvents } = generateSuccessor(raiderChar, state, rng);
              state.characters[successor.id] = successor;
              events.push(...succEvents);
            }
          } else if (survival.wounded) {
            applyCharacterWound(raiderChar, state.turn);
            raidCharConsequences.push(survival.narrative);
          } else {
            raiderChar.renown = clamp(raiderChar.renown + 2, 0, 100);
          }
        }
        if (defenderChar) {
          const survival = rollCharacterRaidSurvival(defenderChar, true, false, rng);
          if (!survival.survived) {
            events.push(...applyCharacterDeath(defenderChar, `Killed when ${target.name} was raided`, state.turn, state));
            raidCharConsequences.push(survival.narrative);
            if (raiderChar && raiderChar.status !== 'dead') {
              events.push(...createVendettas(defenderChar, raiderChar, state, target.name));
              events.push(...awardTrophy(raiderChar, defenderChar, state.turn));
            }
            events.push(...processRelationshipDeathEffects(defenderChar, state, rng));
            if (state.factions[defenderChar.factionId]?.leader === defenderChar.name) {
              const { successor, events: succEvents } = generateSuccessor(defenderChar, state, rng);
              state.characters[successor.id] = successor;
              events.push(...succEvents);
            }
          } else if (survival.wounded) {
            applyCharacterWound(defenderChar, state.turn);
            raidCharConsequences.push(survival.narrative);
          }
        }

        const charNarrative = raiderChar ? ` ${raiderChar.name} led the raid.` : '';
        events.push({
          id: `raid_${faction.id}_${target.id}_t${state.turn}`,
          turn: state.turn,
          season: state.season,
          year: state.year,
          type: 'raid',
          text: `${faction.name} raids ${target.name}! They seize ${boostedLoot} gold and leave destruction in their wake.${charNarrative}`,
          icon: '🔥',
          factionId: faction.id,
          locationId: target.id,
          consequences: [
            `${target.name} prosperity -${result.prosperityDamage}`,
            `${faction.name} gold +${boostedLoot}`,
            ...raidCharConsequences,
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

        // Failed raid — raider character at greater risk
        if (raiderChar) {
          const survival = rollCharacterRaidSurvival(raiderChar, false, true, rng);
          if (!survival.survived) {
            events.push(...applyCharacterDeath(raiderChar, `Killed in failed raid on ${target.name}`, state.turn, state));
            raidCharConsequences.push(survival.narrative);
            events.push(...processRelationshipDeathEffects(raiderChar, state, rng));
            if (state.factions[raiderChar.factionId]?.leader === raiderChar.name) {
              const { successor, events: succEvents } = generateSuccessor(raiderChar, state, rng);
              state.characters[successor.id] = successor;
              events.push(...succEvents);
            }
          } else if (survival.wounded) {
            applyCharacterWound(raiderChar, state.turn);
            raidCharConsequences.push(survival.narrative);
          }
        }

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
          consequences: [`${faction.name} power -${result.raiderLosses}`, ...raidCharConsequences],
          hookPotential: 2,
        });
      }
      break;
    }

    case 'recruit': {
      const recruited = rng.int(rec.recruitRange[0], rec.recruitRange[1]);
      const recruitMod = getTagModifier(faction, state, 'recruitEfficiency');
      const recruitCostMult = 1 - recruitMod * 0.5; // higher efficiency = lower cost
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
      const fortifyMult = 1 + getTagModifier(faction, state, 'defenseBonus');
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
      const patrolMult = 1 + getTagModifier(faction, state, 'defenseBonus');
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
      const taxMult = 1 + getTagModifier(faction, state, 'incomeRate');
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
      // Scheming — targets the most powerful rival
      const rivals = Object.values(state.factions)
        .filter(f => f.id !== faction.id && !faction.alliances.includes(f.id))
        .sort((a, b) => b.power - a.power);
      const target = rivals[0];
      if (target) {
        const schemeMult = 1 + getTagModifier(faction, state, 'schemeEffect');
        const corruptionGain = Math.floor(rng.int(dc.schemeCorruptionRange[0], dc.schemeCorruptionRange[1]) * schemeMult);
        target.corruption = clamp(target.corruption + corruptionGain, 0, 100);
        faction.gold = Math.max(0, faction.gold - dc.schemeCost);
        events.push({
          id: `scheme_${faction.id}_t${state.turn}`,
          turn: state.turn,
          season: state.season,
          year: state.year,
          type: 'scandal',
          text: `${faction.leader} works behind the scenes, undermining ${target.name} through manipulation and intrigue.`,
          icon: '🗡️',
          factionId: faction.id,
          consequences: [`${target.name} corruption increases`],
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
      const investMult = 1 + getTagModifier(faction, state, 'tradeIncome');
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
      const bribeMult = 1 - getTagModifier(faction, state, 'tradeIncome') * 0.3; // traders pay less for bribes
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

        // Character survival rolls, renown, and new systems
        const charConsequences: string[] = [];
        if (atkChar && state.characters) {
          const attackerWon = result.outcome === 'decisive_victory' || result.outcome === 'victory' || result.outcome === 'pyrrhic_victory';
          updateCharacterRenown(atkChar, attackerWon, result.outcome);
          const survival = rollCharacterSurvival(atkChar, result.outcome, true, rng);
          if (!survival.survived) {
            // Last stand check
            const lastStand = rollLastStand(atkChar, rng);
            if (lastStand) {
              atkChar.lastStand = lastStand;
              charConsequences.push(lastStand.narrative);
              defender.power = clamp(defender.power - lastStand.extraCasualties, 0, defender.maxPower);
              if (lastStand.flippedBattle && !result.territoryChanged) {
                result.territoryChanged = true;
                defender.controlledLocations = defender.controlledLocations.filter(id => id !== target.id);
                faction.controlledLocations.push(target.id);
              }
            }
            events.push(...applyCharacterDeath(atkChar, `Killed in battle at ${target.name}`, state.turn, state));
            charConsequences.push(survival.narrative);
            // Vendetta + trophy if a defender character was responsible
            if (defChar && defChar.status !== 'dead') {
              events.push(...createVendettas(atkChar, defChar, state, target.name));
              events.push(...awardTrophy(defChar, atkChar, state.turn));
            }
            // Relationship death effects
            events.push(...processRelationshipDeathEffects(atkChar, state, rng));
            // Succession
            const factionChars = Object.values(state.characters).filter(
              c => c.factionId === atkChar.factionId && c.status !== 'dead' && c.id !== atkChar.id
            );
            if (factionChars.length === 0 || state.factions[atkChar.factionId]?.leader === atkChar.name) {
              const { successor, events: succEvents } = generateSuccessor(atkChar, state, rng);
              state.characters[successor.id] = successor;
              events.push(...succEvents);
            }
          } else if (survival.wounded) {
            applyCharacterWound(atkChar, state.turn);
            charConsequences.push(survival.narrative);
          }
        }
        if (defChar && state.characters) {
          const defenderWon = result.outcome === 'repelled' || result.outcome === 'routed';
          updateCharacterRenown(defChar, defenderWon, result.outcome);
          const survival = rollCharacterSurvival(defChar, result.outcome, false, rng);
          if (!survival.survived) {
            // Last stand check
            const lastStand = rollLastStand(defChar, rng);
            if (lastStand) {
              defChar.lastStand = lastStand;
              charConsequences.push(lastStand.narrative);
              faction.power = clamp(faction.power - lastStand.extraCasualties, 0, faction.maxPower);
              if (lastStand.flippedBattle && result.territoryChanged) {
                result.territoryChanged = false;
                faction.controlledLocations = faction.controlledLocations.filter(id => id !== target.id);
                defender.controlledLocations.push(target.id);
              }
            }
            events.push(...applyCharacterDeath(defChar, `Killed defending ${target.name}`, state.turn, state));
            charConsequences.push(survival.narrative);
            // Vendetta + trophy if attacker was responsible
            if (atkChar && atkChar.status !== 'dead') {
              events.push(...createVendettas(defChar, atkChar, state, target.name));
              events.push(...awardTrophy(atkChar, defChar, state.turn));
            }
            // Relationship death effects
            events.push(...processRelationshipDeathEffects(defChar, state, rng));
            // Succession
            const defFactionChars = Object.values(state.characters).filter(
              c => c.factionId === defChar.factionId && c.status !== 'dead' && c.id !== defChar.id
            );
            if (defFactionChars.length === 0 || state.factions[defChar.factionId]?.leader === defChar.name) {
              const { successor, events: succEvents } = generateSuccessor(defChar, state, rng);
              state.characters[successor.id] = successor;
              events.push(...succEvents);
            }
          } else if (survival.wounded) {
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
      const tradeMult = 1 + getTagModifier(faction, state, 'tradeIncome');
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
      const vendettaEvents = events.filter(e => e.id.startsWith('vendetta_'));
      for (const e of vendettaEvents) {
        lines.push(`  VENDETTA: ${e.text}`);
      }
      const successionEvents = events.filter(e => e.id.startsWith('succession_'));
      for (const e of successionEvents) {
        lines.push(`  SUCCESSION: ${e.text}`);
      }
      const councilEvents = events.filter(e => e.id.startsWith('council_'));
      for (const e of councilEvents) {
        lines.push(`  COUNCIL: ${e.text}`);
      }
      const relationshipEvents = events.filter(e => e.id.startsWith('relationship_') || e.id.startsWith('blood_oath_'));
      for (const e of relationshipEvents) {
        lines.push(`  BOND: ${e.text}`);
      }
    }
  }

  return lines.join('\n');
}
