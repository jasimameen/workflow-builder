# FlowBuilder — CLAUDE.md

## What this project is

A visual no-code/low-code workflow automation builder built with **Next.js 16 + React 19 + React Flow (@xyflow/react)**. Users drag nodes onto a canvas, wire them together, configure settings, test them live, then generate runnable Python or JavaScript code.

Think n8n or Zapier, but the output is real code you own and can deploy anywhere.

---

## How to run

```bash
cd workflow-builder
npm run dev        # → http://localhost:3030
npm run build      # production build
npx tsc --noEmit   # type-check without building
```

---

## Project structure

```
app/
├── layout.tsx               # Root layout (Tailwind, fonts)
├── page.tsx                 # Renders <WorkflowCanvas /> full-screen
│
├── components/
│   ├── WorkflowCanvas.tsx   # ★ Root orchestrator — holds all state
│   ├── WorkflowNode.tsx     # Custom React Flow node renderer
│   ├── NodeLibrary.tsx      # Left sidebar — draggable node palette
│   ├── PropertiesPanel.tsx  # Right sidebar — Configure + Test tabs
│   ├── VariablePicker.tsx   # { } button + floating variable dropdown
│   └── CodePanel.tsx        # Python/JS code generator view
│
├── lib/
│   ├── types.ts             # ★ All TypeScript types + NODE_LIBRARY data
│   ├── icons.tsx            # NodeIcon wrapper for Lucide icons
│   └── codeGenerator.ts     # Python/JS code generation logic
│
└── api/
    ├── run-http/route.ts    # Proxy HTTP requests (avoids CORS)
    ├── run-ai/route.ts      # Call OpenAI / Anthropic / Gemini
    └── run-python/route.ts  # Execute Python in a subprocess
```

---

## Core data model

Everything flows through `WorkflowNodeData` (defined in `app/lib/types.ts`):

```typescript
interface WorkflowNodeData {
  nodeConfig: NodeConfig;       // static node definition from NODE_LIBRARY
  label: string;                // user-editable display name
  description?: string;
  fields?: Record<string, string | number | boolean>;  // configured field values
  customFields?: CustomField[];                        // user-added variables
  testValues?: Record<string, string | number | boolean>; // test-only overrides
  testState?: NodeTestState;    // last test result (status, output, error…)
  switchCases?: string;         // comma-separated cases for Switch node
}
```

Node definitions live in the big `NODE_LIBRARY` array in `types.ts`. Each entry is a `NodeConfig` with an `id`, `type`, `label`, `fields[]`, and colour palette. **Do not duplicate node IDs.**

---

## State management

All state lives in `WorkflowCanvas.tsx` — no external store. Key pieces:

| State | Type | Purpose |
|---|---|---|
| `nodes` | `WFNode[]` | React Flow nodes (includes `data: WorkflowNodeData`) |
| `edges` | `Edge[]` | React Flow edges |
| `selectedNode` | `WFNode \| null` | Which node the properties panel shows |
| `savedVariables` | `SavedVariable[]` | Variables saved from test outputs, shown in `{ }` picker |
| `showCode` | `boolean` | Toggle between canvas view and code view |

`testState` is stored directly on `node.data.testState` so the node renderer can read it without extra prop drilling.

---

## Adding a new node type

1. **Add the definition** to `NODE_LIBRARY` in `app/lib/types.ts`:

```typescript
{
  id: 'category-name',          // must be unique, kebab-case
  type: 'external',             // one of NodeCategory
  label: 'My Node',
  description: 'What it does',
  iconName: 'Globe',            // any Lucide icon name
  ...E,                         // spread the colour palette for its category
  fields: [
    { key: 'url', label: 'URL', type: 'text', defaultValue: '' },
    { key: 'method', label: 'Method', type: 'select', options: ['GET','POST'], defaultValue: 'GET' },
  ],
},
```

2. **Add icon support** in `app/lib/icons.tsx` if the Lucide icon isn't already mapped.

3. **Add code generation** in `app/lib/codeGenerator.ts` — find the big `switch(node.data.nodeConfig.id)` block and add a case.

4. **(Optional) Add live test support** in `PropertiesPanel.tsx` — the `runTest()` function has a chain of `if/else if` blocks per node type. Add one if it needs real execution.

That's it — the node will appear in the library, be draggable, configurable, and code-generatable automatically.

---

## Field types

| type | Renders as | Notes |
|---|---|---|
| `text` | `<input>` with `{ }` variable picker | Most common |
| `textarea` | `<textarea>` with `{ }` variable picker | For prompts, multiline |
| `code` | `<textarea>` monospace with `{ }` picker | Python/JS code blocks |
| `json` | `<textarea>` monospace with `{ }` picker | JSON values |
| `regex` | `<input>` with `/…/` decoration | Regex patterns |
| `number` | `<input type="number">` | Numeric fields |
| `boolean` | Toggle switch | Yes/No |
| `select` | `<select>` | Must have `options: string[]` |

---

## Custom field colour palette

Defined in `FIELD_TYPE_COLORS` in `types.ts`. **Use these colours everywhere** — in field cards, the variable picker chips, type badges. Never use ad-hoc colours for field types.

| Type | Dot colour |
|---|---|
| text | blue `#3b82f6` |
| number | green `#22c55e` |
| boolean | amber `#f59e0b` |
| json | purple `#8b5cf6` |
| regex | red `#ef4444` |
| textarea | indigo `#6366f1` |
| select | teal `#14b8a6` |

---

## Variable references

Users reference values with `{variable_name}` syntax (single braces). The `{ }` picker in `VariablePicker.tsx` inserts these at cursor position. Sources:

1. **Custom fields** — from any node's `customFields[]` array
2. **Saved outputs** — variables saved from test runs via `onSaveVariable()`
3. **System vars** — `{date}`, `{timestamp}`, `{run_id}`, `{workflow_name}`, etc.

---

## Live test execution (API routes)

| Route | What it does |
|---|---|
| `POST /api/run-http` | Proxies an HTTP request server-side (avoids CORS). Body: `{ url, method, headers, body, timeout }` |
| `POST /api/run-ai` | Calls OpenAI / Anthropic / Gemini. Body: `{ provider, model, apiKey, systemPrompt, userPrompt, temperature, maxTokens }` |
| `POST /api/run-python` | Writes a temp `.py` file, runs it with `python3`, returns `{ stdout, vars, error }`. Requires Python 3 installed. |

The test runner logic in `PropertiesPanel.tsx` dispatches to these based on `nodeConfig.id` or `nodeConfig.type`. API keys are passed per-request and never persisted.

---

## Colour palette (node categories)

Each category has a palette constant at the top of `types.ts`:

```
T = trigger  (amber)    F = flow      (red-orange)
D = data     (emerald)  X = transform (violet)
S = send     (blue)     E = external  (cyan)
A = ai       (pink)     C = code      (gray)
Z = end      (slate)
```

Spread these into node definitions: `{ ...T, id: '...', type: 'trigger', ... }`

---

## Key conventions

- **No external state library** — keep state in `WorkflowCanvas` and pass down as props.
- **TypeScript strict** — run `npx tsc --noEmit` and fix all errors before considering anything done.
- **Tailwind only** — no CSS modules, no styled-components. Use inline `style={{}}` only for dynamic colours derived from node config.
- **React Flow node data** — always access node data as `node.data` typed as `WorkflowNodeData`. Don't store non-serialisable values there.
- **`NODE_LIBRARY` is the source of truth** for node definitions — never hard-code node properties in components.
- **Lucide icons** — all icons come from `lucide-react`. The `NodeIcon` component in `icons.tsx` maps string names to components for use in node data (which must stay serialisable).

---

## Common tasks

**Add a field to an existing node:** Find the node in `NODE_LIBRARY` in `types.ts`, add an entry to its `fields[]` array.

**Change a node's colour:** Change which palette constant it spreads (`...T`, `...D`, etc.) or override `color`/`bgColor`/`borderColor` directly.

**Add code generation for a node:** Open `codeGenerator.ts`, find the `switch` block, add a `case 'your-node-id':`.

**Add a new live test type:** Open `PropertiesPanel.tsx`, find `runTest()`, add an `else if (nodeConfig.id === 'your-node-id')` block.

**Change the right panel width:** It's set as `w-72` on the panel wrapper in `WorkflowCanvas.tsx`.
