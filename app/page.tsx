'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import Icon from '@/components/Icon';
import { readJson } from '@/lib/shared';

const SAMPLE_DESC =
  'We run a small café called Brew Bay. Take orders from our menu, give 10% off on a first order with code FIRST10, and keep a prepaid wallet for regulars. Be friendly and short.';
const SAMPLE_MENU = 'Cappuccino 150\nCold Coffee 180\nVeg Sandwich 120\nBrownie 90';

// Shrink a photo in the browser so uploads stay small and fast.
async function downscale(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not read that image.'))), 'image/jpeg', 0.85)
  );
}

export default function BuilderPage() {
  const router = useRouter();
  const [desc, setDesc] = useState('');
  const [menu, setMenu] = useState('');
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<{ message: string; detail?: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setError(null);
    setReading(true);
    try {
      const blob = await downscale(file);
      const fd = new FormData();
      fd.append('menu', blob, 'menu.jpg');
      const res = await readJson<{ menuText?: string }>(await fetch('/api/menu-from-image', { method: 'POST', body: fd }));
      if (!res.ok || !res.data.menuText) {
        setError({ message: res.data.error ?? 'Could not read the menu photo.', detail: res.data.detail });
      } else {
        setMenu(res.data.menuText);
      }
    } catch (e) {
      setError({ message: e instanceof Error ? e.message : 'Could not read the menu photo.' });
    } finally {
      setReading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function generate() {
    setError(null);
    if (desc.trim().length < 10) {
      setError({ message: 'Describe your business in a sentence or two first.' });
      return;
    }
    setBusy(true);
    try {
      const res = await readJson<{ bot?: { id: string } }>(
        await fetch('/api/builder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: desc, menuText: menu }),
        })
      );
      if (!res.ok || !res.data.bot) {
        setError({ message: res.data.error ?? `Something went wrong (status ${res.status}).`, detail: res.data.detail });
        return;
      }
      try {
        localStorage.setItem('cb:lastBot', res.data.bot.id);
      } catch {}
      router.push(`/dashboard?bot=${res.data.bot.id}&welcome=1`);
    } catch (e) {
      setError({ message: e instanceof Error ? e.message : 'Network error. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  const field =
    'w-full rounded-xl border border-line bg-background px-4 py-3 text-[15px] text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none';

  return (
    <AppShell active="builder" crumb="AI Bot Builder">
      <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-brand">No-code workspace</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight">AI Bot Builder</h1>
      <p className="mt-2 text-[16px] text-muted">
        Describe your business in plain words. Gemini builds your WhatsApp chatbot in seconds.
      </p>

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-line bg-panel p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">
                <span className="text-muted">01 ·</span> Describe your business
              </h2>
              <button
                type="button"
                onClick={() => {
                  setDesc(SAMPLE_DESC);
                  setMenu(SAMPLE_MENU);
                }}
                className="rounded-lg border border-line px-3 py-1.5 text-[13px] font-semibold text-brand hover:bg-brand-soft"
              >
                Use sample café
              </button>
            </div>
            <label htmlFor="desc" className="mt-4 block text-[13px] font-semibold text-muted">
              What should your assistant do?
            </label>
            <textarea
              id="desc"
              rows={5}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="We run a bakery in Pune. Take orders, offer 10% off the first order, and let regulars pay from a wallet."
              className={`${field} mt-2 resize-y`}
            />
          </section>

          <section className="rounded-3xl border border-line bg-panel p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">
                <span className="text-muted">02 ·</span> Menu & products
              </h2>
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  id="menu-photo"
                  onChange={(e) => onPhoto(e.target.files?.[0])}
                />
                <label
                  htmlFor="menu-photo"
                  className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-[13px] font-semibold text-brand hover:bg-brand-soft"
                >
                  <Icon name="upload" className="h-4 w-4" />
                  {reading ? 'Reading photo…' : 'Upload menu photo'}
                </label>
              </div>
            </div>
            <label htmlFor="menu" className="mt-4 block text-[13px] font-semibold text-muted">
              One item and price per line (or upload a photo and Gemini reads it)
            </label>
            <textarea
              id="menu"
              rows={6}
              value={menu}
              onChange={(e) => setMenu(e.target.value)}
              placeholder={'Cappuccino 150\nCold Coffee 180'}
              className={`${field} mt-2 resize-y font-mono text-[14px]`}
            />
          </section>

          {error && (
            <div role="alert" className="rounded-2xl border border-danger/40 bg-danger-soft p-4 text-[14px]">
              <p className="font-semibold text-danger">{error.message}</p>
              {error.detail && <p className="mt-1 break-words font-mono text-[12px] text-muted">{error.detail}</p>}
            </div>
          )}

          <button
            type="button"
            onClick={generate}
            disabled={busy || reading}
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3.5 text-[16px] font-bold text-brand-ink hover:bg-brand-strong disabled:opacity-60"
          >
            <Icon name="sparkle" className="h-5 w-5" />
            {busy ? 'Gemini is building your chatbot…' : 'Generate chatbot'}
          </button>
        </div>

        <aside className="space-y-6">
          <section className="rounded-3xl border border-line bg-panel p-6">
            <h2 className="text-lg font-semibold">How it works</h2>
            <ol className="mt-4 space-y-4 text-[14px] text-muted">
              {[
                ['Describe', 'Say what your business does in plain words.'],
                ['Gemini builds', 'Name, greeting, menu, wallet and voucher are set up for you.'],
                ['Test & publish', 'Chat with it in a WhatsApp-style window, then publish.'],
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-soft text-[13px] font-bold text-brand">
                    {i + 1}
                  </span>
                  <span>
                    <span className="block font-semibold text-foreground">{t}</span>
                    {d}
                  </span>
                </li>
              ))}
            </ol>
          </section>
          <section className="rounded-3xl border border-line bg-panel p-6">
            <h2 className="text-lg font-semibold">Deployment status</h2>
            <p className="mt-3 rounded-xl border border-line bg-background p-3 text-[14px] text-muted">
              <span className="font-semibold text-foreground">WhatsApp Business API</span>
              <br />
              Not connected yet. Chats run in the built-in simulator.
            </p>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
