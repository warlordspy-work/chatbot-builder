'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import AppShell, { type NavKey } from '@/components/AppShell';
import Icon, { type IconName } from '@/components/Icon';
import {
  FEATURE_LABELS,
  enabledCount,
  formatDay,
  formatTime,
  orderItemsLabel,
  readJson,
  rupees,
  shortId,
  type BotRow,
  type Features,
  type OrderRow,
} from '@/lib/shared';

const VIEWS: Record<string, { nav: NavKey; crumb: string; eyebrow: string; title: string; sub: string }> = {
  overview: { nav: 'overview', crumb: 'Overview', eyebrow: 'Welcome back', title: 'Overview', sub: 'Live numbers from the chatbots you have built.' },
  chatbots: { nav: 'chatbots', crumb: 'My Chatbots', eyebrow: 'Your automation', title: 'My Chatbots', sub: 'Build, test and publish your WhatsApp assistants.' },
  conversations: { nav: 'conversations', crumb: 'Conversations', eyebrow: 'Customer engagement', title: 'Conversations', sub: 'Try your bot in a WhatsApp-style window before going live.' },
  orders: { nav: 'orders', crumb: 'Orders', eyebrow: 'Commerce', title: 'Orders', sub: 'Orders placed through your chatbots, saved in the database.' },
  menu: { nav: 'menu', crumb: 'Menu & Offers', eyebrow: 'Catalog & promotions', title: 'Menu & Offers', sub: 'Your menu, voucher, and which features are switched on.' },
  analytics: { nav: 'analytics', crumb: 'Analytics', eyebrow: 'Performance insights', title: 'Analytics', sub: 'Calculated from real orders. No made-up numbers.' },
  settings: { nav: 'settings', crumb: 'Settings', eyebrow: 'Preferences', title: 'Settings', sub: 'Integrations and system health.' },
};

const card = 'rounded-3xl border border-line bg-panel';
const btnPrimary =
  'inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-[14px] font-bold text-brand-ink hover:bg-brand-strong disabled:opacity-60';
const btnGhost =
  'inline-flex items-center gap-2 rounded-xl border border-line bg-panel-2 px-4 py-2.5 text-[14px] font-semibold hover:border-brand/60';

function Pill({ live }: { live: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold ${live ? 'bg-brand-soft text-brand' : 'bg-panel-2 text-muted'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-brand' : 'bg-muted'}`} />
      {live ? 'Live' : 'Draft'}
    </span>
  );
}

function Kpi({ label, value, note, icon }: { label: string; value: string; note: string; icon: IconName }) {
  return (
    <div className={`${card} p-5`}>
      <div className="flex items-start justify-between">
        <p className="text-[13px] font-semibold text-muted">{label}</p>
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-soft text-brand">
          <Icon name={icon} className="h-[18px] w-[18px]" />
        </span>
      </div>
      <p className="mt-4 text-3xl font-bold tracking-tight">{value}</p>
      <p className="mt-1 text-[13px] text-brand">{note}</p>
    </div>
  );
}

function botName(b: BotRow) {
  return b.config.businessName ?? 'Untitled chatbot';
}

function last7(orders: OrderRow[]) {
  const days: { label: string; total: number; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    days.push({ label: d.toLocaleDateString([], { weekday: 'short' }), total: 0, count: 0 });
    const key = d.toDateString();
    for (const o of orders) {
      if (new Date(o.created_at).toDateString() === key) {
        days[days.length - 1].total += Number(o.total);
        days[days.length - 1].count += 1;
      }
    }
  }
  return days;
}

function AreaChart({ data, unit }: { data: { label: string; v: number }[]; unit: string }) {
  const W = 640, H = 220, PX = 28, PT = 16, PB = 30;
  const max = Math.max(1, ...data.map((d) => d.v));
  const x = (i: number) => PX + (i * (W - PX * 2)) / (data.length - 1);
  const y = (v: number) => PT + (1 - v / max) * (H - PT - PB);
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d.v)}`).join(' ');
  const area = `${line} L${x(data.length - 1)},${H - PB} L${x(0)},${H - PB} Z`;
  const empty = data.every((d) => d.v === 0);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${unit} for the last 7 days`}>
        <defs>
          <linearGradient id="g" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#4cc27a" stopOpacity=".35" />
            <stop offset="1" stopColor="#4cc27a" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((i) => {
          const gy = PT + (i * (H - PT - PB)) / 3;
          return <line key={i} x1={PX} x2={W - PX} y1={gy} y2={gy} stroke="#1f2b26" strokeDasharray="4 5" />;
        })}
        <path d={area} fill="url(#g)" />
        <path d={line} fill="none" stroke="#4cc27a" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(d.v)} r="3.5" fill="#4cc27a" />
            <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="12" fill="#96a69e">{d.label}</text>
          </g>
        ))}
      </svg>
      {empty && <p className="-mt-2 text-center text-[13px] text-muted">No orders yet. Place one in a test chat and it shows up here.</p>}
    </div>
  );
}

export default function DashboardClient() {
  const router = useRouter();
  const params = useSearchParams();
  const view = VIEWS[params.get('view') ?? 'overview'] ? (params.get('view') ?? 'overview') : 'overview';
  const welcome = params.get('welcome') === '1';
  const [bots, setBots] = useState<BotRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; detail?: string } | null>(null);
  const [chatBot, setChatBot] = useState<BotRow | null>(null);
  const [saving, setSaving] = useState('');
  const [health, setHealth] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const load = useCallback(async () => {
    try {
      const res = await readJson<{ bots?: BotRow[]; orders?: OrderRow[] }>(await fetch('/api/overview', { cache: 'no-store' }));
      if (!res.ok) {
        setError({ message: res.data.error ?? 'Could not load your data.', detail: res.data.detail });
      } else {
        setBots(res.data.bots ?? []);
        setOrders(res.data.orders ?? []);
        setError(null);
      }
    } catch {
      setError({ message: 'Network error while loading the dashboard.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const t = setInterval(load, 5000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [load]);

  useEffect(() => {
    if (!chatBot) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setChatBot(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [chatBot]);

  const botParam = params.get('bot');
  const selected = bots.find((b) => b.id === botParam) ?? bots[0] ?? null;

  const stats = useMemo(() => {
    const revenue = orders.reduce((s, o) => s + Number(o.total), 0);
    const discount = orders.reduce((s, o) => s + Number(o.discount), 0);
    const redeemed = orders.filter((o) => Number(o.discount) > 0).length;
    const wallet = orders.filter((o) => o.paid_from_wallet).length;
    const live = bots.filter((b) => b.published).length;
    return { revenue, discount, redeemed, wallet, live, avg: orders.length ? revenue / orders.length : 0 };
  }, [bots, orders]);

  async function patch(bot: BotRow, body: { features?: Features; published?: boolean }) {
    setSaving(bot.id);
    try {
      const res = await readJson(await fetch('/api/bot', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ botId: bot.id, ...body }) }));
      if (!res.ok) setError({ message: res.data.error ?? 'Could not save.', detail: res.data.detail });
      await load();
    } finally {
      setSaving('');
    }
  }

  async function runHealth() {
    setHealth('Checking…');
    try {
      const res = await fetch('/api/health', { cache: 'no-store' });
      setHealth(JSON.stringify(await res.json(), null, 2));
    } catch {
      setHealth('Could not reach /api/health.');
    }
  }

  const v = VIEWS[view];
  const customerLink = selected && selected.customerId && origin ? `${origin}/chat/${selected.id}?customer=${selected.customerId}` : '';

  const activity = useMemo(() => {
    const items: { at: string; title: string; sub: string }[] = [];
    for (const o of orders.slice(0, 6)) {
      const b = bots.find((x) => x.id === o.bot_id);
      items.push({ at: o.created_at, title: `New order ${shortId(o.id)} · ${rupees(o.total)}`, sub: `${b ? botName(b) : 'Chatbot'} · ${orderItemsLabel(o.items)}` });
    }
    for (const b of bots.slice(0, 4)) {
      items.push({ at: b.created_at, title: `${botName(b)} was created`, sub: b.published ? 'Published' : 'Draft' });
    }
    return items.sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 6);
  }, [bots, orders]);

  const newBtn = (
    <Link href="/" className={btnPrimary}>
      <Icon name="plus" className="h-4 w-4" /> Create chatbot
    </Link>
  );

  function BotsTable()  {
    return (
      <div className={`${card} overflow-x-auto p-2`}>
        <table className="w-full min-w-[640px] text-left text-[14px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-[0.14em] text-muted">
              {['Chatbot', 'Features', 'Status', 'Created', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bots.map((b) => (
              <tr key={b.id} className="border-t border-line">
                <td className="px-4 py-3.5">
                  <p className="font-semibold">{botName(b)}</p>
                  <p className="max-w-[260px] truncate text-[13px] text-muted">{b.config.greeting}</p>
                </td>
                <td className="px-4 py-3.5">{enabledCount(b.config.features)} enabled</td>
                <td className="px-4 py-3.5"><Pill live={b.published} /></td>
                <td className="px-4 py-3.5 text-muted">{formatDay(b.created_at)}</td>
                <td className="whitespace-nowrap px-4 py-3.5">
                  <button type="button" onClick={() => setChatBot(b)} className="font-semibold text-brand hover:underline">Test chat →</button>
                  <Link href={`/dashboard?view=menu&bot=${b.id}`} className="ml-4 font-semibold text-muted hover:text-foreground">Menu & features →</Link>
                </td>
              </tr>
            ))}
            {bots.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-muted">No chatbots yet. Click “Create chatbot” to build your first one.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <AppShell active={v.nav} crumb={v.crumb} botId={selected?.id}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-brand">{v.eyebrow}</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight">{v.title}</h1>
          <p className="mt-2 text-[16px] text-muted">{v.sub}</p>
        </div>
        {(view === 'overview' || view === 'chatbots') && newBtn}
        {view === 'menu' && selected && (
          <div className="flex items-center gap-3">
            {bots.length > 1 && (
              <select aria-label="Choose chatbot" value={selected.id} onChange={(e) => router.push(`/dashboard?view=menu&bot=${e.target.value}`)} className="rounded-xl border border-line bg-panel px-3 py-2.5 text-[14px]">
                {bots.map((b) => <option key={b.id} value={b.id}>{botName(b)}</option>)}
              </select>
            )}
            <button type="button" disabled={saving === selected.id || selected.published} onClick={() => patch(selected, { published: true })} className={btnPrimary}>
              {selected.published ? 'Published ✓' : 'Publish chatbot'}
            </button>
          </div>
        )}
      </div>

      {welcome && selected && (
        <div role="status" className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand/40 bg-brand-soft p-4">
          <p className="text-[15px]"><strong>{botName(selected)}</strong> is ready. Chat with it as a customer to see it work.</p>
          <button type="button" onClick={() => setChatBot(selected)} className={btnPrimary}>Test chat →</button>
        </div>
      )}

      {error && (
        <div role="alert" className="mt-6 rounded-2xl border border-danger/40 bg-danger-soft p-4 text-[14px]">
          <p className="font-semibold text-danger">{error.message}</p>
          {error.detail && <p className="mt-1 break-words font-mono text-[12px] text-muted">{error.detail}</p>}
        </div>
      )}

      <div className="mt-8 space-y-6">
        {loading && <p className="text-muted">Loading…</p>}

        {!loading && view === 'overview' && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Kpi label="Total chatbots" value={String(bots.length)} note={`${stats.live} live · ${bots.length - stats.live} draft`} icon="bot" />
              <Kpi label="Orders" value={String(orders.length)} note="Placed in chat" icon="receipt" />
              <Kpi label="Revenue" value={rupees(stats.revenue)} note={`${rupees(stats.discount)} given as discounts`} icon="rupee" />
              <Kpi label="Vouchers redeemed" value={String(stats.redeemed)} note="Orders with a discount" icon="ticket" />
            </div>
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              <section className={`${card} p-6`}>
                <h2 className="text-lg font-semibold">Sales, last 7 days</h2>
                <div className="mt-3"><AreaChart unit="Sales in rupees" data={last7(orders).map((d) => ({ label: d.label, v: d.total }))} /></div>
              </section>
              <section className={`${card} p-6`}>
                <h2 className="text-lg font-semibold">Recent activity</h2>
                <ul className="mt-4 space-y-4">
                  {activity.map((a, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" />
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold">{a.title}</p>
                        <p className="truncate text-[13px] text-muted">{a.sub} · {formatDay(a.at)} {formatTime(a.at)}</p>
                      </div>
                    </li>
                  ))}
                  {activity.length === 0 && <li className="text-[14px] text-muted">Nothing yet.</li>}
                </ul>
              </section>
            </div>
            <section>
              <h2 className="mb-3 text-lg font-semibold">Your chatbots</h2>
              {BotsTable()}
            </section>
          </>
        )}

        {!loading && view === 'chatbots' && BotsTable()}

        {!loading && view === 'conversations' && (
          <div className="grid gap-6 xl:grid-cols-2">
            <section className={`${card} p-6`}>
              <h2 className="text-lg font-semibold">Open a test conversation</h2>
              <ul className="mt-4 divide-y divide-line">
                {bots.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-3 py-3.5">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-soft font-bold text-brand">{botName(b).slice(0, 2).toUpperCase()}</span>
                      <div className="min-w-0"><p className="font-semibold">{botName(b)}</p><p className="truncate text-[13px] text-muted">{b.config.greeting}</p></div>
                    </div>
                    <button type="button" onClick={() => setChatBot(b)} className={btnGhost}>Open chat</button>
                  </li>
                ))}
                {bots.length === 0 && <li className="py-6 text-muted">Create a chatbot first.</li>}
              </ul>
            </section>
            <section className={`${card} p-6`}>
              <h2 className="text-lg font-semibold">Connect real WhatsApp</h2>
              {[['Step 1 · WhatsApp Business', 'Get a WhatsApp Business API number from a provider such as WATI.'], ['Step 2 · Webhook', 'Point the provider webhook to this app’s chat endpoint.'], ['Step 3 · Go live', 'Test with your own number, then publish.']].map(([t, d]) => (
                <div key={t} className="mt-3 rounded-2xl border border-line bg-background p-4"><p className="font-semibold">{t}</p><p className="mt-1 text-[14px] text-muted">{d}</p></div>
              ))}
              <p className="mt-4 text-[13px] text-muted">Not connected yet. Today, customers chat in the built-in WhatsApp-style window.</p>
            </section>
          </div>
        )}

        {!loading && view === 'orders' && (
          <div className={`${card} overflow-x-auto p-2`}>
            <table className="w-full min-w-[680px] text-left text-[14px]">
              <thead><tr className="text-[11px] uppercase tracking-[0.14em] text-muted">{['Order', 'Chatbot', 'Items', 'Amount', 'Time', 'Paid via'].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
              <tbody>
                {orders.map((o) => {
                  const b = bots.find((x) => x.id === o.bot_id);
                  return (
                    <tr key={o.id} className="border-t border-line">
                      <td className="px-4 py-3.5 font-semibold">{shortId(o.id)}</td>
                      <td className="px-4 py-3.5">{b ? botName(b) : '—'}</td>
                      <td className="px-4 py-3.5">{orderItemsLabel(o.items)}</td>
                      <td className="px-4 py-3.5">{rupees(o.total)}{Number(o.discount) > 0 && <span className="ml-2 text-[12px] text-brand">−{rupees(o.discount)}</span>}</td>
                      <td className="px-4 py-3.5 text-muted">{formatDay(o.created_at)} {formatTime(o.created_at)}</td>
                      <td className="px-4 py-3.5">{o.paid_from_wallet ? 'Wallet' : 'Pay at counter'}</td>
                    </tr>
                  );
                })}
                {orders.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-muted">No orders yet. Place one in a test chat.</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {!loading && view === 'menu' && (selected ? (
          <div className="grid gap-6 xl:grid-cols-2">
            <section className={`${card} p-6`}>
              <h2 className="text-lg font-semibold">Menu items <span className="text-muted">({selected.config.menu?.length ?? 0})</span></h2>
              <ul className="mt-3 divide-y divide-line">
                {(selected.config.menu ?? []).map((m) => (
                  <li key={m.name} className="flex items-center justify-between py-3"><span className="font-semibold">{m.name}</span><span className="font-bold text-brand">{rupees(m.price)}</span></li>
                ))}
                {(selected.config.menu ?? []).length === 0 && <li className="py-4 text-muted">No menu items.</li>}
              </ul>
            </section>
            <div className="space-y-6">
              <section className={`${card} p-6`}>
                <h2 className="text-lg font-semibold">Features</h2>
                <ul className="mt-3 divide-y divide-line">
                  {FEATURE_LABELS.map((f) => {
                    const on = !!selected.config.features?.[f.key];
                    return (
                      <li key={f.key} className="flex items-center justify-between gap-4 py-3.5">
                        <div><p className="font-semibold">{f.label}</p><p className="text-[13px] text-muted">{f.hint}</p></div>
                        <button type="button" role="switch" aria-checked={on} aria-label={f.label} disabled={saving === selected.id}
                          onClick={() => patch(selected, { features: { ...selected.config.features, [f.key]: !on } })}
                          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? 'bg-brand' : 'bg-line'}`}>
                          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${on ? 'left-6' : 'left-1'}`} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
              <section className={`${card} p-6`}>
                <h2 className="text-lg font-semibold">Promotions</h2>
                {selected.config.voucher ? (
                  <div className="mt-3 rounded-2xl border border-line bg-background p-4">
                    <p className="font-semibold">{selected.config.voucher.code}</p>
                    <p className="text-[14px] text-muted">{selected.config.voucher.percentOff}% off{selected.config.voucher.firstOrderOnly ? ' on the first order' : ''}</p>
                  </div>
                ) : <p className="mt-3 text-[14px] text-muted">No voucher for this chatbot.</p>}
              </section>
              <section className={`${card} p-6`}>
                <h2 className="text-lg font-semibold">Customer link</h2>
                <p className="mt-1 text-[13px] text-muted">Share this to let someone chat with the bot.</p>
                <div className="mt-3 flex gap-2">
                  <input readOnly value={customerLink} aria-label="Customer link" className="min-w-0 flex-1 rounded-xl border border-line bg-background px-3 py-2.5 text-[13px]" />
                  <button type="button" className={btnGhost} onClick={async () => { try { await navigator.clipboard.writeText(customerLink); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {} }}>{copied ? 'Copied' : 'Copy'}</button>
                </div>
              </section>
            </div>
          </div>
        ) : <p className="text-muted">Create a chatbot first.</p>)}

        {!loading && view === 'analytics' && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Kpi label="Orders" value={String(orders.length)} note="All chatbots" icon="receipt" />
              <Kpi label="Revenue" value={rupees(stats.revenue)} note="After discounts" icon="rupee" />
              <Kpi label="Avg. order value" value={rupees(Math.round(stats.avg))} note="Per order" icon="chart" />
              <Kpi label="Wallet payments" value={orders.length ? `${Math.round((stats.wallet / orders.length) * 100)}%` : '0%'} note="Share of orders" icon="check" />
            </div>
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              <section className={`${card} p-6`}>
                <h2 className="text-lg font-semibold">Orders per day</h2>
                <div className="mt-3"><AreaChart unit="Orders" data={last7(orders).map((d) => ({ label: d.label, v: d.count }))} /></div>
              </section>
              <section className={`${card} p-6`}>
                <h2 className="text-lg font-semibold">Top items</h2>
                {(() => {
                  const c: Record<string, number> = {};
                  orders.forEach((o) => (o.items ?? []).forEach((i) => (c[i.name] = (c[i.name] ?? 0) + i.qty)));
                  const top = Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 5);
                  const max = Math.max(1, ...top.map((t) => t[1]));
                  return top.length ? (
                    <ul className="mt-4 space-y-4">{top.map(([n, q]) => (
                      <li key={n}><div className="flex justify-between text-[14px]"><span>{n}</span><span className="font-semibold">{q}</span></div><div className="mt-1.5 h-2 rounded-full bg-line"><div className="h-2 rounded-full bg-brand" style={{ width: `${(q / max) * 100}%` }} /></div></li>
                    ))}</ul>
                  ) : <p className="mt-4 text-[14px] text-muted">No orders yet.</p>;
                })()}
              </section>
            </div>
          </>
        )}

        {!loading && view === 'settings' && (
          <div className="grid gap-6 xl:grid-cols-2">
            <section className={`${card} p-6`}>
              <h2 className="text-lg font-semibold">Integration checklist</h2>
              {[['Gemini API', 'Used to build chatbots and to power every customer chat. Key stays on the server.'], ['Supabase database', 'Stores chatbots, wallets, vouchers and orders.'], ['WhatsApp Business API', 'Not connected yet. Chats run in the built-in simulator.'], ['Hosting', 'Vercel and Google Cloud Run.']].map(([t, d]) => (
                <div key={t} className="mt-3 rounded-2xl border border-line bg-background p-4"><p className="font-semibold">{t}</p><p className="mt-1 text-[14px] text-muted">{d}</p></div>
              ))}
            </section>
            <section className={`${card} p-6`}>
              <h2 className="text-lg font-semibold">System health</h2>
              <p className="mt-1 text-[14px] text-muted">Checks the keys, the database and Gemini on this deployment. Secrets are never shown.</p>
              <button type="button" onClick={runHealth} className={`${btnPrimary} mt-4`}>Run health check</button>
              {health && <pre className="mt-4 max-h-80 overflow-auto rounded-xl border border-line bg-background p-3 text-[12px] text-muted">{health}</pre>}
            </section>
          </div>
        )}
      </div>

      {chatBot && (
        <div role="dialog" aria-modal="true" aria-label={`Test chat with ${botName(chatBot)}`} className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={() => setChatBot(null)}>
          <div className="relative h-[min(720px,92dvh)] w-full max-w-[420px] overflow-hidden rounded-3xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setChatBot(null)} aria-label="Close chat" className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-black/40 text-white"><Icon name="close" className="h-4 w-4" /></button>
            <iframe title="Customer chat" src={`/chat/${chatBot.id}?customer=${chatBot.customerId ?? ''}&embed=1`} className="h-full w-full border-0" />
          </div>
        </div>
      )}
    </AppShell>
  );
}
