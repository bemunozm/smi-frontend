import { Truck } from 'lucide-react';

import { TerrenoShell, type ShellTab } from './TerrenoShell';

/** Su única sección: los equipos que abre y cierra juntos en un reporte. */
const TABS: ShellTab[] = [{ to: '/temporal', label: 'Mis equipos', corto: 'Equipos', icon: Truck }];

/**
 * Supervisor temporal — el mismo shell de faena que Terreno y Prevención
 * (`TerrenoShell`), con una sola pantalla: «Mis equipos» (`SupervisorTemporalView`).
 * Horario libre: abre tarjetas de equipo y las cierra todas juntas en un reporte.
 */
export function TemporalLayout() {
  return <TerrenoShell etiquetaNav="Secciones de Supervisión temporal" subtitulo="Supervisión temporal" tabs={TABS} />;
}
