'use client';

import { useCallback, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Node,
  type Edge,
  type OnConnect,
  type OnNodesChange,
  type OnEdgesChange,
  type NodeTypes,
  type ReactFlowInstance,
  BackgroundVariant,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import WorkflowNode from './WorkflowNode';
import NodeLibrary from './NodeLibrary';
import PropertiesPanel from './PropertiesPanel';
import CodePanel from './CodePanel';
import TemplatesGallery, { WorkflowTemplate } from './TemplatesGallery';
import { NODE_LIBRARY, NodeConfig, WorkflowNodeData, SavedVariable } from '../lib/types';

type WFNode = Node<WorkflowNodeData>;
type ViewMode = 'canvas' | 'code';

const nodeTypes: NodeTypes = { workflowNode: WorkflowNode as NodeTypes['workflowNode'] };

const mkEdge = (id: string, source: string, target: string, label?: string, color?: string, sourceHandle?: string): Edge => ({
  id, source, target,
  ...(sourceHandle ? { sourceHandle } : {}),
  markerEnd: { type: MarkerType.ArrowClosed, color: color || '#94a3b8' },
  style: { stroke: color || '#94a3b8', strokeWidth: 2 },
  ...(label ? { label, labelStyle: { fill: color || '#64748b', fontSize: 10, fontWeight: 700 }, labelBgStyle: { fill: 'white' } } : {}),
});

// ── Demo workflow ─────────────────────────────────────────────────────────────
const DEMO_NODES: WFNode[] = [
  {
    id: 'd1', type: 'workflowNode', position: { x: 340, y: 40 },
    data: {
      nodeConfig: NODE_LIBRARY.find(n => n.id === 'trigger-email')!,
      label: 'Email Received',
      description: 'Watch inbox for invoices with "Invoice" in subject',
      fields: { host: 'imap.gmail.com', folder: 'INBOX', filter: 'Invoice', markRead: true },
    },
  },
  {
    id: 'd2', type: 'workflowNode', position: { x: 340, y: 200 },
    data: {
      nodeConfig: NODE_LIBRARY.find(n => n.id === 'ai-email-agent')!,
      label: 'Extract Invoice Data',
      description: 'AI reads {{email_body}} and extracts structured invoice fields',
      fields: {
        provider: 'Anthropic (Claude)', model: 'claude-sonnet-4-6',
        outputVar: 'invoice_data',
        agentInstructions: 'Extract from {{email_body}} sent by {{email_sender}}: invoice_no, vendor, amount (number), due_date, line_items. Return as JSON.',
      },
    },
  },
  {
    id: 'd3', type: 'workflowNode', position: { x: 340, y: 370 },
    data: {
      nodeConfig: NODE_LIBRARY.find(n => n.id === 'data-read-excel')!,
      label: 'Load Invoice Tracker',
      description: 'Read existing tracker to check for duplicates',
      fields: { path: 'invoices.xlsx', sheet: 'Tracker', header: 0 },
    },
  },
  {
    id: 'd4', type: 'workflowNode', position: { x: 340, y: 530 },
    data: {
      nodeConfig: NODE_LIBRARY.find(n => n.id === 'flow-if-else')!,
      label: 'High-Value Check',
      description: 'Branch: is invoice_data["amount"] > 10,000?',
      fields: { variable: 'invoice_data["amount"]', operator: '>', value: '10000' },
    },
  },
  {
    id: 'd5', type: 'workflowNode', position: { x: 80, y: 710 },
    data: {
      nodeConfig: NODE_LIBRARY.find(n => n.id === 'send-email')!,
      label: 'Escalate to CFO',
      description: 'High-value invoice → CFO approval required',
      fields: {
        to: 'cfo@company.com',
        subject: '⚠️ Approval: Invoice from {{invoice_data["vendor"]}}',
        body: 'Invoice #{{invoice_data["invoice_no"]}} for SAR {{invoice_data["amount"]}} requires approval.',
      },
    },
  },
  {
    id: 'd6', type: 'workflowNode', position: { x: 600, y: 710 },
    data: {
      nodeConfig: NODE_LIBRARY.find(n => n.id === 'data-write-excel')!,
      label: 'Update Invoice Tracker',
      description: 'Append {{invoice_data["invoice_no"]}} row to tracker',
      fields: { path: 'invoices.xlsx', sheet: 'Tracker', mode: 'append', autofit: true },
    },
  },
  {
    id: 'd7', type: 'workflowNode', position: { x: 340, y: 880 },
    data: {
      nodeConfig: NODE_LIBRARY.find(n => n.id === 'send-slack')!,
      label: 'Notify Finance Team',
      description: 'Post summary to #finance channel',
      fields: { channel: '#finance', message: '✅ Invoice {{invoice_data["invoice_no"]}} processed · SAR {{invoice_data["amount"]}}', username: 'Invoice Bot' },
    },
  },
  {
    id: 'd8', type: 'workflowNode', position: { x: 340, y: 1040 },
    data: {
      nodeConfig: NODE_LIBRARY.find(n => n.id === 'end-success')!,
      label: 'Done',
      description: 'Invoice processed. {{df_rows}} total in tracker.',
      fields: { message: 'Invoice processed. Tracker has {{df_rows}} rows.', returnVar: 'invoice_data' },
    },
  },
];

const DEMO_EDGES: Edge[] = [
  mkEdge('e1', 'd1', 'd2'),
  mkEdge('e2', 'd2', 'd3'),
  mkEdge('e3', 'd3', 'd4'),
  mkEdge('e4', 'd4', 'd5', 'TRUE (>10k)', '#10b981', 'true'),
  mkEdge('e5', 'd4', 'd6', 'FALSE', '#ef4444', 'false'),
  mkEdge('e6', 'd5', 'd7'),
  mkEdge('e7', 'd6', 'd7'),
  mkEdge('e8', 'd7', 'd8'),
];

// ─────────────────────────────────────────────────────────────────────────────
export default function WorkflowCanvas() {
  const [nodes, setNodes]               = useState<WFNode[]>(DEMO_NODES);
  const [edges, setEdges]               = useState<Edge[]>(DEMO_EDGES);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [viewMode, setViewMode]         = useState<ViewMode>('canvas');
  const [showTemplates, setShowTemplates] = useState(false);
  const [workflowName, setWorkflowName] = useState('Invoice Processor');
  const [editingName, setEditingName]   = useState(false);
  const [savedVariables, setSavedVariables] = useState<SavedVariable[]>([]);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [rfInstance, setRfInstance]     = useState<ReactFlowInstance<WFNode, Edge> | null>(null);

  const selectedNode = nodes.find(n => n.id === selectedNodeId) ?? null;

  const addSavedVariable = useCallback((v: SavedVariable) => {
    setSavedVariables(prev => [...prev.filter(sv => sv.key !== v.key), v]);
  }, []);

  // ── React Flow handlers ────────────────────────────────────────────────────
  const onNodesChange: OnNodesChange<WFNode> = useCallback(
    changes => setNodes(prev => applyNodeChanges(changes, prev)), []);
  const onEdgesChange: OnEdgesChange = useCallback(
    changes => setEdges(prev => applyEdgeChanges(changes, prev)), []);
  const onConnect: OnConnect = useCallback(
    conn => setEdges(prev => addEdge({ ...conn, markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: '#94a3b8', strokeWidth: 2 } }, prev)), []);

  const onNodeClick  = useCallback((_: React.MouseEvent, node: Node) => setSelectedNodeId(node.id), []);
  const onPaneClick  = useCallback(() => setSelectedNodeId(null), []);

  const onDragStart = useCallback((e: React.DragEvent, config: NodeConfig) => {
    e.dataTransfer.setData('application/json', JSON.stringify(config));
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!reactFlowWrapper.current || !rfInstance) return;
    const raw = e.dataTransfer.getData('application/json');
    if (!raw) return;
    const config: NodeConfig = JSON.parse(raw);
    const bounds   = reactFlowWrapper.current.getBoundingClientRect();
    const position = rfInstance.screenToFlowPosition({ x: e.clientX - bounds.left, y: e.clientY - bounds.top });
    const newNode: WFNode = {
      id: `node-${Date.now()}`, type: 'workflowNode', position,
      data: {
        nodeConfig: config, label: config.label, description: config.description,
        fields: Object.fromEntries((config.fields || []).map(f => [f.key, f.defaultValue ?? ''])),
        customFields: [],
      },
    };
    setNodes(prev => [...prev, newNode]);
    setSelectedNodeId(newNode.id);
  }, [rfInstance]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  // ── Node CRUD ──────────────────────────────────────────────────────────────
  const updateNode = useCallback((id: string, updates: Partial<WorkflowNodeData>) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, data: { ...n.data, ...updates } } : n));
  }, []);

  const deleteNode = useCallback((id: string) => {
    setNodes(prev => prev.filter(n => n.id !== id));
    setEdges(prev => prev.filter(e => e.source !== id && e.target !== id));
    setSelectedNodeId(null);
  }, []);

  // ── Template loading ───────────────────────────────────────────────────────
  const loadTemplate = useCallback((template: WorkflowTemplate) => {
    setNodes(template.nodes);
    setEdges(template.edges);
    setSelectedNodeId(null);
    setWorkflowName(template.name);
    setShowTemplates(false);
    setViewMode('canvas');
  }, []);

  const clearAll = () => {
    if (nodes.length === 0) { setShowTemplates(true); return; }
    if (confirm('Clear the canvas and start fresh?')) {
      setNodes([]); setEdges([]); setSelectedNodeId(null);
      setShowTemplates(true);
    }
  };

  const triggerCount = nodes.filter(n => n.data.nodeConfig?.type === 'trigger').length;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen" style={{ background: '#f4f6fb', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
      <header
        className="flex items-center gap-3 px-4 flex-shrink-0 z-20"
        style={{ background: 'white', borderBottom: '1px solid #e8eaf0', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', height: 52 }}
      >
        {/* hevyf logo */}
        <div className="flex items-center gap-2 flex-shrink-0 select-none">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shadow-sm"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
            <span className="text-white text-[13px] font-black">H</span>
          </div>
          <div className="hidden sm:flex flex-col leading-none">
            <span className="text-[12px] font-black text-gray-800 tracking-tight">hevyf</span>
            <span className="text-[9px] text-gray-400 font-medium -mt-0.5">Workflows</span>
          </div>
        </div>

        <span className="text-gray-200 text-lg select-none">›</span>

        {/* Workflow name */}
        {editingName ? (
          <input
            autoFocus value={workflowName}
            onChange={e => setWorkflowName(e.target.value)}
            onBlur={() => setEditingName(false)}
            onKeyDown={e => e.key === 'Enter' && setEditingName(false)}
            className="text-[13px] font-semibold text-gray-800 bg-transparent border-b-2 border-indigo-400 focus:outline-none px-1 max-w-[200px]"
          />
        ) : (
          <button onClick={() => setEditingName(true)}
            className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-700 hover:text-indigo-600 transition-colors max-w-[180px] truncate group">
            {workflowName}
            <span className="text-[9px] text-gray-300 group-hover:text-indigo-300">✎</span>
          </button>
        )}

        {/* Active badge */}
        <span className="text-[9px] px-2 py-0.5 rounded-full font-bold flex-shrink-0 flex items-center gap-1"
          style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
          Active
        </span>

        {nodes.length > 0 && (
          <span className="hidden md:block text-[10px] text-gray-400 flex-shrink-0">
            {nodes.length} node{nodes.length !== 1 ? 's' : ''} · {edges.length} edge{edges.length !== 1 ? 's' : ''}
          </span>
        )}

        {/* View toggle: Canvas | Code */}
        <div className="flex items-center gap-0.5 mx-auto rounded-xl p-1 flex-shrink-0"
          style={{ background: '#f1f3f8', border: '1px solid #e2e5ef' }}>
          {([
            { id: 'canvas', icon: '🗺', label: 'Canvas' },
            { id: 'code',   icon: '</>', label: 'Code'   },
          ] as { id: ViewMode; icon: string; label: string }[]).map(tab => (
            <button key={tab.id} onClick={() => setViewMode(tab.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
              style={viewMode === tab.id
                ? { background: 'white', color: '#4f46e5', boxShadow: '0 1px 4px rgba(0,0,0,0.10)' }
                : { color: '#94a3b8' }
              }>
              <span className="text-[12px]">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 ml-auto">
          <button onClick={() => setShowTemplates(true)}
            className="hidden sm:flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg font-semibold transition-all"
            style={{ background: '#f1f3f8', color: '#64748b', border: '1px solid #e2e5ef' }}>
            📚 Templates
          </button>
          <button onClick={clearAll}
            className="text-[11px] px-3 py-1.5 rounded-lg font-semibold transition-all"
            style={{ background: '#fff1f2', color: '#e11d48', border: '1px solid #fecdd3' }}>
            New
          </button>
        </div>
      </header>

      {/* ══ MAIN CONTENT ════════════════════════════════════════════════════ */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* ─── CANVAS VIEW ─────────────────────────────────────────────── */}
        {viewMode === 'canvas' && (
          <>
            {/* Node library */}
            <div className="w-56 flex-shrink-0 overflow-hidden">
              <NodeLibrary onDragStart={onDragStart} />
            </div>

            {/* React Flow */}
            <div ref={reactFlowWrapper} className="flex-1 relative overflow-hidden">
              <ReactFlow<WFNode, Edge>
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={onNodeClick}
                onPaneClick={onPaneClick}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onInit={setRfInstance}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                deleteKeyCode="Delete"
                defaultEdgeOptions={{ markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: '#94a3b8', strokeWidth: 2 } }}
              >
                <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e2e5ef" />
                <Controls position="bottom-left" />
                <MiniMap
                  nodeColor={n => (n.data as WorkflowNodeData)?.nodeConfig?.borderColor || '#94a3b8'}
                  nodeStrokeWidth={2} pannable zoomable position="bottom-right"
                />
              </ReactFlow>

              {/* Empty state */}
              {nodes.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
                  style={{ background: 'radial-gradient(circle at center, #f8f9ff, #f4f6fb)' }}>
                  <div className="text-5xl mb-4">🗺️</div>
                  <p className="text-[16px] font-bold text-gray-600 mb-1">Canvas is empty</p>
                  <p className="text-[12px] text-gray-400 mb-5 text-center max-w-[240px]">
                    Drag nodes from the left sidebar, or pick a template to get started instantly
                  </p>
                  <button onClick={() => setShowTemplates(true)}
                    className="pointer-events-auto px-5 py-2.5 text-white text-[12px] font-bold rounded-xl shadow-lg transition-all hover:scale-105"
                    style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 4px 14px rgba(99,102,241,0.30)' }}>
                    📚 Choose a Template
                  </button>
                </div>
              )}

              {/* Node/edge count pill */}
              {nodes.length > 0 && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-white rounded-full px-3 py-1 flex items-center gap-2 pointer-events-none"
                  style={{ border: '1px solid #e2e5ef', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                  <span className="text-[10px] text-gray-500 font-medium">{nodes.length} nodes · {edges.length} connections</span>
                </div>
              )}

              {/* Keyboard tip */}
              <div className="absolute bottom-10 left-1/2 -translate-x-1/2 text-[9px] text-gray-400 bg-white/80 px-3 py-1 rounded-full pointer-events-none"
                style={{ border: '1px solid #e2e5ef' }}>
                ↔ Drag handles to connect · Click to select · ⌦ Delete key to remove
              </div>
            </div>

            {/* Properties panel */}
            <div className="w-80 flex-shrink-0 overflow-hidden" style={{ borderLeft: '1px solid #e8eaf0' }}>
              <PropertiesPanel
                selectedNode={selectedNode}
                onUpdateNode={updateNode}
                onDeleteNode={deleteNode}
                allNodes={nodes}
                edges={edges}
                savedVariables={savedVariables}
                onSaveVariable={addSavedVariable}
              />
            </div>
          </>
        )}

        {/* ─── CODE VIEW ───────────────────────────────────────────────── */}
        {viewMode === 'code' && (
          <div className="flex-1 overflow-hidden">
            <CodePanel nodes={nodes} edges={edges} onClose={() => setViewMode('canvas')} />
          </div>
        )}

        {/* ══ TEMPLATES MODAL ═════════════════════════════════════════════ */}
        {showTemplates && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-6"
            style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }}>
            <div className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl"
              style={{ background: 'white', boxShadow: '0 24px 80px rgba(0,0,0,0.22)' }}>
              <div className="flex items-center justify-between px-6 py-4"
                style={{ borderBottom: '1px solid #f1f3f8', background: 'linear-gradient(to right, #fafbff, white)' }}>
                <div>
                  <div className="text-[17px] font-black text-gray-800">Choose a Workflow</div>
                  <div className="text-[12px] text-gray-400 mt-0.5">Pick a ready-made template or start from scratch</div>
                </div>
                <button onClick={() => setShowTemplates(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-gray-100 text-gray-400 hover:text-gray-600 text-lg">
                  ✕
                </button>
              </div>
              <div className="overflow-y-auto" style={{ maxHeight: 'calc(90vh - 80px)' }}>
                <TemplatesGallery onSelectTemplate={loadTemplate} isModal />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══ STATUS BAR ══════════════════════════════════════════════════════ */}
      <div className="flex items-center h-6 px-4 gap-4 flex-shrink-0 text-[9px]"
        style={{ background: 'white', borderTop: '1px solid #f1f3f8', color: '#94a3b8' }}>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded flex items-center justify-center text-white text-[8px] font-black"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>H</span>
          hevyf.com Workflows
        </span>
        <span>·</span>
        {triggerCount > 0
          ? <span>⚡ {triggerCount} trigger{triggerCount > 1 ? 's' : ''} · {nodes.length} step{nodes.length !== 1 ? 's' : ''}</span>
          : <span>No triggers configured yet</span>
        }
        <span className="ml-auto">{NODE_LIBRARY.length} node types · v3.0</span>
      </div>
    </div>
  );
}
