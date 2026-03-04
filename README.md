# The Aurelian Decline — Living World D&D Campaign Engine

A living world simulation engine for a D&D campaign set in a declining empire. Run "between sessions" to produce an evolving world with emergent narrative hooks.

## Quick Start

```bash
npm install

# Run the web UI
npm run dev

# Run a CLI simulation (4 turns = 1 year)
npm run simulate

# Run N turns with a specific seed
npx tsx src/cli/simulate.ts 8 42
```

## Architecture

- **Engine** (`src/engine/`) — Core simulation: turn resolution, faction AI, combat, economy, events
- **Data** (`src/data/`) — Starting world state: factions, locations, event templates, story hooks
- **UI** (`src/ui/`) — React + Vite web interface with interactive map, faction panel, chronicle, and dashboard
- **CLI** (`src/cli/`) — Command-line tool for quick simulation runs

## How It Works

Each turn represents one season (4 turns = 1 year). The simulation resolves:

1. Empire decay (corruption, power erosion)
2. Economy (income, trade, upkeep)
3. Faction decisions (AI-driven, motivated by goals and resources)
4. Conflict resolution (raids, battles)
5. Consequences (refugees, territory changes, relationship shifts)
6. Random events (weather, discoveries, omens)
7. Story hooks (narrative beats on a schedule)

## World State

The starting world features 7 factions and 20 locations in a declining empire. See `src/data/` for details.
