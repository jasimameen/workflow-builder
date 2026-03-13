'use client';

import { useState, useMemo } from 'react';
import { NODE_LIBRARY, NODE_CATEGORIES, NodeConfig } from '../lib/types';
import { NodeIcon } from '../lib/icons';
import { Search, GripVertical, ChevronRight, Zap, Settings2, SendHorizonal } from 'lucide-react';

interface NodeLibraryProps {
  onDragStart: (e: React.DragEvent, config: NodeConfig) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Pillar configuration — Input / Action / Output
// ─────────────────────────────────────────────────────────────────────────────

const INPUT_TYPES  = new Set(['trigger']);
const OUTPUT_TYPES = new Set(['send', 'end']);
type Pillar = 'input' | 'action' | 'output';

const PILLAR_META: Record<Pillar, {
  label: string;
  icon: React.ReactNode;
  color: string;
  accent: string;
  hint: string;
}> = {
  input:  { label: 'Input',  icon: <Zap size={11} />,           color: '#d97706', accent: '#fef3c7', hint: 'What starts your workflow'   },
  action: { label: 'Action', icon: <Settings2 size={11} />,     color: '#4f46e5', accent: '#eef2ff', hint: 'Processing, AI, data, logic'  },
  output: { label: 'Output', icon: <SendHorizonal size={11} />, color: '#0369a1', accent: '#e0f2fe', hint: 'Send results or end the flow' },
};

// Sub-sections inside the Action pillar
const ACTION_SECTIONS: { types: string[]; label: string; emoji: string; color: string }[] = [
  { types: ['ai'],        label: 'AI & Agents',    emoji: '🤖', color: '#db2777' },
  { types: ['flow'],      label: 'Flow Control',   emoji: '🔀', color: '#e05c2e' },
  { types: ['data'],      label: 'Data & Files',   emoji: '📊', color: '#059669' },
  { types: ['transform'], label: 'Transform',      emoji: '⚙️', color: '#7c3aed' },
  { types: ['external'],  label: 'External & API', emoji: '🌐', color: '#0891b2' },
  { types: ['code'],      label: 'Code & Custom',  emoji: '💻', color: '#374151' },
];

function classifyNode(n: NodeConfig): Pillar {
  if (INPUT_TYPES.has(n.type))  return 'input';
  if (OUTPUT_TYPES.has(n.type)) return 'output';
  return 'action';
}

// ─────────────────────────────────────────────────────────────────────────────

export default function NodeLibrary({ onDragStart }: NodeLibraryProps) {
  const [search, setSearch]           = useState('');
  const [openPillars, setOpenPillars] = useState<Set<Pillar>>(new Set(['input', 'action', 'output']));
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['AI & Agents', 'Flow Control']));

  const groups = useMemo(() => ({
    input:  NODE_LIBRARY.filter(n => classifyNode(n) === 'input'),
    action: NODE_LIBRARY.filter(n => classifyNode(n) === 'action'),
    output: NODE_LIBRARY.filter(n => classifyNode(n) === 'output'),
  }), []);

  const lc = search.toLowerCase().trim();
  const searchResults = useMemo(() => {
    if (!lc) return null;
    return NODE_LIBRARY.filter(n =>
      n.label.toLowerCase().includes(lc) ||
      n.description.toLowerCase().includes(lc) ||
      n.id.toLowerCase().includes(lc) ||
      n.type.toLowerCase().includes(lc),
    );
  }, [lc]);

  const togglePillar  = (p: Pillar) => setOpenPillars(prev  => { const s = new Set(prev); s.has(p) ? s.delete(p) : s.add(p); return s; });
  const toggleSection = (s: string) => setOpenSections(prev => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n; });

  return (
    <div className="flex flex-col h-full" style={{ background: '#fafbfd', borderRight: '1px solid #e8eaf0' }}>
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="px-3 pt-3 pb-2.5 flex-shrink-0" style={{ borderBottom: '1px solid #eef0f5' }}>
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[12px] font-black text-gray-800">Nodes</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: '#eef0f5', color: '#94a3b8' }}>
            {NODE_LIBRARY.length}
          </span>
        </div>
        <div className="relative">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search nodes…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full text-[11px] pl-7 pr-6 py-1.5 rounded-lg focus:outline-none transition-all"
            style={{ background: 'white', border: '1px solid #e2e5ef', color: '#374151' }}
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors text-[10px]">
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Drag hint */}
      <div className="mx-2.5 mt-2 mb-1 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 flex-shrink-0"
        style={{ background: '#f0f4ff', border: '1px solid #c7d2fe' }}>
        <GripVertical size={10} className="text-indigo-400 flex-shrink-0" />
        <p className="text-[9px] text-indigo-600 font-medium">Drag onto canvas to add a step</p>
      </div>

      {/* ── Node list ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-2 pb-4">

        {/* Search results */}
        {searchResults ? (
          <div className="py-2 space-y-1">
            {searchResults.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-2xl mb-2">🔍</div>
                <p className="text-[11px] text-gray-400">No nodes match &quot;{search}&quot;</p>
              </div>
            ) : (
              <>
                <p className="text-[9px] text-gray-400 px-1 pb-1">{searchResults.length} result{searchResults.length !== 1 ? 's' : ''}</p>
                {searchResults.map(cfg => <NodeCard key={cfg.id} config={cfg} onDragStart={onDragStart} />)}
              </>
            )}
          </div>
        ) : (
          /* Pillar sections */
          <div className="pt-1 space-y-0.5">
            {(['input', 'action', 'output'] as Pillar[]).map(pillar => {
              const meta    = PILLAR_META[pillar];
              const nodes   = groups[pillar];
              const isOpen  = openPillars.has(pillar);

              return (
                <div key={pillar}>
                  {/* Pillar header button */}
                  <button
                    onClick={() => togglePillar(pillar)}
                    className="w-full flex items-center gap-2 px-2.5 py-2 mt-1 rounded-xl transition-all"
                    style={{
                      background: isOpen ? meta.accent : 'transparent',
                      border: `1px solid ${isOpen ? meta.color + '30' : 'transparent'}`,
                    }}
                  >
                    <span style={{ color: meta.color }}>{meta.icon}</span>
                    <span className="text-[12px] font-black flex-1 text-left" style={{ color: meta.color }}>
                      {meta.label}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                      style={{ background: meta.color + '18', color: meta.color }}>
                      {nodes.length}
                    </span>
                    <ChevronRight size={11} className="transition-transform duration-150"
                      style={{ color: meta.color, transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }} />
                  </button>

                  {isOpen && (
                    <div className="pb-1">
                      {pillar === 'action' ? (
                        /* Action: sub-sections */
                        <div className="space-y-0.5 mt-0.5">
                          {ACTION_SECTIONS.map(sec => {
                            const secNodes = nodes.filter(n => sec.types.includes(n.type));
                            if (secNodes.length === 0) return null;
                            const secOpen = openSections.has(sec.label);
                            return (
                              <div key={sec.label} className="mx-1">
                                <button
                                  onClick={() => toggleSection(sec.label)}
                                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors hover:bg-white"
                                >
                                  <span className="text-[11px]">{sec.emoji}</span>
                                  <span className="text-[10px] font-bold flex-1 text-left" style={{ color: sec.color }}>
                                    {sec.label}
                                  </span>
                                  <span className="text-[8px] px-1 py-0.5 rounded font-semibold"
                                    style={{ background: sec.color + '14', color: sec.color }}>
                                    {secNodes.length}
                                  </span>
                                  <ChevronRight size={9} className="transition-transform duration-150"
                                    style={{ color: sec.color + '80', transform: secOpen ? 'rotate(90deg)' : '' }} />
                                </button>
                                {secOpen && (
                                  <div className="ml-1 mt-0.5 space-y-0.5">
                                    {secNodes.map(cfg => <NodeCard key={cfg.id} config={cfg} onDragStart={onDragStart} />)}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        /* Input / Output: flat */
                        <div className="mt-0.5 mx-1 space-y-0.5">
                          {nodes.map(cfg => <NodeCard key={cfg.id} config={cfg} onDragStart={onDragStart} />)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Node card — draggable tile
// ─────────────────────────────────────────────────────────────────────────────

function NodeCard({ config, onDragStart }: {
  config: NodeConfig;
  onDragStart: (e: React.DragEvent, config: NodeConfig) => void;
}) {
  // Pillar color for the left stripe
  const pillar = INPUT_TYPES.has(config.type) ? 'input' : OUTPUT_TYPES.has(config.type) ? 'output' : 'action';
  const pillarColor = PILLAR_META[pillar].color;

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, config)}
      className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl cursor-grab active:cursor-grabbing transition-all duration-100 group select-none hover:-translate-y-px"
      style={{
        background: 'white',
        border: `1.5px solid ${config.borderColor}28`,
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        borderLeft: `3px solid ${config.borderColor}`,
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = config.borderColor + '70';
        el.style.boxShadow   = `0 2px 8px ${config.borderColor}18`;
        el.style.borderLeftColor = config.borderColor;
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor     = config.borderColor + '28';
        el.style.boxShadow       = '0 1px 2px rgba(0,0,0,0.04)';
        el.style.borderLeftColor = config.borderColor;
      }}
    >
      {/* Icon */}
      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: config.bgColor, color: config.color }}>
        <NodeIcon name={config.iconName} size={13} />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-bold leading-tight truncate" style={{ color: config.color }}>
          {config.label}
        </div>
        <div className="text-[9px] text-gray-400 leading-tight mt-px line-clamp-1 group-hover:text-gray-500 transition-colors">
          {config.description}
        </div>
      </div>

      {/* Drag indicator */}
      <GripVertical size={9} className="text-gray-300 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}
