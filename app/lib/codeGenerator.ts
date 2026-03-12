import { Node, Edge } from '@xyflow/react';
import { WorkflowNodeData } from './types';

type WFNode = Node<WorkflowNodeData>;

function f(data: WorkflowNodeData, key: string, fallback = ''): string {
  return String(data.fields?.[key] ?? fallback);
}
function fb(data: WorkflowNodeData, key: string, fallback = false): boolean {
  const v = data.fields?.[key];
  return v !== undefined ? Boolean(v) : fallback;
}
function fn(data: WorkflowNodeData, key: string, fallback = 0): number {
  return Number(data.fields?.[key] ?? fallback);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Custom-fields block
// ─────────────────────────────────────────────────────────────────────────────
function customFieldsCode(data: WorkflowNodeData, indent = '    '): string {
  const cfs = data.customFields;
  if (!cfs || cfs.length === 0) return '';
  const lines = cfs.map(cf => {
    const v = cf.value;
    let pyVal: string;
    switch (cf.type) {
      case 'number':  pyVal = String(v); break;
      case 'boolean': pyVal = v ? 'True' : 'False'; break;
      case 'json':    pyVal = `${v}`; break;
      case 'regex':   pyVal = `re.compile(r"${v}")`; break;
      default:        pyVal = `"${String(v).replace(/"/g, '\\"')}"`;
    }
    return `${indent}${cf.key} = ${pyVal}  # ${cf.label || cf.key}`;
  });
  return `${indent}# ── Custom Fields ─────────────────────────────────────────\n${lines.join('\n')}\n`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Per-node code generator
// ─────────────────────────────────────────────────────────────────────────────
function genNode(node: WFNode): string {
  const { nodeConfig, label } = node.data;
  const d = node.data;
  const i = '    ';   // 4-space indent inside run_workflow()

  const customBlock = customFieldsCode(d, i);

  switch (nodeConfig.id) {

    // ── TRIGGERS ──────────────────────────────────────────────────────────
    case 'trigger-schedule': {
      const mode = f(d, 'mode', 'Simple');
      const cron = f(d, 'cron', '0 9 * * *');
      const interval = f(d, 'interval', 'Daily');
      const tz = f(d, 'timezone', 'UTC');
      const schedMap: Record<string,string> = {
        'Every minute': 'schedule.every(1).minutes',
        'Every 5 minutes': 'schedule.every(5).minutes',
        'Every hour': 'schedule.every().hour',
        'Daily': 'schedule.every().day.at("09:00")',
        'Weekly': 'schedule.every().monday.at("09:00")',
        'Monthly': 'schedule.every(30).days',
      };
      const schedCall = schedMap[interval] || 'schedule.every().day.at("09:00")';
      if (mode === 'Cron expression') {
        return `# ── Trigger: Cron Schedule ─────────────────────────────────────
from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger
import pytz

scheduler = BlockingScheduler(timezone="${tz}")

def run_workflow():
`;
      }
      return `# ── Trigger: Schedule ──────────────────────────────────────────
import schedule
import time

# Runs: ${interval}
${schedCall}.do(run_workflow)

def run_workflow():
`;
    }

    case 'trigger-manual':
      return `# ── Trigger: Manual Start ──────────────────────────────────────
def run_workflow():
`;

    case 'trigger-webhook': {
      const path = f(d, 'path', '/webhook/trigger');
      const method = f(d, 'method', 'POST');
      return `# ── Trigger: Webhook Server ────────────────────────────────────
from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route("${path}", methods=["${method}"])
def webhook_handler():
    payload = request.get_json()
    run_workflow(payload)
    return jsonify({"status": "ok"})

def run_workflow(payload=None):
`;
    }

    case 'trigger-email': {
      const host = f(d, 'host', 'imap.gmail.com');
      const folder = f(d, 'folder', 'INBOX');
      const filterSubj = f(d, 'filter', '');
      return `# ── Trigger: Email Watcher ─────────────────────────────────────
import imaplib, email, time

def watch_email():
    mail = imaplib.IMAP4_SSL("${host}")
    mail.login(EMAIL_USER, EMAIL_PASSWORD)
    mail.select("${folder}")
    while True:
        _, ids = mail.search(None, 'UNSEEN'${filterSubj ? `, '(SUBJECT "${filterSubj}")'` : ''})
        for eid in ids[0].split():
            _, data = mail.fetch(eid, "(RFC822)")
            msg = email.message_from_bytes(data[0][1])
            run_workflow(msg)
        time.sleep(30)

def run_workflow(email_message=None):
`;
    }

    case 'trigger-file': {
      const folder = f(d, 'folder', './data');
      const ext = f(d, 'extension', '.xlsx');
      return `# ── Trigger: File Watcher ──────────────────────────────────────
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

class FileHandler(FileSystemEventHandler):
    def on_created(self, event):
        if event.is_directory: return
        if "${ext}" == "Any" or event.src_path.endswith("${ext}"):
            print(f"📁 New file: {event.src_path}")
            run_workflow(event.src_path)

def start_watcher():
    observer = Observer()
    observer.schedule(FileHandler(), "${folder}", recursive=${fb(d,'recursive') ? 'True' : 'False'})
    observer.start()
    print("👀 Watching ${folder} ...")
    try:
        import time
        while True: time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()

def run_workflow(file_path=None):
`;
    }

    // ── FLOW CONTROL ──────────────────────────────────────────────────────
    case 'flow-if-else': {
      const left = f(d, 'variable', 'data["Status"]');
      const op = f(d, 'operator', '==');
      const right = f(d, 'value', '"Active"');
      const pyOp: Record<string,string> = {
        'contains': 'in', 'starts with': '.startswith', 'ends with': '.endswith',
        'is empty': '== ""', 'is not empty': '!= ""',
      };
      const condition = ['contains','starts with','ends with','is empty','is not empty'].includes(op)
        ? (op === 'contains' ? `${right} in ${left}` : `${left}${pyOp[op] || op}`)
        : `${left} ${op} ${right}`;
      return `${customBlock}${i}# ── If / Else ─────────────────────────────────────────────
${i}if ${condition}:
${i}    print("✅ Condition TRUE")
${i}    pass  # ← TRUE branch
${i}else:
${i}    print("❌ Condition FALSE")
${i}    pass  # ← FALSE branch
`;
    }

    case 'flow-switch': {
      const variable = f(d, 'variable', 'data["category"]');
      const rawCases = f(d, 'cases', 'Case A, Case B, Default');
      const cases = rawCases.split(',').map(c => c.trim()).filter(Boolean);
      const branches = cases.slice(0, -1).map((c, i) =>
        `${i === 0 ? `${i}    if` : `${i}    elif`} ${variable} == "${c}":
${i}        print("Branch: ${c}")
${i}        pass`
      ).join('\n');
      const defaultCase = `${i}    else:  # ${cases[cases.length - 1] || 'Default'}
${i}        print("Default branch")
${i}        pass`;
      return `${customBlock}${i}# ── Switch / Case ─────────────────────────────────────────
${i}# Variable: ${variable}
${branches}
${defaultCase}
`;
    }

    case 'flow-foreach': {
      const src = f(d, 'source', 'df');
      const item = f(d, 'itemVar', 'row');
      const idx = f(d, 'indexVar', 'idx');
      const batch = fn(d, 'batchSize', 0);
      if (batch > 0) {
        return `${customBlock}${i}# ── For Each Item (Batched, size=${batch}) ─────────────────
${i}import itertools
${i}def _batches(lst, n):
${i}    lst = list(lst)
${i}    for k in range(0, len(lst), n): yield lst[k:k+n]

${i}results = []
${i}for batch_idx, batch in enumerate(_batches(${src}.to_dict("records"), ${batch})):
${i}    print(f"🔁 Processing batch {batch_idx+1}, size={len(batch)}")
${i}    for ${idx}, ${item} in enumerate(batch):
${i}        # Process ${item}
${i}        results.append(${item})
${i}print(f"✅ Processed {len(results)} items in batches of ${batch}")
`;
      }
      return `${customBlock}${i}# ── For Each Item ─────────────────────────────────────────
${i}results = []
${i}for ${idx}, ${item} in ${src}.iterrows():
${i}    ${item} = ${item}.to_dict()
${i}    # ← process ${item} here
${i}    results.append(${item})
${i}print(f"🔁 Processed {len(results)} items")
`;
    }

    case 'flow-while': {
      const cond = f(d, 'condition', 'retries < 5 and not success');
      const maxIter = fn(d, 'maxIter', 100);
      const sleepSec = fn(d, 'sleepSec', 0);
      return `${customBlock}${i}# ── While Loop ────────────────────────────────────────────
${i}retries = 0
${i}success = False
${i}_iterations = 0
${i}while (${cond}) and _iterations < ${maxIter}:
${i}    _iterations += 1
${i}    print(f"🔄 Iteration {_iterations}")
${i}    try:
${i}        # ← loop body here
${i}        success = True
${i}        break
${i}    except Exception as _e:
${i}        retries += 1
${i}        print(f"⚠️  Error: {_e}")
${sleepSec > 0 ? `${i}    import time; time.sleep(${sleepSec})\n` : ''}`;
    }

    case 'flow-repeat': {
      const count = fn(d, 'count', 10);
      const idxVar = f(d, 'indexVar', 'i');
      const sleepSec = fn(d, 'sleepSec', 0);
      return `${customBlock}${i}# ── Repeat ${count} Times ────────────────────────────────────
${i}for ${idxVar} in range(${count}):
${i}    print(f"🔢 Run {${idxVar}+1} / ${count}")
${i}    # ← body here
${sleepSec > 0 ? `${i}    import time; time.sleep(${sleepSec})\n` : ''}`;
    }

    case 'flow-trycatch': {
      const retries = fn(d, 'retries', 3);
      const delay = fn(d, 'retryDelay', 2);
      return `${customBlock}${i}# ── Try / Catch ───────────────────────────────────────────
${i}import time as _time
${i}_max_retries = ${retries}
${i}for _attempt in range(_max_retries):
${i}    try:
${i}        # ← protected code here
${i}        break  # success
${i}    except Exception as _err:
${i}        print(f"⚠️  Attempt {_attempt+1}/{_max_retries} failed: {_err}")
${i}        if _attempt < _max_retries - 1:
${i}            _time.sleep(${delay})
${i}        else:
${i}            raise RuntimeError(f"All ${retries} attempts failed: {_err}")
`;
    }

    case 'flow-delay': {
      const amount = fn(d, 'amount', 5);
      const unit = f(d, 'unit', 'seconds');
      const secMap: Record<string,number> = { seconds: 1, minutes: 60, hours: 3600 };
      const totalSec = amount * (secMap[unit] || 1);
      return `${customBlock}${i}# ── Delay: ${amount} ${unit} ─────────────────────────────────────
${i}import time
${i}print(f"⏳ Waiting ${amount} ${unit}...")
${i}time.sleep(${totalSec})
`;
    }

    // ── DATA & FILES ──────────────────────────────────────────────────────
    case 'data-read-excel': {
      const path = f(d, 'path', 'input.xlsx');
      const sheet = f(d, 'sheet', 'Sheet1');
      const header = fn(d, 'header', 0);
      const maxRows = fn(d, 'maxRows', 0);
      return `${customBlock}${i}# ── Read Excel ─────────────────────────────────────────────
${i}import pandas as pd

${i}df = pd.read_excel(
${i}    "${path}",
${i}    sheet_name="${sheet}",
${i}    header=${header},${maxRows > 0 ? `\n${i}    nrows=${maxRows},` : ''}
${i})
${i}print(f"📊 Loaded {len(df)} rows × {len(df.columns)} cols from '${path}'")
${i}print(df.dtypes)
`;
    }

    case 'data-write-excel': {
      const path = f(d, 'path', 'output.xlsx');
      const sheet = f(d, 'sheet', 'Results');
      const autofit = fb(d, 'autofit', true);
      const addTs = fb(d, 'addTimestamp', false);
      return `${customBlock}${i}# ── Write Excel ────────────────────────────────────────────
${i}from openpyxl.utils import get_column_letter
${addTs ? `${i}from datetime import datetime\n${i}_ts = datetime.now().strftime("%Y%m%d_%H%M%S")\n${i}_out_path = f"${path.replace('.xlsx','')}_{'{_ts}'}.xlsx"\n` : `${i}_out_path = "${path}"\n`}
${i}with pd.ExcelWriter(_out_path, engine="openpyxl") as _writer:
${i}    df.to_excel(_writer, sheet_name="${sheet}", index=False)
${autofit ? `${i}    _ws = _writer.sheets["${sheet}"]\n${i}    for _col in _ws.columns:\n${i}        _ws.column_dimensions[get_column_letter(_col[0].column)].width = max(len(str(c.value or "")) for c in _col) + 4\n` : ''}
${i}print(f"💾 Saved {len(df)} rows → {_out_path}")
`;
    }

    case 'data-read-csv': {
      const path = f(d, 'path', 'data.csv');
      const delim = f(d, 'delimiter', ',');
      const enc = f(d, 'encoding', 'utf-8');
      const skip = fb(d, 'skipBad', true);
      const delimPy = delim === 'Tab' ? '\\t' : (delim === 'auto-detect' ? 'None' : delim);
      return `${customBlock}${i}# ── Read CSV ───────────────────────────────────────────────
${i}df = pd.read_csv(
${i}    "${path}",
${i}    sep="${delimPy}",
${i}    encoding="${enc}",
${i}    on_bad_lines="${skip ? 'skip' : 'error'}",
${delim === 'auto-detect' ? `${i}    engine="python",\n` : ''}${i})
${i}print(f"📋 Loaded {len(df)} rows from '${path}'")
`;
    }

    case 'data-write-csv': {
      const path = f(d, 'path', 'output.csv');
      const delim = f(d, 'delimiter', ',');
      const incIdx = fb(d, 'includeIndex', false);
      return `${customBlock}${i}# ── Write CSV ──────────────────────────────────────────────
${i}df.to_csv("${path}", sep="${delim === 'Tab' ? '\\t' : delim}", index=${incIdx ? 'True' : 'False'}, encoding="utf-8-sig")
${i}print(f"📄 Exported {len(df)} rows → '${path}'")
`;
    }

    case 'data-filter': {
      const col = f(d, 'column', 'Status');
      const op = f(d, 'operator', '==');
      const val = f(d, 'value', 'Active');
      const cs = fb(d, 'caseSensitive', false);
      const filterMap: Record<string, string> = {
        '==': `df["${col}"] == "${val}"`,
        '!=': `df["${col}"] != "${val}"`,
        '>': `df["${col}"] > ${val}`,
        '<': `df["${col}"] < ${val}`,
        '>=': `df["${col}"] >= ${val}`,
        '<=': `df["${col}"] <= ${val}`,
        'contains': `df["${col}"].str.contains("${val}", case=${cs}, na=False)`,
        'not contains': `~df["${col}"].str.contains("${val}", case=${cs}, na=False)`,
        'starts with': `df["${col}"].str.startswith("${val}")`,
        'ends with': `df["${col}"].str.endswith("${val}")`,
        'is null': `df["${col}"].isna()`,
        'is not null': `df["${col}"].notna()`,
        'regex match': `df["${col}"].str.match(r"${val}", case=${cs}, na=False)`,
      };
      const mask = filterMap[op] || `df["${col}"] == "${val}"`;
      return `${customBlock}${i}# ── Filter Rows ────────────────────────────────────────────
${i}_before = len(df)
${i}df = df[${mask}].copy()
${i}print(f"🔍 Filter '${col} ${op} ${val}': {_before} → {len(df)} rows")
`;
    }

    case 'data-sort': {
      const col = f(d, 'column', 'Date');
      const asc = fb(d, 'ascending', false);
      const sec = f(d, 'secondary', '');
      const byCols = sec ? `["${col}", "${sec}"]` : `"${col}"`;
      return `${customBlock}${i}# ── Sort Data ──────────────────────────────────────────────
${i}df = df.sort_values(by=${byCols}, ascending=${asc ? 'True' : 'False'}).reset_index(drop=True)
${i}print(f"↕️  Sorted by '${col}'${sec ? `, '${sec}'` : ''} ({'asc' if ${asc ? 'True' : 'False'} else 'desc'})")
`;
    }

    case 'data-deduplicate': {
      const subset = f(d, 'subset', '');
      const keep = f(d, 'keep', 'first');
      const subsetArg = subset ? `subset=[${subset.split(',').map(c => `"${c.trim()}"`).join(', ')}], ` : '';
      return `${customBlock}${i}# ── Remove Duplicates ──────────────────────────────────────
${i}_before = len(df)
${i}df = df.drop_duplicates(${subsetArg}keep="${keep}").reset_index(drop=True)
${i}print(f"🗑️  Duplicates removed: {_before - len(df)} rows removed, {len(df)} remain")
`;
    }

    case 'data-vlookup': {
      const lookupValue  = f(d, 'lookupValue',  '');
      const lookupFile   = f(d, 'lookupFile',   'lookup.xlsx');
      const lookupSheet  = f(d, 'lookupSheet',  'Sheet1');
      const searchCol    = f(d, 'searchColumn', 'A');
      const returnCol    = f(d, 'returnColumn', 'B');
      const matchType    = f(d, 'matchType',    'Exact (FALSE)');
      const ifNotFound   = f(d, 'ifNotFound',   'Return empty string');
      const applyToCol   = f(d, 'applyToColumn','');
      const outputVar    = f(d, 'outputVar',    'vlookup_result');
      const isExact      = matchType.startsWith('Exact');
      const isXlsx       = lookupFile.endsWith('.xlsx') || lookupFile.endsWith('.xls');
      const colIsLetter  = (c: string) => /^[A-Za-z]$/.test(c.trim());
      const letterToIdx  = (c: string) => c.trim().toUpperCase().charCodeAt(0) - 65;
      const resolveCol   = (c: string) =>
        colIsLetter(c) ? `_tbl.columns[${letterToIdx(c)}]`
        : /^\d+$/.test(c.trim()) ? `_tbl.columns[${Number(c.trim()) - 1}]`
        : `"${c}"`;
      const searchColPy  = resolveCol(searchCol);
      const returnColPy  = resolveCol(returnCol);
      const lookupPy     = lookupValue.startsWith('{') && lookupValue.endsWith('}')
        ? lookupValue.slice(1, -1)
        : lookupValue === '' ? '_lookup_val' : `"${lookupValue}"`;
      const readCmd = isXlsx
        ? `pd.read_excel("${lookupFile}", sheet_name="${lookupSheet}")`
        : `pd.read_csv("${lookupFile}")`;
      const notFoundMap: Record<string,string> = {
        'Return empty string': '""', 'Return #N/A': '"#N/A"',
        'Return 0': '0', 'Raise error': 'None',
      };
      const notFoundVal  = notFoundMap[ifNotFound] || '""';
      const raiseOnMiss  = ifNotFound === 'Raise error';
      if (applyToCol) {
        return `${customBlock}${i}# ── VLOOKUP (apply to column) ──────────────────────────────
${i}_tbl = ${readCmd}
${i}_search_col = ${searchColPy}
${i}_return_col = ${returnColPy}
${i}_lookup_map = dict(zip(_tbl[_search_col].values, _tbl[_return_col].values))
${i}df["${outputVar}"] = df["${applyToCol}"].map(_lookup_map)${ifNotFound !== 'Raise error' ? `.fillna(${notFoundVal})` : ''}
${i}print(f"🔍 VLOOKUP '${applyToCol}' → '${outputVar}': {df['${outputVar}'].notna().sum()} matched of {len(df)}")
`;
      }
      const approxBlock = `_tbl_s = _tbl.sort_values(_search_col)
${i}_idx   = _tbl_s[_search_col].searchsorted(_lookup_val, side="right") - 1
${i}_match = _tbl_s.iloc[[_idx]] if 0 <= _idx < len(_tbl_s) else pd.DataFrame()`;
      return `${customBlock}${i}# ── VLOOKUP (single value) ─────────────────────────────────
${i}_tbl        = ${readCmd}
${i}_search_col = ${searchColPy}
${i}_return_col = ${returnColPy}
${i}_lookup_val = ${lookupPy}
${i}${isExact ? `_match = _tbl[_tbl[_search_col] == _lookup_val]` : approxBlock}
${i}if not _match.empty:
${i}    ${outputVar} = _match.iloc[0][_return_col]
${i}    print(f"🔍 VLOOKUP: {_lookup_val!r} → {${outputVar}!r}")
${i}else:
${raiseOnMiss
  ? `${i}    raise ValueError(f"VLOOKUP: value not found in column '${searchCol}'")`
  : `${i}    ${outputVar} = ${notFoundVal}\n${i}    print(f"⚠️  VLOOKUP: not found — returning ${notFoundVal}")`
}
`;
    }

    case 'data-pivot': {
      const idx = f(d, 'index', 'Category');
      const cols = f(d, 'columns', 'Month');
      const vals = f(d, 'values', 'Sales');
      const agg = f(d, 'aggFunc', 'sum');
      const fill = f(d, 'fillValue', '0');
      return `${customBlock}${i}# ── Pivot Table ────────────────────────────────────────────
${i}pivot = df.pivot_table(
${i}    index="${idx}", columns="${cols}", values="${vals}",
${i}    aggfunc="${agg}", fill_value=${fill}
${i})
${i}pivot.columns.name = None
${i}pivot = pivot.reset_index()
${i}print(f"📈 Pivot: {pivot.shape[0]} rows × {pivot.shape[1]} cols")
${i}print(pivot.head())
`;
    }

    case 'data-groupby': {
      const grpCol = f(d, 'groupCol', 'Category');
      const aggCol = f(d, 'aggCol', 'Amount');
      const aggFn = f(d, 'aggFunc', 'sum');
      const reset = fb(d, 'resetIndex', true);
      const cols = grpCol.split(',').map(c => `"${c.trim()}"`).join(', ');
      return `${customBlock}${i}# ── Group By ───────────────────────────────────────────────
${i}df_grouped = df.groupby([${cols}])["${aggCol}"].${aggFn}()${reset ? '.reset_index()' : ''}
${i}print(f"📦 Grouped: {len(df_grouped)} groups")
${i}print(df_grouped.head())
`;
    }

    // ── TRANSFORM ─────────────────────────────────────────────────────────
    case 'transform-string': {
      const col = f(d, 'column', 'Name');
      const op = f(d, 'operation', 'strip whitespace');
      const arg1 = f(d, 'arg1', '');
      const arg2 = f(d, 'arg2', '');
      const out = f(d, 'outputCol', '') || col;
      const opMap: Record<string, string> = {
        'uppercase': `df["${col}"].str.upper()`,
        'lowercase': `df["${col}"].str.lower()`,
        'title case': `df["${col}"].str.title()`,
        'strip whitespace': `df["${col}"].str.strip()`,
        'strip left': `df["${col}"].str.lstrip()`,
        'strip right': `df["${col}"].str.rstrip()`,
        'replace': `df["${col}"].str.replace("${arg1}", "${arg2}", regex=False)`,
        'split': `df["${col}"].str.split("${arg1}")`,
        'truncate': `df["${col}"].str[:${arg1 || 100}]`,
      };
      const expr = opMap[op] || `df["${col}"].str.strip()`;
      return `${customBlock}${i}# ── String: ${op} ──────────────────────────────────────────
${i}df["${out}"] = ${expr}
${i}print(f"✏️  Applied '${op}' to '${col}' → '${out}'")
`;
    }

    case 'transform-regex': {
      const col = f(d, 'column', 'Text');
      const pattern = f(d, 'pattern', '\d+');
      const mode = f(d, 'mode', 'find all matches');
      const repl = f(d, 'replacement', '');
      const flags = f(d, 'flags', 'none');
      const outCol = f(d, 'outputCol', 'matches');
      const flagMap: Record<string, string> = {
        'none': '', 'ignore case': ', re.IGNORECASE',
        'multiline': ', re.MULTILINE', 'dotall': ', re.DOTALL',
      };
      const flag = flagMap[flags] || '';
      const modeMap: Record<string, string> = {
        'find all matches': `df["${col}"].str.findall(r"${pattern}"${flag})`,
        'test (true/false)': `df["${col}"].str.contains(r"${pattern}"${flag}, na=False)`,
        'extract group 1': `df["${col}"].str.extract(r"(${pattern})"${flag})[0]`,
        'replace': `df["${col}"].str.replace(r"${pattern}", "${repl}"${flag}, regex=True)`,
        'split on pattern': `df["${col}"].str.split(r"${pattern}"${flag})`,
      };
      const expr = modeMap[mode] || `df["${col}"].str.findall(r"${pattern}")`;
      return `${customBlock}${i}# ── Regex: ${mode} ─────────────────────────────────────────
${i}import re
${i}df["${outCol}"] = ${expr}
${i}print(f"🔎 Regex '${pattern}' applied to '${col}' → '${outCol}'")
`;
    }

    case 'transform-json': {
      const op = f(d, 'operation', 'parse string → object');
      const src = f(d, 'source', 'raw_json');
      const path = f(d, 'path', '$.items');
      const outVar = f(d, 'outputVar', 'result');
      const val = f(d, 'value', '');
      const opCode: Record<string, string> = {
        'parse string → object': `import json\n${i}${outVar} = json.loads(${src})`,
        'stringify → string': `import json\n${i}${outVar} = json.dumps(${src}, indent=2, ensure_ascii=False)`,
        'get path (JSONPath)': `from jsonpath_ng import parse as _jp\n${i}${outVar} = [m.value for m in _jp("${path}").find(${src})]`,
        'merge objects': `${outVar} = {**${src}, **${val || '{}'}}`,
        'flatten': `import pandas as pd\n${i}${outVar} = pd.json_normalize(${src})`,
        'array filter': `${outVar} = [x for x in ${src} if x]`,
        'array map': `${outVar} = [str(x) for x in ${src}]`,
      };
      return `${customBlock}${i}# ── JSON: ${op} ────────────────────────────────────────────
${i}${opCode[op] || `import json\n${i}${outVar} = json.loads(${src})`}
${i}print(f"🔷 JSON op '${op}' → {type(${outVar}).__name__}")
`;
    }

    case 'transform-number': {
      const col = f(d, 'column', 'Amount');
      const op = f(d, 'operation', 'sum');
      const arg = fn(d, 'arg', 1);
      const dec = fn(d, 'decimals', 2);
      const outCol = f(d, 'outputCol', 'result');
      const opMap: Record<string, string> = {
        'sum': `df["${col}"].sum()`,
        'average': `df["${col}"].mean()`,
        'count': `df["${col}"].count()`,
        'max': `df["${col}"].max()`,
        'min': `df["${col}"].min()`,
        'round': `df["${col}"].round(${dec})`,
        'floor': `df["${col}"].apply(lambda x: int(x))`,
        'ceil': `df["${col}"].apply(lambda x: -int(-x))`,
        'abs': `df["${col}"].abs()`,
        'sqrt': `df["${col}"].apply(lambda x: x ** 0.5)`,
        'multiply by': `df["${col}"] * ${arg}`,
        'divide by': `df["${col}"] / ${arg}`,
        'add': `df["${col}"] + ${arg}`,
        'subtract': `df["${col}"] - ${arg}`,
        'modulo': `df["${col}"] % ${arg}`,
        'power': `df["${col}"] ** ${arg}`,
        'percentage of total': `(df["${col}"] / df["${col}"].sum()) * 100`,
        'cumulative sum': `df["${col}"].cumsum()`,
        'rolling average': `df["${col}"].rolling(window=${arg}).mean()`,
        'z-score': `(df["${col}"] - df["${col}"].mean()) / df["${col}"].std()`,
      };
      const expr = opMap[op] || `df["${col}"].sum()`;
      const isScalar = ['sum','average','count','max','min'].includes(op);
      return `${customBlock}${i}# ── Number: ${op} ──────────────────────────────────────────
${isScalar
  ? `${i}${outCol} = ${expr}\n${i}print(f"🔢 ${op}('${col}') = {${outCol}:,.${dec}f}")`
  : `${i}df["${outCol}"] = ${expr}\n${i}print(f"🔢 Applied '${op}' to '${col}' → '${outCol}'")`}
`;
    }

    case 'transform-boolean': {
      const op = f(d, 'operation', 'AND');
      const left = f(d, 'leftExpr', '');
      const right = f(d, 'rightExpr', '');
      const outCol = f(d, 'outputCol', 'bool_result');
      const opCode: Record<string, string> = {
        'AND': `(${left}) & (${right})`,
        'OR': `(${left}) | (${right})`,
        'NOT': `~(${left})`,
        'XOR': `(${left}) ^ (${right})`,
        'is null': `df["${left}"].isna()`,
        'is not null': `df["${left}"].notna()`,
        'is numeric': `pd.to_numeric(df["${left}"], errors="coerce").notna()`,
        'is string': `df["${left}"].apply(lambda x: isinstance(x, str))`,
        'coerce to bool': `df["${left}"].astype(bool)`,
        'all true in column': `df["${left}"].all()`,
        'any true in column': `df["${left}"].any()`,
      };
      const expr = opCode[op] || `(${left}) & (${right})`;
      return `${customBlock}${i}# ── Boolean: ${op} ─────────────────────────────────────────
${i}df["${outCol}"] = ${expr}
${i}print(f"⚡ Boolean '${op}' → '${outCol}': {df['${outCol}'].sum()} True values")
`;
    }

    case 'transform-template': {
      const tmpl = f(d, 'template', 'Hello {Name}!');
      const outVar = f(d, 'outputVar', 'message');
      const perRow = fb(d, 'applyToEachRow', true);
      return `${customBlock}${i}# ── Template ───────────────────────────────────────────────
${i}TEMPLATE = """${tmpl}"""
${perRow
  ? `${i}df["${outVar}"] = df.apply(lambda row: TEMPLATE.format(**row.to_dict()), axis=1)`
  : `${i}${outVar} = TEMPLATE.format(**locals())`}
${i}print(f"📝 Template applied → '${outVar}'")
`;
    }

    case 'transform-math-formula': {
      const formula = f(d, 'formula', 'df["Total"] = df["Price"] * df["Qty"]');
      return `${customBlock}${i}# ── Custom Formula ─────────────────────────────────────────
${i}${formula.split('\n').join(`\n${i}`)}
${i}print("🧮 Custom formula applied")
`;
    }

    // ── SEND & NOTIFY ─────────────────────────────────────────────────────
    case 'send-email': {
      const to = f(d, 'to', '');
      const cc = f(d, 'cc', '');
      const subj = f(d, 'subject', 'Notification');
      const body = f(d, 'body', '');
      const bodyType = f(d, 'bodyType', 'plain');
      const host = f(d, 'smtpHost', 'smtp.gmail.com');
      const port = fn(d, 'smtpPort', 587);
      return `${customBlock}${i}# ── Send Email ─────────────────────────────────────────────
${i}import smtplib
${i}from email.mime.multipart import MIMEMultipart
${i}from email.mime.text import MIMEText

${i}_email_to = "${to}"
${i}_email_subject = f"${subj}"
${i}_email_body = f"""${body}"""

${i}_msg = MIMEMultipart()
${i}_msg["From"] = SMTP_USER     # set in env: SMTP_USER
${i}_msg["To"] = _email_to
${i}_msg["Subject"] = _email_subject
${cc ? `${i}_msg["CC"] = "${cc}"\n` : ''}${i}_msg.attach(MIMEText(_email_body, "${bodyType}"))

${i}with smtplib.SMTP("${host}", ${port}) as _smtp:
${i}    _smtp.starttls()
${i}    _smtp.login(SMTP_USER, SMTP_PASSWORD)  # set in env
${i}    _smtp.send_message(_msg)
${i}print(f"📧 Email sent to {_email_to}: {_email_subject}")
`;
    }

    case 'send-email-attachment': {
      const to = f(d, 'to', '');
      const subj = f(d, 'subject', 'Report');
      const body = f(d, 'body', '');
      const attach = f(d, 'attachFile', 'output.xlsx');
      return `${customBlock}${i}# ── Email with Attachment ──────────────────────────────────
${i}import smtplib, os
${i}from email.mime.multipart import MIMEMultipart
${i}from email.mime.text import MIMEText
${i}from email.mime.base import MIMEBase
${i}from email import encoders

${i}_msg = MIMEMultipart()
${i}_msg["From"] = SMTP_USER
${i}_msg["To"] = "${to}"
${i}_msg["Subject"] = "${subj}"
${i}_msg.attach(MIMEText("""${body}""", "plain"))

${i}with open("${attach}", "rb") as _f:
${i}    _part = MIMEBase("application", "octet-stream")
${i}    _part.set_payload(_f.read())
${i}    encoders.encode_base64(_part)
${i}    _part.add_header("Content-Disposition", f'attachment; filename="{attach}"')
${i}    _msg.attach(_part)

${i}with smtplib.SMTP("smtp.gmail.com", 587) as _smtp:
${i}    _smtp.starttls()
${i}    _smtp.login(SMTP_USER, SMTP_PASSWORD)
${i}    _smtp.send_message(_msg)
${i}print(f"📎 Email + attachment '${attach}' sent to '${to}'")
`;
    }

    case 'send-whatsapp': {
      const to = f(d, 'to', '');
      const msg = f(d, 'message', '');
      const fromNum = f(d, 'fromNumber', '+14155238886');
      return `${customBlock}${i}# ── WhatsApp Message (Twilio) ──────────────────────────────
${i}from twilio.rest import Client

${i}_wa_message = f"""${msg}"""
${i}_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)  # set in env
${i}_client.messages.create(
${i}    body=_wa_message,
${i}    from_="whatsapp:${fromNum}",
${i}    to="whatsapp:${to}"
${i})
${i}print(f"💬 WhatsApp sent to ${to}")
`;
    }

    case 'send-slack': {
      const channel = f(d, 'channel', '#general');
      const msg = f(d, 'message', '');
      const user = f(d, 'username', 'Workflow Bot');
      return `${customBlock}${i}# ── Slack Message ──────────────────────────────────────────
${i}import requests

${i}_slack_payload = {
${i}    "channel": "${channel}",
${i}    "text": f"""${msg}""",
${i}    "username": "${user}",
${i}}
${i}_r = requests.post(
${i}    "https://slack.com/api/chat.postMessage",
${i}    json=_slack_payload,
${i}    headers={"Authorization": f"Bearer {SLACK_BOT_TOKEN}"}  # set in env
${i})
${i}print(f"🟣 Slack → '${channel}': {_r.json().get('ok')}")
`;
    }

    case 'send-telegram': {
      const chatId = f(d, 'chatId', '');
      const msg = f(d, 'message', '');
      const parseMode = f(d, 'parseMode', 'Markdown');
      return `${customBlock}${i}# ── Telegram Message ───────────────────────────────────────
${i}import requests
${i}_tg_url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
${i}_r = requests.post(_tg_url, json={
${i}    "chat_id": "${chatId}",
${i}    "text": f"""${msg}""",
${i}    "parse_mode": "${parseMode}",
${i}})
${i}print(f"✈️  Telegram → ${chatId}: {_r.json().get('ok')}")
`;
    }

    case 'send-sms': {
      const to = f(d, 'to', '');
      const msg = f(d, 'message', '');
      return `${customBlock}${i}# ── SMS (Twilio) ───────────────────────────────────────────
${i}from twilio.rest import Client
${i}_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
${i}_client.messages.create(body="${msg}", from_=TWILIO_PHONE, to="${to}")
${i}print(f"📱 SMS sent to ${to}")
`;
    }

    case 'send-webhook': {
      const url = f(d, 'url', '');
      const payload = f(d, 'payload', '{}');
      return `${customBlock}${i}# ── Outgoing Webhook ───────────────────────────────────────
${i}import requests, json
${i}_wh_payload = ${payload}
${i}_r = requests.post("${url}", json=_wh_payload, timeout=10)
${i}_r.raise_for_status()
${i}print(f"⚡ Webhook POST → '${url}': {_r.status_code}")
`;
    }

    // ── EXTERNAL & API ────────────────────────────────────────────────────
    case 'external-http': {
      const method = f(d, 'method', 'GET');
      const url = f(d, 'url', '');
      const headers = f(d, 'headers', '{"Content-Type": "application/json"}');
      const body = f(d, 'body', '');
      const auth = f(d, 'auth', 'none');
      const authVal = f(d, 'authValue', '');
      const timeout = fn(d, 'timeout', 30);
      const retries = fn(d, 'retries', 2);
      const authLine = auth === 'Bearer Token' ? `\n${i}_headers["Authorization"] = f"Bearer ${authVal || '{API_TOKEN}'}"` : '';
      const bodyArg = body && method !== 'GET' ? `, json=${body}` : '';
      return `${customBlock}${i}# ── HTTP ${method} Request ────────────────────────────────────────
${i}import requests
${i}from requests.adapters import HTTPAdapter, Retry

${i}_headers = ${headers}${authLine}
${i}_session = requests.Session()
${i}_session.mount("https://", HTTPAdapter(max_retries=Retry(total=${retries}, backoff_factor=1)))

${i}_response = _session.${method.toLowerCase()}(
${i}    "${url}",
${i}    headers=_headers,${bodyArg}
${i}    timeout=${timeout},
${i})
${i}_response.raise_for_status()
${i}response_data = _response.json()
${i}print(f"🌐 ${method} '${url}' → {_response.status_code}")
`;
    }

    case 'external-graphql': {
      const endpoint = f(d, 'endpoint', '');
      const query = f(d, 'query', '');
      const variables = f(d, 'variables', '{}');
      return `${customBlock}${i}# ── GraphQL Query ──────────────────────────────────────────
${i}import requests

${i}_gql_response = requests.post(
${i}    "${endpoint}",
${i}    json={"query": """${query}""", "variables": ${variables}},
${i}    headers={"Authorization": f"Bearer {GQL_TOKEN}", "Content-Type": "application/json"},
${i})
${i}_gql_response.raise_for_status()
${i}gql_data = _gql_response.json().get("data", {})
${i}print(f"🔗 GraphQL → {list(gql_data.keys())}")
`;
    }

    case 'external-database': {
      const conn = f(d, 'connection', 'sqlite:///data.db');
      const query = f(d, 'query', 'SELECT * FROM table');
      const retAs = f(d, 'returnAs', 'DataFrame');
      const dialect = f(d, 'dialect', 'SQLite');
      const pkgs: Record<string,string> = { PostgreSQL: 'psycopg2', MySQL: 'pymysql', MSSQL: 'pyodbc', Oracle: 'cx_Oracle' };
      const pkg = pkgs[dialect] || '';
      return `${customBlock}${i}# ── Database Query (${dialect}) ──────────────────────────────
${i}import sqlalchemy${pkg ? `, ${pkg}` : ''}
${i}import pandas as pd

${i}_engine = sqlalchemy.create_engine("${conn}")
${i}_query = """
${i}${query}
${i}"""
${retAs === 'DataFrame' ? `${i}df = pd.read_sql(_query, _engine)\n${i}print(f"🗃️  Query → {len(df)} rows × {len(df.columns)} cols")` :
  retAs === 'single value' ? `${i}with _engine.connect() as _c:\n${i}    db_result = _c.execute(sqlalchemy.text(_query)).scalar()\n${i}print(f"🗃️  Query → {db_result}")` :
  `${i}with _engine.connect() as _c:\n${i}    db_result = [dict(r) for r in _c.execute(sqlalchemy.text(_query))]\n${i}print(f"🗃️  Query → {len(db_result)} rows")`}
`;
    }

    case 'external-google-sheets': {
      const op = f(d, 'operation', 'read range');
      const sid = f(d, 'spreadsheetId', '');
      const range = f(d, 'range', 'Sheet1!A:Z');
      return `${customBlock}${i}# ── Google Sheets: ${op} ───────────────────────────────────
${i}from googleapiclient.discovery import build
${i}from google.oauth2.service_account import Credentials

${i}_creds = Credentials.from_service_account_file("service_account.json", scopes=["https://www.googleapis.com/auth/spreadsheets"])
${i}_service = build("sheets", "v4", credentials=_creds)
${i}_sheets = _service.spreadsheets()
${op === 'read range' ? `
${i}_result = _sheets.values().get(spreadsheetId="${sid}", range="${range}").execute()
${i}_values = _result.get("values", [])
${i}import pandas as pd
${i}df = pd.DataFrame(_values[1:], columns=_values[0])
${i}print(f"📊 Google Sheets read: {len(df)} rows")` :
op === 'append rows' ? `
${i}_sheets.values().append(
${i}    spreadsheetId="${sid}", range="${range}",
${i}    valueInputOption="USER_ENTERED",
${i}    body={"values": df.values.tolist()}
${i}).execute()
${i}print(f"📊 Appended {len(df)} rows to Google Sheets")` :
`${i}_sheets.values().update(
${i}    spreadsheetId="${sid}", range="${range}",
${i}    valueInputOption="USER_ENTERED",
${i}    body={"values": [df.columns.tolist()] + df.values.tolist()}
${i}).execute()
${i}print(f"📊 Written {len(df)} rows to Google Sheets")`}
`;
    }

    // ── AI & AGENTS ───────────────────────────────────────────────────────
    case 'ai-completion': {
      const provider = f(d, 'provider', 'OpenAI');
      const model = f(d, 'model', 'gpt-4o');
      const sys = f(d, 'systemPrompt', 'You are a helpful assistant.');
      const usr = f(d, 'userPrompt', 'Process: {data}');
      const temp = fn(d, 'temperature', 0);
      const maxTok = fn(d, 'maxTokens', 1000);
      const outVar = f(d, 'outputVar', 'ai_response');
      if (provider === 'Anthropic (Claude)') {
        return `${customBlock}${i}# ── AI Completion (Anthropic Claude) ───────────────────────
${i}import anthropic

${i}_anthropic = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
${i}_user_msg = f"""${usr}"""
${i}_completion = _anthropic.messages.create(
${i}    model="${model}",
${i}    max_tokens=${maxTok},
${i}    system="${sys}",
${i}    messages=[{"role": "user", "content": _user_msg}],
${i})
${i}${outVar} = _completion.content[0].text
${i}print(f"🤖 Claude response: {${outVar}[:100]}...")
`;
      }
      return `${customBlock}${i}# ── AI Completion (${provider}) ────────────────────────────
${i}from openai import OpenAI

${i}_ai_client = OpenAI(api_key=OPENAI_API_KEY)
${i}_user_msg = f"""${usr}"""
${i}_completion = _ai_client.chat.completions.create(
${i}    model="${model}",
${i}    temperature=${temp},
${i}    max_tokens=${maxTok},
${i}    messages=[
${i}        {"role": "system", "content": "${sys}"},
${i}        {"role": "user", "content": _user_msg},
${i}    ],
${i})
${i}${outVar} = _completion.choices[0].message.content
${i}print(f"✨ AI response: {${outVar}[:100]}...")
`;
    }

    case 'ai-email-agent': {
      const provider = f(d, 'provider', 'OpenAI');
      const model = f(d, 'model', 'gpt-4o');
      const instr = f(d, 'agentInstructions', '');
      const outVar = f(d, 'outputVar', 'email_result');
      const autoReply = fb(d, 'autoreply', false);
      return `${customBlock}${i}# ── Email AI Agent ─────────────────────────────────────────
${i}from openai import OpenAI
${i}import json

${i}_ai_client = OpenAI(api_key=OPENAI_API_KEY)

${i}EMAIL_AGENT_TOOLS = [
${i}    {
${i}        "type": "function",
${i}        "function": {
${i}            "name": "extract_data",
${i}            "description": "Extract structured information from the email",
${i}            "parameters": {
${i}                "type": "object",
${i}                "properties": {
${i}                    "category": {"type": "string", "enum": ["Invoice", "Support", "Sales Lead", "Other"]},
${i}                    "priority": {"type": "string", "enum": ["high", "medium", "low"]},
${i}                    "extracted_data": {"type": "object"},
${i}                    "suggested_reply": {"type": "string"},
${i}                    "action": {"type": "string", "enum": ["reply", "forward", "archive", "escalate"]},
${i}                },
${i}                "required": ["category", "priority", "action"],
${i}            },
${i}        },
${i}    }
${i}]

${i}def email_agent(email_subject: str, email_body: str, sender: str) -> dict:
${i}    """AI agent that reads an email and decides what to do."""
${i}    _msg = f"From: {sender}\\nSubject: {email_subject}\\n\\n{email_body}"
${i}    _resp = _ai_client.chat.completions.create(
${i}        model="${model}",
${i}        messages=[
${i}            {"role": "system", "content": """${instr}"""},
${i}            {"role": "user", "content": _msg},
${i}        ],
${i}        tools=EMAIL_AGENT_TOOLS,
${i}        tool_choice="required",
${i}    )
${i}    _tool_call = _resp.choices[0].message.tool_calls[0]
${i}    return json.loads(_tool_call.function.arguments)

${i}# Run agent on email_message from trigger
${i}if "email_message" in dir():
${i}    _subj = email_message.get("Subject", "")
${i}    _body = email_message.get_payload(decode=True).decode("utf-8", errors="ignore") if email_message.get_payload() else ""
${i}    _from = email_message.get("From", "")
${i}    ${outVar} = email_agent(_subj, _body, _from)
${i}    print(f"🤖 Email Agent: category={${outVar}.get('category')}, action={${outVar}.get('action')}")
${autoReply ? `
${i}    if ${outVar}.get("action") == "reply" and ${outVar}.get("suggested_reply"):
${i}        # TODO: send reply via SMTP
${i}        print(f"📧 Auto-reply: {${outVar}.get('suggested_reply')[:80]}...")
` : ''}`;
    }

    case 'ai-extract': {
      const inputVar = f(d, 'inputVar', 'raw_text');
      const schema = f(d, 'schema', '{"name": "string", "amount": "number"}');
      const model = f(d, 'model', 'gpt-4o');
      const outVar = f(d, 'outputVar', 'extracted');
      return `${customBlock}${i}# ── AI Data Extractor ──────────────────────────────────────
${i}from openai import OpenAI
${i}import json

${i}_ai_client = OpenAI(api_key=OPENAI_API_KEY)
${i}_extract_schema = ${schema}
${i}_extract_prompt = f"""Extract the following fields as JSON from the text below.
${i}Schema: {json.dumps(_extract_schema)}
${i}Text: {${inputVar}}
${i}Return ONLY valid JSON, nothing else."""

${i}_resp = _ai_client.chat.completions.create(
${i}    model="${model}", temperature=0,
${i}    messages=[{"role": "user", "content": _extract_prompt}],
${i}    response_format={"type": "json_object"},
${i})
${i}${outVar} = json.loads(_resp.choices[0].message.content)
${i}print(f"🔍 Extracted: {list(${outVar}.keys())}")
`;
    }

    case 'ai-summarize': {
      const inputVar = f(d, 'inputVar', 'document');
      const style = f(d, 'style', 'bullet points');
      const maxWords = fn(d, 'maxWords', 150);
      const model = f(d, 'model', 'gpt-4o');
      const outVar = f(d, 'outputVar', 'summary');
      return `${customBlock}${i}# ── AI Summarize ───────────────────────────────────────────
${i}from openai import OpenAI
${i}_ai_client = OpenAI(api_key=OPENAI_API_KEY)
${i}_summary_resp = _ai_client.chat.completions.create(
${i}    model="${model}", temperature=0.3,
${i}    messages=[{
${i}        "role": "user",
${i}        "content": f"Summarize the following as ${style} in max ${maxWords} words:\\n\\n{${inputVar}}"
${i}    }],
${i})
${i}${outVar} = _summary_resp.choices[0].message.content
${i}print(f"📝 Summary: {${outVar}[:100]}...")
`;
    }

    case 'ai-classify': {
      const inputVar = f(d, 'inputVar', 'text');
      const cats = f(d, 'categories', 'Positive, Negative, Neutral');
      const applyCol = f(d, 'applyToColumn', '');
      const model = f(d, 'model', 'gpt-4o');
      const outVar = f(d, 'outputVar', 'label');
      if (applyCol) {
        return `${customBlock}${i}# ── AI Classify (bulk column) ──────────────────────────────
${i}from openai import OpenAI
${i}_ai_client = OpenAI(api_key=OPENAI_API_KEY)
${i}_categories = [${cats.split(',').map(c => `"${c.trim()}"`).join(', ')}]

${i}def _classify_text(text):
${i}    _r = _ai_client.chat.completions.create(
${i}        model="${model}", temperature=0,
${i}        messages=[{"role": "user", "content": f"Classify into one of {_categories}: {text}. Reply with only the category."}],
${i}    )
${i}    return _r.choices[0].message.content.strip()

${i}df["${outVar}"] = df["${applyCol}"].apply(_classify_text)
${i}print(f"🏷️  Classified {len(df)} rows: {df['${outVar}'].value_counts().to_dict()}")
`;
      }
      return `${customBlock}${i}# ── AI Classify (single text) ──────────────────────────────
${i}from openai import OpenAI
${i}_ai_client = OpenAI(api_key=OPENAI_API_KEY)
${i}_categories = [${cats.split(',').map(c => `"${c.trim()}"`).join(', ')}]
${i}_class_resp = _ai_client.chat.completions.create(
${i}    model="${model}", temperature=0,
${i}    messages=[{"role": "user", "content": f"Classify into one of {_categories}. Reply with only the label. Text: {${inputVar}}"}],
${i})
${i}${outVar} = _class_resp.choices[0].message.content.strip()
${i}print(f"🏷️  Classified as: {${outVar}}")
`;
    }

    // ── CODE & CUSTOM ─────────────────────────────────────────────────────
    case 'code-python': {
      const code = f(d, 'code', '# custom code');
      return `${customBlock}${i}# ── Custom Python Code ─────────────────────────────────────
${code.split('\n').map(l => `${i}${l}`).join('\n')}
`;
    }

    case 'code-javascript': {
      const code = f(d, 'code', '');
      const mode = f(d, 'mode', 'inline (subprocess)');
      const outVar = f(d, 'outputVar', 'js_result');
      if (mode === 'generate JS workflow file') {
        return `${customBlock}${i}# ── JavaScript (Node.js) ───────────────────────────────────
${i}# This generates a standalone Node.js file
${i}_js_code = """
${code}
${i}"""
${i}with open("workflow_step.js", "w") as _f:
${i}    _f.write(_js_code)
${i}print("📄 JavaScript saved to workflow_step.js — run with: node workflow_step.js")
`;
      }
      return `${customBlock}${i}# ── Inline JavaScript via subprocess ───────────────────────
${i}import subprocess, json

${i}_js_script = """
${code}
${i}"""
${i}_js_input = json.dumps({"df": df.to_dict("records") if "df" in dir() else {}})
${i}_proc = subprocess.run(
${i}    ["node", "-e", _js_script],
${i}    input=_js_input, capture_output=True, text=True, timeout=30
${i})
${i}if _proc.returncode != 0:
${i}    raise RuntimeError(f"JS error: {_proc.stderr}")
${i}${outVar} = json.loads(_proc.stdout) if _proc.stdout.strip() else None
${i}print(f"⚡ JS result: {str(${outVar})[:80]}")
`;
    }

    case 'code-set-variable': {
      const varName = f(d, 'varName', 'my_var');
      const vtype = f(d, 'valueType', 'string');
      const value = f(d, 'value', '');
      const pyVal = vtype === 'number' ? value
        : vtype === 'boolean' ? (value.toLowerCase() === 'true' ? 'True' : 'False')
        : vtype === 'JSON / object' ? value
        : vtype === 'Python expression' ? value
        : `"""${value}"""`;
      return `${customBlock}${i}# ── Set Variable ───────────────────────────────────────────
${i}${varName} = ${pyVal}
${i}print(f"📌 {${JSON.stringify(varName)}} = {${varName}}")
`;
    }

    case 'code-log': {
      const msg = f(d, 'message', '');
      const level = f(d, 'level', 'INFO');
      const logFile = f(d, 'logFile', '');
      const alsoP = fb(d, 'also_print', true);
      return `${customBlock}${i}# ── Log / Debug ────────────────────────────────────────────
${i}import logging as _logging
${i}_logger = _logging.getLogger("workflow")
${i}_log_msg = f"${msg}"
${i}_logger.${level.toLowerCase()}(_log_msg)
${alsoP ? `${i}print(f"[${level}] {_log_msg}")` : ''}
${logFile ? `${i}with open("${logFile}", "a") as _lf:\n${i}    from datetime import datetime\n${i}    _lf.write(f"{datetime.now().isoformat()} [${level}] {_log_msg}\\n")` : ''}
`;
    }

    case 'code-comment':
      return `${customBlock}${i}# ── Note ─────────────────────────────────────────────────
${i}# ${f(d, 'note', '').split('\n').join(`\n${i}# `)}
`;

    case 'end-success': {
      const msg = f(d, 'message', 'Workflow completed successfully!');
      const retVar = f(d, 'returnVar', '');
      return `${customBlock}${i}# ── End: Success ────────────────────────────────────────────
${i}print(f"🏁 ${msg}")
${retVar ? `${i}return ${retVar}` : ''}`;
    }

    case 'end-error': {
      const msg = f(d, 'message', 'Workflow failed.');
      const code = fn(d, 'code', 1);
      return `${customBlock}${i}# ── End: Error ──────────────────────────────────────────────
${i}import sys
${i}print(f"❌ ${msg}", file=sys.stderr)
${i}sys.exit(${code})
`;
    }

    default:
      return `${customBlock}${i}# ${nodeConfig.label}\n${i}print("▶️  Running: ${nodeConfig.label}")\n`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main entry point — topological sort then emit
// ─────────────────────────────────────────────────────────────────────────────
export function generatePythonCode(nodes: WFNode[], edges: Edge[]): string {
  if (nodes.length === 0) return '# Add nodes to your workflow to generate Python code.';

  // Topological sort
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const successors = new Map<string, string[]>();
  const inDeg = new Map<string, number>();
  nodes.forEach(n => { inDeg.set(n.id, 0); });
  edges.forEach(e => {
    if (!successors.has(e.source)) successors.set(e.source, []);
    successors.get(e.source)!.push(e.target);
    inDeg.set(e.target, (inDeg.get(e.target) || 0) + 1);
  });
  const queue = nodes.filter(n => (inDeg.get(n.id) || 0) === 0);
  const sorted: WFNode[] = [];
  const visited = new Set<string>();
  while (queue.length) {
    const n = queue.shift()!;
    if (visited.has(n.id)) continue;
    visited.add(n.id);
    sorted.push(n);
    (successors.get(n.id) || []).forEach(tid => {
      if (!visited.has(tid) && nodeMap.has(tid)) queue.push(nodeMap.get(tid)!);
    });
  }
  nodes.forEach(n => { if (!visited.has(n.id)) sorted.push(n); });

  const triggers = sorted.filter(n => n.data.nodeConfig.type === 'trigger');
  const body = sorted.filter(n => n.data.nodeConfig.type !== 'trigger');
  const workflowName = nodes[0]?.data.label || 'workflow';

  const header = `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
╔══════════════════════════════════════════════════════════════════╗
║  FlowBuilder — Auto-generated Workflow                          ║
║  Name    : ${workflowName.padEnd(52)}║
║  Nodes   : ${String(nodes.length).padEnd(52)}║
║  Generated: ${new Date().toLocaleString().padEnd(51)}║
╚══════════════════════════════════════════════════════════════════╝

Usage:
  pip install pandas openpyxl requests openai anthropic twilio watchdog flask
  python workflow.py

Environment variables (set in .env or your system):
  OPENAI_API_KEY, ANTHROPIC_API_KEY, SMTP_USER, SMTP_PASSWORD,
  TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE,
  SLACK_BOT_TOKEN, TELEGRAM_BOT_TOKEN
"""

import os, sys, re, json
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()  # reads .env file if present

# ── Environment Variables ──────────────────────────────────────────────────
OPENAI_API_KEY      = os.getenv("OPENAI_API_KEY", "")
ANTHROPIC_API_KEY   = os.getenv("ANTHROPIC_API_KEY", "")
SMTP_USER           = os.getenv("SMTP_USER", "")
SMTP_PASSWORD       = os.getenv("SMTP_PASSWORD", "")
TWILIO_ACCOUNT_SID  = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN   = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_PHONE        = os.getenv("TWILIO_PHONE", "")
SLACK_BOT_TOKEN     = os.getenv("SLACK_BOT_TOKEN", "")
TELEGRAM_BOT_TOKEN  = os.getenv("TELEGRAM_BOT_TOKEN", "")
EMAIL_USER          = os.getenv("EMAIL_USER", "")
EMAIL_PASSWORD      = os.getenv("EMAIL_PASSWORD", "")

`;

  let triggerCode = '';
  triggers.forEach(n => { triggerCode += genNode(n); });

  const hasTrigger = triggers.length > 0;
  const bodyCode = body.map(n => genNode(n)).join('\n');

  const runFn = hasTrigger
    ? `\n    ${bodyCode.replace(/\n/g, '\n')}`
    : `\ndef run_workflow():\n    """Main workflow — ${nodes.length} steps"""\n    print(f"🚀 Starting at {datetime.now():%Y-%m-%d %H:%M:%S}")\n\n    ${bodyCode.replace(/\n/g, '\n')}`;

  const footer = `\n\nif __name__ == "__main__":
    import logging
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    try:
        run_workflow()
    except KeyboardInterrupt:
        print("\\n⛔ Interrupted by user")
        sys.exit(0)
    except Exception as _exc:
        print(f"❌ Workflow failed: {_exc}", file=sys.stderr)
        raise
`;

  return header + triggerCode + runFn + footer;
}

export function generateJavaScriptCode(nodes: WFNode[], edges: Edge[]): string {
  if (nodes.length === 0) return '// Add nodes to generate JavaScript (Node.js) code.';

  const header = `#!/usr/bin/env node
/**
 * FlowBuilder — Auto-generated Node.js Workflow
 * ${nodes.length} steps · Generated ${new Date().toLocaleString()}
 *
 * npm install axios dotenv
 */

require("dotenv").config();
const axios = require("axios");
const fs = require("fs");
const path = require("path");

`;

  const steps = nodes.map((n, i) => {
    const { nodeConfig, fields = {} } = n.data;
    const label = n.data.label || nodeConfig.label;
    return `  // Step ${i + 1}: ${label}\n  console.log("▶️  ${label}");\n  // TODO: ${nodeConfig.description}\n`;
  }).join('\n');

  return `${header}async function runWorkflow() {
  console.log("🚀 Starting workflow: ${new Date().toLocaleString()}");

${steps}
  console.log("🏁 Workflow complete!");
}

runWorkflow().catch(err => {
  console.error("❌ Workflow failed:", err.message);
  process.exit(1);
});
`;
}
