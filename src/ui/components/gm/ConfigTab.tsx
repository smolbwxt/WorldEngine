import { useState } from 'react';
import type { WorldState } from '../../../engine/types.js';
import { DEFAULT_CONFIG, type SimulationConfig } from '../../../engine/config.js';

interface ConfigTabProps {
  worldState: WorldState;
  onUpdateState: (state: WorldState) => void;
}

type ConfigSection = 'economy' | 'combat' | 'raid' | 'decay' | 'diplomacy' | 'recruitment' | 'factionAI' | 'events';

const SECTION_LABELS: Record<ConfigSection, string> = {
  economy: 'Economy',
  combat: 'Combat',
  raid: 'Raiding',
  decay: 'Decay & Corruption',
  diplomacy: 'Diplomacy',
  recruitment: 'Recruitment & Actions',
  factionAI: 'Faction AI',
  events: 'Random Events',
};

export default function ConfigTab({ worldState, onUpdateState }: ConfigTabProps) {
  const [activeSection, setActiveSection] = useState<ConfigSection>('economy');
  const config = worldState.definition?.config ?? DEFAULT_CONFIG;

  // Merge defaults with any overrides
  const mergedConfig: SimulationConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    economy: { ...DEFAULT_CONFIG.economy, ...(config as SimulationConfig).economy },
    combat: { ...DEFAULT_CONFIG.combat, ...(config as SimulationConfig).combat },
    raid: { ...DEFAULT_CONFIG.raid, ...(config as SimulationConfig).raid },
    decay: { ...DEFAULT_CONFIG.decay, ...(config as SimulationConfig).decay },
    diplomacy: { ...DEFAULT_CONFIG.diplomacy, ...(config as SimulationConfig).diplomacy },
    recruitment: { ...DEFAULT_CONFIG.recruitment, ...(config as SimulationConfig).recruitment },
    factionAI: { ...DEFAULT_CONFIG.factionAI, ...(config as SimulationConfig).factionAI },
    events: { ...DEFAULT_CONFIG.events, ...(config as SimulationConfig).events },
  };

  const updateConfig = (section: string, key: string, value: number) => {
    const newDef = {
      ...(worldState.definition ?? {
        meta: { name: 'Custom World', description: '', theme: 'medieval-fantasy', startingSeason: 'Spring', seasonNames: ['Spring', 'Summer', 'Autumn', 'Winter'] },
        factions: [], locations: [], characters: [], events: [], storyHooks: [], availableTags: [],
      }),
    };
    const newConfig = { ...mergedConfig } as Record<string, unknown>;
    const sectionObj = { ...(newConfig[section] as Record<string, unknown>) };
    sectionObj[key] = value;
    newConfig[section] = sectionObj;
    newDef.config = newConfig as Partial<SimulationConfig>;
    onUpdateState({ ...worldState, definition: newDef });
  };

  const updateNestedConfig = (section: string, sub: string, key: string, value: number) => {
    const newDef = {
      ...(worldState.definition ?? {
        meta: { name: 'Custom World', description: '', theme: 'medieval-fantasy', startingSeason: 'Spring', seasonNames: ['Spring', 'Summer', 'Autumn', 'Winter'] },
        factions: [], locations: [], characters: [], events: [], storyHooks: [], availableTags: [],
      }),
    };
    const newConfig = { ...mergedConfig } as Record<string, unknown>;
    const sectionObj = { ...(newConfig[section] as Record<string, unknown>) };
    const subObj = { ...(sectionObj[sub] as Record<string, unknown>) };
    subObj[key] = value;
    sectionObj[sub] = subObj;
    newConfig[section] = sectionObj;
    newDef.config = newConfig as Partial<SimulationConfig>;
    onUpdateState({ ...worldState, definition: newDef });
  };

  const renderField = (section: string, key: string, value: unknown, label?: string) => {
    if (typeof value === 'number') {
      const isFloat = !Number.isInteger(value) || key.includes('Rate') || key.includes('Chance') || key.includes('Multiplier') || key.includes('Bonus');
      return (
        <label key={key} className="gm-field gm-field--inline">
          <span title={key}>{label ?? key}</span>
          <input
            type="number"
            step={isFloat ? 0.05 : 1}
            value={value}
            onChange={e => updateConfig(section, key, Number(e.target.value))}
            style={{ width: 80 }}
          />
        </label>
      );
    }
    if (Array.isArray(value) && value.length === 2 && typeof value[0] === 'number') {
      return (
        <div key={key} className="gm-field gm-field--inline">
          <span title={key}>{label ?? key}</span>
          <input
            type="number"
            value={value[0]}
            onChange={e => {
              const arr = [Number(e.target.value), value[1]];
              updateConfig(section, key, arr as unknown as number);
            }}
            style={{ width: 50 }}
          />
          <span>-</span>
          <input
            type="number"
            value={value[1]}
            onChange={e => {
              const arr = [value[0], Number(e.target.value)];
              updateConfig(section, key, arr as unknown as number);
            }}
            style={{ width: 50 }}
          />
        </div>
      );
    }
    return null;
  };

  const renderSection = (section: ConfigSection) => {
    const data = mergedConfig[section] as unknown as Record<string, unknown>;
    if (!data) return null;

    return (
      <div className="gm-config-section">
        {Object.entries(data).map(([key, value]) => {
          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            // Nested object (e.g., economy.seasonal, combat.losses, factionAI.generic)
            return (
              <div key={key} className="gm-section" style={{ marginTop: 8 }}>
                <h5>{key}</h5>
                <div className="gm-config-grid">
                  {Object.entries(value as Record<string, unknown>).map(([subKey, subValue]) => {
                    if (typeof subValue === 'object' && subValue !== null) return null;
                    if (typeof subValue === 'number') {
                      const isFloat = !Number.isInteger(subValue) || subKey.includes('Chance') || subKey.includes('Rate');
                      return (
                        <label key={subKey} className="gm-field gm-field--inline">
                          <span title={subKey}>{subKey}</span>
                          <input
                            type="number"
                            step={isFloat ? 0.05 : 1}
                            value={subValue}
                            onChange={e => updateNestedConfig(section, key, subKey, Number(e.target.value))}
                            style={{ width: 80 }}
                          />
                        </label>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>
            );
          }
          return renderField(section, key, value);
        })}
      </div>
    );
  };

  const resetSection = () => {
    const newDef = { ...worldState.definition! };
    const newConfig = { ...(newDef.config ?? DEFAULT_CONFIG) } as unknown as Record<string, unknown>;
    newConfig[activeSection] = (DEFAULT_CONFIG as unknown as Record<string, unknown>)[activeSection];
    newDef.config = newConfig as Partial<SimulationConfig>;
    onUpdateState({ ...worldState, definition: newDef });
  };

  return (
    <div className="gm-tab-content">
      <div className="gm-list-header">
        <h3>Simulation Config</h3>
        <button className="gm-btn-small" onClick={resetSection}>Reset {SECTION_LABELS[activeSection]}</button>
      </div>

      <div className="gm-two-panel">
        <div className="gm-list" style={{ minWidth: 140 }}>
          {(Object.keys(SECTION_LABELS) as ConfigSection[]).map(section => (
            <div
              key={section}
              className={`gm-list-item ${activeSection === section ? 'selected' : ''}`}
              onClick={() => setActiveSection(section)}
            >
              <span>{SECTION_LABELS[section]}</span>
            </div>
          ))}
        </div>
        <div className="gm-detail-panel">
          <h4>{SECTION_LABELS[activeSection]}</h4>
          <div className="gm-config-grid">
            {renderSection(activeSection)}
          </div>
        </div>
      </div>
    </div>
  );
}
