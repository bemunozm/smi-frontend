import { ClipboardList, Gauge, ListChecks, Package } from 'lucide-react';

import { useCurrentUser } from '../hooks/useCurrentUser';
import { ROLES } from '../types/roles';
import { TerrenoShell, type ShellTab } from './TerrenoShell';

/**
 * Secciones del dominio, en el orden del flujo de trabajo. Órdenes y Stock son
 * el taller del diseño "Mantenedor Taller" (la creación tipo Bitácora vive
 * dentro de "Crear orden" en el tablero); Preventivo y Tareas son gestión que
 * el diseño no cubre y quedan solo para ADMIN — las rutas lo refuerzan con su
 * propio `ProtectedRoute` (ver `routes.tsx`).
 */
const TABS: (ShellTab & { adminOnly: boolean })[] = [
  { to: '/mantenimiento/ordenes', label: 'Órdenes de trabajo', corto: 'Órdenes', icon: ClipboardList, adminOnly: false },
  { to: '/mantenimiento/stock', label: 'Stock del taller', corto: 'Stock', icon: Package, adminOnly: false },
  { to: '/mantenimiento/preventivo', label: 'Plan preventivo', corto: 'Preventivo', icon: Gauge, adminOnly: true },
  { to: '/mantenimiento/tareas', label: 'Tareas', corto: 'Tareas', icon: ListChecks, adminOnly: true },
];

/**
 * Mantención (el taller) — el mismo shell de faena que Terreno
 * (`TerrenoShell`): al entrar, el chrome del administrador
 * (sidebar/topbar/barra inferior de `AppLayout`) desaparece y queda solo la
 * navegación del módulo. El taller se usa en tablet, con guantes — mismo
 * lenguaje y mecánica que la operación en terreno; se vuelve al panel por el
 * drawer («Ir al panel»).
 */
export function MantenimientoLayout() {
  const { role } = useCurrentUser();
  const tabs = TABS.filter((t) => !t.adminOnly || role === ROLES.ADMIN);

  return <TerrenoShell etiquetaNav="Secciones de Mantención" subtitulo="Mantención de taller" tabs={tabs} />;
}
