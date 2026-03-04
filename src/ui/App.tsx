import { useState, useCallback, useRef } from 'react';
import type { WorldState, TurnResult, Faction, Location } from '../engine/types.js';
import { createInitialWorldState } from '../engine/world-state.js';
import { resolveTurn } from '../engine/simulation.js';
import WorldMap from './components/WorldMap.js';
import FactionPanel from './components/FactionPanel.js';
import Chronicle from './components/Chronicle.js';
import Dashboard from './components/Dashboard.js';
import TurnControls from './components/TurnControls.js';
import LocationDetail from './components/LocationDetail.js';

type MainView = 'map' | 'dashboard';
type SideView = 'factions' | 'chronicle' | 'location';

// API key modal (shared across world map + location views)
function ApiKeyModal({
  onSubmit,
  onCancel,
}: {
  onSubmit: (key: string) => void;
  onCancel: () => void;
}) {
  const [key, setKey] = useState('');
  return (
    <div className="api-key-modal-overlay" onClick={onCancel}>
      <div className="api-key-modal" onClick={e => e.stopPropagation()}>
        <h3>Gemini API Key Required</h3>
        <p>
          Nano Banana 2 runs via the Gemini API. Enter your API key below, or set{' '}
          <code>VITE_GEMINI_API_KEY</code> in your <code>.env</code> file.
        </p>
        <p style={{ fontSize: '0.8em', opacity: 0.7 }}>
          Get a free key at{' '}
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">
            aistudio.google.com/apikey
          </a>
        </p>
        <input
          type="password"
          placeholder="AIza..."
          value={key}
          onChange={e => setKey(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && key.trim() && onSubmit(key.trim())}
          autoFocus
        />
        <div className="api-key-modal-actions">
          <button onClick={onCancel}>Cancel</button>
          <button onClick={() => key.trim() && onSubmit(key.trim())} disabled={!key.trim()}>
            Save Key
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [worldState, setWorldState] = useState<WorldState>(() => createInitialWorldState(42));
  const [turnResults, setTurnResults] = useState<TurnResult[]>([]);
  const [mainView, setMainView] = useState<MainView>('map');
  const [sideView, setSideView] = useState<SideView>('factions');
  const [selectedFaction, setSelectedFaction] = useState<Faction | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [showKeyModal, setShowKeyModal] = useState(false);

  // Shared API key state
  const apiKeyRef = useRef<string>(import.meta.env.VITE_GEMINI_API_KEY ?? '');
  const [apiKey, setApiKey] = useState<string>(apiKeyRef.current);

  const handleSetApiKey = useCallback((key: string) => {
    apiKeyRef.current = key;
    setApiKey(key);
    setShowKeyModal(false);
  }, []);

  const handleRequestApiKey = useCallback(() => {
    setShowKeyModal(true);
  }, []);

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
            apiKey={apiKey}
            onRequestApiKey={handleRequestApiKey}
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
        {sideView === 'chronicle' && (
          <Chronicle events={worldState.eventLog} />
        )}
        {sideView === 'location' && (
          <LocationDetail
            location={selectedLocation}
            worldState={worldState}
            apiKey={apiKey}
            onRequestApiKey={handleRequestApiKey}
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

      {/* Shared API Key Modal */}
      {showKeyModal && (
        <ApiKeyModal
          onSubmit={handleSetApiKey}
          onCancel={() => setShowKeyModal(false)}
        />
      )}
    </div>
  );
}
