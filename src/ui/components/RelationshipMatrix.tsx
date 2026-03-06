import type { WorldState, Faction } from '../../engine/types.js';

interface Props {
  worldState: WorldState;
  onFactionSelect?: (faction: Faction) => void;
}

/** Map relationship value to a color */
function relationColor(value: number): string {
  if (value >= 60) return '#2a8' ;   // strong ally — green
  if (value >= 30) return '#4a8';    // friendly — light green
  if (value >= 10) return '#486';    // warm — teal
  if (value >= -10) return '#555';   // neutral — gray
  if (value >= -30) return '#864';   // cool — amber
  if (value >= -60) return '#a64';   // hostile — orange
  return '#c44';                     // war — red
}

/** Map relationship value to a label */
function relationLabel(value: number): string {
  if (value >= 60) return 'Allied';
  if (value >= 30) return 'Friendly';
  if (value >= 10) return 'Warm';
  if (value >= -10) return 'Neutral';
  if (value >= -30) return 'Cool';
  if (value >= -60) return 'Hostile';
  return 'War';
}

/** Short faction name for the grid */
function shortName(faction: Faction): string {
  const name = faction.name;
  // Remove common prefixes
  if (name.startsWith('The ')) return name.slice(4, 16);
  if (name.startsWith('House ')) return name.slice(6, 16);
  return name.slice(0, 14);
}

export default function RelationshipMatrix({ worldState, onFactionSelect }: Props) {
  const factions = Object.values(worldState.factions);

  // Count diplomatic states
  const allies = new Set<string>();
  const enemies = new Set<string>();
  for (const f of factions) {
    for (const a of f.alliances) allies.add(`${f.id}-${a}`);
    for (const e of f.enemies) enemies.add(`${f.id}-${e}`);
  }

  return (
    <div style={{ overflow: 'auto', flex: 1, padding: '4px' }}>
      {/* Legend */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', fontSize: '0.6rem' }}>
        {[
          { label: 'Allied', color: '#2a8' },
          { label: 'Friendly', color: '#4a8' },
          { label: 'Neutral', color: '#555' },
          { label: 'Hostile', color: '#a64' },
          { label: 'War', color: '#c44' },
        ].map(l => (
          <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ width: 8, height: 8, background: l.color, borderRadius: 2, display: 'inline-block' }} />
            {l.label}
          </span>
        ))}
      </div>

      {/* Matrix grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `90px repeat(${factions.length}, 1fr)`,
        gap: 1,
        fontSize: '0.6rem',
      }}>
        {/* Header row */}
        <div />
        {factions.map(f => (
          <div
            key={`h-${f.id}`}
            style={{
              padding: '3px 2px',
              textAlign: 'center',
              fontWeight: 'bold',
              fontSize: '0.55rem',
              writingMode: 'vertical-lr',
              transform: 'rotate(180deg)',
              minHeight: 60,
              cursor: 'pointer',
            }}
            onClick={() => onFactionSelect?.(f)}
            title={f.name}
          >
            {shortName(f)}
          </div>
        ))}

        {/* Data rows */}
        {factions.map(row => (
          <>
            <div
              key={`r-${row.id}`}
              style={{
                padding: '4px 4px',
                fontWeight: 'bold',
                fontSize: '0.6rem',
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
              onClick={() => onFactionSelect?.(row)}
              title={row.name}
            >
              {shortName(row)}
            </div>
            {factions.map(col => {
              if (row.id === col.id) {
                return (
                  <div
                    key={`${row.id}-${col.id}`}
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.7rem',
                    }}
                  >
                    —
                  </div>
                );
              }

              const value = row.relationships[col.id] ?? 0;
              const isAllied = row.alliances.includes(col.id);
              const isEnemy = row.enemies.includes(col.id);
              const color = relationColor(value);

              return (
                <div
                  key={`${row.id}-${col.id}`}
                  title={`${row.name} → ${col.name}: ${value} (${relationLabel(value)})${isAllied ? ' [ALLIED]' : ''}${isEnemy ? ' [ENEMIES]' : ''}`}
                  style={{
                    background: color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 2,
                    borderRadius: 2,
                    color: '#fff',
                    fontWeight: 'bold',
                    fontSize: '0.6rem',
                    minHeight: 24,
                    position: 'relative',
                  }}
                >
                  {value}
                  {isAllied && (
                    <span style={{ position: 'absolute', top: 0, right: 1, fontSize: '0.5rem' }}>
                      🤝
                    </span>
                  )}
                  {isEnemy && (
                    <span style={{ position: 'absolute', top: 0, right: 1, fontSize: '0.5rem' }}>
                      ⚔️
                    </span>
                  )}
                </div>
              );
            })}
          </>
        ))}
      </div>

      {/* Active treaties */}
      {worldState.activeTreaties.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <h4 style={{ margin: '0 0 4px', fontSize: '0.7rem' }}>Active Treaties</h4>
          {worldState.activeTreaties.map(t => {
            const a = worldState.factions[t.parties[0]];
            const b = worldState.factions[t.parties[1]];
            return (
              <div key={t.id} style={{
                fontSize: '0.6rem',
                padding: '3px 5px',
                marginTop: 2,
                background: 'rgba(255,255,255,0.04)',
                borderRadius: 3,
                borderLeft: '2px solid #4a8',
              }}>
                <strong>{a?.name ?? t.parties[0]}</strong> ↔ <strong>{b?.name ?? t.parties[1]}</strong>
                {' — '}{t.type.replace(/_/g, ' ')}
                {t.terms.duration > 0 && ` (${t.terms.duration} turns left)`}
                {t.terms.goldPerTurn ? ` · ${t.terms.goldPerTurn}g/turn` : ''}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
