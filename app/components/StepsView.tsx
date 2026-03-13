'use client';

/**
 * StepsView — A non-technical, linear "recipe card" view of any workflow.
 *
 * Instead of a flow diagram, each node is shown as a numbered step in plain
 * English. Branches (if/else, switch) show split paths with labels. Users can
 * click any step to open its settings panel without needing to understand graph
 * concepts.
 */

import { useMemo } from 'react';
import { Node, Edge } from '@xyflow/react';
import { WorkflowNodeData, NODE_CATEGORIES } from '../lib/types';
import { NodeIcon } from '../lib/icons';
import { computeNodeOutputs, getAvailableVariables, varTypeColor } from '../lib/nodeIO';
import { Plus, ChevronRight, Zap, GitBranch, Repeat, ArrowDown } from 'lucide-react';

type WFNode = Node<WorkflowNodeData>;

// ─────────────────────────────────────────────────────────────────────────────
//  Graph utilities — build a readable linear order from the edge list
// ─────────────────────────────────────────────────────────────────────────────

interface OrderedStep {
  node: WFNode;
  index: number;                     // 1-based display number
  branchLabel?: string;              // "IF TRUE", "IF FALSE", "Case A" …
  isBranchPoint: boolean;            // this node has multiple outgoing edges
  outgoingBranches: { label: string; targetId: string }[];
  indent: number;                    // 0 = main, 1 = inside a branch
}

function buildStepOrder(nodes: WFNode[], edges: Edge[]): OrderedStep[] {
  if (nodes.length === 0) return [];

  const hasIncoming = new Set(edges.map(e => e.target));
  const roots = nodes.filter(n => !hasIncoming.has(n.id));
  const start = roots[0] ?? nodes[0];

  const visited = new Set<string>();
  const result: OrderedStep[] = [];
  let counter = 0;

  // Build adjacency
  const outMap = new Map<string, Edge[]>();
  for (const e of edges) {
    if (!outMap.has(e.source)) outMap.set(e.source, []);
    outMap.get(e.source)!.push(e);
  }

  const visit = (nodeId: string, indent = 0, branchLabel?: string) => {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    counter++;

    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    const outs = outMap.get(nodeId) ?? [];
    const isBranchPoint = outs.length > 1;
    const outBranches = outs.map(e => ({
      label: (e.label as string) || e.sourceHandle || '',
      targetId: e.target,
    }));

    result.push({ node, index: counter, branchLabel, isBranchPoint, outgoingBranches: outBranches, indent });

    if (outs.length === 0) return;
    if (outs.length === 1) {
      visit(outs[0].target, indent);
    } else {
      // Multiple outputs (branch): visit each with increased indent
      for (const e of outs) {
        const lbl = (e.label as string) || (e.sourceHandle === 'true' ? '✓ If YES' : e.sourceHandle === 'false' ? '✗ If NO' : e.sourceHandle === 'success' ? '✓ Success' : e.sourceHandle === 'error' ? '✗ Error' : e.sourceHandle || '');
        visit(e.target, indent + 1, lbl);
      }
    }
  };

  visit(start.id);

  // Add disconnected nodes
  for (const n of nodes) {
    if (!visited.has(n.id)) {
      counter++;
      result.push({ node: n, index: counter, isBranchPoint: false, outgoingBranches: [], indent: 0 });
    }
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Plain-English descriptions by node type
// ─────────────────────────────────────────────────────────────────────────────
function stepVerb(nodeConfig: WFNode['data']['nodeConfig']): string {
  const m: Record<string, string> = {
    'trigger-email':      'When I receive an email',
    'trigger-schedule':   'On a schedule',
    'trigger-webhook':    'When called from outside',
    'trigger-manual':     'When I click Run',
    'trigger-file':       'When a file changes',
    'trigger-rss':        'When a new post appears',
    'ai-email-agent':     'Read email with AI and extract info',
    'ai-completion':      'Ask AI to process text',
    'ai-extract':         'Use AI to extract structured data',
    'ai-summarize':       'Summarise with AI',
    'ai-classify':        'Classify / label with AI',
    'data-read-excel':    'Open an Excel file',
    'data-write-excel':   'Save data to Excel',
    'data-read-csv':      'Open a CSV file',
    'data-write-csv':     'Save data to CSV',
    'data-filter':        'Filter rows',
    'data-sort':          'Sort data',
    'data-deduplicate':   'Remove duplicates',
    'data-vlookup':       'Look up a value (like Excel VLOOKUP)',
    'data-pivot':         'Create a pivot table',
    'data-groupby':       'Group and summarise data',
    'flow-if-else':       'Check a condition',
    'flow-switch':        'Choose a path',
    'flow-foreach':       'Repeat for each item',
    'flow-while':         'Repeat while condition is true',
    'flow-repeat':        'Repeat a fixed number of times',
    'flow-trycatch':      'Try (and handle errors)',
    'flow-delay':         'Wait',
    'send-email':         'Send an email',
    'send-email-attachment': 'Send an email with attachment',
    'send-whatsapp':      'Send a WhatsApp message',
    'send-slack':         'Post to Slack',
    'send-telegram':      'Send a Telegram message',
    'send-sms':           'Send an SMS',
    'send-webhook':       'Notify another system',
    'external-http':      'Fetch data from the web',
    'external-graphql':   'Query a GraphQL API',
    'external-database':  'Run a database query',
    'external-google-sheets': 'Read/write Google Sheets',
    'external-ftp':       'Upload or download a file',
    'code-python':        'Run custom code',
    'code-javascript':    'Run JavaScript',
    'code-set-variable':  'Set a variable',
    'code-log':           'Log a message',
    'code-comment':       'Note',
    'end-success':        'Done',
    'end-error':          'Stop with error',
  };
  return m[nodeConfig.id] || nodeConfig.label;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Category icon and colour helpers
// ─────────────────────────────────────────────────────────────────────────────
const CAT_ICON: Record<string, string> = {
  trigger: '⚡', flow: '🔀', data: '📊', transform: '⚙️',
  send: '📤', external: '🌐', ai: '🤖', code: '💻', end: '🏁',
};

// ─────────────────────────────────────────────────────────────────────────────
//  Single step card
// ─────────────────────────────────────────────────────────────────────────────
function StepCard({
  step,
  allNodes,
  edges,
  selected,
  onClick,
}: {
  step: OrderedStep;
  allNodes: WFNode[];
  edges: Edge[];
  selected: boolean;
  onClick: () => void;
}) {
  const { node, index, branchLabel, indent } = step;
  const { nodeConfig, label, description, fields, customFields } = node.data;
  const catInfo = NODE_CATEGORIES[nodeConfig.type];
  const verb = stepVerb(nodeConfig);

  // Outputs this step produces
  const outputs = computeNodeOutputs(nodeConfig, fields, customFields);
  // Variables used in field values (detect {{...}})
  const fieldValues = Object.values(fields ?? {}).join(' ') + (customFields ?? []).map(cf => cf.value).join(' ');
  const usedVarRefs = [...fieldValues.matchAll(/\{\{([^}]+)\}\}/g)].map(m => m[1]);

  const isLoop = nodeConfig.isLoopNode;
  const isAI = nodeConfig.type === 'ai';
  const isTrigger = nodeConfig.type === 'trigger';
  const isEnd = nodeConfig.type === 'end';
  const isBranch = nodeConfig.id === 'flow-if-else' || nodeConfig.isSwitchNode;

  return (
    <div style={{ marginLeft: indent * 24 }}>
      {/* Branch label pill above this step */}
      {branchLabel && (
        <div className="flex items-center gap-1.5 mb-2 ml-2">
          <div
            className="h-px flex-1 max-w-[28px]"
            style={{ background: nodeConfig.borderColor + '60' }}
          />
          <span
            className="text-[9px] font-bold px-2 py-0.5 rounded-full border"
            style={{
              color: branchLabel.includes('YES') || branchLabel.includes('Success') ? '#15803d' : branchLabel.includes('NO') || branchLabel.includes('Error') ? '#b91c1c' : nodeConfig.color,
              background: branchLabel.includes('YES') || branchLabel.includes('Success') ? '#f0fdf4' : branchLabel.includes('NO') || branchLabel.includes('Error') ? '#fef2f2' : `${nodeConfig.bgColor}`,
              borderColor: branchLabel.includes('YES') || branchLabel.includes('Success') ? '#bbf7d0' : branchLabel.includes('NO') || branchLabel.includes('Error') ? '#fecaca' : nodeConfig.borderColor + '50',
            }}
          >
            {branchLabel}
          </span>
          <div
            className="h-px flex-1"
            style={{ background: nodeConfig.borderColor + '30' }}
          />
        </div>
      )}

      {/* Step card */}
      <button
        onClick={onClick}
        className="w-full text-left rounded-2xl border-2 transition-all duration-150 hover:shadow-md active:scale-[0.99] group overflow-hidden"
        style={{
          borderColor: selected ? nodeConfig.borderColor : `${nodeConfig.borderColor}35`,
          background: selected ? nodeConfig.bgColor : 'white',
          boxShadow: selected ? `0 0 0 3px ${nodeConfig.borderColor}20, 0 4px 16px ${nodeConfig.borderColor}15` : '0 1px 4px rgba(0,0,0,0.06)',
        }}
      >
        {/* Top coloured accent */}
        <div className="h-1 w-full" style={{ background: selected ? nodeConfig.borderColor : `${nodeConfig.borderColor}50` }} />

        <div className="px-4 py-3">
          {/* Step number + category row */}
          <div className="flex items-center gap-2 mb-2">
            <span
              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0"
              style={{ background: nodeConfig.borderColor, color: 'white' }}
            >
              {index}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: nodeConfig.color }}>
              {CAT_ICON[nodeConfig.type]} {catInfo.label}
            </span>
            {isTrigger && <span className="text-[8px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold ml-auto">Trigger</span>}
            {isAI && <span className="text-[8px] bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded-full font-bold ml-auto">AI</span>}
            {isLoop && <span className="text-[8px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-bold ml-auto">↺ Loop</span>}
            {isEnd && <span className="text-[8px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full font-bold ml-auto">End</span>}
          </div>

          {/* Main label — plain English verb */}
          <div className="font-bold text-[15px] text-gray-800 leading-snug mb-0.5">
            {label !== nodeConfig.label ? label : verb}
          </div>

          {/* Description or auto-generated summary */}
          {description && (
            <p className="text-[11px] text-gray-500 leading-relaxed mb-2">{description}</p>
          )}

          {/* Condition preview for if/else */}
          {nodeConfig.id === 'flow-if-else' && fields?.variable && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-50 border border-orange-200 text-[11px] text-orange-700 font-mono font-semibold mb-2">
              <span>if</span>
              <span className="text-orange-900">{String(fields.variable)}</span>
              <span>{String(fields.operator ?? '==')}</span>
              <span className="text-orange-900">{String(fields.value ?? '')}</span>
            </div>
          )}

          {/* Variables this step uses */}
          {usedVarRefs.length > 0 && (
            <div className="flex items-start gap-1.5 mb-2">
              <span className="text-[9px] font-bold text-gray-400 mt-0.5 flex-shrink-0">Uses:</span>
              <div className="flex flex-wrap gap-1">
                {[...new Set(usedVarRefs)].slice(0, 4).map(ref => (
                  <span
                    key={ref}
                    className="inline-flex items-center gap-0.5 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md"
                    style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }}
                  >
                    ↙ {ref.split('[')[0].split('.')[0]}
                  </span>
                ))}
                {usedVarRefs.length > 4 && <span className="text-[9px] text-gray-400">+{usedVarRefs.length - 4}</span>}
              </div>
            </div>
          )}

          {/* Variables this step produces */}
          {outputs.length > 0 && (
            <div className="flex items-start gap-1.5">
              <span className="text-[9px] font-bold text-gray-400 mt-0.5 flex-shrink-0">Saves:</span>
              <div className="flex flex-wrap gap-1">
                {outputs.slice(0, 5).map(o => {
                  const c = varTypeColor(o.type);
                  return (
                    <span
                      key={o.key}
                      title={`${o.label} (${o.type})`}
                      className="inline-flex items-center gap-0.5 text-[9px] font-mono px-1.5 py-0.5 rounded-md font-semibold"
                      style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}
                    >
                      <span style={{ color: c.dot, fontSize: 7 }}>●</span>
                      {o.key}
                    </span>
                  );
                })}
                {outputs.length > 5 && <span className="text-[9px] text-gray-400 self-center">+{outputs.length - 5}</span>}
              </div>
            </div>
          )}

          {/* Configure hint */}
          <div className="mt-2.5 flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-[9px] text-gray-400 flex items-center gap-0.5 font-medium">
              Click to configure <ChevronRight size={9} />
            </span>
          </div>
        </div>

        {/* Branch paths preview */}
        {isBranch && (
          <div
            className="px-4 py-2 flex gap-3 border-t"
            style={{ borderColor: `${nodeConfig.borderColor}25`, background: `${nodeConfig.bgColor}80` }}
          >
            {nodeConfig.id === 'flow-if-else' ? (
              <>
                <span className="text-[9px] text-emerald-700 font-bold flex items-center gap-1">✓ YES path →</span>
                <span className="text-[9px] text-red-600 font-bold flex items-center gap-1 ml-auto">✗ NO path →</span>
              </>
            ) : (
              <>
                {String(fields?.cases ?? 'Case A, Case B')
                  .split(',').slice(0, 3).map(c => (
                    <span key={c} className="text-[9px] font-semibold" style={{ color: nodeConfig.color }}>
                      {c.trim()} →
                    </span>
                  ))}
              </>
            )}
          </div>
        )}

        {/* Loop badge */}
        {isLoop && (
          <div
            className="px-4 py-1.5 border-t flex items-center gap-1.5"
            style={{ borderColor: `${nodeConfig.borderColor}25`, background: `${nodeConfig.bgColor}80` }}
          >
            <Repeat size={9} style={{ color: nodeConfig.color }} />
            <span className="text-[9px] font-semibold" style={{ color: nodeConfig.color }}>
              Loops over: {String(fields?.source ?? 'each item')}
            </span>
          </div>
        )}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Connector arrow between steps
// ─────────────────────────────────────────────────────────────────────────────
function StepConnector({ color }: { color: string }) {
  return (
    <div className="flex flex-col items-center my-1" style={{ marginLeft: 28 }}>
      <div className="w-0.5 h-4 rounded-full" style={{ background: `${color}40` }} />
      <ArrowDown size={10} style={{ color: `${color}60` }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Public component
// ─────────────────────────────────────────────────────────────────────────────
interface StepsViewProps {
  nodes: WFNode[];
  edges: Edge[];
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
  onAddNode: () => void;
}

export default function StepsView({ nodes, edges, selectedNodeId, onSelectNode, onAddNode }: StepsViewProps) {
  const steps = useMemo(() => buildStepOrder(nodes, edges), [nodes, edges]);

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8"
        style={{ background: 'linear-gradient(160deg, #f8f9ff, #fafbfc)' }}>
        {/* Illustration */}
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 shadow-lg"
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
        >
          <span className="text-3xl">🚀</span>
        </div>
        <h3 className="text-[18px] font-black text-gray-800 mb-2">Build your automation</h3>
        <p className="text-[12px] text-gray-400 mb-7 leading-relaxed max-w-[280px]">
          Choose a ready-made template below, or switch to <strong className="text-gray-600">Canvas</strong> to
          drag and drop steps manually.
        </p>
        {/* Template mini-cards */}
        <div className="grid grid-cols-2 gap-2 mb-6 w-full max-w-xs">
          {[
            { emoji: '🧾', label: 'Invoice Processor' },
            { emoji: '📅', label: 'Daily Summary' },
            { emoji: '🔍', label: 'Customer Lookup' },
            { emoji: '📁', label: 'File → Excel' },
          ].map(t => (
            <div key={t.label}
              className="flex items-center gap-2 p-2.5 rounded-xl cursor-default"
              style={{ background: 'white', border: '1px solid #e8eaf0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <span className="text-lg">{t.emoji}</span>
              <span className="text-[10px] font-semibold text-gray-600 leading-tight">{t.label}</span>
            </div>
          ))}
        </div>
        <button
          onClick={onAddNode}
          className="flex items-center gap-2 px-6 py-3 text-white text-[12px] font-bold rounded-xl transition-all hover:scale-105 shadow-lg"
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 4px 14px rgba(99,102,241,0.35)' }}
        >
          <Plus size={14} /> Add a step
        </button>
        <p className="text-[10px] text-gray-300 mt-3">or use the Templates button in the top bar</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto" style={{ background: '#f8f9fc' }}>
      <div className="max-w-xl mx-auto px-4 py-5">
        {/* Header row */}
        <div className="flex items-center justify-between mb-5 px-1">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-black text-gray-700">
              {steps.length} Step{steps.length !== 1 ? 's' : ''}
            </span>
            <span className="text-[10px] text-gray-400">
              · {edges.length} connection{edges.length !== 1 ? 's' : ''}
            </span>
          </div>
          <span className="text-[10px] text-gray-400 italic">Click a step to configure it →</span>
        </div>

        {/* Step cards */}
        {steps.map((step, i) => {
          const nextStep = steps[i + 1];
          const showConnector = nextStep !== undefined;
          const sameIndent = nextStep && nextStep.indent === step.indent;

          return (
            <div key={step.node.id}>
              <StepCard
                step={step}
                allNodes={nodes}
                edges={edges}
                selected={selectedNodeId === step.node.id}
                onClick={() => onSelectNode(step.node.id)}
              />
              {showConnector && (
                <StepConnector
                  color={sameIndent ? step.node.data.nodeConfig.borderColor : '#94a3b8'}
                />
              )}
            </div>
          );
        })}

        {/* Add step button */}
        <div className="mt-5 flex flex-col items-center">
          <button
            onClick={onAddNode}
            className="flex items-center gap-2 px-5 py-2.5 text-[12px] font-bold rounded-xl transition-all border-2 border-dashed hover:scale-105"
            style={{ color: '#6366f1', borderColor: '#c7d2fe', background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
          >
            <Plus size={13} /> Add a step
          </button>
          <p className="text-[10px] text-gray-300 mt-2">Opens the Canvas to drag and drop a new node</p>
        </div>
      </div>
    </div>
  );
}
