import type { WorldState, WorldEvent, Season } from './types.js';
import type { SeededRNG } from './rng.js';

// ============================================================
// Procedural Narrative Generator
//
// Generates unique flavor text for turn summaries by combining
// template fragments with world state. No two recaps read the same.
// ============================================================

/** Season-specific atmospheric openers */
const SEASON_OPENERS: Record<Season, string[]> = {
  Spring: [
    'The snows retreat, revealing {state}.',
    'Mud season. The roads soften, but the politics harden.',
    'New growth pushes through scorched earth. Spring comes whether the world deserves it or not.',
    'Birds return to the eaves of {loc}. They don\'t know what happened here.',
    'The first warm wind carries the smell of {scent}.',
  ],
  Summer: [
    'The heat presses down on {loc} like a gauntlet.',
    'Long days. Time enough for war, and for the consequences of war.',
    'Summer storms gather over the highlands. Lightning and rumors.',
    'The sun bakes the roads hard. Good marching weather.',
    'Flies gather where the last battle was fought. Summer remembers.',
  ],
  Autumn: [
    'The harvest comes, but who will live to eat it?',
    'Amber light falls on {loc}. The trees know what\'s coming.',
    'Cold mornings now. Soldiers stamp their feet and wonder about winter.',
    'The year turns. Debts come due.',
    'Geese fly south. They have the right idea.',
  ],
  Winter: [
    'Snow blankets the sins of autumn. For now.',
    'The cold comes like a debt collector — inevitable and merciless.',
    'Frozen roads. Frozen rivers. Some things don\'t freeze: ambition, hunger, revenge.',
    'Winter\'s teeth close on {loc}. Survival is the only currency that matters.',
    'The hearth fires burn low in {loc}. People count their stores and their enemies.',
  ],
};

/** State-of-the-world descriptors based on conditions */
const STATE_FRAGMENTS: Array<{
  condition: (state: WorldState) => boolean;
  fragments: string[];
}> = [
  {
    condition: (s) => {
      const crown = s.factions['aurelian_crown'];
      return !!crown && crown.corruption > 80;
    },
    fragments: [
      'The empire rots from within. Court officials sell positions while peasants starve.',
      'Imperial corruption is now an open joke. Even the tax collectors bribe each other.',
      'The Crown\'s grip loosens with each passing season. Everyone can feel it.',
    ],
  },
  {
    condition: (s) => {
      const crown = s.factions['aurelian_crown'];
      return !!crown && crown.power <= 20;
    },
    fragments: [
      'The imperial legions are a shadow of their former glory. Barracks stand half-empty.',
      'Few answer the Crown\'s call to arms anymore. Why fight for a dying empire?',
      'Imperial patrols have become rare. The roads belong to whoever is bold enough to take them.',
    ],
  },
  {
    condition: (s) => {
      const grak = s.characters?.['warchief_grak'];
      return !!grak && grak.status === 'active' && grak.renown >= 70;
    },
    fragments: [
      'Grak\'s name is spoken in fearful whispers from {loc} to the capital.',
      'The tribes grow bolder under Grak\'s banner. United, they are something new. Something dangerous.',
    ],
  },
  {
    condition: (s) => {
      const grak = s.characters?.['warchief_grak'];
      return !!grak && grak.status === 'dead';
    },
    fragments: [
      'Without Grak, the horde fractures. Old tribal hatreds resurface.',
      'The goblin tribes squabble over Grak\'s legacy. Unity was always his trick, not theirs.',
    ],
  },
  {
    condition: (s) => {
      const thorne = s.factions['house_thorne'];
      return !!thorne && thorne.morale >= 60;
    },
    fragments: [
      'House Thorne holds the line. Their banners fly defiantly against the odds.',
      'The people of the eastern march sleep easier knowing Thorne still stands.',
    ],
  },
  {
    condition: (s) => {
      const thorne = s.factions['house_thorne'];
      return !!thorne && thorne.power <= 10;
    },
    fragments: [
      'House Thorne is bleeding out. Honor doesn\'t stop arrows.',
      'How long can Thorne hold? The question hangs over every war council.',
    ],
  },
  {
    condition: (s) => {
      const valdris = s.factions['house_valdris'];
      return !!valdris && valdris.gold >= 250;
    },
    fragments: [
      'Valdris grows rich while others bleed. A familiar pattern.',
      'Lord Valdris counts his gold and his opportunities. Both are accumulating.',
    ],
  },
  {
    condition: (s) => {
      const guild = s.factions['silver_road_guild'];
      return !!guild && guild.gold >= 400;
    },
    fragments: [
      'The Guild\'s coffers overflow. In times of chaos, someone always profits.',
      'Sera Blackwood plays every side. The caravans still move. The gold still flows.',
    ],
  },
  {
    condition: (s) => s.activeTreaties.length >= 2,
    fragments: [
      'The diplomatic web grows complex. Alliances shift like sand.',
      'Treaties multiply. Whether they hold is another matter entirely.',
    ],
  },
  {
    condition: (s) => {
      const dead = Object.values(s.characters ?? {}).filter(c => c.status === 'dead');
      return dead.length >= 3;
    },
    fragments: [
      'The fallen are many now. Their names echo in hall and tavern alike.',
      'Too many empty chairs at war councils. This conflict has claimed its share of leaders.',
    ],
  },
];

/** Conflict-specific narrative fragments */
const CONFLICT_FRAGMENTS: Array<{
  condition: (events: WorldEvent[]) => boolean;
  fragments: string[];
}> = [
  {
    condition: (events) => events.filter(e => e.type === 'battle').length >= 2,
    fragments: [
      'Blood soaks multiple fields this season. The war escalates.',
      'The fighting spreads. What started as border skirmishes has become open war.',
      'Two battles in a single season. The realm bleeds freely now.',
    ],
  },
  {
    condition: (events) => events.some(e => e.type === 'battle' && e.text.includes('decisive')),
    fragments: [
      'A decisive blow reshapes the map. The survivors will remember this day.',
      'The balance of power shifts dramatically. Nothing will be the same.',
    ],
  },
  {
    condition: (events) => events.some(e => e.type === 'raid' && e.text.includes('raids')),
    fragments: [
      'Raiders strike and vanish. The common folk pay the price, as always.',
      'Smoke rises from raided settlements. The cycle of violence continues.',
    ],
  },
  {
    condition: (events) => events.some(e => e.type === 'alliance'),
    fragments: [
      'New alliances form. In desperate times, even old enemies find common ground.',
      'A handshake today. How long before the knife comes out?',
    ],
  },
  {
    condition: (events) => events.some(e => e.type === 'treaty'),
    fragments: [
      'Diplomats burn midnight candles, drafting terms that may or may not hold.',
      'Words on parchment. Some call it peace. Others call it a pause.',
    ],
  },
  {
    condition: (events) => events.every(e => e.type !== 'battle' && e.type !== 'raid'),
    fragments: [
      'A quiet season. But quiet here means the storm is still gathering.',
      'No blood spilled this turn. A rare mercy. Enjoy it while it lasts.',
      'Peace, of a sort. The kind that\'s just a lull between storms.',
    ],
  },
];

/** Closing hooks — tease what might come next */
const CLOSING_HOOKS: string[] = [
  'The question isn\'t whether violence will return. It\'s when, and who will be ready.',
  'Somewhere, someone is making a plan. It won\'t be a good one for everyone.',
  'The players are set. The board shifts. What happens next is anyone\'s guess.',
  'Winter is always coming. In this world, so is war.',
  'The next season will bring answers. Whether anyone wants those answers is another matter.',
  'Every faction holds its breath. The next move could change everything.',
  'The people pray for peace. The powerful plan for advantage. Same as it ever was.',
  'History is being written in blood and gold. The ink isn\'t dry yet.',
  'Listen carefully. You can hear the gears of fate turning.',
  'What comes next? That depends on who\'s brave enough — or desperate enough — to act.',
];

/** Character spotlight fragments */
function getCharacterSpotlight(state: WorldState, rng: SeededRNG): string | null {
  const chars = Object.values(state.characters ?? {}).filter(c => c.status !== 'dead');
  if (chars.length === 0) return null;

  // Pick a random living character with some story to tell
  const interesting = chars.filter(c =>
    c.battlesWon + c.battlesLost >= 2 ||
    c.renown >= 60 ||
    (c.timesWounded ?? 0) >= 1 ||
    c.abilities.some(a => a.gainedTurn)
  );

  if (interesting.length === 0) return null;
  const char = rng.pick(interesting);

  const spotlights = [
    `${char.name} watches from ${state.locations[char.locationId]?.name ?? 'the shadows'}. ${char.traits.length > 3 ? 'The years have changed them.' : 'Still the same as ever.'}`,
    `Word is ${char.name} has been ${char.battlesWon > char.battlesLost ? 'sharpening their blade' : 'counting their scars'}. The next battle will tell.`,
    `${char.name}${char.renown >= 70 ? '\'s legend grows' : ' endures'}, ${char.role === 'champion' ? 'a sword waiting for a worthy foe' : char.role === 'spymaster' ? 'a spider at the center of a web' : 'a force to be reckoned with'}.`,
  ];

  if ((char.timesWounded ?? 0) >= 2) {
    spotlights.push(`${char.name} carries ${char.timesWounded} old wounds now. Each one a story. Each one a lesson.`);
  }
  if (char.battlesWon >= 3) {
    spotlights.push(`${char.name} hasn't lost a step. ${char.battlesWon} victories and counting.`);
  }

  return rng.pick(spotlights);
}

/**
 * Generate a full narrative recap for a turn.
 * Combines season atmosphere, world state, conflict report, character
 * spotlight, and a closing hook into a unique narrative paragraph.
 */
export function generateNarrativeRecap(
  state: WorldState,
  events: WorldEvent[],
  rng: SeededRNG,
): string {
  const parts: string[] = [];

  // 1. Season opener
  const openers = SEASON_OPENERS[state.season];
  let opener = rng.pick(openers);

  // Fill in template tokens
  const locations = Object.values(state.locations);
  const randomLoc = rng.pick(locations);
  opener = opener.replace(/{loc}/g, randomLoc.name);
  opener = opener.replace(/{state}/g, state.turn > 8 ? 'a changed landscape' : 'the world as it was');
  opener = opener.replace(/{scent}/g, rng.pick([
    'smoke and rain', 'turned earth and old blood', 'wildflowers and desperation',
    'woodsmoke and ambition', 'thawing fields and fading hope',
  ]));
  parts.push(opener);

  // 2. World state fragment (pick 1-2 that match)
  const matchingState = STATE_FRAGMENTS.filter(f => f.condition(state));
  if (matchingState.length > 0) {
    const chosen = rng.pick(matchingState);
    let fragment = rng.pick(chosen.fragments);
    fragment = fragment.replace(/{loc}/g, randomLoc.name);
    parts.push(fragment);
  }

  // 3. Conflict fragment
  const matchingConflict = CONFLICT_FRAGMENTS.filter(f => f.condition(events));
  if (matchingConflict.length > 0) {
    const chosen = rng.pick(matchingConflict);
    parts.push(rng.pick(chosen.fragments));
  }

  // 4. Character spotlight (30% chance)
  if (rng.chance(0.3)) {
    const spotlight = getCharacterSpotlight(state, rng);
    if (spotlight) parts.push(spotlight);
  }

  // 5. Closing hook
  parts.push(rng.pick(CLOSING_HOOKS));

  return parts.join(' ');
}
