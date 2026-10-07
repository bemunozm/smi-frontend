import { Briefcase, ClipboardCheck, FileText, TriangleAlert } from 'lucide-react';

import { TerrenoShell, type ShellTab } from './TerrenoShell';

/**
 * Los cuatro destinos del módulo, en el orden de la maqueta. La etiqueta larga
 * va en el header y en el drawer; la corta, en la barra inferior, donde cada
 * pestaña tiene un cuarto de pantalla.
 *
 * Combustible y Horómetro ya no están: la especificación del 21/09 las fusiona
 * en «Registro de equipo» —una tarjeta por equipo, con apertura y cierre de
 * turno—. Sus rutas siguen existiendo sin estar enlazadas, porque son las dos
 * únicas con backend real; ver el comentario en `routes.tsx`.
 */
const tabs: ShellTab[] = [
  { to: '/terreno/registro', label: 'Registro de equipo', corto: 'Registro', icon: ClipboardCheck },
  { to: '/terreno/reporte-diario', label: 'Reporte diario', corto: 'Reporte', icon: FileText },
  { to: '/terreno/trabajos-extra', label: 'Trabajos extra', corto: 'Trabajos', icon: Briefcase },
  { to: '/terreno/hallazgos', label: 'Hallazgos', corto: 'Hallazgos', icon: TriangleAlert },
];

/**
 * Operación en Terreno — el shell parametrizado (`TerrenoShell`) con las
 * pestañas del módulo. Toda la mecánica (header, sync, barra, drawer) vive en
 * el shell, compartida con `MantenimientoLayout`.
 */
export function TerrenoLayout() {
  return <TerrenoShell etiquetaNav="Secciones de Terreno" subtitulo="Operación en terreno" tabs={tabs} />;
}
