import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { Avatar, Button, Chip, Dropdown, Label } from '@heroui/react';
import type { Key } from '@heroui/react';
import { LayoutDashboard, LogOut, UserRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { NotificationBell } from '../components/notifications/NotificationBell';
import { PerfilModal } from '../components/perfil/FichaPerfil';
import { useLogoutConfirmation } from '../components/sync/useLogoutConfirmation';
import { SyncStatus } from '../components/terreno/SyncStatus';
import { roleChipColor } from '../config/role-colors';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { DESKTOP_QUERY, useMediaQuery } from '../hooks/useMediaQuery';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { ROLES, type Role } from '../types/roles';
import { CONTAINER } from './terreno-container';

/**
 * Un destino del módulo. La etiqueta larga va en el header (escritorio); la
 * corta, en la barra inferior, donde cada pestaña tiene un cuarto de pantalla.
 */
export interface ShellTab {
  to: string;
  label: string;
  corto: string;
  icon: LucideIcon;
  /** Cuántas cosas esperan en esa sección (p. ej. checklists por validar). */
  badge?: number;
}

/** El número de pendientes junto a una pestaña. Nada si no hay. */
function Badge({ n }: { n?: number }) {
  if (!n) return null;
  return (
    <span
      aria-label={`${n} pendientes`}
      className="tabular inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--danger)] px-1.5 text-[11px] leading-none font-bold text-white"
    >
      {n > 99 ? '99+' : n}
    </span>
  );
}

/** Mismo criterio que `Topbar#initialsFrom`: dos palabras → iniciales; si no,
 * las dos primeras letras de lo que haya (nombre o email). */
function inicialesDe(nombre: string | undefined, email: string | undefined): string {
  const fuente = nombre?.trim() || email || '?';
  const partes = fuente.split(/\s+/).filter(Boolean);
  if (partes.length >= 2) {
    return `${partes[0]?.[0] ?? ''}${partes[1]?.[0] ?? ''}`.toUpperCase();
  }
  return fuente.slice(0, 2).toUpperCase();
}

/**
 * Menú de usuario del header — el MISMO patrón que el Topbar de escritorio
 * (pedido del administrador): avatar → quién está conectado, «Ver perfil» y
 * «Cerrar sesión». Al ADMIN además le ofrece «Ir al panel» (su dashboard): ya
 * no hay drawer, las secciones están en la barra inferior o en el header.
 */
function MenuUsuario({
  user,
  role,
  onPerfil,
  onIrAlPanel,
  onCerrarSesion,
}: {
  user: { name?: string; email?: string } | null;
  role: Role | null;
  onPerfil: () => void;
  /** Solo ADMIN; sin él, la opción no aparece. */
  onIrAlPanel?: () => void;
  onCerrarSesion: () => void;
}) {
  const handleAction = (key: Key): void => {
    if (key === 'profile') onPerfil();
    if (key === 'panel') onIrAlPanel?.();
    if (key === 'logout') onCerrarSesion();
  };

  return (
    <Dropdown>
      <Button
        aria-label="Menú de usuario"
        className="h-11 w-11 shrink-0 rounded-xl text-white/90 hover:bg-white/10"
        isIconOnly
        variant="ghost"
      >
        <Avatar size="sm">
          <Avatar.Fallback>{inicialesDe(user?.name, user?.email)}</Avatar.Fallback>
        </Avatar>
      </Button>
      <Dropdown.Popover placement="bottom end">
        <div className="flex items-center gap-3 px-3 py-3">
          <Avatar size="md">
            <Avatar.Fallback>{inicialesDe(user?.name, user?.email)}</Avatar.Fallback>
          </Avatar>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="truncate text-sm font-medium text-foreground">{user?.name || user?.email}</span>
            <span className="truncate text-xs text-muted-foreground">{user?.email}</span>
            {role ? (
              <Chip className="w-fit" color={roleChipColor(role)} size="sm" variant="soft">
                {role}
              </Chip>
            ) : null}
          </div>
        </div>
        <Dropdown.Menu onAction={handleAction}>
          <Dropdown.Item id="profile" textValue="Ver perfil">
            <UserRound aria-hidden size={15} />
            <Label>Ver perfil</Label>
          </Dropdown.Item>
          {onIrAlPanel ? (
            <Dropdown.Item id="panel" textValue="Ir al panel">
              <LayoutDashboard aria-hidden size={15} />
              <Label>Ir al panel</Label>
            </Dropdown.Item>
          ) : null}
          <Dropdown.Item id="logout" textValue="Cerrar sesión" variant="danger">
            <LogOut aria-hidden size={15} />
            <Label>Cerrar sesión</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

interface TerrenoShellProps {
  /** Subtítulo bajo "SMI" en el header (ej. "Operación en terreno"). */
  subtitulo: string;
  /** `aria-label` de la navegación de secciones (ej. "Secciones de Terreno"). */
  etiquetaNav: string;
  tabs: ShellTab[];
}

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

/**
 * Shell de módulo de trabajo en faena: header SMI + campana de notificaciones
 * + estado de sync + contenido + navegación de secciones + menú de usuario
 * (perfil, "Ir al panel" del ADMIN y cerrar sesión).
 * Reemplaza por completo al chrome de escritorio (`AppLayout`): al entrar al
 * módulo no aparece el sidebar/topbar/barra del administrador.
 *
 * Nació como el layout de Terreno; se parametrizó para que Mantención (el
 * taller) use exactamente la misma mecánica. `TerrenoLayout` y
 * `MantenimientoLayout` son wrappers finos que solo ponen sus pestañas.
 */
export function TerrenoShell({ subtitulo, etiquetaNav, tabs }: TerrenoShellProps) {
  const { user, role } = useCurrentUser();
  const [perfilAbierto, setPerfilAbierto] = useState(false);
  const enLinea = useOnlineStatus();
  const navigate = useNavigate();
  const { requestLogout, confirmationDialog } = useLogoutConfirmation(user?.id, navigate);

  /**
   * Los destinos viven en UN solo lugar según el tamaño: barra inferior en
   * teléfono y tablet —donde llega el pulgar— y header desde `lg`, porque una
   * barra de pestañas estirada a lo ancho de un monitor se ve rota.
   *
   * Se monta una de las dos, no las dos con una tapada por CSS: son los mismos
   * enlaces, y duplicarlos en el DOM haría que un lector de pantalla leyera la
   * navegación dos veces. Es el caso que `useMediaQuery` documenta; todo lo
   * demás de esta pantalla es estilo y va con clases `sm:`/`lg:`.
   */
  const navEnHeader = useMediaQuery(DESKTOP_QUERY);

  /**
   * "Ir al panel" lleva al dashboard del administrador (`/`, solo ADMIN).
   * Para SUPERVISOR y MANTENEDOR el panel no existe —su módulo ES su home—,
   * así que el atajo solo se ofrece al ADMIN.
   */
  const ofreceIrAlPanel = role === ROLES.ADMIN;

  return (
    <div className="min-h-screen" style={{ background: 'var(--terreno-warm)' }}>
      {/* El shell ocupa todo el ancho en cualquier pantalla: el ancho del
          contenido lo decide `CONTAINER`. Un marco de 448 px dejaba la tablet de
          faena (~600 px CSS) con el ancho de un celular. */}
      <div
        className="relative flex min-h-screen w-full flex-col"
        style={{ background: 'var(--terreno-shell)' }}
      >
        <header
          className="sticky top-0 z-20 text-white"
          style={{ background: 'var(--terreno-head)' }}
        >
          <div className={`${CONTAINER} flex items-center gap-3 py-3.5 lg:gap-5 lg:py-3`}>
            <div className="flex flex-1 flex-col gap-1 leading-none lg:flex-none">
              <span className="font-display text-2xl font-bold tracking-[-0.02em]">SMI</span>
              <span className="text-[10.5px] font-semibold tracking-[0.14em] text-white/60 uppercase">
                {subtitulo}
              </span>
            </div>

            {navEnHeader && (
              <nav aria-label={etiquetaNav} className="mr-auto flex items-center gap-1">
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
                      <Badge n={t.badge} />
                    </NavLink>
                  );
                })}
              </nav>
            )}

            {/* La campana es la única superficie in-app de las notificaciones
                para SUPERVISOR y MANTENEDOR (su home es este shell, no el
                escritorio con Topbar): sin ella, "checklist por validar",
                "hallazgo creado" o "stock bajo" solo se verían navegando a
                mano a /notificaciones. */}
            <NotificationBell faena />
            <StatusPill enLinea={enLinea} />
            <MenuUsuario
              user={user}
              role={role}
              onPerfil={() => setPerfilAbierto(true)}
              onIrAlPanel={ofreceIrAlPanel ? () => void navigate('/') : undefined}
              onCerrarSesion={requestLogout}
            />
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
            aria-label={etiquetaNav}
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
                        <span className="relative">
                          <Icon className="h-[23px] w-[23px]" strokeWidth={isActive ? 2.4 : 2} />
                          {t.badge ? (
                            <span className="absolute -top-1.5 -right-3">
                              <Badge n={t.badge} />
                            </span>
                          ) : null}
                        </span>
                        {t.corto}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </nav>
        )}

        {confirmationDialog}
        <PerfilModal isOpen={perfilAbierto} onClose={() => setPerfilAbierto(false)} />
      </div>
    </div>
  );
}
