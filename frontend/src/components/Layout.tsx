import Link from 'next/link';
import { ReactNode, useEffect, useState, useRef } from 'react';
import Sidebar from './Sidebar';
import { api } from '../lib/api';
import { useRouter } from 'next/router';

export default function Layout({ children, title }: { children: ReactNode; title?: string }) {
  const [user, setUser] = useState<{ id?: string; email?: string; role?: string; name?: string; username?: string } | null>(null);
  const router = useRouter();
  const ranRef = useRef(false);
  // Set from decoded token immediately (no network)
  useEffect(() => {
    setUser(api.getCurrentUser());
  }, []);
  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const t = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        if (!t) {
          if (!cancelled) setUser(null);
          return;
        }
        const me = await api.me();
        if (!cancelled) setUser(me || api.getCurrentUser());
      } catch {
        if (!cancelled) setUser(api.getCurrentUser());
      }
    })();
    return () => { cancelled = true; };
  }, []);
  // Refresh user info on route changes (e.g., after login redirect)
  useEffect(() => {
    const handler = async () => {
      const t = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (!t) { setUser(null); return; }
      // Fast update from token, then try to validate with backend
      setUser(api.getCurrentUser());
      try {
        const me = await api.me();
        setUser(me || api.getCurrentUser());
      } catch {
        // keep decoded user
      }
    };
    router.events.on('routeChangeComplete', handler);
    return () => { router.events.off('routeChangeComplete', handler); };
  }, [router.events]);
  return (
    <div className="min-h-screen flex bg-gray-100">
      <Sidebar />
      <div className="flex-1">
        <header className="h-14 border-b bg-white flex items-center justify-between px-4">
          <div className="font-semibold">{title || 'MotoApp Dashboard'}</div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-gray-600">
              {user ? (
                <span>
                  Sesión: {user.email || user.id || '—'}
                  {user.role ? ` · ${user.role === 'ADMIN' ? 'Admin' : user.role === 'PILOT' ? 'Pilot' : user.role === 'SPONSOR' ? 'Sponsor' : user.role === 'SPECTATOR' ? 'Spectator' : user.role}` : ''}
                </span>
              ) : (
                <span>Sesión: —</span>
              )}
            </div>
            <button
              className="px-2 py-1 rounded bg-gray-800 text-white text-xs"
              onClick={() => { api.logout(); router.replace('/login'); }}
            >Cerrar sesión</button>
          </div>
        </header>
        <main className="p-4">{children}</main>
      </div>
    </div>
  );
}
