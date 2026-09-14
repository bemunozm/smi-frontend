// Utilidades de navegador para el flujo de trazabilidad foto→OCR→EXIF
// (registro de lectura de horómetro / carga de combustible, dominio Flota).
// Todo corre 100% en el cliente — no hay endpoint de backend involucrado acá.
//
// `tesseract.js` (OCR) y `exifr` (EXIF) se cargan por IMPORT DINÁMICO: ambos
// solo se necesitan cuando el usuario efectivamente toma/sube una foto, así
// que no deben inflar el bundle principal (`tesseract.js` en particular pesa
// varios MB con su motor wasm).

export interface OcrResult {
  /** Dígitos reconocidos como la lectura más probable. `''` si no se detectó
   * ningún número o si el OCR falló — el llamador debe tratarlo como "no se
   * pudo sugerir nada", nunca como un valor a autocompletar. */
  value: string;
  /** Confianza de Tesseract (0-100) para el texto reconocido en general. */
  confidence: number;
}

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

/** Forma mínima de `tesseract.js` que usamos — mismo motivo que `ExifrLike`. */
interface TesseractLike {
  recognize: (image: File, langs?: string) => Promise<{ data: { text: string; confidence: number } }>;
}

// Grupos de 1+ dígitos, con puntos/comas de miles/decimales opcionales en
// medio ("1.234", "1,234", "1234.5", "1234" son todos candidatos válidos).
const NUMBER_PATTERN = /\d[\d.,]*\d|\d/g;

/** Cantidad de dígitos de un candidato, ignorando separadores — se usa solo
 * para elegir el candidato "más largo", nunca para construir el valor final
 * (eso lo hace `normalizeNumber`, que sí distingue miles de decimales). */
function digitCount(value: string): number {
  return value.replace(/[.,]/g, '').length;
}

/**
 * Normaliza un candidato numérico crudo del OCR a un string parseable por
 * `Number()`. El único separador relevante es el ÚLTIMO: si va seguido de
 * exactamente 1-2 dígitos y nada más, es el separador DECIMAL (ej. "1234.5",
 * "80,5", o el formato europeo "1.234,50"); cualquier otro punto/coma antes
 * de ese es separador de miles y se descarta. Sin un separador así al final,
 * se asume que todos son de miles (ej. "1,234" → "1234").
 *
 * Antes esto se resolvía sacando TODOS los separadores sin distinguir, lo
 * que multiplicaba por 10 cualquier lectura con decimales ("1234.5" → "12345").
 */
function normalizeNumber(raw: string): string {
  const decimalMatch = raw.match(/[.,](\d{1,2})$/);
  if (decimalMatch) {
    const decimales = decimalMatch[1];
    const parteEntera = raw.slice(0, raw.length - decimales.length - 1).replace(/[.,]/g, '');
    return `${parteEntera}.${decimales}`;
  }
  return raw.replace(/[.,]/g, '');
}

/** De todo el texto reconocido por el OCR, elige el número más largo (más
 * dígitos) como la lectura más probable: en la foto de un marcador o
 * totalizador, ese número casi siempre es la lectura en sí — el ruido
 * alrededor (fechas parciales, códigos, letras mal leídas como dígitos)
 * produce números más cortos. */
function extractBestNumber(text: string): string {
  const matches = text.match(NUMBER_PATTERN);
  if (!matches || matches.length === 0) return '';

  const best = matches.reduce((acc, candidate) => (digitCount(candidate) > digitCount(acc) ? candidate : acc));
  return normalizeNumber(best);
}

/**
 * OCR best-effort sobre la foto para sugerir la lectura numérica (horómetro,
 * odómetro o litros según el contexto). El usuario SIEMPRE puede editar el
 * resultado — esto es una sugerencia, no una fuente de verdad. Nunca lanza:
 * cualquier falla (carga del motor, imagen ilegible, etc.) se resuelve como
 * "sin sugerencia" para no bloquear el registro manual.
 */
export async function recognizeReading(file: File): Promise<OcrResult> {
  try {
    const mod = (await import('tesseract.js')) as unknown as { default?: TesseractLike } & TesseractLike;
    const tesseract = mod.default ?? mod;
    const { data } = await tesseract.recognize(file, 'eng');
    return { value: extractBestNumber(data.text), confidence: Math.round(data.confidence) || 0 };
  } catch {
    return { value: '', confidence: 0 };
  }
}
