'use client';

import { useRouter } from 'next/navigation';

export default function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }
  return (
    <button
      type="button"
      onClick={logout}
      className="rounded-full border border-line bg-panel px-3 py-1.5 text-[13px] font-semibold text-muted hover:text-foreground"
    >
      Sign out
    </button>
  );
}
