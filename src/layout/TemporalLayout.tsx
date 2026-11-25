import { FileText, TriangleAlert, Truck } from 'lucide-react';

import { TerrenoShell, type ShellTab } from './TerrenoShell';

/** Sus secciones: los equipos que abre y cierra juntos en un reporte, los
 * hallazgos (la misma vista de Terreno) y los reportes que ya envió. */
const TABS: ShellTab[] = [
  // `end`: «Mis equipos» no queda activa en las otras dos, que cuelgan de `/temporal`.
  { to: '/temporal', label: 'Mis equipos', corto: 'Equipos', icon: Truck, end: true },
  { to: '/temporal/hallazgos', label: 'Hallazgos', corto: 'Hallazgos', icon: TriangleAlert },
  { to: '/temporal/reportes', label: 'Mis reportes', corto: 'Reportes', icon: FileText },
];

/**
 * Supervisor temporal — el mismo shell de faena que Terreno y Prevención
 * (`TerrenoShell`), con tres pantallas: «Mis equipos» (`SupervisorTemporalView`),
 * «Hallazgos» (`HallazgosView`) y «Mis reportes» (`MisReportesTemporalView`).
 * Horario libre: abre tarjetas de equipo y las cierra todas juntas en un reporte.
 */
export function TemporalLayout() {
  return <TerrenoShell etiquetaNav="Secciones de Supervisión temporal" subtitulo="Supervisión temporal" tabs={TABS} />;
}
