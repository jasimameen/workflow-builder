/**
 * nodeInterface.ts
 *
 * Core interface & abstract base class system for workflow nodes.
 *
 * HOW IT WORKS:
 * ─────────────
 *  1. Define your node by extending `BaseNodeAction` and filling in `definition`.
 *  2. Implement `execute()` — it receives a `NodeExecutionContext` which gives
 *     you all upstream variables, this node's config, and a set of helpers.
 *  3. Return a `NodeExecutionResult` with the outputs your node produces.
 *
 * EXAMPLE:
 * ─────────
 *  class MySlackNode extends BaseNodeAction {
 *    definition = MY_SLACK_DEFINITION;
 *
 *    async execute(ctx) {
 *      const msg = this.resolveTemplate(String(ctx.config.message), ctx.variables);
 *      await slackApi.post(ctx.config.channel, msg);
 *      return this.success({ posted: true });
 *    }
 *  }
 */

// ─────────────────────────────────────────────────────────────────────────────
//  Primitive types
// ─────────────────────────────────────────────────────────────────────────────

/** Every value type a node can input or output */
export type NodeIOType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'json'
  | 'dataframe'
  | 'list'
  | 'email'
  | 'file'
  | 'any';

/** Sidebar grouping — every node belongs to one of three pillars */
export type NodePillar = 'input' | 'action' | 'output';

/** Fine-grained subcategory within the action pillar */
export type NodeSubcategory =
  | 'trigger'   // input pillar
  | 'ai'
  | 'flow'
  | 'data'
  | 'transform'
  | 'external'
  | 'code'
  | 'send'      // output pillar
  | 'end';      // output pillar

// ─────────────────────────────────────────────────────────────────────────────
//  Input / Output specifications
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Describes one variable a node expects to receive from upstream.
 * Used to validate the workflow before running.
 */
export interface INodeInputSpec {
  /** Variable key expected in context.variables */
  key: string;
  /** Human-readable label shown in the UI */
  label: string;
  /** Expected type — used for validation and color-coding */
  type: NodeIOType;
  /** If false, node can run without this variable */
  required: boolean;
  /** Shown as tooltip in the I/O panel */
  description?: string;
  /** Fallback if the variable is absent */
  defaultValue?: unknown;
}

/**
 * Describes one variable a node will produce and make available downstream.
 */
export interface INodeOutputSpec {
  /** Variable key this node writes to context.variables */
  key: string;
  /** Human-readable label */
  label: string;
  /** Type of the value */
  type: NodeIOType;
  /** Tooltip description */
  description?: string;
  /**
   * When true, the actual key comes from a field value set by the user
   * (e.g. AI node's "Output Variable" field).
   */
  dynamic?: boolean;
  /** Which field key holds the user-defined variable name */
  dynamicKeyField?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Field specifications (configuration UI)
// ─────────────────────────────────────────────────────────────────────────────

export type NodeFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'boolean'
  | 'select'
  | 'json'
  | 'code'
  | 'regex'
  | 'http-builder'  // visual key/value HTTP request builder
  | 'kv-list';      // generic visual key/value list

/**
 * Describes one configuration field shown in the Properties Panel.
 */
export interface INodeFieldSpec {
  key: string;
  label: string;
  type: NodeFieldType;
  required?: boolean;
  placeholder?: string;
  /** Shown below the field as a hint */
  hint?: string;
  /** Options list for `select` type */
  options?: string[];
  defaultValue?: string | number | boolean;
  /** If true, the field value can reference {{variables}} */
  supportsVariables?: boolean;
  /**
   * Section header — group related fields visually.
   * Fields sharing the same section string appear under one collapsible group.
   */
  section?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Node definition
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Full static definition of a node type.
 * Extend `BaseNodeAction` and assign this to `definition`.
 */
export interface INodeDefinition {
  /** Unique identifier (kebab-case) */
  id: string;
  /** Human-readable name */
  label: string;
  /** One-line description shown in the library */
  description: string;
  /** Top-level sidebar pillar */
  pillar: NodePillar;
  /** Fine-grained subcategory */
  subcategory: NodeSubcategory;
  /** Lucide icon name */
  iconName: string;
  /** Brand/accent color (hex) */
  color: string;
  /** Background tint */
  bgColor: string;
  /** Border/accent color */
  borderColor: string;
  /** What upstream variables this node needs */
  inputSpec: INodeInputSpec[];
  /** What variables this node produces */
  outputSpec: INodeOutputSpec[];
  /** Configuration fields shown in the Properties Panel */
  fields: INodeFieldSpec[];
  /** Whether this node has exactly one outgoing edge (false = can branch) */
  singleOutput?: boolean;
  /** Node is a loop — wraps a sub-graph */
  isLoopNode?: boolean;
  /** Node is a switch/branch */
  isSwitchNode?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Execution context & helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * API object injected into every node's execute() call.
 * Provides helpers to read/write workflow state.
 */
export interface WorkflowAPI {
  /**
   * Write a variable into the shared workflow state.
   * Downstream nodes can read it via `context.variables[key]`.
   */
  setVariable(key: string, value: unknown): void;

  /** Read any workflow variable by key */
  getVariable(key: string): unknown;

  /** Get all current workflow variables */
  getAllVariables(): Record<string, unknown>;

  /**
   * Update one of this node's custom fields.
   * Useful for storing partial results between retries.
   */
  setCustomField(key: string, value: unknown): void;

  /** Get this node's custom field by key */
  getCustomField(key: string): unknown;

  /**
   * Write to a "bot field" — a workflow-level global config slot
   * (e.g. API keys, tenant ID, shared settings).
   */
  setBotField(key: string, value: unknown): void;

  /** Read a bot/global field */
  getBotField(key: string): unknown;

  /** Log a timestamped message to the run log */
  log(message: string, level?: 'info' | 'warn' | 'error'): void;

  /**
   * Abort the entire workflow with an optional message.
   * No further nodes will execute.
   */
  stop(reason?: string): void;
}

/**
 * Everything a node receives when it runs.
 */
export interface NodeExecutionContext {
  /** All workflow variables produced by upstream nodes */
  variables: Record<string, unknown>;

  /** This node's configured field values (after template resolution) */
  config: Record<string, unknown>;

  /** Raw config values before template resolution */
  rawConfig: Record<string, unknown>;

  /** User-defined custom fields on this specific node */
  customFields: Record<string, unknown>;

  /** Access to workflow-level state & helpers */
  workflow: WorkflowAPI;

  /** ID of the current node (useful for self-referencing) */
  nodeId: string;

  /** Name/label of the current node */
  nodeName: string;
}

/**
 * What a node's execute() must return.
 */
export interface NodeExecutionResult {
  success: boolean;
  /** Variables this node produced (will be merged into workflow state) */
  outputs: Record<string, unknown>;
  /** Human-readable status line shown in the UI */
  message?: string;
  /** Error detail if success === false */
  error?: string;
  /** Execution duration in milliseconds */
  duration?: number;
  /** Structured logs from this run */
  logs?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
//  Abstract base class
// ─────────────────────────────────────────────────────────────────────────────

/**
 * BaseNodeAction — extend this to create a custom workflow node.
 *
 * ```ts
 * export class MyEmailNode extends BaseNodeAction {
 *   definition: INodeDefinition = {
 *     id: 'my-email',
 *     label: 'My Email Sender',
 *     pillar: 'output',
 *     subcategory: 'send',
 *     // ...
 *   };
 *
 *   async execute(ctx: NodeExecutionContext): Promise<NodeExecutionResult> {
 *     const to  = String(ctx.config.to);
 *     const msg = this.resolveTemplate(String(ctx.config.body), ctx.variables);
 *     await sendEmail(to, msg);
 *     return this.success({ sent: true });
 *   }
 * }
 * ```
 */
export abstract class BaseNodeAction {
  /** Static definition — filled in by the subclass */
  abstract readonly definition: INodeDefinition;

  /**
   * Main execution entry point. Override this in your subclass.
   * Receives full context including variables and the workflow API.
   */
  abstract execute(context: NodeExecutionContext): Promise<NodeExecutionResult>;

  // ── Validation ─────────────────────────────────────────────────────────────

  /**
   * Validates that all required inputs are present.
   * Override to add custom validation.
   * @returns Array of human-readable error strings (empty = valid)
   */
  validate(context: NodeExecutionContext): string[] {
    const errors: string[] = [];
    for (const spec of this.definition.inputSpec) {
      if (spec.required && context.variables[spec.key] === undefined) {
        errors.push(`Missing required input: "${spec.label}" ({{${spec.key}}})`);
      }
    }
    return errors;
  }

  // ── Template helpers ────────────────────────────────────────────────────────

  /**
   * Resolve `{{variable}}` placeholders in a template string.
   *
   * Supports:
   *  - `{{simple}}`               → variables.simple
   *  - `{{obj.nested}}`           → variables.obj?.nested
   *  - `{{arr[0]}}`               → variables.arr[0]
   *
   * Unknown variables are left as-is: `{{unknown}}`.
   */
  protected resolveTemplate(
    template: string,
    variables: Record<string, unknown>,
  ): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const parts = path.trim().split(/[.[\]]+/).filter(Boolean);
      let val: unknown = variables;
      for (const part of parts) {
        if (val === null || val === undefined) return match;
        val = (val as Record<string, unknown>)[part];
      }
      return val !== undefined && val !== null ? String(val) : match;
    });
  }

  /**
   * Resolve all `{{variable}}` placeholders in an entire config object.
   */
  protected resolveConfigTemplates(
    config: Record<string, unknown>,
    variables: Record<string, unknown>,
  ): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(config)) {
      resolved[k] = typeof v === 'string' ? this.resolveTemplate(v, variables) : v;
    }
    return resolved;
  }

  // ── Result helpers ──────────────────────────────────────────────────────────

  /** Convenience: return a success result */
  protected success(
    outputs: Record<string, unknown> = {},
    message?: string,
    duration?: number,
  ): NodeExecutionResult {
    return { success: true, outputs, message, duration };
  }

  /** Convenience: return a failure result */
  protected failure(
    error: string,
    outputs: Record<string, unknown> = {},
    duration?: number,
  ): NodeExecutionResult {
    return { success: false, outputs, error, duration };
  }

  // ── Variable helpers ────────────────────────────────────────────────────────

  /**
   * Write one output variable directly into the workflow.
   * Call this inside execute() to make data available to downstream nodes.
   *
   * Equivalent to: `context.workflow.setVariable(key, value)`
   */
  protected setOutput(
    context: NodeExecutionContext,
    key: string,
    value: unknown,
  ): void {
    context.workflow.setVariable(key, value);
  }

  /**
   * Read one upstream variable with a typed assertion.
   * Returns `defaultValue` if the variable is not present.
   */
  protected getInput<T>(
    context: NodeExecutionContext,
    key: string,
    defaultValue?: T,
  ): T {
    const val = context.variables[key];
    return (val !== undefined ? val : defaultValue) as T;
  }

  /**
   * Shorthand: get a config field value, resolving templates automatically.
   */
  protected getConfig<T = string>(
    context: NodeExecutionContext,
    key: string,
    defaultValue?: T,
  ): T {
    const raw = context.rawConfig[key];
    if (raw === undefined) return defaultValue as T;
    if (typeof raw === 'string') {
      return this.resolveTemplate(raw, context.variables) as unknown as T;
    }
    return raw as T;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Global workflow utility functions
//  (These can be used outside of nodes — e.g. from a script or test harness)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a WorkflowAPI instance backed by plain JS objects.
 * Useful for unit-testing a node action in isolation.
 *
 * ```ts
 * const api = createWorkflowAPI({ myVar: 'hello' });
 * api.setVariable('result', 42);
 * console.log(api.getAllVariables()); // { myVar: 'hello', result: 42 }
 * ```
 */
export function createWorkflowAPI(
  initialVars: Record<string, unknown> = {},
  initialBotFields: Record<string, unknown> = {},
): WorkflowAPI & { _vars: Record<string, unknown>; _botFields: Record<string, unknown> } {
  const _vars: Record<string, unknown> = { ...initialVars };
  const _bot: Record<string, unknown> = { ...initialBotFields };
  const _custom: Record<string, unknown> = {};
  const _logs: string[] = [];

  return {
    _vars,
    _botFields: _bot,
    setVariable: (k, v) => { _vars[k] = v; },
    getVariable: (k) => _vars[k],
    getAllVariables: () => ({ ..._vars }),
    setCustomField: (k, v) => { _custom[k] = v; },
    getCustomField: (k) => _custom[k],
    setBotField: (k, v) => { _bot[k] = v; },
    getBotField: (k) => _bot[k],
    log: (msg, level = 'info') => {
      const line = `[${level.toUpperCase()}] ${new Date().toISOString()} ${msg}`;
      _logs.push(line);
      if (process.env.NODE_ENV !== 'test') console.log(line);
    },
    stop: (reason) => { throw new Error(`Workflow stopped: ${reason ?? 'no reason given'}`); },
  };
}

/**
 * Resolve all `{{variable}}` references in a string using a variable map.
 * Standalone version of BaseNodeAction.resolveTemplate.
 */
export function resolveVariables(
  template: string,
  variables: Record<string, unknown>,
): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    const parts = path.trim().split(/[.[\]]+/).filter(Boolean);
    let val: unknown = variables;
    for (const part of parts) {
      if (val === null || val === undefined) return match;
      val = (val as Record<string, unknown>)[part];
    }
    return val !== undefined && val !== null ? String(val) : match;
  });
}

/**
 * Search the node library by keyword.
 * Returns matching definitions ranked by relevance.
 *
 * Usage (in a component):
 * ```ts
 * import { searchNodes } from '@/lib/nodeInterface';
 * const results = searchNodes(NODE_LIBRARY_DEFINITIONS, 'email');
 * ```
 */
export function searchNodes<T extends { label: string; description: string; id: string }>(
  nodes: T[],
  query: string,
): T[] {
  const lc = query.toLowerCase().trim();
  if (!lc) return nodes;
  return nodes.filter(n =>
    n.label.toLowerCase().includes(lc) ||
    n.description.toLowerCase().includes(lc) ||
    n.id.toLowerCase().includes(lc),
  );
}

/**
 * Group a flat list of nodes into the three sidebar pillars.
 */
export function groupByPillar<T extends { pillar?: NodePillar; subcategory?: NodeSubcategory }>(
  nodes: T[],
): { input: T[]; action: T[]; output: T[] } {
  const INPUT_SUBS: NodeSubcategory[] = ['trigger'];
  const OUTPUT_SUBS: NodeSubcategory[] = ['send', 'end'];

  const classify = (n: T): NodePillar => {
    if (n.pillar) return n.pillar;
    if (n.subcategory && INPUT_SUBS.includes(n.subcategory)) return 'input';
    if (n.subcategory && OUTPUT_SUBS.includes(n.subcategory)) return 'output';
    return 'action';
  };

  return nodes.reduce(
    (acc, n) => { acc[classify(n)].push(n); return acc; },
    { input: [] as T[], action: [] as T[], output: [] as T[] },
  );
}

/**
 * Type-guard: check whether a value looks like a resolved variable reference.
 * Useful to detect `{{variable}}` tokens that haven't been replaced yet.
 */
export function isUnresolvedVariable(value: unknown): value is string {
  return typeof value === 'string' && /\{\{[^}]+\}\}/.test(value);
}

/**
 * Extract all `{{variable}}` references from a string.
 */
export function extractVariableRefs(template: string): string[] {
  const matches = [...template.matchAll(/\{\{([^}]+)\}\}/g)];
  return [...new Set(matches.map(m => m[1].trim().split(/[.[\]]+/)[0]))];
}
