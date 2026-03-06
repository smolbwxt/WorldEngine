# The Aurelian Decline — Living World D&D Campaign Engine

A living-world simulation engine for a D&D campaign set in a declining empire. Run it "between sessions" to produce an evolving world with emergent narrative hooks, factional power struggles, named characters who live and die, and AI-painted maps.

---

## Table of Contents

- [Quick Start](#quick-start)
- [The Web UI](#the-web-ui)
  - [World Map](#world-map)
  - [Dashboard](#dashboard)
  - [Faction Panel](#faction-panel)
  - [Characters](#characters)
  - [Diplomacy](#diplomacy)
  - [Chronicle](#chronicle)
  - [Location Detail](#location-detail)
  - [Turn Controls](#turn-controls)
- [Named Characters & NPCs](#named-characters--npcs)
  - [Character Stats](#character-stats)
  - [Combat Integration](#combat-integration)
  - [Mortality & Death Vectors](#mortality--death-vectors)
  - [Progression System](#progression-system)
  - [Rivalries & Vendettas](#rivalries--vendettas)
  - [Legendary Last Stands](#legendary-last-stands)
  - [Trophies & Relics](#trophies--relics)
  - [Character Succession](#character-succession)
  - [War Councils](#war-councils)
  - [Character Relationships](#character-relationships)
- [Artistic Map Generation (Nano Banana 2)](#artistic-map-generation-nano-banana-2)
  - [Setup](#setup)
  - [World Map Painting](#world-map-painting)
  - [Location Painting](#location-painting)
  - [How the Prompts Work](#how-the-prompts-work)
- [CLI Simulation](#cli-simulation)
- [Architecture](#architecture)
- [How the Simulation Works](#how-the-simulation-works)
- [The Starting World](#the-starting-world)
- [Configuration](#configuration)

---

## Quick Start

```bash
npm install

# Launch the web UI (default: http://localhost:5173)
npm run dev

# Run a CLI simulation (4 turns = 1 year)
npm run simulate

# Run N turns with a specific seed
npx tsx src/cli/simulate.ts 8 42
```

---

## The Web UI

The interface has three zones: the **main area** (center), the **sidebar** (right), and the **turn controls** (bottom).

```
┌──────────────────────────────────────────────────────────┐
│  The Aurelian Decline              Spring, Year 1 — Turn 1│
├────────────────────────────────────┬─────────────────────┤
│  [ World Map ]  [ Dashboard ]      │ [Factions][Chronicle]│
│  [ Diplomacy ]                     │ [Location][Characters│
│                                    │                      │
│     ~~~  World Map / Dashboard ~~~ │   Sidebar Content    │
│                                    │                      │
│      (click locations to select)   │   (faction stats,    │
│                                    │    event log, or     │
│                                    │    character cards)  │
│                                    │                      │
├────────────────────────────────────┴─────────────────────┤
│  [ Advance Turn ]  [ Advance Year ]  [ Reset World ]     │
│  "Narrative recap of this turn's events..."               │
└──────────────────────────────────────────────────────────┘
```

### World Map

The main view. Shows a procedural terrain map with:

- **Terrain** — Mountains, forests, plains, swamps, moors, snow, coast, and rivers, all procedurally generated with decorative elements (trees, peaks, waves).
- **Faction territories** — Each location is color-coded by its controlling faction.
- **Location markers** — Icons vary by type: `★` capital, `⬣` fortress, `◆` castle, `●` town, `○` village, `△` ruins, `▽` lair, `✝` temple.
- **Road connections** — Dashed lines between connected locations.
- **Hover tooltips** — Hover any location to see its name, description, population, defense, and prosperity.
- **Click to select** — Clicking a location opens its detail in the sidebar.

The map also has a **"Generate Artistic Map"** button (see [Artistic Map Generation](#artistic-map-generation-nano-banana-2)).

### Dashboard

Switch to the Dashboard tab to see world-wide analytics:

- **Total population**, average prosperity, total faction gold, event count
- **Faction breakdown** — Power, morale, gold, and corruption for each faction
- **Latest turn events** — What just happened this season

### Faction Panel

The sidebar's **Factions** tab lists all factions with:

- Leader name and faction type
- Stat bars: Power, Morale, Gold, Corruption
- Click a faction to highlight its territories on the map and filter the Characters panel

### Characters

The sidebar's **Characters** tab displays character cards for all named NPCs (see [Named Characters & NPCs](#named-characters--npcs) for full details). Each card shows:

- Name, title, role, and faction
- Stat pips for Prowess / Cunning / Authority
- Renown, battle record, wounds
- Traits and abilities (earned abilities highlighted in gold)
- Trophies claimed from fallen enemies
- Active vendettas (with target status)
- Relationships and bonds (mentor, rival, blood oath, nemesis)
- For dead characters: cause of death, last stand narrative if applicable

Filter by clicking a faction in the Factions panel.

### Diplomacy

The **Diplomacy** main tab shows a 7x7 color-coded relationship matrix between all factions:

- Green = allied, Red = hostile, Grey = neutral
- Active treaties listed with terms and duration
- Click a cell to select a faction

### Chronicle

The **Chronicle** tab shows a reverse-chronological event log — every battle, trade deal, diplomatic shift, plague, vendetta, succession, war council, and omen that has occurred in the world.

### Location Detail

When you click a location on the map, the **Location** tab shows population, defense, prosperity, resources, rumors, connections, recent events, and painting options.

### Turn Controls

At the bottom of the screen:

| Button | Effect |
|--------|--------|
| **Advance Turn** | Resolves one season (Spring → Summer → Autumn → Winter) |
| **Advance Year** | Resolves 4 turns at once (one full year) |
| **Reset World** | Resets to the starting state (Year 1, Turn 1) |

Below the buttons, a **procedural narrative recap** summarizes the turn's events in atmospheric prose.

---

## Named Characters & NPCs

Inspired by Civilization leaders and Warhammer generals — named characters are attached to factions and influence battle outcomes, accumulate experience over time, and can die in combat. The longer they survive, the more legendary they become.

### Character Stats

Each character has three core stats on a 1-10 scale:

| Stat | Effect |
|------|--------|
| **Prowess** | Martial skill — determines combat bonus and last stand chance |
| **Cunning** | Subterfuge — influences survival rolls, assassination resistance |
| **Authority** | Leadership — affects morale, diplomacy, war council outcomes |

Additional tracked values: renown (0-100), loyalty, battles won/lost, times wounded, kill count.

### Combat Integration

Characters present at a battle location modify d20 combat rolls:

- **Base bonus**: prowess / 3 (1-3 points)
- **Ability bonuses**: passive combat abilities stack
- **Renown bonus**: +1 at renown 60+, +2 at renown 80+
- **Trophy bonus**: +1 per trophy held
- **Vendetta bonus**: +2 when fighting a character they have a vendetta against
- **Relationship modifiers**: +3 vs a nemesis, -2 vs a blood oath brother (reluctance)

Characters are named in battle and raid event text, building emergent narratives.

### Mortality & Death Vectors

Characters face death from multiple sources every turn:

| Vector | Rate | Notes |
|--------|------|-------|
| **Battle death** | 5-28% per engagement | Doubled base rates. Role/renown/wound multipliers apply. Warchiefs x1.3 |
| **Raid death** | 4-12% per raid | Lighter than full battle, but still lethal |
| **Assassination** | 0.5-2.5% per turn | Scales with renown. Cunning reduces but caps at 50% mitigation |
| **Illness** | 0.4-2% per turn | Spikes in winter. Wounded characters more vulnerable |

Cunning provides survival mitigation but is capped at 50% reduction. Famous characters are bigger targets. A warchief surviving 3+ years is a genuinely remarkable feat.

### Progression System

Surviving characters randomly accumulate upgrades each turn:

- **Base chance**: 15% + 5% per year active (caps at 40%)
- **Battle traits**: Iron-willed, Scarred Commander, Shield-Breaker, etc.
- **Wound traits**: Walks with a Limp, One-Eyed, etc.
- **Veteran traits**: War-Weary Wisdom, Grizzled, Patient Tactician, etc.
- **Cunning traits**: Paranoid Survivor, Silver-Tongued, etc.
- **Renown traits**: Living Legend, Name Spoken in Fear, etc.
- **Stat gains**: +1 to a random stat (capped at 10)
- **Earnable abilities**: 10 unique abilities gained through experience (Bloodied Resolve, Tactical Adaptation, Dread Reputation, etc.)
- **Title upgrades**: 4 tiers based on battles, renown, wounds, and years active

Earned abilities and traits are visually distinguished in the UI with gold highlighting and `[earned T#]` markers.

### Rivalries & Vendettas

When a character kills another named character in battle:

- All surviving members of the **victim's faction** gain a **vendetta** against the killer
- Vendettas grant **+2 combat bonus** when fighting that specific character
- Vendettas persist until the target dies — then they're shown as struck-through in the UI
- Creates emergent revenge arcs: "Grak kills Ser Roland → Roland's faction spends years hunting Grak"

### Legendary Last Stands

When a character dies in battle, they roll for a **last stand** (warriors only — not advisors or diplomats):

- **Chance**: Based on prowess + renown/10. Minimum score of 10 required. 20% base + 3% per point above 10
- **Normal last stand**: Inflicts extra casualties (prowess x 1.5) before dying
- **Legendary last stand** (score 16+ and lucky rolls): Inflicts prowess x 3 casualties and has a 30% chance to **flip the battle outcome** — turning a defeat into a territory capture (or vice versa)
- Last stand narratives are displayed on the character's death card in gold text

### Trophies & Relics

When a character kills a named enemy:

- They claim a **named trophy** (e.g., "Grak's Skull", "Ser Roland's Blade")
- Each trophy grants **+1 permanent combat bonus**
- If the trophy holder is killed, **all their trophies transfer to the killer** — creating chains of ownership
- Trophies are displayed on character cards with their origin

### Character Succession

When a faction leader (or the last character of a faction) dies:

- A **new character is generated** from faction-specific name pools
- The successor has **weaker stats** (50-75% of the predecessor)
- They start with low renown (5), reduced loyalty (50-80), and the "untested" trait
- The faction suffers an additional **morale penalty** (-5) during the transition
- The faction's leader name is updated automatically
- If the predecessor was assassinated or killed, the successor gains the "vengeance-driven" trait

### War Councils

When 2+ characters from the same faction are at the same location, there's a **25% chance per turn** to trigger a council event:

| Type | Trigger | Effect |
|------|---------|--------|
| **Power Struggle** | Rivals present (35% chance) | Authority contest between characters. Winner gains renown, loser loses it |
| **Martial Council** | Total prowess > cunning (30% chance) | Faction gains power boost (+2 per character) |
| **Intelligence Council** | Total cunning > prowess (30% chance) | Faction gains gold boost (+8 per character) |
| **Mentorship** | Experience gap between characters (35% chance) | Junior character gains +1 to a random stat |

### Character Relationships

Personal bonds form organically between characters based on proximity and shared experience:

| Type | How It Forms | Effect |
|------|-------------|--------|
| **Mentor / Protege** | Experience gap of 3+ (battles + wounds) between faction members | Protege gains stats from war council mentorship. If mentor dies: 60% chance protege rages (+1 prowess, "grief-fueled" trait), 40% chance they collapse (-1 authority, "lost" trait) |
| **Rival** | Same faction, same location, similar experience | Triggers power struggle events at war councils |
| **Blood Oath** | Cross-faction characters at the same location with neutral+ relations (rare) | -2 combat modifier when fighting oath-brother. On death: survivor gains "oath-bound-grief" |
| **Nemesis** | Escalation from an existing vendetta (20% chance per turn) | +3 combat bonus when fighting nemesis |

Relationships are displayed on character cards with type-specific colors and icons. Bonds with fallen characters are shown at reduced opacity.

---

## Artistic Map Generation (Nano Banana 2)

The engine integrates with Google's Gemini image generation API to transform the procedural maps into richly painted fantasy illustrations.

### Setup

1. Get a free Gemini API key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Either:
   - Create a `.env` file in the project root:
     ```
     VITE_GEMINI_API_KEY=AIza...your-key-here
     ```
   - Or enter it when prompted — the UI will show a modal the first time you click any "Generate" / "Paint" button. The key is shared across all generation features for the session.

### World Map Painting

```
┌─────────────────────────────────┐
│  [Procedural View][Artistic View]│
│  [Generate Artistic Map]         │
│                                  │
│  Procedural terrain map          │
│  (50×50 colored grid with        │
│   terrain, rivers, biome labels) │
│           ↓ sent to Gemini ↓     │
│  Artistic watercolor cartography │
│  (parchment, Tolkien-esque,      │
│   hand-drawn mountains & forests)│
└─────────────────────────────────┘
```

**How it works:**

1. The procedural terrain grid is rendered to a 400×400px canvas image (JPEG) with biome labels (MTN, FOREST, SWAMP, etc.) so the AI understands the geography.
2. A narrative prompt is built from the live world state — faction power levels, recent events, conflict zones, seasonal mood, and the state of the Aurelian Empire.
3. Both the image and the prompt are sent to `gemini-3.1-flash-image-preview` as an img2img request.
4. The result is a hand-painted cartographic illustration that preserves the spatial layout while adding artistic detail.

**Toggle between views** — Once generated, switch between Procedural and Artistic views with the toggle button. The artistic map is cached for the session.

### Location Painting

Every location — towns, castles, fortresses, villages, ruins, lairs — can be painted individually.

**Two modes:**

| Mode | Trigger | Input | Style |
|------|---------|-------|-------|
| **Town Map → Painting** | Click "Paint This Location" in the Local Map view | Tile grid PNG + narrative prompt | Bird's-eye RPG concept art (Baldur's Gate / Pillars of Eternity style) |
| **Scene Illustration** | Click "Paint This Location" in the Location detail (without opening the local map) | Text-only narrative prompt | Atmospheric scene painting |

**What the prompt includes:**

The prompt is dynamically built from the current world state, so the same location looks different depending on when you paint it:

- **Location type** — Capital gets marble colonnades; fortress gets thick walls; ruins get crumbling stone and overgrowth
- **Prosperity** — High: well-maintained, bustling. Low: boarded windows, empty stalls, despair
- **Defense** — High: guards on every wall. Low: broken gate, no guards
- **Population** — Crowded streets vs. eerily deserted
- **Season** — Spring wildflowers vs. winter snowdrifts and chimney smoke
- **Controlling faction** — Their banners and colors visible throughout
- **Recent local events** — A battle that just happened, a plague, a trade deal
- **Rumors** — Environmental storytelling woven into the scene

### How the Prompts Work

The system builds two types of prompts:

**World Map prompt** (excerpt):
> Transform this procedural terrain map into a richly detailed, hand-painted fantasy cartographic illustration.
>
> Art style: Parchment-aged medieval cartography with watercolor washes. Tolkien-esque...
>
> This is a land in the midst of upheaval. It is Autumn of Year 3.
> The Aurelian Empire struggles to maintain order as rivals circle.
>
> Active conflict zones: Crosswall (contested between The Aurelian Crown and Iron Fang Clans)...

**Location prompt** (excerpt):
> Transform this procedural tile map of "Thornfield" into a richly detailed fantasy illustration...
>
> This is a busy medieval market town with timber-framed buildings, cobbled streets, and a town square.
>
> Season: amber and russet leaves, grey skies, harvest bales, lantern-light.
> The settlement endures — functional but worn, some disrepair, quiet tension.
> Moderate defenses: a few guards patrol, walls are intact but not impressive.
>
> Controlled by House Thorne. Their banners and colors (moderate, uneasy) are visible throughout.

---

## CLI Simulation

Run the simulation without the UI for quick world-state generation:

```bash
# Default: 4 turns (1 year), random seed
npm run simulate

# Custom: 8 turns with seed 42
npx tsx src/cli/simulate.ts 8 42
```

The CLI outputs each turn's events, faction state changes, and a final world summary to the terminal.

---

## Architecture

```
src/
├── engine/                  # Core simulation engine
│   ├── simulation.ts        # Turn resolution pipeline (7 phases)
│   ├── factions.ts          # Faction decision-making AI
│   ├── combat.ts            # Battle and raid resolution
│   ├── economy.ts           # Income, trade, upkeep
│   ├── events.ts            # Random event generation
│   ├── characters.ts        # Named NPC system — combat, death, progression,
│   │                        #   vendettas, last stands, trophies, succession,
│   │                        #   war councils, relationships
│   ├── narrative.ts         # Procedural narrative recaps with templates
│   ├── treaties.ts          # Treaty proposals, evaluation, execution
│   ├── terrain.ts           # Procedural terrain generation
│   ├── townmap.ts           # Procedural town/settlement maps
│   ├── mapImageGen.ts       # Gemini API integration (Nano Banana 2)
│   ├── world-state.ts       # State initialization and management
│   ├── config.ts            # Simulation tuning knobs
│   ├── rng.ts               # Seeded random number generator (Mulberry32)
│   └── types.ts             # TypeScript type definitions
│
├── data/                    # Starting world data
│   ├── factions.json        # 7 factions with leaders, goals, relationships
│   ├── locations.json       # 20 locations with stats, resources, rumors
│   ├── characters.json      # 11 seed characters across all factions
│   ├── events-pool.json     # Event templates for procedural generation
│   └── story-hooks.json     # Narrative beats on a schedule
│
├── ui/                      # React + Vite web interface
│   ├── App.tsx              # Main app shell, state management, API key
│   ├── components/
│   │   ├── WorldMap.tsx         # Interactive world map with terrain + territory overlay
│   │   ├── TownMapView.tsx      # Tile-based settlement maps
│   │   ├── LocationDetail.tsx   # Location info, stats, scene painting
│   │   ├── FactionPanel.tsx     # Faction list with stat bars
│   │   ├── CharacterPanel.tsx   # Character cards with stats, traits, abilities,
│   │   │                        #   trophies, vendettas, relationships
│   │   ├── RelationshipMatrix.tsx # 7x7 faction diplomacy grid
│   │   ├── Chronicle.tsx        # Event log
│   │   ├── Dashboard.tsx        # World analytics
│   │   └── TurnControls.tsx     # Turn buttons + narrative display
│   └── styles/
│       └── global.css       # All styles
│
└── cli/
    └── simulate.ts          # CLI simulation runner
```

---

## How the Simulation Works

Each turn represents one **season** (4 turns = 1 year). The pipeline resolves in order:

| Phase | What Happens |
|-------|-------------|
| **1. Empire Decay** | The Aurelian Crown loses power and accumulates corruption each turn. The rate accelerates as corruption grows. |
| **2. Economy** | Factions earn income from controlled locations (based on prosperity and resources), pay upkeep for military forces, and conduct trade along connected routes. |
| **3. Faction AI** | Each faction evaluates its goals, resources, threats, and opportunities, then chooses an action: expand, fortify, raid, form alliance, betray, or build. |
| **4. Conflict** | Raids and battles are resolved. Named characters present at the location modify combat rolls. Deaths trigger vendettas, trophies, last stands, and succession. |
| **4b. Treaties** | Factions with high dealmaking personality propose treaties (tribute, trade, mutual defense, etc.). |
| **5. Consequences** | Territory changes hands. Refugees flee. Relationships shift. Prosperity and population adjust. |
| **5b. Characters** | Wound recovery. Non-combat perils (assassination, illness). War council events. Relationship formation. Character progression (traits, abilities, stats, titles). |
| **6. Random Events** | Drawn from the event pool — plagues, weather, discoveries, omens, merchant caravans, bandit attacks. |
| **7. Story Hooks** | Scheduled narrative beats fire at specific turns — a dragon sighting, a rebellion, a prophecy fulfilled. |

All randomness uses a **seeded RNG** (Mulberry32), so the same seed always produces the same world history.

---

## The Starting World

**7 Factions:**

| Faction | Type | Starting Position |
|---------|------|-------------------|
| The Aurelian Crown | Empire (declining) | Central — Aurelius capital |
| House Valdris | Noble house | Political schemers |
| House Thorne | Noble house | Eastern lands |
| Iron Fang Clans | Warband | Western mountains |
| The Red Wolves | Mercenary company | Roaming |
| Greentusk Horde | Tribal confederation | Northern wilds |
| Silver Road Guild | Merchant guild | Trade routes |

**11 Named Characters:**

| Character | Faction | Role | Notable |
|-----------|---------|------|---------|
| Emperor Marius IV | Aurelian Crown | Advisor | Weak ruler, paranoid, AUT 6 |
| Cassius Varn | Aurelian Crown | Commander | The real military power, PRW 8 |
| Lord Aldric Valdris | House Valdris | Spymaster | CUN 9, master schemer |
| Ser Roland the Unyielding | House Valdris | Champion | PRW 9, never lost a duel |
| Lady Elara Thorne | House Thorne | Commander | AUT 8, beloved by troops |
| Brother Caelen | House Thorne | Champion | Former monk, PRW 7 |
| Scar | Iron Fang | Warchief | Born a farmer, forged by famine |
| Maren "Red" Ashwick | Red Wolves | Spymaster | CUN 8, every fight is calculated |
| Warchief Grak | Greentusk Horde | Warchief | AUT 9, first to unite the tribes |
| Skrit the Tunneler | Greentusk Horde | Commander | Sappers and tunnel-rats |
| Guildmaster Sera Blackwood | Silver Road Guild | Diplomat | Money is the only loyalty |

**20 Locations** spanning capitals, fortresses, castles, towns, villages, ruins, lairs, and temples — each with unique resources, rumors, and connections.

---

## Configuration

| Variable | Where | Purpose |
|----------|-------|---------|
| `VITE_GEMINI_API_KEY` | `.env` file or UI modal | Gemini API key for artistic map generation |

No other configuration is required. The simulation is fully self-contained. Tuning knobs for combat, economy, raids, diplomacy, and decay rates are in `src/engine/config.ts`.
