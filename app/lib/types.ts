export type NodeCategory =
  | 'trigger'
  | 'flow'
  | 'data'
  | 'transform'
  | 'send'
  | 'external'
  | 'ai'
  | 'code'
  | 'end';

export interface NodeConfig {
  id: string;
  type: NodeCategory;
  label: string;
  description: string;
  iconName: string;
  color: string;
  bgColor: string;
  borderColor: string;
  fields?: FieldConfig[];
  /** Switch/Case: indicates this node has dynamic branch outputs */
  isSwitchNode?: boolean;
  /** Loop: indicates special loop-back rendering */
  isLoopNode?: boolean;
  /** Has a special "error" output handle */
  hasTryCatch?: boolean;
}

export interface FieldConfig {
  key: string;
  label: string;
  type: 'text' | 'select' | 'number' | 'textarea' | 'boolean' | 'code' | 'json' | 'regex';
  placeholder?: string;
  options?: string[];
  defaultValue?: string | number | boolean;
  hint?: string;
}

export interface CustomField {
  id: string;
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'json' | 'regex' | 'textarea' | 'select';
  value: string | number | boolean;
  options?: string;
}

export interface WorkflowNodeData extends Record<string, unknown> {
  nodeConfig: NodeConfig;
  label: string;
  description?: string;
  fields?: Record<string, string | number | boolean>;
  /** Dynamic cases for Switch/Case node — comma-separated */
  switchCases?: string;
  /** User-defined custom fields added at node level */
  customFields?: CustomField[];
  /** Test value overrides for each field key */
  testValues?: Record<string, string | number | boolean>;
  /** Current test execution result */
  testState?: NodeTestState;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Testing system
// ─────────────────────────────────────────────────────────────────────────────
export type TestStatus = 'idle' | 'running' | 'success' | 'error';

export interface NodeTestState {
  status: TestStatus;
  duration?: number;
  inputData?: Record<string, unknown>;
  outputData?: unknown;
  error?: string;
  logs?: string[];
  testedAt?: number;
  httpStatus?: number;
  httpStatusText?: string;
}

export interface SavedVariable {
  id: string;
  key: string;
  label: string;
  type: string;
  value: unknown;
  nodeId: string;
  nodeName: string;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Custom field type colour palette (used everywhere for consistency)
// ─────────────────────────────────────────────────────────────────────────────
export const FIELD_TYPE_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  text:     { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe', dot: '#3b82f6' },
  number:   { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0', dot: '#22c55e' },
  boolean:  { bg: '#fffbeb', text: '#b45309', border: '#fde68a', dot: '#f59e0b' },
  json:     { bg: '#faf5ff', text: '#7e22ce', border: '#e9d5ff', dot: '#8b5cf6' },
  regex:    { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca', dot: '#ef4444' },
  textarea: { bg: '#eef2ff', text: '#4338ca', border: '#c7d2fe', dot: '#6366f1' },
  select:   { bg: '#f0fdfa', text: '#0f766e', border: '#99f6e4', dot: '#14b8a6' },
};

export const NODE_CATEGORIES: Record<NodeCategory, { label: string; color: string; description: string; iconName: string }> = {
  trigger:   { label: 'Triggers',       color: '#d97706', description: 'Start your workflow',         iconName: 'Clock'      },
  flow:      { label: 'Flow Control',   color: '#e05c2e', description: 'Branch, loop, conditions',    iconName: 'GitBranch'  },
  data:      { label: 'Data & Files',   color: '#059669', description: 'Read, write, transform data', iconName: 'Database'   },
  transform: { label: 'Transform',      color: '#7c3aed', description: 'Strings, JSON, math, regex',  iconName: 'Braces'     },
  send:      { label: 'Send & Notify',  color: '#2563eb', description: 'Email, WhatsApp, Slack',       iconName: 'Send'       },
  external:  { label: 'External & API', color: '#0891b2', description: 'HTTP, GraphQL, databases',    iconName: 'Globe'      },
  ai:        { label: 'AI & Agents',    color: '#db2777', description: 'AI completions & agents',     iconName: 'Sparkles'   },
  code:      { label: 'Code & Custom',  color: '#374151', description: 'Run custom code, variables',  iconName: 'Code2'      },
  end:       { label: 'End',            color: '#6b7280', description: 'Terminate workflow',          iconName: 'Flag'       },
};

// ─────────────────────────────────────────────────────────────────────────────
//  Colour palettes by category
// ─────────────────────────────────────────────────────────────────────────────
const T = { color: '#92400e', bgColor: '#fef3c7', borderColor: '#f59e0b' };  // trigger
const F = { color: '#7c2d12', bgColor: '#fff1ee', borderColor: '#e05c2e' };  // flow
const D = { color: '#065f46', bgColor: '#d1fae5', borderColor: '#10b981' };  // data
const X = { color: '#4c1d95', bgColor: '#ede9fe', borderColor: '#8b5cf6' };  // transform
const S = { color: '#1e3a8a', bgColor: '#dbeafe', borderColor: '#3b82f6' };  // send
const E = { color: '#164e63', bgColor: '#cffafe', borderColor: '#06b6d4' };  // external
const A = { color: '#831843', bgColor: '#fce7f3', borderColor: '#ec4899' };  // ai
const C = { color: '#1f2937', bgColor: '#f3f4f6', borderColor: '#6b7280' };  // code
const Z = { color: '#374151', bgColor: '#f9fafb', borderColor: '#9ca3af' };  // end

export const NODE_LIBRARY: NodeConfig[] = [
  // ── TRIGGERS ──────────────────────────────────────────────────────────────
  {
    id: 'trigger-schedule', type: 'trigger', label: 'Schedule / Cron',
    description: 'Run on a time schedule or cron expression',
    iconName: 'Clock', ...T,
    fields: [
      { key: 'mode', label: 'Mode', type: 'select', options: ['Simple', 'Cron expression'], defaultValue: 'Simple' },
      { key: 'interval', label: 'Interval', type: 'select', options: ['Every minute', 'Every 5 minutes', 'Every hour', 'Daily', 'Weekly', 'Monthly'], defaultValue: 'Daily' },
      { key: 'cron', label: 'Cron Expression', type: 'text', placeholder: '0 9 * * *', defaultValue: '0 9 * * *', hint: 'minute hour day month weekday' },
      { key: 'timezone', label: 'Timezone', type: 'text', placeholder: 'Asia/Riyadh', defaultValue: 'UTC' },
    ],
  },
  {
    id: 'trigger-manual', type: 'trigger', label: 'Manual Trigger',
    description: 'Run manually or via a button click',
    iconName: 'Play', ...T,
    fields: [
      { key: 'label', label: 'Button Label', type: 'text', defaultValue: 'Run Workflow' },
    ],
  },
  {
    id: 'trigger-webhook', type: 'trigger', label: 'Webhook',
    description: 'Triggered by an incoming HTTP request',
    iconName: 'Webhook', ...T,
    fields: [
      { key: 'path', label: 'Endpoint Path', type: 'text', placeholder: '/webhook/my-trigger', defaultValue: '/webhook/my-trigger' },
      { key: 'method', label: 'HTTP Method', type: 'select', options: ['POST', 'GET', 'PUT', 'PATCH'], defaultValue: 'POST' },
      { key: 'secret', label: 'Secret Key', type: 'text', placeholder: 'optional_secret', defaultValue: '' },
    ],
  },
  {
    id: 'trigger-email', type: 'trigger', label: 'Email Received',
    description: 'Trigger when a new email arrives',
    iconName: 'MailOpen', ...T,
    fields: [
      { key: 'host', label: 'IMAP Host', type: 'text', placeholder: 'imap.gmail.com', defaultValue: 'imap.gmail.com' },
      { key: 'username', label: 'Username', type: 'text', placeholder: 'you@gmail.com', defaultValue: '' },
      { key: 'folder', label: 'Folder', type: 'text', defaultValue: 'INBOX' },
      { key: 'filter', label: 'Subject Filter', type: 'text', placeholder: 'Invoice', defaultValue: '' },
      { key: 'markRead', label: 'Mark as Read', type: 'boolean', defaultValue: true },
    ],
  },
  {
    id: 'trigger-file', type: 'trigger', label: 'File / Folder Watch',
    description: 'Trigger when a file is created or changed',
    iconName: 'Eye', ...T,
    fields: [
      { key: 'folder', label: 'Watch Folder', type: 'text', defaultValue: './data' },
      { key: 'extension', label: 'File Type', type: 'select', options: ['.xlsx', '.csv', '.json', '.txt', '.pdf', 'Any'], defaultValue: '.xlsx' },
      { key: 'recursive', label: 'Watch Subdirectories', type: 'boolean', defaultValue: false },
    ],
  },
  {
    id: 'trigger-rss', type: 'trigger', label: 'RSS / News Feed',
    description: 'Poll an RSS feed for new items',
    iconName: 'Rss', ...T,
    fields: [
      { key: 'url', label: 'Feed URL', type: 'text', placeholder: 'https://feeds.example.com/rss', defaultValue: '' },
      { key: 'interval', label: 'Check Every', type: 'select', options: ['5 minutes', '15 minutes', '1 hour', '6 hours'], defaultValue: '1 hour' },
    ],
  },

  // ── FLOW CONTROL ──────────────────────────────────────────────────────────
  {
    id: 'flow-if-else', type: 'flow', label: 'If / Else',
    description: 'Branch: one path for true, one for false',
    iconName: 'GitBranch', ...F,
    fields: [
      { key: 'variable', label: 'Left Side', type: 'text', placeholder: 'data["Status"]', defaultValue: 'data["Status"]' },
      { key: 'operator', label: 'Operator', type: 'select', options: ['==', '!=', '>', '<', '>=', '<=', 'in', 'not in', 'contains', 'starts with', 'ends with', 'is empty', 'is not empty'], defaultValue: '==' },
      { key: 'value', label: 'Right Side', type: 'text', placeholder: '"Active"', defaultValue: '"Active"' },
    ],
  },
  {
    id: 'flow-switch', type: 'flow', label: 'Switch / Case',
    description: 'Branch into multiple named paths',
    iconName: 'Shuffle', ...F,
    isSwitchNode: true,
    fields: [
      { key: 'variable', label: 'Variable to Check', type: 'text', placeholder: 'data["category"]', defaultValue: 'data["category"]' },
      { key: 'cases', label: 'Cases (comma-separated)', type: 'text', placeholder: 'Invoice, Receipt, Other', defaultValue: 'Case A, Case B, Default', hint: 'Each case becomes a separate output path' },
    ],
  },
  {
    id: 'flow-foreach', type: 'flow', label: 'For Each Item',
    description: 'Loop over each row or list item',
    iconName: 'IterationCcw', ...F,
    isLoopNode: true,
    fields: [
      { key: 'source', label: 'Data Source', type: 'text', placeholder: 'df', defaultValue: 'df', hint: 'DataFrame or list to iterate' },
      { key: 'itemVar', label: 'Item Variable Name', type: 'text', defaultValue: 'row' },
      { key: 'indexVar', label: 'Index Variable Name', type: 'text', defaultValue: 'idx' },
      { key: 'batchSize', label: 'Batch Size (0 = no batch)', type: 'number', defaultValue: 0 },
    ],
  },
  {
    id: 'flow-while', type: 'flow', label: 'While Loop',
    description: 'Repeat while a condition is true',
    iconName: 'RefreshCw', ...F,
    isLoopNode: true,
    fields: [
      { key: 'condition', label: 'Condition', type: 'text', placeholder: 'retries < 5 and not success', defaultValue: 'retries < 5 and not success' },
      { key: 'maxIter', label: 'Max Iterations (safety)', type: 'number', defaultValue: 100 },
      { key: 'sleepSec', label: 'Sleep Between (seconds)', type: 'number', defaultValue: 0 },
    ],
  },
  {
    id: 'flow-repeat', type: 'flow', label: 'Repeat N Times',
    description: 'Execute a block a fixed number of times',
    iconName: 'Repeat', ...F,
    isLoopNode: true,
    fields: [
      { key: 'count', label: 'Repeat Count', type: 'number', defaultValue: 10 },
      { key: 'indexVar', label: 'Index Variable', type: 'text', defaultValue: 'i' },
      { key: 'sleepSec', label: 'Delay Between Runs (sec)', type: 'number', defaultValue: 0 },
    ],
  },
  {
    id: 'flow-trycatch', type: 'flow', label: 'Try / Catch',
    description: 'Handle errors gracefully',
    iconName: 'Shield', ...F,
    hasTryCatch: true,
    fields: [
      { key: 'retries', label: 'Max Retries', type: 'number', defaultValue: 3 },
      { key: 'retryDelay', label: 'Retry Delay (sec)', type: 'number', defaultValue: 2 },
      { key: 'catchAll', label: 'Catch All Exceptions', type: 'boolean', defaultValue: true },
    ],
  },
  {
    id: 'flow-delay', type: 'flow', label: 'Delay / Wait',
    description: 'Pause execution for a set time',
    iconName: 'AlarmClock', ...F,
    fields: [
      { key: 'amount', label: 'Amount', type: 'number', defaultValue: 5 },
      { key: 'unit', label: 'Unit', type: 'select', options: ['seconds', 'minutes', 'hours'], defaultValue: 'seconds' },
    ],
  },

  // ── DATA & FILES ──────────────────────────────────────────────────────────
  {
    id: 'data-read-excel', type: 'data', label: 'Read Excel',
    description: 'Load data from an .xlsx file',
    iconName: 'Table', ...D,
    fields: [
      { key: 'path', label: 'File Path', type: 'text', defaultValue: 'input.xlsx' },
      { key: 'sheet', label: 'Sheet Name / Index', type: 'text', defaultValue: 'Sheet1' },
      { key: 'header', label: 'Header Row', type: 'number', defaultValue: 0, hint: '0 = first row' },
      { key: 'skipRows', label: 'Skip Rows', type: 'number', defaultValue: 0 },
      { key: 'maxRows', label: 'Max Rows (0 = all)', type: 'number', defaultValue: 0 },
    ],
  },
  {
    id: 'data-write-excel', type: 'data', label: 'Write Excel',
    description: 'Save data to an .xlsx file',
    iconName: 'Download', ...D,
    fields: [
      { key: 'path', label: 'Output File', type: 'text', defaultValue: 'output.xlsx' },
      { key: 'sheet', label: 'Sheet Name', type: 'text', defaultValue: 'Results' },
      { key: 'mode', label: 'Write Mode', type: 'select', options: ['overwrite', 'append', 'new sheet'], defaultValue: 'overwrite' },
      { key: 'autofit', label: 'Auto-fit Column Widths', type: 'boolean', defaultValue: true },
      { key: 'addTimestamp', label: 'Add Timestamp to Filename', type: 'boolean', defaultValue: false },
    ],
  },
  {
    id: 'data-read-csv', type: 'data', label: 'Read CSV',
    description: 'Load data from a CSV file',
    iconName: 'FileText', ...D,
    fields: [
      { key: 'path', label: 'File Path', type: 'text', defaultValue: 'data.csv' },
      { key: 'delimiter', label: 'Delimiter', type: 'select', options: [',', ';', 'Tab', '|', 'auto-detect'], defaultValue: ',' },
      { key: 'encoding', label: 'Encoding', type: 'select', options: ['utf-8', 'utf-8-sig', 'latin-1', 'cp1252'], defaultValue: 'utf-8' },
      { key: 'skipBad', label: 'Skip Bad Lines', type: 'boolean', defaultValue: true },
    ],
  },
  {
    id: 'data-write-csv', type: 'data', label: 'Write CSV',
    description: 'Export data as a CSV file',
    iconName: 'Upload', ...D,
    fields: [
      { key: 'path', label: 'Output File', type: 'text', defaultValue: 'output.csv' },
      { key: 'delimiter', label: 'Delimiter', type: 'select', options: [',', ';', 'Tab', '|'], defaultValue: ',' },
      { key: 'includeIndex', label: 'Include Index Column', type: 'boolean', defaultValue: false },
    ],
  },
  {
    id: 'data-filter', type: 'data', label: 'Filter Rows',
    description: 'Keep rows matching conditions',
    iconName: 'Filter', ...D,
    fields: [
      { key: 'column', label: 'Column', type: 'text', placeholder: 'Status', defaultValue: 'Status' },
      { key: 'operator', label: 'Operator', type: 'select', options: ['==', '!=', '>', '<', '>=', '<=', 'contains', 'not contains', 'starts with', 'ends with', 'is null', 'is not null', 'regex match'], defaultValue: '==' },
      { key: 'value', label: 'Value', type: 'text', placeholder: 'Active', defaultValue: 'Active' },
      { key: 'caseSensitive', label: 'Case Sensitive', type: 'boolean', defaultValue: false },
    ],
  },
  {
    id: 'data-sort', type: 'data', label: 'Sort Data',
    description: 'Sort rows by one or more columns',
    iconName: 'ArrowUpDown', ...D,
    fields: [
      { key: 'column', label: 'Sort By Column', type: 'text', placeholder: 'Date', defaultValue: 'Date' },
      { key: 'ascending', label: 'Ascending Order', type: 'boolean', defaultValue: false },
      { key: 'secondary', label: 'Secondary Sort Column', type: 'text', placeholder: 'optional', defaultValue: '' },
    ],
  },
  {
    id: 'data-deduplicate', type: 'data', label: 'Remove Duplicates',
    description: 'Drop duplicate rows',
    iconName: 'Copy', ...D,
    fields: [
      { key: 'subset', label: 'Check Columns (comma-sep, blank=all)', type: 'text', defaultValue: '' },
      { key: 'keep', label: 'Keep', type: 'select', options: ['first', 'last', 'none'], defaultValue: 'first' },
    ],
  },
  {
    id: 'data-vlookup', type: 'data', label: 'VLOOKUP / Merge',
    description: 'Join two datasets like Excel VLOOKUP',
    iconName: 'Link', ...D,
    fields: [
      { key: 'rightFile', label: 'Lookup File (right side)', type: 'text', placeholder: 'lookup_table.xlsx', defaultValue: 'lookup.xlsx' },
      { key: 'leftKey', label: 'Left Key Column', type: 'text', defaultValue: 'ID' },
      { key: 'rightKey', label: 'Right Key Column', type: 'text', defaultValue: 'ID' },
      { key: 'how', label: 'Join Type', type: 'select', options: ['left', 'inner', 'right', 'outer', 'cross'], defaultValue: 'left' },
      { key: 'suffix', label: 'Suffix for Duplicate Cols', type: 'text', defaultValue: '_lookup' },
    ],
  },
  {
    id: 'data-pivot', type: 'data', label: 'Pivot Table',
    description: 'Summarize data into a pivot table',
    iconName: 'LayoutList', ...D,
    fields: [
      { key: 'index', label: 'Row Index', type: 'text', defaultValue: 'Category' },
      { key: 'columns', label: 'Column Headers', type: 'text', defaultValue: 'Month' },
      { key: 'values', label: 'Values', type: 'text', defaultValue: 'Sales' },
      { key: 'aggFunc', label: 'Aggregate', type: 'select', options: ['sum', 'mean', 'count', 'max', 'min', 'std', 'first', 'last'], defaultValue: 'sum' },
      { key: 'fillValue', label: 'Fill Missing With', type: 'text', defaultValue: '0' },
    ],
  },
  {
    id: 'data-groupby', type: 'data', label: 'Group By',
    description: 'Group rows and aggregate',
    iconName: 'Group', ...D,
    fields: [
      { key: 'groupCol', label: 'Group By Column(s)', type: 'text', placeholder: 'Category, Region', defaultValue: 'Category' },
      { key: 'aggCol', label: 'Aggregate Column', type: 'text', defaultValue: 'Amount' },
      { key: 'aggFunc', label: 'Function', type: 'select', options: ['sum', 'mean', 'count', 'max', 'min', 'std', 'size', 'first', 'last'], defaultValue: 'sum' },
      { key: 'resetIndex', label: 'Reset Index After', type: 'boolean', defaultValue: true },
    ],
  },

  // ── TRANSFORM ─────────────────────────────────────────────────────────────
  {
    id: 'transform-string', type: 'transform', label: 'String Operation',
    description: 'Manipulate text columns',
    iconName: 'Type', ...X,
    fields: [
      { key: 'column', label: 'Column', type: 'text', defaultValue: 'Name' },
      { key: 'operation', label: 'Operation', type: 'select', options: ['uppercase', 'lowercase', 'title case', 'strip whitespace', 'strip left', 'strip right', 'replace', 'split', 'join', 'pad left', 'pad right', 'truncate', 'extract between'], defaultValue: 'strip whitespace' },
      { key: 'arg1', label: 'Arg 1 (if needed)', type: 'text', placeholder: 'old value / sep', defaultValue: '' },
      { key: 'arg2', label: 'Arg 2 (if needed)', type: 'text', placeholder: 'new value / limit', defaultValue: '' },
      { key: 'outputCol', label: 'Output Column (blank = overwrite)', type: 'text', defaultValue: '' },
    ],
  },
  {
    id: 'transform-regex', type: 'transform', label: 'Regex Match / Replace',
    description: 'Regular expression operations',
    iconName: 'Search', ...X,
    fields: [
      { key: 'column', label: 'Column', type: 'text', defaultValue: 'Text' },
      { key: 'pattern', label: 'Pattern', type: 'regex', placeholder: '\\d{4}-\\d{2}-\\d{2}', defaultValue: '\\d+', hint: 'Python regex syntax' },
      { key: 'mode', label: 'Mode', type: 'select', options: ['find all matches', 'test (true/false)', 'extract group 1', 'replace', 'split on pattern'], defaultValue: 'find all matches' },
      { key: 'replacement', label: 'Replacement (for replace)', type: 'text', defaultValue: '' },
      { key: 'flags', label: 'Flags', type: 'select', options: ['none', 'ignore case', 'multiline', 'dotall'], defaultValue: 'none' },
      { key: 'outputCol', label: 'Output Column', type: 'text', defaultValue: 'matches' },
    ],
  },
  {
    id: 'transform-json', type: 'transform', label: 'JSON Operation',
    description: 'Parse, navigate, and build JSON',
    iconName: 'Braces', ...X,
    fields: [
      { key: 'operation', label: 'Operation', type: 'select', options: ['parse string → object', 'stringify → string', 'get path (JSONPath)', 'set path', 'merge objects', 'array filter', 'array map', 'flatten', 'pick fields'], defaultValue: 'parse string → object' },
      { key: 'source', label: 'Source Variable', type: 'text', defaultValue: 'raw_json' },
      { key: 'path', label: 'JSON Path (e.g. $.data.items)', type: 'text', placeholder: '$.items[0].name', defaultValue: '' },
      { key: 'value', label: 'Value to Set (for set path)', type: 'json', defaultValue: '' },
      { key: 'outputVar', label: 'Output Variable', type: 'text', defaultValue: 'result' },
    ],
  },
  {
    id: 'transform-number', type: 'transform', label: 'Number / Math',
    description: 'Math operations, formatting, rounding',
    iconName: 'Calculator', ...X,
    fields: [
      { key: 'column', label: 'Column / Variable', type: 'text', defaultValue: 'Amount' },
      { key: 'operation', label: 'Operation', type: 'select', options: ['sum', 'average', 'count', 'max', 'min', 'round', 'floor', 'ceil', 'abs', 'sqrt', 'multiply by', 'divide by', 'add', 'subtract', 'modulo', 'power', 'percentage of total', 'cumulative sum', 'rolling average', 'z-score'], defaultValue: 'sum' },
      { key: 'arg', label: 'Argument (for multiply/divide etc.)', type: 'number', defaultValue: 1 },
      { key: 'decimals', label: 'Decimal Places', type: 'number', defaultValue: 2 },
      { key: 'outputCol', label: 'Output Column', type: 'text', defaultValue: 'result' },
    ],
  },
  {
    id: 'transform-boolean', type: 'transform', label: 'Boolean Logic',
    description: 'AND, OR, NOT, compare, type-check',
    iconName: 'ToggleLeft', ...X,
    fields: [
      { key: 'operation', label: 'Operation', type: 'select', options: ['AND', 'OR', 'NOT', 'XOR', 'NAND', 'is null', 'is not null', 'is numeric', 'is string', 'is empty', 'coerce to bool', 'all true in column', 'any true in column'], defaultValue: 'AND' },
      { key: 'leftExpr', label: 'Left Expression', type: 'text', placeholder: 'df["Active"] == True', defaultValue: '' },
      { key: 'rightExpr', label: 'Right Expression', type: 'text', placeholder: 'df["Amount"] > 0', defaultValue: '' },
      { key: 'outputCol', label: 'Output Column', type: 'text', defaultValue: 'bool_result' },
    ],
  },
  {
    id: 'transform-template', type: 'transform', label: 'Template / Format',
    description: 'Build strings from templates using data values',
    iconName: 'FileCode', ...X,
    fields: [
      { key: 'template', label: 'Template', type: 'textarea', placeholder: 'Hello {Name}, your order {order_id} is {status}', defaultValue: 'Hello {Name}!' },
      { key: 'outputVar', label: 'Output Variable', type: 'text', defaultValue: 'message' },
      { key: 'applyToEachRow', label: 'Apply to Each Row', type: 'boolean', defaultValue: true },
    ],
  },
  {
    id: 'transform-math-formula', type: 'transform', label: 'Custom Formula',
    description: 'Write a Python/pandas expression',
    iconName: 'Sigma', ...X,
    fields: [
      { key: 'formula', label: 'Formula', type: 'code', placeholder: 'df["Total"] = df["Price"] * df["Qty"] * (1 - df["Discount"])', defaultValue: 'df["Total"] = df["Price"] * df["Qty"]', hint: 'Full Python/pandas expression applied to df' },
      { key: 'outputCol', label: 'Output Column (optional)', type: 'text', defaultValue: '' },
    ],
  },

  // ── SEND & NOTIFY ─────────────────────────────────────────────────────────
  {
    id: 'send-email', type: 'send', label: 'Send Email',
    description: 'Send an email via SMTP',
    iconName: 'Mail', ...S,
    fields: [
      { key: 'to', label: 'To', type: 'text', placeholder: 'recipient@example.com', defaultValue: '' },
      { key: 'cc', label: 'CC (optional)', type: 'text', defaultValue: '' },
      { key: 'subject', label: 'Subject', type: 'text', defaultValue: 'Workflow Notification' },
      { key: 'body', label: 'Body (supports {variables})', type: 'textarea', defaultValue: 'Hello,\n\nYour workflow has completed.\n\nRegards,' },
      { key: 'bodyType', label: 'Body Format', type: 'select', options: ['plain', 'html'], defaultValue: 'plain' },
      { key: 'smtpHost', label: 'SMTP Host', type: 'text', defaultValue: 'smtp.gmail.com' },
      { key: 'smtpPort', label: 'SMTP Port', type: 'number', defaultValue: 587 },
    ],
  },
  {
    id: 'send-email-attachment', type: 'send', label: 'Email with Attachment',
    description: 'Send an email with file attachment',
    iconName: 'MailPlus', ...S,
    fields: [
      { key: 'to', label: 'To', type: 'text', defaultValue: '' },
      { key: 'subject', label: 'Subject', type: 'text', defaultValue: 'Report Attached' },
      { key: 'body', label: 'Body', type: 'textarea', defaultValue: 'Please find the report attached.' },
      { key: 'attachFile', label: 'Attachment File Path', type: 'text', defaultValue: 'output.xlsx' },
      { key: 'smtpHost', label: 'SMTP Host', type: 'text', defaultValue: 'smtp.gmail.com' },
    ],
  },
  {
    id: 'send-whatsapp', type: 'send', label: 'WhatsApp Message',
    description: 'Send a WhatsApp message via Twilio',
    iconName: 'MessageSquare', ...S,
    fields: [
      { key: 'to', label: 'Phone Number', type: 'text', placeholder: '+966501234567', defaultValue: '' },
      { key: 'message', label: 'Message (supports {variables})', type: 'textarea', defaultValue: 'Hello! Your workflow has completed.' },
      { key: 'fromNumber', label: 'Twilio From Number', type: 'text', defaultValue: '+14155238886' },
    ],
  },
  {
    id: 'send-slack', type: 'send', label: 'Slack Message',
    description: 'Post a message to a Slack channel',
    iconName: 'MessageCircle', ...S,
    fields: [
      { key: 'channel', label: 'Channel', type: 'text', defaultValue: '#general' },
      { key: 'message', label: 'Message', type: 'textarea', defaultValue: '✅ Workflow complete!' },
      { key: 'username', label: 'Bot Username', type: 'text', defaultValue: 'Workflow Bot' },
      { key: 'iconEmoji', label: 'Bot Icon', type: 'text', defaultValue: ':robot_face:' },
      { key: 'blocks', label: 'Use Rich Block Format', type: 'boolean', defaultValue: false },
    ],
  },
  {
    id: 'send-telegram', type: 'send', label: 'Telegram Message',
    description: 'Send a Telegram bot message',
    iconName: 'Send', ...S,
    fields: [
      { key: 'chatId', label: 'Chat ID', type: 'text', placeholder: '123456789', defaultValue: '' },
      { key: 'message', label: 'Message', type: 'textarea', defaultValue: 'Workflow notification' },
      { key: 'parseMode', label: 'Parse Mode', type: 'select', options: ['Markdown', 'HTML', 'plain'], defaultValue: 'Markdown' },
    ],
  },
  {
    id: 'send-sms', type: 'send', label: 'SMS (Twilio)',
    description: 'Send an SMS text message',
    iconName: 'Phone', ...S,
    fields: [
      { key: 'to', label: 'To Number', type: 'text', placeholder: '+966501234567', defaultValue: '' },
      { key: 'message', label: 'Message', type: 'text', defaultValue: 'Your workflow alert.' },
      { key: 'from', label: 'From Number', type: 'text', defaultValue: '' },
    ],
  },
  {
    id: 'send-webhook', type: 'send', label: 'Outgoing Webhook',
    description: 'POST data to any URL (notify other systems)',
    iconName: 'Zap', ...S,
    fields: [
      { key: 'url', label: 'URL', type: 'text', placeholder: 'https://hooks.example.com/notify', defaultValue: '' },
      { key: 'payload', label: 'JSON Payload', type: 'json', defaultValue: '{"status": "complete", "data": "{result}"}' },
      { key: 'secret', label: 'Secret Header (HMAC)', type: 'text', defaultValue: '' },
    ],
  },

  // ── EXTERNAL & API ────────────────────────────────────────────────────────
  {
    id: 'external-http', type: 'external', label: 'HTTP Request',
    description: 'Call any REST API endpoint',
    iconName: 'Globe', ...E,
    fields: [
      { key: 'method', label: 'Method', type: 'select', options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], defaultValue: 'GET' },
      { key: 'url', label: 'URL', type: 'text', placeholder: 'https://api.example.com/v1/data', defaultValue: '' },
      { key: 'headers', label: 'Headers (JSON)', type: 'json', defaultValue: '{"Content-Type": "application/json"}' },
      { key: 'body', label: 'Request Body (JSON)', type: 'json', defaultValue: '' },
      { key: 'auth', label: 'Auth Type', type: 'select', options: ['none', 'Bearer Token', 'Basic Auth', 'API Key header', 'OAuth 2.0'], defaultValue: 'none' },
      { key: 'authValue', label: 'Auth Value / Token', type: 'text', defaultValue: '' },
      { key: 'timeout', label: 'Timeout (sec)', type: 'number', defaultValue: 30 },
      { key: 'retries', label: 'Retries on Failure', type: 'number', defaultValue: 2 },
      { key: 'paginateKey', label: 'Pagination Key (for auto-pagination)', type: 'text', placeholder: 'next_cursor', defaultValue: '' },
    ],
  },
  {
    id: 'external-graphql', type: 'external', label: 'GraphQL Query',
    description: 'Run a GraphQL query or mutation',
    iconName: 'Network', ...E,
    fields: [
      { key: 'endpoint', label: 'GraphQL Endpoint', type: 'text', defaultValue: 'https://api.example.com/graphql' },
      { key: 'query', label: 'Query / Mutation', type: 'code', defaultValue: 'query {\n  users {\n    id\n    name\n    email\n  }\n}' },
      { key: 'variables', label: 'Variables (JSON)', type: 'json', defaultValue: '{}' },
      { key: 'authToken', label: 'Auth Bearer Token', type: 'text', defaultValue: '' },
    ],
  },
  {
    id: 'external-database', type: 'external', label: 'Database Query',
    description: 'Query SQL databases (SQLite, PostgreSQL, MySQL)',
    iconName: 'Database', ...E,
    fields: [
      { key: 'dialect', label: 'Database', type: 'select', options: ['SQLite', 'PostgreSQL', 'MySQL', 'MSSQL', 'Oracle'], defaultValue: 'SQLite' },
      { key: 'connection', label: 'Connection String', type: 'text', defaultValue: 'sqlite:///data.db' },
      { key: 'query', label: 'SQL Query', type: 'code', defaultValue: 'SELECT * FROM users WHERE active = 1' },
      { key: 'params', label: 'Parameters (JSON list)', type: 'json', defaultValue: '[]' },
      { key: 'returnAs', label: 'Return As', type: 'select', options: ['DataFrame', 'list of dicts', 'single value', 'rowcount'], defaultValue: 'DataFrame' },
    ],
  },
  {
    id: 'external-ftp', type: 'external', label: 'FTP / SFTP',
    description: 'Upload or download files via FTP/SFTP',
    iconName: 'Server', ...E,
    fields: [
      { key: 'protocol', label: 'Protocol', type: 'select', options: ['SFTP', 'FTP', 'FTPS'], defaultValue: 'SFTP' },
      { key: 'host', label: 'Host', type: 'text', defaultValue: 'ftp.example.com' },
      { key: 'port', label: 'Port', type: 'number', defaultValue: 22 },
      { key: 'username', label: 'Username', type: 'text', defaultValue: '' },
      { key: 'operation', label: 'Operation', type: 'select', options: ['upload', 'download', 'list files', 'delete file'], defaultValue: 'upload' },
      { key: 'localPath', label: 'Local File', type: 'text', defaultValue: 'output.xlsx' },
      { key: 'remotePath', label: 'Remote Path', type: 'text', defaultValue: '/uploads/output.xlsx' },
    ],
  },
  {
    id: 'external-google-sheets', type: 'external', label: 'Google Sheets',
    description: 'Read from or write to Google Sheets',
    iconName: 'Table', ...E,
    fields: [
      { key: 'operation', label: 'Operation', type: 'select', options: ['read range', 'write range', 'append rows', 'clear range', 'create sheet'], defaultValue: 'read range' },
      { key: 'spreadsheetId', label: 'Spreadsheet ID', type: 'text', placeholder: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms', defaultValue: '' },
      { key: 'range', label: 'Range (e.g. Sheet1!A1:Z100)', type: 'text', defaultValue: 'Sheet1!A:Z' },
    ],
  },

  // ── AI & AGENTS ───────────────────────────────────────────────────────────
  {
    id: 'ai-completion', type: 'ai', label: 'AI Completion',
    description: 'Ask an AI model to process or generate text',
    iconName: 'Sparkles', ...A,
    fields: [
      { key: 'provider', label: 'Provider', type: 'select', options: ['OpenAI', 'Anthropic (Claude)', 'Google Gemini', 'Ollama (local)'], defaultValue: 'OpenAI' },
      { key: 'model', label: 'Model', type: 'text', defaultValue: 'gpt-4o' },
      { key: 'systemPrompt', label: 'System Prompt', type: 'textarea', defaultValue: 'You are a helpful assistant.' },
      { key: 'userPrompt', label: 'User Prompt (supports {variables})', type: 'textarea', defaultValue: 'Summarize the following data: {data}' },
      { key: 'temperature', label: 'Temperature', type: 'number', defaultValue: 0 },
      { key: 'maxTokens', label: 'Max Tokens', type: 'number', defaultValue: 1000 },
      { key: 'outputVar', label: 'Output Variable', type: 'text', defaultValue: 'ai_response' },
    ],
  },
  {
    id: 'ai-email-agent', type: 'ai', label: 'Email AI Agent',
    description: 'AI reads email and decides what to do — reply, extract data, route, or escalate',
    iconName: 'Bot', ...A,
    fields: [
      { key: 'provider', label: 'AI Provider', type: 'select', options: ['OpenAI', 'Anthropic (Claude)', 'Google Gemini'], defaultValue: 'OpenAI' },
      { key: 'model', label: 'Model', type: 'text', defaultValue: 'gpt-4o' },
      { key: 'agentInstructions', label: 'Agent Instructions', type: 'textarea', defaultValue: 'You are an email assistant. Read the email, extract key information, categorize it as: Invoice, Support Request, Sales Lead, or Other. Decide whether to: reply, forward, extract data, or escalate.' },
      { key: 'tools', label: 'Tools Available', type: 'select', options: ['reply + extract', 'extract only', 'reply only', 'classify only', 'full agent mode'], defaultValue: 'reply + extract' },
      { key: 'outputVar', label: 'Output Variable', type: 'text', defaultValue: 'email_result' },
      { key: 'autoreply', label: 'Auto-send Replies', type: 'boolean', defaultValue: false },
    ],
  },
  {
    id: 'ai-extract', type: 'ai', label: 'AI Data Extractor',
    description: 'Use AI to extract structured data from text',
    iconName: 'Scan', ...A,
    fields: [
      { key: 'inputVar', label: 'Input Variable', type: 'text', defaultValue: 'raw_text' },
      { key: 'schema', label: 'Output Schema (JSON)', type: 'json', defaultValue: '{"name": "string", "date": "YYYY-MM-DD", "amount": "number"}' },
      { key: 'provider', label: 'Provider', type: 'select', options: ['OpenAI', 'Anthropic (Claude)', 'Google Gemini'], defaultValue: 'OpenAI' },
      { key: 'model', label: 'Model', type: 'text', defaultValue: 'gpt-4o' },
      { key: 'outputVar', label: 'Output Variable', type: 'text', defaultValue: 'extracted' },
    ],
  },
  {
    id: 'ai-summarize', type: 'ai', label: 'AI Summarize',
    description: 'Summarize a document or dataset with AI',
    iconName: 'AlignLeft', ...A,
    fields: [
      { key: 'inputVar', label: 'Input Variable', type: 'text', defaultValue: 'document' },
      { key: 'style', label: 'Summary Style', type: 'select', options: ['executive summary', 'bullet points', 'one sentence', 'detailed', 'table format'], defaultValue: 'bullet points' },
      { key: 'maxWords', label: 'Max Words', type: 'number', defaultValue: 150 },
      { key: 'provider', label: 'Provider', type: 'select', options: ['OpenAI', 'Anthropic (Claude)', 'Google Gemini'], defaultValue: 'OpenAI' },
      { key: 'outputVar', label: 'Output Variable', type: 'text', defaultValue: 'summary' },
    ],
  },
  {
    id: 'ai-classify', type: 'ai', label: 'AI Classify / Label',
    description: 'Classify text into categories',
    iconName: 'Brain', ...A,
    fields: [
      { key: 'inputVar', label: 'Input Variable', type: 'text', defaultValue: 'text' },
      { key: 'categories', label: 'Categories (comma-separated)', type: 'text', defaultValue: 'Positive, Negative, Neutral' },
      { key: 'applyToColumn', label: 'Apply to Column (for bulk)', type: 'text', defaultValue: '' },
      { key: 'provider', label: 'Provider', type: 'select', options: ['OpenAI', 'Anthropic (Claude)', 'Google Gemini'], defaultValue: 'OpenAI' },
      { key: 'outputVar', label: 'Output Column / Variable', type: 'text', defaultValue: 'label' },
    ],
  },

  // ── CODE & CUSTOM ─────────────────────────────────────────────────────────
  {
    id: 'code-python', type: 'code', label: 'Python Code',
    description: 'Run arbitrary Python — access all previous variables',
    iconName: 'Code2', ...C,
    fields: [
      { key: 'code', label: 'Python Code', type: 'code', defaultValue: '# All previous variables are available\n# e.g. df, result, row, etc.\n\nprint("Running custom code")\n' },
      { key: 'outputVar', label: 'Return Variable Name', type: 'text', defaultValue: '' },
    ],
  },
  {
    id: 'code-javascript', type: 'code', label: 'JavaScript Code',
    description: 'Run JS (Node.js) inline or as a separate script',
    iconName: 'FileCode', ...C,
    fields: [
      { key: 'code', label: 'JavaScript Code', type: 'code', defaultValue: '// Variables passed as JSON via stdin\nconst data = JSON.parse(require("fs").readFileSync(0, "utf8"));\n\nconst result = data;\nconsole.log(JSON.stringify(result));\n' },
      { key: 'mode', label: 'Execution Mode', type: 'select', options: ['inline (subprocess)', 'save as .js file', 'generate JS workflow file'], defaultValue: 'inline (subprocess)' },
      { key: 'outputVar', label: 'Output Variable', type: 'text', defaultValue: 'js_result' },
    ],
  },
  {
    id: 'code-set-variable', type: 'code', label: 'Set Variable',
    description: 'Declare or update a variable',
    iconName: 'Variable', ...C,
    fields: [
      { key: 'varName', label: 'Variable Name', type: 'text', defaultValue: 'my_var' },
      { key: 'valueType', label: 'Value Type', type: 'select', options: ['string', 'number', 'boolean', 'JSON / object', 'Python expression'], defaultValue: 'string' },
      { key: 'value', label: 'Value', type: 'textarea', defaultValue: 'Hello World' },
    ],
  },
  {
    id: 'code-log', type: 'code', label: 'Log / Debug',
    description: 'Print values to console or a log file',
    iconName: 'Terminal', ...C,
    fields: [
      { key: 'message', label: 'Message / Template', type: 'text', defaultValue: 'Step complete. Rows: {len(df)}' },
      { key: 'level', label: 'Log Level', type: 'select', options: ['INFO', 'DEBUG', 'WARNING', 'ERROR'], defaultValue: 'INFO' },
      { key: 'also_print', label: 'Also Print to Console', type: 'boolean', defaultValue: true },
      { key: 'logFile', label: 'Log File (optional)', type: 'text', defaultValue: '' },
    ],
  },
  {
    id: 'code-comment', type: 'code', label: 'Comment / Note',
    description: 'Add a visual note to your workflow',
    iconName: 'StickyNote', ...C,
    fields: [
      { key: 'note', label: 'Note', type: 'textarea', defaultValue: 'Add notes here...' },
    ],
  },

  // ── END ───────────────────────────────────────────────────────────────────
  {
    id: 'end-success', type: 'end', label: 'End (Success)',
    description: 'Workflow completed successfully',
    iconName: 'Flag', ...Z,
    fields: [
      { key: 'message', label: 'Completion Message', type: 'text', defaultValue: 'Workflow completed successfully!' },
      { key: 'returnVar', label: 'Return Variable (optional)', type: 'text', defaultValue: '' },
    ],
  },
  {
    id: 'end-error', type: 'end', label: 'End (Error)',
    description: 'Terminate workflow with an error',
    iconName: 'AlertCircle', ...Z,
    fields: [
      { key: 'message', label: 'Error Message', type: 'text', defaultValue: 'Workflow failed.' },
      { key: 'code', label: 'Exit Code', type: 'number', defaultValue: 1 },
    ],
  },
];
