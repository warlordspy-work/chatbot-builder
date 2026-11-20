// Types and small helpers shared by the dashboard, builder and chat screens.

export type Features = {
  menuOrdering?: boolean;
  wallet?: boolean;
  vouchers?: boolean;
};

export type MenuItem = { name: string; price: number };

export type BotConfig = {
  businessName?: string;
  greeting?: string;
  tone?: string;
  features?: Features;
  menu?: MenuItem[];
  voucher?: { code: string; percentOff: number; firstOrderOnly?: boolean } | null;
};

export type BotRow = {
  id: string;
  config: BotConfig;
  published: boolean;
  created_at: string;
  customerId: string | null;
};

export type OrderRow = {
  id: string;
  bot_id: string;
  items: { name: string; qty: number }[] | null;
  subtotal: number;
  discount: number;
  total: number;
  paid_from_wallet: boolean;
  created_at: string;
};

export const FEATURE_LABELS: { key: keyof Features; label: string; hint: string }[] = [
  { key: 'menuOrdering', label: 'Menu ordering', hint: 'Customers browse the menu and place orders in chat.' },
  { key: 'wallet', label: 'Wallet', hint: 'Customers pay from a prepaid wallet balance.' },
  { key: 'vouchers', label: 'Discount vouchers', hint: 'Customers can apply codes such as FIRST10.' },
];

export function rupees(n: number | string | null | undefined): string {
  return '₹' + Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export function enabledCount(f: Features | undefined): number {
  return Object.values(f ?? {}).filter(Boolean).length;
}

export function orderItemsLabel(items: OrderRow['items']): string {
  if (!items || items.length === 0) return 'No items';
  return items.map((i) => `${i.qty} × ${i.name}`).join(', ');
}

export function shortId(id: string): string {
  return '#ORD-' + id.replace(/-/g, '').slice(0, 4).toUpperCase();
}

export function formatDay(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const same = d.toDateString() === today.toDateString();
  return same ? 'Today' : d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** Read JSON from a fetch response, even when the server sent an HTML error page. */
export async function readJson<T = Record<string, unknown>>(
  res: Response
): Promise<{ ok: boolean; status: number; data: T & { error?: string; detail?: string } }> {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, data: JSON.parse(text) };
  } catch {
    return {
      ok: false,
      status: res.status,
      data: { error: `The server sent an unexpected reply (status ${res.status}).`, detail: text.slice(0, 300) } as T & { error?: string; detail?: string },
    };
  }
}
