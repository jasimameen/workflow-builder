'use client';

import { useState } from 'react';
import { NODE_LIBRARY, NODE_CATEGORIES, NodeCategory, NodeConfig } from '../lib/types';
import { NodeIcon } from '../lib/icons';
import { Search, ChevronRight, GripVertical } from 'lucide-react';

interface NodeLibraryProps {
  onDragStart: (e: React.DragEvent, config: NodeConfig) => void;
}

const CAT_ORDER: NodeCategory[] = ['trigger', 'flow', 'data', 'transform', 'send', 'external', 'ai', 'code', 'end'];

export default function NodeLibrary({ onDragStart }: NodeLibraryProps) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<NodeCategory>>(
    new Set(['trigger', 'flow', 'data', 'ai'])
  );

  const lc = search.toLowerCase();
  const filtered = search
    ? NODE_LIBRARY.filter(n =>
        n.label.toLowerCase().includes(lc) ||
        n.description.toLowerCase().includes(lc) ||
        n.type.toLowerCase().includes(lc)
      )
    : null;

  const toggle = (cat: NodeCategory) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const totalNodes = NODE_LIBRARY.length;

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-100">
      {/* Header */}
      <div className="px-3 pt-3 pb-2.5 border-b border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[12px] font-bold text-gray-800">Node Library</h2>
          <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{totalNodes}</span>
        </div>
        <div className="relative">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search nodes..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-6.5 pl-7 pr-3 py-1.5 text-[11px] bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400 transition-colors"
          />
        </div>
      </div>

      {/* Drag hint */}
      <div className="mx-2.5 mt-2 mb-1 px-2.5 py-1.5 bg-orange-50 border border-orange-100 rounded-lg flex items-center gap-1.5">
        <GripVertical size={10} className="text-orange-400 flex-shrink-0" />
        <p className="text-[9px] text-orange-600 font-medium leading-tight">
          Drag nodes onto the canvas to build your workflow
        </p>
      </div>

      {/* Node list */}
      <div className="flex-1 overflow-y-auto px-2.5 py-1.5 space-y-0.5">
        {filtered ? (
          // Search results flat
          <div className="space-y-1">
            {filtered.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-[11px] text-gray-400">No nodes match &ldquo;{search}&rdquo;</p>
              </div>
            ) : (
              filtered.map(config => (
                <NodeCard key={config.id} config={config} onDragStart={onDragStart} />
              ))
            )}
          </div>
        ) : (
          // Grouped by category
          CAT_ORDER.map(cat => {
            const catNodes = NODE_LIBRARY.filter(n => n.type === cat);
            const catInfo = NODE_CATEGORIES[cat];
            const isOpen = expanded.has(cat);
            return (
              <div key={cat} className="mb-0.5">
                <button
                  onClick={() => toggle(cat)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors group"
                >
                  <div
                    className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                    style={{ background: `${catInfo.color}18`, color: catInfo.color }}
                  >
                    <NodeIcon name={catInfo.iconName} size={10} className="" />
                  </div>
                  <span className="text-[11px] font-semibold text-gray-700 flex-1 text-left">{catInfo.label}</span>
                  <span className="text-[9px] text-gray-400 bg-gray-100 px-1 rounded">{catNodes.length}</span>
                  <ChevronRight
                    size={10}
                    className={`text-gray-400 transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`}
                  />
                </button>
                {isOpen && (
                  <div className="ml-1 mt-0.5 space-y-0.5 animate-fade-in">
                    {catNodes.map(config => (
                      <NodeCard key={config.id} config={config} onDragStart={onDragStart} />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function NodeCard({ config, onDragStart }: { config: NodeConfig; onDragStart: (e: React.DragEvent, config: NodeConfig) => void }) {
  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, config)}
      style={{
        borderLeft: `3px solid ${config.borderColor}`,
        background: config.bgColor,
        color: config.color,
      }}
      className="flex items-center gap-2 px-2.5 py-1.5 rounded-r-lg rounded-l-sm cursor-grab active:cursor-grabbing hover:shadow-sm transition-all duration-100 hover:-translate-y-px select-none group"
    >
      {/* Icon */}
      <div
        className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center"
        style={{ background: `${config.borderColor}20` }}
      >
        <NodeIcon name={config.iconName} size={11} />
      </div>
      {/* Text */}
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold leading-tight truncate" style={{ color: config.color }}>
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
