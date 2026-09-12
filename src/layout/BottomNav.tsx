import { NavLink } from 'react-router-dom';
import {
  Ellipsis,
  LayoutDashboard,
  Package,
  Truck,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

import { NAV_ITEMS } from '../config/nav-items';
import { useUiStore } from '../store/ui';
import type { Role } from '../types/roles';

/**
 * Los destinos que van abajo, en orden, con el nombre corto que entra en 70 px.
 * Se indexa por ruta contra `NAV_ITEMS` para no duplicar el permiso por rol:
 * quién ve qué sigue definido en un solo lugar (`config/nav-items.ts`).
 */
const PRIMARY: ReadonlyArray<{ to: string; label: string; icon: LucideIcon }> = [
  { to: '/', label: 'Inicio', icon: LayoutDashboard },
  { to: '/equipos', label: 'Equipos', icon: Truck },
  { to: '/inventario', label: 'Inventario', icon: Package },
  { to: '/mantenimiento', label: 'Mantención', icon: Wrench },
];

/**
 * Navegación inferior para teléfono y tablet — el patrón que dibuja el diseño
 * del equipo para los dos tamaños chicos.
 *
 * En faena se usa con una mano y con guantes: los cuatro destinos que se visitan
 * a diario quedan al alcance del pulgar, en vez de detrás de una hamburguesa
 * arriba a la izquierda, que es la esquina más lejana de la pantalla.
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

  const allowed = new Set(
    role
      ? NAV_ITEMS.filter((item) => item.roles.includes(role)).map(
          (item) => item.to,
        )
      : [],
  );
  const visible = PRIMARY.filter((item) => allowed.has(item.to));

  if (visible.length === 0) return null;

  return (
    <nav
      aria-label="Navegación principal"
      className="sticky bottom-0 z-20 flex shrink-0 border-t border-border bg-card/95 backdrop-blur lg:hidden"
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
