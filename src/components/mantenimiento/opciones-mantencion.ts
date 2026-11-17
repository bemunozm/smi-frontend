import { fmtNum } from '../../lib/format';

/** Tipo de la mantención: lo comparten el alta y la edición del último cambio. */
export const TIPO_OPTIONS = [
  { value: 'PREVENTIVA', label: 'Preventiva' },
  { value: 'CORRECTIVA', label: 'Correctiva' },
] as const;

/** Las opciones de «Qué mantención fue»: el servicio inicial (si la pauta lo
 * tiene) y cada hito, en la unidad del equipo. */
export function opcionesHito(
  pauta: { milestones: number[]; initialMilestone: number | null } | undefined,
  unidad: string,
): { valor: number; label: string }[] {
  return [
    ...(pauta?.initialMilestone != null
      ? [{ valor: pauta.initialMilestone, label: `Servicio inicial ${fmtNum(pauta.initialMilestone)} ${unidad}` }]
      : []),
    ...(pauta?.milestones ?? []).map((n) => ({ valor: n, label: `${fmtNum(n)} ${unidad}` })),
  ];
}
