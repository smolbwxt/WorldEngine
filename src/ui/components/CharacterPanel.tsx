import type { Character, WorldState } from '../../engine/types.js';

interface Props {
  worldState: WorldState;
  selectedFactionId?: string | null;
}

const ROLE_ICONS: Record<string, string> = {
  commander: '⚔️',
  champion: '🗡️',
  spymaster: '🕵️',
  diplomat: '🤝',
  advisor: '📜',
  warchief: '💀',
};

const STATUS_STYLES: Record<string, { color: string; label: string }> = {
  active: { color: 'var(--stat-power)', label: 'Active' },
  wounded: { color: '#c4a035', label: 'Wounded' },
  captured: { color: '#8a6030', label: 'Captured' },
  dead: { color: '#6a2020', label: 'Dead' },
};

function StatPips({ value, max = 10, color }: { value: number; max?: number; color: string }) {
  return (
    <span style={{ display: 'inline-flex', gap: 1 }}>
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          style={{
            width: 5, height: 8,
            background: i < value ? color : 'rgba(255,255,255,0.08)',
            borderRadius: 1,
            display: 'inline-block',
          }}
        />
      ))}
    </span>
  );
}

function CharacterCard({ char, factionName }: { char: Character; factionName: string }) {
  const statusStyle = STATUS_STYLES[char.status] ?? STATUS_STYLES.active;
  const isDead = char.status === 'dead';

  return (
    <div
      className="card"
      style={{
        opacity: isDead ? 0.5 : 1,
        borderLeft: `3px solid ${statusStyle.color}`,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '0.85rem', textDecoration: isDead ? 'line-through' : 'none' }}>
            {ROLE_ICONS[char.role] ?? '●'} {char.name}
          </h3>
          <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', margin: '2px 0' }}>
            {char.title} — {factionName}
          </p>
        </div>
        <span style={{
          fontSize: '0.6rem',
          padding: '1px 6px',
          borderRadius: 3,
          background: statusStyle.color,
          color: '#fff',
          fontWeight: 'bold',
        }}>
          {statusStyle.label}
        </span>
      </div>

      {!isDead && (
        <>
          <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: '0.7rem' }}>
            <span title="Prowess — martial skill">
              PRW <StatPips value={char.prowess} color="#c44" />
            </span>
            <span title="Cunning — subterfuge and survival">
              CUN <StatPips value={char.cunning} color="#4a8" />
            </span>
            <span title="Authority — leadership and governance">
              AUT <StatPips value={char.authority} color="#48c" />
            </span>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 4, fontSize: '0.65rem', color: 'var(--text-muted)' }}>
            <span>Renown: {char.renown}</span>
            <span>W: {char.battlesWon} / L: {char.battlesLost}</span>
            {char.killCount > 0 && <span>Kills: {char.killCount}</span>}
          </div>
        </>
      )}

      {isDead && char.deathCause && (
        <p style={{ fontSize: '0.65rem', color: '#8a4444', fontStyle: 'italic', marginTop: 4 }}>
          {char.deathCause} (Turn {char.deathTurn})
        </p>
      )}

      <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 4, fontStyle: 'italic' }}>
        {char.description}
      </p>

      {char.traits.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
          {char.traits.map(t => (
            <span key={t} style={{
              fontSize: '0.6rem',
              padding: '1px 5px',
              background: 'rgba(255,255,255,0.06)',
              borderRadius: 3,
              color: 'var(--text-muted)',
            }}>
              {t}
            </span>
          ))}
        </div>
      )}

      {char.abilities.length > 0 && !isDead && (
        <div style={{ marginTop: 6 }}>
          {char.abilities.map(a => (
            <div key={a.id} style={{
              fontSize: '0.6rem',
              padding: '3px 5px',
              marginTop: 2,
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 3,
              borderLeft: `2px solid ${a.passive ? '#4a8' : '#c84'}`,
            }}>
              <strong>{a.name}</strong>
              {a.combatBonus ? ` (+${a.combatBonus} combat)` : ''}
              {a.moraleBonus ? ` (+${a.moraleBonus} morale)` : ''}
              <br />
              <span style={{ color: 'var(--text-muted)' }}>{a.description}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CharacterPanel({ worldState, selectedFactionId }: Props) {
  const characters = Object.values(worldState.characters ?? {});

  // Sort: alive first, then by renown descending
  const sorted = [...characters].sort((a, b) => {
    if (a.status === 'dead' && b.status !== 'dead') return 1;
    if (a.status !== 'dead' && b.status === 'dead') return -1;
    return b.renown - a.renown;
  });

  // Filter by faction if selected
  const filtered = selectedFactionId
    ? sorted.filter(c => c.factionId === selectedFactionId)
    : sorted;

  const alive = filtered.filter(c => c.status !== 'dead').length;
  const dead = filtered.filter(c => c.status === 'dead').length;

  return (
    <div style={{ overflow: 'auto', flex: 1, padding: '4px 0' }}>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', padding: '4px 8px' }}>
        {alive} active{dead > 0 ? ` / ${dead} fallen` : ''}
        {selectedFactionId && (
          <span> — showing {worldState.factions[selectedFactionId]?.name ?? 'faction'}</span>
        )}
      </div>
      {filtered.map(char => (
        <CharacterCard
          key={char.id}
          char={char}
          factionName={worldState.factions[char.factionId]?.name ?? 'Unknown'}
        />
      ))}
    </div>
  );
}
