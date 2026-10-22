import type { LightConfig } from '../types/vencimientos';

/** Lo que se escribe en los campos (texto, para no pelear con el teclado). */
export type Borrador = Record<keyof LightConfig, string>;

export const aBorrador = (c: LightConfig): Borrador => ({
  serviceAlertKm: String(c.serviceAlertKm),
  technicalInspectionAlertDays: String(c.technicalInspectionAlertDays),
  circulationPermitAlertDays: String(c.circulationPermitAlertDays),
  insuranceAlertDays: String(c.insuranceAlertDays),
});

const entero = (t: string): number | null => (/^\d{1,5}$/.test(t.trim()) ? Number(t.trim()) : null);

/** Por qué no se puede guardar todavía, o `null`. */
export function problemaLiviano(b: Borrador): string | null {
  const km = entero(b.serviceAlertKm);
  if (km == null || km > 9_999) return 'El aviso de la mantención va entre 0 y 9.999 km antes.';
  for (const campo of ['technicalInspectionAlertDays', 'circulationPermitAlertDays', 'insuranceAlertDays'] as const) {
    const dias = entero(b[campo]);
    if (dias == null || dias < 1 || dias > 365) return 'Los días de aviso de los papeles van entre 1 y 365.';
  }
  return null;
}
