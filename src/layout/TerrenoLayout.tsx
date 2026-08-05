import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { Briefcase, Clock, Fuel, LayoutDashboard, LogOut, Menu, TriangleAlert, X } from 'lucide-react';

import { useCurrentUser } from '../hooks/useCurrentUser';
import { signOut } from '../lib/auth-client';

const tabs = [
  { to: '/terreno/hallazgos', label: 'Hallazgos', icon: TriangleAlert },
  { to: '/terreno/combustible', label: 'Combustible', icon: Fuel },
  { to: '/terreno/horometro', label: 'Horómetro', icon: Clock },
  { to: '/terreno/trabajos-extra', label: 'Trabajos', icon: Briefcase },
];

function StatusPill() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/90">
      <span className={`h-2 w-2 rounded-full ${online ? 'bg-[#38d17a]' : 'bg-[#e0a11a]'}`} />
      {online ? 'En línea' : 'Sin conexión'}
    </span>
  );
}

export function TerrenoMobileLayout() {
  const { user, role } = useCurrentUser();
  const [menu, setMenu] = useState(false);
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#e9e7e2]">
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col bg-background shadow-[0_0_60px_rgba(13,12,10,0.08)]">
        {/* Header oscuro */}
        <header className="sticky top-0 z-20 flex items-center gap-3 rounded-b-3xl bg-[#0d0c0a] px-4 py-3.5 text-white">
          <button
            type="button"
            aria-label="Menú"
            onClick={() => setMenu(true)}
            className="-ml-1 rounded-lg p-1.5 text-white/90 hover:bg-white/10"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1 leading-none">
            <div className="font-display text-lg font-bold tracking-tight">SMI</div>
            <div className="mt-0.5 text-[10px] font-semibold tracking-wider text-white/50 uppercase">
              Operación en Terreno
            </div>
          </div>
          <StatusPill />
        </header>

        {/* Contenido */}
        <main className="flex-1 overflow-y-auto px-4 pt-4 pb-6">
          <Outlet />
        </main>

        {/* Tab bar inferior */}
        <nav className="sticky bottom-0 z-20 grid grid-cols-4 border-t border-border bg-card/95 pb-1 backdrop-blur">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <NavLink
                key={t.to}
                to={t.to}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition ${
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  }`
                }
              >
                <Icon className="h-5 w-5" />
                {t.label}
              </NavLink>
            );
          })}
        </nav>

        {/* Drawer */}
        {menu && (
          <>
            <button
              type="button"
              aria-label="Cerrar menú"
              onClick={() => setMenu(false)}
              className="absolute inset-0 z-30 bg-black/40"
            />
            <div className="absolute inset-y-0 left-0 z-40 flex w-64 flex-col bg-card p-5 shadow-xl">
              <div className="mb-6 flex items-center justify-between">
                <span className="font-display text-xl font-bold tracking-tight">SMI</span>
                <button type="button" onClick={() => setMenu(false)} aria-label="Cerrar" className="rounded-lg p-1 hover:bg-muted">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {user && (
                <div className="mb-4 rounded-xl bg-muted p-3">
                  <div className="text-sm font-semibold text-foreground">{user.name}</div>
                  <div className="text-xs text-muted-foreground">{role ?? user.email}</div>
                </div>
              )}

              <nav className="flex flex-col gap-1">
                {tabs.map((t) => {
                  const Icon = t.icon;
                  return (
                    <NavLink
                      key={t.to}
                      to={t.to}
                      onClick={() => setMenu(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${
                          isActive ? 'bg-[var(--accent-soft)] text-[var(--accent-soft-foreground)]' : 'hover:bg-muted'
                        }`
                      }
                    >
                      <Icon className="h-4 w-4" />
                      {t.label}
                    </NavLink>
                  );
                })}
              </nav>

              <div className="mt-auto flex flex-col gap-1 border-t border-border pt-3">
                <NavLink
                  to="/"
                  onClick={() => setMenu(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-muted"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Ir al panel
                </NavLink>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--danger)] hover:bg-[var(--danger-soft)]"
                >
                  <LogOut className="h-4 w-4" />
                  Salir
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
