// ============================================================
// Aurelian Decline Preset
//
// The original WorldEngine story, packaged as a WorldDefinition
// preset that can be selected from the initialization tab.
// ============================================================

import type { WorldDefinition, Faction, Location, Character, EventTemplate, StoryHook } from '../../engine/types.js';
import factionsData from '../factions.json';
import locationsData from '../locations.json';
import charactersData from '../characters.json';
import eventsPool from '../events-pool.json';
import storyHooks from '../story-hooks.json';

/** Tag mappings for the original Aurelian factions */
const FACTION_TAGS: Record<string, string[]> = {
  aurelian_crown: ['decaying-empire', 'corrupt', 'imperialist', 'bureaucratic'],
  house_valdris: ['scheming', 'patient', 'expansionist', 'trading'],
  house_thorne: ['noble', 'honorable', 'defensive', 'disciplined'],
  iron_fang: ['insurgent', 'desperate', 'guerrilla', 'raiding'],
  red_wolves: ['desperate', 'guerrilla', 'cautious', 'parasitic'],
  greentusk_horde: ['warlord', 'aggressive', 'unified', 'expansionist'],
  silver_road_guild: ['mercantile', 'diplomatic', 'opportunistic', 'trading'],
};

const FACTION_COLORS: Record<string, string> = {
  aurelian_crown: '#d4a843',
  house_valdris: '#8e44ad',
  house_thorne: '#27ae60',
  iron_fang: '#c0392b',
  red_wolves: '#e74c3c',
  greentusk_horde: '#2ecc71',
  silver_road_guild: '#3498db',
};

function addTagsToFactions(factions: unknown[]): Faction[] {
  return (factions as Faction[]).map(f => ({
    ...f,
    tags: FACTION_TAGS[f.id] ?? [],
    color: FACTION_COLORS[f.id],
  }));
}

export const AURELIAN_PRESET: WorldDefinition = {
  meta: {
    name: 'The Aurelian Decline',
    description: 'A crumbling empire, ambitious nobles, desperate bandits, and a rising goblin horde. The old order is dying — what comes next?',
    theme: 'medieval-fantasy',
    startingSeason: 'Spring',
    seasonNames: ['Spring', 'Summer', 'Autumn', 'Winter'],
  },
  factions: addTagsToFactions(factionsData),
  locations: locationsData as unknown as Location[],
  characters: charactersData as unknown as Character[],
  events: eventsPool as unknown as EventTemplate[],
  storyHooks: storyHooks as unknown as StoryHook[],
  availableTags: [
    'aggressive', 'defensive', 'cautious', 'reckless', 'patient', 'opportunistic',
    'trading', 'hoarding', 'generous', 'exploitative', 'self-sufficient', 'parasitic', 'industrious',
    'diplomatic', 'isolationist', 'expansionist', 'imperialist', 'revolutionary', 'scheming', 'honorable', 'treacherous',
    'corrupt', 'disciplined', 'fanatical', 'fractured', 'unified', 'decadent', 'desperate', 'zealous',
    'raiding', 'fortifying', 'guerrilla', 'siege-capable', 'mercenary', 'conscripting', 'elite',
    'greedy', 'tyrannical', 'noble', 'mercantile', 'insurgent', 'hegemon', 'zealot', 'pirate',
    'feudal', 'shadow-broker', 'warlord', 'merchant-prince', 'cultist', 'nomadic', 'decaying-empire',
  ],
};
