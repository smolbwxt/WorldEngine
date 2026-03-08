import type { TurnResult, Season } from '../../engine/types.js';

interface Props {
  onAdvanceTurn: () => void;
  onAdvanceYear: () => void;
  onReset: () => void;
  currentTurn: number;
  currentSeason: Season;
  currentYear: number;
  latestResult: TurnResult | null;
  onOpenSaveManager: () => void;
  onOpenGMPanel?: () => void;
  interventionMode?: boolean;
  onToggleIntervention?: () => void;
}

const SEASON_ICONS: Record<string, string> = {
  Spring: '🌱',
  Summer: '☀️',
  Autumn: '🍂',
  Winter: '❄️',
};

export default function TurnControls({
  onAdvanceTurn,
  onAdvanceYear,
  onReset,
  currentTurn,
  currentSeason,
  currentYear,
  latestResult,
  onOpenSaveManager,
  onOpenGMPanel,
  interventionMode,
  onToggleIntervention,
}: Props) {
  return (
    <div className="crown-bar">
      {/* Left — Season and Year display */}
      <div className="crown-bar__left">
        <div className="crown-bar__season">
          <span className="crown-bar__season-icon">{SEASON_ICONS[currentSeason] ?? '🌐'}</span>
          <span className="crown-bar__season-name">{currentSeason}</span>
        </div>
        <div className="crown-bar__date">
          <span className="crown-bar__year">Year {currentYear}</span>
          <span className="crown-bar__turn">Turn {currentTurn}</span>
        </div>
      </div>

      {/* Center — Action buttons */}
      <div className="crown-bar__actions">
        <button className="crown-btn crown-btn--advance" onClick={onAdvanceTurn}>
          <span className="crown-btn__icon">⏭</span>
          <span className="crown-btn__label">Advance Season</span>
        </button>
        <button className="crown-btn crown-btn--year" onClick={onAdvanceYear} title={interventionMode ? 'Disabled during intervention mode' : 'Advance 4 turns'} disabled={interventionMode}>
          <span className="crown-btn__icon">⏩</span>
          <span className="crown-btn__label">Full Year</span>
        </button>

        {onToggleIntervention && (
          <button
            className={`crown-btn crown-btn--intervention ${interventionMode ? 'crown-btn--intervention-active' : ''}`}
            onClick={onToggleIntervention}
            title={interventionMode ? 'Players will review actions before resolution' : 'Click to enable player intervention between turns'}
          >
            <span className="crown-btn__icon">🎭</span>
            <span className="crown-btn__label">{interventionMode ? 'Players: ON' : 'Players'}</span>
          </button>
        )}

        <div className="crown-bar__divider" />

        <button className="crown-btn crown-btn--save" onClick={onOpenSaveManager}>
          <span className="crown-btn__icon">📜</span>
          <span className="crown-btn__label">Chronicles</span>
        </button>
        {onOpenGMPanel && (
          <button className="crown-btn crown-btn--gm" onClick={onOpenGMPanel}>
            <span className="crown-btn__icon">🎲</span>
            <span className="crown-btn__label">GM Tools</span>
          </button>
        )}
        <button className="crown-btn crown-btn--reset" onClick={onReset}>
          <span className="crown-btn__icon">⟲</span>
          <span className="crown-btn__label">New Era</span>
        </button>
      </div>

      {/* Right — Latest turn summary */}
      <div className="crown-bar__right">
        {latestResult ? (
          <>
            <div className="crown-bar__events">
              {latestResult.events.length} events
              {latestResult.storyHooks.length > 0 && (
                <span className="crown-bar__hooks">
                  {latestResult.storyHooks.length} hook{latestResult.storyHooks.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            {latestResult.narrative && (
              <p className="crown-bar__narrative">{latestResult.narrative}</p>
            )}
          </>
        ) : (
          <p className="crown-bar__narrative">The chronicle awaits its first entry...</p>
        )}
      </div>
    </div>
  );
}
