'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { readJson } from '@/lib/shared';

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await readJson(
        await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: user.trim(), password: pass }),
        })
      );
      if (!res.ok) {
        setError(res.data.error ?? 'Could not sign in.');
        return;
      }
      const next = params.get('next');
      router.push(next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard');
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const field =
    'mt-1.5 w-full rounded-xl border border-line bg-background px-4 py-3 text-[15px] text-foreground focus:border-brand focus:outline-none';

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-[420px]">
        <div className="mb-6 flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-sm.png" alt="Chatbot Builder" width={220} height={90} fetchPriority="high" className="mb-4 h-[90px] w-[220px] rounded-2xl bg-white object-contain" />
          <p className="text-[15px] text-muted">Build your WhatsApp chatbot in a few clicks.</p>
        </div>
        <form onSubmit={submit} className="rounded-3xl border border-line bg-panel p-7" aria-label="Sign in">
          <h1 className="text-2xl font-bold">Sign in</h1>
          <label htmlFor="u" className="mt-5 block text-[13px] font-semibold text-muted">Username</label>
          <input id="u" autoComplete="username" required value={user} onChange={(e) => setUser(e.target.value)} className={field} />
          <label htmlFor="p" className="mt-4 block text-[13px] font-semibold text-muted">Password</label>
          <input id="p" type="password" autoComplete="current-password" required value={pass} onChange={(e) => setPass(e.target.value)} className={field} />
          {error && (
            <p role="alert" className="mt-4 rounded-xl border border-danger/40 bg-danger-soft p-3 text-[14px] font-semibold text-danger">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy} className="mt-6 w-full rounded-xl bg-brand py-3.5 text-[16px] font-bold text-brand-ink hover:bg-brand-strong disabled:opacity-60">
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="mt-4 text-center text-[13px] text-muted">
            Demo workspace. Each business will get its own login with a subscription.
          </p>
        </form>
      </div>
    </main>
  );
}
