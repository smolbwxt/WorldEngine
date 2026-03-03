import type { Faction } from '../../engine/types.js';

interface Props {
  factions: Faction[];
  selected: Faction | null;
  onSelect: (faction: Faction) => void;
}

function StatBar({ value, max, className }: { value: number; max: number; className: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <span className="stat-bar">
      <span className={`stat-bar-fill ${className}`} style={{ width: `${pct}%` }} />
    </span>
  );
}

const FACTION_TYPE_LABELS: Record<string, string> = {
  empire: 'Empire',
  noble: 'Noble House',
  bandit: 'Bandits',
  goblin: 'Goblin Horde',
  merchant: 'Merchant Guild',
  town: 'Town',
  religious: 'Religious Order',
};

export default function FactionPanel({ factions, selected, onSelect }: Props) {
  return (
    <div style={{ overflow: 'auto', flex: 1, padding: '4px 0' }}>
      {factions.map(f => (
        <div
          key={f.id}
          className={`card faction-card${selected?.id === f.id ? ' selected' : ''}`}
          onClick={() => onSelect(f)}
          style={{ cursor: 'pointer' }}
        >
          <h3>{f.name}</h3>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 4 }}>
            {FACTION_TYPE_LABELS[f.type] ?? f.type} — {f.leader}
          </p>

          <div className="stat-row">
            <span className="stat">
              Power: <strong>{f.power}/{f.maxPower}</strong>
              <StatBar value={f.power} max={f.maxPower} className="power" />
            </span>
          </div>
          <div className="stat-row">
            <span className="stat">
              Morale: <strong>{f.morale}</strong>
              <StatBar value={f.morale} max={100} className="morale" />
            </span>
          </div>
          <div className="stat-row">
            <span className="stat">
              Gold: <strong>{f.gold}</strong>
              <StatBar value={f.gold} max={300} className="gold" />
            </span>
          </div>
          {f.corruption > 0 && (
            <div className="stat-row">
              <span className="stat">
                Corruption: <strong>{f.corruption}</strong>
                <StatBar value={f.corruption} max={100} className="corruption" />
              </span>
            </div>
          )}

          {f.controlledLocations.length > 0 && (
            <p style={{ fontSize: '0.7rem', marginTop: 4, color: 'var(--text-muted)' }}>
              Territory: {f.controlledLocations.length} location{f.controlledLocations.length !== 1 ? 's' : ''}
            </p>
          )}

          {f.recentActions.length > 0 && (
            <p style={{ fontSize: '0.7rem', marginTop: 2, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Last: {f.recentActions[0]}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
