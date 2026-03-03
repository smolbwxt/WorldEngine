import type { WorldEvent } from '../../engine/types.js';

interface Props {
  events: WorldEvent[];
}

export default function Chronicle({ events }: Props) {
  // Show events in reverse chronological order
  const sorted = [...events].reverse();

  if (sorted.length === 0) {
    return (
      <div style={{ padding: 16, color: 'var(--text-muted)', textAlign: 'center', fontSize: '0.85rem' }}>
        <p style={{ marginBottom: 8 }}>No events yet.</p>
        <p>Advance the turn to begin the chronicle.</p>
      </div>
    );
  }

  return (
    <div style={{ overflow: 'auto', flex: 1 }}>
      {sorted.map((event, i) => (
        <div key={event.id || i} className="event-item">
          <span className="event-icon">{event.icon}</span>
          <div className="event-text">
            <div>{event.text}</div>
            <div className="event-turn">
              {event.season}, Year {event.year} (Turn {event.turn})
              {event.hookPotential >= 4 && (
                <span className="hook-badge">HOOK</span>
              )}
            </div>
            {event.consequences.length > 0 && (
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>
                {event.consequences.join(' | ')}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
