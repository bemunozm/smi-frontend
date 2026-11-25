import { TriangleAlert, Truck } from 'lucide-react';

import { TerrenoShell, type ShellTab } from './TerrenoShell';

/** Sus secciones: los equipos que abre y cierra juntos en un reporte (con el
 * historial de los reportes que envió) y los hallazgos (la misma vista de Terreno). */
const TABS: ShellTab[] = [
  // `end`: «Mis equipos» no queda activa en «Hallazgos», que cuelga de `/temporal`.
  { to: '/temporal', label: 'Mis equipos', corto: 'Equipos', icon: Truck, end: true },
  { to: '/temporal/hallazgos', label: 'Hallazgos', corto: 'Hallazgos', icon: TriangleAlert },
];

/**
 * Supervisor temporal — el mismo shell de faena que Terreno y Prevención
 * (`TerrenoShell`), con dos pantallas: «Mis equipos» (`SupervisorTemporalView`,
 * con el historial de reportes) y «Hallazgos» (`HallazgosView`).
 * Horario libre: abre tarjetas de equipo y las cierra todas juntas en un reporte.
 */
export function TemporalLayout() {
  return <TerrenoShell etiquetaNav="Secciones de Supervisión temporal" subtitulo="Supervisión temporal" tabs={TABS} />;
}
