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

function CharacterCard({ char, factionName, currentTurn, worldState }: { char: Character; factionName: string; currentTurn: number; worldState: WorldState }) {
  const statusStyle = STATUS_STYLES[char.status] ?? STATUS_STYLES.active;
  const isDead = char.status === 'dead';
  const turnsActive = (isDead ? (char.deathTurn ?? currentTurn) : currentTurn) - (char.activeSince ?? 0);
  const yearsActive = Math.floor(turnsActive / 4);
  const startingAbilityCount = char.abilities.filter(a => !a.gainedTurn).length;
  const earnedAbilityCount = char.abilities.length - startingAbilityCount;

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
          {char.titleHistory && char.titleHistory.length > 0 && (
            <p style={{ fontSize: '0.55rem', color: 'var(--text-muted)', margin: 0, opacity: 0.7 }}>
              formerly: {char.titleHistory[0]}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
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
          {yearsActive > 0 && (
            <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>
              {yearsActive} yr{yearsActive !== 1 ? 's' : ''} active
            </span>
          )}
        </div>
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
            {(char.timesWounded ?? 0) > 0 && <span>Wounds: {char.timesWounded}</span>}
            {char.killCount > 0 && <span>Kills: {char.killCount}</span>}
          </div>
        </>
      )}

      {isDead && char.deathCause && (
        <p style={{ fontSize: '0.65rem', color: '#8a4444', fontStyle: 'italic', marginTop: 4 }}>
          {char.deathCause} (Turn {char.deathTurn})
        </p>
      )}

      {isDead && char.lastStand && (
        <p style={{ fontSize: '0.65rem', color: '#c90', fontStyle: 'italic', marginTop: 2 }}>
          ⚔️ LAST STAND: {char.lastStand.narrative}
          {char.lastStand.flippedBattle && ' (Turned the tide!)'}
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
          {earnedAbilityCount > 0 && (
            <p style={{ fontSize: '0.55rem', color: '#c90', margin: '0 0 3px', fontWeight: 'bold' }}>
              {earnedAbilityCount} earned abilit{earnedAbilityCount !== 1 ? 'ies' : 'y'}
            </p>
          )}
          {char.abilities.map(a => (
            <div key={a.id} style={{
              fontSize: '0.6rem',
              padding: '3px 5px',
              marginTop: 2,
              background: a.gainedTurn ? 'rgba(204,153,0,0.08)' : 'rgba(255,255,255,0.04)',
              borderRadius: 3,
              borderLeft: `2px solid ${a.gainedTurn ? '#c90' : a.passive ? '#4a8' : '#c84'}`,
            }}>
              <strong>{a.name}</strong>
              {a.combatBonus ? ` (+${a.combatBonus} combat)` : ''}
              {a.moraleBonus ? ` (+${a.moraleBonus} morale)` : ''}
              {a.economyBonus ? ` (+${Math.round(a.economyBonus * 100)}% income)` : ''}
              {a.gainedTurn ? (
                <span style={{ color: '#c90', marginLeft: 4 }}>
                  [earned T{a.gainedTurn}]
                </span>
              ) : null}
              <br />
              <span style={{ color: 'var(--text-muted)' }}>{a.description}</span>
            </div>
          ))}
        </div>
      )}

      {/* Trophies */}
      {char.trophies && char.trophies.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <p style={{ fontSize: '0.55rem', color: '#c90', margin: '0 0 3px', fontWeight: 'bold' }}>
            Trophies
          </p>
          {char.trophies.map((t, i) => (
            <div key={i} style={{
              fontSize: '0.6rem', padding: '2px 5px', marginTop: 1,
              background: 'rgba(204,153,0,0.06)', borderRadius: 3,
              borderLeft: '2px solid #a80',
            }}>
              <span>🏆 {t.name}</span>
              <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>
                (+{t.combatBonus} combat, from {t.fromCharName})
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Vendettas */}
      {!isDead && char.vendettas && char.vendettas.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <p style={{ fontSize: '0.55rem', color: '#c44', margin: '0 0 3px', fontWeight: 'bold' }}>
            Vendettas
          </p>
          {char.vendettas.map((v, i) => {
            const targetName = worldState.characters[v.targetCharId]?.name ?? 'Unknown';
            const targetDead = worldState.characters[v.targetCharId]?.status === 'dead';
            return (
              <div key={i} style={{
                fontSize: '0.6rem', padding: '2px 5px', marginTop: 1,
                background: 'rgba(200,60,60,0.06)', borderRadius: 3,
                borderLeft: '2px solid #c44',
                opacity: targetDead ? 0.5 : 1,
                textDecoration: targetDead ? 'line-through' : 'none',
              }}>
                <span>🩸 vs {targetName}</span>
                <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>
                  — {v.reason}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Relationships */}
      {!isDead && char.relationships && char.relationships.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <p style={{ fontSize: '0.55rem', color: '#8af', margin: '0 0 3px', fontWeight: 'bold' }}>
            Bonds
          </p>
          {char.relationships.map((r, i) => {
            const targetName = worldState.characters[r.targetCharId]?.name ?? 'Unknown';
            const targetDead = worldState.characters[r.targetCharId]?.status === 'dead';
            const typeIcons: Record<string, string> = {
              mentor: '📖', protege: '🌱', rival: '⚡', blood_oath: '🩸', nemesis: '💀',
            };
            const typeColors: Record<string, string> = {
              mentor: '#4a8', protege: '#4a8', rival: '#c84', blood_oath: '#c4c', nemesis: '#c44',
            };
            return (
              <div key={i} style={{
                fontSize: '0.6rem', padding: '2px 5px', marginTop: 1,
                background: `${typeColors[r.type] ?? '#888'}11`, borderRadius: 3,
                borderLeft: `2px solid ${typeColors[r.type] ?? '#888'}`,
                opacity: targetDead ? 0.6 : 1,
              }}>
                <span>{typeIcons[r.type] ?? '●'} {r.type.replace('_', ' ')}: {targetName}</span>
                {targetDead && <span style={{ color: '#8a4444', marginLeft: 4 }}>(fallen)</span>}
              </div>
            );
          })}
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
          currentTurn={worldState.turn}
          worldState={worldState}
        />
      ))}
    </div>
  );
}
