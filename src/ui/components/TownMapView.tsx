import { useState, useMemo } from 'react';
import type { Location } from '../../engine/types.js';
import { generateTownMap, type TownMap, type Tile, type TileType, type PointOfInterest } from '../../engine/townmap.js';

interface Props {
  location: Location;
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

export default function TownMapView({ location }: Props) {
  const townMap = useMemo(() => generateTownMap(location), [location.id]);
  const [hoveredPOI, setHoveredPOI] = useState<PointOfInterest | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Map */}
      <div style={{
        overflow: 'auto',
        maxHeight: 440,
        border: '1px solid var(--border-color)',
        borderRadius: 6,
        background: '#1a1510',
      }}>
        <svg
          width={svgW}
          height={svgH}
          viewBox={`0 0 ${svgW} ${svgH}`}
          style={{ display: 'block' }}
        >
          {/* Tiles */}
          {townMap.tiles.map((row, y) =>
            row.map((tile, x) => {
              const poi = poiMap.get(`${x},${y}`);
              const icon = TILE_ICONS[tile.type];
              return (
                <g
                  key={`${x}-${y}`}
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
      </div>

      {/* Tooltip */}
      {hoveredPOI && (
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

      {/* Legend */}
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

      {/* Points of Interest list */}
      <div style={{ fontSize: '0.8rem' }}>
        <h4 style={{ color: 'var(--accent-gold)', marginBottom: 6 }}>Points of Interest</h4>
        {townMap.pointsOfInterest
          .filter(p => p.description)
          .map((poi, i) => (
          <div key={i} style={{
            padding: '4px 0',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            color: 'var(--text-secondary)',
          }}>
            <strong style={{ color: 'var(--text-primary)' }}>{poi.name}</strong>
            {' — '}
            {poi.description}
          </div>
        ))}
      </div>
    </div>
  );
}
