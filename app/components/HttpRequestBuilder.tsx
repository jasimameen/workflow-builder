'use client';

/**
 * HttpRequestBuilder
 *
 * A visual form for configuring HTTP requests without writing JSON manually.
 * Shows URL, method, headers, query params, and body as easy key/value rows.
 * Each value field supports {{variable}} references highlighted as colored chips.
 */

import { useState, useCallback } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight, Globe } from 'lucide-react';
import { AvailableVariable } from '../lib/nodeIO';
import { varTypeColor } from '../lib/nodeIO';

// ─────────────────────────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────────────────────────

interface KVRow { id: string; key: string; value: string; enabled: boolean }

interface HttpRequest {
  method: string;
  url: string;
  headers: KVRow[];
  params: KVRow[];
  bodyType: 'none' | 'json' | 'form' | 'raw';
  bodyRows: KVRow[];   // for form/json object mode
  bodyRaw: string;     // for raw body mode
  auth: string;        // 'None' | 'Bearer Token' | 'API Key' | 'Basic Auth'
  authValue: string;
  authValue2: string;  // for Basic Auth password
  timeout: number;
}

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
const AUTH_TYPES   = ['None', 'Bearer Token', 'API Key Header', 'Basic Auth'];
const BODY_TYPES   = ['none', 'json', 'form', 'raw'] as const;
const BODY_LABELS  = { none: 'No Body', json: 'JSON Object', form: 'Form Data', raw: 'Raw Text' };

const mkRow = (): KVRow => ({ id: `r${Date.now()}-${Math.random()}`, key: '', value: '', enabled: true });

function parseValue(raw: string): HttpRequest {
  try {
    const parsed = JSON.parse(raw) as Partial<HttpRequest>;
    return {
      method:    parsed.method     ?? 'GET',
      url:       parsed.url        ?? '',
      headers:   parsed.headers    ?? [],
      params:    parsed.params     ?? [],
      bodyType:  parsed.bodyType   ?? 'none',
      bodyRows:  parsed.bodyRows   ?? [],
      bodyRaw:   parsed.bodyRaw    ?? '',
      auth:      parsed.auth       ?? 'None',
      authValue: parsed.authValue  ?? '',
      authValue2:parsed.authValue2 ?? '',
      timeout:   parsed.timeout    ?? 30,
    };
  } catch {
    return { method: 'GET', url: raw, headers: [], params: [], bodyType: 'none', bodyRows: [], bodyRaw: '', auth: 'None', authValue: '', authValue2: '', timeout: 30 };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Variable token renderer — shows {{var}} as a colored inline chip
// ─────────────────────────────────────────────────────────────────────────────

function VarTokenPreview({ text, vars }: { text: string; vars: AvailableVariable[] }) {
  if (!text.includes('{{')) return <span className="text-[10px] text-gray-500 font-mono">{text || <span className="italic text-gray-300">empty</span>}</span>;

  const parts: React.ReactNode[] = [];
  let last = 0;
  const re = /\{\{([^}]+)\}\}/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(<span key={last} className="text-[10px] text-gray-500 font-mono">{text.slice(last, m.index)}</span>);
    const varKey = m[1].split('[')[0].split('.')[0].trim();
    const varDef = vars.find(v => v.key === varKey);
    const c = varDef ? varTypeColor(varDef.type) : { bg: '#f3f4f6', text: '#6b7280', border: '#d1d5db', dot: '#9ca3af' };
    parts.push(
      <span key={m.index}
        className="inline-flex items-center gap-0.5 text-[9px] font-mono font-bold px-1 py-0.5 rounded mx-0.5"
        style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
        <span style={{ color: c.dot, fontSize: 7 }}>●</span>
        {m[1]}
      </span>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(<span key={last} className="text-[10px] text-gray-500 font-mono">{text.slice(last)}</span>);
  return <>{parts}</>;
}

// ─────────────────────────────────────────────────────────────────────────────
//  KV Row editor
// ─────────────────────────────────────────────────────────────────────────────

function KVEditor({ rows, onChange, vars, keyPlaceholder = 'key', valuePlaceholder = 'value or {{variable}}' }: {
  rows: KVRow[];
  onChange: (rows: KVRow[]) => void;
  vars: AvailableVariable[];
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}) {
  const update = (id: string, field: keyof KVRow, val: string | boolean) =>
    onChange(rows.map(r => r.id === id ? { ...r, [field]: val } : r));
  const remove = (id: string) => onChange(rows.filter(r => r.id !== id));
  const add    = () => onChange([...rows, mkRow()]);

  return (
    <div className="space-y-1.5">
      {rows.map(row => (
        <div key={row.id} className="flex items-center gap-1.5">
          {/* Enabled toggle */}
          <button
            onClick={() => update(row.id, 'enabled', !row.enabled)}
            className="w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors"
            style={{
              background: row.enabled ? '#6366f1' : '#f3f4f6',
              borderColor: row.enabled ? '#6366f1' : '#d1d5db',
            }}
            title={row.enabled ? 'Disable row' : 'Enable row'}
          >
            {row.enabled && <span className="text-white text-[8px] font-black">✓</span>}
          </button>

          {/* Key */}
          <input
            className="text-[10px] font-mono px-2 py-1 rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 transition-all w-28 flex-shrink-0"
            value={row.key}
            onChange={e => update(row.id, 'key', e.target.value)}
            placeholder={keyPlaceholder}
            style={{ opacity: row.enabled ? 1 : 0.4 }}
          />

          <span className="text-gray-300 text-[10px] flex-shrink-0">:</span>

          {/* Value */}
          <div className="flex-1 relative">
            <input
              className="w-full text-[10px] font-mono px-2 py-1 rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 transition-all"
              value={row.value}
              onChange={e => update(row.id, 'value', e.target.value)}
              placeholder={valuePlaceholder}
              style={{ opacity: row.enabled ? 1 : 0.4 }}
            />
          </div>

          {/* Remove */}
          <button onClick={() => remove(row.id)}
            className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0 p-0.5">
            <Trash2 size={10} />
          </button>
        </div>
      ))}

      {/* Preview row with highlighted vars (only for rows with variables) */}
      {rows.some(r => r.enabled && r.value.includes('{{')) && (
        <div className="p-2 rounded-lg space-y-1" style={{ background: '#f8f9ff', border: '1px solid #e0e7ff' }}>
          <p className="text-[8px] font-bold text-indigo-500 uppercase tracking-wider mb-1">Variable preview</p>
          {rows.filter(r => r.enabled && r.value.includes('{{')).map(r => (
            <div key={r.id} className="flex items-start gap-1.5 flex-wrap">
              <span className="text-[9px] font-mono text-gray-400 font-bold">{r.key}:</span>
              <VarTokenPreview text={r.value} vars={vars} />
            </div>
          ))}
        </div>
      )}

      <button onClick={add}
        className="flex items-center gap-1 text-[10px] text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 px-2 py-1 rounded-lg transition-colors font-semibold mt-1">
        <Plus size={10} /> Add row
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main component
// ─────────────────────────────────────────────────────────────────────────────

interface HttpRequestBuilderProps {
  value: string;  // JSON-serialized HttpRequest
  onChange: (json: string) => void;
  upstreamVars: AvailableVariable[];
}

export default function HttpRequestBuilder({ value, onChange, upstreamVars }: HttpRequestBuilderProps) {
  const req = parseValue(value);
  const [openSection, setOpenSection] = useState<string | null>(null);

  const update = useCallback((patch: Partial<HttpRequest>) => {
    onChange(JSON.stringify({ ...req, ...patch }));
  }, [req, onChange]);

  const toggleSection = (s: string) => setOpenSection(prev => prev === s ? null : s);

  const methodColor = {
    GET: { bg: '#d1fae5', text: '#065f46' },
    POST: { bg: '#dbeafe', text: '#1e3a8a' },
    PUT: { bg: '#fef3c7', text: '#92400e' },
    PATCH: { bg: '#ede9fe', text: '#4c1d95' },
    DELETE: { bg: '#fee2e2', text: '#991b1b' },
    HEAD: { bg: '#f3f4f6', text: '#374151' },
    OPTIONS: { bg: '#f3f4f6', text: '#374151' },
  }[req.method] ?? { bg: '#f3f4f6', text: '#374151' };

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1.5px solid #c7d2fe', background: '#fafbff' }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2" style={{ background: '#eef2ff', borderBottom: '1px solid #c7d2fe' }}>
        <Globe size={12} className="text-indigo-500" />
        <span className="text-[10px] font-black text-indigo-700 uppercase tracking-wider">HTTP Request Builder</span>
        {req.url && (
          <span className="ml-auto text-[9px] text-indigo-400 font-mono truncate max-w-[140px]">{req.url}</span>
        )}
      </div>

      <div className="px-3 py-2.5 space-y-3">
        {/* ── Method + URL row ── */}
        <div className="flex items-center gap-2">
          <select
            value={req.method}
            onChange={e => update({ method: e.target.value })}
            className="text-[11px] font-black px-2 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:border-indigo-400 cursor-pointer"
            style={{ background: methodColor.bg, color: methodColor.text, minWidth: 72 }}
          >
            {HTTP_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <div className="flex-1 relative">
            <input
              className="w-full text-[11px] font-mono px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
              value={req.url}
              onChange={e => update({ url: e.target.value })}
              placeholder="https://api.example.com/endpoint"
            />
          </div>
        </div>

        {/* URL variable preview */}
        {req.url.includes('{{') && (
          <div className="px-2 py-1.5 rounded-lg flex items-center gap-1.5 flex-wrap"
            style={{ background: '#f0f4ff', border: '1px solid #c7d2fe' }}>
            <span className="text-[8px] font-bold text-indigo-500">URL:</span>
            <VarTokenPreview text={req.url} vars={upstreamVars} />
          </div>
        )}

        {/* ── Collapsible sections ── */}
        {[
          { key: 'params',  label: 'Query Params', count: req.params.filter(r => r.enabled && r.key).length  },
          { key: 'headers', label: 'Headers',      count: req.headers.filter(r => r.enabled && r.key).length },
          { key: 'body',    label: 'Body',          count: req.bodyType !== 'none' ? 1 : 0                    },
          { key: 'auth',    label: 'Auth',          count: req.auth !== 'None' ? 1 : 0                        },
        ].map(sec => (
          <div key={sec.key} className="rounded-xl overflow-hidden" style={{ border: '1px solid #e8eaf0' }}>
            <button
              onClick={() => toggleSection(sec.key)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-gray-50"
              style={{ background: openSection === sec.key ? '#f8f9ff' : 'white' }}
            >
              {openSection === sec.key
                ? <ChevronDown size={10} className="text-indigo-400" />
                : <ChevronRight size={10} className="text-gray-400" />}
              <span className="text-[10px] font-bold text-gray-700">{sec.label}</span>
              {sec.count > 0 && (
                <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold"
                  style={{ background: '#eef2ff', color: '#4f46e5' }}>
                  {sec.count}
                </span>
              )}
            </button>

            {openSection === sec.key && (
              <div className="px-3 pb-3 pt-1 border-t border-gray-100">
                {sec.key === 'params' && (
                  <KVEditor rows={req.params} vars={upstreamVars}
                    onChange={r => update({ params: r })}
                    keyPlaceholder="param" valuePlaceholder="value or {{variable}}"
                  />
                )}

                {sec.key === 'headers' && (
                  <>
                    {/* Common header presets */}
                    <div className="flex flex-wrap gap-1 mb-2">
                      {[
                        { k: 'Content-Type', v: 'application/json' },
                        { k: 'Accept',       v: 'application/json' },
                        { k: 'X-API-Key',    v: '{{api_key}}'      },
                      ].map(preset => (
                        <button key={preset.k}
                          onClick={() => {
                            const exists = req.headers.find(r => r.key === preset.k);
                            if (!exists) update({ headers: [...req.headers, { ...mkRow(), key: preset.k, value: preset.v }] });
                          }}
                          className="text-[8px] px-1.5 py-0.5 rounded font-semibold transition-colors hover:bg-indigo-50"
                          style={{ background: '#f1f3f8', color: '#64748b', border: '1px solid #e2e5ef' }}>
                          + {preset.k}
                        </button>
                      ))}
                    </div>
                    <KVEditor rows={req.headers} vars={upstreamVars}
                      onChange={r => update({ headers: r })}
                      keyPlaceholder="Header-Name" valuePlaceholder="value"
                    />
                  </>
                )}

                {sec.key === 'body' && (
                  <div className="space-y-2.5">
                    {/* Body type picker */}
                    <div className="flex gap-1">
                      {BODY_TYPES.map(bt => (
                        <button key={bt}
                          onClick={() => update({ bodyType: bt })}
                          className="text-[9px] px-2 py-1 rounded-lg font-bold transition-all"
                          style={req.bodyType === bt
                            ? { background: '#6366f1', color: 'white' }
                            : { background: '#f1f3f8', color: '#94a3b8', border: '1px solid #e2e5ef' }}>
                          {BODY_LABELS[bt]}
                        </button>
                      ))}
                    </div>

                    {req.bodyType === 'json' && (
                      <KVEditor rows={req.bodyRows} vars={upstreamVars}
                        onChange={r => update({ bodyRows: r })}
                        keyPlaceholder="field" valuePlaceholder="value or {{variable}}"
                      />
                    )}
                    {req.bodyType === 'form' && (
                      <KVEditor rows={req.bodyRows} vars={upstreamVars}
                        onChange={r => update({ bodyRows: r })}
                        keyPlaceholder="field" valuePlaceholder="value"
                      />
                    )}
                    {req.bodyType === 'raw' && (
                      <textarea
                        className="w-full text-[10px] font-mono px-2.5 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:border-indigo-400 resize-y"
                        rows={4}
                        value={req.bodyRaw}
                        onChange={e => update({ bodyRaw: e.target.value })}
                        placeholder='{"key": "{{variable}}"}'
                        spellCheck={false}
                      />
                    )}
                  </div>
                )}

                {sec.key === 'auth' && (
                  <div className="space-y-2">
                    <div className="flex gap-1 flex-wrap">
                      {AUTH_TYPES.map(a => (
                        <button key={a}
                          onClick={() => update({ auth: a })}
                          className="text-[9px] px-2 py-1 rounded-lg font-bold transition-all"
                          style={req.auth === a
                            ? { background: '#6366f1', color: 'white' }
                            : { background: '#f1f3f8', color: '#94a3b8', border: '1px solid #e2e5ef' }}>
                          {a}
                        </button>
                      ))}
                    </div>

                    {req.auth === 'Bearer Token' && (
                      <input
                        className="w-full text-[10px] font-mono px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white focus:outline-none focus:border-indigo-400"
                        value={req.authValue}
                        onChange={e => update({ authValue: e.target.value })}
                        placeholder="Bearer token or {{token_var}}"
                      />
                    )}
                    {req.auth === 'API Key Header' && (
                      <>
                        <input
                          className="w-full text-[10px] font-mono px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white focus:outline-none focus:border-indigo-400"
                          value={req.authValue}
                          onChange={e => update({ authValue: e.target.value })}
                          placeholder="API key or {{api_key}}"
                        />
                        <p className="text-[9px] text-gray-400">Sent as X-API-Key header</p>
                      </>
                    )}
                    {req.auth === 'Basic Auth' && (
                      <div className="flex gap-2">
                        <input
                          className="flex-1 text-[10px] font-mono px-2 py-1.5 rounded-lg border border-gray-200 bg-white focus:outline-none focus:border-indigo-400"
                          value={req.authValue}
                          onChange={e => update({ authValue: e.target.value })}
                          placeholder="Username"
                        />
                        <input
                          type="password"
                          className="flex-1 text-[10px] font-mono px-2 py-1.5 rounded-lg border border-gray-200 bg-white focus:outline-none focus:border-indigo-400"
                          value={req.authValue2}
                          onChange={e => update({ authValue2: e.target.value })}
                          placeholder="Password"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Timeout */}
        <div className="flex items-center gap-2">
          <label className="text-[9px] font-semibold text-gray-500 w-14 flex-shrink-0">Timeout</label>
          <input
            type="number" min={1} max={300}
            className="text-[10px] px-2 py-1 rounded-lg border border-gray-200 bg-white focus:outline-none focus:border-indigo-400 w-16"
            value={req.timeout}
            onChange={e => update({ timeout: Number(e.target.value) })}
          />
          <span className="text-[9px] text-gray-400">seconds</span>
        </div>
      </div>
    </div>
  );
}
