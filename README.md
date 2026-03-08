# WorldEngine — Living World Simulation Platform

A generalized living-world simulation engine for tabletop RPG campaigns. Build any world — a declining empire, a frontier frontier, a city of guilds — then run it "between sessions" to produce evolving history with emergent narrative hooks, factional power struggles, named characters who live and die, player intervention points, and AI-painted maps.

Ships with the **Aurelian Decline** preset: a crumbling empire beset by noble houses, warbands, and merchant guilds.

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
- [GM Panel — User Manual](#gm-panel--user-manual)
  - [Opening the GM Panel](#opening-the-gm-panel)
  - [Overview Tab — World Setup](#overview-tab--world-setup)
  - [Factions Tab](#factions-tab)
  - [Characters Tab](#characters-tab)
  - [Locations Tab](#locations-tab)
  - [Map Tab](#map-tab)
  - [Events Tab](#events-tab)
  - [Config Tab — Simulation Tuning](#config-tab--simulation-tuning)
- [Player Intervention System](#player-intervention-system)
  - [Enabling Intervention Mode](#enabling-intervention-mode)
  - [The Intervention Panel](#the-intervention-panel)
  - [Reviewing Faction Actions](#reviewing-faction-actions)
  - [Player Actions](#player-actions)
  - [Resolving the Turn](#resolving-the-turn)
- [Faction Lifecycle — Death & Birth](#faction-lifecycle--death--birth)
  - [Faction Death](#faction-death)
  - [Faction Birth](#faction-birth)
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

## GM Panel — User Manual

The GM Panel is your command center for building worlds and editing them live during play. It operates in two modes:

- **Setup Mode** (before starting the game) — Full-page world builder. Design factions, characters, locations, terrain, and simulation rules from scratch or load a preset.
- **Live Mode** (during play) — Overlay editor accessible via the 🎲 button in the turn controls. Make on-the-fly adjustments without stopping the simulation.

### Opening the GM Panel

- **At launch**: The GM Panel opens automatically as the World Builder. Configure your world, then click **"Begin Simulation"** to start playing.
- **During play**: Click the **🎲 GM Tools** button in the bottom turn controls bar. The panel opens as a translucent overlay. Click the X or press Escape to close it.

### Overview Tab — World Setup

The landing tab for world creation.

| Feature | Description |
|---------|-------------|
| **Preset selector** | Load a pre-built world (e.g., "The Aurelian Decline") with all factions, characters, locations, and story hooks pre-configured. |
| **Custom world** | Start from a blank slate. Give your world a name, description, and theme, then build everything in the other tabs. |
| **World metadata** | Edit the world's name, description, and thematic flavor text at any time. |
| **Begin Simulation** | Finalizes setup and transitions to the playing phase. Only appears in setup mode. |

### Factions Tab

Create, edit, and remove factions. Each faction card expands into a full editor.

**Faction Properties:**

| Field | Description |
|-------|-------------|
| **Name** | Faction display name |
| **Type** | Label shown in the UI (e.g., "Noble House", "Warband", "Merchant Guild") |
| **Leader** | Name of the faction's leader character |
| **Color** | Hex color used on the map and in charts |
| **Power / Max Power** | Military strength. Power regenerates toward max over time. |
| **Morale** | Faction cohesion (0-100). Low morale triggers collapse risk. |
| **Gold** | Treasury. Funds recruitment, mercenaries, bribes, and investments. |
| **Corruption** | Internal rot (0-100). High corruption causes power decay, morale loss, and can trigger rebellion or splintering. |
| **Personality** | Three sliders (0-1) that drive AI decision-making: **Dealmaking** (diplomacy preference), **Aggression** (combat preference), **Greed** (economic preference) |
| **Tags** | Behavioral tags that modify AI decisions and narrative flavor. Organized into categories: disposition, economic, political, social, military, and compound. |
| **Goals / Attitude** | Free-text fields for AI context and narrative flavor |
| **Controlled Locations** | Multi-select for which locations this faction owns |
| **Relationships** | Set sentiment (-100 to +100) toward every other faction |

**Actions:**
- **Add Faction** — Creates a blank faction with default stats (20 power, 50 morale, 100 gold)
- **Remove Faction** — Deletes the faction and cleans up all references (relationships, location ownership, character assignments)

### Characters Tab

Manage all named NPCs in the world with full stat editing.

**Layout:** Filter bar at top (by faction, by status), character list on the left, detail editor on the right.

**Character Properties:**

| Field | Description |
|-------|-------------|
| **Name / Title** | Display name and honorific |
| **Role** | One of: commander, champion, spymaster, warchief, diplomat, advisor |
| **Faction** | Which faction this character belongs to. Use the transfer button to defect. |
| **Prowess** | Martial skill (1-10). Slider control. |
| **Cunning** | Subterfuge and survival (1-10). Slider control. |
| **Authority** | Leadership and command (1-10). Slider control. |
| **Renown** | Fame level (0-100). Affects combat bonuses and death targeting. |
| **Loyalty** | Faction loyalty (0-100). Low loyalty increases defection risk. |
| **Status** | Active, wounded (with recovery timer), captured, or dead |
| **Traits** | Comma-separated trait list (e.g., "cunning, battle-hardened, paranoid") |
| **Description** | Free-text backstory or notes |

**Actions:**
- **Add Character** — Creates a blank character with 5/5/5 stats
- **Kill Character** — Marks as dead with a GM-specified cause, logged to the chronicle
- **Transfer** — Move character to a different faction (logged as defection)

### Locations Tab

Create and edit all locations in the world.

**Location Properties:**

| Field | Description |
|-------|-------------|
| **Name / Type** | Location name and type (capital, fortress, castle, town, village, ruins, lair, temple) |
| **Owner** | Controlling faction (or unclaimed) |
| **Population** | Current population count. Affects income and refugee events. |
| **Defense** | Fortification level. Higher = harder to raid/capture. |
| **Prosperity** | Economic health (0-100). Drives faction income. |
| **X / Y** | Map coordinates for positioning |
| **Connections** | Links to other locations (used for trade routes and movement) |
| **Resources** | Named resources at this location (e.g., "iron mines", "fertile fields") |
| **Description** | Flavor text and notes |

**Actions:**
- **Add Location** — Creates a blank village with 100 pop, 10 defense, 20 prosperity
- **Raze** — Destroys the location: type becomes "ruins", population/defense/prosperity set to 0, removed from faction control. Logged to chronicle.
- **Transfer Ownership** — Reassign to a different faction

### Map Tab

A visual grid-based map editor for painting terrain, faction territories, and location placement.

**Features:**

| Feature | Description |
|---------|-------------|
| **Image Upload** | Upload a background image (JPG/PNG) to use as a map base. Uses FileReader for client-side processing. |
| **Grid Setup** | Configure grid dimensions (rows × columns). Auto-generates a paintable grid overlay. |
| **Paint Modes** | Three brush modes, selected via toggle buttons: |
| — Terrain | Paint terrain types: plains, forest, mountain, water, desert, swamp, snow, hills. Each has a preset color. |
| — Owner | Click a grid cell to assign it to a faction. Cells are colored by faction color. |
| — Location | Click a cell to place a location from your locations list. |

Click any cell to paint with the currently selected brush. The grid renders as a CSS grid with color-coded cells and labels.

### Events Tab

Inject custom events into the chronicle and browse the event history. **Only available during play** (not in setup mode).

**Event Injection:**

| Field | Description |
|-------|-------------|
| **Type** | Event category (battle, alliance, betrayal, trade, disaster, etc.) |
| **Text** | The event description as it will appear in the chronicle |
| **Faction** | (Optional) Associated faction |
| **Location** | (Optional) Associated location |
| **Hook Potential** | Narrative importance (1-10). Higher values are more likely to appear in story hook follow-ups. |

**Event Log Viewer:**
- Filter by: All events, GM-injected events only, or by event type
- Shows the most recent 50 events in reverse chronological order
- GM-injected events are marked with a `[GM]` prefix

### Config Tab — Simulation Tuning

Fine-tune every simulation parameter without touching code. Changes take effect on the next turn.

**Config Sections:**

| Section | What It Controls |
|---------|-----------------|
| **Economy** | Income rates, trade bonuses, army upkeep, territory costs, tax rates, seasonal modifiers, prosperity recovery |
| **Combat** | Power roll scaling, morale modifiers, fortification bonuses, victory margins, casualty percentages |
| **Raid** | Raider vs. defender scaling, loot rates, civilian casualties, relationship damage |
| **Decay** | Corruption tick rates, power erosion from corruption, treasury drain, morale decay thresholds, reform mechanics |
| **Diplomacy** | Alliance thresholds, bribe costs/effects, scheme costs, treaty acceptance rates |
| **Recruitment** | Recruit costs/ranges, mercenary pricing, investment caps, fortification costs, patrol bonuses |
| **Faction AI** | Decision thresholds for all faction types — when to raid vs. recruit vs. fortify vs. diplomacy. Per-type overrides (empire, noble, bandit, goblin, merchant). |
| **Events** | Max events per turn, refugee mechanics (count, prosperity cost) |

**Layout:** Section list on the left, field editor on the right. Each field shows its current value with an inline editor. Nested objects (e.g., seasonal economy modifiers, per-faction-type AI) are handled automatically.

**Reset to Defaults** — Each section has a reset button that restores the original `DEFAULT_CONFIG` values for that section only.

---

## Player Intervention System

The intervention system lets the GM pause turn resolution mid-way, review what every faction is about to do, and inject player character influence before outcomes are determined.

### Enabling Intervention Mode

Click the **🎭 Players** toggle button in the turn controls bar. When active, it glows purple. With intervention mode enabled, clicking "Advance Turn" will pause before resolving actions instead of running the full turn automatically.

### The Intervention Panel

When you advance a turn with intervention mode on, a full-screen overlay appears with two columns:

```
┌─────────────────────────────────────────────────────────┐
│              ⚔ Turn 5 — Autumn, Year 2                  │
│                  Pending Actions                         │
├──────────────────────────┬──────────────────────────────┤
│  Faction Actions         │  Player Actions              │
│                          │                              │
│  ☑ Aurelian Crown        │  Action Type: [Kill Char ▼]  │
│    → recruit (Phase 3)   │  Target: [Ser Roland    ▼]   │
│    [GM note field]       │  [+ Add Action]              │
│                          │                              │
│  ☑ House Valdris         │  ── Queued Actions ──        │
│    → scheme (Phase 3)    │  • Kill "Scar"               │
│    [GM note field]       │  • Boost Iron Fang +20 gold  │
│                          │  • Found "Free Haven" at     │
│  ☐ Iron Fang Clans       │    Thornfield                │
│    → raid Crosswall      │                              │
│    (DISABLED by GM)      │                              │
│                          │                              │
├──────────────────────────┴──────────────────────────────┤
│  Pre-phase events: +12 gold to Crown, -3 corruption... │
│                                                         │
│         [ Cancel ]              [ Resolve Turn → ]      │
└─────────────────────────────────────────────────────────┘
```

### Reviewing Faction Actions

The left column shows every faction's chosen action for this turn. Each action card displays:

- **Faction name** with color indicator
- **Chosen action** (raid, recruit, fortify, scheme, etc.) and its target
- **Description** of what will happen if the action executes
- **Enable/Disable checkbox** — Uncheck to prevent this faction from acting this turn
- **GM Note field** — Add a note explaining why you modified this action (for your own records)

Economy and decay events (Phases 1-2) have already resolved and are shown in the "Pre-phase events" summary at the bottom — these cannot be undone.

### Player Actions

The right column lets you inject player character influence. Seven action types are available:

| Action | Effect |
|--------|--------|
| **Kill Character** | Select any living character. They are marked as dead with cause "killed by player characters". Logged to chronicle. |
| **Wound Character** | Select any living character. They are wounded for 2 turns, reducing their combat effectiveness. |
| **Create Vendetta** | Select a character. They gain a personal grudge against the player party, granting them +2 combat when fighting player interests. |
| **Steal Artifact** | Select a character with trophies. One trophy is removed from them, a vendetta is created, and a chronicle event is generated. |
| **Boost Faction** | Select a faction and a boost type: +20 Power, +50 Gold, or +15 Morale. Represents player alliances, gifts, or support. |
| **Found Settlement** | Select an unclaimed or low-defense location. Name your new faction, choose tags, and establish a player-founded settlement. Creates a full faction with starting stats, a leader character, and territory. |
| **Custom Event** | Write any free-form event text. Choose a type and optionally associate it with a faction/location. Injected directly into the chronicle. |

Actions are queued in a list. You can remove any queued action before resolving.

### Resolving the Turn

- **Resolve Turn →** applies all player actions to the world state, then executes only the enabled faction actions, followed by the remaining turn phases (treaties, consequences, characters, faction lifecycle, random events, story hooks).
- **Cancel** reverts the world to its pre-intervention state, as if you never clicked "Advance Turn".

The turn resolution is deterministic — the RNG seed is preserved in the pending turn snapshot, so the same enabled actions always produce the same outcomes.

---

## Faction Lifecycle — Death & Birth

Factions are not permanent. They can collapse, be absorbed, or new ones can emerge organically through rebellion, defection, civil war, or economic growth. The lifecycle system runs as Phase 6 of every turn, after consequences and character events.

### Faction Death

Two death paths are checked every turn:

**Collapse** — When a faction reaches **power ≤ 0** and controls **no territory**:
- The faction is removed from the world
- High-renown characters (renown > 30) are absorbed by whoever controls their current location
- Low-renown characters die in the collapse
- All relationships and references are cleaned up
- A major chronicle event is generated

**Absorption** — When a faction has **morale ≤ 15**, controls only **1 location**, and has **power ≤ 5**:
- The strongest neighboring faction (by relationship + power) absorbs them
- All territory, characters, and gold transfer to the absorber
- Characters gain reduced loyalty (halved) reflecting reluctant service
- The absorbed faction is removed
- A major chronicle event is generated

### Faction Birth

Four organic birth paths and one player-triggered path:

**Rebellion** — Triggers in locations with high corruption rulers and low prosperity:
- Probability scales with corruption: `(corruption - 60) × 0.005 × (1 - prosperity/100)`
- A rebel faction spawns at the location with a generated leader character
- The rebel faction starts hostile (-60) to the parent faction
- The location transfers to rebel control

**Defection** — High-renown characters with low loyalty may break away:
- Probability: `(renown - 50) × 0.003 × (1 - loyalty/100)`
- The character takes their current location, a share of faction power, and gold
- Nearby disloyal characters may join the new faction
- The original faction loses the territory and resources

**Splintering** — Extremely corrupt factions (corruption > 90) with low morale (≤ 20) and 2+ locations can split in civil war:
- Flat 15% chance when conditions are met
- Territory is divided — characters at each location join whichever side controls that location
- The splinter faction gets a color-shifted version of the parent's color
- Both factions start hostile to each other

**Economic Emergence** — Prosperous unclaimed locations (prosperity > 60) can self-organize:
- Flat 8% chance per qualifying location
- A merchant-led city-state faction forms with a generated leader
- Starts with moderate stats and neutral relationships
- Represents organic economic self-governance

**Player-Founded Settlement** — Via the [Intervention Panel](#the-intervention-panel):
- Player selects an unclaimed or low-defense location
- Names the new faction and assigns behavioral tags
- A full faction is created with starting stats, a leader, and territory
- Represents the player party establishing a base of operations

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
├── engine/                      # Core simulation engine
│   ├── simulation.ts            # Turn resolution pipeline (9 phases)
│   │                            #   resolveTurn() — full auto
│   │                            #   prepareTurn() — pause for intervention
│   │                            #   executePreparedTurn() — resume after intervention
│   ├── faction-lifecycle.ts     # Faction death (collapse, absorption) and
│   │                            #   birth (rebellion, defection, splintering,
│   │                            #   economic emergence)
│   ├── factions.ts              # Faction decision-making AI
│   ├── combat.ts                # Battle and raid resolution
│   ├── economy.ts               # Income, trade, upkeep
│   ├── events.ts                # Random event generation
│   ├── characters.ts            # Named NPC system — combat, death, progression,
│   │                            #   vendettas, last stands, trophies, succession,
│   │                            #   war councils, relationships
│   ├── narrative.ts             # Procedural narrative recaps with templates
│   ├── treaties.ts              # Treaty proposals, evaluation, execution
│   ├── gm-actions.ts            # GM action API — clean state mutations with
│   │                            #   chronicle logging for all GM operations
│   ├── terrain.ts               # Procedural terrain generation
│   ├── townmap.ts               # Procedural town/settlement maps
│   ├── mapImageGen.ts           # Gemini API integration (Nano Banana 2)
│   ├── world-state.ts           # State initialization and management
│   ├── config.ts                # Simulation tuning knobs (all defaults)
│   ├── rng.ts                   # Seeded random number generator (Mulberry32)
│   └── types.ts                 # TypeScript type definitions
│
├── data/                        # Starting world data
│   ├── presets/
│   │   └── aurelian.ts          # Aurelian Decline world preset (WorldDefinition)
│   ├── factions.json            # 7 factions with leaders, goals, relationships
│   ├── locations.json           # 20 locations with stats, resources, rumors
│   ├── characters.json          # 11 seed characters across all factions
│   ├── events-pool.json         # Event templates for procedural generation
│   └── story-hooks.json         # Narrative beats on a schedule
│
├── ui/                          # React + Vite web interface
│   ├── App.tsx                  # Main app — setup/playing phases, intervention
│   │                            #   flow, GM panel toggle, state management
│   ├── components/
│   │   ├── WorldMap.tsx             # Interactive world map with terrain + territory
│   │   ├── TownMapView.tsx          # Tile-based settlement maps
│   │   ├── LocationDetail.tsx       # Location info, stats, scene painting
│   │   ├── FactionPanel.tsx         # Faction list with stat bars
│   │   ├── CharacterPanel.tsx       # Character cards with full detail
│   │   ├── RelationshipMatrix.tsx   # NxN faction diplomacy grid
│   │   ├── Chronicle.tsx            # Event log
│   │   ├── Dashboard.tsx            # World analytics
│   │   ├── TurnControls.tsx         # Turn buttons, intervention toggle, GM toggle
│   │   ├── InterventionPanel.tsx    # Mid-turn pause UI — action review,
│   │   │                            #   player action builder, settlement founding
│   │   └── gm/                      # GM Panel tab components
│   │       ├── GMPanel.tsx          # Tab container (setup vs. live mode)
│   │       ├── OverviewTab.tsx      # World selection, presets, metadata
│   │       ├── FactionsTab.tsx      # Faction CRUD + full property editor
│   │       ├── CharactersTab.tsx    # Character CRUD + stat sliders
│   │       ├── LocationsTab.tsx     # Location CRUD + connection editor
│   │       ├── MapTab.tsx           # Grid map painter (terrain/owner/location)
│   │       ├── EventsTab.tsx        # Event injection + log viewer
│   │       └── ConfigTab.tsx        # Simulation parameter tuning
│   └── styles/
│       └── global.css           # All styles (game UI, GM panel, intervention)
│
└── cli/
    └── simulate.ts              # CLI simulation runner
```

---

## How the Simulation Works

Each turn represents one **season** (4 turns = 1 year). The pipeline resolves in 9 phases:

| Phase | What Happens |
|-------|-------------|
| **1. Empire Decay** | Factions with the "declining" tag lose power and accumulate corruption each turn. The rate accelerates as corruption grows. |
| **2. Economy** | Factions earn income from controlled locations (based on prosperity and resources), pay upkeep for military forces, and conduct trade along connected routes. |
| **3. Faction AI** | Each faction evaluates its goals, resources, threats, and opportunities, then chooses an action: expand, fortify, raid, form alliance, betray, or build. |
| ↳ **Intervention** | *If intervention mode is on, the turn pauses here. The GM reviews pending actions and injects player influence before resolution continues.* |
| **4. Conflict** | Raids and battles are resolved. Named characters present at the location modify combat rolls. Deaths trigger vendettas, trophies, last stands, and succession. |
| **5. Treaties** | Factions with high dealmaking personality propose treaties (tribute, trade, mutual defense, etc.). |
| **6. Consequences** | Territory changes hands. Refugees flee. Relationships shift. Prosperity and population adjust. |
| **7. Characters** | Wound recovery. Non-combat perils (assassination, illness). War council events. Relationship formation. Character progression (traits, abilities, stats, titles). |
| **8. Faction Lifecycle** | Factions are checked for collapse and absorption. New factions may emerge from rebellion, defection, splintering, or economic growth. See [Faction Lifecycle](#faction-lifecycle--death--birth). |
| **9. Random Events & Story Hooks** | Random events drawn from the event pool (plagues, weather, discoveries, omens). Scheduled story beats fire at specific turns. |

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

No other configuration is required. The simulation is fully self-contained.

All simulation parameters (combat, economy, raids, diplomacy, decay, recruitment, faction AI, events) can be tuned in two ways:

1. **In-game** — Use the [Config Tab](#config-tab--simulation-tuning) in the GM Panel to adjust any parameter with immediate effect.
2. **In code** — Edit `DEFAULT_CONFIG` in `src/engine/config.ts` to change the baseline defaults.
