'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { Node as RFNode } from '@xyflow/react';
import { WorkflowNodeData, SavedVariable, FIELD_TYPE_COLORS } from '../lib/types';
import { Braces, Database, Zap } from 'lucide-react';

interface VariablePickerProps {
  allNodes: RFNode<WorkflowNodeData>[];
  savedVariables: SavedVariable[];
  onInsert: (text: string) => void;
}

const SYSTEM_VARS = [
  { key: 'date',           desc: 'Current date (YYYY-MM-DD)' },
  { key: 'datetime',       desc: 'Full ISO timestamp' },
  { key: 'timestamp',      desc: 'Unix timestamp (seconds)' },
  { key: 'workflow_name',  desc: 'Name of this workflow' },
  { key: 'run_id',         desc: 'Unique run identifier' },
  { key: 'env.MY_VAR',     desc: 'Environment variable' },
];

export default function VariablePicker({ allNodes, savedVariables, onInsert }: VariablePickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (
        panelRef.current && target && !panelRef.current.contains(target) &&
        btnRef.current && !btnRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleInsert = useCallback((key: string) => {
    onInsert(`{${key}}`);
    setOpen(false);
    setSearch('');
  }, [onInsert]);

  // Collect custom fields from all nodes
  const allCustomVars: Array<{ key: string; label: string; type: string; nodeName: string }> = [];
  for (const node of allNodes) {
    for (const cf of node.data.customFields || []) {
      if (!cf.key) continue;
      allCustomVars.push({
        key: cf.key,
        label: cf.label || cf.key,
        type: cf.type,
        nodeName: node.data.label || node.data.nodeConfig?.label || 'Node',
      });
    }
  }

  const q = search.toLowerCase();
  const filteredCustom = allCustomVars.filter(v => !q || v.key.includes(q) || v.label.toLowerCase().includes(q));
  const filteredSaved = savedVariables.filter(v => !q || v.key.includes(q) || v.label.toLowerCase().includes(q));
  const filteredSystem = SYSTEM_VARS.filter(v => !q || v.key.includes(q) || v.desc.toLowerCase().includes(q));

  const totalCount = filteredCustom.length + filteredSaved.length + filteredSystem.length;

  return (
    <div className="relative flex-shrink-0">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        title="Insert variable reference"
        className={`flex items-center justify-center w-6 h-6 rounded text-[10px] font-bold border transition-all ${
          open
            ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
            : 'bg-violet-50 text-violet-600 border-violet-200 hover:bg-violet-100 hover:border-violet-400'
        }`}
      >
        <Braces size={11} />
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-8 z-50 w-64 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
          style={{ minWidth: 240 }}
        >
          {/* Header */}
          <div className="px-3 py-2 bg-gradient-to-r from-violet-50 to-indigo-50 border-b border-gray-100">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Braces size={11} className="text-violet-600" />
              <span className="text-[11px] font-bold text-violet-700">Insert Variable</span>
            </div>
            <input
              autoFocus
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search variables..."
              className="w-full text-[10px] bg-white border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-violet-300"
            />
          </div>

          <div className="overflow-y-auto" style={{ maxHeight: 280 }}>
            {totalCount === 0 && (
              <div className="px-3 py-4 text-center text-[10px] text-gray-400">No variables found</div>
            )}

            {/* ── Custom Fields ────────────────────────────────────── */}
            {filteredCustom.length > 0 && (
              <div>
                <div className="px-3 pt-2 pb-1 flex items-center gap-1">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Custom Fields</span>
                  <span className="text-[8px] bg-gray-100 text-gray-500 rounded-full px-1">{filteredCustom.length}</span>
                </div>
                {filteredCustom.map((v, i) => {
                  const colors = FIELD_TYPE_COLORS[v.type] || FIELD_TYPE_COLORS.text;
                  return (
                    <button
                      key={`cf-${i}`}
                      onClick={() => handleInsert(v.key)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-left transition-colors"
                    >
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: colors.dot }}
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-[11px] font-mono font-semibold text-gray-800">{`{${v.key}}`}</span>
                        <span className="text-[9px] text-gray-400 ml-1 truncate">· {v.nodeName}</span>
                      </div>
                      <span
                        className="text-[8px] px-1 py-0.5 rounded font-semibold flex-shrink-0"
                        style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
                      >
                        {v.type}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* ── Saved Outputs ─────────────────────────────────────── */}
            {filteredSaved.length > 0 && (
              <div>
                <div className="px-3 pt-2 pb-1 flex items-center gap-1">
                  <Database size={9} className="text-gray-400" />
                  <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Saved Outputs</span>
                  <span className="text-[8px] bg-emerald-100 text-emerald-600 rounded-full px-1">{filteredSaved.length}</span>
                </div>
                {filteredSaved.map((v) => {
                  const colors = FIELD_TYPE_COLORS[v.type] || FIELD_TYPE_COLORS.text;
                  return (
                    <button
                      key={v.id}
                      onClick={() => handleInsert(v.key)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-emerald-50 text-left transition-colors"
                    >
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: colors.dot }}
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-[11px] font-mono font-semibold text-gray-800">{`{${v.key}}`}</span>
                        <span className="text-[9px] text-gray-400 ml-1 truncate">· {v.nodeName}</span>
                      </div>
                      <span className="text-[8px] px-1 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold flex-shrink-0">saved</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* ── System Variables ──────────────────────────────────── */}
            {filteredSystem.length > 0 && (
              <div>
                <div className="px-3 pt-2 pb-1 flex items-center gap-1">
                  <Zap size={9} className="text-gray-400" />
                  <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">System</span>
                </div>
                {filteredSystem.map((v) => (
                  <button
                    key={v.key}
                    onClick={() => handleInsert(v.key)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-amber-50 text-left transition-colors"
                  >
                    <span className="w-2 h-2 rounded-full flex-shrink-0 bg-amber-400" />
                    <div className="flex-1 min-w-0">
                      <span className="text-[11px] font-mono font-semibold text-gray-800">{`{${v.key}}`}</span>
                    </div>
                    <span className="text-[9px] text-gray-400 truncate" style={{ maxWidth: 90 }}>{v.desc}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="px-3 py-1.5 bg-gray-50 border-t border-gray-100">
            <p className="text-[9px] text-gray-400">Click to insert <code className="font-mono">{'{key}'}</code> at cursor</p>
          </div>
        </div>
      )}
    </div>
  );
}
