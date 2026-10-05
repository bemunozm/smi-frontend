export const fmtNum = (n: number) => n.toLocaleString('es-CL');
/** Hasta `maxDecimales` decimales, sin rellenar con ceros: 12,5 → `12,5`; 12 → `12`. */
export const fmtDecimales = (n: number, maxDecimales: number) =>
  n.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: maxDecimales });
export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('es-CL');
/** Litros de combustible o AdBlue: hasta dos decimales, sin forzar ceros (30,75
 * se ve `30,75`, no `30,8`). `—` si no hay valor. */
export const fmtLitros = (n: number | null | undefined) => (n == null ? '—' : fmtDecimales(n, 2));
export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
export const initials = (name: string) =>
  name
    .split(/\s|·/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

/**
 * "1 equipo" / "2 equipos" — pluralización simple es-CL, compartida entre
 * `views/RegistroEquipoView.tsx` y `offline/sync-status-presentation.tsx`.
 * Solo cubre el SUSTANTIVO — un verbo que también cambia con la cantidad
 * ("requiere" / "requieren") se sigue resolviendo aparte en el llamador.
 */
export const plural = (n: number, singular: string, varias: string) => `${n} ${n === 1 ? singular : varias}`;
