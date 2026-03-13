'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Node, Edge } from '@xyflow/react';
import {
  WorkflowNodeData,
  FieldConfig,
  CustomField,
  SavedVariable,
  NodeTestState,
  FIELD_TYPE_COLORS,
} from '../lib/types';
import { NodeIcon } from '../lib/icons';
import {
  getAvailableVariables,
  computeNodeOutputs,
  varTypeColor,
  AvailableVariable,
  ResolvedOutput,
} from '../lib/nodeIO';
import VariablePicker from './VariablePicker';
import InteractiveOutputViewer from './InteractiveOutputViewer';
import HttpRequestBuilder from './HttpRequestBuilder';
import {
  Plus, Trash2, ChevronDown, ChevronRight, Play, Copy, Check,
  AlertCircle, CheckCircle, Clock, Loader2, Eye, EyeOff, Key,
  Pencil, X, Database, Zap,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
//  Props
// ─────────────────────────────────────────────────────────────────────────────

interface PropertiesPanelProps {
  selectedNode: Node<WorkflowNodeData> | null;
  onUpdateNode: (id: string, updates: Partial<WorkflowNodeData>) => void;
  onDeleteNode: (id: string) => void;
  allNodes: Node<WorkflowNodeData>[];
  edges: Edge[];
  savedVariables: SavedVariable[];
  onSaveVariable: (v: SavedVariable) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Friendly labels for node types
// ─────────────────────────────────────────────────────────────────────────────

const FRIENDLY_TYPE: Record<string, { label: string; emoji: string; color: string; bg: string }> = {
  trigger:   { label: 'Trigger',       emoji: '⚡', color: '#d97706', bg: '#fef3c7' },
  flow:      { label: 'Flow control',  emoji: '🔀', color: '#e05c2e', bg: '#fff7ed' },
  data:      { label: 'Data source',   emoji: '📊', color: '#059669', bg: '#ecfdf5' },
  transform: { label: 'Transform',     emoji: '⚙️', color: '#7c3aed', bg: '#f5f3ff' },
  send:      { label: 'Send message',  emoji: '✉️', color: '#0369a1', bg: '#e0f2fe' },
  external:  { label: 'External call', emoji: '🌐', color: '#0891b2', bg: '#ecfeff' },
  ai:        { label: 'AI step',       emoji: '🤖', color: '#db2777', bg: '#fdf2f8' },
  code:      { label: 'Custom code',   emoji: '💻', color: '#374151', bg: '#f3f4f6' },
  end:       { label: 'End',           emoji: '🏁', color: '#6b7280', bg: '#f9fafb' },
};

// ─────────────────────────────────────────────────────────────────────────────
//  Empty / no-node-selected state
// ─────────────────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col h-full bg-white" style={{ borderLeft: '1px solid #eef0f5' }}>
      <div className="px-4 pt-4 pb-3 border-b border-gray-100">
        <p className="text-[13px] font-bold text-gray-700">Step Settings</p>
        <p className="text-[11px] text-gray-400 mt-0.5">Click any step on the canvas to configure it</p>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5">
        {[
          { emoji: '👆', title: 'Select a step', body: 'Click any step on the canvas to open its settings here.' },
          { emoji: '✏️', title: 'Fill in the details', body: 'Each step has simple fields — no technical knowledge needed.' },
          { emoji: '🔗', title: 'Use data from earlier steps', body: 'Type {{ or click "Insert value" to pull data from a previous step.' },
          { emoji: '▶️', title: 'Try it out', body: 'Test a single step with sample data using the Try It tab.' },
        ].map(tip => (
          <div key={tip.emoji} className="flex items-start gap-3 p-3 rounded-xl"
            style={{ background: '#f8f9fc', border: '1px solid #eef0f5' }}>
            <span className="text-xl flex-shrink-0">{tip.emoji}</span>
            <div>
              <p className="text-[12px] font-bold text-gray-700">{tip.title}</p>
              <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">{tip.body}</p>
            </div>
          </div>
        ))}

        <div className="p-3 rounded-xl" style={{ background: '#f0f4ff', border: '1px solid #c7d2fe' }}>
          <p className="text-[11px] font-bold text-indigo-700 mb-1">💡 How data flows between steps</p>
          <p className="text-[11px] text-indigo-600 leading-relaxed">
            Each step can pass results to the next using values like{' '}
            <code className="bg-indigo-100 text-indigo-800 px-1 rounded font-mono text-[10px]">{'{{email_subject}}'}</code>{' '}
            or{' '}
            <code className="bg-indigo-100 text-indigo-800 px-1 rounded font-mono text-[10px]">{'{{customer_name}}'}</code>.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  "From earlier steps" — upstream variable strip
// ─────────────────────────────────────────────────────────────────────────────

function UpstreamVarStrip({
  vars,
  onCopy,
}: {
  vars: AvailableVariable[];
  onCopy: (token: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (key: string) => {
    const token = `{{${key}}}`;
    navigator.clipboard.writeText(token).catch(() => {});
    onCopy(token);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1600);
  };

  if (vars.length === 0) {
    return (
      <div className="mx-4 mb-3 px-3 py-2.5 rounded-xl flex items-center gap-2"
        style={{ background: '#fafbfd', border: '1px dashed #d1d5db' }}>
        <span className="text-[13px]">🔗</span>
        <div>
          <p className="text-[10px] font-semibold text-gray-500">No data from earlier steps yet</p>
          <p className="text-[9px] text-gray-400">Connect a step before this one to use its output here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-4 mb-3 rounded-xl overflow-hidden"
      style={{ border: `1px solid ${open ? '#a5b4fc' : '#e2e5ef'}`, transition: 'border-color 0.15s' }}>
      {/* Header row */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2.5 px-3 py-2 transition-colors"
        style={{ background: open ? '#f0f4ff' : '#fafbfd' }}
      >
        <span className="text-[13px]">🔗</span>
        <span className="text-[10px] font-bold text-indigo-700 flex-1 text-left">
          {vars.length} value{vars.length !== 1 ? 's' : ''} from earlier steps
        </span>
        <span className="text-[9px] text-indigo-400 font-medium mr-1">
          {open ? 'hide' : 'click to use'}
        </span>
        <ChevronDown size={11} className="text-indigo-400 transition-transform duration-150"
          style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }} />
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1" style={{ background: '#f8faff' }}>
          <p className="text-[9px] text-indigo-500 mb-2">
            Click any value to copy it, then paste it into a field below.
          </p>
          <div className="grid grid-cols-1 gap-1">
            {vars.map(v => {
              const c = varTypeColor(v.type);
              const isCopied = copiedKey === v.key;
              return (
                <button
                  key={`${v.nodeId}-${v.key}`}
                  onClick={() => handleCopy(v.key)}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-all group"
                  style={{
                    background: isCopied ? '#dcfce7' : c.bg,
                    border: `1px solid ${isCopied ? '#86efac' : c.border}`,
                  }}
                >
                  {/* Node icon */}
                  <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                    style={{ background: v.nodeBg || c.bg, color: v.nodeColor || c.text }}>
                    <NodeIcon name={v.nodeIconName} size={10} />
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <code className="text-[10px] font-mono font-bold" style={{ color: isCopied ? '#16a34a' : c.text }}>
                        {`{{${v.key}}}`}
                      </code>
                      <span className="text-[8px] px-1 rounded-sm font-medium"
                        style={{ background: `${c.border}60`, color: c.text }}>
                        {v.type}
                      </span>
                    </div>
                    <div className="text-[8px] text-gray-400 truncate">from {v.nodeName}</div>
                  </div>
                  {/* Action */}
                  <span className="text-[9px] flex-shrink-0 flex items-center gap-0.5 font-semibold transition-colors"
                    style={{ color: isCopied ? '#16a34a' : '#94a3b8' }}>
                    {isCopied ? <><Check size={9} /> Copied!</> : <><Copy size={9} /> Copy</>}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Built-in output row — locked, cannot be edited or removed
// ─────────────────────────────────────────────────────────────────────────────

function BuiltInOutputRow({ output }: { output: ResolvedOutput }) {
  const c = varTypeColor(output.type);
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1.5px solid ${c.border}` }}>
      <div className="flex items-center gap-2 px-3 py-2" style={{ background: c.bg }}>
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.dot }} />
        <code className="text-[10px] font-mono font-bold flex-1 min-w-0 truncate" style={{ color: c.text }}>
          {`{{${output.key}}}`}
        </code>
        {output.label && (
          <span className="text-[9px] text-gray-400 italic truncate max-w-[80px]">{output.label}</span>
        )}
        <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
          style={{ background: `${c.border}80`, color: c.text }}>
          {output.type}
        </span>
        <span className="text-[8px] text-gray-400 flex items-center gap-0.5 flex-shrink-0 select-none">
          🔒
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Inline editable step name
// ─────────────────────────────────────────────────────────────────────────────

function InlineEditName({
  value,
  onChange,
  fallback,
  nodeColor,
}: {
  value: string;
  onChange: (v: string) => void;
  fallback: string;
  nodeColor: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || fallback);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setDraft(value || fallback);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };
  const commit = () => {
    onChange(draft.trim() || fallback);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="text-[15px] font-black leading-tight text-gray-800 bg-transparent border-b-2 focus:outline-none w-full"
        style={{ borderColor: nodeColor }}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
      />
    );
  }

  return (
    <button onClick={startEdit} className="flex items-center gap-1.5 group text-left">
      <span className="text-[15px] font-black text-gray-800 leading-tight">
        {value || fallback}
      </span>
      <Pencil size={10} className="text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0" />
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Tab button
// ─────────────────────────────────────────────────────────────────────────────

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2 text-[11px] font-semibold transition-colors border-b-2 ${
        active
          ? 'text-indigo-600 border-indigo-500 bg-white'
          : 'text-gray-400 border-transparent hover:text-gray-600 hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Shared: parse a string into text / token segments
// ─────────────────────────────────────────────────────────────────────────────

type VarSegment =
  | { kind: 'text'; content: string }
  | { kind: 'system'; key: string; varInfo: AvailableVariable }
  | { kind: 'custom'; key: string }
  | { kind: 'unknown'; key: string };

function parseSegments(
  str: string,
  upstreamVars: AvailableVariable[],
  customFieldKeys: string[],
): { segments: VarSegment[]; hasToken: boolean } {
  const upstreamMap = new Map(upstreamVars.map(v => [v.key, v]));
  const customSet = new Set(customFieldKeys);
  const segments: VarSegment[] = [];
  let hasToken = false;

  for (const part of str.split(/(\{\{[^}]+\}\})/g)) {
    const m = part.match(/^\{\{([^}]+)\}\}$/);
    if (m) {
      hasToken = true;
      const key = m[1].split('[')[0].split('.')[0].trim();
      if (upstreamMap.has(key)) {
        segments.push({ kind: 'system', key, varInfo: upstreamMap.get(key)! });
      } else if (customSet.has(key)) {
        segments.push({ kind: 'custom', key });
      } else {
        segments.push({ kind: 'unknown', key });
      }
    } else if (part) {
      segments.push({ kind: 'text', content: part });
    }
  }
  return { segments, hasToken };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Inline token chip — shared across rich field + custom field editor
// ─────────────────────────────────────────────────────────────────────────────

function VarChip({ seg }: { seg: VarSegment }) {
  if (seg.kind === 'text') {
    return <span className="text-[11px] text-gray-700 whitespace-pre-wrap leading-relaxed">{seg.content}</span>;
  }
  if (seg.kind === 'system') {
    const c = varTypeColor(seg.varInfo.type);
    return (
      <span
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold align-middle mx-0.5"
        style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}`, lineHeight: 1.5 }}
        title={`From: ${seg.varInfo.nodeName} · type: ${seg.varInfo.type}`}
      >
        <span
          className="inline-flex items-center justify-center w-3.5 h-3.5 rounded flex-shrink-0"
          style={{ background: seg.varInfo.nodeBg || c.bg, color: seg.varInfo.nodeColor || c.text }}
        >
          <NodeIcon name={seg.varInfo.nodeIconName} size={8} />
        </span>
        <span className="text-[8px] font-black" style={{ color: '#64748b' }}>S</span>
        <span style={{ color: '#cbd5e1' }}>|</span>
        {seg.key}
      </span>
    );
  }
  if (seg.kind === 'custom') {
    return (
      <span
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold align-middle mx-0.5"
        style={{ background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa', lineHeight: 1.5 }}
        title="Custom field on this step"
      >
        <span
          className="inline-flex items-center justify-center w-3.5 h-3.5 rounded flex-shrink-0 text-[7px] font-black leading-none"
          style={{ background: '#ffedd5', color: '#ea580c' }}
        >
          CF
        </span>
        {seg.key}
      </span>
    );
  }
  // unknown
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold align-middle mx-0.5"
      style={{ background: '#fef9c3', color: '#92400e', border: '1px solid #fde68a', lineHeight: 1.5 }}
      title="Variable not found in any connected step"
    >
      <span>⚠</span>
      {seg.key}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  RichTextField — shows chips in place of {{vars}}, click to edit raw
// ─────────────────────────────────────────────────────────────────────────────

function RichTextField({
  value,
  onChange,
  placeholder,
  rows = 3,
  multiline = false,
  upstreamVars,
  customFieldKeys,
  elRef,
  onInsert,
  varPickerNode,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  multiline?: boolean;
  upstreamVars: AvailableVariable[];
  customFieldKeys: string[];
  elRef: (el: HTMLInputElement | HTMLTextAreaElement | null) => void;
  onInsert: (text: string) => void;
  varPickerNode: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const innerRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  const { segments, hasToken } = parseSegments(value, upstreamVars, customFieldKeys);
  const showRich = hasToken && !editing;

  // When switching into edit mode, auto-focus and place cursor at end
  useEffect(() => {
    if (editing && innerRef.current) {
      innerRef.current.focus();
      const len = value.length;
      (innerRef.current as HTMLInputElement).setSelectionRange(len, len);
    }
  }, [editing]); // eslint-disable-line react-hooks/exhaustive-deps

  const combinedRef = (el: HTMLInputElement | HTMLTextAreaElement | null) => {
    innerRef.current = el;
    elRef(el);
  };

  const base = 'w-full text-[11px] bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition-colors';

  if (showRich) {
    // ── Rich view: rendered chips ────────────────────────────────────────────
    return (
      <div className="flex gap-1 items-start">
        <div
          onClick={() => setEditing(true)}
          className="flex-1 cursor-text rounded-lg px-2.5 py-1.5 flex flex-wrap items-baseline gap-y-0.5 min-h-[34px] transition-colors hover:border-indigo-300 group"
          style={{
            background: '#f8faff',
            border: '1px solid #c7d2fe',
            minHeight: multiline ? `${rows * 1.85}em` : undefined,
            alignContent: 'flex-start',
          }}
          title="Click to edit"
        >
          {segments.map((seg, i) => <VarChip key={i} seg={seg} />)}
          {/* Subtle edit hint on hover */}
          <span className="ml-auto text-[8px] text-indigo-300 opacity-0 group-hover:opacity-100 transition-opacity self-end flex-shrink-0 pl-1">
            ✎ edit
          </span>
        </div>
        {varPickerNode}
      </div>
    );
  }

  // ── Raw edit mode ────────────────────────────────────────────────────────
  if (multiline) {
    return (
      <div className="flex gap-1 items-start">
        <textarea
          ref={combinedRef as (el: HTMLTextAreaElement | null) => void}
          className={`${base} resize-y min-h-[64px] font-mono text-[10px] flex-1`}
          value={value}
          onChange={e => onChange(e.target.value)}
          onBlur={() => setEditing(false)}
          placeholder={placeholder}
          rows={rows}
          spellCheck={false}
        />
        {varPickerNode}
      </div>
    );
  }

  return (
    <div className="flex gap-1 items-center">
      <input
        ref={combinedRef as (el: HTMLInputElement | null) => void}
        type="text"
        className={`${base} flex-1`}
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={() => setEditing(false)}
        placeholder={placeholder}
        spellCheck={false}
      />
      {varPickerNode}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Generic field row
// ─────────────────────────────────────────────────────────────────────────────

function FieldRow({
  field,
  value,
  onChange,
  allNodes,
  savedVariables,
  inputRef,
  onInsert,
  upstreamVars = [],
  customFieldKeys = [],
}: {
  fieldKey: string;
  field: FieldConfig | { key: string; label: string; type: 'text'; placeholder?: string };
  value: string | number | boolean;
  onChange: (v: string | number | boolean) => void;
  allNodes: Node<WorkflowNodeData>[];
  savedVariables: SavedVariable[];
  inputRef: (el: HTMLInputElement | HTMLTextAreaElement | null) => void;
  onInsert: (text: string) => void;
  upstreamVars?: AvailableVariable[];
  customFieldKeys?: string[];
}) {
  const base =
    'w-full text-[11px] bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition-colors';
  const hint = 'hint' in field ? field.hint : undefined;
  const type = 'type' in field ? field.type : 'text';

  const varPicker = (
    <VariablePicker allNodes={allNodes} savedVariables={savedVariables} onInsert={onInsert} />
  );

  return (
    <div>
      <label className="block text-[10px] font-semibold text-gray-600 mb-1">{field.label}</label>

      {type === 'select' && 'options' in field ? (
        <select className={base} value={String(value)} onChange={e => onChange(e.target.value)}>
          {(field as FieldConfig).options!.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>

      ) : type === 'textarea' ? (
        /* Multi-line text — rich chip view + raw edit on click */
        <RichTextField
          value={String(value)}
          onChange={v => onChange(v)}
          placeholder={'placeholder' in field ? field.placeholder : ''}
          rows={3}
          multiline
          upstreamVars={upstreamVars}
          customFieldKeys={customFieldKeys}
          elRef={inputRef}
          onInsert={onInsert}
          varPickerNode={<div className="mt-0.5">{varPicker}</div>}
        />

      ) : type === 'code' || type === 'json' ? (
        /* Code / JSON — always raw, but with a var picker */
        <div className="flex gap-1 items-start">
          <textarea
            ref={inputRef as (el: HTMLTextAreaElement | null) => void}
            className={`${base} resize-y min-h-[64px] font-mono text-[10px] flex-1`}
            value={String(value)}
            onChange={e => onChange(e.target.value)}
            placeholder={'placeholder' in field ? field.placeholder : ''}
            rows={type === 'code' ? 5 : 3}
            spellCheck={false}
          />
          <div className="mt-0.5">{varPicker}</div>
        </div>

      ) : type === 'regex' ? (
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[11px] font-mono select-none">/</span>
          <input
            ref={inputRef as (el: HTMLInputElement | null) => void}
            type="text"
            className={`${base} pl-5 pr-5 font-mono`}
            value={String(value)}
            onChange={e => onChange(e.target.value)}
            placeholder={'placeholder' in field ? field.placeholder : '\\d+'}
            spellCheck={false}
          />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[11px] font-mono select-none">/</span>
        </div>

      ) : type === 'boolean' ? (
        <label className="flex items-center gap-2 cursor-pointer">
          <div className="relative">
            <input type="checkbox" className="sr-only"
              checked={Boolean(value)} onChange={e => onChange(e.target.checked)} />
            <div className={`w-9 h-5 rounded-full transition-colors ${Boolean(value) ? 'bg-indigo-500' : 'bg-gray-200'}`} />
            <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${Boolean(value) ? 'translate-x-4' : ''}`} />
          </div>
          <span className="text-[11px] text-gray-600">{Boolean(value) ? 'Yes' : 'No'}</span>
        </label>

      ) : type === 'number' ? (
        <input type="number" className={base}
          value={Number(value)}
          onChange={e => onChange(Number(e.target.value))}
          placeholder={'placeholder' in field ? field.placeholder : ''}
        />

      ) : (
        /* Single-line text — rich chip view + raw edit on click */
        <RichTextField
          value={String(value)}
          onChange={v => onChange(v)}
          placeholder={'placeholder' in field ? field.placeholder : ''}
          multiline={false}
          upstreamVars={upstreamVars}
          customFieldKeys={customFieldKeys}
          elRef={inputRef}
          onInsert={onInsert}
          varPickerNode={varPicker}
        />
      )}

      {hint && <p className="text-[9px] text-gray-400 mt-0.5 leading-relaxed">{hint}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Custom field editor ("Save extra values" section)
// ─────────────────────────────────────────────────────────────────────────────

function SavedValueEditor({
  field,
  onChange,
  onRemove,
  upstreamVarKeys = [],
  takenKeys = [],
}: {
  field: CustomField;
  onChange: (upd: Partial<CustomField>) => void;
  onRemove: () => void;
  upstreamVarKeys?: string[];
  takenKeys?: string[];
}) {
  const [expanded, setExpanded] = useState(false);
  const colors = FIELD_TYPE_COLORS[field.type] || FIELD_TYPE_COLORS.text;
  const inputBase =
    'text-[10px] bg-gray-50 border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-300 w-full transition-colors';
  const TYPE_OPTIONS: CustomField['type'][] = ['text', 'number', 'boolean', 'json', 'regex', 'textarea', 'select'];

  // Duplicate key detection (takenKeys should NOT include this field's own id's key)
  const isDuplicate = takenKeys.includes(field.key);

  const valueStr =
    field.value == null ? '' : (typeof field.value === 'object' ? JSON.stringify(field.value) : String(field.value));
  const previewStr = valueStr.length > 55 ? valueStr.slice(0, 55) + '…' : valueStr;
  const isFromTest = Boolean(field.sourcePath);

  // Detect upstream var references
  const refs = [...valueStr.matchAll(/\{\{([^}]+)\}\}/g)].map(m =>
    m[1].split('[')[0].split('.')[0].trim()
  );
  const hasUpstreamRef = refs.some(r => upstreamVarKeys.includes(r));
  const hasUnknownRef = refs.length > 0 && refs.some(r => !upstreamVarKeys.includes(r));

  const borderColor = hasUpstreamRef ? '#6ee7b7' : hasUnknownRef ? '#fcd34d' : colors.border;
  const bgColor = hasUpstreamRef ? '#f0fdf4' : hasUnknownRef ? '#fffbeb' : colors.bg;

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1.5px solid ${borderColor}` }}>
      {/* Compact row */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer"
        style={{ background: bgColor }}
        onClick={() => setExpanded(v => !v)}
      >
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: colors.dot }} />

        <code className="text-[10px] font-mono font-bold text-gray-700 flex-1 min-w-0 truncate">
          {`{{${field.key}}}`}
        </code>

        {/* Upstream reference badges */}
        {hasUpstreamRef && (
          <div className="flex gap-0.5 flex-wrap">
            {refs.filter(r => upstreamVarKeys.includes(r)).slice(0, 2).map(r => (
              <span key={r} className="text-[8px] font-mono font-bold px-1 py-0.5 rounded"
                style={{ background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7' }}>
                ↙ {r}
              </span>
            ))}
          </div>
        )}
        {hasUnknownRef && !hasUpstreamRef && (
          <span className="text-[8px] text-amber-600 font-semibold flex-shrink-0">⚠ value not found</span>
        )}

        {/* Value preview */}
        {valueStr && !hasUpstreamRef ? (
          <span className="text-[9px] font-mono font-semibold truncate max-w-[80px]"
            style={{ color: colors.text }} title={valueStr}>
            {previewStr}
          </span>
        ) : !valueStr ? (
          <span className="text-[9px] text-gray-300 italic">empty</span>
        ) : null}

        {/* From-test badge */}
        {isFromTest && (
          <span className="text-[8px] font-bold text-green-700 bg-green-50 border border-green-200 px-1 rounded-full flex-shrink-0">
            from test
          </span>
        )}

        {/* Type chip */}
        <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
          style={{ background: colors.border, color: colors.text }}>
          {field.type}
        </span>

        {expanded
          ? <ChevronDown size={10} className="text-gray-400 flex-shrink-0" />
          : <ChevronRight size={10} className="text-gray-400 flex-shrink-0" />}

        <button
          onClick={e => { e.stopPropagation(); onRemove(); }}
          className="text-red-400 hover:text-red-600 p-0.5 rounded hover:bg-red-50 transition-colors flex-shrink-0"
        >
          <Trash2 size={10} />
        </button>
      </div>

      {/* Source path */}
      {isFromTest && (
        <div className="px-3 py-1 bg-green-50 border-t border-green-100 flex items-center gap-1.5">
          <span className="text-[8px] font-bold text-green-600 flex-shrink-0">Saved from</span>
          <code className="text-[8px] font-mono text-green-700 bg-white border border-green-200 px-1.5 py-0.5 rounded truncate max-w-full">
            {field.sourcePath}
          </code>
        </div>
      )}

      {/* Collapsed value preview */}
      {valueStr && !expanded && (
        <div className="px-3 py-1.5 bg-white border-t border-gray-100">
          <span className="text-[8px] text-gray-400 font-bold uppercase block mb-0.5">Value</span>
          <span className="text-[9px] font-mono text-gray-700 break-all leading-relaxed">{valueStr}</span>
        </div>
      )}

      {/* Expanded editor */}
      {expanded && (
        <div className="px-3 pt-2 pb-3 space-y-2 bg-white border-t border-gray-100">
          {/* Variable name + type */}
          <div className="flex items-center gap-1.5">
            <div className="flex-1">
              <label className="block text-[8px] text-gray-400 font-semibold uppercase mb-0.5">Variable name</label>
              <input
                className={`${inputBase} font-mono ${isDuplicate ? 'border-red-400 bg-red-50 ring-1 ring-red-300' : ''}`}
                value={field.key}
                onChange={e => onChange({ key: e.target.value.replace(/\s/g, '_').replace(/[^a-zA-Z0-9_]/g, '') })}
                placeholder="my_variable"
                spellCheck={false}
              />
              {isDuplicate && (
                <p className="text-[9px] text-red-500 mt-0.5 font-semibold flex items-center gap-0.5">
                  ⚠ This name is already used — choose another
                </p>
              )}
            </div>
            <div className="flex-shrink-0 pt-4">
              <select
                className="text-[9px] bg-white border rounded px-1.5 py-1 focus:outline-none"
                style={{ borderColor: colors.border, color: colors.text, fontWeight: 600 }}
                value={field.type}
                onChange={e => onChange({ type: e.target.value as CustomField['type'] })}
              >
                {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Label */}
          <div>
            <label className="block text-[8px] text-gray-400 font-semibold uppercase mb-0.5">Display label</label>
            <input
              className={inputBase}
              value={field.label}
              onChange={e => onChange({ label: e.target.value })}
              placeholder="A friendly name"
            />
          </div>

          {/* Value */}
          <div>
            <label className="block text-[8px] text-gray-400 font-semibold uppercase mb-0.5">Default value</label>
            {field.type === 'boolean' ? (
              <label className="flex items-center gap-2 cursor-pointer">
                <div className="relative">
                  <input type="checkbox" className="sr-only"
                    checked={Boolean(field.value)}
                    onChange={e => onChange({ value: e.target.checked })} />
                  <div className={`w-8 h-4 rounded-full transition-colors ${Boolean(field.value) ? 'bg-indigo-500' : 'bg-gray-200'}`} />
                  <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${Boolean(field.value) ? 'translate-x-4' : ''}`} />
                </div>
                <span className="text-[10px] text-gray-600">{Boolean(field.value) ? 'true' : 'false'}</span>
              </label>
            ) : field.type === 'number' ? (
              <input type="number" className={inputBase} value={Number(field.value)}
                onChange={e => onChange({ value: Number(e.target.value) })} placeholder="0" />
            ) : field.type === 'json' ? (
              <textarea className={`${inputBase} font-mono min-h-[48px] resize-y`}
                value={String(field.value ?? '')}
                onChange={e => onChange({ value: e.target.value })}
                placeholder='{"key": "value"}' rows={2} spellCheck={false} />
            ) : field.type === 'textarea' ? (
              <textarea className={`${inputBase} min-h-[48px] resize-y`}
                value={String(field.value ?? '')}
                onChange={e => onChange({ value: e.target.value })}
                placeholder="Enter value..." rows={2} />
            ) : field.type === 'select' ? (
              <div className="space-y-1">
                <input className={inputBase}
                  value={field.options || ''}
                  onChange={e => onChange({ options: e.target.value })}
                  placeholder="Option A, Option B, Option C" />
                <p className="text-[8px]" style={{ color: colors.text }}>Comma-separated options</p>
              </div>
            ) : (
              <input
                className={`${inputBase} ${field.type === 'regex' ? 'font-mono' : ''}`}
                value={String(field.value ?? '')}
                onChange={e => onChange({ value: e.target.value })}
                placeholder={field.type === 'regex' ? '\\d+' : 'Enter value...'}
                spellCheck={false}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function PropertiesPanel({
  selectedNode,
  onUpdateNode,
  onDeleteNode,
  allNodes,
  edges,
  savedVariables,
  onSaveVariable,
}: PropertiesPanelProps) {
  const [activeTab, setActiveTab] = useState<'config' | 'test'>('config');
  const [showSavedValues, setShowSavedValues] = useState(true);
  const [showDescription, setShowDescription] = useState(false);
  const [testRunning, setTestRunning] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [mockInput, setMockInput] = useState('{}');
  const [showMockInput, setShowMockInput] = useState(false);
  const [copiedOutput, setCopiedOutput] = useState(false);

  // All hooks before any early return
  const inputRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({});

  const makeInsertHandler = useCallback(
    (key: string, currentVal: string, setter: (v: string) => void) =>
      (text: string) => {
        const el = inputRefs.current[key];
        if (el) {
          const start = (el as HTMLInputElement).selectionStart ?? currentVal.length;
          const end = (el as HTMLInputElement).selectionEnd ?? currentVal.length;
          const next = currentVal.slice(0, start) + text + currentVal.slice(end);
          setter(next);
          setTimeout(() => {
            el.focus();
            const pos = start + text.length;
            el.setSelectionRange(pos, pos);
          }, 0);
        } else {
          setter(currentVal + text);
        }
      },
    []
  );

  if (!selectedNode) return <EmptyState />;

  const { nodeConfig, fields = {}, customFields = [], testValues = {}, testState } = selectedNode.data;

  // ── field helpers ──────────────────────────────────────────────────────────
  const updateField = (key: string, value: string | number | boolean) =>
    onUpdateNode(selectedNode.id, { fields: { ...fields, [key]: value } });

  const updateTestValue = (key: string, value: string | number | boolean) =>
    onUpdateNode(selectedNode.id, { testValues: { ...testValues, [key]: value } });

  const addCustomField = () => {
    // Generate a key that doesn't clash with built-in outputs or existing custom fields
    const allTakenKeys = new Set([
      ...ownOutputs.map(o => o.key),
      ...customFields.map(cf => cf.key),
    ]);
    let n = customFields.length + 1;
    let newKey = `value_${n}`;
    while (allTakenKeys.has(newKey)) { n++; newKey = `value_${n}`; }
    const newCf: CustomField = {
      id: `cf-${Date.now()}`,
      key: newKey,
      label: `Saved Value ${n}`,
      type: 'text',
      value: '',
    };
    onUpdateNode(selectedNode.id, { customFields: [...customFields, newCf] });
    setShowSavedValues(true);
  };

  const updateCustomField = (id: string, updates: Partial<CustomField>) =>
    onUpdateNode(selectedNode.id, {
      customFields: customFields.map(cf => (cf.id === id ? { ...cf, ...updates } : cf)),
    });

  const removeCustomField = (id: string) =>
    onUpdateNode(selectedNode.id, { customFields: customFields.filter(cf => cf.id !== id) });

  // ── test runner ────────────────────────────────────────────────────────────
  const runTest = async () => {
    setTestRunning(true);
    onUpdateNode(selectedNode.id, { testState: { status: 'running' } });
    const start = Date.now();
    const effectiveFields = { ...fields, ...testValues };

    try {
      let result: NodeTestState;

      if (nodeConfig.id === 'external-http') {
        let parsedInput: Record<string, unknown> = {};
        try { parsedInput = JSON.parse(mockInput); } catch { /* ok */ }
        let parsedBody: unknown;
        try { parsedBody = JSON.parse(String(effectiveFields.body || '')); } catch { parsedBody = effectiveFields.body; }
        let parsedHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
        try { parsedHeaders = { ...parsedHeaders, ...JSON.parse(String(effectiveFields.headers || '{}')) }; } catch { /* ok */ }

        const authValue = String(effectiveFields.authValue || '');
        if (effectiveFields.auth === 'Bearer Token' && authValue)
          parsedHeaders['Authorization'] = `Bearer ${authValue}`;
        else if (effectiveFields.auth === 'API Key header' && authValue)
          parsedHeaders['X-API-Key'] = authValue;

        const resp = await fetch('/api/run-http', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: String(effectiveFields.url || ''),
            method: String(effectiveFields.method || 'GET'),
            headers: parsedHeaders,
            body: parsedBody,
            timeout: Number(effectiveFields.timeout || 30),
          }),
        });
        const data = await resp.json() as {
          ok?: boolean; status?: number; statusText?: string; body?: unknown;
          headers?: Record<string, string>; duration?: number; error?: string;
        };
        result = {
          status: data.ok ? 'success' : 'error',
          duration: data.duration || Date.now() - start,
          inputData: parsedInput,
          outputData: data.ok
            ? { status: data.status, statusText: data.statusText, body: data.body, headers: data.headers }
            : null,
          error: data.ok ? undefined : data.error,
          httpStatus: data.status,
          httpStatusText: data.statusText,
          testedAt: Date.now(),
        };

      } else if (nodeConfig.type === 'ai') {
        if (!apiKey) {
          result = { status: 'error', error: 'Enter your AI provider API key above to run this test', duration: 0, testedAt: Date.now() };
        } else {
          let parsedInput: Record<string, unknown> = {};
          try { parsedInput = JSON.parse(mockInput); } catch { /* ok */ }
          const replacePlaceholders = (str: string) =>
            str.replace(/\{(\w+)\}/g, (_, k) => String((parsedInput as Record<string, unknown>)[k] ?? `{${k}}`));

          const resp = await fetch('/api/run-ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              provider: String(effectiveFields.provider || 'OpenAI'),
              model: String(effectiveFields.model || 'gpt-4o'),
              apiKey,
              systemPrompt: replacePlaceholders(String(effectiveFields.systemPrompt || '')),
              userPrompt: replacePlaceholders(String(effectiveFields.userPrompt || effectiveFields.inputVar || '')),
              temperature: Number(effectiveFields.temperature ?? 0),
              maxTokens: Number(effectiveFields.maxTokens ?? 1000),
            }),
          });
          const data = await resp.json() as {
            ok?: boolean; output?: string; usage?: unknown; duration?: number; error?: string;
          };
          result = {
            status: data.ok ? 'success' : 'error',
            duration: data.duration || Date.now() - start,
            inputData: parsedInput,
            outputData: data.ok ? { text: data.output, usage: data.usage } : null,
            error: data.ok ? undefined : data.error,
            testedAt: Date.now(),
          };
        }

      } else if (nodeConfig.id === 'code-python' || nodeConfig.id === 'code-javascript') {
        let parsedInput: Record<string, unknown> = {};
        try { parsedInput = JSON.parse(mockInput); } catch { /* ok */ }

        const resp = await fetch('/api/run-python', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: String(effectiveFields.code || '# No code yet'),
            variables: parsedInput,
          }),
        });
        const data = await resp.json() as {
          ok?: boolean; stdout?: string; vars?: Record<string, unknown>;
          error?: string; traceback?: string; duration?: number;
        };
        result = {
          status: data.ok ? 'success' : 'error',
          duration: data.duration || Date.now() - start,
          inputData: parsedInput,
          outputData: data.ok ? { stdout: data.stdout, vars: data.vars } : null,
          error: data.ok ? undefined : data.error,
          logs: data.ok ? [data.stdout || ''] : [data.traceback || data.error || ''],
          testedAt: Date.now(),
        };

      } else {
        await new Promise(r => setTimeout(r, 600));
        let parsedInput: Record<string, unknown> = {};
        try { parsedInput = JSON.parse(mockInput); } catch { /* ok */ }
        result = {
          status: 'success',
          duration: Date.now() - start,
          inputData: parsedInput,
          outputData: {
            _simulated: true,
            _note: 'Preview only — this step type runs live in your workflow',
            nodeType: nodeConfig.id,
            configuredValues: effectiveFields,
          },
          testedAt: Date.now(),
        };
      }

      onUpdateNode(selectedNode.id, { testState: result });
    } catch (err) {
      onUpdateNode(selectedNode.id, {
        testState: {
          status: 'error',
          duration: Date.now() - start,
          error: err instanceof Error ? err.message : String(err),
          testedAt: Date.now(),
        },
      });
    } finally {
      setTestRunning(false);
    }
  };

  const copyOutput = () => {
    if (!testState?.outputData) return;
    navigator.clipboard.writeText(JSON.stringify(testState.outputData, null, 2));
    setCopiedOutput(true);
    setTimeout(() => setCopiedOutput(false), 2000);
  };

  // ── computed values ────────────────────────────────────────────────────────
  const upstreamVars = getAvailableVariables(selectedNode.id, allNodes, edges);
  const ownOutputs = computeNodeOutputs(nodeConfig, fields, customFields);
  const needsApiKey = nodeConfig.type === 'ai';
  const isHttpNode = nodeConfig.id === 'external-http';
  const isPythonNode = nodeConfig.id === 'code-python' || nodeConfig.id === 'code-javascript';
  const isSimulated = !needsApiKey && !isHttpNode && !isPythonNode;

  const typeInfo = FRIENDLY_TYPE[nodeConfig.type] || {
    label: nodeConfig.type, emoji: '⚡', color: nodeConfig.color, bg: nodeConfig.bgColor,
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-white" style={{ borderLeft: '1px solid #eef0f5' }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div
        className="px-4 pt-3.5 pb-3 flex-shrink-0"
        style={{ borderTop: `3px solid ${nodeConfig.borderColor}`, borderBottom: '1px solid #eef0f5' }}
      >
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5"
            style={{ background: `${nodeConfig.borderColor}20`, color: nodeConfig.color }}
          >
            <NodeIcon name={nodeConfig.iconName} size={18} />
          </div>

          {/* Name + type */}
          <div className="flex-1 min-w-0">
            <InlineEditName
              value={selectedNode.data.label || ''}
              onChange={v => onUpdateNode(selectedNode.id, { label: v })}
              fallback={nodeConfig.label}
              nodeColor={nodeConfig.borderColor}
            />
            <div className="flex items-center gap-1.5 mt-1">
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: typeInfo.bg, color: typeInfo.color }}
              >
                {typeInfo.emoji} {typeInfo.label}
              </span>

              {/* Test status badge */}
              {testState?.status === 'success' && (
                <span className="text-[9px] text-green-600 font-semibold flex items-center gap-0.5">
                  <CheckCircle size={9} /> Tested
                </span>
              )}
              {testState?.status === 'error' && (
                <span className="text-[9px] text-red-500 font-semibold flex items-center gap-0.5">
                  <AlertCircle size={9} /> Test failed
                </span>
              )}
            </div>
          </div>

          {/* Remove */}
          <button
            onClick={() => onDeleteNode(selectedNode.id)}
            className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-red-500 hover:bg-red-50 px-2 py-1.5 rounded-lg transition-colors flex-shrink-0"
            title="Remove this step"
          >
            <Trash2 size={10} />
          </button>
        </div>

        {/* Optional description row */}
        <button
          onClick={() => setShowDescription(v => !v)}
          className="mt-2 flex items-center gap-1 text-[9px] text-gray-400 hover:text-gray-600 transition-colors"
        >
          {showDescription ? <ChevronDown size={9} /> : <ChevronRight size={9} />}
          {showDescription ? 'Hide note' : (selectedNode.data.description ? '📝 ' + selectedNode.data.description.slice(0, 40) : 'Add a note')}
        </button>
        {showDescription && (
          <input
            className="mt-1.5 w-full text-[11px] bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
            placeholder="Optional note about this step..."
            value={selectedNode.data.description || ''}
            onChange={e => onUpdateNode(selectedNode.id, { description: e.target.value })}
          />
        )}
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <div className="flex flex-shrink-0" style={{ borderBottom: '1px solid #eef0f5', background: '#fafbfd' }}>
        <TabBtn active={activeTab === 'config'} onClick={() => setActiveTab('config')}>
          ⚙️ Configure
        </TabBtn>
        <TabBtn active={activeTab === 'test'} onClick={() => setActiveTab('test')}>
          <span className="flex items-center gap-1">
            ▶ Try it
            {testState && testState.status !== 'idle' && (
              <span className={`w-1.5 h-1.5 rounded-full ${
                testState.status === 'success' ? 'bg-green-500' :
                testState.status === 'error' ? 'bg-red-500' :
                testState.status === 'running' ? 'bg-orange-400 animate-pulse' : 'bg-gray-300'
              }`} />
            )}
          </span>
        </TabBtn>
      </div>

      {/* ── Configure Tab ───────────────────────────────────────────────── */}
      {activeTab === 'config' && (
        <div className="flex-1 overflow-y-auto">
          {/* From earlier steps strip */}
          <div className="pt-3">
            <UpstreamVarStrip
              vars={upstreamVars}
              onCopy={() => { /* copy handled inside strip */ }}
            />
          </div>

          {/* Main fields */}
          <div className="px-4 pb-3 space-y-3">
            {nodeConfig.id === 'external-http' ? (
              <HttpRequestBuilder
                value={String(
                  fields.__httpBuilder ??
                  JSON.stringify({ method: String(fields.method ?? 'GET'), url: String(fields.url ?? '') })
                )}
                onChange={json => updateField('__httpBuilder', json)}
                upstreamVars={upstreamVars}
              />
            ) : (
              (nodeConfig.fields || []).map(field => {
                const currentVal =
                  fields[field.key] !== undefined ? fields[field.key] : (field.defaultValue ?? '');
                return (
                  <FieldRow
                    key={field.key}
                    fieldKey={field.key}
                    field={field}
                    value={currentVal}
                    onChange={v => updateField(field.key, v)}
                    allNodes={allNodes}
                    savedVariables={savedVariables}
                    inputRef={el => { inputRefs.current[field.key] = el; }}
                    onInsert={makeInsertHandler(field.key, String(currentVal), v => updateField(field.key, v))}
                    upstreamVars={upstreamVars}
                    customFieldKeys={customFields.map(cf => cf.key)}
                  />
                );
              })
            )}
          </div>

          {/* ── Unified "Values this step saves" section ───────────────── */}
          {(() => {
            const builtIns = ownOutputs.filter(o => o.source === 'built-in');
            const totalCount = builtIns.length + customFields.length;
            // Keys taken for duplicate detection: built-ins + other custom fields (not self)
            const builtInKeys = builtIns.map(o => o.key);
            return (
              <div className="mx-4 mb-4 rounded-xl overflow-hidden"
                style={{ border: '1.5px solid #d1fae5' }}>
                {/* Header */}
                <button
                  onClick={() => setShowSavedValues(v => !v)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 transition-colors"
                  style={{ background: '#f0fdf4' }}
                >
                  {showSavedValues
                    ? <ChevronDown size={11} className="text-green-500" />
                    : <ChevronRight size={11} className="text-green-500" />}
                  <Database size={11} className="text-green-600 flex-shrink-0" />
                  <span className="text-[10px] font-bold text-green-800 flex-1 text-left">
                    Values this step saves
                  </span>
                  {totalCount > 0 && (
                    <span className="text-[9px] bg-green-100 text-green-700 px-1.5 rounded-full font-bold">
                      {totalCount}
                    </span>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); addCustomField(); }}
                    className="flex items-center gap-0.5 text-[9px] text-indigo-500 hover:text-indigo-700 hover:bg-white px-2 py-0.5 rounded-lg transition-colors font-semibold"
                  >
                    <Plus size={9} /> Add
                  </button>
                </button>

                {showSavedValues && (
                  <div className="px-3 pt-2 pb-3 space-y-2 bg-white">
                    {/* Built-in locked rows */}
                    {builtIns.map(o => (
                      <BuiltInOutputRow key={o.key} output={o} />
                    ))}

                    {/* Custom editable rows */}
                    {customFields.map(cf => {
                      // takenKeys = built-in keys + all OTHER custom field keys
                      const otherCfKeys = customFields.filter(x => x.id !== cf.id).map(x => x.key);
                      const taken = [...builtInKeys, ...otherCfKeys];
                      return (
                        <SavedValueEditor
                          key={cf.id}
                          field={cf}
                          upstreamVarKeys={upstreamVars.map(v => v.key)}
                          takenKeys={taken}
                          onChange={upd => updateCustomField(cf.id, upd)}
                          onRemove={() => removeCustomField(cf.id)}
                        />
                      );
                    })}

                    {/* Empty state — only if no built-ins AND no custom fields */}
                    {totalCount === 0 && (
                      <div className="text-center py-3">
                        <p className="text-[10px] text-gray-400">This step doesn&apos;t save any values yet.</p>
                        <button
                          onClick={addCustomField}
                          className="mt-2 w-full flex items-center justify-center gap-1.5 text-[10px] text-indigo-500 hover:text-indigo-700 border border-dashed border-indigo-200 hover:border-indigo-400 rounded-lg py-2 transition-colors"
                        >
                          <Plus size={10} /> Add a saved value
                        </button>
                      </div>
                    )}

                    {/* "Add" shortcut at the bottom when there are items */}
                    {totalCount > 0 && (
                      <button
                        onClick={addCustomField}
                        className="w-full flex items-center justify-center gap-1.5 text-[10px] text-indigo-400 hover:text-indigo-600 border border-dashed border-indigo-100 hover:border-indigo-300 rounded-lg py-1.5 transition-colors"
                      >
                        <Plus size={9} /> Add another value
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Try It Tab ──────────────────────────────────────────────────── */}
      {activeTab === 'test' && (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">

          {/* What this will test */}
          <div className="rounded-xl px-3 py-2.5" style={{ background: '#f8f9fc', border: '1px solid #eef0f5' }}>
            <p className="text-[11px] font-semibold text-gray-700">
              {typeInfo.emoji} Try: <span className="font-black">{selectedNode.data.label || nodeConfig.label}</span>
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">{nodeConfig.description}</p>
            {isSimulated && (
              <p className="text-[9px] text-amber-600 mt-1.5 flex items-center gap-1">
                ℹ️ This step will be previewed (not executed live)
              </p>
            )}
          </div>

          {/* API Key for AI/HTTP */}
          {(needsApiKey || isHttpNode) && (
            <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Key size={11} className="text-amber-600" />
                <span className="text-[10px] font-bold text-amber-700">
                  {needsApiKey ? 'AI Provider API Key' : 'Auth Credentials'}
                </span>
              </div>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  className="w-full text-[11px] bg-white border border-amber-200 rounded-lg px-2.5 py-1.5 pr-8 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400 font-mono"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder={needsApiKey ? 'sk-... or claude-key-...' : 'Bearer token / API key'}
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(v => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-amber-400 hover:text-amber-600"
                >
                  {showApiKey ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
              </div>
              <p className="text-[9px] text-amber-500 mt-1">Used only for this test — never stored.</p>
            </div>
          )}

          {/* Test overrides — top fields */}
          {(nodeConfig.fields || []).filter(f => ['text', 'number', 'textarea', 'json', 'code'].includes(f.type)).length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-gray-600 mb-2">
                Override field values for this test
                <span className="text-gray-400 font-normal"> (optional)</span>
              </p>
              <div className="space-y-2">
                {(nodeConfig.fields || [])
                  .filter(f => ['text', 'number', 'textarea', 'json', 'code'].includes(f.type))
                  .slice(0, 6)
                  .map(field => {
                    const testVal = testValues[field.key];
                    const placeholder = String(fields[field.key] !== undefined ? fields[field.key] : (field.defaultValue ?? ''));
                    return (
                      <div key={field.key} className="flex items-start gap-2">
                        <label className="text-[9px] font-semibold text-gray-500 pt-1.5 w-24 flex-shrink-0 truncate"
                          title={field.label}>
                          {field.label}
                        </label>
                        <input
                          type={field.type === 'number' ? 'number' : 'text'}
                          className="flex-1 text-[10px] bg-gray-50 border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-200 focus:border-indigo-400"
                          value={testVal !== undefined ? String(testVal) : ''}
                          onChange={e =>
                            updateTestValue(field.key, field.type === 'number' ? Number(e.target.value) : e.target.value)
                          }
                          placeholder={placeholder ? placeholder.slice(0, 50) : 'use configured value'}
                        />
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Mock input — collapsible advanced section */}
          <div>
            <button
              onClick={() => setShowMockInput(v => !v)}
              className="flex items-center gap-1.5 text-[10px] text-gray-400 hover:text-gray-600 transition-colors mb-1.5"
            >
              {showMockInput ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              <span className="font-semibold">Sample input data</span>
              <span className="text-gray-300 font-normal">(advanced)</span>
            </button>
            {showMockInput && (
              <div>
                <textarea
                  className="w-full text-[10px] bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 resize-y"
                  rows={4}
                  value={mockInput}
                  onChange={e => setMockInput(e.target.value)}
                  spellCheck={false}
                  placeholder='{"name": "Jane", "amount": 250}'
                />
                <p className="text-[9px] text-gray-400 mt-0.5">
                  Values like <code className="font-mono text-indigo-500">{'{name}'}</code> in your fields will be replaced with these when testing.
                </p>
              </div>
            )}
          </div>

          {/* Run button */}
          <button
            onClick={runTest}
            disabled={testRunning}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-[13px] transition-all ${
              testRunning
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-200 active:scale-95'
            }`}
          >
            {testRunning ? (
              <><Loader2 size={15} className="animate-spin" /> Running…</>
            ) : (
              <><Play size={14} fill="currentColor" /> {isSimulated ? 'Preview this step' : 'Run this step'}</>
            )}
          </button>

          {/* Result */}
          {testState && testState.status !== 'idle' && (
            <div className="rounded-xl border overflow-hidden"
              style={{
                borderColor:
                  testState.status === 'success' ? '#bbf7d0' :
                  testState.status === 'error' ? '#fecaca' : '#e5e7eb',
              }}>

              {/* Result header */}
              <div className={`flex items-center gap-2 px-3 py-2 ${
                testState.status === 'success' ? 'bg-green-50' :
                testState.status === 'error' ? 'bg-red-50' : 'bg-gray-50'
              }`}>
                {testState.status === 'success' && <CheckCircle size={13} className="text-green-600 flex-shrink-0" />}
                {testState.status === 'error' && <AlertCircle size={13} className="text-red-600 flex-shrink-0" />}
                {testState.status === 'running' && <Loader2 size={13} className="text-orange-500 animate-spin flex-shrink-0" />}
                <span className={`text-[11px] font-bold ${
                  testState.status === 'success' ? 'text-green-700' :
                  testState.status === 'error' ? 'text-red-700' : 'text-gray-600'
                }`}>
                  {testState.status === 'success' ? '✓ Looks good!' :
                   testState.status === 'error' ? 'Something went wrong' : 'Running…'}
                </span>
                {testState.httpStatus && (
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                    testState.httpStatus < 300 ? 'bg-green-100 text-green-700' :
                    testState.httpStatus < 400 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {testState.httpStatus} {testState.httpStatusText}
                  </span>
                )}
                {testState.duration != null && (
                  <span className="text-[9px] text-gray-400 ml-auto flex items-center gap-0.5">
                    <Clock size={9} /> {testState.duration}ms
                  </span>
                )}
              </div>

              {/* Error */}
              {testState.error && (
                <div className="px-3 py-2 bg-red-50 border-t border-red-100">
                  <p className="text-[10px] text-red-700 font-mono whitespace-pre-wrap">{testState.error}</p>
                </div>
              )}

              {/* Interactive output */}
              {testState.outputData != null && (
                <div className="border-t border-gray-100">
                  <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Result</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] text-indigo-500 font-semibold">Click any value → save it</span>
                      <button
                        onClick={copyOutput}
                        className="flex items-center gap-0.5 text-[9px] text-gray-500 hover:text-gray-700 hover:bg-gray-200 px-1.5 py-0.5 rounded transition-colors"
                      >
                        {copiedOutput ? <Check size={9} className="text-green-600" /> : <Copy size={9} />}
                        {copiedOutput ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>
                  <div className="px-3 py-2 overflow-y-auto" style={{ maxHeight: 380 }}>
                    <InteractiveOutputViewer
                      data={testState.outputData}
                      customFields={customFields}
                      onSaveToField={(fieldId, value, type, sourcePath) => {
                        onUpdateNode(selectedNode.id, {
                          customFields: customFields.map(cf =>
                            cf.id === fieldId
                              ? { ...cf, value: value as string | number | boolean, type, sourcePath }
                              : cf
                          ),
                        });
                        setActiveTab('config');
                        setShowSavedValues(true);
                      }}
                      onCreateField={(key, value, type, sourcePath) => {
                        const newCf: CustomField = {
                          id: `cf-${Date.now()}`,
                          key: key || `output_${Date.now()}`,
                          label: key,
                          type,
                          value: value as string | number | boolean,
                          sourcePath,
                        };
                        onUpdateNode(selectedNode.id, { customFields: [...customFields, newCf] });
                        setTimeout(() => { setActiveTab('config'); setShowSavedValues(true); }, 900);
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-2 border-t border-gray-100 flex-shrink-0 bg-gray-50">
        <p className="text-[9px] text-gray-400">
          {activeTab === 'config'
            ? '✓ Changes are saved automatically'
            : '🔒 API keys are used only for this test and never stored'}
        </p>
      </div>
    </div>
  );
}
