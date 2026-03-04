import { useState, useMemo } from 'react';
import type { WorldState, Faction, Location } from '../../engine/types.js';
import { generateTerrain, TERRAIN_COLORS, type TerrainMap } from '../../engine/terrain.js';

interface Props {
  worldState: WorldState;
  selectedFaction: Faction | null;
  onLocationSelect: (loc: Location) => void;
}

const FACTION_COLORS: Record<string, string> = {
  aurelian_crown: '#d4a843',
  house_valdris: '#8e44ad',
  house_thorne: '#27ae60',
  iron_fang: '#c0392b',
  red_wolves: '#e67e22',
  greentusk_horde: '#16a085',
  silver_road_guild: '#7f8c8d',
};

const LOCATION_ICONS: Record<string, string> = {
  capital: '★',
  fortress: '⬣',
  castle: '◆',
  town: '●',
  village: '○',
  ruins: '△',
  lair: '▽',
  temple: '✝',
  mine: '⛏',
  tower: '▲',
  dungeon: '◈',
};

function getControllingFaction(locId: string, state: WorldState): string | null {
  for (const f of Object.values(state.factions)) {
    if (f.controlledLocations.includes(locId)) return f.id;
  }
  return null;
}

// Generate decorative features (trees, mountains, waves) as SVG elements
function TerrainDecorations({ terrain }: { terrain: TerrainMap }) {
  const decorations: JSX.Element[] = [];
  const cs = terrain.cellSize;
  let key = 0;

  for (let gy = 0; gy < terrain.height; gy++) {
    for (let gx = 0; gx < terrain.width; gx++) {
      const cell = terrain.cells[gy][gx];
      const cx = gx * cs + cs / 2;
      const cy = gy * cs + cs / 2;

      // Trees in forests (sparse placement for performance)
      if ((cell.terrain === 'forest' || cell.terrain === 'dense_forest') && (gx + gy) % 3 === 0) {
        const treeSize = cell.terrain === 'dense_forest' ? 0.7 : 0.55;
        decorations.push(
          <g key={key++} opacity={0.35}>
            <circle cx={cx} cy={cy - 0.2} r={treeSize} fill="#1a3010" />
            <line x1={cx} y1={cy - 0.2 + treeSize * 0.4} x2={cx} y2={cy + 0.4} stroke="#2a1a0a" strokeWidth={0.15} />
          </g>
        );
      }

      // Mountain peaks
      if (cell.terrain === 'mountains' && (gx + gy) % 2 === 0) {
        decorations.push(
          <g key={key++} opacity={0.4}>
            <polygon
              points={`${cx},${cy - 1} ${cx - 0.7},${cy + 0.4} ${cx + 0.7},${cy + 0.4}`}
              fill="#5a5855"
              stroke="#6a6865"
              strokeWidth={0.1}
            />
            <polygon
              points={`${cx},${cy - 1} ${cx - 0.25},${cy - 0.4} ${cx + 0.25},${cy - 0.4}`}
              fill="#787874"
            />
          </g>
        );
      }

      // Snow caps
      if (cell.terrain === 'snow' && (gx + gy) % 2 === 0) {
        decorations.push(
          <g key={key++} opacity={0.45}>
            <polygon
              points={`${cx},${cy - 1.1} ${cx - 0.8},${cy + 0.3} ${cx + 0.8},${cy + 0.3}`}
              fill="#6a6a68"
              stroke="#7a7a78"
              strokeWidth={0.1}
            />
            <polygon
              points={`${cx},${cy - 1.1} ${cx - 0.35},${cy - 0.35} ${cx + 0.35},${cy - 0.35}`}
              fill="#8a8a88"
            />
          </g>
        );
      }

      // Hills (small bumps)
      if (cell.terrain === 'hills' && (gx + gy) % 3 === 0) {
        decorations.push(
          <g key={key++} opacity={0.25}>
            <ellipse cx={cx} cy={cy} rx={0.8} ry={0.4} fill="#5a5340" />
            <ellipse cx={cx} cy={cy - 0.1} rx={0.6} ry={0.3} fill="#625a45" />
          </g>
        );
      }

      // Wave marks in water
      if (cell.terrain === 'deep_water' && gx % 4 === 0 && gy % 4 === 0) {
        decorations.push(
          <g key={key++} opacity={0.15}>
            <path
              d={`M${cx - 0.6},${cy} Q${cx - 0.3},${cy - 0.3} ${cx},${cy} Q${cx + 0.3},${cy + 0.3} ${cx + 0.6},${cy}`}
              fill="none"
              stroke="#3a5a7a"
              strokeWidth={0.15}
            />
          </g>
        );
      }

      // Swamp reeds
      if (cell.terrain === 'swamp' && (gx + gy * 3) % 4 === 0) {
        decorations.push(
          <g key={key++} opacity={0.3}>
            <line x1={cx - 0.3} y1={cy + 0.3} x2={cx - 0.2} y2={cy - 0.5} stroke="#3a4a2a" strokeWidth={0.12} />
            <line x1={cx + 0.1} y1={cy + 0.3} x2={cx + 0.2} y2={cy - 0.4} stroke="#3a4a2a" strokeWidth={0.12} />
          </g>
        );
      }

      // Moor tufts
      if (cell.terrain === 'moor' && (gx * 2 + gy) % 5 === 0) {
        decorations.push(
          <g key={key++} opacity={0.2}>
            <circle cx={cx} cy={cy} r={0.3} fill="#4a4530" />
          </g>
        );
      }
    }
  }

  return <>{decorations}</>;
}

// Render rivers as smooth SVG paths
function RiverPaths({ terrain }: { terrain: TerrainMap }) {
  const cs = terrain.cellSize;

  return (
    <>
      {terrain.rivers.map((path, i) => {
        if (path.length < 2) return null;
        const points = path.map(p => ({
          x: p.x * cs + cs / 2,
          y: p.y * cs + cs / 2,
        }));

        // Build smooth path
        let d = `M${points[0].x},${points[0].y}`;
        for (let j = 1; j < points.length; j++) {
          const prev = points[j - 1];
          const curr = points[j];
          const mx = (prev.x + curr.x) / 2;
          const my = (prev.y + curr.y) / 2;
          d += ` Q${prev.x},${prev.y} ${mx},${my}`;
        }
        const last = points[points.length - 1];
        d += ` L${last.x},${last.y}`;

        // River widens as it flows
        return (
          <g key={i}>
            <path d={d} fill="none" stroke="#0e2035" strokeWidth={1.2} strokeLinecap="round" opacity={0.5} />
            <path d={d} fill="none" stroke={TERRAIN_COLORS.river} strokeWidth={0.7} strokeLinecap="round" opacity={0.8} />
          </g>
        );
      })}
    </>
  );
}

export default function WorldMap({ worldState, selectedFaction, onLocationSelect }: Props) {
  const [hoveredLoc, setHoveredLoc] = useState<Location | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const locations = Object.values(worldState.locations);

  // Generate terrain (deterministic, memoized)
  const terrain = useMemo(
    () => generateTerrain(locations, worldState.turn ?? 42),
    [locations.length],
  );

  // Build connection lines
  const connections = useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number; key: string }[] = [];
    const seen = new Set<string>();
    for (const loc of locations) {
      for (const adjId of loc.connectedTo) {
        const pair = [loc.id, adjId].sort().join('-');
        if (seen.has(pair)) continue;
        seen.add(pair);
        const adj = worldState.locations[adjId];
        if (adj) {
          lines.push({
            x1: loc.x, y1: loc.y,
            x2: adj.x, y2: adj.y,
            key: pair,
          });
        }
      }
    }
    return lines;
  }, [locations, worldState.locations]);

  return (
    <div className="world-map">
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
        {/* Terrain base layer */}
        {terrain.cells.map((row, gy) =>
          row.map((cell, gx) => (
            <rect
              key={`t${gx}-${gy}`}
              x={gx * terrain.cellSize}
              y={gy * terrain.cellSize}
              width={terrain.cellSize}
              height={terrain.cellSize}
              fill={TERRAIN_COLORS[cell.terrain]}
            />
          ))
        )}

        {/* Terrain decorations (trees, mountains, waves) */}
        <TerrainDecorations terrain={terrain} />

        {/* Rivers */}
        <RiverPaths terrain={terrain} />

        {/* Road connections between locations */}
        {connections.map(({ x1, y1, x2, y2, key }) => (
          <g key={key}>
            <line
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="rgba(120,100,70,0.25)"
              strokeWidth="0.5"
              strokeLinecap="round"
            />
            <line
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="rgba(180,160,120,0.15)"
              strokeWidth="0.25"
              strokeDasharray="0.8,0.6"
              strokeLinecap="round"
            />
          </g>
        ))}

        {/* Location markers */}
        {locations.map(loc => {
          const controllerId = getControllingFaction(loc.id, worldState);
          const color = controllerId ? FACTION_COLORS[controllerId] ?? '#888' : '#555';
          const isSelected = selectedFaction?.controlledLocations.includes(loc.id);
          const size = loc.type === 'capital' ? 2.5 :
            loc.type === 'fortress' || loc.type === 'castle' ? 2 :
            loc.type === 'town' ? 1.8 : 1.3;

          return (
            <g
              key={loc.id}
              style={{ cursor: 'pointer' }}
              onClick={() => onLocationSelect(loc)}
              onMouseEnter={(e) => {
                setHoveredLoc(loc);
                const svg = e.currentTarget.closest('svg')!;
                const rect = svg.getBoundingClientRect();
                setTooltipPos({
                  x: (loc.x / 100) * rect.width + rect.left,
                  y: (loc.y / 100) * rect.height + rect.top - 10,
                });
              }}
              onMouseLeave={() => setHoveredLoc(null)}
            >
              {/* Glow for selected faction */}
              {isSelected && (
                <circle cx={loc.x} cy={loc.y} r={size + 1} fill="none" stroke={color} strokeWidth="0.3" opacity="0.6">
                  <animate attributeName="r" values={`${size + 0.5};${size + 1.5};${size + 0.5}`} dur="2s" repeatCount="indefinite" />
                </circle>
              )}
              {/* Shadow under marker */}
              <circle cx={loc.x + 0.2} cy={loc.y + 0.2} r={size} fill="rgba(0,0,0,0.4)" />
              {/* Location dot */}
              <circle cx={loc.x} cy={loc.y} r={size} fill={color} opacity={0.9} />
              <circle cx={loc.x} cy={loc.y} r={size - 0.3} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.15" />
              {/* Icon */}
              <text
                x={loc.x} y={loc.y + 0.4}
                textAnchor="middle"
                fontSize={size * 0.8}
                fill="white"
                style={{ pointerEvents: 'none' }}
              >
                {LOCATION_ICONS[loc.type] ?? '●'}
              </text>
              {/* Label with backdrop */}
              <text
                x={loc.x} y={loc.y + size + 2}
                textAnchor="middle"
                fontSize="1.5"
                fill="rgba(0,0,0,0.5)"
                style={{ pointerEvents: 'none' }}
              >
                {loc.name}
              </text>
              <text
                x={loc.x} y={loc.y + size + 2}
                textAnchor="middle"
                fontSize="1.5"
                fill="rgba(232,213,183,0.8)"
                style={{ pointerEvents: 'none' }}
              >
                {loc.name}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {hoveredLoc && (
        <div
          className="location-tooltip"
          style={{
            left: tooltipPos.x + 15,
            top: tooltipPos.y,
            position: 'fixed',
          }}
        >
          <h4>{hoveredLoc.name}</h4>
          <p>{hoveredLoc.description}</p>
          <div className="stat-row" style={{ marginTop: 6 }}>
            <span className="stat">Pop: <strong>{hoveredLoc.population}</strong></span>
            <span className="stat">Def: <strong>{hoveredLoc.defense}</strong></span>
            <span className="stat">Prosp: <strong>{hoveredLoc.prosperity}</strong></span>
          </div>
        </div>
      )}
    </div>
  );
}
