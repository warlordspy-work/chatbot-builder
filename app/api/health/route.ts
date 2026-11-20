import { connection } from 'next/server';
import { ai, MODEL } from '@/lib/gemini';
import { db } from '@/lib/supabase';
import { shield } from '@/lib/dlp';
import { requireSession } from '@/lib/auth';

// Open /api/health on any deployment to see which part is misconfigured.
// It never prints secrets, only whether each value is present and well formed.
// Delete this file after the event.
export async function GET(req: Request) {
  await connection();
  const session = requireSession(req);
  if (session instanceof Response) return session;

  const url = process.env.SUPABASE_URL ?? '';
  const serviceKey = process.env.SUPABASE_SERVICE_KEY ?? '';

  const env = {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY ? 'set' : 'MISSING',
    GEMINI_MODEL: process.env.GEMINI_MODEL ? process.env.GEMINI_MODEL : 'MISSING',
    SUPABASE_URL: !url
      ? 'MISSING'
      : /^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url)
        ? 'looks correct'
        : 'WRONG FORMAT: it must be https://xxxx.supabase.co with nothing after it',
    SUPABASE_SERVICE_KEY: !serviceKey
      ? 'MISSING'
      : serviceKey.startsWith('sb_secret_') || serviceKey.startsWith('eyJ')
        ? 'set'
        : 'SET BUT UNEXPECTED FORMAT (is it the secret key?)',
  };

  async function check<T>(run: () => Promise<T>) {
    const started = Date.now();
    try {
      const value = await run();
      return { ok: true, ms: Date.now() - started, value };
    } catch (e) {
      return { ok: false, ms: Date.now() - started, error: (e instanceof Error ? e.message : String(e)).slice(0, 400) };
    }
  }

  const supabase = await check(async () => {
    const { error, count } = await db.from('bots').select('id', { count: 'exact', head: true });
    if (error) throw new Error(error.message);
    return { bots: count ?? 0 };
  });

  const gemini = await check(async () => {
    const r = await ai.models.generateContent({
      model: MODEL,
      contents: 'Reply with the single word: ok',
    });
    return { reply: (r.text ?? '').trim().slice(0, 20) };
  });

  // 'cloud-dlp' = Google Cloud Sensitive Data Protection is working. 'local' = built-in pattern shield only.
  const privacyShield = await check(async () => {
    const r = await shield('card 4111 1111 1111 1111');
    return { engine: r.engine, hidden: r.found.length > 0 };
  });

  return Response.json({ env, supabase, gemini, privacyShield });
}
