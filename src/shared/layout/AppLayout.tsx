import { useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import { useAuthStore, type Rol } from '../store/auth.store';

const nav = [
  { to: '/terreno/combustible', label: 'Combustible' },
  { to: '/terreno/horometro', label: 'Horómetro' },
  { to: '/terreno/trabajos-extra', label: 'Trabajos extra' },
  { to: '/terreno/hallazgos', label: 'Hallazgos' },
];

const roles: Rol[] = ['ADMIN', 'SUPERVISOR', 'MANTENEDOR', 'OPERADOR'];

export function AppLayout() {
  const { rol, setRol } = useAuthStore();
  const [open, setOpen] = useState(false);

  const sidebarBody = (
    <div className="flex h-full flex-col p-4">
      <h2 className="text-lg font-semibold">SMI</h2>
      <p className="mb-4 text-xs text-muted-foreground">Operación en Terreno</p>
      <nav className="flex flex-col gap-1">
        {nav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`
            }
          >
            {n.label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-6">
        {/* PROVISIONAL — selector de rol para el guard stub. Reemplazar por Better Auth. */}
        <label className="text-xs text-muted-foreground">Rol (dev)</label>
        <select
          value={rol}
          onChange={(e) => setRol(e.target.value as Rol)}
          className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-sm"
        >
          {roles.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground md:flex">
      {/* Barra superior (solo móvil) */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-sidebar px-4 py-3 md:hidden">
        <button
          type="button"
          aria-label="Abrir menú"
          onClick={() => setOpen(true)}
          className="rounded-lg px-2 py-1 text-xl leading-none hover:bg-muted"
        >
          ☰
        </button>
        <span className="font-semibold">SMI</span>
        <span className="text-xs text-muted-foreground">Operación en Terreno</span>
      </header>

      {/* Overlay del drawer (solo móvil) */}
      {open && (
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
        />
      )}

      {/* Sidebar: drawer deslizable en móvil, fijo en desktop */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 border-r border-border bg-sidebar transition-transform md:static md:z-auto md:w-60 md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarBody}
      </aside>

      <main className="min-w-0 flex-1 p-4 md:p-6">
        <Outlet />
      </main>
    </div>
  );
}
