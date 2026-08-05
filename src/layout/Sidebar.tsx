import { NavLink } from 'react-router-dom';

import { useUiStore } from '../store/ui';
import { NAV_ITEMS } from '../config/nav-items';
import type { Role } from '../types/roles';

export interface SidebarProps {
  role: Role | null;
}

export function Sidebar({ role }: SidebarProps) {
  const isSidebarOpen = useUiStore((state) => state.isSidebarOpen);
  const setSidebarOpen = useUiStore((state) => state.setSidebarOpen);

  const visibleItems = role ? NAV_ITEMS.filter((item) => item.roles.includes(role)) : [];

  return (
    <>
      {isSidebarOpen ? (
        <button
          aria-label="Cerrar menú"
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
          type="button"
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 inset-s-0 z-30 flex w-64 shrink-0 flex-col border-e border-border bg-surface-secondary transition-transform md:static md:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header de marca — mismo tratamiento oscuro que el shell de las
            referencias (barra superior #0D0C0A con la marca de 3 trazos). */}
        <div className="flex h-14 shrink-0 items-center gap-3 bg-foreground px-4">
          <div className="flex w-5 shrink-0 flex-col gap-0.75">
            <span className="h-0.5 w-5 bg-surface" />
            <span className="h-0.5 w-3.5 bg-accent" />
            <span className="h-0.5 w-5 bg-surface" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="font-display text-[15px] leading-none font-semibold tracking-tight text-surface">
              SMI
            </span>
            <span className="text-[10px] leading-none tracking-widest text-white/50 uppercase">
              Mantenimiento e inventario
            </span>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {visibleItems.map((item) => (
            <NavLink
              className={({ isActive }) =>
                `rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-accent-soft text-accent-soft-foreground'
                    : 'text-(--label-color) hover:bg-default-hover hover:text-foreground'
                }`
              }
              end={item.to === '/'}
              key={item.to}
              onClick={() => setSidebarOpen(false)}
              to={item.to}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}
