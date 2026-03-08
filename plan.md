# WorldEngine Generalization Plan — World Builder + Game Master Tools

## Overview
Transform WorldEngine from a fixed Aurelian Decline story engine into a configurable world-building platform with:
- An **initialization flow** for creating custom worlds (or loading presets)
- A **Game Master (GM) panel** accessible at any time during gameplay for live editing
- A **rich behavioral tag system** driving faction AI
- **Custom map upload** with auto-gridding
- **Full config exposure** for simulation tuning

The GM panel and initialization share the same editing components — setup is just GM mode before turn 1.

---

## Phase 1: Rich Behavioral Tag System

### 1.1 Tag taxonomy & compound behaviors
**Files:** `src/engine/tags.ts` (new)

Design a rich tag system where tags are the primary driver of faction AI behavior. Tags come in categories:

**Disposition tags** (core personality):
- `aggressive`, `defensive`, `cautious`, `reckless`, `patient`, `opportunistic`

**Economic tags** (how they handle resources):
- `trading`, `hoarding`, `generous`, `exploitative`, `self-sufficient`, `parasitic`, `industrious`

**Political tags** (how they relate to others):
- `diplomatic`, `isolationist`, `expansionist`, `imperialist`, `vassal`, `revolutionary`, `scheming`, `honorable`, `treacherous`

**Social tags** (internal dynamics):
- `corrupt`, `disciplined`, `fanatical`, `fractured`, `unified`, `decadent`, `desperate`, `zealous`

**Military tags** (combat style):
- `raiding`, `fortifying`, `guerrilla`, `siege-capable`, `mercenary`, `conscripting`, `elite`

**Compound behavior tags** (unique combinations):
- `greedy` = desperate + exploitative → prioritizes gold acquisition at any cost
- `tyrannical` = imperialist + corrupt + aggressive → expands through force, breeds internal rot
- `noble` = honorable + disciplined + defensive → defends territory, keeps word, slow to attack
- `mercantile` = trading + opportunistic + hoarding → follows coin, plays all sides
- `insurgent` = revolutionary + guerrilla + desperate → raids supply lines, avoids pitched battle
- `hegemon` = imperialist + diplomatic + patient → expands through treaties and pressure
- `zealot` = fanatical + aggressive + unified → attacks based on ideology, immune to bribes
- `pirate` = raiding + parasitic + reckless → hit-and-run, steals from trade routes
- `feudal` = honorable + expansionist + disciplined → grows through loyalty and duty
- `shadow-broker` = scheming + trading + treacherous → manipulates others, sells information
- `warlord` = aggressive + conscripting + reckless → pure military expansion
- `merchant-prince` = trading + diplomatic + hoarding → buys influence, avoids direct conflict
- `cultist` = fanatical + scheming + zealous → infiltrates, converts, subverts from within
- `nomadic` = self-sufficient + guerrilla + patient → moves, avoids permanent holdings
- `decaying-empire` = imperialist + corrupt + decadent → holds vast territory but rotting from within

Each tag maps to behavioral weights:
```ts
interface TagBehavior {
  tag: string;
  category: TagCategory;
  description: string;
  // AI priority modifiers (additive, stacking with other tags)
  priorities: {
    raid?: number;      // -1 to +1
    fortify?: number;
    trade?: number;
    expand?: number;
    diplomacy?: number;
    reform?: number;
    recruit?: number;
    scheme?: number;
    invest?: number;
    bribe?: number;
  };
  // Stat modifiers
  modifiers?: {
    incomeRate?: number;
    upkeepRate?: number;
    raidLoot?: number;
    corruptionRate?: number;
    moraleDecay?: number;
    combatPower?: number;
    defenseBonus?: number;
  };
  // Conditions where this tag triggers special behavior
  triggers?: TagTrigger[];
}
```

Compound tags inherit and amplify their component tag behaviors, plus add unique emergent behavior.

### 1.2 Make FactionType & LocationType dynamic
**Files:** `src/engine/types.ts`
- Change `FactionType` from a union literal to `string` (freeform label, display only)
- Change `LocationType` from a union literal to `string` (freeform)
- Add `tags: string[]` to `Faction` interface (behavioral driver)
- Keep personality scores (dealmaking, aggression, greed) as-is — tags supplement, not replace
- Personality scores are auto-derived from tags but can be manually overridden

### 1.3 Generalize faction AI to use tags
**Files:** `src/engine/factions.ts`
- Replace all `switch(faction.type)` blocks with tag-based behavior resolution
- Decision priority = sum of tag weights + personality modifiers + situational context
- Example: a faction with `['aggressive', 'raiding', 'desperate']` tags would have high raid priority, amplified when gold is low
- Preserve current Aurelian behavior by mapping old types to tag sets:
  - empire → `['imperialist', 'corrupt', 'decadent', 'bureaucratic']` (= `decaying-empire`)
  - noble/valdris → `['scheming', 'expansionist', 'patient']` (= `hegemon`)
  - noble/thorne → `['honorable', 'defensive', 'disciplined']` (= `noble`)
  - bandit → `['raiding', 'desperate', 'guerrilla']` (= `insurgent`)
  - goblin → `['aggressive', 'raiding', 'reckless', 'unified']` (= `warlord`)
  - merchant → `['trading', 'opportunistic', 'hoarding']` (= `mercantile`)

### 1.4 Generalize config action multipliers
**Files:** `src/engine/config.ts`
- Change `actionMultipliers` from keyed-by-FactionType to keyed-by-tag
- Multiple tags stack (additively, with diminishing returns)
- `factionAI` thresholds also become tag-based

---

## Phase 2: World Definition Data Model

### 2.1 Create WorldDefinition interface
**Files:** `src/engine/types.ts`, `src/engine/world-definition.ts` (new)
```ts
interface WorldDefinition {
  meta: {
    name: string;
    description: string;
    theme: string;
    startingSeason: string;
    seasonNames: string[];
  };
  factions: FactionDefinition[];
  locations: LocationDefinition[];
  characters: CharacterDefinition[];
  events: EventTemplate[];
  storyHooks: StoryHook[];
  availableTags: string[];     // tags available in this world
  customTags?: TagBehavior[];  // user-defined tags beyond builtins
  mapImage?: string;
  mapGrid?: MapGridConfig;
  config: Partial<EngineConfig>;
}
```

### 2.2 Create preset system
**Files:** `src/data/presets/aurelian.ts` (new)
- Package current JSON data into a single `WorldDefinition` preset
- Export as `AURELIAN_PRESET`
- Map old faction types to tag sets

### 2.3 Update world-state.ts initialization
**Files:** `src/engine/world-state.ts`
- `createInitialWorldState(definition: WorldDefinition, seed?: number): WorldState`
- Store `WorldDefinition` reference in WorldState for live editing access

---

## Phase 3: Game Master Panel (Always-Accessible Editor)

This is the key architectural shift: the initialization UI and mid-game editing use the **same GM Panel** component. Before turn 1 it's the "World Builder"; during gameplay it's the "GM Tools".

### 3.1 App flow restructure
**Files:** `src/ui/App.tsx`
- Add `phase` state: `'setup' | 'playing'`
- Add `gmPanelOpen` boolean state
- When `phase === 'setup'`, show WorldBuilder (full screen GM panel)
- When `phase === 'playing'`, show game UI with a GM toggle button (e.g., scroll/quill icon in header)
- GM panel slides in as an overlay/drawer when toggled during gameplay
- Loading a save goes directly to 'playing'

### 3.2 GMPanel component (shared between setup and gameplay)
**Files:** `src/ui/components/GMPanel.tsx` (new)
- Tabbed panel with sub-tabs:
  1. **Overview** — World name/theme (setup only: preset selection)
  2. **Factions** — Create/edit/remove factions (always available)
  3. **Map** — Upload map, configure grid (setup); view/reassign territory (gameplay)
  4. **Locations** — Place/edit locations (always available)
  5. **Characters** — Create/edit/kill/resurrect characters (always available)
  6. **Events** — Inject custom events, edit event pool (gameplay only)
  7. **Config** — All simulation parameters (always available)
- `mode` prop: `'setup' | 'live'` controls which features are shown
- In live mode, changes apply immediately to current WorldState
- In live mode, changes are logged to chronicle as "GM intervention"

### 3.3 Overview / Start Tab
**Files:** `src/ui/components/gm/OverviewTab.tsx` (new)
- Preset selection cards (setup mode only)
- World name, description, theme inputs
- Season configuration
- "Quick Start with Preset" button
- In live mode: shows world summary stats, allows name/theme editing

### 3.4 Factions Tab (setup + live)
**Files:** `src/ui/components/gm/FactionsTab.tsx` (new)
- Add/remove faction cards
- Per faction:
  - Name, description, leader name, color picker
  - Freeform type label (text input, cosmetic only)
  - **Tag picker**: searchable list of all available tags, organized by category
    - Click to add/remove tags
    - Shows compound tag suggestions when compatible base tags are selected
    - Freeform tag input for custom tags
    - Each tag shows tooltip with behavioral effects
  - Personality sliders: dealmaking, aggression, greed (auto-derived from tags, manually overridable)
  - Starting/current stats: power, morale, gold, corruption
  - Relationship editor: sliders for relations with each other faction
- **Live mode extras**:
  - Changes take effect next turn (or immediately with "Force Apply" toggle)
  - "Add New Faction" mid-game (spawns with territory assignment)
  - "Eliminate Faction" (removes from game, redistributes territory)
  - Edit log shown in chronicle

### 3.5 Characters Tab (setup + live)
**Files:** `src/ui/components/gm/CharactersTab.tsx` (new)
- Add/remove character cards
- Per character:
  - Name, faction (dropdown), role (freeform), title
  - Stats: prowess, cunning, authority (sliders)
  - Traits/abilities (tag-like input)
  - Status: active, wounded, captured, dead (live toggle)
  - Relationships to other characters
  - Backstory/description text
- **Live mode extras**:
  - "Create New Leader" — spawn a character into any faction mid-game
  - "Kill Character" — trigger death with custom narrative
  - "Wound/Capture/Free" — change status with event generation
  - "Transfer" — move character between factions (defection story)
  - "Promote" — change role/title
  - All changes generate chronicle entries

### 3.6 Map Tab
**Files:** `src/ui/components/gm/MapTab.tsx` (new)
- **Setup mode**: Full map builder
  - File upload dropzone for map image (PNG/JPG)
  - Grid overlay controls: size (rows × cols), opacity, visibility toggle
  - If no image: use procedural generation
  - Click cells to paint: terrain type, faction ownership
  - Brush tool for multi-cell painting
- **Live mode**: Territory editor
  - Reassign cell ownership (simulate conquests/retreats)
  - Add/remove locations on grid
  - Visual diff highlighting what changed

### 3.7 Locations Tab
**Files:** `src/ui/components/gm/LocationsTab.tsx` (new)
- Map display with grid overlay
- Click to place/select locations
- Per location:
  - Name, type (freeform), description
  - Controlling faction (dropdown)
  - Stats: population, defense, prosperity (sliders)
  - Connected locations (multi-select)
  - Resources (tag input)
  - Trade routes
- **Live mode extras**:
  - "Raze Location" — destroy with narrative
  - "Found New Settlement" — create location mid-game
  - "Transfer Control" — change ownership with event
  - Modify stats directly (simulate disasters, prosperity booms)

### 3.8 Events Tab (live mode only)
**Files:** `src/ui/components/gm/EventsTab.tsx` (new)
- **Inject Event**: Create a custom one-time event
  - Title, description, narrative text
  - Target: specific faction, location, or global
  - Effects: stat modifiers (prosperity, morale, gold, population, etc.)
  - Timing: next turn or immediate
- **Edit Event Pool**: Modify random event templates
  - Add/remove/edit templates
  - Adjust weights
- **Story Hooks**: Add scripted beats
  - Trigger conditions (turn number, tag-based, stat-threshold-based)
  - Narrative text and effects

### 3.9 Config Tab
**Files:** `src/ui/components/gm/ConfigTab.tsx` (new)
- Organized collapsible sections matching `config.ts` structure:
  - Economy, Combat, Raids, Decay, Diplomacy, Recruitment, Events
- Each parameter: label, description tooltip, slider/number input, reset button
- "Reset All to Defaults" button
- Per-tag action multiplier editor
- Changes apply immediately (next turn resolution uses new values)
- Preset config profiles: "Peaceful", "Warlike", "Economic Focus", "Slow Burn"

---

## Phase 4: Map Upload & Grid System

### 4.1 Map grid data model
**Files:** `src/engine/types.ts`
```ts
interface MapGridConfig {
  rows: number;
  cols: number;
  cells: MapCell[][];
}
interface MapCell {
  terrain: string;
  color: string;
  owner?: string;
  locationId?: string;
}
```

### 4.2 Map rendering with custom image
**Files:** `src/ui/components/WorldMap.tsx` (modify)
- When worldState has a `mapImage`, render as background
- Overlay grid with faction colors at reduced opacity
- Location markers at grid positions
- Keep existing procedural map as fallback

### 4.3 Grid interaction
**Files:** `src/ui/components/gm/MapTab.tsx`
- Canvas renders uploaded image
- SVG overlay draws grid lines
- Click handler maps pixel coordinates → grid cell
- Hover highlights current cell with tooltip
- Brush modes: single cell, row, column, flood fill

---

## Phase 5: Engine Adaptations

### 5.1 Live state mutation API
**Files:** `src/engine/gm-actions.ts` (new)
Create a clean API for GM interventions that properly update state and generate events:
```ts
function gmAddFaction(state: WorldState, faction: FactionDefinition): WorldState
function gmRemoveFaction(state: WorldState, factionId: string): WorldState
function gmEditFaction(state: WorldState, factionId: string, changes: Partial<Faction>): WorldState
function gmAddCharacter(state: WorldState, character: CharacterDefinition): WorldState
function gmKillCharacter(state: WorldState, charId: string, narrative?: string): WorldState
function gmAddLocation(state: WorldState, location: LocationDefinition): WorldState
function gmRazeLocation(state: WorldState, locationId: string): WorldState
function gmInjectEvent(state: WorldState, event: GameEvent): WorldState
function gmTransferTerritory(state: WorldState, locationId: string, newOwner: string): WorldState
function gmUpdateConfig(state: WorldState, config: Partial<EngineConfig>): WorldState
```
Each function returns new WorldState and appends a GM event to the chronicle.

### 5.2 Narrative generation generalization
**Files:** `src/engine/narrative.ts`
- Remove Aurelian-specific hardcoded flavor text
- Narrative templates reference faction/location names dynamically
- Add `theme` parameter for vocabulary adjustment

### 5.3 Event pool generalization
**Files:** `src/engine/events.ts`
- Events reference tags for conditions (not faction types)
- WorldDefinition supplies custom event templates
- Generic fallback templates work with any setting

### 5.4 Story hooks generalization
- Hooks become optional
- Conditions become tag-based or stat-threshold-based
- No hooks = pure emergent simulation

---

## Phase 6: Persistence & Export

### 6.1 Save WorldDefinition alongside WorldState
**Files:** `src/ui/components/SaveManager.tsx`, `src/engine/world-state.ts`
- Save includes WorldDefinition + WorldState + current config
- Loading restores everything including custom map
- Map image as base64 (with compression/size warning)

### 6.2 Export/Import WorldDefinition
- Export world setup as standalone JSON (shareable preset)
- Import to start new game with someone else's world
- "Save as Preset" to add to local preset library

---

## Implementation Order

### Batch 1 — Foundation (engine-side)
1. Phase 1.1: Tag system + taxonomy (`tags.ts`)
2. Phase 2.1: WorldDefinition type
3. Phase 2.2: Aurelian preset extraction
4. Phase 2.3: World-state init from WorldDefinition
5. Phase 1.2-1.3: Tag-based AI + config

### Batch 2 — GM Panel shell + core tabs
6. Phase 3.1: App flow (setup/playing phases)
7. Phase 3.2: GMPanel component shell
8. Phase 3.3: Overview/Start tab
9. Phase 3.4: Factions tab
10. Phase 3.5: Characters tab

### Batch 3 — Map system
11. Phase 4.1: Map grid data model
12. Phase 3.6: Map tab (upload + grid)
13. Phase 3.7: Locations tab
14. Phase 4.2-4.3: Map rendering + interaction

### Batch 4 — Live editing + polish
15. Phase 5.1: GM actions API
16. Phase 3.8: Events tab
17. Phase 3.9: Config tab
18. Phase 5.2-5.4: Engine generalization
19. Phase 6: Persistence

---

## File Summary

### New Files
- `src/engine/tags.ts` — Tag taxonomy, TagBehavior definitions, compound tags
- `src/engine/world-definition.ts` — WorldDefinition type & helpers
- `src/engine/gm-actions.ts` — Live state mutation API
- `src/data/presets/aurelian.ts` — Aurelian preset
- `src/ui/components/GMPanel.tsx` — Main GM panel component
- `src/ui/components/gm/OverviewTab.tsx`
- `src/ui/components/gm/FactionsTab.tsx`
- `src/ui/components/gm/CharactersTab.tsx`
- `src/ui/components/gm/MapTab.tsx`
- `src/ui/components/gm/LocationsTab.tsx`
- `src/ui/components/gm/EventsTab.tsx`
- `src/ui/components/gm/ConfigTab.tsx`

### Modified Files
- `src/engine/types.ts` — Dynamic FactionType/LocationType, tags, MapGrid types
- `src/engine/factions.ts` — Tag-based AI decisions
- `src/engine/config.ts` — Tag-based multipliers
- `src/engine/world-state.ts` — Accept WorldDefinition, store reference
- `src/engine/narrative.ts` — Theme-aware, setting-agnostic text
- `src/engine/events.ts` — Tag-based conditions
- `src/ui/App.tsx` — Setup/playing phases, GM panel toggle
- `src/ui/components/WorldMap.tsx` — Custom map image + grid overlay
- `src/ui/components/SaveManager.tsx` — WorldDefinition in saves
- `src/ui/styles/global.css` — GM panel styles
