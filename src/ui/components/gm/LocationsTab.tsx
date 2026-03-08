import { useState } from 'react';
import type { WorldState, Location } from '../../../engine/types.js';
import { gmAddLocation, gmEditLocation, gmRazeLocation, gmTransferTerritory, createBlankLocation } from '../../../engine/gm-actions.js';

interface LocationsTabProps {
  worldState: WorldState;
  onUpdateState: (state: WorldState) => void;
}

export default function LocationsTab({ worldState, onUpdateState }: LocationsTabProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const allLocations = Object.values(worldState.locations);
  const factions = Object.values(worldState.factions);
  const selected = selectedId ? worldState.locations[selectedId] : null;

  const getOwner = (locId: string) =>
    factions.find(f => f.controlledLocations.includes(locId));

  const addLocation = () => {
    const id = `loc_${Date.now()}`;
    const blank = createBlankLocation(id);
    const newState = { ...worldState, locations: { ...worldState.locations }, eventLog: [...worldState.eventLog] };
    gmAddLocation(newState, blank);
    onUpdateState(newState);
    setSelectedId(id);
  };

  const updateField = (field: keyof Location, value: unknown) => {
    if (!selected) return;
    const newState = { ...worldState, locations: { ...worldState.locations } };
    newState.locations[selected.id] = { ...selected, [field]: value };
    onUpdateState(newState);
  };

  const razeLocation = () => {
    if (!selected) return;
    const newState = {
      ...worldState,
      locations: { ...worldState.locations },
      factions: Object.fromEntries(Object.entries(worldState.factions).map(([k, v]) => [k, { ...v, controlledLocations: [...v.controlledLocations] }])),
      eventLog: [...worldState.eventLog],
    };
    newState.locations[selected.id] = { ...selected };
    gmRazeLocation(newState, selected.id);
    onUpdateState(newState);
  };

  const transferOwnership = (newOwnerId: string) => {
    if (!selected) return;
    const newState = {
      ...worldState,
      locations: { ...worldState.locations },
      factions: Object.fromEntries(Object.entries(worldState.factions).map(([k, v]) => [k, { ...v, controlledLocations: [...v.controlledLocations] }])),
      eventLog: [...worldState.eventLog],
    };
    gmTransferTerritory(newState, selected.id, newOwnerId === 'none' ? null : newOwnerId);
    onUpdateState(newState);
  };

  return (
    <div className="gm-tab-content">
      <div className="gm-list-header">
        <h3>Locations ({allLocations.length})</h3>
        <button className="gm-btn-add" onClick={addLocation}>+ Add Location</button>
      </div>

      <div className="gm-two-panel">
        <div className="gm-list">
          {allLocations.map(loc => {
            const owner = getOwner(loc.id);
            return (
              <div
                key={loc.id}
                className={`gm-list-item ${selectedId === loc.id ? 'selected' : ''}`}
                onClick={() => setSelectedId(loc.id)}
              >
                <span className="gm-faction-dot" style={{ background: owner?.color ?? '#555' }} />
                <span>{loc.name}</span>
                <span className="gm-list-sub">{loc.type} — pop {loc.population}</span>
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
              <span>Type</span>
              <input value={selected.type} onChange={e => updateField('type', e.target.value)} placeholder="e.g. town, fortress, ruins..." />
            </label>
            <label className="gm-field">
              <span>Description</span>
              <textarea value={selected.description} onChange={e => updateField('description', e.target.value)} rows={2} />
            </label>

            <div className="gm-section">
              <h4>Owner</h4>
              <select
                value={getOwner(selected.id)?.id ?? 'none'}
                onChange={e => transferOwnership(e.target.value)}
              >
                <option value="none">Unclaimed</option>
                {factions.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>

            <div className="gm-section">
              <h4>Stats</h4>
              <div className="gm-stats-row">
                {(['population', 'defense', 'prosperity'] as const).map(stat => (
                  <label key={stat} className="gm-field gm-field--inline">
                    <span>{stat}</span>
                    <input
                      type="number"
                      value={selected[stat]}
                      onChange={e => updateField(stat, Math.max(0, Number(e.target.value)))}
                      style={{ width: 70 }}
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="gm-section">
              <h4>Position</h4>
              <div className="gm-stats-row">
                <label className="gm-field gm-field--inline">
                  <span>X</span>
                  <input type="number" value={selected.x} onChange={e => updateField('x', Number(e.target.value))} style={{ width: 60 }} />
                </label>
                <label className="gm-field gm-field--inline">
                  <span>Y</span>
                  <input type="number" value={selected.y} onChange={e => updateField('y', Number(e.target.value))} style={{ width: 60 }} />
                </label>
              </div>
            </div>

            <div className="gm-section">
              <h4>Connections</h4>
              <div className="gm-tag-list">
                {selected.connectedTo.map(cId => {
                  const cLoc = worldState.locations[cId];
                  return (
                    <span key={cId} className="gm-tag" onClick={() => {
                      updateField('connectedTo', selected.connectedTo.filter(id => id !== cId));
                    }}>
                      {cLoc?.name ?? cId} ×
                    </span>
                  );
                })}
              </div>
              <select
                value=""
                onChange={e => {
                  if (e.target.value && !selected.connectedTo.includes(e.target.value)) {
                    updateField('connectedTo', [...selected.connectedTo, e.target.value]);
                  }
                }}
              >
                <option value="">+ Add connection...</option>
                {allLocations.filter(l => l.id !== selected.id && !selected.connectedTo.includes(l.id)).map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>

            <div className="gm-section">
              <h4>Resources</h4>
              <input
                value={(selected.resources ?? []).join(', ')}
                onChange={e => updateField('resources', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                placeholder="iron, timber, grain..."
              />
            </div>

            <button
              className="gm-btn-danger"
              onClick={razeLocation}
              style={{ marginTop: 16 }}
            >
              Raze Location
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
