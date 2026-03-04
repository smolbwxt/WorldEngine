import { useState, useMemo } from 'react';
import type { WorldState, Faction, Location } from '../../engine/types.js';

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

export default function WorldMap({ worldState, selectedFaction, onLocationSelect }: Props) {
  const [hoveredLoc, setHoveredLoc] = useState<Location | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const locations = Object.values(worldState.locations);

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
        {/* Background */}
        <defs>
          <radialGradient id="bg-grad">
            <stop offset="0%" stopColor="#1a2a3a" />
            <stop offset="100%" stopColor="#0d1521" />
          </radialGradient>
        </defs>
        <rect width="100" height="100" fill="url(#bg-grad)" />

        {/* Connection lines */}
        {connections.map(({ x1, y1, x2, y2, key }) => (
          <line
            key={key}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="0.3"
            strokeDasharray="1,1"
          />
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
              {/* Location dot */}
              <circle cx={loc.x} cy={loc.y} r={size} fill={color} opacity={0.85} />
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
              {/* Label */}
              <text
                x={loc.x} y={loc.y + size + 2}
                textAnchor="middle"
                fontSize="1.5"
                fill="rgba(232,213,183,0.7)"
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
