import { useState } from 'react';
import type { WorldState, Faction, FactionPersonality } from '../../../engine/types.js';
import { gmAddFaction, gmRemoveFaction, gmEditFaction, createBlankFaction } from '../../../engine/gm-actions.js';
import { BUILTIN_TAGS, getTagsByCategory, type TagCategory } from '../../../engine/tags.js';

interface FactionsTabProps {
  worldState: WorldState;
  onUpdateState: (state: WorldState) => void;
  mode: 'setup' | 'live';
}

export default function FactionsTab({ worldState, onUpdateState, mode }: FactionsTabProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const factions = Object.values(worldState.factions);
  const selected = selectedId ? worldState.factions[selectedId] : null;

  const addFaction = () => {
    const id = `faction_${Date.now()}`;
    const blank = createBlankFaction(id);
    const newState = { ...worldState, factions: { ...worldState.factions } };
    gmAddFaction(newState, blank);
    onUpdateState(newState);
    setSelectedId(id);
  };

  const removeFaction = (id: string) => {
    const newState = { ...worldState, factions: { ...worldState.factions }, characters: { ...worldState.characters } };
    gmRemoveFaction(newState, id);
    onUpdateState(newState);
    if (selectedId === id) setSelectedId(null);
  };

  const updateField = (field: keyof Faction, value: unknown) => {
    if (!selected) return;
    const newState = { ...worldState, factions: { ...worldState.factions } };
    newState.factions[selected.id] = { ...selected, [field]: value };
    onUpdateState(newState);
  };

  const updatePersonality = (field: keyof FactionPersonality, value: number) => {
    if (!selected) return;
    updateField('personality', { ...selected.personality, [field]: value / 100 });
  };

  const toggleTag = (tag: string) => {
    if (!selected) return;
    const tags = [...(selected.tags ?? [])];
    const idx = tags.indexOf(tag);
    if (idx >= 0) tags.splice(idx, 1);
    else tags.push(tag);
    updateField('tags', tags);
  };

  const tagsByCategory = getTagsByCategory();
  const categoryLabels: Record<TagCategory, string> = {
    disposition: 'Disposition', economic: 'Economic', political: 'Political',
    social: 'Social', military: 'Military', compound: 'Compound',
  };

  return (
    <div className="gm-tab-content">
      <div className="gm-list-header">
        <h3>Factions ({factions.length})</h3>
        <button className="gm-btn-add" onClick={addFaction}>+ Add Faction</button>
      </div>

      <div className="gm-two-panel">
        <div className="gm-list">
          {factions.map(f => (
            <div
              key={f.id}
              className={`gm-list-item ${selectedId === f.id ? 'selected' : ''}`}
              onClick={() => setSelectedId(f.id)}
            >
              <span className="gm-faction-dot" style={{ background: f.color ?? '#888' }} />
              <span>{f.name}</span>
              <span className="gm-list-sub">{f.type}</span>
            </div>
          ))}
        </div>

        {selected && (
          <div className="gm-detail-panel">
            <label className="gm-field">
              <span>Name</span>
              <input value={selected.name} onChange={e => updateField('name', e.target.value)} />
            </label>
            <label className="gm-field">
              <span>Type Label</span>
              <input value={selected.type} onChange={e => updateField('type', e.target.value)} placeholder="e.g. empire, guild, cult..." />
            </label>
            <label className="gm-field">
              <span>Leader</span>
              <input value={selected.leader} onChange={e => updateField('leader', e.target.value)} />
            </label>
            <label className="gm-field">
              <span>Color</span>
              <input type="color" value={selected.color ?? '#888888'} onChange={e => updateField('color', e.target.value)} />
            </label>
            <label className="gm-field">
              <span>Description</span>
              <textarea value={selected.description} onChange={e => updateField('description', e.target.value)} rows={2} />
            </label>

            <div className="gm-section">
              <h4>Stats</h4>
              <div className="gm-stats-row">
                {(['power', 'maxPower', 'morale', 'gold', 'corruption'] as const).map(stat => (
                  <label key={stat} className="gm-field gm-field--inline">
                    <span>{stat}</span>
                    <input
                      type="number"
                      value={selected[stat]}
                      onChange={e => updateField(stat, Number(e.target.value))}
                      style={{ width: 60 }}
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="gm-section">
              <h4>Personality</h4>
              {(['dealmaking', 'aggression', 'greed'] as const).map(p => (
                <label key={p} className="gm-field gm-field--slider">
                  <span>{p}: {Math.round(selected.personality[p] * 100)}%</span>
                  <input
                    type="range" min="0" max="100"
                    value={Math.round(selected.personality[p] * 100)}
                    onChange={e => updatePersonality(p, Number(e.target.value))}
                  />
                </label>
              ))}
            </div>

            <div className="gm-section">
              <div className="gm-list-header">
                <h4>Behavioral Tags</h4>
                <button className="gm-btn-small" onClick={() => setShowTagPicker(!showTagPicker)}>
                  {showTagPicker ? 'Hide Picker' : 'Add Tags'}
                </button>
              </div>
              <div className="gm-tag-list">
                {(selected.tags ?? []).map(tag => (
                  <span key={tag} className="gm-tag" onClick={() => toggleTag(tag)}>
                    {tag} ×
                  </span>
                ))}
                {(!selected.tags || selected.tags.length === 0) && (
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No tags — faction will use default behavior</span>
                )}
              </div>
              {showTagPicker && (
                <div className="gm-tag-picker">
                  {(Object.keys(tagsByCategory) as TagCategory[]).map(cat => (
                    <div key={cat} className="gm-tag-category">
                      <h5>{categoryLabels[cat]}</h5>
                      <div className="gm-tag-grid">
                        {tagsByCategory[cat].map(t => (
                          <button
                            key={t.tag}
                            className={`gm-tag-btn ${(selected.tags ?? []).includes(t.tag) ? 'active' : ''}`}
                            onClick={() => toggleTag(t.tag)}
                            title={t.description}
                          >
                            {t.tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="gm-section">
              <h4>Relationships</h4>
              {Object.entries(selected.relationships).map(([otherId, value]) => {
                const other = worldState.factions[otherId];
                if (!other) return null;
                return (
                  <label key={otherId} className="gm-field gm-field--slider">
                    <span>{other.name}: {value}</span>
                    <input
                      type="range" min="-100" max="100"
                      value={value}
                      onChange={e => {
                        const newRels = { ...selected.relationships, [otherId]: Number(e.target.value) };
                        updateField('relationships', newRels);
                      }}
                    />
                  </label>
                );
              })}
            </div>

            <button
              className="gm-btn-danger"
              onClick={() => removeFaction(selected.id)}
              style={{ marginTop: 16 }}
            >
              {mode === 'live' ? 'Eliminate Faction' : 'Remove Faction'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
