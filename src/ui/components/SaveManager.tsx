import { useState, useEffect, useRef } from 'react';
import type { WorldState, TurnResult } from '../../engine/types.js';
import { serializeWorldState, deserializeWorldState } from '../../engine/world-state.js';

// ============================================================
// Save Slot Types
// ============================================================

interface SaveSlot {
  id: string;
  name: string;
  turn: number;
  year: number;
  season: string;
  savedAt: string;       // ISO timestamp
  factionCount: number;
  characterCount: number;
  deadCount: number;
  eventCount: number;
  // The actual data (stored separately in localStorage for size)
}

interface SaveData {
  worldState: string;    // serialized WorldState JSON
  turnResults: string;   // serialized TurnResult[] JSON
  artCache?: string;     // serialized art image cache (base64 map images etc.)
  version: number;       // schema version for future migrations
}

const SAVE_INDEX_KEY = 'aurelian_save_index';
const SAVE_DATA_PREFIX = 'aurelian_save_';
const AUTO_SAVE_KEY = 'aurelian_autosave';
const SAVE_VERSION = 1;
const MAX_MANUAL_SAVES = 20;

// ============================================================
// localStorage helpers
// ============================================================

function getSaveIndex(): SaveSlot[] {
  try {
    const raw = localStorage.getItem(SAVE_INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setSaveIndex(slots: SaveSlot[]): void {
  localStorage.setItem(SAVE_INDEX_KEY, JSON.stringify(slots));
}

function getSaveData(id: string): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_DATA_PREFIX + id);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setSaveData(id: string, data: SaveData): void {
  localStorage.setItem(SAVE_DATA_PREFIX + id, JSON.stringify(data));
}

function deleteSaveData(id: string): void {
  localStorage.removeItem(SAVE_DATA_PREFIX + id);
}

function buildSaveData(worldState: WorldState, turnResults: TurnResult[]): SaveData {
  return {
    worldState: serializeWorldState(worldState),
    turnResults: JSON.stringify(turnResults),
    version: SAVE_VERSION,
  };
}

function buildSlotMeta(id: string, name: string, worldState: WorldState): SaveSlot {
  const chars = Object.values(worldState.characters ?? {});
  return {
    id,
    name,
    turn: worldState.turn,
    year: worldState.year,
    season: worldState.season,
    savedAt: new Date().toISOString(),
    factionCount: Object.keys(worldState.factions).length,
    characterCount: chars.filter(c => c.status !== 'dead').length,
    deadCount: chars.filter(c => c.status === 'dead').length,
    eventCount: worldState.eventLog.length,
  };
}

// ============================================================
// Public API for App.tsx
// ============================================================

export function autoSave(worldState: WorldState, turnResults: TurnResult[]): void {
  try {
    const data = buildSaveData(worldState, turnResults);
    localStorage.setItem(AUTO_SAVE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Auto-save failed (localStorage may be full):', e);
  }
}

export function loadAutoSave(): { worldState: WorldState; turnResults: TurnResult[] } | null {
  try {
    const raw = localStorage.getItem(AUTO_SAVE_KEY);
    if (!raw) return null;
    const data: SaveData = JSON.parse(raw);
    return {
      worldState: deserializeWorldState(data.worldState),
      turnResults: JSON.parse(data.turnResults),
    };
  } catch {
    return null;
  }
}

export function hasAutoSave(): boolean {
  return localStorage.getItem(AUTO_SAVE_KEY) !== null;
}

export function clearAutoSave(): void {
  localStorage.removeItem(AUTO_SAVE_KEY);
}

// ============================================================
// Export/Import
// ============================================================

function exportSaveFile(worldState: WorldState, turnResults: TurnResult[], name: string): void {
  const data = buildSaveData(worldState, turnResults);
  const meta = buildSlotMeta('export', name, worldState);
  const exportObj = { meta, data };
  const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `aurelian-${worldState.season.toLowerCase()}-year${worldState.year}-turn${worldState.turn}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importSaveFile(file: File): Promise<{ worldState: WorldState; turnResults: TurnResult[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(reader.result as string);
        // Support both raw WorldState and wrapped export format
        if (obj.data && obj.meta) {
          resolve({
            worldState: deserializeWorldState(obj.data.worldState),
            turnResults: JSON.parse(obj.data.turnResults),
          });
        } else if (obj.turn !== undefined && obj.factions) {
          // Raw WorldState (e.g. from CLI saves)
          resolve({ worldState: obj as WorldState, turnResults: [] });
        } else {
          reject(new Error('Unrecognized save file format'));
        }
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

// ============================================================
// SaveManager Component
// ============================================================

interface Props {
  worldState: WorldState;
  turnResults: TurnResult[];
  onLoad: (worldState: WorldState, turnResults: TurnResult[]) => void;
  onClose: () => void;
}

export default function SaveManager({ worldState, turnResults, onLoad, onClose }: Props) {
  const [slots, setSlots] = useState<SaveSlot[]>(() => getSaveIndex());
  const [saveName, setSaveName] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editingSlot, setEditingSlot] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Refresh index on mount
    setSlots(getSaveIndex());
  }, []);

  const flash = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSave = () => {
    if (slots.length >= MAX_MANUAL_SAVES) {
      flash(`Maximum ${MAX_MANUAL_SAVES} saves reached. Delete one first.`, 'error');
      return;
    }

    const id = `save_${Date.now()}`;
    const name = saveName.trim() || `${worldState.season}, Year ${worldState.year} (Turn ${worldState.turn})`;
    const slot = buildSlotMeta(id, name, worldState);
    const data = buildSaveData(worldState, turnResults);

    try {
      setSaveData(id, data);
      const updated = [slot, ...slots];
      setSaveIndex(updated);
      setSlots(updated);
      setSaveName('');
      flash(`Saved: ${name}`);
    } catch (e) {
      flash('Save failed — localStorage may be full.', 'error');
    }
  };

  const handleLoad = (slotId: string) => {
    const data = getSaveData(slotId);
    if (!data) {
      flash('Save data not found.', 'error');
      return;
    }
    try {
      const ws = deserializeWorldState(data.worldState);
      const tr: TurnResult[] = JSON.parse(data.turnResults);
      onLoad(ws, tr);
      flash('Loaded successfully.');
    } catch {
      flash('Failed to load save — data may be corrupted.', 'error');
    }
  };

  const handleDelete = (slotId: string) => {
    if (confirmDelete !== slotId) {
      setConfirmDelete(slotId);
      return;
    }
    deleteSaveData(slotId);
    const updated = slots.filter(s => s.id !== slotId);
    setSaveIndex(updated);
    setSlots(updated);
    setConfirmDelete(null);
    flash('Save deleted.');
  };

  const handleRename = (slotId: string) => {
    if (editingSlot === slotId) {
      // Save the rename
      const newName = editName.trim();
      if (newName) {
        const updated = slots.map(s => s.id === slotId ? { ...s, name: newName } : s);
        setSaveIndex(updated);
        setSlots(updated);
        flash(`Renamed to: ${newName}`);
      }
      setEditingSlot(null);
      setEditName('');
    } else {
      // Start editing
      const slot = slots.find(s => s.id === slotId);
      setEditingSlot(slotId);
      setEditName(slot?.name ?? '');
      setConfirmDelete(null);
    }
  };

  const handleOverwrite = (slotId: string) => {
    const slot = slots.find(s => s.id === slotId);
    if (!slot) return;
    const data = buildSaveData(worldState, turnResults);
    const updatedSlot = buildSlotMeta(slotId, slot.name, worldState);
    try {
      setSaveData(slotId, data);
      const updated = slots.map(s => s.id === slotId ? updatedSlot : s);
      setSaveIndex(updated);
      setSlots(updated);
      flash(`Overwritten: ${slot.name}`);
    } catch {
      flash('Overwrite failed — localStorage may be full.', 'error');
    }
  };

  const handleExport = () => {
    const name = saveName.trim() || `${worldState.season} Year ${worldState.year}`;
    exportSaveFile(worldState, turnResults, name);
    flash('Exported to file.');
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await importSaveFile(file);
      onLoad(result.worldState, result.turnResults);
      flash(`Imported: Turn ${result.worldState.turn}, Year ${result.worldState.year}`);
    } catch (err) {
      flash(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    }
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: 'var(--bg-secondary, #1a1a2e)',
        border: '1px solid var(--border, #333)',
        borderRadius: 8, padding: 20, width: 520, maxHeight: '80vh',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1rem' }}>Save & Load</h2>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: 'var(--text-muted)',
            fontSize: '1.2rem', cursor: 'pointer',
          }}>x</button>
        </div>

        {/* Current state info */}
        <div style={{
          fontSize: '0.75rem', color: 'var(--text-muted)',
          padding: '6px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: 4,
        }}>
          Current: {worldState.season}, Year {worldState.year}, Turn {worldState.turn}
          {' — '}
          {Object.values(worldState.characters ?? {}).filter(c => c.status !== 'dead').length} characters alive,{' '}
          {worldState.eventLog.length} events logged
        </div>

        {/* Save controls */}
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            type="text"
            placeholder="Save name (optional)"
            value={saveName}
            onChange={e => setSaveName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
            style={{
              flex: 1, padding: '5px 8px', fontSize: '0.75rem',
              background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border, #333)',
              borderRadius: 4, color: 'var(--text-primary, #eee)',
            }}
          />
          <button className="primary" onClick={handleSave} style={{ fontSize: '0.75rem', padding: '5px 12px' }}>
            Save Snapshot
          </button>
        </div>

        {/* Export / Import */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="secondary" onClick={handleExport} style={{ fontSize: '0.7rem', padding: '4px 10px' }}>
            Export to File
          </button>
          <button className="secondary" onClick={() => fileInputRef.current?.click()} style={{ fontSize: '0.7rem', padding: '4px 10px' }}>
            Import from File
          </button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
        </div>

        {/* Flash message */}
        {message && (
          <div style={{
            fontSize: '0.7rem', padding: '4px 10px', borderRadius: 4,
            background: message.type === 'success' ? 'rgba(60,180,80,0.15)' : 'rgba(200,60,60,0.15)',
            color: message.type === 'success' ? '#6c6' : '#c66',
          }}>
            {message.text}
          </div>
        )}

        {/* Save slots list */}
        <div style={{ overflow: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {slots.length === 0 && (
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', margin: '20px 0' }}>
              No saves yet. Click "Save Snapshot" to create one.
            </p>
          )}
          {slots.map(slot => (
            <div key={slot.id} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 10px', borderRadius: 4,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {editingSlot === slot.id ? (
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleRename(slot.id); if (e.key === 'Escape') { setEditingSlot(null); setEditName(''); } }}
                    autoFocus
                    style={{
                      width: '100%', padding: '2px 6px', fontSize: '0.75rem',
                      background: 'rgba(255,255,255,0.1)', border: '1px solid var(--accent-gold, #c90)',
                      borderRadius: 3, color: 'var(--text-primary, #eee)',
                    }}
                  />
                ) : (
                  <div style={{ fontSize: '0.75rem', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {slot.name}
                  </div>
                )}
                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  {slot.season}, Year {slot.year} (Turn {slot.turn})
                  {' — '}
                  {slot.characterCount} alive / {slot.deadCount} fallen
                  {' — '}
                  {slot.eventCount} events
                  {' — '}
                  {formatDate(slot.savedAt)}
                </div>
              </div>
              <button
                className="primary"
                onClick={() => handleLoad(slot.id)}
                style={{ fontSize: '0.65rem', padding: '3px 8px', whiteSpace: 'nowrap' }}
              >
                Load
              </button>
              <button
                onClick={() => handleOverwrite(slot.id)}
                title="Overwrite with current state"
                style={{
                  fontSize: '0.65rem', padding: '3px 6px', whiteSpace: 'nowrap',
                  background: 'rgba(100,140,200,0.15)', color: '#8af',
                  border: 'none', borderRadius: 4, cursor: 'pointer',
                }}
              >
                Overwrite
              </button>
              <button
                onClick={() => handleRename(slot.id)}
                style={{
                  fontSize: '0.65rem', padding: '3px 6px', whiteSpace: 'nowrap',
                  background: 'rgba(200,180,60,0.15)', color: '#cc6',
                  border: 'none', borderRadius: 4, cursor: 'pointer',
                }}
              >
                {editingSlot === slot.id ? 'Save' : 'Rename'}
              </button>
              <button
                onClick={() => handleDelete(slot.id)}
                style={{
                  fontSize: '0.65rem', padding: '3px 6px', whiteSpace: 'nowrap',
                  background: confirmDelete === slot.id ? '#c44' : 'rgba(200,60,60,0.15)',
                  color: confirmDelete === slot.id ? '#fff' : '#c66',
                  border: 'none', borderRadius: 4, cursor: 'pointer',
                }}
              >
                {confirmDelete === slot.id ? 'Confirm?' : 'Delete'}
              </button>
            </div>
          ))}
        </div>

        {/* Storage info */}
        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          {slots.length} / {MAX_MANUAL_SAVES} save slots used
          {' — '}
          Auto-save runs each turn
        </div>
      </div>
    </div>
  );
}
