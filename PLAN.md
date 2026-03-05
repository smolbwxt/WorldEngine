# Implementation Plan: Economy Overhaul, Treaties, Map Expansion & Building Interiors

## Phase 1: Economy Rebalance & Faction Personalities

### 1a. Increase gold income
- `baseIncomeRate`: 0.3 → 0.8
- `armyUpkeepRate`: 0.5 → 0.25
- `treasuryDrainDivisor`: 500 → 1000 (soften corruption drain)
- `tradeRouteBonus`: 0.05 → 0.15
- Bump starting gold: Iron Fang 40→80, Red Wolves 20→50, Greentusk 10→40

### 1b. Location tile bonuses
- Add `incomeBonus` field to Location type (mines give gold, markets give trade, temples give morale)
- Capital/fortress/market towns generate more income than villages
- Location type → income multiplier map in config

### 1c. Faction personality traits & action multipliers
Add to Faction type:
```ts
personality: {
  dealmaking: number;   // 0-1, how likely to negotiate vs fight
  aggression: number;   // 0-1, how likely to raid/expand
  greed: number;        // 0-1, how much they value gold
}
```

Action effectiveness multipliers per faction type in config:
- Merchants: trade income ×2.0, bribe cost ×0.7 (cheaper bribes)
- Bandits: raid loot ×1.5, recruit cost ×0.5
- Empire: tax income ×1.5, patrol defense ×2.0
- Nobles: scheme effectiveness ×1.5, alliance chance ×1.5
- Goblins: raid loot ×1.3, expansion combat bonus +3

## Phase 2: Treaty System (Civ 6-style)

### 2a. New treaty types
Add to types.ts:
```ts
type TreatyType =
  | 'gold_for_peace'        // I pay you X gold/turn, you don't attack me
  | 'gold_for_protection'   // I pay you X gold/turn, you lend me Y army
  | 'gold_for_territory'    // I give you X gold, you give me a location
  | 'mutual_defense'        // we both defend each other (existing alliance, enhanced)
  | 'trade_agreement'       // both sides get income bonus from shared trade routes
  | 'tribute'               // weaker faction pays stronger to avoid war

interface Treaty {
  id: string;
  type: TreatyType;
  parties: [string, string];  // faction IDs
  terms: {
    goldPerTurn?: number;
    lumpSumGold?: number;
    locationId?: string;       // territory being traded
    powerLent?: number;        // army units lent
    duration: number;          // turns remaining
  };
  createdTurn: number;
}
```

### 2b. Treaty resolution each turn
- In economy phase: process active treaties (transfer gold, lend power)
- Expire treaties when duration hits 0
- Breaking a treaty: massive relationship penalty (-40), morale hit to breaker

### 2c. AI treaty proposals
New action type: `propose_treaty`
- Merchants propose `gold_for_peace` to bandits (pay protection money)
- Weak factions offer `tribute` to strong ones nearby
- Nobles propose `trade_agreement` with merchants
- Factions with high dealmaking personality prefer treaties over combat
- Personality.dealmaking > 0.6 → try treaty before raid/expand

### 2d. Treaty acceptance logic
- Based on relationship, relative power, gold offered vs value of territory
- High-greed factions need better deals
- High-aggression factions reject weak offers

## Phase 3: Bigger Map

### 3a. Expand terrain grid
- Terrain size: 50×50 → 80×80 (or configurable)
- Add more locations to locations.json (aim for ~20 total, up from current count)
- More trade routes and connections

### 3b. Add new locations
- Mining towns in mountains (high income bonus from ore)
- Coastal trading ports
- Border forts
- Religious sites
- More ruins and wilderness locations

## Phase 4: Building Interior Maps

### 4a. Building map generation
- When a POI in a town map is clicked, generate an interior map
- New generator: `generateBuildingInterior(poi, location, worldState)`
- Interior tile types: floor, wall, door, stairs, furniture, hearth, counter, storage, altar, etc.
- Layout rules per building type (tavern has bar + tables, temple has nave + altar, etc.)

### 4b. Artistic generation for interiors
- New prompt builder: `buildInteriorPrompt(interior, poi, location, worldState)`
- Uses img2img with the procedural interior as reference
- Style: top-down RPG interior, warm lighting, detailed furniture

### 4c. UI for building interiors
- Click a POI in TownMapView → opens BuildingInteriorView
- Toggle between procedural and artistic views (same pattern as town map)

## Phase 5: img2img Helper Scripts

### 5a. Pre-processing scripts
- Canvas overlay that adds text labels, grid lines, and color-coded regions
- Contrast enhancement for the reference image
- Scale reference images to optimal resolution for the model

### 5b. Prompt enhancement utilities
- Automatic style suffix injection based on map type (world/town/interior)
- Seasonal color palette hints appended to prompts
- Faction-specific visual motifs added when faction controls the area

---

## File Changes Summary

**Modified files:**
- `src/engine/types.ts` — Treaty, personality types, FactionAction additions
- `src/engine/config.ts` — Economy rebalance, action multipliers, treaty config
- `src/engine/economy.ts` — Treaty processing, location bonuses, personality multipliers
- `src/engine/simulation.ts` — Treaty action execution, personality-driven AI
- `src/engine/factions.ts` — Treaty proposal AI, personality-based decisions
- `src/engine/terrain.ts` — Larger grid support
- `src/engine/townmap.ts` — Building interior generation
- `src/engine/mapImageGen.ts` — Interior prompts, img2img helpers
- `src/data/factions.json` — Personality values, starting gold bump
- `src/data/locations.json` — New locations, income bonuses
- `src/ui/components/TownMapView.tsx` — POI click → interior view
- `src/ui/components/LocationDetail.tsx` — Interior view integration

**New files:**
- `src/engine/treaties.ts` — Treaty logic (proposal, acceptance, processing, breaking)
- `src/engine/buildings.ts` — Building interior map generation
- `src/ui/components/BuildingInteriorView.tsx` — Interior map UI
- `src/engine/imgHelpers.ts` — img2img pre-processing utilities
