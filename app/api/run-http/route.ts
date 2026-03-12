import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { url, method = 'GET', headers = {}, body, timeout = 30 } = await req.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout * 1000);

    const startTime = Date.now();

    const fetchOptions: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      signal: controller.signal,
    };

    if (method !== 'GET' && method !== 'HEAD' && body) {
      fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);
    clearTimeout(timer);

    const duration = Date.now() - startTime;
    const rawText = await response.text();

    let parsedBody: unknown = rawText;
    try { parsedBody = JSON.parse(rawText); } catch { /* leave as string */ }

    // Collect response headers
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((v, k) => { responseHeaders[k] = v; });

    return NextResponse.json({
      ok: true,
      status: response.status,
      statusText: response.statusText,
      duration,
      headers: responseHeaders,
      body: parsedBody,
      rawBody: rawText.slice(0, 8000), // cap at 8KB for display
      contentType: response.headers.get('content-type') || '',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const isAbort = msg.includes('abort') || msg.includes('timeout');
    return NextResponse.json({
      ok: false,
      error: isAbort ? 'Request timed out' : msg,
    }, { status: 500 });
  }
}
