import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { Briefcase, Clock, Fuel, LayoutDashboard, LogOut, Menu, TriangleAlert, X } from 'lucide-react';

import { useCurrentUser } from '../hooks/useCurrentUser';
import { DESKTOP_QUERY, useMediaQuery } from '../hooks/useMediaQuery';
import { logout } from '../lib/logout';

const tabs = [
  { to: '/terreno/hallazgos', label: 'Hallazgos', icon: TriangleAlert },
  { to: '/terreno/combustible', label: 'Combustible', icon: Fuel },
  { to: '/terreno/horometro', label: 'Horómetro', icon: Clock },
  { to: '/terreno/trabajos-extra', label: 'Trabajos', icon: Briefcase },
];

/**
 * Ancho del contenido. Lo comparten el header, el `main` y la barra inferior
 * para que el título, el formulario y las pestañas queden en la misma columna.
 *
 * En teléfono son los mismos 448 px de siempre: es la pantalla donde se opera
 * en faena y no se toca. Desde `sm` el módulo deja de estar encajonado, y desde
 * `lg` se ensancha para las dos columnas —formulario e historial— que arman las
 * vistas: el formulario conserva su ancho y el sobrante se lo lleva la tabla.
 *
 * El techo igual existe: sin él, en un monitor de 1920 el formulario quedaría
 * de punta a punta, que es tan malo como la columna angosta pero al revés.
 */
const CONTAINER = 'mx-auto w-full max-w-md sm:max-w-2xl lg:max-w-6xl';

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

export function TerrenoLayout() {
  const { user, role } = useCurrentUser();
  const [menu, setMenu] = useState(false);
  const navigate = useNavigate();

  /**
   * Los cuatro destinos viven en UN solo lugar según el tamaño: barra inferior
   * en teléfono y tablet —donde llega el pulgar— y header desde `lg`, porque
   * una barra de cuatro pestañas estirada a lo ancho de un monitor se ve rota.
   *
   * Se monta una de las dos, no las dos con una tapada por CSS: son los mismos
   * cuatro enlaces, y duplicarlos en el DOM haría que un lector de pantalla
   * leyera la navegación dos veces. Es el caso que `useMediaQuery` documenta;
   * todo lo demás de esta pantalla es estilo y va con clases `sm:`/`lg:`.
   */
  const navEnHeader = useMediaQuery(DESKTOP_QUERY);

  const handleSignOut = async () => {
    // `logout()` (`lib/logout.ts`) hace signOut + limpia TanStack Query y
    // Cache Storage privado + navega — ver ese archivo para el porqué
    // (SEGURIDAD M1, review QA del RFC R2-storage).
    await logout(navigate);
  };

  return (
    <div className="min-h-screen bg-[#e9e7e2] sm:bg-background">
      {/* El marco de "teléfono sobre fondo gris" (ancho fijo + sombra + esquinas
          redondeadas) solo tiene sentido mientras el shell es más angosto que la
          pantalla. Desde `sm` el shell ocupa el ancho y el marco sobra. */}
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col bg-background shadow-[0_0_60px_rgba(13,12,10,0.08)] sm:max-w-none sm:shadow-none">
        {/* Header oscuro */}
        <header className="sticky top-0 z-20 rounded-b-3xl bg-[#0d0c0a] text-white sm:rounded-none">
          <div className={`${CONTAINER} flex items-center gap-3 px-4 py-3.5`}>
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

            {navEnHeader && (
              <nav aria-label="Secciones de Terreno" className="flex items-center gap-1">
                {tabs.map((t) => {
                  const Icon = t.icon;
                  return (
                    <NavLink
                      key={t.to}
                      to={t.to}
                      className={({ isActive }) =>
                        `flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                          isActive ? 'bg-white/15 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'
                        }`
                      }
                    >
                      <Icon className="h-4 w-4" />
                      {t.label}
                    </NavLink>
                  );
                })}
              </nav>
            )}

            <StatusPill />
          </div>
        </header>

        {/* Contenido */}
        <main className="flex-1 overflow-y-auto">
          <div className={`${CONTAINER} px-4 pt-4 pb-6`}>
            <Outlet />
          </div>
        </main>

        {/* Tab bar inferior */}
        {!navEnHeader && (
          <nav
            aria-label="Secciones de Terreno"
            className="sticky bottom-0 z-20 border-t border-border bg-card/95 backdrop-blur"
          >
            <div className={`${CONTAINER} grid grid-cols-4 pb-1`}>
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
            </div>
          </nav>
        )}

        {/* Drawer. Sigue existiendo en todos los tamaños porque guarda lo que no
            está en las pestañas: quién está conectado, "Ir al panel" y "Salir". */}
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

              {/* En teléfono el drawer repite las secciones porque es el menú
                  completo. Desde `lg` ya están en el header: repetirlas acá las
                  dejaría dos veces en el DOM. */}
              {!navEnHeader && (
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
              )}

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
