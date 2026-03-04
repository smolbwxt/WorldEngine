import type { WorldState, WorldEvent, EventTemplate, Season } from './types.js';
import type { SeededRNG } from './rng.js';
import type { SimulationConfig } from './config.js';
import eventsPool from '../data/events-pool.json';
import storyHooks from '../data/story-hooks.json';

/** Process random world events for the turn */
export function processRandomEvents(state: WorldState, rng: SeededRNG, config: SimulationConfig): WorldEvent[] {
  const events: WorldEvent[] = [];
  const templates = eventsPool as EventTemplate[];

  // Roll for 0-N random events per turn
  const eventCount = rng.int(0, config.events.maxEventsPerTurn);

  for (let i = 0; i < eventCount; i++) {
    const eligible = templates.filter(t => meetsConditions(t, state));
    if (eligible.length === 0) break;

    const template = rng.weightedPick(
      eligible.map(t => ({ item: t, weight: t.weight }))
    );

    const event = createEventFromTemplate(template, state, rng);
    if (event) {
      events.push(event);
      applyEventEffects(template, event, state, rng);
    }
  }

  return events;
}

/** Check for story beat triggers */
export function processStoryHooks(state: WorldState): WorldEvent[] {
  const events: WorldEvent[] = [];

  for (const hook of storyHooks) {
    if (
      state.turn === hook.triggerTurn &&
      !state.storyBeatsTriggered.includes(hook.id)
    ) {
      state.storyBeatsTriggered.push(hook.id);
      events.push({
        id: `story_${hook.id}_t${state.turn}`,
        turn: state.turn,
        season: state.season,
        year: state.year,
        type: 'story_hook',
        text: hook.text,
        icon: '📜',
        consequences: [],
        hookPotential: hook.hookPotential,
      });
    }
  }

  return events;
}

function meetsConditions(template: EventTemplate, state: WorldState): boolean {
  const cond = template.conditions;
  if (!cond) return true;

  if (cond.minTurn && state.turn < cond.minTurn) return false;
  if (cond.season && state.season !== (cond.season as Season)) return false;
  if (cond.requiresFaction) {
    const hasFaction = Object.values(state.factions).some(f => f.type === cond.requiresFaction);
    if (!hasFaction) return false;
  }

  return true;
}

function createEventFromTemplate(
  template: EventTemplate,
  state: WorldState,
  rng: SeededRNG
): WorldEvent | null {
  let factionId: string | undefined;
  let locationId: string | undefined;

  if (template.effects.targetType === 'faction' && template.conditions?.requiresFaction) {
    const matching = Object.values(state.factions).filter(
      f => f.type === template.conditions!.requiresFaction
    );
    if (matching.length > 0) {
      factionId = rng.pick(matching).id;
    }
  }

  if (template.effects.targetType === 'location') {
    // Pick a random populated location
    const populated = Object.values(state.locations).filter(l => l.population > 0);
    if (populated.length > 0) {
      const loc = rng.pick(populated);
      locationId = loc.id;
    }
  }

  return {
    id: `evt_${template.id}_t${state.turn}`,
    turn: state.turn,
    season: state.season,
    year: state.year,
    type: template.type,
    text: template.text,
    icon: template.icon,
    factionId,
    locationId,
    consequences: [],
    hookPotential: template.hookPotential,
  };
}

function applyEventEffects(
  template: EventTemplate,
  event: WorldEvent,
  state: WorldState,
  _rng: SeededRNG
): void {
  const changes = template.effects.changes;
  const consequences: string[] = [];

  if (template.effects.targetType === 'global') {
    // Apply to all locations / factions
    if ('prosperity' in changes) {
      for (const loc of Object.values(state.locations)) {
        if (loc.population > 0) {
          loc.prosperity = Math.max(0, Math.min(100, loc.prosperity + (changes.prosperity ?? 0)));
        }
      }
      consequences.push(`Global prosperity ${changes.prosperity! > 0 ? '+' : ''}${changes.prosperity}`);
    }
    if ('morale' in changes) {
      for (const f of Object.values(state.factions)) {
        f.morale = Math.max(0, Math.min(100, f.morale + (changes.morale ?? 0)));
      }
      consequences.push(`Global morale ${changes.morale! > 0 ? '+' : ''}${changes.morale}`);
    }
  } else if (template.effects.targetType === 'faction' && event.factionId) {
    const faction = state.factions[event.factionId];
    if (faction) {
      for (const [key, value] of Object.entries(changes)) {
        if (key in faction) {
          (faction as unknown as Record<string, number>)[key] = Math.max(
            0,
            (faction as unknown as Record<string, number>)[key] + value
          );
        }
      }
      consequences.push(`${faction.name}: ${Object.entries(changes).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`).join(', ')}`);
    }
  } else if (template.effects.targetType === 'location' && event.locationId) {
    const loc = state.locations[event.locationId];
    if (loc) {
      for (const [key, value] of Object.entries(changes)) {
        if (key === 'gold') {
          // Gold goes to controlling faction
          const controller = Object.values(state.factions).find(f =>
            f.controlledLocations.includes(loc.id)
          );
          if (controller) controller.gold = Math.max(0, controller.gold + value);
        } else if (key in loc) {
          (loc as unknown as Record<string, number>)[key] = Math.max(
            0,
            (loc as unknown as Record<string, number>)[key] + value
          );
        }
      }
      consequences.push(`${loc.name}: ${Object.entries(changes).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`).join(', ')}`);
    }
  }

  event.consequences = consequences;
}
