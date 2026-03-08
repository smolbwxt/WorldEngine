// ============================================================
// Faction Lifecycle — Organic Death & Birth of Factions
//
// Factions aren't static. They collapse, get absorbed, splinter,
// and new ones rise from rebellion, defection, refugees, or trade.
// Every transition generates narrative-rich chronicle events.
// ============================================================

import type { WorldState, WorldEvent, Faction, Character, FactionPersonality } from './types.js';
import type { SeededRNG } from './rng.js';
import { clamp } from './world-state.js';
import { createBlankFaction, createBlankCharacter } from './gm-actions.js';

// ============================================================
// Faction Death
// ============================================================

/** Check all factions for collapse / absorption conditions */
export function processFactionDeaths(state: WorldState, rng: SeededRNG): WorldEvent[] {
  const events: WorldEvent[] = [];
  const toRemove: string[] = [];

  for (const faction of Object.values(state.factions)) {
    // Path 1: Collapse — no power, no territory
    if (faction.power <= 0 && faction.controlledLocations.length === 0) {
      events.push(...collapseFaction(state, faction, rng));
      toRemove.push(faction.id);
      continue;
    }

    // Path 2: Absorption — very weak, single location, and a neighbor is much stronger
    if (faction.morale <= 15 && faction.controlledLocations.length === 1 && faction.power <= 5) {
      const absorber = findAbsorber(state, faction);
      if (absorber && rng.chance(0.5)) {
        events.push(...absorbFaction(state, faction, absorber, rng));
        toRemove.push(faction.id);
        continue;
      }
    }
  }

  // Clean up removed factions
  for (const id of toRemove) {
    delete state.factions[id];
    // Clean up references in other factions
    for (const f of Object.values(state.factions)) {
      delete f.relationships[id];
      f.alliances = f.alliances.filter(a => a !== id);
      f.enemies = f.enemies.filter(e => e !== id);
      f.treaties = f.treaties.filter(t => !t.parties.includes(id));
    }
    // Clean up active treaties
    state.activeTreaties = state.activeTreaties.filter(t => !t.parties.includes(id));
  }

  return events;
}

function collapseFaction(state: WorldState, faction: Faction, rng: SeededRNG): WorldEvent[] {
  const events: WorldEvent[] = [];

  // Characters become unaligned or die
  const chars = Object.values(state.characters).filter(c => c.factionId === faction.id && c.status !== 'dead');
  const otherFactions = Object.values(state.factions).filter(f => f.id !== faction.id);

  for (const char of chars) {
    // High renown characters get absorbed by whoever controls their location
    const locationOwner = otherFactions.find(f => f.controlledLocations.includes(char.locationId));
    if (locationOwner && char.renown >= 30) {
      char.factionId = locationOwner.id;
      char.loyalty = clamp(char.loyalty - 30, 0, 100);
      events.push({
        id: `collapse_absorb_${char.id}_t${state.turn}`,
        turn: state.turn, season: state.season, year: state.year,
        type: 'migration',
        text: `With the fall of ${faction.name}, ${char.name} pledges service to ${locationOwner.name} — though loyalty bought in desperation is fragile.`,
        icon: '🚶', factionId: locationOwner.id,
        consequences: [`${char.name} joins ${locationOwner.name} with reduced loyalty`],
        hookPotential: 3,
      });
    } else {
      // Low-renown characters simply disappear
      char.status = 'dead';
      char.deathTurn = state.turn;
      char.deathCause = `Lost in the dissolution of ${faction.name}`;
    }
  }

  events.push({
    id: `collapse_${faction.id}_t${state.turn}`,
    turn: state.turn, season: state.season, year: state.year,
    type: 'story_hook',
    text: `${faction.name} collapses. Without power or territory, the last remnants scatter to the winds. ${faction.leader} is heard from no more.`,
    icon: '💀', factionId: faction.id,
    consequences: [`${faction.name} is no more`, `${chars.length} characters displaced`],
    hookPotential: 5,
  });

  return events;
}

function findAbsorber(state: WorldState, weakFaction: Faction): Faction | null {
  if (weakFaction.controlledLocations.length === 0) return null;
  const locId = weakFaction.controlledLocations[0];
  const loc = state.locations[locId];
  if (!loc) return null;

  // Find the strongest neighboring faction
  let best: Faction | null = null;
  let bestPower = 0;
  for (const f of Object.values(state.factions)) {
    if (f.id === weakFaction.id) continue;
    // Check if they share a border (connected locations)
    const sharesTerritory = f.controlledLocations.some(fLocId => {
      const fLoc = state.locations[fLocId];
      return fLoc && (fLoc.connectedTo.includes(locId) || loc.connectedTo.includes(fLocId));
    });
    if (sharesTerritory && f.power > bestPower) {
      best = f;
      bestPower = f.power;
    }
  }
  return best;
}

function absorbFaction(state: WorldState, weak: Faction, absorber: Faction, rng: SeededRNG): WorldEvent[] {
  const events: WorldEvent[] = [];

  // Transfer territory
  for (const locId of weak.controlledLocations) {
    absorber.controlledLocations.push(locId);
  }

  // Transfer living characters with loyalty penalty
  const chars = Object.values(state.characters).filter(c => c.factionId === weak.id && c.status !== 'dead');
  for (const char of chars) {
    char.factionId = absorber.id;
    char.loyalty = clamp(char.loyalty - 20, 0, 100);
  }

  // Absorber gains some resources
  absorber.gold += Math.floor(weak.gold * 0.7);
  absorber.power = Math.min(absorber.maxPower, absorber.power + Math.floor(weak.power * 0.5));

  events.push({
    id: `absorb_${weak.id}_${absorber.id}_t${state.turn}`,
    turn: state.turn, season: state.season, year: state.year,
    type: 'diplomacy',
    text: `${weak.name}, broken and desperate, surrenders to ${absorber.name}. Their lands, treasury, and surviving warriors are absorbed. ${weak.leader} bends the knee — or disappears.`,
    icon: '🏳️', factionId: absorber.id,
    consequences: [
      `${absorber.name} gains ${weak.controlledLocations.length} location(s)`,
      `${chars.length} character(s) transfer allegiance`,
      `${absorber.name} gains ${Math.floor(weak.gold * 0.7)} gold`,
    ],
    hookPotential: 5,
  });

  return events;
}

// ============================================================
// Faction Birth
// ============================================================

/** Check conditions for organic faction emergence */
export function processFactionBirths(state: WorldState, rng: SeededRNG): WorldEvent[] {
  const events: WorldEvent[] = [];

  // Path 1: Rebellion — oppressed territory rises up
  events.push(...checkRebellion(state, rng));

  // Path 2: Defection — high-renown disloyal character breaks away
  events.push(...checkDefection(state, rng));

  // Path 3: Splintering — highly corrupt faction splits in civil war
  events.push(...checkSplintering(state, rng));

  // Path 4: Economic emergence — prosperous unclaimed territory self-organizes
  events.push(...checkEconomicEmergence(state, rng));

  return events;
}

/** Rebellion: low-prosperity location under high-corruption owner spawns rebels */
function checkRebellion(state: WorldState, rng: SeededRNG): WorldEvent[] {
  const events: WorldEvent[] = [];

  for (const faction of Object.values(state.factions)) {
    if (faction.corruption < 70) continue;

    for (const locId of faction.controlledLocations) {
      const loc = state.locations[locId];
      if (!loc || loc.prosperity > 25) continue;
      if (loc.population < 50) continue;

      // Probability scales with corruption and inversely with prosperity
      const chance = (faction.corruption - 60) * 0.005 * (1 - loc.prosperity / 100);
      if (!rng.chance(chance)) continue;

      // Spawn rebel faction
      const rebelId = `rebel_${locId}_t${state.turn}`;
      const rebel = createBlankFaction(rebelId);
      rebel.name = `${loc.name} Rebels`;
      rebel.type = 'rebels';
      rebel.tags = ['desperate', 'aggressive', 'insurgent'];
      rebel.color = '#c0392b';
      rebel.description = `Born from the oppression of ${faction.name}, the people of ${loc.name} have taken up arms.`;
      rebel.leader = generateRebelLeaderName(rng);
      rebel.power = Math.max(5, Math.floor(loc.population / 20));
      rebel.maxPower = rebel.power * 2;
      rebel.morale = 80; // Rebels start zealous
      rebel.gold = rng.int(10, 30);
      rebel.corruption = 0;
      rebel.personality = { dealmaking: 0.2, aggression: 0.8, greed: 0.3 };

      // Take the location
      faction.controlledLocations = faction.controlledLocations.filter(id => id !== locId);
      rebel.controlledLocations = [locId];

      // Initialize relationships — hostile to parent, neutral to others
      rebel.relationships[faction.id] = -80;
      for (const f of Object.values(state.factions)) {
        if (f.id === faction.id) {
          f.relationships[rebelId] = -60;
        } else {
          f.relationships[rebelId] = 0;
          rebel.relationships[f.id] = 0;
        }
      }

      state.factions[rebelId] = rebel;

      // Generate rebel leader character
      const leaderId = `char_rebel_${rebelId}`;
      const leader = createBlankCharacter(leaderId, rebelId, locId);
      leader.name = rebel.leader;
      leader.title = 'Rebel Captain';
      leader.role = 'commander';
      leader.prowess = rng.int(4, 8);
      leader.cunning = rng.int(3, 7);
      leader.authority = rng.int(5, 9);
      leader.renown = rng.int(10, 30);
      leader.loyalty = 95;
      leader.activeSince = state.turn;
      leader.traits = ['firebrand', 'desperate'];
      leader.description = `Rose from the common folk of ${loc.name} to lead a rebellion against ${faction.name}.`;
      state.characters[leaderId] = leader;

      events.push({
        id: `rebellion_${rebelId}_t${state.turn}`,
        turn: state.turn, season: state.season, year: state.year,
        type: 'story_hook',
        text: `Rebellion! The people of ${loc.name}, crushed under ${faction.name}'s corrupt rule, rise up under ${rebel.leader}. A new faction is born in blood and fury.`,
        icon: '🔥', factionId: rebelId, locationId: locId,
        consequences: [
          `${rebel.name} seizes ${loc.name}`,
          `${faction.name} loses control of ${loc.name}`,
          `${rebel.leader} emerges as rebel leader`,
        ],
        hookPotential: 5,
      });

      // Only one rebellion per turn
      return events;
    }
  }

  return events;
}

/** Defection: high-renown character with low loyalty breaks away */
function checkDefection(state: WorldState, rng: SeededRNG): WorldEvent[] {
  const events: WorldEvent[] = [];

  for (const char of Object.values(state.characters)) {
    if (char.status !== 'active') continue;
    if (char.renown < 60 || char.loyalty > 30) continue;

    // Must be at a location they could claim
    const loc = state.locations[char.locationId];
    if (!loc) continue;

    // They need to be somewhere they can realistically break away
    const currentOwner = Object.values(state.factions).find(f => f.controlledLocations.includes(char.locationId));
    if (!currentOwner || currentOwner.id !== char.factionId) continue;
    if (currentOwner.controlledLocations.length <= 1) continue; // Can't defect from a one-location faction

    // Chance scales with renown and inversely with loyalty
    const chance = (char.renown - 50) * 0.003 * (1 - char.loyalty / 100);
    if (!rng.chance(chance)) continue;

    const oldFaction = state.factions[char.factionId];
    if (!oldFaction) continue;

    // Create the breakaway faction
    const newFactionId = `defect_${char.id}_t${state.turn}`;
    const newFaction = createBlankFaction(newFactionId);
    newFaction.name = `${char.name}'s Host`;
    newFaction.type = 'breakaway';
    newFaction.tags = [...(oldFaction.tags.length > 0 ? [oldFaction.tags[0]] : []), 'ambitious'];
    newFaction.color = shiftColor(oldFaction.color ?? '#888', rng);
    newFaction.description = `${char.name}, once of ${oldFaction.name}, has declared independence. Ambition outweighed loyalty.`;
    newFaction.leader = char.name;
    newFaction.power = Math.max(5, Math.floor(oldFaction.power * 0.25));
    newFaction.maxPower = newFaction.power * 2;
    newFaction.morale = 70;
    newFaction.gold = Math.floor(oldFaction.gold * 0.15);
    newFaction.personality = {
      dealmaking: rngFloat(rng,0.3, 0.7),
      aggression: rngFloat(rng,0.4, 0.8),
      greed: rngFloat(rng,0.3, 0.7),
    };

    // Take the location
    oldFaction.controlledLocations = oldFaction.controlledLocations.filter(id => id !== char.locationId);
    newFaction.controlledLocations = [char.locationId];

    // Drain some power from parent
    oldFaction.power = Math.max(0, oldFaction.power - newFaction.power);
    oldFaction.gold = Math.max(0, oldFaction.gold - newFaction.gold);
    oldFaction.morale = clamp(oldFaction.morale - 10, 0, 100);

    // Set relationships
    newFaction.relationships[oldFaction.id] = -50;
    oldFaction.relationships[newFactionId] = -40;
    for (const f of Object.values(state.factions)) {
      if (f.id === oldFaction.id) continue;
      const parentRel = f.relationships[oldFaction.id] ?? 0;
      f.relationships[newFactionId] = Math.floor(parentRel * 0.5);
      newFaction.relationships[f.id] = Math.floor(parentRel * 0.3);
    }

    state.factions[newFactionId] = newFaction;

    // Transfer character
    char.factionId = newFactionId;
    char.loyalty = 95; // Loyal to their own cause now

    // Any characters at the same location with low loyalty might join
    for (const otherChar of Object.values(state.characters)) {
      if (otherChar.id === char.id) continue;
      if (otherChar.factionId !== oldFaction.id || otherChar.status !== 'active') continue;
      if (otherChar.locationId !== char.locationId) continue;
      if (otherChar.loyalty > 40) continue;
      if (rng.chance(0.5)) {
        otherChar.factionId = newFactionId;
        otherChar.loyalty = 60;
      }
    }

    events.push({
      id: `defection_${newFactionId}_t${state.turn}`,
      turn: state.turn, season: state.season, year: state.year,
      type: 'betrayal',
      text: `${char.name} breaks from ${oldFaction.name}! Seizing ${loc.name} and a portion of the treasury, ${char.title} declares independence. "${oldFaction.leader} has lost the right to lead," ${char.name} proclaims.`,
      icon: '⚔️', factionId: newFactionId, locationId: char.locationId,
      consequences: [
        `${newFaction.name} claims ${loc.name}`,
        `${oldFaction.name} loses power and gold`,
        `${char.name} is now a faction leader`,
      ],
      hookPotential: 5,
    });

    // Only one defection per turn
    return events;
  }

  return events;
}

/** Splintering: massively corrupt faction splits in civil war */
function checkSplintering(state: WorldState, rng: SeededRNG): WorldEvent[] {
  const events: WorldEvent[] = [];

  for (const faction of Object.values(state.factions)) {
    if (faction.corruption < 90 || faction.morale > 20) continue;
    if (faction.controlledLocations.length < 2) continue;

    // Need at least 2 living characters for the split
    const chars = Object.values(state.characters).filter(
      c => c.factionId === faction.id && c.status !== 'dead'
    );
    if (chars.length < 2) continue;

    if (!rng.chance(0.15)) continue;

    // Find the dissident leader — highest renown non-leader
    const dissidentChar = chars
      .filter(c => c.name !== faction.leader)
      .sort((a, b) => b.renown - a.renown)[0];
    if (!dissidentChar) continue;

    // Split territory — dissident gets locations where they have characters
    const dissidentLocs: string[] = [];
    const loyalistLocs: string[] = [];
    for (const locId of faction.controlledLocations) {
      const hasDissident = chars.some(c => c.locationId === locId && c.name !== faction.leader && c.loyalty < 50);
      if (hasDissident && dissidentLocs.length < faction.controlledLocations.length - 1) {
        dissidentLocs.push(locId);
      } else {
        loyalistLocs.push(locId);
      }
    }

    // Ensure at least one location per side
    if (dissidentLocs.length === 0) {
      dissidentLocs.push(loyalistLocs.pop()!);
    }

    // Create splinter faction
    const splinterId = `splinter_${faction.id}_t${state.turn}`;
    const splinter = createBlankFaction(splinterId);
    splinter.name = `${dissidentChar.name}'s ${faction.type === 'rebels' ? 'Vanguard' : 'Loyalists'}`;
    splinter.type = faction.type;
    splinter.tags = [...faction.tags.filter(t => t !== 'corrupt' && t !== 'decaying-empire'), 'reformist'];
    splinter.color = shiftColor(faction.color ?? '#888', rng);
    splinter.description = `A splinter from ${faction.name}'s civil war, led by ${dissidentChar.name} who promises to root out the corruption.`;
    splinter.leader = dissidentChar.name;
    splinter.power = Math.floor(faction.power * 0.4);
    splinter.maxPower = Math.floor(faction.maxPower * 0.5);
    splinter.morale = 60;
    splinter.gold = Math.floor(faction.gold * 0.3);
    splinter.corruption = Math.floor(faction.corruption * 0.3); // Fresh start
    splinter.personality = {
      dealmaking: rngFloat(rng,0.3, 0.7),
      aggression: rngFloat(rng,0.3, 0.7),
      greed: rngFloat(rng,0.2, 0.5),
    };
    splinter.controlledLocations = dissidentLocs;

    // Reduce parent
    faction.controlledLocations = loyalistLocs;
    faction.power = Math.max(1, faction.power - splinter.power);
    faction.gold = Math.max(0, faction.gold - splinter.gold);

    // Set up civil war relationships
    splinter.relationships[faction.id] = -70;
    faction.relationships[splinterId] = -70;
    faction.enemies.push(splinterId);
    splinter.enemies.push(faction.id);

    // Copy other relationships (diminished)
    for (const f of Object.values(state.factions)) {
      if (f.id === faction.id) continue;
      const rel = f.relationships[faction.id] ?? 0;
      f.relationships[splinterId] = Math.floor(rel * 0.6);
      splinter.relationships[f.id] = Math.floor(rel * 0.6);
    }

    state.factions[splinterId] = splinter;

    // Transfer disloyal characters
    for (const char of chars) {
      if (char.name === faction.leader) continue;
      if (dissidentLocs.includes(char.locationId) || char.loyalty < 40) {
        char.factionId = splinterId;
        char.loyalty = 70;
      }
    }

    events.push({
      id: `splinter_${splinterId}_t${state.turn}`,
      turn: state.turn, season: state.season, year: state.year,
      type: 'story_hook',
      text: `Civil war! ${faction.name} tears itself apart. ${dissidentChar.name} leads a breakaway faction, declaring "${faction.leader}'s corruption will destroy us all." The realm holds its breath.`,
      icon: '💥', factionId: splinterId,
      consequences: [
        `${splinter.name} controls ${dissidentLocs.length} location(s)`,
        `${faction.name} loses territory and power`,
        `Civil war between ${faction.name} and ${splinter.name}`,
      ],
      hookPotential: 5,
    });

    // Only one splintering per turn
    return events;
  }

  return events;
}

/** Economic emergence: prosperous unclaimed territory forms a city-state */
function checkEconomicEmergence(state: WorldState, rng: SeededRNG): WorldEvent[] {
  const events: WorldEvent[] = [];

  const claimedLocs = new Set<string>();
  for (const f of Object.values(state.factions)) {
    for (const locId of f.controlledLocations) {
      claimedLocs.add(locId);
    }
  }

  for (const loc of Object.values(state.locations)) {
    if (claimedLocs.has(loc.id)) continue;
    if (loc.prosperity < 60 || loc.population < 100) continue;
    if (loc.type === 'ruins' || loc.type === 'dungeon' || loc.type === 'catacombs') continue;

    if (!rng.chance(0.08)) continue;

    const cityId = `city_${loc.id}_t${state.turn}`;
    const city = createBlankFaction(cityId);
    city.name = `Free City of ${loc.name}`;
    city.type = 'city-state';
    city.tags = ['mercantile', 'isolationist', 'defensive'];
    city.color = '#2ecc71';
    city.description = `The prosperous people of ${loc.name}, tired of being unclaimed territory in a dangerous world, have organized their own defense and governance.`;
    city.leader = generateMerchantLeaderName(rng);
    city.power = Math.max(5, Math.floor(loc.defense + loc.population / 30));
    city.maxPower = city.power * 2;
    city.morale = 70;
    city.gold = Math.floor(loc.prosperity * 3);
    city.corruption = rng.int(0, 10);
    city.personality = { dealmaking: 0.8, aggression: 0.1, greed: 0.6 };
    city.controlledLocations = [loc.id];

    // Neutral to all
    for (const f of Object.values(state.factions)) {
      city.relationships[f.id] = 10;
      f.relationships[cityId] = 10;
    }

    state.factions[cityId] = city;

    // Create a leader character
    const leaderId = `char_city_${cityId}`;
    const leader = createBlankCharacter(leaderId, cityId, loc.id);
    leader.name = city.leader;
    leader.title = 'Mayor';
    leader.role = 'advisor';
    leader.prowess = rng.int(2, 5);
    leader.cunning = rng.int(5, 9);
    leader.authority = rng.int(5, 8);
    leader.renown = rng.int(5, 20);
    leader.loyalty = 90;
    leader.activeSince = state.turn;
    leader.traits = ['pragmatic', 'mercantile'];
    leader.description = `Elected by the merchants and citizens of ${loc.name} to protect their independence.`;
    state.characters[leaderId] = leader;

    events.push({
      id: `emergence_${cityId}_t${state.turn}`,
      turn: state.turn, season: state.season, year: state.year,
      type: 'story_hook',
      text: `The Free City of ${loc.name} declares itself! Merchants and citizens, weary of lawlessness, elect ${city.leader} to govern. Walls are raised, a militia formed. A new power enters the game.`,
      icon: '🏛️', factionId: cityId, locationId: loc.id,
      consequences: [
        `Free City of ${loc.name} claims the territory`,
        `${city.leader} elected as leader`,
      ],
      hookPotential: 4,
    });

    // Only one emergence per turn
    return events;
  }

  return events;
}

// ============================================================
// Helpers
// ============================================================

function rngFloat(rng: SeededRNG, min: number, max: number): number {
  return min + rng.next() * (max - min);
}

const REBEL_FIRST_NAMES = ['Kael', 'Mara', 'Jorin', 'Ashara', 'Dren', 'Tova', 'Rhan', 'Lysa', 'Corvin', 'Elara', 'Bren', 'Yara', 'Theron', 'Nyx', 'Orin', 'Zara'];
const REBEL_LAST_NAMES = ['Ashborn', 'Ironhand', 'Flamekeeper', 'Stonewrath', 'Duskwalker', 'Redhammer', 'Blackthorn', 'Stormbreaker', 'Nightforge', 'Grimholt'];
const MERCHANT_FIRST_NAMES = ['Aldric', 'Sera', 'Cassius', 'Elenna', 'Dorian', 'Valen', 'Mirra', 'Thaddeus', 'Lydia', 'Oren', 'Celeste', 'Rowan'];
const MERCHANT_LAST_NAMES = ['Goldweaver', 'Fairhaven', 'Silvertongue', 'Brighthearth', 'Coinsworth', 'Peaceward', 'Freemantle', 'Truebalance'];

function generateRebelLeaderName(rng: SeededRNG): string {
  return `${rng.pick(REBEL_FIRST_NAMES)} ${rng.pick(REBEL_LAST_NAMES)}`;
}

function generateMerchantLeaderName(rng: SeededRNG): string {
  return `${rng.pick(MERCHANT_FIRST_NAMES)} ${rng.pick(MERCHANT_LAST_NAMES)}`;
}

function shiftColor(hex: string, rng: SeededRNG): string {
  // Slightly shift a hex color to make the splinter feel related but distinct
  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const shift = rng.int(-40, 40);
    const nr = clamp(r + shift, 0, 255);
    const ng = clamp(g - shift, 0, 255);
    const nb = clamp(b + Math.floor(shift / 2), 0, 255);
    return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
  } catch {
    return '#888888';
  }
}
