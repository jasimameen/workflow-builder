'use client';

/**
 * TemplatesGallery — The first screen a non-technical user sees.
 *
 * Pre-built workflow recipes shown as visual cards. One click loads the
 * full workflow onto the canvas — no knowledge of nodes or edges needed.
 */

import { Node, Edge, MarkerType } from '@xyflow/react';
import { NODE_LIBRARY, WorkflowNodeData } from '../lib/types';

type WFNode = Node<WorkflowNodeData>;

// ─────────────────────────────────────────────────────────────────────────────
//  Helper: build a demo node
// ─────────────────────────────────────────────────────────────────────────────
const n = (
  id: string,
  nodeId: string,
  pos: { x: number; y: number },
  label: string,
  desc: string,
  fields?: Record<string, string | number | boolean>,
): WFNode => ({
  id,
  type: 'workflowNode',
  position: pos,
  data: {
    nodeConfig: NODE_LIBRARY.find(n => n.id === nodeId)!,
    label,
    description: desc,
    fields: {
      ...Object.fromEntries(
        (NODE_LIBRARY.find(n => n.id === nodeId)?.fields ?? []).map(f => [f.key, f.defaultValue ?? ''])
      ),
      ...(fields ?? {}),
    },
    customFields: [],
  },
});

const e = (id: string, source: string, target: string, label?: string, color?: string, sourceHandle?: string): Edge => ({
  id, source, target,
  ...(sourceHandle ? { sourceHandle } : {}),
  markerEnd: { type: MarkerType.ArrowClosed, color: color || '#94a3b8' },
  style: { stroke: color || '#94a3b8', strokeWidth: 2 },
  ...(label ? { label, labelStyle: { fill: color || '#94a3b8', fontSize: 10, fontWeight: 700 }, labelBgStyle: { fill: 'white' } } : {}),
});

// ─────────────────────────────────────────────────────────────────────────────
//  Template definitions
// ─────────────────────────────────────────────────────────────────────────────
export interface WorkflowTemplate {
  id: string;
  emoji: string;
  name: string;
  description: string;
  tags: string[];
  color: string;
  bgColor: string;
  nodes: WFNode[];
  edges: Edge[];
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [

  // ── 1. Invoice Processor ────────────────────────────────────────────────
  {
    id: 'invoice-processor',
    emoji: '🧾',
    name: 'Invoice Processor',
    description: 'Receive invoice emails → AI extracts details → Save to Excel → Notify team on Slack',
    tags: ['Email', 'AI', 'Excel', 'Slack'],
    color: '#92400e',
    bgColor: '#fef3c7',
    nodes: [
      n('t1', 'trigger-email',   { x: 340, y: 40  }, 'Email Received',       'Watch inbox for invoices',           { host: 'imap.gmail.com', folder: 'INBOX', filter: 'Invoice', markRead: true }),
      n('t2', 'ai-email-agent',  { x: 340, y: 200 }, 'Extract Invoice Data', 'Read {{email_body}} and extract details', { provider: 'Anthropic (Claude)', model: 'claude-sonnet-4-6', outputVar: 'invoice_data', agentInstructions: 'Extract from {{email_body}} sent by {{email_sender}}: invoice_no, vendor, amount, due_date. Return as JSON.', tools: 'extract only', autoreply: false }),
      n('t3', 'data-read-excel', { x: 340, y: 370 }, 'Load Tracker',         'Open the invoice tracker file',      { path: 'invoices.xlsx', sheet: 'Tracker', header: 0 }),
      n('t4', 'flow-if-else',    { x: 340, y: 530 }, 'High-Value Check',     'Is invoice > 10,000?',               { variable: 'invoice_data["amount"]', operator: '>', value: '10000' }),
      n('t5', 'send-email',      { x: 80,  y: 710 }, 'Alert CFO',            'High-value invoice needs approval',  { to: 'cfo@company.com', subject: '⚠️ Invoice from {{invoice_data["vendor"]}} — SAR {{invoice_data["amount"]}}', body: 'Invoice #{{invoice_data["invoice_no"]}} from {{invoice_data["vendor"]}} for SAR {{invoice_data["amount"]}} needs approval.\n\nDue: {{invoice_data["due_date"]}}' }),
      n('t6', 'data-write-excel',{ x: 600, y: 710 }, 'Update Excel',         'Add invoice row to tracker',         { path: 'invoices.xlsx', sheet: 'Tracker', mode: 'append', autofit: true }),
      n('t7', 'send-slack',      { x: 340, y: 880 }, 'Notify Finance',       'Post summary to #finance channel',   { channel: '#finance', message: '✅ Invoice processed!\n• Vendor: {{invoice_data["vendor"]}}\n• Amount: SAR {{invoice_data["amount"]}}\n• Invoice #: {{invoice_data["invoice_no"]}}\n• Due: {{invoice_data["due_date"]}}', username: 'Invoice Bot' }),
      n('t8', 'end-success',     { x: 340, y: 1040}, 'Done',                 'All complete',                       { message: 'Invoice processed.' }),
    ],
    edges: [
      e('e1','t1','t2'), e('e2','t2','t3'), e('e3','t3','t4'),
      e('e4','t4','t5', 'YES (>10k)', '#10b981', 'true'),
      e('e5','t4','t6', 'NO (auto)',  '#ef4444', 'false'),
      e('e6','t5','t7'), e('e7','t6','t7'), e('e8','t7','t8'),
    ],
  },

  // ── 2. Daily Summary Email ──────────────────────────────────────────────
  {
    id: 'daily-summary',
    emoji: '📅',
    name: 'Daily Summary Email',
    description: 'Every morning, read your Excel data → AI summarises → Email yourself the highlights',
    tags: ['Schedule', 'Excel', 'AI', 'Email'],
    color: '#1e3a8a',
    bgColor: '#dbeafe',
    nodes: [
      n('d1', 'trigger-schedule',  { x: 340, y: 40  }, 'Every Morning',    'Run daily at 8 AM',                  { mode: 'Simple', interval: 'Daily', cron: '0 8 * * *', timezone: 'Asia/Riyadh' }),
      n('d2', 'data-read-excel',   { x: 340, y: 200 }, 'Open Sales Data',  'Read the sales tracker',              { path: 'sales.xlsx', sheet: 'Sheet1', header: 0 }),
      n('d3', 'ai-summarize',      { x: 340, y: 360 }, 'Summarise with AI','Generate bullet-point summary of df', { inputVar: 'df', style: 'bullet points', maxWords: 200, provider: 'Anthropic (Claude)', outputVar: 'summary' }),
      n('d4', 'send-email',        { x: 340, y: 520 }, 'Send to My Inbox', 'Daily report email',                  { to: 'me@company.com', subject: '📊 Daily Report — {{trigger_time}}', body: 'Good morning!\n\nHere is your daily summary:\n\n{{summary}}\n\nHave a great day!' }),
      n('d5', 'end-success',       { x: 340, y: 680 }, 'Done',             'Report sent',                         { message: 'Daily report sent.' }),
    ],
    edges: [e('e1','d1','d2'), e('e2','d2','d3'), e('e3','d3','d4'), e('e4','d4','d5')],
  },

  // ── 3. Customer Lookup ──────────────────────────────────────────────────
  {
    id: 'customer-lookup',
    emoji: '🔍',
    name: 'Customer Auto-Lookup',
    description: 'Webhook receives a customer ID → VLOOKUP in Excel → Send personalised WhatsApp',
    tags: ['Webhook', 'VLOOKUP', 'Excel', 'WhatsApp'],
    color: '#059669',
    bgColor: '#d1fae5',
    nodes: [
      n('c1', 'trigger-webhook',   { x: 340, y: 40  }, 'Request Received',  'API call with customer_id',           { path: '/webhook/customer', method: 'POST' }),
      n('c2', 'data-vlookup',      { x: 340, y: 200 }, 'Find Customer',     'Look up {{webhook_payload}} in CRM', { lookupValue: '{{webhook_payload["customer_id"]}}', lookupFile: 'customers.xlsx', lookupSheet: 'Customers', searchColumn: 'A', returnColumn: 'B', matchType: 'Exact (FALSE)', outputVar: 'customer_name' }),
      n('c3', 'data-vlookup',      { x: 340, y: 360 }, 'Get Phone Number',  'Get phone from same CRM file',        { lookupValue: '{{webhook_payload["customer_id"]}}', lookupFile: 'customers.xlsx', lookupSheet: 'Customers', searchColumn: 'A', returnColumn: 'C', matchType: 'Exact (FALSE)', outputVar: 'customer_phone' }),
      n('c4', 'send-whatsapp',     { x: 340, y: 520 }, 'WhatsApp Customer', 'Send personalised message',           { to: '{{customer_phone}}', message: 'Hello {{customer_name}}! Thank you for your enquiry. Our team will contact you within 2 hours. 🙏' }),
      n('c5', 'end-success',       { x: 340, y: 680 }, 'Done',              'Customer notified',                   { message: 'Lookup complete.' }),
    ],
    edges: [e('e1','c1','c2'), e('e2','c2','c3'), e('e3','c3','c4'), e('e4','c4','c5')],
  },

  // ── 4. File-to-Excel ────────────────────────────────────────────────────
  {
    id: 'file-to-excel',
    emoji: '📁',
    name: 'File Drop → Excel',
    description: 'When a CSV file appears in a folder → clean the data → save as Excel automatically',
    tags: ['File Watch', 'CSV', 'Excel', 'Transform'],
    color: '#7c3aed',
    bgColor: '#ede9fe',
    nodes: [
      n('f1', 'trigger-file',       { x: 340, y: 40  }, 'Watch for CSV',    'New file in the data folder',         { folder: './incoming', extension: '.csv', recursive: false }),
      n('f2', 'data-read-csv',      { x: 340, y: 200 }, 'Read the CSV',     'Load {{file_path}} into a table',     { path: '{{file_path}}', delimiter: ',', encoding: 'utf-8', skipBad: true }),
      n('f3', 'data-filter',        { x: 340, y: 360 }, 'Remove Blanks',    'Drop rows where Name is empty',       { column: 'Name', operator: 'is not null', value: '', caseSensitive: false }),
      n('f4', 'data-deduplicate',   { x: 340, y: 520 }, 'Remove Duplicates','Clean up any duplicate rows',         { subset: '', keep: 'first' }),
      n('f5', 'data-write-excel',   { x: 340, y: 680 }, 'Save to Excel',    'Export cleaned data to Excel',        { path: 'output_{{file_name}}.xlsx', sheet: 'Clean Data', mode: 'overwrite', autofit: true }),
      n('f6', 'send-slack',         { x: 340, y: 840 }, 'Notify Team',      'Tell the team the file is ready',     { channel: '#data', message: '📁 New file processed!\n• File: {{file_name}}\n• Rows: {{df_rows}}\n• Saved to: {{output_path}}', username: 'Data Bot' }),
      n('f7', 'end-success',        { x: 340, y: 1000}, 'Done',             '',                                    {}),
    ],
    edges: [e('e1','f1','f2'), e('e2','f2','f3'), e('e3','f3','f4'), e('e4','f4','f5'), e('e5','f5','f6'), e('e6','f6','f7')],
  },

  // ── 5. Simple HTTP + Excel ──────────────────────────────────────────────
  {
    id: 'api-to-excel',
    emoji: '🌐',
    name: 'Fetch API → Save to Excel',
    description: 'Pull data from any website or API on a schedule → save rows to an Excel sheet',
    tags: ['Schedule', 'API', 'Excel'],
    color: '#0891b2',
    bgColor: '#cffafe',
    nodes: [
      n('a1', 'trigger-schedule',  { x: 340, y: 40  }, 'Run Every Hour',   'Fetch fresh data hourly',             { mode: 'Simple', interval: 'Every hour', timezone: 'UTC' }),
      n('a2', 'external-http',     { x: 340, y: 200 }, 'Fetch Data',       'GET request to your API',             { method: 'GET', url: 'https://api.example.com/data', auth: 'Bearer Token', timeout: 30, retries: 2 }),
      n('a3', 'transform-json',    { x: 340, y: 360 }, 'Extract Records',  'Pull the data array from response',   { operation: 'get path (JSONPath)', source: 'response', path: '$.data', outputVar: 'records' }),
      n('a4', 'data-write-excel',  { x: 340, y: 520 }, 'Append to Excel',  'Add new rows to the tracker',         { path: 'api_data.xlsx', sheet: 'Records', mode: 'append', autofit: true }),
      n('a5', 'end-success',       { x: 340, y: 680 }, 'Done',             'Data saved',                          {}),
    ],
    edges: [e('e1','a1','a2'), e('e2','a2','a3'), e('e3','a3','a4'), e('e4','a4','a5')],
  },

  // ── 6. Blank ────────────────────────────────────────────────────────────
  {
    id: 'blank',
    emoji: '✏️',
    name: 'Start from Scratch',
    description: 'Build your own custom workflow from the ground up — drag any step from the left panel',
    tags: ['Custom'],
    color: '#374151',
    bgColor: '#f3f4f6',
    nodes: [],
    edges: [],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
//  Gallery component
// ─────────────────────────────────────────────────────────────────────────────
interface TemplatesGalleryProps {
  onSelectTemplate: (t: WorkflowTemplate) => void;
  isModal?: boolean;
}

export default function TemplatesGallery({ onSelectTemplate, isModal }: TemplatesGalleryProps) {
  return (
    <div className={`flex flex-col ${isModal ? '' : 'h-full overflow-auto'}`}>
      {/* Header */}
      <div className="text-center pt-8 pb-6 px-6">
        <div className="text-4xl mb-3">⚡</div>
        <h2 className="text-[22px] font-black text-gray-800 mb-1">What do you want to automate?</h2>
        <p className="text-[13px] text-gray-500">Pick a ready-made template or start from scratch. You can change anything later.</p>
      </div>

      {/* Template grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 px-6 pb-8">
        {WORKFLOW_TEMPLATES.map((t) => (
          <button
            key={t.id}
            onClick={() => onSelectTemplate(t)}
            className="text-left rounded-2xl border-2 border-transparent hover:border-opacity-60 transition-all duration-150 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] overflow-hidden group"
            style={{
              background: t.bgColor,
              borderColor: `${t.color}30`,
            }}
          >
            {/* Top accent */}
            <div className="h-1" style={{ background: t.color }} />

            <div className="p-4">
              <div className="text-3xl mb-2">{t.emoji}</div>
              <div className="font-bold text-[14px] text-gray-800 mb-1 group-hover:text-gray-900">{t.name}</div>
              <p className="text-[11px] text-gray-500 leading-relaxed mb-3">{t.description}</p>
              <div className="flex flex-wrap gap-1">
                {t.tags.map(tag => (
                  <span
                    key={tag}
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: `${t.color}15`, color: t.color }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Footer CTA */}
            <div
              className="px-4 py-2 flex items-center justify-between"
              style={{ background: `${t.color}10` }}
            >
              <span className="text-[10px] font-bold" style={{ color: t.color }}>
                {t.id === 'blank' ? 'Start building →' : `${t.nodes.length} steps ready →`}
              </span>
              <span className="text-[16px] opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: t.color }}>→</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
