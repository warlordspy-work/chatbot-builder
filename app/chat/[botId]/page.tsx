'use client';

import { Suspense, use, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { readJson, rupees, type BotConfig } from '@/lib/shared';

type Msg = { id: number; from: 'me' | 'bot'; text: string; time: string };

const now = () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

// Renders *bold* and **bold** like WhatsApp does.
function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*\n]+\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        /^\*\*?[^*]+\*\*?$/.test(p) ? <strong key={i}>{p.replace(/^\*+|\*+$/g, '')}</strong> : <span key={i}>{p}</span>
      )}
    </>
  );
}

function Ticks() {
  return (
    <svg viewBox="0 0 16 11" className="inline h-[11px] w-4 text-[#53bdeb]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 6l3 3 6-7M6 8l1 1 6-7" />
    </svg>
  );
}

function ChatInner({ botId }: { botId: string }) {
  const params = useSearchParams();
  const customerId = params.get('customer') ?? '';
  const embed = params.get('embed') === '1';

  const [config, setConfig] = useState<BotConfig | null>(null);
  const [balance, setBalance] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const idRef = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await readJson<{ config?: BotConfig; balance?: number }>(
          await fetch(`/api/bot?id=${botId}&customer=${customerId}`)
        );
        if (!live) return;
        if (!res.ok || !res.data.config) {
          setLoadError(res.data.error ?? 'This chatbot could not be found.');
          return;
        }
        setConfig(res.data.config);
        setBalance(res.data.balance ?? 0);
        setMsgs([{ id: 0, from: 'bot', text: res.data.config.greeting ?? 'Hi! How can I help you today?', time: now() }]);
      } catch {
        if (live) setLoadError('Could not load this chatbot. Check your connection.');
      }
    })();
    return () => {
      live = false;
    };
  }, [botId, customerId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, typing]);

  async function send(text: string) {
    const t = text.trim();
    if (!t || typing) return;
    const history = msgs
      .filter((m) => m.id !== 0)
      .map((m) => ({ role: m.from === 'me' ? 'user' : 'model', text: m.text }));
    setMsgs((m) => [...m, { id: idRef.current++, from: 'me', text: t, time: now() }]);
    setInput('');
    setTyping(true);
    try {
      const res = await readJson<{ reply?: string; balance?: number }>(
        await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ botId, customerId, history, message: t }),
        })
      );
      const reply = res.ok && res.data.reply ? res.data.reply : `⚠️ ${res.data.error ?? 'Something went wrong.'}`;
      setMsgs((m) => [...m, { id: idRef.current++, from: 'bot', text: reply, time: now() }]);
      if (typeof res.data.balance === 'number') setBalance(res.data.balance);
    } catch {
      setMsgs((m) => [...m, { id: idRef.current++, from: 'bot', text: '⚠️ Network error. Please try again.', time: now() }]);
    } finally {
      setTyping(false);
    }
  }

  const name = config?.businessName ?? 'Chatbot';
  const chips = ['Show menu', 'My wallet balance', 'Any offers?'];

  return (
    <div className={`flex ${embed ? 'h-dvh' : 'h-dvh sm:py-6'} items-center justify-center bg-[#d1d7db]`}>
      <div className="flex h-full w-full max-w-[460px] flex-col overflow-hidden bg-[#efeae2] sm:rounded-2xl sm:shadow-2xl">
        {/* WhatsApp header */}
        <header className="flex items-center gap-3 bg-[#008069] px-3 py-2.5 text-white">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/90 text-[16px] font-bold text-[#008069]">
            {name.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[16px] font-medium">{name}</p>
            <p className="text-[12px] text-white/80">{typing ? 'typing…' : 'online'}</p>
          </div>
          {config?.features?.wallet && (
            <span className="rounded-full bg-white/15 px-3 py-1 text-[12px] font-semibold">Wallet {rupees(balance)}</span>
          )}
        </header>

        {/* Messages */}
        <div className="wa-wallpaper flex-1 overflow-y-auto px-3 py-3" role="log" aria-live="polite" aria-label="Conversation">
          {loadError ? (
            <p role="alert" className="mx-auto mt-10 max-w-xs rounded-lg bg-white p-3 text-center text-[14px] text-[#54656f] shadow">
              {loadError}
            </p>
          ) : (
            <>
              <p className="mx-auto mb-3 w-fit rounded-lg bg-[#fff5c4] px-3 py-1 text-[12px] text-[#54656f] shadow-sm">
                Messages here are from a demo chatbot.
              </p>
              {msgs.map((m) => (
                <div key={m.id} className={`mb-1.5 flex ${m.from === 'me' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[82%] whitespace-pre-wrap break-words rounded-lg px-2.5 pb-1 pt-1.5 text-[15px] leading-snug text-[#111b21] shadow-sm ${
                      m.from === 'me' ? 'rounded-tr-none bg-[#d9fdd3]' : 'rounded-tl-none bg-white'
                    }`}
                  >
                    <Rich text={m.text} />
                    <span className="float-right ml-3 mt-1.5 flex items-center gap-1 text-[11px] text-[#667781]">
                      {m.time}
                      {m.from === 'me' && <Ticks />}
                    </span>
                  </div>
                </div>
              ))}
              {typing && (
                <div className="mb-1.5 flex">
                  <div className="flex gap-1 rounded-lg rounded-tl-none bg-white px-3 py-3 shadow-sm" aria-label="Typing">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-[#8696a0]" style={{ animationDelay: `${i * 150}ms` }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </>
          )}
        </div>

        {/* Quick replies + input */}
        <div className="bg-[#f0f2f5]">
          {!loadError && (
            <div className="flex gap-2 overflow-x-auto px-3 pt-2">
              {chips.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => send(c)}
                  disabled={typing}
                  className="whitespace-nowrap rounded-full border border-[#d1d7db] bg-white px-3 py-1.5 text-[13px] font-medium text-[#008069] disabled:opacity-50"
                >
                  {c}
                </button>
              ))}
            </div>
          )}
          <form
            className="flex items-center gap-2 px-3 py-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message"
              aria-label="Message"
              disabled={!!loadError}
              className="min-w-0 flex-1 rounded-full bg-white px-4 py-2.5 text-[15px] text-[#111b21] placeholder:text-[#667781] focus:outline-none"
            />
            <button
              type="submit"
              disabled={!input.trim() || typing}
              aria-label="Send"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#00a884] text-white disabled:opacity-50"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                <path d="M3 20.5v-6.8l9-1.7-9-1.7V3.5L22 12z" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Resolved({ params }: { params: Promise<{ botId: string }> }) {
  const { botId } = use(params);
  return <ChatInner botId={botId} />;
}

export default function ChatPage({ params }: { params: Promise<{ botId: string }> }) {
  return (
    <Suspense fallback={<div className="grid h-dvh place-items-center bg-[#efeae2] text-[#54656f]">Loading chat…</div>}>
      <Resolved params={params} />
    </Suspense>
  );
}
