import { useState, useMemo, useCallback, useRef } from 'react';
import type { Location, WorldState } from '../../engine/types.js';
import { generateTownMap, type TownMap, type Tile, type TileType, type PointOfInterest } from '../../engine/townmap.js';
import { generateArtisticLocation, type MapGenResult } from '../../engine/mapImageGen.js';
import BuildingInteriorView from './BuildingInteriorView.js';

// Module-level cache so generated art survives component unmount/remount
const townArtCache = new Map<string, MapGenResult>();

interface Props {
  location: Location;
  worldState: WorldState;
}

// Color palette per tile type
const TILE_COLORS: Record<TileType, string> = {
  road:             '#8B7355',
  building:         '#6B4C3B',
  market:           '#B8860B',
  tavern:           '#8B4513',
  temple:           '#D4C5A9',
  wall:             '#4A4A4A',
  gate:             '#7B6B4F',
  water:            '#2E5090',
  park:             '#3A6B35',
  ruins:            '#5C5040',
  tower:            '#5A5A6A',
  barracks:         '#5B3A29',
  warehouse:        '#6B5B4F',
  residential:      '#7B5B43',
  well:             '#4A7A8C',
  bridge:           '#8B7B6B',
  field:            '#6B8E3A',
  empty:            '#2A2520',
  keep:             '#6B6B8B',
  mine_entrance:    '#3A3A2A',
  smithy:           '#8B4500',
  stable:           '#6B5030',
  inn:              '#7B5A3A',
  graveyard:        '#3A4A3A',
  dungeon_entrance: '#1A1A2E',
};

const TILE_ICONS: Partial<Record<TileType, string>> = {
  gate:             '▯',
  well:             '◉',
  tavern:           '⌂',
  temple:           '✝',
  market:           '⊞',
  tower:            '▲',
  keep:             '★',
  barracks:         '⚔',
  smithy:           '⚒',
  stable:           '🐴',
  inn:              '⌂',
  warehouse:        '⊟',
  mine_entrance:    '⛏',
  graveyard:        '✟',
  dungeon_entrance: '▽',
  ruins:            '△',
  residential:      '·',
  building:         '·',
};

type ViewMode = 'procedural' | 'artistic';

export default function TownMapView({ location, worldState }: Props) {
  const townMap = useMemo(() => generateTownMap(location), [location.id]);
  const [hoveredPOI, setHoveredPOI] = useState<PointOfInterest | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    townArtCache.has(location.id) ? 'artistic' : 'procedural'
  );
  const [artisticImage, setArtisticImage] = useState<MapGenResult | null>(
    townArtCache.get(location.id) ?? null
  );
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [selectedPOI, setSelectedPOI] = useState<PointOfInterest | null>(null);
  const [userDesc, setUserDesc] = useState('');

  // Restore cached image when switching locations
  const prevLocId = useRef(location.id);
  if (prevLocId.current !== location.id) {
    prevLocId.current = location.id;
    const cached = townArtCache.get(location.id);
    if (cached) {
      if (cached !== artisticImage) setArtisticImage(cached);
      if (viewMode !== 'artistic') setViewMode('artistic');
    } else {
      if (artisticImage) setArtisticImage(null);
      if (viewMode !== 'procedural') setViewMode('procedural');
    }
  }

  const cellSize = 20;
  const svgW = townMap.width * cellSize;
  const svgH = townMap.height * cellSize;

  // Build a set of POI coordinates for quick lookup
  const poiMap = useMemo(() => {
    const map = new Map<string, PointOfInterest>();
    for (const poi of townMap.pointsOfInterest) {
      map.set(`${poi.x},${poi.y}`, poi);
    }
    return map;
  }, [townMap]);

  const handleGenerate = useCallback(async () => {
    const cacheKey = `${location.id}_${userDesc}`;
    const cached = townArtCache.get(cacheKey);
    if (cached) {
      setArtisticImage(cached);
      setViewMode('artistic');
      return;
    }

    setGenerating(true);
    setGenError(null);

    try {
      const result = await generateArtisticLocation(townMap, location, worldState, userDesc || undefined);
      townArtCache.set(cacheKey, result);
      if (!userDesc) townArtCache.set(location.id, result);
      setArtisticImage(result);
      setViewMode('artistic');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setGenError(msg);
      console.error('Location image generation failed:', msg);
    } finally {
      setGenerating(false);
    }
  }, [location, townMap, worldState, userDesc]);

  // If a POI is selected, show its interior
  if (selectedPOI) {
    return (
      <BuildingInteriorView
        poi={selectedPOI}
        location={location}
        worldState={worldState}
        onClose={() => setSelectedPOI(null)}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Description input */}
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
            {viewMode === 'procedural' ? 'Artistic View' : 'Tile View'}
          </button>
        )}
        <button
          className="map-control-btn map-control-btn--generate"
          onClick={handleGenerate}
          disabled={generating}
        >
          {generating ? 'Painting...' : 'Paint This Location'}
        </button>
        {genError && <span className="map-control-error" title={genError}>Error</span>}
      </div>

      {/* Map display */}
      <div style={{
        border: '1px solid var(--border-color)',
        borderRadius: 6,
        background: '#1a1510',
        position: 'relative',
      }}>
        {/* Generating overlay */}
        {generating && (
          <div className="location-generating-overlay">
            <div className="map-generating-spinner" />
            <p>Painting {location.name}...</p>
          </div>
        )}

        {viewMode === 'artistic' && artisticImage ? (
          /* Artistic image */
          <img
            src={`data:${artisticImage.mimeType};base64,${artisticImage.imageBase64}`}
            alt={`Artistic view of ${location.name}`}
            style={{
              width: '100%',
              display: 'block',
              borderRadius: 6,
            }}
          />
        ) : (
          /* Procedural tile map */
          <svg
            viewBox={`0 0 ${svgW} ${svgH}`}
            style={{ display: 'block', width: '100%', height: 'auto' }}
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Tiles */}
            {townMap.tiles.map((row, y) =>
              row.map((tile, x) => {
                const poi = poiMap.get(`${x},${y}`);
                const icon = TILE_ICONS[tile.type];
                return (
                  <g
                    key={`${x}-${y}`}
                    style={poi ? { cursor: 'pointer' } : undefined}
                    onClick={() => { if (poi) setSelectedPOI(poi); }}
                    onMouseEnter={(e) => {
                      if (poi) {
                        setHoveredPOI(poi);
                        setTooltipPos({ x: e.clientX, y: e.clientY });
                      }
                    }}
                    onMouseMove={(e) => {
                      if (poi) setTooltipPos({ x: e.clientX, y: e.clientY });
                    }}
                    onMouseLeave={() => setHoveredPOI(null)}
                  >
                    <rect
                      x={x * cellSize}
                      y={y * cellSize}
                      width={cellSize}
                      height={cellSize}
                      fill={TILE_COLORS[tile.type]}
                      stroke="rgba(0,0,0,0.3)"
                      strokeWidth={0.5}
                    />
                    {poi && (
                      <rect
                        x={x * cellSize}
                        y={y * cellSize}
                        width={cellSize}
                        height={cellSize}
                        fill="none"
                        stroke="var(--accent-gold)"
                        strokeWidth={1.5}
                        rx={2}
                      />
                    )}
                    {icon && (
                      <text
                        x={x * cellSize + cellSize / 2}
                        y={y * cellSize + cellSize / 2 + 1}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize={tile.type === 'residential' || tile.type === 'building' ? 8 : 11}
                        fill="rgba(255,255,255,0.7)"
                        style={{ pointerEvents: 'none' }}
                      >
                        {icon}
                      </text>
                    )}
                  </g>
                );
              })
            )}

            {/* District labels */}
            {townMap.districts.map((d, i) => (
              <text
                key={i}
                x={(d.x + d.w / 2) * cellSize}
                y={(d.y - 0.3) * cellSize}
                textAnchor="middle"
                fontSize={9}
                fill="rgba(232,213,183,0.5)"
                fontStyle="italic"
                style={{ pointerEvents: 'none' }}
              >
                {d.name}
              </text>
            ))}
          </svg>
        )}
      </div>

      {/* Tooltip */}
      {hoveredPOI && viewMode === 'procedural' && (
        <div
          className="location-tooltip"
          style={{
            position: 'fixed',
            left: tooltipPos.x + 16,
            top: tooltipPos.y - 10,
          }}
        >
          <h4>{hoveredPOI.name}</h4>
          <p>{hoveredPOI.description}</p>
        </div>
      )}

      {/* Legend — only show in procedural view */}
      {viewMode === 'procedural' && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px 14px',
          fontSize: '0.7rem',
          color: 'var(--text-muted)',
          padding: '4px 0',
        }}>
          {([
            ['road', 'Road'], ['residential', 'Building'], ['market', 'Market'],
            ['tavern', 'Tavern/Inn'], ['temple', 'Temple'], ['wall', 'Wall'],
            ['gate', 'Gate'], ['keep', 'Keep'], ['barracks', 'Barracks'],
            ['park', 'Garden'], ['well', 'Well/Fountain'], ['ruins', 'Ruins'],
          ] as [TileType, string][]).map(([type, label]) => (
            <span key={type} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{
                width: 10, height: 10,
                background: TILE_COLORS[type],
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 2,
                display: 'inline-block',
              }} />
              {label}
            </span>
          ))}
        </div>
      )}

      {/* Points of Interest list */}
      <div style={{ fontSize: '0.8rem' }}>
        <h4 style={{ color: 'var(--accent-gold)', marginBottom: 6 }}>Points of Interest</h4>
        {townMap.pointsOfInterest
          .filter(p => p.description)
          .map((poi, i) => (
          <div
            key={i}
            style={{
              padding: '4px 0',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
            onClick={() => setSelectedPOI(poi)}
          >
            <strong style={{ color: 'var(--text-primary)' }}>{poi.name}</strong>
            {' — '}
            {poi.description}
            <span style={{ fontSize: '0.65rem', color: 'var(--accent-gold)', marginLeft: 6 }}>Enter →</span>
          </div>
        ))}
      </div>
    </div>
  );
}
