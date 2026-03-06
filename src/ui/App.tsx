import { useState, useCallback } from 'react';
import type { WorldState, TurnResult, Faction, Location } from '../engine/types.js';
import { createInitialWorldState } from '../engine/world-state.js';
import { resolveTurn } from '../engine/simulation.js';
import WorldMap from './components/WorldMap.js';
import FactionPanel from './components/FactionPanel.js';
import Chronicle from './components/Chronicle.js';
import Dashboard from './components/Dashboard.js';
import TurnControls from './components/TurnControls.js';
import LocationDetail from './components/LocationDetail.js';
import CharacterPanel from './components/CharacterPanel.js';

type MainView = 'map' | 'dashboard';
type SideView = 'factions' | 'chronicle' | 'location' | 'characters';

export default function App() {
  const [worldState, setWorldState] = useState<WorldState>(() => createInitialWorldState(42));
  const [turnResults, setTurnResults] = useState<TurnResult[]>([]);
  const [mainView, setMainView] = useState<MainView>('map');
  const [sideView, setSideView] = useState<SideView>('factions');
  const [selectedFaction, setSelectedFaction] = useState<Faction | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);

  const advanceTurn = useCallback(() => {
    setWorldState(prev => {
      const state = JSON.parse(JSON.stringify(prev)) as WorldState;
      const result = resolveTurn(state);
      setTurnResults(prevResults => [...prevResults, result]);
      return state;
    });
  }, []);

  const advanceYear = useCallback(() => {
    setWorldState(prev => {
      const state = JSON.parse(JSON.stringify(prev)) as WorldState;
      const newResults: TurnResult[] = [];
      for (let i = 0; i < 4; i++) {
        newResults.push(resolveTurn(state));
      }
      setTurnResults(prevResults => [...prevResults, ...newResults]);
      return state;
    });
  }, []);

  const resetWorld = useCallback(() => {
    setWorldState(createInitialWorldState(42));
    setTurnResults([]);
    setSelectedFaction(null);
    setSelectedLocation(null);
  }, []);

  const handleLocationSelect = useCallback((loc: Location) => {
    setSelectedLocation(loc);
    setSideView('location');
  }, []);

  const handleFactionSelect = useCallback((faction: Faction) => {
    setSelectedFaction(faction);
    setSideView('factions');
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>The Aurelian Decline</h1>
        <span className="turn-info">
          {worldState.season}, Year {worldState.year} — Turn {worldState.turn}
        </span>
      </header>

      <div className="main-area">
        <div className="tab-bar">
          <button
            className={mainView === 'map' ? 'active' : ''}
            onClick={() => setMainView('map')}
          >
            World Map
          </button>
          <button
            className={mainView === 'dashboard' ? 'active' : ''}
            onClick={() => setMainView('dashboard')}
          >
            Dashboard
          </button>
        </div>

        {mainView === 'map' ? (
          <WorldMap
            worldState={worldState}
            selectedFaction={selectedFaction}
            onLocationSelect={handleLocationSelect}
          />
        ) : (
          <Dashboard worldState={worldState} turnResults={turnResults} />
        )}
      </div>

      <div className="sidebar">
        <div className="tab-bar">
          <button
            className={sideView === 'factions' ? 'active' : ''}
            onClick={() => setSideView('factions')}
          >
            Factions
          </button>
          <button
            className={sideView === 'chronicle' ? 'active' : ''}
            onClick={() => setSideView('chronicle')}
          >
            Chronicle
          </button>
          <button
            className={sideView === 'characters' ? 'active' : ''}
            onClick={() => setSideView('characters')}
          >
            Characters
          </button>
          <button
            className={sideView === 'location' ? 'active' : ''}
            onClick={() => setSideView('location')}
          >
            Location
          </button>
        </div>

        {sideView === 'factions' && (
          <FactionPanel
            factions={Object.values(worldState.factions)}
            selected={selectedFaction}
            onSelect={handleFactionSelect}
          />
        )}
        {sideView === 'characters' && (
          <CharacterPanel
            worldState={worldState}
            selectedFactionId={selectedFaction?.id}
          />
        )}
        {sideView === 'chronicle' && (
          <Chronicle events={worldState.eventLog} />
        )}
        {sideView === 'location' && (
          <LocationDetail
            location={selectedLocation}
            worldState={worldState}
          />
        )}
      </div>

      <TurnControls
        onAdvanceTurn={advanceTurn}
        onAdvanceYear={advanceYear}
        onReset={resetWorld}
        currentTurn={worldState.turn}
        latestResult={turnResults[turnResults.length - 1] ?? null}
      />
    </div>
  );
}
