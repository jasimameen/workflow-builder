'use client';

import { useState, useCallback } from 'react';
import { CustomField, FIELD_TYPE_COLORS } from '../lib/types';
import { Bookmark, BookmarkCheck, ChevronDown, ChevronRight, X, Check } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────────────────────────
interface Selected {
  path: string;       // JSONPath e.g. $.configuredValues.path
  value: unknown;
  type: CustomField['type'];
  displayKey: string; // human label e.g. "path"
}

interface InteractiveOutputViewerProps {
  data: unknown;
  customFields: CustomField[];
  /** Save value into an existing custom field */
  onSaveToField: (fieldId: string, value: unknown, type: CustomField['type']) => void;
  /** Create a brand-new custom field from this value */
  onCreateField: (key: string, value: unknown, type: CustomField['type']) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────
function detectType(value: unknown): CustomField['type'] {
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'object' && value !== null) return 'json';
  return 'text';
}

function valuePreview(value: unknown, max = 80): string {
  if (value === null || value === undefined) return 'null';
  const s = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return s.length > max ? s.slice(0, max) + '…' : s;
}

function serialise(value: unknown): string | number | boolean {
  if (typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'object' && value !== null) return JSON.stringify(value, null, 2);
  return String(value ?? '');
}

// Primitive value colour (matches n8n-style)
function primColour(value: unknown) {
  if (typeof value === 'string')  return '#059669';
  if (typeof value === 'number')  return '#0ea5e9';
  if (typeof value === 'boolean') return '#d97706';
  if (value === null)             return '#9ca3af';
  return '#374151';
}

// ─────────────────────────────────────────────────────────────────────────────
//  Recursive JSON node
// ─────────────────────────────────────────────────────────────────────────────
function JsonRow({
  keyName,
  value,
  path,
  depth,
  selected,
  savedPaths,
  onSelect,
}: {
  keyName: string | null;
  value: unknown;
  path: string;
  depth: number;
  selected: Selected | null;
  savedPaths: Set<string>;
  onSelect: (s: Selected) => void;
}) {
  const [open, setOpen] = useState(depth < 2);

  const isArr  = Array.isArray(value);
  const isObj  = !isArr && typeof value === 'object' && value !== null;
  const isPrim = !isArr && !isObj;
  const type   = detectType(value);
  const isSelected = selected?.path === path;
  const isSaved    = savedPaths.has(path);

  const entries: [string, unknown][] = isObj
    ? Object.entries(value as Record<string, unknown>)
    : isArr
    ? (value as unknown[]).map((v, i) => [String(i), v])
    : [];

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect({ path, value, type, displayKey: keyName ?? '$' });
  };

  const colors = FIELD_TYPE_COLORS[type] ?? FIELD_TYPE_COLORS.text;

  return (
    <div>
      <div
        onClick={handleClick}
        className={`flex items-center group cursor-pointer rounded px-1 py-[2px] transition-colors ${
          isSelected
            ? 'bg-violet-100 ring-1 ring-inset ring-violet-300'
            : 'hover:bg-gray-50'
        }`}
        style={{ paddingLeft: depth * 14 + 4 }}
      >
        {/* Expand arrow */}
        {!isPrim ? (
          <button
            onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
            className="mr-1 text-gray-400 hover:text-gray-600 flex-shrink-0 leading-none"
          >
            {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          </button>
        ) : (
          <span className="w-3.5 flex-shrink-0" />
        )}

        {/* Key */}
        {keyName !== null && (
          <span className="text-[10px] font-mono font-semibold text-indigo-600 mr-1 flex-shrink-0">
            &quot;{keyName}&quot;:
          </span>
        )}

        {/* Value (inline for primitives) */}
        {isPrim ? (
          <span className="text-[10px] font-mono truncate" style={{ color: primColour(value) }}>
            {typeof value === 'string' ? `"${value}"` : String(value)}
          </span>
        ) : (
          <span className="text-[10px] font-mono text-gray-400">
            {isArr ? `[${entries.length}]` : `{${entries.length}}`}
          </span>
        )}

        {/* Bookmark / save icon */}
        <span className="ml-auto pl-1 flex-shrink-0">
          {isSaved ? (
            <BookmarkCheck size={10} className="text-green-500" />
          ) : (
            <Bookmark
              size={10}
              className={`transition-opacity ${isSelected ? 'text-violet-500 opacity-100' : 'text-gray-300 opacity-0 group-hover:opacity-100'}`}
            />
          )}
        </span>
      </div>

      {/* Children */}
      {!isPrim && open && entries.map(([k, v]) => (
        <JsonRow
          key={k}
          keyName={k}
          value={v}
          path={`${path}.${k}`}
          depth={depth + 1}
          selected={selected}
          savedPaths={savedPaths}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Save panel (shown when a value is selected)
// ─────────────────────────────────────────────────────────────────────────────
function SavePanel({
  selected,
  customFields,
  onSaveToField,
  onCreateField,
  onDismiss,
  onSaved,
}: {
  selected: Selected;
  customFields: CustomField[];
  onSaveToField: (fieldId: string, value: unknown, type: CustomField['type']) => void;
  onCreateField: (key: string, value: unknown, type: CustomField['type']) => void;
  onDismiss: () => void;
  onSaved: (path: string) => void;
}) {
  // Auto-derive a sensible new-field key from the last path segment
  const suggestedKey = selected.displayKey === '$'
    ? 'output'
    : selected.displayKey.replace(/[^a-zA-Z0-9]/g, '_');

  const [target, setTarget]       = useState<string>(customFields.length > 0 ? customFields[0].id : 'new');
  const [newKey, setNewKey]       = useState(suggestedKey);
  const [newType, setNewType]     = useState<CustomField['type']>(selected.type);
  const [justSaved, setJustSaved] = useState(false);

  const colors = FIELD_TYPE_COLORS[newType] ?? FIELD_TYPE_COLORS.text;

  const handleSave = () => {
    const val = serialise(selected.value);
    if (target === 'new') {
      onCreateField(newKey || suggestedKey, val, newType);
    } else {
      onSaveToField(target, val, newType);
    }
    setJustSaved(true);
    onSaved(selected.path);
    setTimeout(onDismiss, 700);
  };

  const TYPE_OPTIONS: CustomField['type'][] = ['text', 'number', 'boolean', 'json', 'textarea'];

  return (
    <div className="mt-2 rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50 p-3 animate-in fade-in slide-in-from-top-1">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: colors.dot }}
          />
          <span className="text-[10px] font-bold text-violet-800">
            Save{' '}
            <code className="font-mono bg-white border border-violet-200 px-1 rounded text-violet-700">
              {selected.displayKey === '$' ? 'full response' : selected.displayKey}
            </code>
            {' '}to field
          </span>
        </div>
        <button onClick={onDismiss} className="text-gray-400 hover:text-gray-600 transition-colors">
          <X size={11} />
        </button>
      </div>

      {/* Value preview */}
      <div className="mb-2 px-2 py-1.5 bg-white rounded-lg border border-violet-100 flex items-start gap-1.5">
        <span className="text-[8px] text-gray-400 uppercase font-bold mt-0.5 flex-shrink-0">value</span>
        <span className="text-[9px] font-mono text-gray-700 break-all leading-relaxed">
          {valuePreview(selected.value)}
        </span>
      </div>

      {/* JSONPath + auto-detected type */}
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-[8px] text-gray-400 uppercase font-bold flex-shrink-0">path</span>
        <code className="text-[9px] font-mono text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded truncate flex-1">
          {selected.path}
        </code>
      </div>

      {/* Destination + type row */}
      <div className="space-y-2">
        <div>
          <label className="text-[9px] font-semibold text-gray-500 mb-0.5 block">Save to</label>
          <select
            className="w-full text-[10px] bg-white border border-violet-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-300"
            value={target}
            onChange={e => setTarget(e.target.value)}
          >
            {customFields.map(cf => {
              const c = FIELD_TYPE_COLORS[cf.type] ?? FIELD_TYPE_COLORS.text;
              return (
                <option key={cf.id} value={cf.id}>
                  {cf.label} ({cf.key}) · {cf.type}
                </option>
              );
            })}
            <option value="new">✚ Create new custom field</option>
          </select>
        </div>

        {/* New field key input */}
        {target === 'new' && (
          <div className="flex gap-1.5">
            <div className="flex-1">
              <label className="text-[9px] font-semibold text-gray-500 mb-0.5 block">Field key</label>
              <input
                type="text"
                autoFocus
                className="w-full text-[10px] bg-white border border-violet-200 rounded-lg px-2 py-1.5 font-mono focus:outline-none focus:ring-1 focus:ring-violet-300"
                value={newKey}
                onChange={e => setNewKey(e.target.value.replace(/\s/g, '_').replace(/[^a-zA-Z0-9_]/g, ''))}
                placeholder={suggestedKey}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
              />
            </div>
            <div className="flex-shrink-0">
              <label className="text-[9px] font-semibold text-gray-500 mb-0.5 block">Type</label>
              <select
                className="text-[9px] bg-white border border-violet-200 rounded-lg px-1.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-300 font-semibold"
                style={{ color: colors.text }}
                value={newType}
                onChange={e => setNewType(e.target.value as CustomField['type'])}
              >
                {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={target === 'new' && !newKey.trim()}
        className={`mt-2.5 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl font-bold text-[11px] transition-all ${
          justSaved
            ? 'bg-green-500 text-white'
            : 'bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 active:scale-95 shadow-sm shadow-violet-200'
        }`}
      >
        {justSaved ? (
          <><Check size={12} /> Saved!</>
        ) : (
          <>💾 Save to {target === 'new' ? 'new' : 'existing'} field</>
        )}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Root component
// ─────────────────────────────────────────────────────────────────────────────
export default function InteractiveOutputViewer({
  data,
  customFields,
  onSaveToField,
  onCreateField,
}: InteractiveOutputViewerProps) {
  const [selected, setSelected]     = useState<Selected | null>(null);
  const [savedPaths, setSavedPaths] = useState<Set<string>>(new Set());

  const handleSelect = useCallback((s: Selected) => {
    setSelected(prev => prev?.path === s.path ? null : s);
  }, []);

  const handleSaved = useCallback((path: string) => {
    setSavedPaths(prev => new Set([...prev, path]));
  }, []);

  const isRootObj = typeof data === 'object' && data !== null;

  return (
    <div className="text-[10px] leading-relaxed">
      {/* Root row — click to save entire response */}
      <div
        onClick={() => handleSelect({ path: '$', value: data, type: 'json', displayKey: '$' })}
        className={`flex items-center gap-1 px-1.5 py-[3px] rounded cursor-pointer group mb-0.5 transition-colors ${
          selected?.path === '$'
            ? 'bg-violet-100 ring-1 ring-inset ring-violet-300'
            : 'hover:bg-gray-50'
        }`}
      >
        <span className="text-[9px] font-mono font-bold text-gray-400">$</span>
        <span className="text-[9px] text-gray-400">— full response</span>
        <span className="ml-auto">
          {savedPaths.has('$') ? (
            <BookmarkCheck size={9} className="text-green-500" />
          ) : (
            <Bookmark size={9} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </span>
      </div>

      {/* JSON tree */}
      <div className="ml-1">
        {isRootObj
          ? Object.entries(data as Record<string, unknown>).map(([k, v]) => (
              <JsonRow
                key={k}
                keyName={k}
                value={v}
                path={`$.${k}`}
                depth={0}
                selected={selected}
                savedPaths={savedPaths}
                onSelect={handleSelect}
              />
            ))
          : (
            <span style={{ color: primColour(data) }} className="font-mono px-1">
              {String(data)}
            </span>
          )
        }
      </div>

      {/* Save panel */}
      {selected && (
        <SavePanel
          selected={selected}
          customFields={customFields}
          onSaveToField={onSaveToField}
          onCreateField={onCreateField}
          onDismiss={() => setSelected(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
