import { useState } from 'react';
import type { WorldState, PendingTurn, PendingAction, WorldEvent, FactionAction, CharacterVendetta, CharacterTrophy } from '../../engine/types.js';
import { gmKillCharacter, gmEditCharacter } from '../../engine/gm-actions.js';

interface InterventionPanelProps {
  worldState: WorldState;
  pending: PendingTurn;
  onExecute: (pending: PendingTurn, updatedState: WorldState) => void;
  onCancel: () => void;
}

type PlayerActionType = 'kill_character' | 'wound_character' | 'create_vendetta' | 'steal_artifact' | 'boost_faction' | 'custom_event';

interface PlayerIntervention {
  id: string;
  type: PlayerActionType;
  description: string;
  apply: (state: WorldState, pending: PendingTurn) => void;
}

const ACTION_TYPE_LABELS: Record<string, string> = {
  raid: 'Raid',
  recruit: 'Recruit',
  fortify: 'Fortify',
  patrol: 'Patrol',
  collect_taxes: 'Tax',
  scheme: 'Scheme',
  seek_alliance: 'Alliance',
  invest: 'Invest',
  bribe: 'Bribe',
  expand: 'Expand',
  hire_mercenaries: 'Hire Mercs',
  reform: 'Reform',
  trade: 'Trade',
  lay_low: 'Lay Low',
  propose_treaty: 'Treaty',
};

const ACTION_ICONS: Record<string, string> = {
  raid: '⚔️', recruit: '🛡️', fortify: '🏰', patrol: '👁️',
  collect_taxes: '💰', scheme: '🗡️', seek_alliance: '🤝', invest: '📈',
  bribe: '💎', expand: '🏴', hire_mercenaries: '⚔️', reform: '📜',
  trade: '🪙', lay_low: '🏕️', propose_treaty: '📜',
};

export default function InterventionPanel({ worldState, pending, onExecute, onCancel }: InterventionPanelProps) {
  const [actions, setActions] = useState<PendingAction[]>(pending.actions);
  const [interventions, setInterventions] = useState<PlayerIntervention[]>([]);
  const [injectedEvents, setInjectedEvents] = useState<WorldEvent[]>(pending.injectedEvents);

  // Player action builder state
  const [showActionBuilder, setShowActionBuilder] = useState(false);
  const [actionType, setActionType] = useState<PlayerActionType>('kill_character');
  const [targetCharId, setTargetCharId] = useState('');
  const [targetFactionId, setTargetFactionId] = useState('');
  const [vendettaReason, setVendettaReason] = useState('');
  const [customEventText, setCustomEventText] = useState('');
  const [artifactName, setArtifactName] = useState('');
  const [boostStat, setBoostStat] = useState<'power' | 'gold' | 'morale'>('power');
  const [boostAmount, setBoostAmount] = useState(10);

  const characters = Object.values(worldState.characters ?? {}).filter(c => c.status !== 'dead');
  const factions = Object.values(worldState.factions);
  const locations = Object.values(worldState.locations);

  const toggleAction = (index: number) => {
    setActions(prev => prev.map((a, i) =>
      i === index ? { ...a, enabled: !a.enabled } : a
    ));
  };

  const setActionNote = (index: number, note: string) => {
    setActions(prev => prev.map((a, i) =>
      i === index ? { ...a, playerNote: note || undefined } : a
    ));
  };

  const getActionTarget = (action: FactionAction): string => {
    if ('targetLocationId' in action && action.targetLocationId) {
      const loc = worldState.locations[action.targetLocationId];
      return loc ? loc.name : action.targetLocationId;
    }
    if ('targetFactionId' in action && action.targetFactionId) {
      const fac = worldState.factions[action.targetFactionId];
      return fac ? fac.name : action.targetFactionId;
    }
    if ('locationId' in action && action.locationId) {
      const loc = worldState.locations[action.locationId];
      return loc ? loc.name : action.locationId;
    }
    return '';
  };

  const addIntervention = () => {
    const id = `intervention_${Date.now()}`;
    let desc = '';

    const intervention: PlayerIntervention = {
      id,
      type: actionType,
      description: '',
      apply: () => {},
    };

    switch (actionType) {
      case 'kill_character': {
        const char = worldState.characters?.[targetCharId];
        if (!char) return;
        desc = `Player kills ${char.name}`;
        intervention.description = desc;
        intervention.apply = (state, pend) => {
          if (state.characters[targetCharId]) {
            gmKillCharacter(state, targetCharId, 'Slain by player character intervention');
          }
        };
        break;
      }
      case 'wound_character': {
        const char = worldState.characters?.[targetCharId];
        if (!char) return;
        desc = `Player wounds ${char.name}`;
        intervention.description = desc;
        intervention.apply = (state) => {
          const c = state.characters[targetCharId];
          if (c && c.status !== 'dead') {
            c.status = 'wounded';
            c.woundedUntilTurn = state.turn + 2;
            c.timesWounded = (c.timesWounded ?? 0) + 1;
          }
        };
        break;
      }
      case 'create_vendetta': {
        const char = worldState.characters?.[targetCharId];
        if (!char || !vendettaReason.trim()) return;
        desc = `Vendetta: ${char.name} — "${vendettaReason}"`;
        intervention.description = desc;
        intervention.apply = (state) => {
          const c = state.characters[targetCharId];
          if (c) {
            const vendetta: CharacterVendetta = {
              targetCharId: 'player',
              reason: vendettaReason,
              createdTurn: state.turn,
            };
            c.vendettas = [...(c.vendettas || []), vendetta];
            // Boost renown — this person now has a personal grudge, making them important
            c.renown = Math.min(100, (c.renown ?? 0) + 15);
          }
        };
        break;
      }
      case 'steal_artifact': {
        const char = worldState.characters?.[targetCharId];
        if (!char || !artifactName.trim()) return;
        desc = `Player steals "${artifactName}" from ${char.name}`;
        intervention.description = desc;
        intervention.apply = (state, pend) => {
          const c = state.characters[targetCharId];
          if (c) {
            // Remove a trophy if they have one matching, or create a vendetta
            const trophyIdx = c.trophies?.findIndex(t => t.name.toLowerCase().includes(artifactName.toLowerCase()));
            if (trophyIdx !== undefined && trophyIdx >= 0 && c.trophies) {
              c.trophies.splice(trophyIdx, 1);
            }
            // Stealing creates a vendetta against the player
            c.vendettas = [...(c.vendettas || []), {
              targetCharId: 'player',
              reason: `Stole ${artifactName}`,
              createdTurn: state.turn,
            }];
            c.renown = Math.min(100, (c.renown ?? 0) + 10);
            // Create a chronicle event
            pend.injectedEvents.push({
              id: `steal_${id}`,
              turn: state.turn, season: state.season, year: state.year,
              type: 'story_hook',
              text: `[Player] A daring theft — "${artifactName}" is stolen from ${c.name}. The ${worldState.factions[c.factionId]?.name ?? 'unknown faction'} will not forget this.`,
              icon: '💎', factionId: c.factionId,
              consequences: [`${c.name} gains vendetta against player`],
              hookPotential: 4,
            });
          }
        };
        break;
      }
      case 'boost_faction': {
        const faction = worldState.factions[targetFactionId];
        if (!faction) return;
        desc = `Player boosts ${faction.name}: ${boostStat} +${boostAmount}`;
        intervention.description = desc;
        intervention.apply = (state) => {
          const f = state.factions[targetFactionId];
          if (f) {
            if (boostStat === 'power') f.power = Math.min(f.maxPower, f.power + boostAmount);
            else if (boostStat === 'gold') f.gold += boostAmount;
            else if (boostStat === 'morale') f.morale = Math.min(100, f.morale + boostAmount);
          }
        };
        break;
      }
      case 'custom_event': {
        if (!customEventText.trim()) return;
        desc = customEventText;
        intervention.description = desc;
        intervention.apply = (_, pend) => {
          pend.injectedEvents.push({
            id: `custom_${id}`,
            turn: pending.turn, season: pending.season, year: pending.year,
            type: 'story_hook',
            text: `[Player] ${customEventText}`,
            icon: '🎭',
            factionId: targetFactionId || undefined,
            consequences: [],
            hookPotential: 4,
          });
        };
        break;
      }
    }

    setInterventions(prev => [...prev, intervention]);
    setShowActionBuilder(false);
    resetActionBuilder();
  };

  const removeIntervention = (id: string) => {
    setInterventions(prev => prev.filter(i => i.id !== id));
  };

  const resetActionBuilder = () => {
    setTargetCharId('');
    setTargetFactionId('');
    setVendettaReason('');
    setCustomEventText('');
    setArtifactName('');
    setBoostStat('power');
    setBoostAmount(10);
  };

  const handleExecute = () => {
    // Deep copy state for mutation
    const newState = JSON.parse(JSON.stringify(worldState)) as WorldState;
    const finalPending = { ...pending, actions, injectedEvents: [...injectedEvents] };

    // Apply all player interventions to state before execution
    for (const intervention of interventions) {
      intervention.apply(newState, finalPending);
    }

    onExecute(finalPending, newState);
  };

  return (
    <div className="intervention-overlay">
      <div className="intervention-panel">
        <div className="intervention-header">
          <div>
            <h2>Player Intervention</h2>
            <span className="intervention-subtitle">
              {pending.season}, Year {pending.year} — Turn {pending.turn}
            </span>
          </div>
          <div className="intervention-header-actions">
            <button className="gm-btn-small" onClick={onCancel}>Cancel Turn</button>
            <button className="primary" onClick={handleExecute}>
              Resolve Turn ({actions.filter(a => a.enabled).length}/{actions.length} actions)
            </button>
          </div>
        </div>

        <div className="intervention-body">
          {/* Left: Pending faction actions */}
          <div className="intervention-actions">
            <h3>Faction Actions</h3>
            <p className="intervention-hint">Toggle actions on/off. Add notes to influence the narrative.</p>

            {actions.map((pa, idx) => {
              const target = getActionTarget(pa.action);
              return (
                <div key={pa.factionId} className={`intervention-action ${pa.enabled ? '' : 'intervention-action--disabled'}`}>
                  <div className="intervention-action-header">
                    <label className="intervention-toggle">
                      <input
                        type="checkbox"
                        checked={pa.enabled}
                        onChange={() => toggleAction(idx)}
                      />
                      <span className="gm-faction-dot" style={{ background: pa.factionColor ?? '#888' }} />
                      <strong>{pa.factionName}</strong>
                    </label>
                    <span className="intervention-action-badge">
                      {ACTION_ICONS[pa.action.type] ?? '📜'} {ACTION_TYPE_LABELS[pa.action.type] ?? pa.action.type}
                    </span>
                  </div>
                  <div className="intervention-action-detail">
                    {pa.description}
                    {target && <span className="intervention-target"> → {target}</span>}
                  </div>
                  <input
                    className="intervention-note"
                    placeholder="GM note (optional)..."
                    value={pa.playerNote ?? ''}
                    onChange={e => setActionNote(idx, e.target.value)}
                  />
                </div>
              );
            })}
          </div>

          {/* Right: Player interventions */}
          <div className="intervention-player">
            <h3>Player Actions</h3>
            <p className="intervention-hint">
              Your characters interfere with the world. Kill leaders, create vendettas, steal artifacts.
            </p>

            {interventions.map(iv => (
              <div key={iv.id} className="intervention-item">
                <span className="intervention-item-type">{iv.type.replace(/_/g, ' ')}</span>
                <span className="intervention-item-desc">{iv.description}</span>
                <button className="intervention-item-remove" onClick={() => removeIntervention(iv.id)}>×</button>
              </div>
            ))}

            {!showActionBuilder ? (
              <button className="gm-btn-add" onClick={() => setShowActionBuilder(true)} style={{ marginTop: 8 }}>
                + Add Player Action
              </button>
            ) : (
              <div className="intervention-builder">
                <select value={actionType} onChange={e => { setActionType(e.target.value as PlayerActionType); resetActionBuilder(); }}>
                  <option value="kill_character">Kill Character</option>
                  <option value="wound_character">Wound Character</option>
                  <option value="create_vendetta">Create Vendetta</option>
                  <option value="steal_artifact">Steal Artifact</option>
                  <option value="boost_faction">Boost Faction</option>
                  <option value="custom_event">Custom Event</option>
                </select>

                {(actionType === 'kill_character' || actionType === 'wound_character') && (
                  <select value={targetCharId} onChange={e => setTargetCharId(e.target.value)}>
                    <option value="">Select character...</option>
                    {characters.map(c => {
                      const f = worldState.factions[c.factionId];
                      return <option key={c.id} value={c.id}>{c.name} ({f?.name ?? 'unknown'})</option>;
                    })}
                  </select>
                )}

                {actionType === 'create_vendetta' && (
                  <>
                    <select value={targetCharId} onChange={e => setTargetCharId(e.target.value)}>
                      <option value="">Who holds the grudge...</option>
                      {characters.map(c => {
                        const f = worldState.factions[c.factionId];
                        return <option key={c.id} value={c.id}>{c.name} ({f?.name ?? 'unknown'})</option>;
                      })}
                    </select>
                    <input
                      placeholder="Reason for vendetta..."
                      value={vendettaReason}
                      onChange={e => setVendettaReason(e.target.value)}
                    />
                  </>
                )}

                {actionType === 'steal_artifact' && (
                  <>
                    <select value={targetCharId} onChange={e => setTargetCharId(e.target.value)}>
                      <option value="">Steal from who...</option>
                      {characters.map(c => {
                        const f = worldState.factions[c.factionId];
                        return <option key={c.id} value={c.id}>{c.name} ({f?.name ?? 'unknown'})</option>;
                      })}
                    </select>
                    <input
                      placeholder="Artifact name..."
                      value={artifactName}
                      onChange={e => setArtifactName(e.target.value)}
                    />
                  </>
                )}

                {actionType === 'boost_faction' && (
                  <>
                    <select value={targetFactionId} onChange={e => setTargetFactionId(e.target.value)}>
                      <option value="">Select faction...</option>
                      {factions.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                    <div className="gm-stats-row">
                      <select value={boostStat} onChange={e => setBoostStat(e.target.value as 'power' | 'gold' | 'morale')}>
                        <option value="power">Power</option>
                        <option value="gold">Gold</option>
                        <option value="morale">Morale</option>
                      </select>
                      <input
                        type="number"
                        value={boostAmount}
                        onChange={e => setBoostAmount(Number(e.target.value))}
                        style={{ width: 60 }}
                      />
                    </div>
                  </>
                )}

                {actionType === 'custom_event' && (
                  <>
                    <textarea
                      placeholder="Describe what happens..."
                      value={customEventText}
                      onChange={e => setCustomEventText(e.target.value)}
                      rows={2}
                    />
                    <select value={targetFactionId} onChange={e => setTargetFactionId(e.target.value)}>
                      <option value="">Related faction (optional)...</option>
                      {factions.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </>
                )}

                <div className="intervention-builder-actions">
                  <button className="gm-btn-small" onClick={() => { setShowActionBuilder(false); resetActionBuilder(); }}>Cancel</button>
                  <button className="gm-btn-add" onClick={addIntervention}>Add</button>
                </div>
              </div>
            )}

            {/* Pre-phase events summary */}
            {pending.prePhaseEvents.length > 0 && (
              <div className="intervention-prephase">
                <h4>Already Resolved</h4>
                <p className="intervention-hint">Economy and decay events that ran automatically this turn.</p>
                {pending.prePhaseEvents.map(e => (
                  <div key={e.id} className="intervention-prephase-event">
                    <span>{e.icon}</span>
                    <span>{e.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
