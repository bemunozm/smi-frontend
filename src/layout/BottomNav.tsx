import { NavLink } from 'react-router-dom';
import {
  ClipboardCheck,
  ClipboardList,
  Ellipsis,
  Hammer,
  TriangleAlert,
  LayoutDashboard,
  Package,
  Truck,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

import { navItemsDe } from '../config/nav-items';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { usaCamioneta } from '../lib/usa-camioneta';
import { useUiStore } from '../store/ui';
import { ROLES, type Role } from '../types/roles';

interface PrimaryItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

const INICIO: PrimaryItem = { to: '/', label: 'Inicio', icon: LayoutDashboard };
const EQUIPOS: PrimaryItem = { to: '/equipos', label: 'Equipos', icon: Truck };
const INVENTARIO: PrimaryItem = { to: '/inventario', label: 'Inventario', icon: Package };
const MANTENCION: PrimaryItem = { to: '/mantenimiento', label: 'Mantención', icon: Wrench };
// El ADMIN no trabaja en el taller: su «Mantención» es el registro del panel
// (`/mantenciones`), no el shell del mantenedor (pedido del 05/11).
const MANTENCIONES: PrimaryItem = { to: '/mantenciones', label: 'Mantención', icon: Wrench };
// El ícono calca el de "Registro de equipo" en `TerrenoLayout` — `/terreno`
// redirige ahí, así que en la práctica es el mismo destino.
const TERRENO: PrimaryItem = { to: '/terreno', label: 'Terreno', icon: ClipboardCheck };
const HALLAZGOS: PrimaryItem = { to: '/hallazgos', label: 'Hallazgos', icon: TriangleAlert };
const TRABAJOS_EXTRA: PrimaryItem = { to: '/trabajos-extra', label: 'Report', icon: Hammer };
const REPORTES_DIARIOS: PrimaryItem = { to: '/reportes-diarios', label: 'Producción', icon: ClipboardList };

/**
 * Ítems primarios de la barra inferior, POR ROL: un único set fijo
 * (Inicio/Equipos/Inventario/Mantención) no calza con lo que cada rol puede
 * realmente ver ni con dónde vive su trabajo diario:
 * - SUPERVISOR vive en Terreno y MANTENEDOR en Mantención (su home, ver
 *   `config/home-path.ts`) — van primero, y no tienen «Inicio»: el dashboard
 *   `/` es solo ADMIN;
 * - ADMIN mantiene el set original, con «Mantención» apuntando a su registro
 *   del panel (`/mantenciones`), no al taller.
 *
 * Este mapa decide ORDEN + qué mostrar por rol; el gate real de acceso vive
 * en `routes.tsx` — las pantallas del menú se siguen filtrando contra
 * `NAV_ITEMS` (`allowed`), pero los shells de faena (Terreno/Mantención) ya
 * NO están en el menú (pedido del administrador), así que su gate por rol es
 * este mismo mapa, que espeja los `allowedRoles` de sus rutas. Sin esa
 * excepción, sacar los shells del menú dejaría a SUPERVISOR/MANTENEDOR sin
 * botón de vuelta a su módulo desde Equipos/Inventario en el teléfono.
 */
const PRIMARY_BY_ROLE: Record<Role, readonly PrimaryItem[]> = {
  [ROLES.SUPERVISOR]: [TERRENO, EQUIPOS, INVENTARIO],
  [ROLES.ADMIN]: [INICIO, EQUIPOS, INVENTARIO, MANTENCIONES],
  [ROLES.MANTENEDOR]: [MANTENCION, EQUIPOS, INVENTARIO],
  // Sus cuatro pantallas; Notificaciones queda en «Más».
  [ROLES.SECRETARIA]: [INICIO, HALLAZGOS, TRABAJOS_EXTRA, REPORTES_DIARIOS],
  // Vive en su shell (`/camioneta`); acá solo llega a Notificaciones o Perfil.
  [ROLES.PREVENCIONISTA]: [],
};

/** Destinos que viven fuera del menú: se muestran sin pasar por `allowed`. */
const SHELLS = new Set([TERRENO.to, MANTENCION.to]);

/**
 * Navegación inferior SOLO para teléfono (`sm:hidden` — pedido del
 * administrador: en tablet competía con el contenido, y ahí el menú se abre
 * con la hamburguesa del Topbar, igual que en escritorio angosto).
 *
 * En faena se usa con una mano y con guantes: los destinos que se visitan a
 * diario (por rol, ver `PRIMARY_BY_ROLE`) quedan al alcance del pulgar, en
 * vez de detrás de una hamburguesa arriba a la izquierda, que es la esquina
 * más lejana de la pantalla.
 *
 * «Más» no abre una segunda lista: abre el mismo cajón del `Sidebar`, que ya
 * está filtrado por rol y ya lista todo. Mantener dos menús sincronizados es
 * cómo terminan divergiendo.
 *
 * Nota de alcance: la barra es parte de T12 · DEV-34 (Benjamín). Se agrega acá
 * porque las pantallas de Inventario ya son responsivas y sin ella no hay cómo
 * salir de una en el teléfono; cuando T12 llegue, esto es lo que debe absorber.
 */
export function BottomNav({ role }: { role: Role | null }) {
  const setSidebarOpen = useUiStore((state) => state.setSidebarOpen);

  const { user } = useCurrentUser();
  const allowed = new Set(navItemsDe(role, usaCamioneta(user)).map((item) => item.to));
  const primary = role ? PRIMARY_BY_ROLE[role] : [];
  const visible = primary.filter((item) => SHELLS.has(item.to) || allowed.has(item.to));

  if (visible.length === 0) return null;

  return (
    <nav
      aria-label="Navegación principal"
      className="sticky bottom-0 z-20 flex shrink-0 border-t border-border bg-card/95 backdrop-blur sm:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {visible.map((item) => (
        <NavLink
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[10px] font-semibold transition-colors ${
              isActive ? 'text-(--accent)' : 'text-muted-foreground'
            }`
          }
          end={item.to === '/'}
          key={item.to}
          to={item.to}
        >
          <item.icon aria-hidden size={21} />
          {item.label}
        </NavLink>
      ))}
      <button
        className="flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[10px] font-semibold text-muted-foreground"
        onClick={() => setSidebarOpen(true)}
        type="button"
      >
        <Ellipsis aria-hidden size={21} />
        Más
      </button>
    </nav>
  );
}
