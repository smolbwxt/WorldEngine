import type { TurnResult } from '../../engine/types.js';

interface Props {
  onAdvanceTurn: () => void;
  onAdvanceYear: () => void;
  onReset: () => void;
  currentTurn: number;
  latestResult: TurnResult | null;
}

export default function TurnControls({
  onAdvanceTurn,
  onAdvanceYear,
  onReset,
  currentTurn,
  latestResult,
}: Props) {
  return (
    <div className="controls-bar">
      <button className="primary" onClick={onAdvanceTurn}>
        Advance Turn
      </button>
      <button className="secondary" onClick={onAdvanceYear}>
        Advance Year (4 turns)
      </button>
      <button className="secondary" onClick={onReset}>
        Reset World
      </button>

      {latestResult && (
        <div style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'right', maxWidth: '60%' }}>
          <div>
            {latestResult.events.length} events this turn
            {latestResult.storyHooks.length > 0 && (
              <span style={{ color: 'var(--accent-gold)', marginLeft: 8 }}>
                {latestResult.storyHooks.length} story hook{latestResult.storyHooks.length !== 1 ? 's' : ''}!
              </span>
            )}
          </div>
          {latestResult.narrative && (
            <p style={{
              fontSize: '0.7rem',
              fontStyle: 'italic',
              margin: '4px 0 0',
              lineHeight: 1.4,
              color: 'var(--text-muted)',
              opacity: 0.85,
            }}>
              {latestResult.narrative}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
