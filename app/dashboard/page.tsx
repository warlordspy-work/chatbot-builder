import { Suspense } from 'react';
import DashboardClient from './dashboard-client';

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="grid min-h-dvh place-items-center text-muted">Loading dashboard…</div>}>
      <DashboardClient />
    </Suspense>
  );
}
