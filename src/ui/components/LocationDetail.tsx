import { useState } from 'react';
import type { Location, WorldState } from '../../engine/types.js';
import TownMapView from './TownMapView.js';

interface Props {
  location: Location | null;
  worldState: WorldState;
}

function StatBar({ value, max, className }: { value: number; max: number; className: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <span className="stat-bar">
      <span className={`stat-bar-fill ${className}`} style={{ width: `${pct}%` }} />
    </span>
  );
}

export default function LocationDetail({ location, worldState }: Props) {
  const [showTownMap, setShowTownMap] = useState(false);

  if (!location) {
    return (
      <div style={{ padding: 16, color: 'var(--text-muted)', textAlign: 'center', fontSize: '0.85rem' }}>
        <p>Select a location on the map to view details.</p>
      </div>
    );
  }

  // Find controlling faction
  const controller = Object.values(worldState.factions).find(f =>
    f.controlledLocations.includes(location.id)
  );

  // Find recent events for this location
  const recentEvents = worldState.eventLog
    .filter(e => e.locationId === location.id)
    .slice(-5)
    .reverse();

  return (
    <div style={{ overflow: 'auto', flex: 1, padding: '4px 0' }}>
      <div className="card">
        <h3>{location.name}</h3>
        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 4 }}>
          {location.type.charAt(0).toUpperCase() + location.type.slice(1)}
          {controller && ` — controlled by ${controller.name}`}
        </p>
        <p>{location.description}</p>
        <button
          className={showTownMap ? 'primary' : 'secondary'}
          style={{ marginTop: 8, fontSize: '0.75rem' }}
          onClick={() => setShowTownMap(!showTownMap)}
        >
          {showTownMap ? 'Hide Local Map' : 'View Local Map'}
        </button>
      </div>

      {showTownMap && (
        <div className="card">
          <h3>Local Map — {location.name}</h3>
          <TownMapView location={location} />
        </div>
      )}

      <div className="card">
        <h3>Statistics</h3>
        <div className="stat-row">
          <span className="stat">
            Population: <strong>{location.population.toLocaleString()}</strong>
          </span>
        </div>
        <div className="stat-row">
          <span className="stat">
            Defense: <strong>{location.defense}</strong>
            <StatBar value={location.defense} max={100} className="defense" />
          </span>
        </div>
        <div className="stat-row">
          <span className="stat">
            Prosperity: <strong>{location.prosperity}</strong>
            <StatBar value={location.prosperity} max={100} className="prosperity" />
          </span>
        </div>
        {location.resources.length > 0 && (
          <div className="stat-row">
            <span className="stat">
              Resources: <strong>{location.resources.join(', ')}</strong>
            </span>
          </div>
        )}
      </div>

      {location.rumors.length > 0 && (
        <div className="card">
          <h3>Rumors</h3>
          {location.rumors.map((rumor, i) => (
            <p key={i} style={{ fontSize: '0.8rem', fontStyle: 'italic', marginTop: i > 0 ? 4 : 0 }}>
              "{rumor}"
            </p>
          ))}
        </div>
      )}

      {location.connectedTo.length > 0 && (
        <div className="card">
          <h3>Connections</h3>
          <p style={{ fontSize: '0.8rem' }}>
            {location.connectedTo.map(id => worldState.locations[id]?.name ?? id).join(', ')}
          </p>
        </div>
      )}

      {recentEvents.length > 0 && (
        <div className="card">
          <h3>Recent Events</h3>
          {recentEvents.map((event, i) => (
            <div key={event.id || i} className="event-item" style={{ padding: '4px 0' }}>
              <span className="event-icon">{event.icon}</span>
              <span className="event-text" style={{ fontSize: '0.75rem' }}>{event.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
