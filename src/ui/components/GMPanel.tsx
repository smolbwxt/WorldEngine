import { useState } from 'react';
import type { WorldState, WorldDefinition } from '../../engine/types.js';
import OverviewTab from './gm/OverviewTab.js';
import FactionsTab from './gm/FactionsTab.js';
import CharactersTab from './gm/CharactersTab.js';
import LocationsTab from './gm/LocationsTab.js';
import MapTab from './gm/MapTab.js';
import EventsTab from './gm/EventsTab.js';
import ConfigTab from './gm/ConfigTab.js';

type GMTabId = 'overview' | 'factions' | 'characters' | 'locations' | 'map' | 'events' | 'config';

interface GMPanelProps {
  mode: 'setup' | 'live';
  worldState: WorldState;
  onUpdateState: (state: WorldState) => void;
  onStartGame: (definition: WorldDefinition) => void;
  onClose?: () => void;
}

export default function GMPanel({ mode, worldState, onUpdateState, onStartGame, onClose }: GMPanelProps) {
  const [activeTab, setActiveTab] = useState<GMTabId>('overview');

  const tabs: Array<{ id: GMTabId; label: string; setupOnly?: boolean; liveOnly?: boolean }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'factions', label: 'Factions' },
    { id: 'characters', label: 'Characters' },
    { id: 'locations', label: 'Locations' },
    { id: 'map', label: 'Map' },
    { id: 'events', label: 'Events', liveOnly: true },
    { id: 'config', label: 'Config' },
  ];

  const visibleTabs = tabs.filter(t => {
    if (t.setupOnly && mode !== 'setup') return false;
    if (t.liveOnly && mode !== 'live') return false;
    return true;
  });

  return (
    <div className="gm-panel">
      <div className="gm-panel__header">
        <h2>{mode === 'setup' ? 'World Builder' : 'Game Master Tools'}</h2>
        {onClose && (
          <button className="gm-panel__close" onClick={onClose}>Close</button>
        )}
      </div>

      <div className="gm-panel__tabs">
        {visibleTabs.map(tab => (
          <button
            key={tab.id}
            className={`gm-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="gm-panel__content">
        {activeTab === 'overview' && (
          <OverviewTab
            mode={mode}
            worldState={worldState}
            onStartGame={onStartGame}
            onUpdateState={onUpdateState}
          />
        )}
        {activeTab === 'factions' && (
          <FactionsTab
            worldState={worldState}
            onUpdateState={onUpdateState}
            mode={mode}
          />
        )}
        {activeTab === 'characters' && (
          <CharactersTab
            worldState={worldState}
            onUpdateState={onUpdateState}
            mode={mode}
          />
        )}
        {activeTab === 'locations' && (
          <LocationsTab
            worldState={worldState}
            onUpdateState={onUpdateState}
          />
        )}
        {activeTab === 'map' && (
          <MapTab
            worldState={worldState}
            onUpdateState={onUpdateState}
            mode={mode}
          />
        )}
        {activeTab === 'events' && (
          <EventsTab
            worldState={worldState}
            onUpdateState={onUpdateState}
          />
        )}
        {activeTab === 'config' && (
          <ConfigTab
            worldState={worldState}
            onUpdateState={onUpdateState}
          />
        )}
      </div>
    </div>
  );
}
