import { ClipboardCheck, ClipboardList, Package, Truck } from 'lucide-react';

import { useChecklistsPorEstado } from '../hooks/useDailyChecklists';
import { usePermissions } from '../hooks/usePermissions';
import { TerrenoShell, type ShellTab } from './TerrenoShell';

const RECHAZADOS = ['REJECTED'] as const;

/**
 * Las cuatro secciones del taller, en el orden del flujo de trabajo. Órdenes y
 * Stock son el taller del diseño "Mantenedor Taller" (la creación tipo Bitácora
 * vive dentro de "Crear orden" en el tablero).
 */
const TABS: ShellTab[] = [
  { to: '/mantenimiento/ordenes', label: 'Órdenes de trabajo', corto: 'Órdenes', icon: ClipboardList },
  // El checklist diario de cada equipo (Módulo 2): lo llena el mantenedor y
  // lo valida el supervisor.
  { to: '/mantenimiento/checklist', label: 'Checklist diario', corto: 'Checklist', icon: ClipboardCheck },
  { to: '/mantenimiento/stock', label: 'Stock del taller', corto: 'Stock', icon: Package },
  // Consulta de la flota en solo lectura (mismo ícono que usa el BottomNav
  // del escritorio para Equipos) — ver las rutas `/mantenimiento/equipos/*`.
  { to: '/mantenimiento/equipos', label: 'Equipos', corto: 'Equipos', icon: Truck },
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
  // Sin campana en el taller: la pestaña dice cuántos checklists rechazados
  // esperan que el mantenedor los corrija.
  const { can } = usePermissions();
  const { data: rechazados } = useChecklistsPorEstado(RECHAZADOS, can('dailyChecklist.resubmit'));
  const tabs = TABS.map((t) =>
    t.to === '/mantenimiento/checklist' ? { ...t, badge: rechazados?.length ?? 0 } : t,
  );
  return <TerrenoShell etiquetaNav="Secciones de Mantención" subtitulo="Mantención de taller" tabs={tabs} />;
}
