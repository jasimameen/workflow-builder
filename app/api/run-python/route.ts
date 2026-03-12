import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const TIMEOUT_MS = 15_000; // 15 s

function runProcess(cmd: string): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const proc = exec(cmd, { timeout: TIMEOUT_MS, maxBuffer: 1024 * 512 }, (err, stdout, stderr) => {
      resolve({ stdout, stderr, code: err?.code ?? 0 });
    });
    // Extra safety kill
    setTimeout(() => { try { proc.kill(); } catch { /* ignore */ } }, TIMEOUT_MS + 500);
  });
}

export async function POST(req: Request) {
  // Check Python available
  const pyCheck = await runProcess('python3 --version 2>&1 || python --version 2>&1');
  const pythonCmd = pyCheck.stdout.includes('Python') || pyCheck.stderr.includes('Python') ? 'python3' : null;

  if (!pythonCmd) {
    return NextResponse.json({
      ok: false,
      error: 'Python 3 is not installed on this machine. Install Python to run code tests.',
    }, { status: 400 });
  }

  let { code, variables = {} } = await req.json() as { code: string; variables: Record<string, unknown> };

  if (!code?.trim()) {
    return NextResponse.json({ ok: false, error: 'No code provided' }, { status: 400 });
  }

  // Build the wrapper script
  const wrapperScript = `
import sys, json, traceback, io

# Inject test variables
_vars = ${JSON.stringify(variables)}
for _k, _v in _vars.items():
    globals()[_k] = _v

# Capture stdout
_buf = io.StringIO()
_orig_stdout = sys.stdout
sys.stdout = _buf

_error = None
_exc_tb = None
try:
    exec(${JSON.stringify(code)}, globals())
except Exception as _e:
    _error = str(_e)
    _exc_tb = traceback.format_exc()

sys.stdout = _orig_stdout
_captured = _buf.getvalue()

# Collect any new variables set by user code (exclude builtins & private)
_user_vars = {}
for _k, _v in globals().items():
    if _k.startswith('_') or _k in ('sys', 'json', 'traceback', 'io', 'exec'):
        continue
    try:
        json.dumps(_v)  # only serialisable values
        _user_vars[_k] = _v
    except Exception:
        _user_vars[_k] = repr(_v)

# Remove injected input vars from output
for _k in _vars:
    _user_vars.pop(_k, None)

print(json.dumps({
    "stdout": _captured,
    "vars": _user_vars,
    "error": _error,
    "traceback": _exc_tb,
}))
`.trim();

  const tmpFile = join(tmpdir(), `wf_test_${Date.now()}.py`);
  writeFileSync(tmpFile, wrapperScript, 'utf-8');

  const startTime = Date.now();
  const result = await runProcess(`${pythonCmd} "${tmpFile}" 2>&1`);
  const duration = Date.now() - startTime;

  // Cleanup
  try { if (existsSync(tmpFile)) unlinkSync(tmpFile); } catch { /* ignore */ }

  // The wrapper always prints JSON as the last line
  const lines = result.stdout.trim().split('\n');
  const lastLine = lines[lines.length - 1];

  try {
    const parsed = JSON.parse(lastLine) as {
      stdout?: string;
      vars?: Record<string, unknown>;
      error?: string;
      traceback?: string;
    };

    if (parsed.error) {
      return NextResponse.json({
        ok: false,
        error: parsed.error,
        traceback: parsed.traceback,
        stdout: parsed.stdout,
        duration,
      });
    }

    return NextResponse.json({
      ok: true,
      stdout: parsed.stdout || '',
      vars: parsed.vars || {},
      duration,
    });
  } catch {
    // The wrapper itself crashed (syntax error in wrapper, not user code)
    return NextResponse.json({
      ok: false,
      error: result.stdout || result.stderr || 'Unknown execution error',
      duration,
    });
  }
}
