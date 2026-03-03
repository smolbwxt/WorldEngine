import type { WorldState, TurnResult } from '../../engine/types.js';

interface Props {
  worldState: WorldState;
  turnResults: TurnResult[];
}

export default function Dashboard({ worldState, turnResults }: Props) {
  const factions = Object.values(worldState.factions);
  const locations = Object.values(worldState.locations);

  // Aggregate stats
  const totalPopulation = locations.reduce((sum, l) => sum + l.population, 0);
  const avgProsperity = locations.filter(l => l.population > 0).reduce((sum, l, _, arr) =>
    sum + l.prosperity / arr.length, 0
  );
  const totalGold = factions.reduce((sum, f) => sum + f.gold, 0);
  const totalEvents = worldState.eventLog.length;

  // Latest DM brief
  const latestResult = turnResults[turnResults.length - 1];

  return (
    <div className="dashboard">
      <div className="dashboard-grid">
        {/* World Overview */}
        <div className="card">
          <h3>World Overview</h3>
          <div className="stat-row"><span className="stat">Total Population: <strong>{totalPopulation.toLocaleString()}</strong></span></div>
          <div className="stat-row"><span className="stat">Avg. Prosperity: <strong>{avgProsperity.toFixed(1)}</strong></span></div>
          <div className="stat-row"><span className="stat">Total Gold in World: <strong>{totalGold}</strong></span></div>
          <div className="stat-row"><span className="stat">Events Logged: <strong>{totalEvents}</strong></span></div>
          <div className="stat-row"><span className="stat">Story Beats Triggered: <strong>{worldState.storyBeatsTriggered.length}</strong></span></div>
        </div>

        {/* Power Rankings */}
        <div className="card">
          <h3>Power Rankings</h3>
          {[...factions]
            .sort((a, b) => b.power - a.power)
            .map((f, i) => (
              <div key={f.id} className="stat-row">
                <span className="stat" style={{ minWidth: 20 }}>{i + 1}.</span>
                <span className="stat" style={{ flex: 1 }}><strong>{f.name}</strong></span>
                <span className="stat">{f.power}/{f.maxPower}</span>
              </div>
            ))}
        </div>

        {/* Wealth Rankings */}
        <div className="card">
          <h3>Wealth Rankings</h3>
          {[...factions]
            .sort((a, b) => b.gold - a.gold)
            .map((f, i) => (
              <div key={f.id} className="stat-row">
                <span className="stat" style={{ minWidth: 20 }}>{i + 1}.</span>
                <span className="stat" style={{ flex: 1 }}><strong>{f.name}</strong></span>
                <span className="stat">{f.gold}g</span>
              </div>
            ))}
        </div>

        {/* Most Prosperous Locations */}
        <div className="card">
          <h3>Most Prosperous Locations</h3>
          {[...locations]
            .filter(l => l.population > 0)
            .sort((a, b) => b.prosperity - a.prosperity)
            .slice(0, 7)
            .map((l, i) => (
              <div key={l.id} className="stat-row">
                <span className="stat" style={{ minWidth: 20 }}>{i + 1}.</span>
                <span className="stat" style={{ flex: 1 }}><strong>{l.name}</strong></span>
                <span className="stat">Prosp: {l.prosperity}</span>
              </div>
            ))}
        </div>

        {/* Threatened Locations (low defense, population > 0) */}
        <div className="card">
          <h3>Most Vulnerable Locations</h3>
          {[...locations]
            .filter(l => l.population > 100 && l.defense < 25)
            .sort((a, b) => a.defense - b.defense)
            .slice(0, 5)
            .map((l, i) => (
              <div key={l.id} className="stat-row">
                <span className="stat" style={{ minWidth: 20 }}>{i + 1}.</span>
                <span className="stat" style={{ flex: 1 }}><strong>{l.name}</strong></span>
                <span className="stat" style={{ color: 'var(--accent-red)' }}>Def: {l.defense}</span>
              </div>
            ))}
        </div>

        {/* DM Brief */}
        {latestResult && (
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <h3>Latest DM Brief</h3>
            <pre style={{
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
              whiteSpace: 'pre-wrap',
              lineHeight: 1.5,
              fontFamily: 'inherit',
            }}>
              {latestResult.dmBrief}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
