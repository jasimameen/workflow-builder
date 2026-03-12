'use client';

import { useState, useRef, useCallback } from 'react';
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
import { getAvailableVariables, computeNodeOutputs, varTypeColor, AvailableVariable, ResolvedOutput } from '../lib/nodeIO';
import VariablePicker from './VariablePicker';
import InteractiveOutputViewer from './InteractiveOutputViewer';
import {
  Plus, Trash2, ChevronDown, ChevronRight, Play, Copy, Check,
  AlertCircle, CheckCircle, Clock, Loader2, Eye, EyeOff, Key,
  ArrowDown, ArrowUp, Zap,
} from 'lucide-react';

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
//  I/O Contract Section
// ─────────────────────────────────────────────────────────────────────────────

function IOContractSection({
  upstreamVars,
  ownOutputs,
  nodeColor,
  nodeBorder,
}: {
  upstreamVars: AvailableVariable[];
  ownOutputs: ResolvedOutput[];
  nodeColor: string;
  nodeBorder: string;
}) {
  const [open, setOpen] = useState(true);
  const [copiedVar, setCopiedVar] = useState<string | null>(null);

  const copyVar = (key: string) => {
    navigator.clipboard.writeText(`{{${key}}}`);
    setCopiedVar(key);
    setTimeout(() => setCopiedVar(null), 1500);
  };

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden mb-3">
      {/* Header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-1.5">
          {open ? <ChevronDown size={11} className="text-gray-500" /> : <ChevronRight size={11} className="text-gray-500" />}
          <Zap size={11} style={{ color: nodeBorder }} />
          <span className="text-[10px] font-bold text-gray-700 uppercase tracking-wider">I/O Contract</span>
          <span className="text-[9px] text-gray-400">— what flows in &amp; out</span>
        </div>
        <div className="flex items-center gap-2 text-[8px] text-gray-400">
          <span className="flex items-center gap-0.5"><ArrowDown size={8} className="text-blue-400" />{upstreamVars.length} in</span>
          <span className="flex items-center gap-0.5"><ArrowUp size={8} className="text-green-500" />{ownOutputs.length} out</span>
        </div>
      </button>

      {open && (
        <div className="divide-y divide-gray-100">
          {/* ── INPUTS: Variables available from upstream ── */}
          <div className="px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-2">
              <ArrowDown size={10} className="text-blue-400" />
              <span className="text-[9px] font-bold uppercase tracking-wider text-blue-600">
                Available inputs from upstream
              </span>
              {upstreamVars.length === 0 && (
                <span className="text-[9px] text-gray-400 italic">— no upstream nodes connected</span>
              )}
            </div>
            {upstreamVars.length > 0 ? (
              <div className="space-y-1">
                {upstreamVars.map((v) => {
                  const c = varTypeColor(v.type);
                  return (
                    <div
                      key={`${v.nodeId}-${v.key}`}
                      className="flex items-center justify-between gap-1.5 px-2 py-1.5 rounded-lg group"
                      style={{ background: `${c.bg}`, border: `1px solid ${c.border}` }}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span style={{ color: c.dot, fontSize: 7, flexShrink: 0 }}>●</span>
                        <code
                          className="text-[10px] font-mono font-bold truncate"
                          style={{ color: c.text }}
                        >
                          {`{{${v.key}}}`}
                        </code>
                        <span className="text-[9px] px-1 py-0.5 rounded text-gray-500 bg-white border border-gray-200 flex-shrink-0">
                          {v.type}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-[8px] text-gray-400 truncate max-w-[70px]" title={v.nodeName}>
                          {v.nodeName}
                        </span>
                        <button
                          onClick={() => copyVar(v.key)}
                          className="opacity-0 group-hover:opacity-100 text-[8px] px-1 py-0.5 rounded bg-white border border-gray-200 text-gray-500 hover:text-gray-700 transition-all flex items-center gap-0.5"
                          title={`Copy {{${v.key}}}`}
                        >
                          {copiedVar === v.key ? <Check size={8} className="text-green-500" /> : <Copy size={8} />}
                          {copiedVar === v.key ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-[9px] text-gray-400 italic px-1">
                Connect nodes before this one to see available variables here.
              </div>
            )}
          </div>

          {/* ── OUTPUTS: What this node produces ── */}
          <div className="px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-2">
              <ArrowUp size={10} className="text-green-500" />
              <span className="text-[9px] font-bold uppercase tracking-wider text-green-700">
                This node&apos;s outputs
              </span>
              {ownOutputs.length === 0 && (
                <span className="text-[9px] text-gray-400 italic">— no outputs (control-flow node)</span>
              )}
            </div>
            {ownOutputs.length > 0 ? (
              <div className="space-y-1">
                {ownOutputs.map((o) => {
                  const c = varTypeColor(o.type);
                  return (
                    <div
                      key={o.key}
                      className="flex items-center justify-between gap-1.5 px-2 py-1.5 rounded-lg group"
                      style={{ background: `${c.bg}`, border: `1px solid ${c.border}` }}
                    >
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span style={{ color: c.dot, fontSize: 7, flexShrink: 0 }}>▶</span>
                        <code
                          className="text-[10px] font-mono font-bold"
                          style={{ color: c.text }}
                        >
                          {o.key}
                        </code>
                        <span className="text-[9px] px-1 py-0.5 rounded text-gray-500 bg-white border border-gray-200 flex-shrink-0">
                          {o.type}
                        </span>
                        {o.source === 'custom' && (
                          <span className="text-[7px] text-orange-500 border border-orange-200 bg-orange-50 px-1 rounded">custom</span>
                        )}
                      </div>
                      {o.label && (
                        <span className="text-[8px] text-gray-400 italic truncate max-w-[90px]" title={o.label}>
                          {o.label}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-[9px] text-gray-400 italic px-1">
                This node produces no variables — it is used for control flow only.
              </div>
            )}
          </div>

          {/* ── Usage hint ── */}
          {upstreamVars.length > 0 && (
            <div className="px-3 py-2 bg-blue-50">
              <p className="text-[9px] text-blue-600 leading-relaxed">
                💡 Type <code className="font-mono bg-blue-100 px-0.5 rounded">{`{{variableName}}`}</code> in any text field to reference an upstream variable. Click <strong>Copy</strong> on any variable above to insert it.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Empty state
// ─────────────────────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-white border-l border-gray-100 px-5 text-center">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 bg-gray-50">
        <span className="text-2xl">🖱️</span>
      </div>
      <p className="text-[13px] font-semibold text-gray-600">Select a node</p>
      <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
        Click any node on the canvas to configure its settings
      </p>
      <div className="mt-4 text-[10px] text-gray-300 space-y-1">
        <p>⌫ Delete — remove selected node</p>
        <p>⌘Z — undo last action</p>
      </div>
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
  const [customOpen, setCustomOpen] = useState(true);
  const [testRunning, setTestRunning] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [mockInput, setMockInput] = useState('{}');
  const [copiedOutput, setCopiedOutput] = useState(false);

  // ── All hooks must be declared before any conditional returns ──────────────
  const inputRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({});

  const makeInsertHandler = useCallback((key: string, currentVal: string, setter: (v: string) => void) => {
    return (text: string) => {
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
    };
  }, []);

  if (!selectedNode) return <EmptyState />;

  const { nodeConfig, fields = {}, customFields = [], testValues = {}, testState } = selectedNode.data;

  // ── field helpers ──────────────────────────────────────────────────────────
  const updateField = (key: string, value: string | number | boolean) =>
    onUpdateNode(selectedNode.id, { fields: { ...fields, [key]: value } });

  const updateTestValue = (key: string, value: string | number | boolean) =>
    onUpdateNode(selectedNode.id, { testValues: { ...testValues, [key]: value } });

  const addCustomField = () => {
    const newCf: CustomField = {
      id: `cf-${Date.now()}`,
      key: `custom_field_${customFields.length + 1}`,
      label: `Custom Field ${customFields.length + 1}`,
      type: 'text',
      value: '',
    };
    onUpdateNode(selectedNode.id, { customFields: [...customFields, newCf] });
  };

  const updateCustomField = (id: string, updates: Partial<CustomField>) =>
    onUpdateNode(selectedNode.id, {
      customFields: customFields.map(cf => cf.id === id ? { ...cf, ...updates } : cf),
    });

  const removeCustomField = (id: string) =>
    onUpdateNode(selectedNode.id, { customFields: customFields.filter(cf => cf.id !== id) });

  // ── test runner ────────────────────────────────────────────────────────────
  const runTest = async () => {
    setTestRunning(true);
    onUpdateNode(selectedNode.id, { testState: { status: 'running' } });
    const start = Date.now();

    // Effective field values: normal fields merged with test overrides
    const effectiveFields = { ...fields, ...testValues };

    try {
      let result: NodeTestState;

      // ── HTTP Request ────────────────────────────────────────────────────
      if (nodeConfig.id === 'external-http') {
        let parsedInput: Record<string, unknown> = {};
        try { parsedInput = JSON.parse(mockInput); } catch { /* ok */ }
        let parsedBody: unknown;
        try { parsedBody = JSON.parse(String(effectiveFields.body || '')); } catch { parsedBody = effectiveFields.body; }
        let parsedHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
        try { parsedHeaders = { ...parsedHeaders, ...JSON.parse(String(effectiveFields.headers || '{}')) }; } catch { /* ok */ }

        const authValue = String(effectiveFields.authValue || '');
        if (effectiveFields.auth === 'Bearer Token' && authValue) {
          parsedHeaders['Authorization'] = `Bearer ${authValue}`;
        } else if (effectiveFields.auth === 'API Key header' && authValue) {
          parsedHeaders['X-API-Key'] = authValue;
        }

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
          outputData: data.ok ? { status: data.status, statusText: data.statusText, body: data.body, headers: data.headers } : null,
          error: data.ok ? undefined : data.error,
          httpStatus: data.status,
          httpStatusText: data.statusText,
          testedAt: Date.now(),
        };

      // ── AI Nodes ─────────────────────────────────────────────────────────
      } else if (nodeConfig.type === 'ai') {
        if (!apiKey) {
          result = { status: 'error', error: 'Enter your API key in the Test tab to run AI tests', duration: 0, testedAt: Date.now() };
        } else {
          let parsedInput: Record<string, unknown> = {};
          try { parsedInput = JSON.parse(mockInput); } catch { /* ok */ }

          // Replace {variable} placeholders in prompts with mock input values
          const replacePlaceholders = (str: string) =>
            str.replace(/\{(\w+)\}/g, (_, k) => String((parsedInput as Record<string,unknown>)[k] ?? `{${k}}`));

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

      // ── Python Code ──────────────────────────────────────────────────────
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

      // ── All other node types: simulate ──────────────────────────────────
      } else {
        await new Promise(r => setTimeout(r, 600)); // fake delay
        let parsedInput: Record<string, unknown> = {};
        try { parsedInput = JSON.parse(mockInput); } catch { /* ok */ }
        result = {
          status: 'success',
          duration: Date.now() - start,
          inputData: parsedInput,
          outputData: {
            _simulated: true,
            _note: 'Simulation — no actual execution for this node type',
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

  // (inputRefs and makeInsertHandler are declared above the early-return, honouring Rules of Hooks)

  // Compute I/O contract
  const upstreamVars = getAvailableVariables(selectedNode.id, allNodes, edges);
  const ownOutputs = computeNodeOutputs(nodeConfig, fields, customFields);

  // Decide if a node needs an API key in test
  const needsApiKey = nodeConfig.type === 'ai';
  const isHttpNode = nodeConfig.id === 'external-http';
  const isPythonNode = nodeConfig.id === 'code-python' || nodeConfig.id === 'code-javascript';
  const isSimulated = !needsApiKey && !isHttpNode && !isPythonNode;

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-100 animate-slide-in">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div
        className="px-3.5 pt-3 pb-2.5 border-b border-gray-100 flex-shrink-0"
        style={{ borderTop: `3px solid ${nodeConfig.borderColor}` }}
      >
        <div className="flex items-center justify-between mb-2">
          <span
            className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full"
            style={{ color: nodeConfig.color, background: `${nodeConfig.borderColor}18` }}
          >
            {nodeConfig.type}
          </span>
          <button
            onClick={() => onDeleteNode(selectedNode.id)}
            className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-600 hover:bg-red-50 px-2 py-0.5 rounded-lg transition-colors"
          >
            <Trash2 size={10} /> Delete
          </button>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: `${nodeConfig.borderColor}20`, color: nodeConfig.color }}
          >
            <NodeIcon name={nodeConfig.iconName} size={16} />
          </div>
          <div>
            <div className="text-[13px] font-bold text-gray-800">{nodeConfig.label}</div>
            <div className="text-[10px] text-gray-400 leading-tight">{nodeConfig.description}</div>
          </div>
        </div>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────── */}
      <div className="flex border-b border-gray-100 bg-gray-50 flex-shrink-0">
        <TabBtn active={activeTab === 'config'} onClick={() => setActiveTab('config')}>
          ⚙ Configure
        </TabBtn>
        <TabBtn active={activeTab === 'test'} onClick={() => setActiveTab('test')}>
          <span className="flex items-center gap-1">
            🧪 Test
            {testState && testState.status !== 'idle' && (
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  testState.status === 'success' ? 'bg-green-500' :
                  testState.status === 'error' ? 'bg-red-500' :
                  testState.status === 'running' ? 'bg-orange-400 animate-pulse' : 'bg-gray-300'
                }`}
              />
            )}
          </span>
        </TabBtn>
      </div>

      {/* ── Config Tab ────────────────────────────────────────────────── */}
      {activeTab === 'config' && (
        <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3">

          {/* ── I/O Contract ─────────────────────────────────────────── */}
          <IOContractSection
            upstreamVars={upstreamVars}
            ownOutputs={ownOutputs}
            nodeColor={nodeConfig.color}
            nodeBorder={nodeConfig.borderColor}
          />

          {/* Display name */}
          <FieldRow
            fieldKey="display_label"
            field={{ key: 'display_label', label: 'Display Name', type: 'text', placeholder: nodeConfig.label }}
            value={String(selectedNode.data.label || nodeConfig.label)}
            onChange={v => onUpdateNode(selectedNode.id, { label: String(v) })}
            allNodes={allNodes}
            savedVariables={savedVariables}
            inputRef={el => { inputRefs.current['display_label'] = el; }}
            onInsert={makeInsertHandler('display_label', String(selectedNode.data.label || nodeConfig.label), v => onUpdateNode(selectedNode.id, { label: v }))}
          />
          {/* Description */}
          <FieldRow
            fieldKey="display_desc"
            field={{ key: 'display_desc', label: 'Description', type: 'text', placeholder: 'Optional note...' }}
            value={String(selectedNode.data.description || '')}
            onChange={v => onUpdateNode(selectedNode.id, { description: String(v) })}
            allNodes={allNodes}
            savedVariables={savedVariables}
            inputRef={el => { inputRefs.current['display_desc'] = el; }}
            onInsert={makeInsertHandler('display_desc', String(selectedNode.data.description || ''), v => onUpdateNode(selectedNode.id, { description: v }))}
          />

          {/* Dynamic fields */}
          {(nodeConfig.fields || []).map(field => {
            const currentVal = fields[field.key] !== undefined ? fields[field.key] : (field.defaultValue ?? '');
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
              />
            );
          })}

          {/* ── Custom Fields ──────────────────────────────────────────── */}
          <div className="border border-dashed border-gray-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setCustomOpen(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-1.5">
                {customOpen ? <ChevronDown size={11} className="text-gray-500" /> : <ChevronRight size={11} className="text-gray-500" />}
                <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Custom Fields</span>
                {customFields.length > 0 && (
                  <span className="text-[9px] bg-orange-100 text-orange-600 px-1 rounded-full font-bold">{customFields.length}</span>
                )}
              </div>
              <button
                onClick={e => { e.stopPropagation(); addCustomField(); setCustomOpen(true); }}
                className="flex items-center gap-0.5 text-[9px] text-orange-500 hover:text-orange-700 hover:bg-orange-50 px-1.5 py-0.5 rounded transition-colors font-semibold"
              >
                <Plus size={9} /> Add Field
              </button>
            </button>

            {customOpen && (
              <div className="p-2.5 space-y-3">
                {customFields.length === 0 ? (
                  <div className="text-center py-3">
                    <p className="text-[10px] text-gray-400">No custom fields yet.</p>
                    <p className="text-[9px] text-gray-300 mt-0.5">Custom fields become variables you can reference with <code className="font-mono">{'{key}'}</code>.</p>
                    <button
                      onClick={addCustomField}
                      className="mt-2 w-full flex items-center justify-center gap-1.5 text-[10px] text-orange-500 hover:text-orange-700 border border-dashed border-orange-200 hover:border-orange-400 rounded-lg py-2 transition-colors"
                    >
                      <Plus size={11} /> Add Custom Field
                    </button>
                  </div>
                ) : (
                  customFields.map(cf => (
                    <CustomFieldEditor
                      key={cf.id}
                      field={cf}
                      onChange={upd => updateCustomField(cf.id, upd)}
                      onRemove={() => removeCustomField(cf.id)}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Test Tab ──────────────────────────────────────────────────── */}
      {activeTab === 'test' && (
        <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3">

          {/* API Key for AI/HTTP */}
          {(needsApiKey || isHttpNode) && (
            <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Key size={11} className="text-amber-600" />
                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">
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
              <p className="text-[9px] text-amber-600 mt-1">Key is used only for this test — never stored.</p>
            </div>
          )}

          {/* Mock Input Data */}
          <div>
            <label className="block text-[10px] font-semibold text-gray-600 mb-1">
              Input Data <span className="text-gray-400 font-normal">(mock JSON passed to node)</span>
            </label>
            <textarea
              className="w-full text-[10px] bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 font-mono focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400 resize-y"
              rows={4}
              value={mockInput}
              onChange={e => setMockInput(e.target.value)}
              spellCheck={false}
              placeholder='{"row": {"Name": "Test", "Amount": 100}}'
            />
            <p className="text-[9px] text-gray-400 mt-0.5">Variables like <code className="font-mono text-violet-600">{'{Name}'}</code> in your fields will be replaced with these values.</p>
          </div>

          {/* Test value overrides */}
          {(nodeConfig.fields || []).length > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-gray-600 mb-2 flex items-center gap-1.5">
                Test Overrides
                <span className="text-[9px] text-gray-400 font-normal">— override field values just for this test</span>
              </div>
              <div className="space-y-2">
                {(nodeConfig.fields || [])
                  .filter(f => ['text', 'number', 'textarea', 'json', 'code'].includes(f.type))
                  .slice(0, 6) // show top 6 fields to keep it manageable
                  .map(field => {
                    const testVal = testValues[field.key];
                    const placeholder = String(fields[field.key] !== undefined ? fields[field.key] : (field.defaultValue ?? ''));
                    return (
                      <div key={field.key} className="flex items-start gap-2">
                        <label className="text-[9px] font-semibold text-gray-500 pt-1.5 w-24 flex-shrink-0 truncate" title={field.label}>
                          {field.label}
                        </label>
                        <input
                          type={field.type === 'number' ? 'number' : 'text'}
                          className="flex-1 text-[10px] bg-gray-50 border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-violet-200 focus:border-violet-400"
                          value={testVal !== undefined ? String(testVal) : ''}
                          onChange={e => updateTestValue(field.key, field.type === 'number' ? Number(e.target.value) : e.target.value)}
                          placeholder={placeholder ? placeholder.slice(0, 50) : 'use configured value'}
                        />
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* ── Run Test Button ──────────────────────────────────────── */}
          <button
            onClick={runTest}
            disabled={testRunning}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-[12px] transition-all ${
              testRunning
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-orange-500 text-white hover:bg-orange-600 shadow-md shadow-orange-200 active:scale-95'
            }`}
          >
            {testRunning ? (
              <><Loader2 size={14} className="animate-spin" /> Running test...</>
            ) : (
              <><Play size={13} /> {isSimulated ? 'Simulate Node' : 'Run Test'}</>
            )}
          </button>

          {isSimulated && !testState && (
            <p className="text-[9px] text-gray-400 text-center -mt-1">
              This node type doesn't have live execution — it will simulate based on your configuration.
            </p>
          )}

          {/* ── Test Result ──────────────────────────────────────────── */}
          {testState && testState.status !== 'idle' && (
            <div className="rounded-xl border overflow-hidden" style={{
              borderColor: testState.status === 'success' ? '#bbf7d0' : testState.status === 'error' ? '#fecaca' : '#e5e7eb',
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
                  {testState.status === 'success' ? 'Test passed' :
                   testState.status === 'error' ? 'Test failed' : 'Running...'}
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
                    <Clock size={9} />{testState.duration}ms
                  </span>
                )}
              </div>

              {/* Error message */}
              {testState.error && (
                <div className="px-3 py-2 bg-red-50 border-t border-red-100">
                  <p className="text-[10px] text-red-700 font-mono whitespace-pre-wrap">{testState.error}</p>
                </div>
              )}

              {/* Interactive output — click any value to save to a custom field */}
              {testState.outputData != null && (
                <div className="border-t border-gray-100">
                  <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Output</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] text-violet-500 font-semibold">Click any value → save to field</span>
                      <button
                        onClick={copyOutput}
                        className="flex items-center gap-0.5 text-[9px] text-gray-500 hover:text-gray-700 hover:bg-gray-200 px-1.5 py-0.5 rounded transition-colors"
                      >
                        {copiedOutput ? <Check size={9} className="text-green-600" /> : <Copy size={9} />}
                        {copiedOutput ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>
                  <div className="px-3 py-2 overflow-y-auto" style={{ maxHeight: 400 }}>
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
                        // Switch to config tab so user can see the updated field
                        setActiveTab('config');
                        setCustomOpen(true);
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
                        // Switch to config tab so user can see the new field
                        setTimeout(() => { setActiveTab('config'); setCustomOpen(true); }, 900);
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
      <div className="px-3.5 py-2 border-t border-gray-100 flex-shrink-0 bg-gray-50">
        <p className="text-[9px] text-gray-400">
          {activeTab === 'config'
            ? 'Changes instantly update the generated code. Use {} to reference variables.'
            : 'Test runs happen in your browser. API keys are never stored.'}
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Tab button
// ─────────────────────────────────────────────────────────────────────────────
function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2 text-[11px] font-semibold transition-colors border-b-2 ${
        active
          ? 'text-orange-600 border-orange-500 bg-white'
          : 'text-gray-400 border-transparent hover:text-gray-600 hover:bg-gray-100'
      }`}
    >
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Generic field renderer (with variable picker button on text/textarea)
// ─────────────────────────────────────────────────────────────────────────────
function FieldRow({
  fieldKey,
  field,
  value,
  onChange,
  allNodes,
  savedVariables,
  inputRef,
  onInsert,
}: {
  fieldKey: string;
  field: FieldConfig | { key: string; label: string; type: 'text'; placeholder?: string };
  value: string | number | boolean;
  onChange: (v: string | number | boolean) => void;
  allNodes: Node<WorkflowNodeData>[];
  savedVariables: SavedVariable[];
  inputRef: (el: HTMLInputElement | HTMLTextAreaElement | null) => void;
  onInsert: (text: string) => void;
}) {
  const base = 'w-full text-[11px] bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400 transition-colors';
  const hint = 'hint' in field ? field.hint : undefined;
  const type = 'type' in field ? field.type : 'text';
  const isPickable = ['text', 'textarea', 'code', 'json'].includes(type);

  return (
    <div>
      <label className="block text-[10px] font-semibold text-gray-600 mb-1">{field.label}</label>

      {type === 'select' && 'options' in field ? (
        <select className={base} value={String(value)} onChange={e => onChange(e.target.value)}>
          {(field as FieldConfig).options!.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>

      ) : type === 'textarea' || type === 'code' || type === 'json' ? (
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
          {isPickable && (
            <div className="mt-0.5">
              <VariablePicker allNodes={allNodes} savedVariables={savedVariables} onInsert={onInsert} />
            </div>
          )}
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
            <input type="checkbox" className="sr-only" checked={Boolean(value)} onChange={e => onChange(e.target.checked)} />
            <div className={`w-9 h-5 rounded-full transition-colors ${Boolean(value) ? 'bg-orange-500' : 'bg-gray-200'}`} />
            <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${Boolean(value) ? 'translate-x-4' : ''}`} />
          </div>
          <span className="text-[11px] text-gray-600">{Boolean(value) ? 'Yes' : 'No'}</span>
        </label>

      ) : type === 'number' ? (
        <input
          type="number"
          className={base}
          value={Number(value)}
          onChange={e => onChange(Number(e.target.value))}
          placeholder={'placeholder' in field ? field.placeholder : ''}
        />

      ) : (
        // text — with variable picker
        <div className="flex gap-1 items-center">
          <input
            ref={inputRef as (el: HTMLInputElement | null) => void}
            type="text"
            className={`${base} flex-1`}
            value={String(value)}
            onChange={e => onChange(e.target.value)}
            placeholder={'placeholder' in field ? field.placeholder : ''}
            spellCheck={false}
          />
          {isPickable && (
            <VariablePicker allNodes={allNodes} savedVariables={savedVariables} onInsert={onInsert} />
          )}
        </div>
      )}

      {hint && <p className="text-[9px] text-gray-400 mt-0.5">{hint}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Custom field editor row — color-coded by type, shows saved value + source
// ─────────────────────────────────────────────────────────────────────────────
function CustomFieldEditor({
  field,
  onChange,
  onRemove,
}: {
  field: CustomField;
  onChange: (upd: Partial<CustomField>) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const colors = FIELD_TYPE_COLORS[field.type] || FIELD_TYPE_COLORS.text;
  const inputBase = 'text-[10px] bg-gray-50 border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-orange-300 w-full transition-colors';
  const TYPE_OPTIONS: CustomField['type'][] = ['text', 'number', 'boolean', 'json', 'regex', 'textarea', 'select'];

  const hasValue = field.value !== undefined && field.value !== '' && field.value !== null;
  const valueStr = field.value == null ? '' : (typeof field.value === 'object'
    ? JSON.stringify(field.value)
    : String(field.value));
  const previewStr = valueStr.length > 60 ? valueStr.slice(0, 60) + '…' : valueStr;
  const isFromTest = Boolean(field.sourcePath);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: `1.5px solid ${colors.border}` }}
    >
      {/* ── Compact header row — always visible ─────────────────────── */}
      <div
        className="flex items-center gap-1.5 px-2.5 py-2 cursor-pointer"
        style={{ background: colors.bg }}
        onClick={() => setExpanded(v => !v)}
      >
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: colors.dot }} />

        {/* key + use reference */}
        <span className="text-[10px] font-mono font-bold text-gray-700 flex-1 truncate">{`{${field.key}}`}</span>

        {/* value preview — prominent */}
        {hasValue ? (
          <span
            className="text-[9px] font-mono font-semibold truncate max-w-[90px]"
            style={{ color: colors.text }}
            title={valueStr}
          >
            {previewStr}
          </span>
        ) : (
          <span className="text-[9px] text-gray-300 italic">no value</span>
        )}

        {/* source badge — only when saved from test output */}
        {isFromTest && (
          <span className="flex-shrink-0 text-[8px] font-bold text-green-700 bg-green-50 border border-green-200 px-1 py-0.5 rounded-full whitespace-nowrap">
            from test
          </span>
        )}

        {/* type chip */}
        <span
          className="flex-shrink-0 text-[8px] font-semibold px-1.5 py-0.5 rounded-full"
          style={{ background: colors.border, color: colors.text }}
        >
          {field.type}
        </span>

        {/* expand/remove */}
        {expanded ? <ChevronDown size={10} className="text-gray-400 flex-shrink-0" /> : <ChevronRight size={10} className="text-gray-400 flex-shrink-0" />}
        <button
          onClick={e => { e.stopPropagation(); onRemove(); }}
          className="text-red-400 hover:text-red-600 p-0.5 rounded hover:bg-red-50 transition-colors flex-shrink-0"
        >
          <Trash2 size={10} />
        </button>
      </div>

      {/* ── Source path banner — when saved from test output ────────── */}
      {isFromTest && (
        <div className="px-2.5 py-1 bg-green-50 border-t border-green-100 flex items-center gap-1.5 flex-wrap">
          <span className="text-[8px] font-bold text-green-600 uppercase tracking-wide flex-shrink-0">Saved from</span>
          <code className="text-[8px] font-mono text-green-700 bg-white border border-green-200 px-1.5 py-0.5 rounded truncate max-w-full">
            {field.sourcePath}
          </code>
        </div>
      )}

      {/* ── Current value display — always show if has value ────────── */}
      {hasValue && !expanded && (
        <div className="px-2.5 py-1.5 bg-white border-t border-gray-100">
          <span className="text-[8px] text-gray-400 font-bold uppercase block mb-0.5">Current value</span>
          <span className="text-[9px] font-mono text-gray-700 break-all leading-relaxed">{valueStr}</span>
        </div>
      )}

      {/* ── Editable section (expanded) ─────────────────────────────── */}
      {expanded && (
        <div className="px-2.5 pt-2 pb-2.5 space-y-2 bg-white border-t border-gray-100">
          {/* key + type row */}
          <div className="flex items-center gap-1.5">
            <input
              className={`${inputBase} font-mono flex-1`}
              value={field.key}
              onChange={e => onChange({ key: e.target.value.replace(/\s/g, '_').replace(/[^a-zA-Z0-9_]/g, '') })}
              placeholder="variable_name"
              spellCheck={false}
            />
            <select
              className="text-[9px] bg-white border rounded px-1 py-1 focus:outline-none flex-shrink-0"
              style={{ borderColor: colors.border, color: colors.text, fontWeight: 600 }}
              value={field.type}
              onChange={e => onChange({ type: e.target.value as CustomField['type'] })}
            >
              {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Label */}
          <input
            className={inputBase}
            value={field.label}
            onChange={e => onChange({ label: e.target.value })}
            placeholder="Display label"
          />

          {/* Value — rendered based on type */}
          {field.type === 'boolean' ? (
            <label className="flex items-center gap-2 cursor-pointer">
              <div className="relative">
                <input type="checkbox" className="sr-only" checked={Boolean(field.value)} onChange={e => onChange({ value: e.target.checked })} />
                <div className={`w-8 h-4 rounded-full transition-colors ${Boolean(field.value) ? 'bg-amber-500' : 'bg-gray-200'}`} />
                <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${Boolean(field.value) ? 'translate-x-4' : ''}`} />
              </div>
              <span className="text-[10px] text-gray-600 font-semibold">{Boolean(field.value) ? 'true' : 'false'}</span>
            </label>
          ) : field.type === 'number' ? (
            <input type="number" className={inputBase} value={Number(field.value)} onChange={e => onChange({ value: Number(e.target.value) })} placeholder="0" />
          ) : field.type === 'json' ? (
            <textarea className={`${inputBase} font-mono min-h-[48px] resize-y`} value={String(field.value)} onChange={e => onChange({ value: e.target.value })} placeholder='{"key": "value"}' rows={2} spellCheck={false} />
          ) : field.type === 'textarea' ? (
            <textarea className={`${inputBase} min-h-[48px] resize-y`} value={String(field.value)} onChange={e => onChange({ value: e.target.value })} placeholder="Enter value..." rows={2} />
          ) : field.type === 'select' ? (
            <>
              <input className={inputBase} value={field.options || ''} onChange={e => onChange({ options: e.target.value })} placeholder="Option A, Option B, Option C" />
              <p className="text-[8px]" style={{ color: colors.text }}>Comma-separated options</p>
            </>
          ) : (
            <input
              className={`${inputBase} ${field.type === 'regex' ? 'font-mono' : ''}`}
              value={String(field.value)}
              onChange={e => onChange({ value: e.target.value })}
              placeholder={field.type === 'regex' ? '\\d+' : 'Enter value...'}
              spellCheck={false}
            />
          )}
        </div>
      )}
    </div>
  );
}

