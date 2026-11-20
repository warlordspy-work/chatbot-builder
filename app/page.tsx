'use client';

/**
 * Chatbot Builder Page
 * 
 * Allows business owners to generate an AI WhatsApp chatbot by providing
 * business description and a text-based menu.
 * Displays generated bot configurations, feature toggles, menu with rupee prices,
 * active voucher codes, a link to open customer chat, and real-time live orders.
 */

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

// --- Type Definitions ---

/**
 * Menu item with name and price in rupees
 */
interface MenuItem {
  name: string;
  price: number;
}

/**
 * Voucher configuration
 */
interface Voucher {
  code: string;
  percentOff?: number;
  firstOrderOnly?: boolean;
}

/**
 * Feature flags for the chatbot
 */
interface BotFeatures {
  menuOrdering?: boolean;
  wallet?: boolean;
  vouchers?: boolean;
}

/**
 * Bot configuration returned by the AI builder endpoint
 */
interface BotConfig {
  businessName?: string;
  greeting?: string;
  tone?: string;
  features?: BotFeatures;
  menu?: MenuItem[];
  voucher?: Voucher | null;
}

/**
 * Bot model returned by Supabase
 */
interface Bot {
  id: string | number;
  owner_prompt?: string;
  config: BotConfig;
  created_at?: string;
}

/**
 * Demo customer model returned by the builder endpoint
 */
interface Customer {
  id: string | number;
  name?: string;
  wallet_balance?: number;
  bot_id?: string | number;
}

/**
 * Represents a single item inside an order
 */
interface OrderItem {
  name?: string;
  item?: string;
  title?: string;
  price?: number;
  quantity?: number;
  qty?: number;
}

/**
 * Order record returned by /api/orders
 */
interface Order {
  id: string | number;
  bot_id?: string | number;
  items?: string | OrderItem[] | Record<string, unknown>;
  total?: number;
  total_amount?: number;
  amount?: number;
  created_at?: string;
  time?: string;
  timestamp?: string;
}

/**
 * Reusable iOS-style Toggle Switch component
 */
interface ToggleSwitchProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function ToggleSwitch({ label, checked, onChange }: ToggleSwitchProps) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
          checked ? 'bg-emerald-600' : 'bg-zinc-300 dark:bg-zinc-700'
        }`}
      >
        <span className="sr-only">{label}</span>
        <span
          aria-hidden="true"
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

/**
 * Helper to render order items cleanly whether they are arrays, strings, or JSON objects
 */
function formatOrderItems(items: Order['items']): string {
  if (!items) return 'No items';

  if (typeof items === 'string') {
    try {
      const parsed = JSON.parse(items);
      return formatOrderItems(parsed);
    } catch {
      return items;
    }
  }

  if (Array.isArray(items)) {
    return items
      .map((item) => {
        if (typeof item === 'string') return item;
        if (typeof item === 'object' && item !== null) {
          const name = item.name || item.item || item.title || 'Item';
          const qty = item.quantity || item.qty;
          const price = item.price !== undefined ? ` (₹${item.price})` : '';
          return qty ? `${name} × ${qty}${price}` : `${name}${price}`;
        }
        return String(item);
      })
      .join(', ');
  }

  if (typeof items === 'object') {
    return Object.entries(items)
      .map(([key, val]) => `${key}: ${val}`)
      .join(', ');
  }

  return String(items);
}

/**
 * Helper to format order total price with rupee symbol
 */
function formatOrderTotal(order: Order): string {
  const total = order.total ?? order.total_amount ?? order.amount;
  if (total !== undefined && total !== null) {
    return `₹${total}`;
  }
  return '—';
}

/**
 * Helper to format order creation time into a readable local time string
 */
function formatOrderTime(order: Order): string {
  const timeField = order.created_at || order.time || order.timestamp;
  if (!timeField) return '—';

  try {
    const date = new Date(timeField);
    if (isNaN(date.getTime())) {
      return String(timeField);
    }
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return String(timeField);
  }
}

// --- Main Chatbot Builder Component ---

export default function ChatbotBuilderPage() {
  // Input form state
  const [prompt, setPrompt] = useState<string>('');
  const [menuText, setMenuText] = useState<string>('');

  // Generation status state
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Generated bot and demo customer response data
  const [bot, setBot] = useState<Bot | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);

  // Toggle switch states (initialized from bot.config.features)
  const [features, setFeatures] = useState<BotFeatures>({
    menuOrdering: false,
    wallet: false,
    vouchers: false,
  });

  // Orders list state
  const [orders, setOrders] = useState<Order[]>([]);

  // Capture bot.id for dependency array
  const botId = bot?.id;

  /**
   * Set up polling for orders every 5 seconds when a bot is active
   */
  useEffect(() => {
    if (!botId) return;

    let isSubscribed = true;

    async function loadOrders() {
      try {
        const response = await fetch(`/api/orders?botId=${encodeURIComponent(botId!)}`);
        if (!response.ok) return;
        const data = await response.json().catch(() => null);
        if (data && isSubscribed) {
          setOrders(data.orders || []);
        }
      } catch (err) {
        console.error('Error fetching orders:', err);
      }
    }

    // Trigger initial fetch
    void loadOrders();

    // Poll every 5 seconds
    const intervalId = setInterval(() => {
      void loadOrders();
    }, 5000);

    return () => {
      isSubscribed = false;
      clearInterval(intervalId);
    };
  }, [botId]);

  /**
   * Handle chatbot generation form submission
   */
  const handleGenerateChatbot = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/builder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt, menuText }),
      });

      let data: { bot?: Bot; customer?: Customer; error?: string } | null = null;
      try {
        data = await response.json();
      } catch {
        // If response is not JSON (e.g., server crash or HTML error page), retrieve text
        const textFallback = await response.text().catch(() => '');
        setErrorMessage(
          textFallback || `Server returned error (${response.status}). Please check API keys and configuration.`
        );
        return;
      }

      if (!response.ok || !data) {
        setErrorMessage(data?.error || `Server request failed with status ${response.status}.`);
        return;
      }

      // Successfully generated chatbot
      setBot(data.bot ?? null);
      setCustomer(data.customer ?? null);

      // Reflect bot.config.features in the toggle switches
      const botFeatures = data.bot?.config?.features || {};
      setFeatures({
        menuOrdering: Boolean(botFeatures.menuOrdering),
        wallet: Boolean(botFeatures.wallet),
        vouchers: Boolean(botFeatures.vouchers),
      });
    } catch (err: unknown) {
      const errorStr = err instanceof Error ? err.message : 'Network error occurred.';
      setErrorMessage(errorStr);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <header className="border-b border-zinc-200 dark:border-zinc-800 pb-5">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Chatbot Builder
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Describe your business and menu to generate an intelligent WhatsApp ordering chatbot in seconds.
          </p>
        </header>

        {/* Builder Input Section */}
        <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6 sm:p-8">
          <form onSubmit={handleGenerateChatbot} className="space-y-6">
            {/* Business & Chatbot Description Textarea */}
            <div>
              <label
                htmlFor="prompt"
                className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-2"
              >
                Describe your business and chatbot
              </label>
              <textarea
                id="prompt"
                rows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. We are a cozy Italian pizzeria called Bella Napoli. We want a friendly WhatsApp bot that takes customer orders, allows wallet payments, and offers 10% discount voucher for first time orders."
                required
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
              />
            </div>

            {/* Menu Textarea */}
            <div>
              <label
                htmlFor="menuText"
                className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-2"
              >
                Paste your menu (one item and price per line)
              </label>
              <textarea
                id="menuText"
                rows={5}
                value={menuText}
                onChange={(e) => setMenuText(e.target.value)}
                placeholder="Margherita Pizza - 299&#10;Farmhouse Pizza - 399&#10;Garlic Breadsticks - 149&#10;Cold Coffee - 99"
                required
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors font-mono"
              />
            </div>

            {/* Error Message Display */}
            {errorMessage && (
              <div
                role="alert"
                className="rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-300"
              >
                <div className="flex items-center gap-2 font-medium">
                  <svg className="w-5 h-5 flex-shrink-0 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span>{errorMessage}</span>
                </div>
              </div>
            )}

            {/* Submit / Generate Button */}
            <div>
              <button
                type="submit"
                disabled={isGenerating}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isGenerating ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating...
                  </>
                ) : (
                  'Generate chatbot'
                )}
              </button>
            </div>
          </form>
        </section>

        {/* Results Section: Visible when bot and customer are returned */}
        {bot && customer && (
          <div className="space-y-8 animate-fadeIn">
            {/* Generated Chatbot Details */}
            <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
                <div>
                  <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                    {bot.config?.businessName || 'Business Chatbot'}
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Bot ID: {bot.id} &bull; Demo Customer ID: {customer.id}
                  </p>
                </div>

                {/* Open customer chat button */}
                <div>
                  <Link
                    href={`/chat/${bot.id}?customer=${customer.id}`}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 transition-colors"
                  >
                    <span>Open customer chat</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </Link>
                </div>
              </div>

              {/* Greeting */}
              <div className="rounded-lg bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 p-4">
                <span className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                  Greeting
                </span>
                <p className="text-zinc-800 dark:text-zinc-200 italic font-sans text-sm sm:text-base">
                  &ldquo;{bot.config?.greeting || 'Hello! How can I help you today?'}&rdquo;
                </p>
              </div>

              {/* Three Toggle Switches for Features */}
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 divide-y divide-zinc-200 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
                <span className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
                  Bot Features
                </span>
                <ToggleSwitch
                  label="Menu ordering"
                  checked={Boolean(features.menuOrdering)}
                  onChange={(val) => setFeatures((prev) => ({ ...prev, menuOrdering: val }))}
                />
                <ToggleSwitch
                  label="Wallet"
                  checked={Boolean(features.wallet)}
                  onChange={(val) => setFeatures((prev) => ({ ...prev, wallet: val }))}
                />
                <ToggleSwitch
                  label="Vouchers"
                  checked={Boolean(features.vouchers)}
                  onChange={(val) => setFeatures((prev) => ({ ...prev, vouchers: val }))}
                />
              </div>

              {/* Voucher Code Display (if any) */}
              {bot.config?.voucher?.code && (
                <div className="flex flex-wrap items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                    Voucher Code:
                  </span>
                  <span className="inline-block px-3 py-1 bg-white dark:bg-zinc-900 border border-emerald-300 dark:border-emerald-700 rounded-md font-mono font-bold text-emerald-700 dark:text-emerald-300 text-sm tracking-wide shadow-xs">
                    {bot.config.voucher.code}
                  </span>
                  {bot.config.voucher.percentOff !== undefined && (
                    <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                      ({bot.config.voucher.percentOff}% off
                      {bot.config.voucher.firstOrderOnly ? ', first order only' : ''})
                    </span>
                  )}
                </div>
              )}

              {/* Menu List with prices in rupees */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                  Menu
                </h3>
                {bot.config?.menu && bot.config.menu.length > 0 ? (
                  <ul className="divide-y divide-zinc-200 dark:divide-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-950">
                    {bot.config.menu.map((item, index) => (
                      <li
                        key={index}
                        className="flex items-center justify-between px-4 py-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                      >
                        <span className="font-medium text-zinc-800 dark:text-zinc-200">
                          {item.name}
                        </span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          ₹{item.price}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-zinc-500 italic">No menu items found.</p>
                )}
              </div>
            </section>

            {/* Orders Section */}
            <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6 sm:p-8 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
                    Orders
                  </h2>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Auto-updating (5s)
                  </span>
                </div>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {orders.length} {orders.length === 1 ? 'order' : 'orders'}
                </span>
              </div>

              {/* Order List */}
              {orders.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-zinc-50 dark:bg-zinc-950 text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                      <tr>
                        <th scope="col" className="px-4 py-3">Items</th>
                        <th scope="col" className="px-4 py-3 text-right">Total</th>
                        <th scope="col" className="px-4 py-3 text-right">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                      {orders.map((order, idx) => (
                        <tr
                          key={order.id ?? idx}
                          className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40 transition-colors"
                        >
                          <td className="px-4 py-3 text-zinc-800 dark:text-zinc-200 font-medium">
                            {formatOrderItems(order.items)}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                            {formatOrderTotal(order)}
                          </td>
                          <td className="px-4 py-3 text-right text-zinc-500 dark:text-zinc-400 font-mono text-xs">
                            {formatOrderTime(order)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-10 text-zinc-500 dark:text-zinc-400 text-sm">
                  <p>No orders yet. Customer orders will appear here automatically.</p>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
