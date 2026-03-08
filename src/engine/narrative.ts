import type { WorldState, WorldEvent, Season } from './types.js';
import type { SeededRNG } from './rng.js';

// ============================================================
// Procedural Narrative Generator
//
// Generates unique flavor text for turn summaries by combining
// template fragments with world state. No two recaps read the same.
// ============================================================

/** Season-specific atmospheric openers */
const SEASON_OPENERS: Record<string, string[]> = {
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
    condition: (s) => Object.values(s.factions).some(f => f.corruption > 80),
    fragments: [
      'Corruption eats at the foundations of power. Officials sell positions while the common folk starve.',
      'The rot runs deep. Even the tax collectors bribe each other now.',
      'A once-mighty faction crumbles from within. Everyone can feel the end approaching.',
    ],
  },
  {
    condition: (s) => Object.values(s.factions).some(f => f.power <= 15 && f.controlledLocations.length > 0),
    fragments: [
      'A great power fades. Their barracks stand half-empty, their patrols a memory.',
      'Few answer the call to arms anymore. Why fight for a dying cause?',
      'The roads grow dangerous as once-reliable patrols become rare.',
    ],
  },
  {
    condition: (s) => Object.values(s.characters ?? {}).some(c => c.status === 'active' && c.renown >= 70),
    fragments: [
      'A legendary figure\'s name is spoken in fearful whispers across the realm.',
      'Under bold leadership, a faction grows into something new. Something dangerous.',
    ],
  },
  {
    condition: (s) => Object.values(s.characters ?? {}).filter(c => c.status === 'dead' && c.renown >= 50).length >= 1,
    fragments: [
      'The fall of a great leader leaves a power vacuum. Old rivalries resurface.',
      'Without their champion, a faction fractures. Unity was always borrowed, never owned.',
    ],
  },
  {
    condition: (s) => Object.values(s.factions).some(f => f.morale >= 70 && f.power >= 30),
    fragments: [
      'One faction holds the line. Their banners fly defiantly against the odds.',
      'The people sleep easier knowing at least one power still stands firm.',
    ],
  },
  {
    condition: (s) => Object.values(s.factions).some(f => f.power <= 10 && f.morale <= 30),
    fragments: [
      'A faction bleeds out slowly. Honor doesn\'t stop arrows.',
      'How long can the weak endure? The question hangs over every war council.',
    ],
  },
  {
    condition: (s) => Object.values(s.factions).some(f => f.gold >= 300),
    fragments: [
      'Gold accumulates in certain coffers while others bleed. A familiar pattern.',
      'The wealthy count their gold and their opportunities. Both are growing.',
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
    condition: (s) => Object.values(s.characters ?? {}).filter(c => c.status === 'dead').length >= 3,
    fragments: [
      'The fallen are many now. Their names echo in hall and tavern alike.',
      'Too many empty chairs at war councils. This conflict has claimed its share of leaders.',
    ],
  },
  {
    condition: (s) => Object.values(s.characters ?? {}).some(c => c.status !== 'dead' && c.vendettas && c.vendettas.length > 0),
    fragments: [
      'Blood debts remain unpaid. The living sharpen their blades and wait.',
      'Vendettas crisscross the realm like cracks in glass. One more blow and something shatters.',
    ],
  },
  {
    condition: (s) => Object.values(s.characters ?? {}).some(c => c.status !== 'dead' && c.trophies && c.trophies.length >= 2),
    fragments: [
      'Some warriors carry the relics of the fallen. Each trophy tells a story of victory and loss.',
      'Grim trophies change hands. The strong inherit the legacy of the dead.',
    ],
  },
  {
    condition: (s) => Object.values(s.characters ?? {}).some(c => c.activeSince >= s.turn - 4 && c.traits.includes('untested')),
    fragments: [
      'New leaders rise from the ashes of the old. Whether they will prove worthy remains to be seen.',
      'Succession brings uncertainty. The old guard is gone — what comes next is anyone\'s guess.',
    ],
  },
  {
    condition: (s) => Object.values(s.characters ?? {}).some(c => c.relationships && c.relationships.some(r => r.type === 'blood_oath')),
    fragments: [
      'Blood oaths bind warriors across faction lines. Personal honor runs deeper than politics.',
      'Some bonds transcend allegiance. In a world of betrayal, a sworn oath still means something.',
    ],
  },
  {
    condition: (s) => Object.values(s.factions).some(f => f.type === 'rebels'),
    fragments: [
      'Rebels stir in the hinterlands. What begins as desperation may become something more.',
      'The old order cracks. From the rubble, new banners rise.',
    ],
  },
  {
    condition: (s) => Object.values(s.factions).some(f => f.type === 'breakaway'),
    fragments: [
      'A faction born of betrayal tests its wings. Loyalty is a coin that can only be spent once.',
      'The defector\'s gamble: everything to gain, and only the old world to lose.',
    ],
  },
  {
    condition: (s) => Object.values(s.factions).some(f => f.type === 'city-state'),
    fragments: [
      'Free cities dot the map now — merchants who learned that gold means nothing without walls.',
      'The rise of city-states changes the game. Money buys mercenaries. Mercenaries hold walls. Walls make freedom.',
    ],
  },
  {
    condition: (s) => Object.values(s.factions).some(f => f.type === 'player-founded'),
    fragments: [
      'A new power, born of bold action, carves its place in a hostile world.',
      'The newcomers have staked their claim. Now comes the hard part: keeping it.',
    ],
  },
  {
    condition: (s) => {
      const factionCount = Object.keys(s.factions).length;
      return factionCount >= 8;
    },
    fragments: [
      'The realm fragments. More factions than ever vie for shrinking resources.',
      'Too many crowns, too few heads. The world cannot sustain this many ambitions.',
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
  const defaultOpeners = [
    'A new season dawns on {loc}. The world turns, heedless of its inhabitants.',
    'Time moves on. The powerful scheme, the weak endure, and {loc} watches.',
    'Another season. Another chapter in an unfinished story.',
  ];
  const openers = SEASON_OPENERS[state.season] ?? defaultOpeners;
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
