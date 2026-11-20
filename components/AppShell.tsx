import Link from 'next/link';
import Icon, { type IconName } from './Icon';
import LogoutButton from './LogoutButton';

export type NavKey = 'overview' | 'chatbots' | 'builder' | 'conversations' | 'orders' | 'menu' | 'analytics' | 'settings';

type NavItem = { key: NavKey; label: string; icon: IconName };

function hrefFor(key: NavKey, botId?: string | null): string {
  if (key === 'builder') return '/';
  const bot = botId ? `&bot=${botId}` : '';
  return key === 'overview' ? `/dashboard${botId ? `?bot=${botId}` : ''}` : `/dashboard?view=${key}${bot}`;
}

const WORKSPACE: NavItem[] = [
  { key: 'overview', label: 'Overview', icon: 'grid' },
  { key: 'chatbots', label: 'My Chatbots', icon: 'bot' },
  { key: 'builder', label: 'AI Bot Builder', icon: 'sparkle' },
];

const MANAGE: NavItem[] = [
  { key: 'conversations', label: 'Conversations', icon: 'chat' },
  { key: 'orders', label: 'Orders', icon: 'receipt' },
  { key: 'menu', label: 'Menu & Offers', icon: 'list' },
  { key: 'analytics', label: 'Analytics', icon: 'chart' },
];

const ACCOUNT: NavItem[] = [{ key: 'settings', label: 'Settings', icon: 'gear' }];

function NavLink({
  item,
  active,
  botId,
}: {
  item: NavItem;
  active: NavKey;
  botId?: string | null;
}) {
  const on = item.key === active;
  return (
    <Link
      href={hrefFor(item.key, botId)}
      aria-current={on ? 'page' : undefined}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors ${
        on
          ? 'bg-brand-soft text-brand'
          : 'text-muted hover:bg-panel hover:text-foreground'
      }`}
    >
      <Icon name={item.icon} className="h-[18px] w-[18px]" />
      {item.label}
    </Link>
  );
}

export default function AppShell({
  active,
  crumb,
  botId,
  children,
}: {
  active: NavKey;
  crumb: string;
  botId?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
      {/* Sidebar (desktop) */}
      <aside className="hidden border-r border-line bg-sidebar lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:p-4">
        <Link href="/" className="mb-6 flex items-center gap-3 px-1 pt-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-mark-sm.png"
            alt=""
            width={44}
            height={44}
            className="h-11 w-11 rounded-xl bg-white"
          />
          <span className="leading-tight">
            <span className="block text-[17px] font-bold">Chatbot Builder</span>
            <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-brand">
              WhatsApp automation
            </span>
          </span>
        </Link>

        <nav aria-label="Main" className="flex flex-1 flex-col gap-1 overflow-y-auto">
          <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
            Workspace
          </p>
          {WORKSPACE.map((n) => (
            <NavLink key={n.key} item={n} active={active} botId={botId} />
          ))}

          <p className="px-3 pb-1 pt-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
            Manage
          </p>
          {MANAGE.map((n) => (
            <NavLink key={n.key} item={n} active={active} botId={botId} />
          ))}

          <p className="px-3 pb-1 pt-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
            Account
          </p>
          {ACCOUNT.map((n) => (
            <NavLink key={n.key} item={n} active={active} botId={botId} />
          ))}
        </nav>

        <div className="mt-4 rounded-2xl border border-line bg-panel p-4">
          <p className="text-[14px] font-semibold">✨ Your AI assistant awaits</p>
          <p className="mt-1 text-[13px] leading-snug text-muted">
            Describe a business in plain words and get a working WhatsApp chatbot.
          </p>
          <Link
            href="/"
            className="mt-3 inline-flex items-center gap-1 rounded-lg bg-brand-soft px-3 py-2 text-[13px] font-semibold text-brand hover:bg-[#1c3b26]"
          >
            Create a bot →
          </Link>
        </div>

        <div className="mt-4 flex items-center gap-3 border-t border-line px-1 pt-4">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-soft text-[13px] font-bold text-brand">
            WT
          </span>
          <span className="leading-tight">
            <span className="block text-[14px] font-semibold">Warlordspy Tech</span>
            <span className="block text-[13px] text-muted">Prototype workspace</span>
          </span>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="flex items-center justify-between border-b border-line px-4 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            {/* Brand shown here only when the sidebar is hidden */}
            <Link href="/" className="flex items-center gap-2 lg:hidden" aria-label="Chatbot Builder home">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-mark-sm.png" alt="" width={32} height={32} className="h-8 w-8 rounded-lg bg-white" />
            </Link>
            <p className="text-[15px] text-muted">
              Workspace <span className="px-1.5 text-line">/</span>
              <span className="font-semibold text-foreground">{crumb}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1.5 text-[13px] font-semibold text-brand">
              <span className="h-2 w-2 rounded-full bg-brand" aria-hidden="true" />
              Demo mode
            </span>
            <LogoutButton />
            <span
              className="grid h-9 w-9 place-items-center rounded-full bg-panel-2 text-[12px] font-bold"
              aria-hidden="true"
            >
              WT
            </span>
          </div>
        </header>

        {/* Section nav (mobile) */}
        <nav
          aria-label="Sections"
          className="flex gap-2 overflow-x-auto border-b border-line px-4 py-2 lg:hidden"
        >
          {[...WORKSPACE, ...MANAGE, ...ACCOUNT].map((n) => (
            <Link
              key={n.key}
              href={hrefFor(n.key, botId)}
              aria-current={n.key === active ? 'page' : undefined}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-medium ${
                n.key === active ? 'bg-brand-soft text-brand' : 'text-muted'
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 py-8 sm:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
