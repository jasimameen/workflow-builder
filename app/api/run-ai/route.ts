import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const {
      provider,
      model,
      apiKey,
      systemPrompt,
      userPrompt,
      temperature = 0,
      maxTokens = 1000,
    } = await req.json();

    if (!apiKey) {
      return NextResponse.json({ error: 'API key is required for testing' }, { status: 400 });
    }
    if (!userPrompt) {
      return NextResponse.json({ error: 'User prompt is required' }, { status: 400 });
    }

    const startTime = Date.now();

    // ── OpenAI ────────────────────────────────────────────────────────────────
    if (provider === 'OpenAI') {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: model || 'gpt-4o',
          messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            { role: 'user', content: userPrompt },
          ],
          temperature,
          max_tokens: maxTokens,
        }),
      });
      const data = await res.json() as {
        choices?: { message?: { content?: string } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
        error?: { message?: string };
      };
      if (!res.ok) return NextResponse.json({ error: data?.error?.message || 'OpenAI error' }, { status: res.status });
      return NextResponse.json({
        ok: true,
        output: data.choices?.[0]?.message?.content || '',
        usage: data.usage,
        model: model || 'gpt-4o',
        duration: Date.now() - startTime,
        rawResponse: data,
      });
    }

    // ── Anthropic ─────────────────────────────────────────────────────────────
    if (provider === 'Anthropic (Claude)') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: model || 'claude-sonnet-4-6',
          max_tokens: maxTokens,
          ...(systemPrompt ? { system: systemPrompt } : {}),
          messages: [{ role: 'user', content: userPrompt }],
          temperature,
        }),
      });
      const data = await res.json() as {
        content?: { type?: string; text?: string }[];
        usage?: { input_tokens?: number; output_tokens?: number };
        error?: { message?: string };
      };
      if (!res.ok) return NextResponse.json({ error: data?.error?.message || 'Anthropic error' }, { status: res.status });
      const text = data.content?.find((b) => b.type === 'text')?.text || '';
      return NextResponse.json({
        ok: true,
        output: text,
        usage: data.usage,
        model: model || 'claude-sonnet-4-6',
        duration: Date.now() - startTime,
        rawResponse: data,
      });
    }

    // ── Google Gemini ─────────────────────────────────────────────────────────
    if (provider === 'Google Gemini') {
      const geminiModel = model || 'gemini-1.5-flash';
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: userPrompt }] }],
            ...(systemPrompt ? { systemInstruction: { parts: [{ text: systemPrompt }] } } : {}),
            generationConfig: { temperature, maxOutputTokens: maxTokens },
          }),
        }
      );
      const data = await res.json() as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
        error?: { message?: string };
      };
      if (!res.ok) return NextResponse.json({ error: data?.error?.message || 'Gemini error' }, { status: res.status });
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return NextResponse.json({
        ok: true,
        output: text,
        usage: data.usageMetadata,
        model: geminiModel,
        duration: Date.now() - startTime,
        rawResponse: data,
      });
    }

    return NextResponse.json({ error: `Provider "${provider}" is not supported for live testing` }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
