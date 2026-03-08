import { useState, useRef, useCallback } from 'react';
import type { WorldState, MapGridConfig, MapCell } from '../../../engine/types.js';

interface MapTabProps {
  worldState: WorldState;
  onUpdateState: (state: WorldState) => void;
  mode: 'setup' | 'live';
}

const TERRAIN_TYPES = ['plains', 'forest', 'mountain', 'water', 'desert', 'swamp', 'snow', 'hills'];
const TERRAIN_COLORS: Record<string, string> = {
  plains: '#8fbc5a', forest: '#2d7a3a', mountain: '#8a7d6b', water: '#4a8eb5',
  desert: '#d4b96a', swamp: '#5a6e4a', snow: '#dde8ef', hills: '#a89a6e',
};

export default function MapTab({ worldState, onUpdateState, mode }: MapTabProps) {
  const [mapImage, setMapImage] = useState<string | null>(worldState.definition?.mapImage ?? null);
  const [gridRows, setGridRows] = useState(worldState.definition?.mapGrid?.rows ?? 8);
  const [gridCols, setGridCols] = useState(worldState.definition?.mapGrid?.cols ?? 12);
  const [paintTerrain, setPaintTerrain] = useState('plains');
  const [paintMode, setPaintMode] = useState<'terrain' | 'owner' | 'location'>('terrain');
  const [paintOwner, setPaintOwner] = useState<string>('');
  const [paintLocation, setPaintLocation] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const factions = Object.values(worldState.factions);
  const locations = Object.values(worldState.locations);
  const grid = worldState.definition?.mapGrid;

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setMapImage(dataUrl);

      // Initialize grid
      const cells: MapCell[][] = [];
      for (let r = 0; r < gridRows; r++) {
        cells[r] = [];
        for (let c = 0; c < gridCols; c++) {
          cells[r][c] = { terrain: 'plains', color: TERRAIN_COLORS.plains };
        }
      }

      const newDef = {
        ...(worldState.definition ?? {
          meta: { name: 'Custom World', description: '', theme: 'medieval-fantasy', startingSeason: 'Spring', seasonNames: ['Spring', 'Summer', 'Autumn', 'Winter'] },
          factions: [], locations: [], characters: [], events: [], storyHooks: [], availableTags: [],
        }),
        mapImage: dataUrl,
        mapGrid: { rows: gridRows, cols: gridCols, cells },
      };

      onUpdateState({ ...worldState, definition: newDef });
    };
    reader.readAsDataURL(file);
  }, [worldState, onUpdateState, gridRows, gridCols]);

  const generateGrid = () => {
    const cells: MapCell[][] = [];
    for (let r = 0; r < gridRows; r++) {
      cells[r] = [];
      for (let c = 0; c < gridCols; c++) {
        const existing = grid?.cells?.[r]?.[c];
        cells[r][c] = existing ?? { terrain: 'plains', color: TERRAIN_COLORS.plains };
      }
    }

    const newDef = { ...worldState.definition! };
    newDef.mapGrid = { rows: gridRows, cols: gridCols, cells };
    onUpdateState({ ...worldState, definition: newDef });
  };

  const paintCell = (row: number, col: number) => {
    if (!grid) return;
    const newGrid: MapGridConfig = {
      ...grid,
      cells: grid.cells.map((r, ri) =>
        r.map((cell, ci) => {
          if (ri !== row || ci !== col) return cell;
          if (paintMode === 'terrain') {
            return { ...cell, terrain: paintTerrain, color: TERRAIN_COLORS[paintTerrain] ?? '#888' };
          } else if (paintMode === 'owner') {
            return { ...cell, owner: paintOwner || undefined };
          } else {
            return { ...cell, locationId: paintLocation || undefined };
          }
        })
      ),
    };
    const newDef = { ...worldState.definition!, mapGrid: newGrid };
    onUpdateState({ ...worldState, definition: newDef });
  };

  return (
    <div className="gm-tab-content">
      <h3>World Map</h3>

      {!mapImage && !grid && (
        <div className="gm-section">
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Upload a map image to use as a background, or generate a blank grid.
          </p>
          <div className="gm-stats-row" style={{ marginTop: 8 }}>
            <button className="gm-btn-add" onClick={() => fileInputRef.current?.click()}>
              Upload Map Image
            </button>
            <button className="gm-btn-add" onClick={generateGrid}>
              Generate Blank Grid
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleImageUpload}
          />
          <div className="gm-stats-row" style={{ marginTop: 8 }}>
            <label className="gm-field gm-field--inline">
              <span>Rows</span>
              <input type="number" value={gridRows} onChange={e => setGridRows(Math.max(1, Number(e.target.value)))} style={{ width: 50 }} />
            </label>
            <label className="gm-field gm-field--inline">
              <span>Cols</span>
              <input type="number" value={gridCols} onChange={e => setGridCols(Math.max(1, Number(e.target.value)))} style={{ width: 50 }} />
            </label>
          </div>
        </div>
      )}

      {(mapImage || grid) && (
        <>
          <div className="gm-section">
            <div className="gm-stats-row">
              <label className="gm-field gm-field--inline">
                <span>Rows</span>
                <input type="number" value={gridRows} onChange={e => setGridRows(Math.max(1, Number(e.target.value)))} style={{ width: 50 }} />
              </label>
              <label className="gm-field gm-field--inline">
                <span>Cols</span>
                <input type="number" value={gridCols} onChange={e => setGridCols(Math.max(1, Number(e.target.value)))} style={{ width: 50 }} />
              </label>
              <button className="gm-btn-small" onClick={generateGrid}>Resize Grid</button>
              <button className="gm-btn-small" onClick={() => fileInputRef.current?.click()}>Change Image</button>
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
            </div>
          </div>

          <div className="gm-section">
            <h4>Paint Tool</h4>
            <div className="gm-stats-row">
              <select value={paintMode} onChange={e => setPaintMode(e.target.value as 'terrain' | 'owner' | 'location')}>
                <option value="terrain">Terrain</option>
                <option value="owner">Owner</option>
                <option value="location">Location</option>
              </select>
              {paintMode === 'terrain' && (
                <select value={paintTerrain} onChange={e => setPaintTerrain(e.target.value)}>
                  {TERRAIN_TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              )}
              {paintMode === 'owner' && (
                <select value={paintOwner} onChange={e => setPaintOwner(e.target.value)}>
                  <option value="">No Owner</option>
                  {factions.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              )}
              {paintMode === 'location' && (
                <select value={paintLocation} onChange={e => setPaintLocation(e.target.value)}>
                  <option value="">No Location</option>
                  {locations.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {grid && (
            <div className="gm-map-container" style={{ position: 'relative', overflow: 'auto' }}>
              {mapImage && (
                <img
                  src={mapImage}
                  alt="Map"
                  style={{
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                    objectFit: 'cover', opacity: 0.3, pointerEvents: 'none',
                  }}
                />
              )}
              <div
                className="gm-map-grid"
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${grid.cols}, 40px)`,
                  gridTemplateRows: `repeat(${grid.rows}, 40px)`,
                  gap: 1,
                  position: 'relative',
                }}
              >
                {grid.cells.map((row, ri) =>
                  row.map((cell, ci) => {
                    const owner = cell.owner ? worldState.factions[cell.owner] : null;
                    const loc = cell.locationId ? worldState.locations[cell.locationId] : null;
                    return (
                      <div
                        key={`${ri}-${ci}`}
                        className="gm-map-cell"
                        style={{
                          width: 40, height: 40,
                          background: cell.color ?? TERRAIN_COLORS[cell.terrain] ?? '#888',
                          border: owner ? `2px solid ${owner.color ?? '#fff'}` : '1px solid rgba(255,255,255,0.1)',
                          cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.6rem', color: '#fff', textShadow: '0 0 2px #000',
                        }}
                        title={`${cell.terrain}${owner ? ` | ${owner.name}` : ''}${loc ? ` | ${loc.name}` : ''}`}
                        onClick={() => paintCell(ri, ci)}
                      >
                        {loc ? loc.name.charAt(0) : ''}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
