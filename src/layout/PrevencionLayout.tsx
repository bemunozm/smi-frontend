import { CarFront } from 'lucide-react';

import { TerrenoShell, type ShellTab } from './TerrenoShell';

/** Su única sección: la camioneta con que se mueve (km de salida y de carga). */
const TABS: ShellTab[] = [{ to: '/camioneta', label: 'Mi camioneta', corto: 'Camioneta', icon: CarFront }];

/**
 * Prevención de riesgos — el mismo shell de faena que Terreno y Mantención
 * (`TerrenoShell`), con una sola pantalla: «Mi camioneta» (`MiCamionetaView`).
 * El prevencionista se mueve en camioneta y registra el km al sacarla y al
 * cargar combustible; no ve pesados ni el resto de la operación.
 */
export function PrevencionLayout() {
  return <TerrenoShell etiquetaNav="Secciones de Prevención" subtitulo="Prevención de riesgos" tabs={TABS} />;
}
