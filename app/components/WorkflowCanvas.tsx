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
import { NODE_LIBRARY, NodeConfig, WorkflowNodeData, SavedVariable } from '../lib/types';

type WFNode = Node<WorkflowNodeData>;

const nodeTypes: NodeTypes = { workflowNode: WorkflowNode as NodeTypes['workflowNode'] };

const edge = (id: string, source: string, target: string, label?: string, color?: string, sourceHandle?: string): Edge => ({
  id, source, target,
  ...(sourceHandle ? { sourceHandle } : {}),
  markerEnd: { type: MarkerType.ArrowClosed, color: color || '#94a3b8' },
  style: { stroke: color || '#94a3b8', strokeWidth: 2 },
  ...(label ? { label, labelStyle: { fill: color || '#94a3b8', fontSize: 10, fontWeight: 700 }, labelBgStyle: { fill: 'white' } } : {}),
});

// ── Demo workflow: Invoice Processor ──────────────────────────────────────────
// This demo shows how variables flow between nodes.
// Each node clearly outputs variables (shown as chips) that downstream
// nodes can reference using {{variableName}} syntax in their fields.
const DEMO_NODES: WFNode[] = [
  {
    // Outputs: email_subject, email_body, email_sender, email_attachments, email_date
    id: 'd1', type: 'workflowNode', position: { x: 340, y: 40 },
    data: {
      nodeConfig: NODE_LIBRARY.find(n => n.id === 'trigger-email')!,
      label: 'Email Received',
      description: 'Watch inbox for invoices with "Invoice" in subject',
      fields: { host: 'imap.gmail.com', folder: 'INBOX', filter: 'Invoice', markRead: true },
    },
  },
  {
    // INPUT: email_body, email_subject, email_sender (from d1)
    // OUTPUT: invoice_data (json) — contains vendor, amount, invoice_no, due_date, line_items
    id: 'd2', type: 'workflowNode', position: { x: 340, y: 200 },
    data: {
      nodeConfig: NODE_LIBRARY.find(n => n.id === 'ai-email-agent')!,
      label: 'Extract Invoice Data',
      description: 'AI reads {{email_body}} and extracts structured invoice fields',
      fields: {
        provider: 'Anthropic (Claude)',
        model: 'claude-sonnet-4-6',
        tools: 'extract only',
        outputVar: 'invoice_data',
        autoreply: false,
        agentInstructions: 'Extract from {{email_body}} sent by {{email_sender}}: invoice_no, vendor, amount (number), due_date, line_items (list). Return as JSON.',
      },
    },
  },
  {
    // INPUT: invoice_data (from d2)
    // OUTPUT: df, df_rows, df_cols
    id: 'd3', type: 'workflowNode', position: { x: 340, y: 370 },
    data: {
      nodeConfig: NODE_LIBRARY.find(n => n.id === 'data-read-excel')!,
      label: 'Load Invoice Tracker',
      description: 'Read existing tracker to check for duplicates',
      fields: { path: 'invoices.xlsx', sheet: 'Tracker', header: 0 },
    },
  },
  {
    // INPUT: invoice_data (from d2) — checks invoice_data["amount"]
    // OUTPUT: condition_result (boolean)  — TRUE path and FALSE path
    id: 'd4', type: 'workflowNode', position: { x: 340, y: 530 },
    data: {
      nodeConfig: NODE_LIBRARY.find(n => n.id === 'flow-if-else')!,
      label: 'High-Value Check',
      description: 'Branch: is invoice_data["amount"] > 10,000 SAR?',
      fields: {
        variable: 'invoice_data["amount"]',
        operator: '>',
        value: '10000',
      },
    },
  },
  {
    // INPUT: invoice_data (from d2) — used in subject and body via {{variable}}
    // TRUE path: amounts over 10,000 go to CFO
    id: 'd5', type: 'workflowNode', position: { x: 80, y: 710 },
    data: {
      nodeConfig: NODE_LIBRARY.find(n => n.id === 'send-email')!,
      label: 'Escalate to CFO',
      description: 'High-value invoice → CFO approval required',
      fields: {
        to: 'cfo@company.com',
        subject: '⚠️ Approval Required: Invoice from {{invoice_data["vendor"]}}',
        body: 'Hi CFO,\n\nInvoice #{{invoice_data["invoice_no"]}} from {{invoice_data["vendor"]}} for SAR {{invoice_data["amount"]}} requires your approval.\n\nDue Date: {{invoice_data["due_date"]}}\n\nPlease review and approve.',
        smtpHost: 'smtp.gmail.com',
        smtpPort: 587,
      },
    },
  },
  {
    // INPUT: invoice_data (from d2), df (from d3) — appends new invoice row
    // FALSE path: amounts under 10,000 auto-approved
    id: 'd6', type: 'workflowNode', position: { x: 600, y: 710 },
    data: {
      nodeConfig: NODE_LIBRARY.find(n => n.id === 'data-write-excel')!,
      label: 'Update Invoice Tracker',
      description: 'Append {{invoice_data["invoice_no"]}} row to tracker (df)',
      fields: { path: 'invoices.xlsx', sheet: 'Tracker', mode: 'append', autofit: true },
    },
  },
  {
    // INPUT: invoice_data (from d2), output_path (from d6)
    id: 'd7', type: 'workflowNode', position: { x: 340, y: 880 },
    data: {
      nodeConfig: NODE_LIBRARY.find(n => n.id === 'send-slack')!,
      label: 'Notify Finance Team',
      description: 'Post summary to #finance using invoice_data variables',
      fields: {
        channel: '#finance',
        message: '✅ Invoice processed!\n• Vendor: {{invoice_data["vendor"]}}\n• Amount: SAR {{invoice_data["amount"]}}\n• Invoice #: {{invoice_data["invoice_no"]}}\n• Due: {{invoice_data["due_date"]}}\n• Tracker: {{output_path}}',
        username: 'Invoice Bot',
        iconEmoji: ':receipt:',
      },
    },
  },
  {
    id: 'd8', type: 'workflowNode', position: { x: 340, y: 1040 },
    data: {
      nodeConfig: NODE_LIBRARY.find(n => n.id === 'end-success')!,
      label: 'Done',
      description: 'All steps complete. {{df_rows}} invoices in tracker.',
      fields: { message: 'Invoice processed successfully. Tracker has {{df_rows}} rows.', returnVar: 'invoice_data' },
    },
  },
];

const DEMO_EDGES: Edge[] = [
  edge('e1', 'd1', 'd2'),
  edge('e2', 'd2', 'd3'),
  edge('e3', 'd3', 'd4'),
  edge('e4', 'd4', 'd5', 'TRUE (>10k)', '#10b981', 'true'),
  edge('e5', 'd4', 'd6', 'FALSE', '#ef4444', 'false'),
  edge('e6', 'd5', 'd7'),
  edge('e7', 'd6', 'd7'),
  edge('e8', 'd7', 'd8'),
];

export default function WorkflowCanvas() {
  const [nodes, setNodes] = useState<WFNode[]>(DEMO_NODES);
  const [edges, setEdges] = useState<Edge[]>(DEMO_EDGES);
  const [selectedNode, setSelectedNode] = useState<WFNode | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [workflowName, setWorkflowName] = useState('Invoice Processor');
  const [editingName, setEditingName] = useState(false);
  const [savedVariables, setSavedVariables] = useState<SavedVariable[]>([]);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance<WFNode, Edge> | null>(null);

  const addSavedVariable = useCallback((v: SavedVariable) => {
    setSavedVariables(prev => {
      // Replace if same key already exists
      const filtered = prev.filter(sv => sv.key !== v.key);
      return [...filtered, v];
    });
  }, []);

  const onNodesChange: OnNodesChange<WFNode> = useCallback(
    changes => setNodes(prev => applyNodeChanges(changes, prev)), []);
  const onEdgesChange: OnEdgesChange = useCallback(
    changes => setEdges(prev => applyEdgeChanges(changes, prev)), []);
  const onConnect: OnConnect = useCallback(
    conn => setEdges(prev => addEdge({ ...conn, markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: '#94a3b8', strokeWidth: 2 } }, prev)), []);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node as WFNode);
  }, []);
  const onPaneClick = useCallback(() => setSelectedNode(null), []);

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
    const bounds = reactFlowWrapper.current.getBoundingClientRect();
    const position = rfInstance.screenToFlowPosition({ x: e.clientX - bounds.left, y: e.clientY - bounds.top });
    const newNode: WFNode = {
      id: `node-${Date.now()}`,
      type: 'workflowNode',
      position,
      data: {
        nodeConfig: config,
        label: config.label,
        description: config.description,
        fields: Object.fromEntries((config.fields || []).map(f => [f.key, f.defaultValue ?? ''])),
        customFields: [],
      },
    };
    setNodes(prev => [...prev, newNode]);
  }, [rfInstance]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const updateNode = useCallback((id: string, updates: Partial<WorkflowNodeData>) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, data: { ...n.data, ...updates } } : n));
    setSelectedNode(prev => prev?.id === id ? { ...prev, data: { ...prev.data, ...updates } } : prev);
  }, []);

  const deleteNode = useCallback((id: string) => {
    setNodes(prev => prev.filter(n => n.id !== id));
    setEdges(prev => prev.filter(e => e.source !== id && e.target !== id));
    setSelectedNode(null);
  }, []);

  const clearAll = () => {
    if (nodes.length === 0) return;
    if (confirm('Clear all nodes?')) { setNodes([]); setEdges([]); setSelectedNode(null); }
  };

  const loadDemo = () => { setNodes(DEMO_NODES); setEdges(DEMO_EDGES); setSelectedNode(null); };

  // Category breakdown for header
  const catCounts = nodes.reduce((acc, n) => {
    const t = n.data.nodeConfig?.type;
    if (t) acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* ── Navbar ─────────────────────────────────────────────────────── */}
      <header className="flex items-center h-12 px-4 bg-white border-b border-gray-200 shadow-sm z-10 gap-3 flex-shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-7 h-7 bg-orange-500 rounded-lg flex items-center justify-center shadow-sm">
            <span className="text-white text-[11px] font-black">W</span>
          </div>
          <span className="text-[12px] font-black text-gray-800 hidden sm:block tracking-tight">FlowBuilder</span>
        </div>

        <span className="text-gray-300">›</span>

        {/* Workflow name */}
        {editingName ? (
          <input
            autoFocus
            value={workflowName}
            onChange={e => setWorkflowName(e.target.value)}
            onBlur={() => setEditingName(false)}
            onKeyDown={e => e.key === 'Enter' && setEditingName(false)}
            className="text-[12px] font-semibold text-gray-800 bg-transparent border-b border-orange-400 focus:outline-none px-1 max-w-[180px]"
          />
        ) : (
          <button onClick={() => setEditingName(true)} className="text-[12px] font-semibold text-gray-700 hover:text-orange-600 transition-colors max-w-[160px] truncate">
            {workflowName}
          </button>
        )}
        <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0">● Live</span>

        {/* Category breakdown */}
        <div className="hidden lg:flex items-center gap-1.5 mx-2 flex-wrap">
          {Object.entries(catCounts).map(([cat, count]) => (
            <span key={cat} className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
              {cat} ×{count}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-[10px] text-gray-400 hidden md:block">{nodes.length}N · {edges.length}E</span>
          <button onClick={loadDemo} className="text-[10px] px-2.5 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors hidden sm:block">
            Demo
          </button>
          <button onClick={clearAll} className="text-[10px] px-2.5 py-1.5 text-gray-600 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors">
            Clear
          </button>
          <button
            onClick={() => setShowCode(!showCode)}
            className={`flex items-center gap-1.5 text-[11px] px-3.5 py-1.5 rounded-lg font-bold transition-all shadow-sm ${
              showCode ? 'bg-gray-800 text-white' : 'bg-orange-500 text-white hover:bg-orange-600 shadow-orange-200'
            }`}
          >
            {showCode ? '← Canvas' : '✨ Generate'}
          </button>
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Node library */}
        {!showCode && (
          <div className="w-56 flex-shrink-0 overflow-hidden">
            <NodeLibrary onDragStart={onDragStart} />
          </div>
        )}

        {/* Canvas */}
        <div
          ref={reactFlowWrapper}
          className="flex-1 relative overflow-hidden"
          style={{ display: showCode ? 'none' : 'block' }}
        >
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
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e5e7eb" />
            <Controls position="bottom-left" />
            <MiniMap
              nodeColor={n => (n.data as WorkflowNodeData)?.nodeConfig?.borderColor || '#94a3b8'}
              nodeStrokeWidth={2}
              pannable zoomable
              position="bottom-right"
            />
          </ReactFlow>

          {/* Empty state */}
          {nodes.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="text-5xl mb-3">🎨</div>
              <p className="text-[15px] font-bold text-gray-500">Build your workflow</p>
              <p className="text-[12px] text-gray-400 mt-1 mb-5">Drag nodes from the left sidebar onto the canvas</p>
              <button onClick={loadDemo} className="pointer-events-auto px-4 py-2 bg-orange-500 text-white text-[12px] font-bold rounded-xl hover:bg-orange-600 transition-colors">
                Load Demo Workflow
              </button>
            </div>
          )}

          {/* Node count pill */}
          {nodes.length > 0 && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-white border border-gray-200 shadow-sm rounded-full px-3 py-1 flex items-center gap-2 pointer-events-none">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              <span className="text-[10px] text-gray-600 font-medium">{nodes.length} nodes · {edges.length} connections</span>
            </div>
          )}
        </div>

        {/* Code panel */}
        {showCode && (
          <div className="flex-1 overflow-hidden">
            <CodePanel nodes={nodes} edges={edges} onClose={() => setShowCode(false)} />
          </div>
        )}

        {/* Properties panel */}
        {!showCode && (
          <div className="w-72 flex-shrink-0 overflow-hidden">
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
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center h-5 px-4 bg-white border-t border-gray-100 text-[9px] text-gray-400 gap-3 flex-shrink-0">
        <span>↔ Drag to connect handles · Click to select · ⌫ Delete selected</span>
        <span className="ml-auto">FlowBuilder v2.0 · {NODE_LIBRARY.length} node types available</span>
      </div>
    </div>
  );
}
