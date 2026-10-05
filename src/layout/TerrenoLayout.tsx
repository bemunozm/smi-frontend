import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { Briefcase, ClipboardCheck, FileText, LayoutDashboard, LogOut, Menu, TriangleAlert, X } from 'lucide-react';

import { useLogoutConfirmation } from '../components/sync/useLogoutConfirmation';
import { SyncStatus } from '../components/terreno/SyncStatus';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { DESKTOP_QUERY, useMediaQuery } from '../hooks/useMediaQuery';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { CONTAINER } from './terreno-container';

/**
 * Los cuatro destinos del módulo, en el orden de la maqueta. La etiqueta larga
 * va en el header y en el drawer; la corta, en la barra inferior, donde cada
 * pestaña tiene un cuarto de pantalla.
 *
 * Combustible y Horómetro ya no están: la especificación del 21/09 las fusiona
 * en «Registro de equipo» —una tarjeta por equipo, con apertura y cierre de
 * turno—. Sus rutas siguen existiendo sin estar enlazadas, porque son las dos
 * únicas con backend real; ver el comentario en `routes.tsx`.
 */
const tabs = [
  { to: '/terreno/registro', label: 'Registro de equipo', corto: 'Registro', icon: ClipboardCheck },
  { to: '/terreno/reporte-diario', label: 'Reporte diario', corto: 'Reporte', icon: FileText },
  { to: '/terreno/trabajos-extra', label: 'Trabajos extra', corto: 'Trabajos', icon: Briefcase },
  { to: '/terreno/hallazgos', label: 'Hallazgos', corto: 'Hallazgos', icon: TriangleAlert },
];

function StatusPill({ enLinea }: { enLinea: boolean }) {
  return (
    <span
      className={`inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-semibold ${
        enLinea ? 'bg-white/10 text-white' : 'bg-[#e0a11a]/16 text-[#ffd88a]'
      }`}
    >
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{
          background: enLinea ? 'var(--terreno-online)' : 'var(--terreno-offline)',
          boxShadow: `0 0 0 3px ${enLinea ? 'rgba(56,209,122,.22)' : 'rgba(224,161,26,.25)'}`,
        }}
      />
      {enLinea ? 'En línea' : 'Sin conexión'}
    </span>
  );
}

export function TerrenoLayout() {
  const { user, role } = useCurrentUser();
  const [menu, setMenu] = useState(false);
  const enLinea = useOnlineStatus();
  const navigate = useNavigate();
  const { requestLogout, confirmationDialog } = useLogoutConfirmation(user?.id, navigate);

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

  return (
    <div className="min-h-screen" style={{ background: 'var(--terreno-warm)' }}>
      {/* El marco de "teléfono sobre fondo gris" (ancho fijo + sombra + esquinas
          redondeadas) solo tiene sentido mientras el shell es más angosto que la
          pantalla. Desde `sm` el shell ocupa el ancho y el marco sobra. */}
      <div
        className="relative mx-auto flex min-h-screen w-full max-w-md flex-col shadow-[0_0_60px_rgba(13,12,10,0.08)] sm:max-w-none sm:shadow-none"
        style={{ background: 'var(--terreno-shell)' }}
      >
        <header
          className="sticky top-0 z-20 rounded-b-3xl text-white sm:rounded-none"
          style={{ background: 'var(--terreno-head)' }}
        >
          <div className={`${CONTAINER} flex items-center gap-3 py-3.5 lg:gap-5 lg:py-3`}>
            <button
              type="button"
              aria-label="Menú"
              onClick={() => setMenu(true)}
              className="-ml-2 grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white/90 hover:bg-white/10"
            >
              <Menu className="h-[22px] w-[22px]" />
            </button>

            <div className="flex flex-1 flex-col gap-1 leading-none lg:flex-none">
              <span className="font-display text-2xl font-bold tracking-[-0.02em]">SMI</span>
              <span className="text-[10.5px] font-semibold tracking-[0.14em] text-white/60 uppercase">
                Operación en terreno
              </span>
            </div>

            {navEnHeader && (
              <nav aria-label="Secciones de Terreno" className="mr-auto flex items-center gap-1">
                {tabs.map((t) => {
                  const Icon = t.icon;
                  return (
                    <NavLink
                      key={t.to}
                      to={t.to}
                      className={({ isActive }) =>
                        `flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
                          isActive ? 'bg-white/15 text-white' : 'text-white/[.66] hover:bg-white/10 hover:text-white'
                        }`
                      }
                    >
                      <Icon className="h-[17px] w-[17px]" />
                      {t.label}
                    </NavLink>
                  );
                })}
              </nav>
            )}

            <StatusPill enLinea={enLinea} />
          </div>
        </header>

        {/* Siempre visible (no solo sin señal): el estado real de sincronización,
            incluido "todo sincronizado", vale la pena verlo en línea y fuera de
            ella (ver `components/terreno/SyncStatus.tsx`). */}
        <SyncStatus />

        <main className="flex-1 overflow-y-auto">
          <div className={`${CONTAINER} pt-[18px] pb-7 lg:pt-6 lg:pb-10`}>
            <Outlet />
          </div>
        </main>

        {!navEnHeader && (
          <nav
            aria-label="Secciones de Terreno"
            className="sticky bottom-0 z-20 flex-none border-t bg-white/[.97] backdrop-blur"
            style={{ borderColor: 'var(--border)' }}
          >
            <div className={`${CONTAINER} grid !px-1.5`}
              style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
              {tabs.map((t) => {
                const Icon = t.icon;
                return (
                  <NavLink
                    key={t.to}
                    to={t.to}
                    className={({ isActive }) =>
                      `flex min-h-16 flex-col items-center gap-1 px-0.5 pt-2.5 pb-3 text-xs font-semibold transition ${
                        isActive ? 'text-primary' : 'text-muted-foreground'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon className="h-[23px] w-[23px]" strokeWidth={isActive ? 2.4 : 2} />
                        {t.corto}
                      </>
                    )}
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
              className="absolute inset-0 z-30 bg-[#0d0c0a]/45"
            />
            <div className="absolute inset-y-0 left-0 z-40 flex w-70 flex-col gap-1.5 bg-card p-[22px_18px] shadow-[10px_0_40px_rgba(13,12,10,0.2)]">
              <div className="flex items-center justify-between">
                <span className="font-display text-[22px] font-bold tracking-tight">SMI</span>
                <button
                  type="button"
                  onClick={() => setMenu(false)}
                  aria-label="Cerrar"
                  className="grid h-11 w-11 place-items-center rounded-xl bg-muted"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {user && (
                <div className="my-2.5 rounded-xl bg-muted p-3">
                  <div className="text-sm font-semibold text-foreground">{user.name}</div>
                  <div className="text-[13px] text-muted-foreground">{role ?? user.email}</div>
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
                          `flex min-h-12 items-center gap-3 rounded-xl px-3 text-[15px] font-medium ${
                            isActive
                              ? 'bg-[var(--accent-soft)] font-semibold text-[var(--accent-soft-foreground)]'
                              : 'hover:bg-muted'
                          }`
                        }
                      >
                        <Icon className="h-[19px] w-[19px]" />
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
                  className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-[15px] font-medium hover:bg-muted"
                >
                  <LayoutDashboard className="h-[19px] w-[19px]" />
                  Ir al panel
                </NavLink>
                <button
                  type="button"
                  onClick={requestLogout}
                  className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-[15px] font-medium text-danger hover:bg-danger-soft"
                >
                  <LogOut className="h-[19px] w-[19px]" />
                  Salir
                </button>
              </div>
            </div>
          </>
        )}
        {confirmationDialog}
      </div>
    </div>
  );
}
