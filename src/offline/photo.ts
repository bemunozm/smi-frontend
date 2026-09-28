/**
 * Compresión de la foto de cierre ANTES de guardarla en Dexie (ver
 * `offline/outbox.ts#enqueueCloseCard`) — una tablet puede acumular varias
 * fotos de 8 MB sin señal, y son las que más pesan en `IndexedDB`.
 * `createImageBitmap` + canvas → JPEG q0.8, máx. 1600 px de lado mayor; si
 * el navegador no soporta el pipeline, se guardan los bytes originales tal
 * cual (nunca se bloquea el cierre de la tarjeta por esto).
 *
 * La fecha EXIF (`foto.captureDate`) se lee ANTES de este paso, sobre el
 * archivo ORIGINAL (`lib/usePhotoCaptureFlow.ts` ya lo hace al seleccionar
 * la foto) — comprimir puede borrar los metadatos EXIF, así que la fecha de
 * trazabilidad nunca depende de sobrevivir a este paso.
 */

const MAX_SIDE_PX = 1600;
const JPEG_QUALITY = 0.8;

export interface CompressedPhoto {
  data: ArrayBuffer;
  mime: string;
  name: string;
}

/** Forma mínima que necesitamos de un `ImageBitmap` — deja inyectar un doble
 * en tests sin depender de que jsdom implemente `ImageBitmap`/canvas. */
export interface ImageBitmapLike {
  width: number;
  height: number;
  close?: () => void;
}

/**
 * El pipeline real de compresión, separado en dos funciones inyectables
 * para que los tests unitarios no necesiten un canvas real (jsdom no lo
 * implementa) — un test pasa dobles que devuelven un `Blob` de mentira y
 * ejercita la lógica de escalado/fallback sin tocar el DOM.
 */
export interface PhotoCompressionDeps {
  createBitmap: (file: File) => Promise<ImageBitmapLike>;
  encodeJpeg: (bitmap: ImageBitmapLike, width: number, height: number, quality: number) => Promise<Blob | null>;
}

function browserEncodeJpeg(
  bitmap: ImageBitmapLike,
  width: number,
  height: number,
  quality: number,
): Promise<Blob | null> {
  // `OffscreenCanvas` primero: existe en los workers y en los navegadores
  // modernos de escritorio/Android; `document.createElement('canvas')` es el
  // fallback para Safari/iOS, que todavía no lo soporta en todas las versiones
  // objetivo de la tablet de faena.
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return Promise.resolve(null);
    ctx.drawImage(bitmap as unknown as CanvasImageSource, 0, 0, width, height);
    return canvas.convertToBlob({ type: 'image/jpeg', quality });
  }
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return Promise.resolve(null);
    ctx.drawImage(bitmap as unknown as CanvasImageSource, 0, 0, width, height);
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  }
  return Promise.resolve(null);
}

const defaultDeps: PhotoCompressionDeps = {
  createBitmap: (file) => globalThis.createImageBitmap(file),
  encodeJpeg: browserEncodeJpeg,
};

function jpegName(originalName: string): string {
  const base = originalName.replace(/\.[^./\\]+$/, '');
  return `${base || 'foto'}.jpg`;
}

async function toRawBytes(file: File): Promise<CompressedPhoto> {
  const data = await file.arrayBuffer();
  return { data, mime: file.type || 'application/octet-stream', name: file.name };
}

/**
 * Comprime `file` a JPEG q0.8, máx. 1600 px de lado mayor. Nunca lanza: si
 * `createImageBitmap` no existe, si el canvas no está disponible, o si
 * cualquier paso del pipeline falla, cae a `toRawBytes` (los bytes
 * originales) — un fallo de compresión NUNCA debe bloquear el cierre de una
 * tarjeta sin señal.
 */
export async function compressPhoto(
  file: File,
  deps: PhotoCompressionDeps = defaultDeps,
): Promise<CompressedPhoto> {
  if (typeof deps.createBitmap !== 'function') return toRawBytes(file);
  try {
    const bitmap = await deps.createBitmap(file);
    const scale = Math.min(1, MAX_SIDE_PX / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const blob = await deps.encodeJpeg(bitmap, width, height, JPEG_QUALITY);
    bitmap.close?.();
    if (!blob) return toRawBytes(file);
    const data = await blob.arrayBuffer();
    return { data, mime: 'image/jpeg', name: jpegName(file.name) };
  } catch {
    return toRawBytes(file);
  }
}
