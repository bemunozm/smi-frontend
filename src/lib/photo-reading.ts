// Utilidades de navegador para el flujo de trazabilidad foto→EXIF (registro
// de carga de combustible, dominio Flota). El OCR de la lectura se mudó al
// backend (`api/OcrAPI.ts#fuelReadingOcr`) — acá solo queda la validación de
// frescura vía metadata EXIF, que sí sigue siendo 100% client-side.
//
// `exifr` se carga por IMPORT DINÁMICO: solo se necesita cuando el usuario
// efectivamente toma/sube una foto, así que no debe inflar el bundle
// principal.

const DEFAULT_FRESH_THRESHOLD_HOURS = 24;

/**
 * `DateTimeOriginal` de EXIF NO incluye offset de zona horaria (a diferencia
 * de `OffsetTimeOriginal`, un tag aparte que muchas cámaras/celulares no
 * escriben) — se compara tal cual contra el reloj local del navegador, así
 * que un desfase de huso horario o DST puede hacer que una foto recién
 * tomada aparezca unos minutos/horas "en el futuro". Se tolera ese margen en
 * vez de marcarlo de inmediato como sospechoso; no es una corrección real de
 * zona horaria (no leemos `OffsetTimeOriginal`), solo evita falsos ⚠.
 */
const FUTURE_TOLERANCE_HOURS = 3;

/** Forma mínima de `exifr` que usamos — evita `any` en la interop del import
 * dinámico de un paquete que expone tanto default como named exports según
 * el bundler. */
interface ExifrLike {
  parse: (input: File, options?: unknown) => Promise<Record<string, unknown> | undefined>;
}

/**
 * Lee la fecha real de captura desde la metadata EXIF de la foto
 * (`DateTimeOriginal`). Devuelve `null` si el archivo no trae EXIF (por
 * ejemplo, algunas cámaras Android, capturas de pantalla, o imágenes
 * reencodeadas) — el llamador debe tratar `null` como "no se pudo verificar
 * la fecha", no como un error que bloquee el registro.
 */
export async function readCaptureDate(file: File): Promise<Date | null> {
  try {
    const mod = (await import('exifr')) as unknown as { default?: ExifrLike } & ExifrLike;
    const exifr = mod.default ?? mod;
    const tags = await exifr.parse(file, ['DateTimeOriginal']);
    const value = tags?.DateTimeOriginal;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    return null;
  } catch {
    return null;
  }
}

/** `true` si `date` cae dentro de las últimas `thresholdHours` horas (por
 * defecto 24h) — el criterio de "foto reciente" del bloque de validación.
 * Tolera hasta `FUTURE_TOLERANCE_HOURS` "en el futuro" para absorber el
 * desfase de zona horaria de EXIF (ver comentario de la constante) sin
 * marcar como sospechosa una foto recién tomada. */
export function isFresh(date: Date, thresholdHours: number = DEFAULT_FRESH_THRESHOLD_HOURS): boolean {
  const diffMs = Date.now() - date.getTime();
  const toleranciaMs = FUTURE_TOLERANCE_HOURS * 60 * 60 * 1000;
  return diffMs >= -toleranciaMs && diffMs <= thresholdHours * 60 * 60 * 1000;
}

/** "recién" / "hace 5 min" / "hace 3 h" / "hace 2 días" — texto corto para el
 * indicador ✔/⚠ junto a la fecha EXIF. Solo se marca "con fecha futura" más
 * allá de `FUTURE_TOLERANCE_HOURS` — un desfase menor casi siempre es el
 * huso horario sin normalizar de EXIF, no un reloj mal puesto. */
export function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  if (diffMs < -FUTURE_TOLERANCE_HOURS * 60 * 60 * 1000) return 'con fecha futura';
  if (diffMs < 0) return 'recién';

  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1) return 'recién';
  if (diffMin < 60) return `hace ${diffMin} min`;

  const diffHoras = Math.round(diffMin / 60);
  if (diffHoras < 24) return `hace ${diffHoras} h`;

  const diffDias = Math.round(diffHoras / 24);
  return `hace ${diffDias} día${diffDias === 1 ? '' : 's'}`;
}
