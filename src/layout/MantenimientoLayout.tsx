import { CarFront, ClipboardCheck, ClipboardList, Package, Truck } from 'lucide-react';

import { useChecklistsPorEstado } from '../hooks/useDailyChecklists';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { ROLES } from '../types/roles';
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

/** Solo del mantenedor: la camioneta con que se mueve en faena (km y combustible). */
const TAB_CAMIONETA: ShellTab = {
  to: '/mantenimiento/camioneta',
  label: 'Mi camioneta',
  corto: 'Camioneta',
  icon: CarFront,
};

/**
 * Mantención (el taller) — el mismo shell de faena que Terreno
 * (`TerrenoShell`): al entrar, el chrome del administrador
 * (sidebar/topbar/barra inferior de `AppLayout`) desaparece y queda solo la
 * navegación del módulo. El taller se usa en tablet, con guantes — mismo
 * lenguaje y mecánica que la operación en terreno; se vuelve al panel por el
 * menú de usuario («Ir al panel», solo ADMIN).
 */
export function MantenimientoLayout() {
  // La campana del shell trae todas las notificaciones (hallazgos nuevos,
  // checklists validados); el badge de la pestaña es el vistazo rápido de
  // cuántos rechazados esperan que el mantenedor los corrija.
  const { can } = usePermissions();
  const { data: rechazados } = useChecklistsPorEstado(RECHAZADOS, can('dailyChecklist.resubmit'));
  const esMantenedor = useCurrentUser().role === ROLES.MANTENEDOR;
  const tabs = (esMantenedor ? [...TABS, TAB_CAMIONETA] : TABS).map((t) =>
    t.to === '/mantenimiento/checklist' ? { ...t, badge: rechazados?.length ?? 0 } : t,
  );
  return <TerrenoShell etiquetaNav="Secciones de Mantención" subtitulo="Mantención de taller" tabs={tabs} />;
}
