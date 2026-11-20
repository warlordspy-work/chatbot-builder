'use client';

/**
 * WhatsApp-styled Customer Chat Page
 *
 * Provides a conversational ordering experience for customers interacting with an AI chatbot.
 * Features:
 * - Dynamic route parameters (`botId`) and query params (`customerId`) wrapped in Suspense
 * - Initial load of bot configuration and customer wallet balance from `/api/bot`
 * - Greeting bubble display
 * - Multi-turn conversational ordering via `/api/chat`
 * - Live wallet balance updates
 * - WhatsApp-style green header, user & bot bubbles, typing indicator, auto-scroll, and Enter-to-send.
 */

import React, { Suspense, useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';

/**
 * Message object structure adhering to Gemini chat format
 */
interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

/**
 * Bot configuration returned by /api/bot
 */
interface BotConfig {
  businessName?: string;
  greeting?: string;
  tone?: string;
  features?: {
    menuOrdering?: boolean;
    wallet?: boolean;
    vouchers?: boolean;
  };
}

/**
 * Inner chat component wrapped by Suspense for client-side search params
 */
function ChatContent() {
  const params = useParams();
  const searchParams = useSearchParams();

  // Extract botId and customerId
  const botId = (params?.botId as string) || '';
  const customerId = searchParams.get('customer') || '';

  // Header & configuration state
  const [businessName, setBusinessName] = useState<string>('Chatbot');
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [isLoadingBot, setIsLoadingBot] = useState<boolean>(true);

  // Chat messages and interaction state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState<string>('');
  const [isTyping, setIsTyping] = useState<boolean>(false);

  // Reference for auto-scrolling
  const messagesEndRef = useRef<HTMLDivElement>(null);

  /**
   * Smoothly auto-scrolls to the newest message
   */
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  /**
   * On initial mount, fetch bot details and customer wallet balance
   */
  useEffect(() => {
    if (!botId) return;

    let isMounted = true;

    async function loadBotData() {
      setIsLoadingBot(true);
      try {
        const res = await fetch(
          `/api/bot?id=${encodeURIComponent(botId)}&customer=${encodeURIComponent(customerId)}`
        );
        if (!res.ok) return;

        const data: { config?: BotConfig; balance?: number } = await res.json();

        if (isMounted) {
          if (data.config?.businessName) {
            setBusinessName(data.config.businessName);
          }
          if (typeof data.balance === 'number') {
            setWalletBalance(data.balance);
          }

          // Display config.greeting as the first bot bubble
          if (data.config?.greeting) {
            setMessages([{ role: 'model', text: data.config.greeting }]);
          }
        }
      } catch (err) {
        console.error('Failed to load bot configuration:', err);
      } finally {
        if (isMounted) {
          setIsLoadingBot(false);
        }
      }
    }

    void loadBotData();

    return () => {
      isMounted = false;
    };
  }, [botId, customerId]);

  /**
   * Sends the user's message to POST /api/chat
   */
  const handleSendMessage = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isTyping) return;

    // Build the user message
    const userMessage: ChatMessage = { role: 'user', text: trimmed };

    // History is all previous messages EXCEPT the greeting bubble (the 0th message)
    const history = messages.slice(1);

    // Optimistically append user message to UI
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          botId,
          customerId,
          history,
          message: trimmed,
        }),
      });

      const data = await response.json().catch(() => null);

      if (response.ok && data) {
        // Append bot reply bubble
        if (data.reply) {
          setMessages((prev) => [...prev, { role: 'model', text: data.reply }]);
        }

        // Update wallet balance from returned balance
        if (typeof data.balance === 'number') {
          setWalletBalance(data.balance);
        }
      } else {
        const errorText = data?.error || 'Sorry, something went wrong. Please try again.';
        setMessages((prev) => [...prev, { role: 'model', text: errorText }]);
      }
    } catch (err) {
      console.error('Chat error:', err);
      setMessages((prev) => [
        ...prev,
        { role: 'model', text: 'Network connection failed. Please check your connection and try again.' },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  /**
   * Handles keyboard press: Enter key sends message
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleSendMessage();
    }
  };

  return (
    <div className="flex h-screen w-full flex-col bg-[#efeae2] dark:bg-zinc-950 font-sans">
      {/* WhatsApp Green Header */}
      <header className="flex h-16 items-center justify-between bg-[#075e54] dark:bg-[#005c4b] px-4 py-2 text-white shadow-md z-10">
        <div className="flex items-center gap-3">
          {/* Back button */}
          <Link
            href="/"
            aria-label="Back to builder"
            className="rounded-full p-1 hover:bg-black/10 transition-colors text-white"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>

          {/* Business Avatar Icon */}
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-800 text-white font-bold text-base shadow-xs uppercase">
            {businessName.charAt(0) || 'B'}
          </div>

          {/* Business Name and Online/Typing Status */}
          <div className="flex flex-col">
            <h1 className="text-base font-semibold leading-tight line-clamp-1">
              {businessName}
            </h1>
            <span className="text-xs text-emerald-100">
              {isTyping ? 'typing...' : 'online'}
            </span>
          </div>
        </div>

        {/* Wallet Chip */}
        <div className="flex items-center">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 backdrop-blur-xs px-3 py-1 text-xs sm:text-sm font-semibold text-white border border-white/25 shadow-xs">
            <svg className="w-4 h-4 text-emerald-200" fill="currentColor" viewBox="0 0 20 20">
              <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
              <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zm-4 4a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            <span>Wallet: ₹{walletBalance}</span>
          </div>
        </div>
      </header>

      {/* Chat Messages Body */}
      <main className="flex-1 overflow-y-auto p-4 sm:px-6 space-y-3">
        {isLoadingBot ? (
          <div className="flex h-full items-center justify-center">
            <div className="rounded-lg bg-white/80 dark:bg-zinc-800/80 px-4 py-2 text-xs text-zinc-600 dark:text-zinc-300 shadow-xs">
              Loading chat...
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, index) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={index}
                  className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`relative max-w-[82%] sm:max-w-md rounded-2xl px-4 py-2.5 text-sm shadow-xs break-words whitespace-pre-wrap ${
                      isUser
                        ? 'bg-[#d9fdd3] dark:bg-[#005c4b] text-zinc-900 dark:text-zinc-50 rounded-tr-none'
                        : 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-tl-none border border-zinc-200/50 dark:border-zinc-700/50'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              );
            })}

            {/* Typing Indicator Bubble */}
            {isTyping && (
              <div className="flex w-full justify-start">
                <div className="relative max-w-[82%] sm:max-w-md rounded-2xl rounded-tl-none bg-white dark:bg-zinc-800 px-4 py-2.5 text-sm text-zinc-500 dark:text-zinc-400 italic shadow-xs border border-zinc-200/50 dark:border-zinc-700/50">
                  <span className="inline-flex items-center gap-1">
                    typing...
                    <span className="flex gap-0.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                  </span>
                </div>
              </div>
            )}

            {/* Invisible anchor to scroll down */}
            <div ref={messagesEndRef} />
          </>
        )}
      </main>

      {/* Input Bar */}
      <footer className="bg-[#f0f2f5] dark:bg-zinc-900 px-4 py-3 border-t border-zinc-200 dark:border-zinc-800">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSendMessage();
          }}
          className="flex items-center gap-2 max-w-4xl mx-auto"
        >
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            disabled={isTyping || isLoadingBot}
            className="flex-1 rounded-full bg-white dark:bg-zinc-800 px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-500 dark:placeholder-zinc-400 border border-zinc-300 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-[#075e54] dark:focus:ring-emerald-500 shadow-inner"
          />

          <button
            type="submit"
            disabled={!inputValue.trim() || isTyping || isLoadingBot}
            aria-label="Send message"
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#075e54] dark:bg-emerald-600 text-white shadow-md hover:bg-[#064e46] dark:hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </button>
        </form>
      </footer>
    </div>
  );
}

/**
 * Root Chat Page export wrapping ChatContent in Suspense as required by useSearchParams
 */
export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[#efeae2] dark:bg-zinc-950 font-sans">
          <div className="rounded-lg bg-white/80 dark:bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-600 dark:text-zinc-300 shadow-xs">
            Loading chat...
          </div>
        </div>
      }
    >
      <ChatContent />
    </Suspense>
  );
}
