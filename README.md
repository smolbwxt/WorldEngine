# The Aurelian Decline — Living World D&D Campaign Engine

A living-world simulation engine for a D&D campaign set in a declining empire. Run it "between sessions" to produce an evolving world with emergent narrative hooks, factional power struggles, and AI-painted maps.

---

## Table of Contents

- [Quick Start](#quick-start)
- [The Web UI](#the-web-ui)
  - [World Map](#world-map)
  - [Dashboard](#dashboard)
  - [Faction Panel](#faction-panel)
  - [Chronicle](#chronicle)
  - [Location Detail](#location-detail)
  - [Turn Controls](#turn-controls)
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
│                                    │ [Location]           │
│                                    │                      │
│     ~~~  World Map / Dashboard ~~~ │   Sidebar Content    │
│                                    │                      │
│      (click locations to select)   │   (faction stats,    │
│                                    │    event log, or     │
│                                    │    location detail)  │
│                                    │                      │
├────────────────────────────────────┴─────────────────────┤
│  [ Advance Turn ]  [ Advance Year ]  [ Reset World ]     │
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
- Click a faction to highlight its territories on the map

### Chronicle

The **Chronicle** tab shows a reverse-chronological event log — every battle, trade deal, diplomatic shift, plague, and omen that has occurred in the world.

### Location Detail

When you click a location on the map, the **Location** tab shows:

```
┌─────────────────────────┐
│  Aurelius                │
│  Capital — The Aurelian  │
│  Crown                   │
│  [View Local Map]        │
├─────────────────────────┤
│  Scene — Aurelius        │
│  [Paint This Location]   │
├─────────────────────────┤
│  Statistics              │
│  Population: 12,000      │
│  Defense: ████████░░ 80  │
│  Prosperity: ██████░░ 60 │
│  Resources: Stone, Grain │
├─────────────────────────┤
│  Rumors                  │
│  "The emperor's cough    │
│   worsens by the day..." │
├─────────────────────────┤
│  Connections             │
│  Crosswall, Thornfield   │
├─────────────────────────┤
│  Recent Events           │
│  ⚔ Border skirmish...    │
│  📦 Trade caravan...      │
└─────────────────────────┘
```

**View Local Map** opens a procedural tile-based town map with:

- Color-coded tile grid (roads, buildings, markets, temples, walls, gates, water, parks, ruins, keeps, etc.)
- **Points of Interest** — Named locations within the settlement (e.g. "The Rusty Anchor Inn", "North Gate"), highlighted in gold
- **Districts** — Labeled zones (e.g. "Market Quarter", "Temple District")
- Hover any POI for its description
- **"Paint This Location"** button to generate an artistic version

**Paint This Location** (without the town map open) generates a standalone scene illustration of the location — useful for ruins, lairs, dungeons, and other locations that benefit from an atmospheric painting.

### Turn Controls

At the bottom of the screen:

| Button | Effect |
|--------|--------|
| **Advance Turn** | Resolves one season (Spring → Summer → Autumn → Winter) |
| **Advance Year** | Resolves 4 turns at once (one full year) |
| **Reset World** | Resets to the starting state (Year 1, Turn 1) |

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
│   ├── simulation.ts        # Turn resolution pipeline
│   ├── faction-ai.ts        # Faction decision-making AI
│   ├── combat.ts            # Battle resolution
│   ├── economy.ts           # Income, trade, upkeep
│   ├── events.ts            # Random event generation
│   ├── corruption.ts        # Empire decay mechanics
│   ├── terrain.ts           # Procedural terrain generation
│   ├── townmap.ts           # Procedural town/settlement maps
│   ├── mapImageGen.ts       # Gemini API integration (Nano Banana 2)
│   ├── world-state.ts       # State initialization and management
│   ├── rng.ts               # Seeded random number generator
│   └── types.ts             # TypeScript type definitions
│
├── data/                    # Starting world data
│   ├── factions.json        # 7 factions with leaders, goals, relationships
│   ├── locations.json       # 20 locations with stats, resources, rumors
│   ├── events-pool.json     # Event templates for procedural generation
│   └── story-hooks.json     # Narrative beats on a schedule
│
├── ui/                      # React + Vite web interface
│   ├── App.tsx              # Main app shell, state management, API key
│   ├── components/
│   │   ├── WorldMap.tsx     # Interactive world map with terrain
│   │   ├── TownMapView.tsx  # Tile-based settlement maps
│   │   ├── LocationDetail.tsx # Location info, stats, scene painting
│   │   ├── FactionPanel.tsx # Faction list with stat bars
│   │   ├── Chronicle.tsx    # Event log
│   │   ├── Dashboard.tsx    # World analytics
│   │   └── TurnControls.tsx # Turn advancement buttons
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
| **4. Conflict** | Raids and battles are resolved. Outcomes depend on military power, defense values, terrain, and morale. |
| **5. Consequences** | Territory changes hands. Refugees flee. Relationships shift. Prosperity and population adjust. |
| **6. Random Events** | Drawn from the event pool — plagues, weather, discoveries, omens, merchant caravans, bandit attacks. |
| **7. Story Hooks** | Scheduled narrative beats fire at specific turns — a dragon sighting, a rebellion, a prophecy fulfilled. |

All randomness uses a **seeded RNG**, so the same seed always produces the same world history.

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

**20 Locations** spanning capitals, fortresses, castles, towns, villages, ruins, lairs, and temples — each with unique resources, rumors, and connections.

---

## Configuration

| Variable | Where | Purpose |
|----------|-------|---------|
| `VITE_GEMINI_API_KEY` | `.env` file or UI modal | Gemini API key for artistic map generation |

No other configuration is required. The simulation is fully self-contained.
