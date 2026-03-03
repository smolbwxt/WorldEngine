import { createInitialWorldState, serializeWorldState } from '../engine/world-state.js';
import { simulateTurns } from '../engine/simulation.js';
import * as fs from 'fs';
import * as path from 'path';

const args = process.argv.slice(2);
const turnCount = parseInt(args[0] || '4', 10); // default: 1 year (4 turns)
const seed = args[1] ? parseInt(args[1], 10) : undefined;
const savePath = args[2] || undefined;

console.log(`\n╔══════════════════════════════════════════════╗`);
console.log(`║     THE AURELIAN DECLINE — World Engine      ║`);
console.log(`╚══════════════════════════════════════════════╝\n`);

// Load existing state or create new
let state;
if (savePath && fs.existsSync(savePath)) {
  console.log(`Loading world state from ${savePath}...`);
  state = JSON.parse(fs.readFileSync(savePath, 'utf-8'));
} else {
  console.log(`Creating new world (seed: ${seed ?? 'random'})...`);
  state = createInitialWorldState(seed);
}

console.log(`Starting at: ${state.season}, Year ${state.year} (Turn ${state.turn})`);
console.log(`Simulating ${turnCount} turns...\n`);
console.log('─'.repeat(50));

const results = simulateTurns(state, turnCount);

for (const result of results) {
  console.log(`\n${result.dmBrief}`);
  console.log('─'.repeat(50));
}

// Summary
console.log(`\n╔══════════════════════════════════════════════╗`);
console.log(`║              SIMULATION COMPLETE              ║`);
console.log(`╚══════════════════════════════════════════════╝`);
console.log(`\nFinal state: ${state.season}, Year ${state.year} (Turn ${state.turn})\n`);

// Top story hooks
const allHooks = results.flatMap(r => r.storyHooks);
if (allHooks.length > 0) {
  console.log('TOP STORY HOOKS FOR DM:');
  for (const hook of allHooks) {
    console.log(`  ★ ${hook}`);
  }
  console.log('');
}

// Save state
const saveDir = path.resolve('saves');
if (!fs.existsSync(saveDir)) fs.mkdirSync(saveDir, { recursive: true });
const saveFile = path.join(saveDir, `world-state-turn-${state.turn}.json`);
fs.writeFileSync(saveFile, serializeWorldState(state));
console.log(`World state saved to: ${saveFile}`);
