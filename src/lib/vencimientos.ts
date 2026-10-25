import type { CalendarDocument, CalendarEquipment } from '../types/vencimientos';

/** Los tres papeles de todo liviano, en el orden en que se muestran. */
export const PAPELES = [
  { type: 'TECHNICAL_INSPECTION', label: 'Revisión técnica' },
  { type: 'CIRCULATION_PERMIT', label: 'Permiso de circulación' },
  { type: 'INSURANCE', label: 'Seguro' },
] as const;

const TIPOS_PAPELES = new Set<string>(PAPELES.map((p) => p.type));

/** El papel vigente de ese tipo: el que vence más tarde (si se renovó, el nuevo). */
export function papelActual(e: CalendarEquipment, type: string): CalendarDocument | undefined {
  return e.documents
    .filter((d) => d.type === type)
    .reduce<CalendarDocument | undefined>((max, d) => (!max || d.expiryDate > max.expiryDate ? d : max), undefined);
}

/** Otros documentos con vencimiento (certificaciones, otros), uno por título. */
export function otrosPapeles(e: CalendarEquipment): CalendarDocument[] {
  const porEtiqueta = new Map<string, CalendarDocument>();
  for (const d of e.documents) {
    if (TIPOS_PAPELES.has(d.type)) continue;
    const previo = porEtiqueta.get(d.label);
    if (!previo || d.expiryDate > previo.expiryDate) porEtiqueta.set(d.label, d);
  }
  return [...porEtiqueta.values()].sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
}

/** Los papeles que cuentan hoy: el actual de cada tipo, más los otros. */
export function papelesVigentes(e: CalendarEquipment): CalendarDocument[] {
  return [
    ...PAPELES.flatMap((p) => {
      const d = papelActual(e, p.type);
      return d ? [d] : [];
    }),
    ...otrosPapeles(e),
  ];
}

/** «vence en 15 días», «vence hoy», «venció hace 3 días». */
export function textoPlazo(dias: number | null): string {
  if (dias == null) return '';
  if (dias === 0) return 'vence hoy';
  if (dias === 1) return 'vence mañana';
  if (dias > 1) return dias >= 60 ? `vence en ${Math.round(dias / 30)} meses` : `vence en ${dias} días`;
  if (dias === -1) return 'venció ayer';
  return -dias >= 60 ? `venció hace ${Math.round(-dias / 30)} meses` : `venció hace ${-dias} días`;
}

/** Cuántos papeles de un vehículo piden atención (vencidos o por vencer). */
export function porRevisar(e: CalendarEquipment): number {
  return papelesVigentes(e).filter((d) => d.status === 'VENCIDO' || d.status === 'POR_VENCER').length;
}

/** Lo más urgente primero: el papel que vence antes (o venció hace más). */
export function ordenarPorUrgencia(equipos: readonly CalendarEquipment[]): CalendarEquipment[] {
  const clave = (e: CalendarEquipment) =>
    Math.min(...papelesVigentes(e).map((d) => d.daysToExpiry ?? Number.POSITIVE_INFINITY), Number.POSITIVE_INFINITY);
  return [...equipos].sort((a, b) => clave(a) - clave(b));
}
