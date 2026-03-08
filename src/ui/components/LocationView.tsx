import { useState, useCallback, useRef } from 'react';
import type { Location, WorldState } from '../../engine/types.js';
import TownMapView from './TownMapView.js';
import { generateLocationScene, type MapGenResult } from '../../engine/mapImageGen.js';

interface Props {
  location: Location | null;
  worldState: WorldState;
}

function StatBar({ value, max, className }: { value: number; max: number; className: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <span className="stat-bar" style={{ width: 120 }}>
      <span className={`stat-bar-fill ${className}`} style={{ width: `${pct}%` }} />
    </span>
  );
}

function LocationSceneGenerator({
  location,
  worldState,
}: {
  location: Location;
  worldState: WorldState;
}) {
  const [image, setImage] = useState<MapGenResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userDesc, setUserDesc] = useState('');
  const cacheRef = useRef<Map<string, MapGenResult>>(new Map());

  const handleGenerate = useCallback(async () => {
    const cacheKey = `${location.id}_${userDesc}`;
    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      setImage(cached);
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const result = await generateLocationScene(location, worldState, userDesc || undefined);
      cacheRef.current.set(cacheKey, result);
      setImage(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  }, [location, worldState, userDesc]);

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <input
          type="text"
          placeholder="Add to description (optional)..."
          value={userDesc}
          onChange={e => setUserDesc(e.target.value)}
          style={{
            flex: 1, padding: '6px 10px', fontSize: '0.8rem',
            background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
            borderRadius: 4, color: 'var(--text-primary)',
          }}
        />
        <button
          className="primary"
          onClick={handleGenerate}
          disabled={generating}
          style={{ fontSize: '0.8rem', padding: '6px 16px' }}
        >
          {generating ? 'Painting...' : 'Paint Scene'}
        </button>
      </div>
      {error && <p style={{ color: '#c66', fontSize: '0.75rem' }}>Error: {error}</p>}

      {generating && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          <div className="map-generating-spinner" />
          <p>Painting {location.name}...</p>
        </div>
      )}

      {image && (
        <img
          src={`data:${image.mimeType};base64,${image.imageBase64}`}
          alt={`Artistic view of ${location.name}`}
          style={{ width: '100%', borderRadius: 6, marginTop: 8 }}
        />
      )}
    </div>
  );
}

export default function LocationView({ location, worldState }: Props) {
  const [viewMode, setViewMode] = useState<'info' | 'townmap' | 'scene'>('info');

  if (!location) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: 'var(--text-muted)', fontSize: '0.9rem',
      }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '2rem', marginBottom: 8 }}>Select a location on the map</p>
          <p>Click any location marker to view it here.</p>
        </div>
      </div>
    );
  }

  const controller = Object.values(worldState.factions).find(f =>
    f.controlledLocations.includes(location.id)
  );

  const recentEvents = worldState.eventLog
    .filter(e => e.locationId === location.id)
    .slice(-8)
    .reverse();

  const characters = Object.values(worldState.characters ?? {}).filter(
    c => c.locationId === location.id && c.status !== 'dead'
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto', padding: 12, gap: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.3rem' }}>{location.name}</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
            {location.type.charAt(0).toUpperCase() + location.type.slice(1)}
            {controller && ` — controlled by ${controller.name}`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            className={viewMode === 'info' ? 'primary' : 'secondary'}
            onClick={() => setViewMode('info')}
            style={{ fontSize: '0.75rem', padding: '4px 10px' }}
          >
            Info
          </button>
          <button
            className={viewMode === 'townmap' ? 'primary' : 'secondary'}
            onClick={() => setViewMode('townmap')}
            style={{ fontSize: '0.75rem', padding: '4px 10px' }}
          >
            Local Map
          </button>
          <button
            className={viewMode === 'scene' ? 'primary' : 'secondary'}
            onClick={() => setViewMode('scene')}
            style={{ fontSize: '0.75rem', padding: '4px 10px' }}
          >
            Scene Art
          </button>
        </div>
      </div>

      <p style={{ fontSize: '0.85rem', fontStyle: 'italic', color: 'var(--text-muted)', margin: 0 }}>
        {location.description}
      </p>

      {viewMode === 'info' && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {/* Left column — stats and characters */}
          <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Statistics</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem' }}>
                  <span style={{ width: 80 }}>Population</span>
                  <strong>{location.population.toLocaleString()}</strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem' }}>
                  <span style={{ width: 80 }}>Defense</span>
                  <strong>{location.defense}</strong>
                  <StatBar value={location.defense} max={100} className="defense" />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem' }}>
                  <span style={{ width: 80 }}>Prosperity</span>
                  <strong>{location.prosperity}</strong>
                  <StatBar value={location.prosperity} max={100} className="prosperity" />
                </div>
                {location.resources.length > 0 && (
                  <div style={{ fontSize: '0.8rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Resources: </span>
                    <strong>{location.resources.join(', ')}</strong>
                  </div>
                )}
              </div>
            </div>

            {location.connectedTo.length > 0 && (
              <div className="card">
                <h3 style={{ marginTop: 0 }}>Connections</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {location.connectedTo.map(id => {
                    const name = worldState.locations[id]?.name ?? id;
                    return (
                      <span key={id} style={{
                        fontSize: '0.75rem', padding: '2px 8px',
                        background: 'rgba(255,255,255,0.06)', borderRadius: 4,
                      }}>
                        {name}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {characters.length > 0 && (
              <div className="card">
                <h3 style={{ marginTop: 0 }}>Characters Present</h3>
                {characters.map(c => (
                  <div key={c.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '4px 0', fontSize: '0.8rem',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                  }}>
                    <span style={{ fontSize: '1rem' }}>
                      {{ commander: '⚔️', champion: '🗡️', spymaster: '🕵️', diplomat: '🤝', advisor: '📜', warchief: '💀' }[c.role] ?? '●'}
                    </span>
                    <div>
                      <strong>{c.name}</strong>
                      <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>{c.title}</span>
                      {c.status === 'wounded' && <span style={{ color: '#c4a035', marginLeft: 6 }}>(Wounded)</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right column — rumors and events */}
          <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {location.rumors.length > 0 && (
              <div className="card">
                <h3 style={{ marginTop: 0 }}>Rumors</h3>
                {location.rumors.map((rumor, i) => (
                  <p key={i} style={{ fontSize: '0.8rem', fontStyle: 'italic', margin: i > 0 ? '6px 0 0' : 0, lineHeight: 1.5 }}>
                    "{rumor}"
                  </p>
                ))}
              </div>
            )}

            {recentEvents.length > 0 && (
              <div className="card">
                <h3 style={{ marginTop: 0 }}>Recent Events</h3>
                {recentEvents.map((event, i) => (
                  <div key={event.id || i} style={{
                    display: 'flex', gap: 6, padding: '4px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    fontSize: '0.75rem',
                  }}>
                    <span>{event.icon}</span>
                    <span>{event.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {viewMode === 'townmap' && (
        <div style={{ flex: 1 }}>
          <TownMapView location={location} worldState={worldState} />
        </div>
      )}

      {viewMode === 'scene' && (
        <div style={{ flex: 1 }}>
          <LocationSceneGenerator location={location} worldState={worldState} />
        </div>
      )}
    </div>
  );
}
