import { useState } from 'react';
import type { WorldState, WorldDefinition } from '../../../engine/types.js';
import { AURELIAN_PRESET } from '../../../data/presets/aurelian.js';
import { createInitialWorldState } from '../../../engine/world-state.js';

interface OverviewTabProps {
  mode: 'setup' | 'live';
  worldState: WorldState;
  onStartGame: (definition: WorldDefinition) => void;
  onUpdateState: (state: WorldState) => void;
}

export default function OverviewTab({ mode, worldState, onStartGame, onUpdateState }: OverviewTabProps) {
  const def = worldState.definition;
  const [name, setName] = useState(def?.meta.name ?? 'Custom World');
  const [description, setDescription] = useState(def?.meta.description ?? '');
  const [theme, setTheme] = useState(def?.meta.theme ?? 'medieval-fantasy');

  if (mode === 'setup') {
    return (
      <div className="gm-tab-content">
        <h3>Choose a Starting Point</h3>
        <div className="gm-preset-grid">
          <div
            className="gm-preset-card"
            onClick={() => onStartGame(AURELIAN_PRESET)}
          >
            <h4>The Aurelian Decline</h4>
            <p>A crumbling empire, ambitious nobles, desperate bandits, and a rising goblin horde.</p>
            <span className="gm-preset-badge">Preset</span>
          </div>
          <div
            className="gm-preset-card gm-preset-card--custom"
            onClick={() => {
              const blankDef: WorldDefinition = {
                meta: { name, description, theme, startingSeason: 'Spring', seasonNames: ['Spring', 'Summer', 'Autumn', 'Winter'] },
                factions: [],
                locations: [],
                characters: [],
                events: [],
                storyHooks: [],
                availableTags: AURELIAN_PRESET.availableTags,
              };
              const newState = createInitialWorldState(blankDef);
              onUpdateState(newState);
            }}
          >
            <h4>Custom World</h4>
            <p>Start from scratch. Define your own factions, map, and rules.</p>
            <span className="gm-preset-badge gm-preset-badge--custom">Custom</span>
          </div>
        </div>

        <div className="gm-section" style={{ marginTop: 20 }}>
          <h3>World Settings</h3>
          <label className="gm-field">
            <span>World Name</span>
            <input value={name} onChange={e => setName(e.target.value)} />
          </label>
          <label className="gm-field">
            <span>Description</span>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} />
          </label>
          <label className="gm-field">
            <span>Theme</span>
            <select value={theme} onChange={e => setTheme(e.target.value)}>
              <option value="medieval-fantasy">Medieval Fantasy</option>
              <option value="sci-fi">Sci-Fi</option>
              <option value="post-apocalyptic">Post-Apocalyptic</option>
              <option value="historical">Historical</option>
              <option value="custom">Custom</option>
            </select>
          </label>
        </div>

        <button
          className="primary"
          style={{ marginTop: 16 }}
          onClick={() => {
            if (def) {
              const updated = { ...def, meta: { ...def.meta, name, description, theme } };
              onStartGame(updated);
            }
          }}
        >
          Start Game
        </button>
      </div>
    );
  }

  // Live mode — show world summary
  return (
    <div className="gm-tab-content">
      <h3>{def?.meta.name ?? 'World'}</h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{def?.meta.description}</p>
      <div className="gm-stats-grid" style={{ marginTop: 12 }}>
        <div className="gm-stat-card">
          <span className="gm-stat-value">{Object.keys(worldState.factions).length}</span>
          <span className="gm-stat-label">Factions</span>
        </div>
        <div className="gm-stat-card">
          <span className="gm-stat-value">{Object.keys(worldState.locations).length}</span>
          <span className="gm-stat-label">Locations</span>
        </div>
        <div className="gm-stat-card">
          <span className="gm-stat-value">{Object.values(worldState.characters).filter(c => c.status !== 'dead').length}</span>
          <span className="gm-stat-label">Living Characters</span>
        </div>
        <div className="gm-stat-card">
          <span className="gm-stat-value">{worldState.turn}</span>
          <span className="gm-stat-label">Current Turn</span>
        </div>
      </div>
    </div>
  );
}
