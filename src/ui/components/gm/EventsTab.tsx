import { useState } from 'react';
import type { WorldState, WorldEvent, EventType } from '../../../engine/types.js';
import { gmInjectEvent } from '../../../engine/gm-actions.js';

interface EventsTabProps {
  worldState: WorldState;
  onUpdateState: (state: WorldState) => void;
}

const EVENT_ICONS: Record<string, string> = {
  raid: '⚔️', battle: '🗡️', alliance: '🤝', betrayal: '🗡️', scandal: '📰',
  reform: '📜', trade: '💰', recruitment: '🛡️', fortification: '🏰',
  migration: '🚶', disaster: '🌋', discovery: '🔍', omen: '✨', plague: '☠️',
  story_hook: '📜', patrol: '👁️', diplomacy: '🕊️', festival: '🎉',
  famine: '🍂', weather: '🌧️', treaty: '📜',
};

export default function EventsTab({ worldState, onUpdateState }: EventsTabProps) {
  const [eventText, setEventText] = useState('');
  const [eventType, setEventType] = useState<EventType>('story_hook');
  const [eventFaction, setEventFaction] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [hookPotential, setHookPotential] = useState(3);
  const [filter, setFilter] = useState<string>('all');

  const factions = Object.values(worldState.factions);
  const locations = Object.values(worldState.locations);

  const events = [...worldState.eventLog].reverse();
  const filtered = filter === 'all' ? events : events.filter(e => {
    if (filter === 'gm') return e.text.startsWith('[GM]');
    return e.type === filter;
  });

  const injectEvent = () => {
    if (!eventText.trim()) return;
    const newState = { ...worldState, eventLog: [...worldState.eventLog] };
    gmInjectEvent(newState, {
      type: eventType,
      text: eventText,
      icon: EVENT_ICONS[eventType] ?? '📜',
      factionId: eventFaction || undefined,
      locationId: eventLocation || undefined,
      consequences: [],
      hookPotential,
    });
    onUpdateState(newState);
    setEventText('');
  };

  return (
    <div className="gm-tab-content">
      <div className="gm-section">
        <h3>Inject Event</h3>
        <label className="gm-field">
          <span>Event Text</span>
          <textarea value={eventText} onChange={e => setEventText(e.target.value)} rows={2} placeholder="A mysterious stranger arrives at the gates..." />
        </label>
        <div className="gm-stats-row">
          <label className="gm-field gm-field--inline">
            <span>Type</span>
            <select value={eventType} onChange={e => setEventType(e.target.value as EventType)}>
              {Object.keys(EVENT_ICONS).map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="gm-field gm-field--inline">
            <span>Faction</span>
            <select value={eventFaction} onChange={e => setEventFaction(e.target.value)}>
              <option value="">None</option>
              {factions.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </label>
          <label className="gm-field gm-field--inline">
            <span>Location</span>
            <select value={eventLocation} onChange={e => setEventLocation(e.target.value)}>
              <option value="">None</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </label>
          <label className="gm-field gm-field--inline">
            <span>Hook (1-5)</span>
            <input type="number" min="1" max="5" value={hookPotential} onChange={e => setHookPotential(Number(e.target.value))} style={{ width: 40 }} />
          </label>
        </div>
        <button className="gm-btn-add" onClick={injectEvent} style={{ marginTop: 8 }}>Inject Event</button>
      </div>

      <div className="gm-section">
        <div className="gm-list-header">
          <h3>Event Log ({events.length} total)</h3>
          <select value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="all">All Events</option>
            <option value="gm">GM Events</option>
            {Object.keys(EVENT_ICONS).map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="gm-event-log">
          {filtered.slice(0, 50).map(evt => {
            const faction = evt.factionId ? worldState.factions[evt.factionId] : null;
            return (
              <div key={evt.id} className="gm-event-item">
                <span className="gm-event-icon">{evt.icon}</span>
                <div className="gm-event-content">
                  <span className="gm-event-meta">
                    Turn {evt.turn} — {evt.season} Y{evt.year}
                    {faction && <span className="gm-faction-dot" style={{ background: faction.color ?? '#888', marginLeft: 6 }} />}
                  </span>
                  <span className="gm-event-text">{evt.text}</span>
                  {evt.consequences.length > 0 && (
                    <span className="gm-event-consequences">{evt.consequences.join('; ')}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
