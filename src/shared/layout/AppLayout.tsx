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
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="w-60 shrink-0 border-r border-border bg-sidebar p-4">
        <h2 className="text-lg font-semibold">SMI</h2>
        <p className="mb-4 text-xs text-muted-foreground">Operación en Terreno</p>
        <nav className="flex flex-col gap-1">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
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
      </aside>
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}
