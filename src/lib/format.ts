export const fmtNum = (n: number) => n.toLocaleString('es-CL');
/** Hasta `maxDecimales` decimales, sin rellenar con ceros: 12,5 → `12,5`; 12 → `12`. */
export const fmtDecimales = (n: number, maxDecimales: number) =>
  n.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: maxDecimales });
export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('es-CL');

/**
 * `YYYY-MM-DDTHH:mm` en hora LOCAL, el formato de `<input type="datetime-local">`
 * (nunca `toISOString`, que pasa a UTC y corre la hora). `new Date(valor)` lo
 * vuelve a leer como hora local.
 */
export function toDateTimeLocal(fecha: Date): string {
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}T${dos(fecha.getHours())}:${dos(fecha.getMinutes())}`;
}

/**
 * La fecha de un registro cargado desde el panel (`<input type="datetime-local">`)
 * pasada a ISO, o `null` si está vacía, no es una fecha o es futura: el
 * backend rechaza las futuras (`resolveRecordDate`), con unos minutos de margen.
 */
export function fechaRegistroIso(valor: string, ahora: Date = new Date()): string | null {
  if (!valor) return null;
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime()) || fecha.getTime() - ahora.getTime() > 5 * 60 * 1000) return null;
  return fecha.toISOString();
}
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
