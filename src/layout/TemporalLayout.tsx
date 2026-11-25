import { CarFront, TriangleAlert, Truck } from 'lucide-react';

import { TerrenoShell, type ShellTab } from './TerrenoShell';

/** Sus secciones: los equipos que abre y cierra juntos en un reporte (con el
 * historial de los reportes que envió), la camioneta con que se mueve (aparte
 * del reporte) y los hallazgos (la misma vista de Terreno). */
const TABS: ShellTab[] = [
  // `end`: «Mis equipos» no queda activa en las otras, que cuelgan de `/temporal`.
  { to: '/temporal', label: 'Mis equipos', corto: 'Equipos', icon: Truck, end: true },
  { to: '/temporal/camioneta', label: 'Mi camioneta', corto: 'Camioneta', icon: CarFront },
  { to: '/temporal/hallazgos', label: 'Hallazgos', corto: 'Hallazgos', icon: TriangleAlert },
];

/**
 * Supervisor temporal — el mismo shell de faena que Terreno y Prevención
 * (`TerrenoShell`), con tres pantallas: «Mis equipos» (`SupervisorTemporalView`,
 * con el historial de reportes), «Mi camioneta» (`MiCamionetaView`, como la del
 * prevencionista) y «Hallazgos» (`HallazgosView`).
 * Horario libre: abre tarjetas de equipo y las cierra todas juntas en un reporte.
 */
export function TemporalLayout() {
  return <TerrenoShell etiquetaNav="Secciones de Supervisión temporal" subtitulo="Supervisión temporal" tabs={TABS} />;
}
