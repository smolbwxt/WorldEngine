import { useState, useMemo, useCallback, useRef } from 'react';
import type { Location, WorldState } from '../../engine/types.js';
import type { PointOfInterest } from '../../engine/townmap.js';
import { generateBuildingInterior, type BuildingInterior, type InteriorTile } from '../../engine/buildings.js';
import { generateArtisticInterior, type MapGenResult } from '../../engine/mapImageGen.js';

interface Props {
  poi: PointOfInterest;
  location: Location;
  worldState: WorldState;
  onClose: () => void;
}

const TILE_COLORS: Record<string, string> = {
  floor_stone: '#3A3830', floor_wood: '#5C4A35', floor_dirt: '#3A3225',
  wall: '#2A2A28', wall_damaged: '#3A3835',
  door: '#6B5A40', door_locked: '#5A4A35',
  pillar: '#4A4A48',
  stairs_up: '#5A6A5A', stairs_down: '#3A3A4A',
  table: '#6B5030', chair: '#5A4528', counter: '#6B5A3A',
  barrel: '#5A4020', crate: '#5A4828', bookshelf: '#4A3520',
  altar: '#8A8A7A', hearth: '#8B3A10', fire_pit: '#A04010',
  acid_pool: '#2A6A30', pit_trap: '#1A1A15', collapsed_floor: '#2A2520',
  rubble: '#4A4538', water_shallow: '#2A4A6A',
  bed: '#5A4A60', chest: '#6A5A20', weapon_rack: '#4A4A5A',
  throne: '#6A5A30', cage: '#3A3A3A', sarcophagus: '#5A5A58',
};

const TILE_ICONS: Partial<Record<string, string>> = {
  door: '▯', door_locked: '▯', pillar: '●',
  stairs_up: '△', stairs_down: '▽',
  table: '▪', counter: '═', barrel: '○', crate: '□',
  bookshelf: '≡', altar: '✦', hearth: '♨', fire_pit: '🔥',
  acid_pool: '☠', pit_trap: '⚠', collapsed_floor: '✕',
  chest: '⊡', weapon_rack: '⚔', throne: '♛', cage: '⊞',
  sarcophagus: '⊟', bed: '▬',
};

type ViewMode = 'procedural' | 'artistic';

export default function BuildingInteriorView({ poi, location, worldState, onClose }: Props) {
  const interior = useMemo(() => generateBuildingInterior(poi, location.id), [poi.name, location.id]);
  const [viewMode, setViewMode] = useState<ViewMode>('procedural');
  const [artisticImage, setArtisticImage] = useState<MapGenResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [hoveredTile, setHoveredTile] = useState<InteriorTile | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [userDesc, setUserDesc] = useState('');
  const cacheRef = useRef<Map<string, MapGenResult>>(new Map());

  const cellSize = 28;
  const svgW = interior.width * cellSize;
  const svgH = interior.height * cellSize;

  const handleGenerate = useCallback(async () => {
    const cacheKey = `${poi.name}_${location.id}_${userDesc}`;
    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      setArtisticImage(cached);
      setViewMode('artistic');
      return;
    }

    setGenerating(true);
    setGenError(null);
    try {
      const result = await generateArtisticInterior(interior, location, worldState, userDesc || undefined);
      cacheRef.current.set(cacheKey, result);
      setArtisticImage(result);
      setViewMode('artistic');
    } catch (err) {
      setGenError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  }, [interior, location, worldState, poi.name, userDesc]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 style={{ margin: 0, color: 'var(--accent-gold)' }}>Interior — {poi.name}</h4>
        <button className="map-control-btn" onClick={onClose} style={{ fontSize: '0.7rem' }}>
          Back to Town
        </button>
      </div>

      {/* Description input for img2img */}
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          type="text"
          placeholder="Add to description (optional)..."
          value={userDesc}
          onChange={e => setUserDesc(e.target.value)}
          style={{
            flex: 1, padding: '4px 8px', fontSize: '0.75rem',
            background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
            borderRadius: 4, color: 'var(--text-primary)',
          }}
        />
      </div>

      {/* Controls */}
      <div className="location-art-controls">
        {artisticImage && (
          <button
            className="map-control-btn"
            onClick={() => setViewMode(v => v === 'procedural' ? 'artistic' : 'procedural')}
          >
            {viewMode === 'procedural' ? 'Artistic View' : 'Grid View'}
          </button>
        )}
        <button
          className="map-control-btn map-control-btn--generate"
          onClick={handleGenerate}
          disabled={generating}
        >
          {generating ? 'Painting...' : 'Paint Interior'}
        </button>
        {genError && <span className="map-control-error" title={genError}>Error</span>}
      </div>

      {/* Map display */}
      <div style={{
        overflow: 'auto', maxHeight: 440,
        border: '1px solid var(--border-color)', borderRadius: 6,
        background: '#1a1510', position: 'relative',
      }}>
        {generating && (
          <div className="location-generating-overlay">
            <div className="map-generating-spinner" />
            <p>Painting {poi.name}...</p>
          </div>
        )}

        {viewMode === 'artistic' && artisticImage ? (
          <img
            src={`data:${artisticImage.mimeType};base64,${artisticImage.imageBase64}`}
            alt={`Interior of ${poi.name}`}
            style={{ width: '100%', display: 'block', borderRadius: 6 }}
          />
        ) : (
          <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} style={{ display: 'block' }}>
            {interior.tiles.map((row, y) =>
              row.map((tile, x) => {
                const icon = TILE_ICONS[tile.type];
                return (
                  <g
                    key={`${x}-${y}`}
                    onMouseEnter={(e) => { setHoveredTile(tile); setTooltipPos({ x: e.clientX, y: e.clientY }); }}
                    onMouseMove={(e) => setTooltipPos({ x: e.clientX, y: e.clientY })}
                    onMouseLeave={() => setHoveredTile(null)}
                  >
                    <rect
                      x={x * cellSize} y={y * cellSize}
                      width={cellSize} height={cellSize}
                      fill={TILE_COLORS[tile.type] ?? '#2A2520'}
                      stroke="rgba(0,0,0,0.3)" strokeWidth={0.5}
                    />
                    {tile.isHazard && (
                      <rect
                        x={x * cellSize + 2} y={y * cellSize + 2}
                        width={cellSize - 4} height={cellSize - 4}
                        fill="rgba(255,50,0,0.25)" rx={2}
                      />
                    )}
                    {tile.providesCover && tile.type !== 'wall' && (
                      <rect
                        x={x * cellSize + 1} y={y * cellSize + 1}
                        width={cellSize - 2} height={cellSize - 2}
                        fill="none" stroke="rgba(100,200,255,0.3)" strokeWidth={1} rx={1}
                      />
                    )}
                    {icon && (
                      <text
                        x={x * cellSize + cellSize / 2} y={y * cellSize + cellSize / 2 + 1}
                        textAnchor="middle" dominantBaseline="middle"
                        fontSize={12} fill="rgba(255,255,255,0.6)"
                        style={{ pointerEvents: 'none' }}
                      >
                        {icon}
                      </text>
                    )}
                  </g>
                );
              })
            )}
            {/* Entry points */}
            {interior.entryPoints.map((entry, i) => (
              <rect
                key={`entry-${i}`}
                x={entry.x * cellSize + 4} y={entry.y * cellSize + 4}
                width={cellSize - 8} height={cellSize - 8}
                fill="rgba(100,255,100,0.4)" rx={3}
              />
            ))}
          </svg>
        )}
      </div>

      {/* Tooltip */}
      {hoveredTile && viewMode === 'procedural' && (
        <div className="location-tooltip" style={{ position: 'fixed', left: tooltipPos.x + 16, top: tooltipPos.y - 10 }}>
          <h4>{hoveredTile.type.replace(/_/g, ' ')}</h4>
          <p>
            {hoveredTile.passable ? 'Passable' : 'Blocked'}
            {hoveredTile.blocksLOS ? ' | Blocks LOS' : ''}
            {hoveredTile.providesCover ? ' | Cover' : ''}
            {hoveredTile.isHazard ? ` | Hazard: ${hoveredTile.hazardType} (${hoveredTile.hazardDamage} dmg)` : ''}
          </p>
        </div>
      )}

      {/* Legend */}
      {viewMode === 'procedural' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
          <span><span style={{ color: 'rgba(255,50,0,0.6)' }}>■</span> Hazard</span>
          <span><span style={{ color: 'rgba(100,200,255,0.6)' }}>□</span> Cover</span>
          <span><span style={{ color: 'rgba(100,255,100,0.6)' }}>■</span> Entry</span>
        </div>
      )}

      {/* POIs */}
      {interior.pointsOfInterest.length > 0 && (
        <div style={{ fontSize: '0.75rem' }}>
          <h4 style={{ color: 'var(--accent-gold)', marginBottom: 4 }}>Points of Interest</h4>
          {interior.pointsOfInterest.map((p, i) => (
            <div key={i} style={{ padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
              <strong style={{ color: 'var(--text-primary)' }}>{p.name}</strong> — {p.description}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
