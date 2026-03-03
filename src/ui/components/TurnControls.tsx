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
        <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {latestResult.events.length} events this turn
          {latestResult.storyHooks.length > 0 && (
            <span style={{ color: 'var(--accent-gold)', marginLeft: 8 }}>
              {latestResult.storyHooks.length} story hook{latestResult.storyHooks.length !== 1 ? 's' : ''}!
            </span>
          )}
        </span>
      )}
    </div>
  );
}
