import { useState, useCallback, useEffect } from 'react';
import type { WorldState, TurnResult, Faction, Location, WorldDefinition, PendingTurn } from '../engine/types.js';
import { createInitialWorldState } from '../engine/world-state.js';
import { resolveTurn, prepareTurn, executePreparedTurn } from '../engine/simulation.js';
import WorldMap from './components/WorldMap.js';
import FactionPanel from './components/FactionPanel.js';
import Chronicle from './components/Chronicle.js';
import Dashboard from './components/Dashboard.js';
import TurnControls from './components/TurnControls.js';
import LocationDetail from './components/LocationDetail.js';
import CharacterPanel from './components/CharacterPanel.js';
import RelationshipMatrix from './components/RelationshipMatrix.js';
import LocationView from './components/LocationView.js';
import SaveManager, { autoSave, loadAutoSave, hasAutoSave, clearAutoSave } from './components/SaveManager.js';
import GMPanel from './components/GMPanel.js';
import InterventionPanel from './components/InterventionPanel.js';

type AppPhase = 'setup' | 'playing';
type MainView = 'map' | 'dashboard' | 'diplomacy' | 'location';
type SideView = 'factions' | 'chronicle' | 'location' | 'characters';

export default function App() {
  const [phase, setPhase] = useState<AppPhase>(() => {
    return hasAutoSave() ? 'playing' : 'setup';
  });
  const [worldState, setWorldState] = useState<WorldState>(() => {
    const saved = loadAutoSave();
    return saved ? saved.worldState : createInitialWorldState(42);
  });
  const [turnResults, setTurnResults] = useState<TurnResult[]>(() => {
    const saved = loadAutoSave();
    return saved ? saved.turnResults : [];
  });
  const [mainView, setMainView] = useState<MainView>('map');
  const [sideView, setSideView] = useState<SideView>('factions');
  const [selectedFaction, setSelectedFaction] = useState<Faction | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [showSaveManager, setShowSaveManager] = useState(false);
  const [showGMPanel, setShowGMPanel] = useState(false);
  const [resumeBanner, setResumeBanner] = useState(() => hasAutoSave());
  const [interventionMode, setInterventionMode] = useState(false);
  const [pendingTurn, setPendingTurn] = useState<PendingTurn | null>(null);
  const [preInterventionState, setPreInterventionState] = useState<WorldState | null>(null);

  // Auto-save after every state change
  useEffect(() => {
    if (phase === 'playing' && worldState.turn > 0) {
      autoSave(worldState, turnResults);
    }
  }, [worldState, turnResults, phase]);

  const handleStartGame = useCallback((definition: WorldDefinition) => {
    const newState = createInitialWorldState(definition);
    setWorldState(newState);
    setTurnResults([]);
    setSelectedFaction(null);
    setSelectedLocation(null);
    setPhase('playing');
    setResumeBanner(false);
  }, []);

  const handleSetupUpdateState = useCallback((state: WorldState) => {
    setWorldState(state);
  }, []);

  const advanceTurn = useCallback(() => {
    if (interventionMode) {
      // Intervention path: prepare turn, show panel for review
      setPreInterventionState(structuredClone(worldState));
      const stateCopy = structuredClone(worldState);
      const pending = prepareTurn(stateCopy);
      setPendingTurn(pending);
      setWorldState(stateCopy); // state has season/decay/economy applied
    } else {
      // Normal path: resolve fully
      setWorldState(prev => {
        const state = structuredClone(prev);
        const result = resolveTurn(state);
        setTurnResults(prevResults => [...prevResults, result]);
        return state;
      });
    }
    setResumeBanner(false);
  }, [interventionMode, worldState]);

  const handleInterventionExecute = useCallback((finalPending: PendingTurn, updatedState: WorldState) => {
    const result = executePreparedTurn(updatedState, finalPending);
    setWorldState(updatedState);
    setTurnResults(prev => [...prev, result]);
    setPendingTurn(null);
    setPreInterventionState(null);
  }, []);

  const handleInterventionCancel = useCallback(() => {
    // Revert to pre-intervention state
    if (preInterventionState) {
      setWorldState(preInterventionState);
    }
    setPendingTurn(null);
    setPreInterventionState(null);
  }, [preInterventionState]);

  const advanceYear = useCallback(() => {
    setWorldState(prev => {
      const state = structuredClone(prev);
      const newResults: TurnResult[] = [];
      for (let i = 0; i < 4; i++) {
        newResults.push(resolveTurn(state));
      }
      setTurnResults(prevResults => [...prevResults, ...newResults]);
      return state;
    });
    setResumeBanner(false);
  }, []);

  const resetWorld = useCallback(() => {
    setPhase('setup');
    setWorldState(createInitialWorldState(42));
    setTurnResults([]);
    setSelectedFaction(null);
    setSelectedLocation(null);
    clearAutoSave();
    setResumeBanner(false);
    setShowGMPanel(false);
  }, []);

  const handleLoadState = useCallback((ws: WorldState, tr: TurnResult[]) => {
    setWorldState(ws);
    setTurnResults(tr);
    setSelectedFaction(null);
    setSelectedLocation(null);
    setShowSaveManager(false);
    setResumeBanner(false);
    setPhase('playing');
  }, []);

  const handleGMUpdateState = useCallback((state: WorldState) => {
    setWorldState(state);
  }, []);

  const handleLocationSelect = useCallback((loc: Location) => {
    setSelectedLocation(loc);
    setMainView('location');
    setSideView('location');
  }, []);

  const handleFactionSelect = useCallback((faction: Faction) => {
    setSelectedFaction(faction);
    setSideView('factions');
  }, []);

  // === Setup Phase: Show GM Panel as World Builder ===
  if (phase === 'setup') {
    return (
      <div className="app" style={{ gridTemplateColumns: '1fr', gridTemplateRows: 'auto 1fr' }}>
        <header className="app-header">
          <h1>WorldEngine</h1>
          <span className="turn-info">World Builder</span>
        </header>
        <div style={{ overflow: 'auto' }}>
          <GMPanel
            mode="setup"
            worldState={worldState}
            onUpdateState={handleSetupUpdateState}
            onStartGame={handleStartGame}
          />
        </div>
      </div>
    );
  }

  // === Playing Phase: Normal game UI with GM toggle ===
  const worldName = worldState.definition?.meta.name ?? 'The Aurelian Decline';

  return (
    <div className="app">
      <header className="app-header">
        <h1>{worldName}</h1>
        <span className="turn-info">
          {worldState.season}, Year {worldState.year} — Turn {worldState.turn}
        </span>
      </header>

      {/* Resume banner */}
      {resumeBanner && worldState.turn > 0 && (
        <div style={{
          background: 'rgba(204,153,0,0.12)', borderBottom: '1px solid rgba(204,153,0,0.3)',
          padding: '6px 16px', fontSize: '0.75rem', color: '#c90',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>Resumed from auto-save: {worldState.season}, Year {worldState.year}, Turn {worldState.turn}</span>
          <button onClick={() => setResumeBanner(false)} style={{
            background: 'none', border: 'none', color: '#c90', cursor: 'pointer', fontSize: '0.75rem',
          }}>dismiss</button>
        </div>
      )}

      <TurnControls
        onAdvanceTurn={advanceTurn}
        onAdvanceYear={advanceYear}
        onReset={resetWorld}
        currentTurn={worldState.turn}
        currentSeason={worldState.season}
        currentYear={worldState.year}
        latestResult={turnResults[turnResults.length - 1] ?? null}
        onOpenSaveManager={() => setShowSaveManager(true)}
        onOpenGMPanel={() => setShowGMPanel(true)}
        interventionMode={interventionMode}
        onToggleIntervention={() => setInterventionMode(prev => !prev)}
      />

      <div className="main-area">
        <div className="tab-bar">
          <button className={mainView === 'map' ? 'active' : ''} onClick={() => setMainView('map')}>World Map</button>
          <button className={mainView === 'dashboard' ? 'active' : ''} onClick={() => setMainView('dashboard')}>Dashboard</button>
          <button className={mainView === 'diplomacy' ? 'active' : ''} onClick={() => setMainView('diplomacy')}>Diplomacy</button>
          <button className={mainView === 'location' ? 'active' : ''} onClick={() => setMainView('location')}>
            {selectedLocation ? selectedLocation.name : 'Location'}
          </button>
        </div>

        {mainView === 'map' && <WorldMap worldState={worldState} selectedFaction={selectedFaction} onLocationSelect={handleLocationSelect} />}
        {mainView === 'dashboard' && <Dashboard worldState={worldState} turnResults={turnResults} />}
        {mainView === 'diplomacy' && <RelationshipMatrix worldState={worldState} onFactionSelect={handleFactionSelect} />}
        {mainView === 'location' && <LocationView location={selectedLocation} worldState={worldState} />}
      </div>

      <div className="sidebar">
        <div className="tab-bar">
          <button className={sideView === 'factions' ? 'active' : ''} onClick={() => setSideView('factions')}>Factions</button>
          <button className={sideView === 'chronicle' ? 'active' : ''} onClick={() => setSideView('chronicle')}>Chronicle</button>
          <button className={sideView === 'characters' ? 'active' : ''} onClick={() => setSideView('characters')}>Characters</button>
          <button className={sideView === 'location' ? 'active' : ''} onClick={() => setSideView('location')}>Location</button>
        </div>

        {sideView === 'factions' && <FactionPanel factions={Object.values(worldState.factions)} selected={selectedFaction} onSelect={handleFactionSelect} />}
        {sideView === 'characters' && <CharacterPanel worldState={worldState} selectedFactionId={selectedFaction?.id} />}
        {sideView === 'chronicle' && <Chronicle events={worldState.eventLog} />}
        {sideView === 'location' && <LocationDetail location={selectedLocation} worldState={worldState} />}
      </div>

      {showSaveManager && (
        <SaveManager
          worldState={worldState}
          turnResults={turnResults}
          onLoad={handleLoadState}
          onClose={() => setShowSaveManager(false)}
        />
      )}

      {showGMPanel && (
        <div className="gm-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowGMPanel(false); }}>
          <GMPanel
            mode="live"
            worldState={worldState}
            onUpdateState={handleGMUpdateState}
            onStartGame={() => {}}
            onClose={() => setShowGMPanel(false)}
          />
        </div>
      )}

      {pendingTurn && (
        <InterventionPanel
          worldState={worldState}
          pending={pendingTurn}
          onExecute={handleInterventionExecute}
          onCancel={handleInterventionCancel}
        />
      )}
    </div>
  );
}
