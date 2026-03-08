import { useState } from 'react';
import type { WorldState, Character, CharacterStatus } from '../../../engine/types.js';
import { gmAddCharacter, gmKillCharacter, gmEditCharacter, gmTransferCharacter, createBlankCharacter } from '../../../engine/gm-actions.js';

interface CharactersTabProps {
  worldState: WorldState;
  onUpdateState: (state: WorldState) => void;
  mode: 'setup' | 'live';
}

export default function CharactersTab({ worldState, onUpdateState, mode }: CharactersTabProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterFaction, setFilterFaction] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('active');

  const allChars = Object.values(worldState.characters);
  const factions = Object.values(worldState.factions);
  const locations = Object.values(worldState.locations);

  const filtered = allChars.filter(c => {
    if (filterFaction !== 'all' && c.factionId !== filterFaction) return false;
    if (filterStatus !== 'all' && c.status !== filterStatus) return false;
    return true;
  });

  const selected = selectedId ? worldState.characters[selectedId] : null;

  const addCharacter = () => {
    const id = `char_${Date.now()}`;
    const factionId = factions.length > 0 ? factions[0].id : '';
    const locationId = locations.length > 0 ? locations[0].id : '';
    const blank = createBlankCharacter(id, factionId, locationId);
    blank.activeSince = worldState.turn;
    const newState = { ...worldState, characters: { ...worldState.characters } };
    gmAddCharacter(newState, blank);
    onUpdateState(newState);
    setSelectedId(id);
  };

  const updateField = (field: keyof Character, value: unknown) => {
    if (!selected) return;
    const newState = { ...worldState, characters: { ...worldState.characters } };
    newState.characters[selected.id] = { ...selected, [field]: value };
    onUpdateState(newState);
  };

  const killCharacter = () => {
    if (!selected) return;
    const newState = { ...worldState, characters: { ...worldState.characters }, eventLog: [...worldState.eventLog] };
    newState.characters[selected.id] = { ...selected };
    gmKillCharacter(newState, selected.id, 'Struck down by the Game Master');
    onUpdateState(newState);
  };

  const transferCharacter = (newFactionId: string) => {
    if (!selected) return;
    const newState = { ...worldState, characters: { ...worldState.characters }, eventLog: [...worldState.eventLog] };
    newState.characters[selected.id] = { ...selected };
    gmTransferCharacter(newState, selected.id, newFactionId);
    onUpdateState(newState);
  };

  return (
    <div className="gm-tab-content">
      <div className="gm-list-header">
        <h3>Characters ({allChars.filter(c => c.status !== 'dead').length} alive)</h3>
        <button className="gm-btn-add" onClick={addCharacter}>+ Add Character</button>
      </div>

      <div className="gm-filters">
        <select value={filterFaction} onChange={e => setFilterFaction(e.target.value)}>
          <option value="all">All Factions</option>
          {factions.map(f => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="wounded">Wounded</option>
          <option value="captured">Captured</option>
          <option value="dead">Dead</option>
        </select>
      </div>

      <div className="gm-two-panel">
        <div className="gm-list">
          {filtered.map(c => {
            const faction = worldState.factions[c.factionId];
            return (
              <div
                key={c.id}
                className={`gm-list-item ${selectedId === c.id ? 'selected' : ''} ${c.status === 'dead' ? 'gm-list-item--dead' : ''}`}
                onClick={() => setSelectedId(c.id)}
              >
                <span className="gm-faction-dot" style={{ background: faction?.color ?? '#888' }} />
                <span>{c.name}</span>
                <span className="gm-list-sub">{c.title} — {c.status}</span>
              </div>
            );
          })}
        </div>

        {selected && (
          <div className="gm-detail-panel">
            <label className="gm-field">
              <span>Name</span>
              <input value={selected.name} onChange={e => updateField('name', e.target.value)} />
            </label>
            <label className="gm-field">
              <span>Title</span>
              <input value={selected.title} onChange={e => updateField('title', e.target.value)} />
            </label>
            <label className="gm-field">
              <span>Role</span>
              <input value={selected.role} onChange={e => updateField('role', e.target.value)} placeholder="e.g. commander, advisor, spy..." />
            </label>
            <label className="gm-field">
              <span>Faction</span>
              <select value={selected.factionId} onChange={e => transferCharacter(e.target.value)}>
                {factions.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </label>
            <label className="gm-field">
              <span>Location</span>
              <select value={selected.locationId} onChange={e => updateField('locationId', e.target.value)}>
                {locations.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </label>
            <label className="gm-field">
              <span>Status</span>
              <select value={selected.status} onChange={e => updateField('status', e.target.value as CharacterStatus)}>
                <option value="active">Active</option>
                <option value="wounded">Wounded</option>
                <option value="captured">Captured</option>
                <option value="dead">Dead</option>
              </select>
            </label>
            <label className="gm-field">
              <span>Description</span>
              <textarea value={selected.description} onChange={e => updateField('description', e.target.value)} rows={2} />
            </label>

            <div className="gm-section">
              <h4>Stats</h4>
              <div className="gm-stats-row">
                {(['prowess', 'cunning', 'authority'] as const).map(stat => (
                  <label key={stat} className="gm-field gm-field--inline">
                    <span>{stat}</span>
                    <input
                      type="number" min="1" max="10"
                      value={selected[stat]}
                      onChange={e => updateField(stat, Math.min(10, Math.max(1, Number(e.target.value))))}
                      style={{ width: 50 }}
                    />
                  </label>
                ))}
              </div>
              <div className="gm-stats-row">
                {(['renown', 'loyalty'] as const).map(stat => (
                  <label key={stat} className="gm-field gm-field--slider">
                    <span>{stat}: {selected[stat]}</span>
                    <input
                      type="range" min="0" max="100"
                      value={selected[stat]}
                      onChange={e => updateField(stat, Number(e.target.value))}
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="gm-section">
              <h4>Traits</h4>
              <input
                value={(selected.traits ?? []).join(', ')}
                onChange={e => updateField('traits', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                placeholder="brave, cunning, cruel..."
              />
            </div>

            {mode === 'live' && selected.status !== 'dead' && (
              <div className="gm-section">
                <h4>Combat Record</h4>
                <div className="gm-stats-row">
                  <span>Kills: {selected.killCount}</span>
                  <span>Wins: {selected.battlesWon}</span>
                  <span>Losses: {selected.battlesLost}</span>
                  <span>Wounds: {selected.timesWounded}</span>
                </div>
              </div>
            )}

            {selected.status !== 'dead' && (
              <button
                className="gm-btn-danger"
                onClick={killCharacter}
                style={{ marginTop: 16 }}
              >
                {mode === 'live' ? 'Kill Character' : 'Remove Character'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
