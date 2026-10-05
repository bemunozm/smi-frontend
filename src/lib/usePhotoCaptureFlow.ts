import { useState } from 'react';

import { fuelReadingOcr, type FuelReadingOcrResult } from '../api/OcrAPI';
import { readCaptureDate } from './photo-reading';

/** Mismo shape que `OcrAPI.ts#SIN_SUGERENCIA` (privado ahí) — "no hay
 * sugerencia" para cuando ni siquiera se intenta el OCR (sin señal) o
 * cuando se agotó el tiempo de espera (ver `ocrConTimeout`). */
const SIN_SUGERENCIA: FuelReadingOcrResult = { value: null, status: 'UNREADABLE', confidence: 0 };

/** El backend hace OCR con dos modelos (ver `api/OcrAPI.ts`) — normalmente
 * responde en segundos, pero puede colgarse con mala señal. 8 s es "todavía
 * vale la pena esperar" sin trabar la pantalla de cierre de tarjeta más que
 * eso. No cancela la
 * request en curso (`fuelReadingOcr` no expone un `AbortSignal`) — solo dejar
 * de ESPERARLA: si llega tarde, su resultado ya no se usa. */
const OCR_TIMEOUT_MS = 8_000;

/**
 * OCR con guardas offline: sin señal, ni se intenta (una request que se sabe
 * de antemano que no va a llegar solo gasta batería/datos y demora el
 * cierre) — y con o sin señal, nunca espera más de `OCR_TIMEOUT_MS`. En
 * ambos casos cae a "sin sugerencia" SIN toast de error: el litraje se
 * tipea a mano, que es una acción normal, no una falla (ver
 * `components/flota/RegistrarCargaCombustibleModal.tsx`, el chip
 * "No se pudo leer la foto, ingresá los litros a mano" que ya cubre
 * `status === 'UNREADABLE'`).
 */
function ocrConTimeout(file: File): Promise<FuelReadingOcrResult> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return Promise.resolve(SIN_SUGERENCIA);
  }
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(SIN_SUGERENCIA), OCR_TIMEOUT_MS);
    void fuelReadingOcr(file).then((resultado) => {
      clearTimeout(timer);
      resolve(resultado);
    });
  });
}

export interface UsePhotoCaptureFlowResult {
  file: File | null;
  isReadingPhoto: boolean;
  captureDate: Date | null;
  ocr: FuelReadingOcrResult | null;
  handleSelectPhoto: (file: File) => Promise<void>;
  handleClearPhoto: () => void;
  /** Resetea todo el estado de la foto (file/OCR/EXIF) — el llamador lo combina
   * con el `reset()` de react-hook-form en su propio `limpiarTodo`. */
  resetPhoto: () => void;
}

export interface UsePhotoCaptureFlowOptions {
  /** `false` para una foto que no tiene un display que leer (ej. un
   * hallazgo): se salta la request de OCR — gasta datos y demora la
   * selección sin devolver nada útil. Default `true`. */
  ocr?: boolean;
}

/**
 * Orquestación del flujo foto→OCR→EXIF de trazabilidad anti-falsificación: al
 * seleccionar la foto corre EXIF (fecha real de captura, `readCaptureDate`) y OCR
 * (sugerencia numérica) EN PARALELO. La foto NO se sube acá: viaja como archivo de
 * la escritura que la usa y se sube al sincronizar (`offline/`).
 *
 * El OCR está hardcodeado a `fuelReadingOcr` (server-side, ver `api/OcrAPI.ts`;
 * el reconocedor client-side de `tesseract.js` no servía para el display de 7
 * segmentos del surtidor) en vez de inyectarse, para no sumar una abstracción sin
 * un segundo consumidor que la necesite. Si otro modal necesita foto+OCR con OTRO
 * reconocedor, ese es el momento de convertir `fuelReadingOcr` en un parámetro.
 *
 * `onReadingDetected` recibe la lectura sugerida: qué campo del form la recibe
 * (`valorInicial`/`valorFinal`/`litros`) lo decide cada pantalla.
 */
export function usePhotoCaptureFlow(
  onReadingDetected: (value: number) => void,
  { ocr: runOcr = true }: UsePhotoCaptureFlowOptions = {},
): UsePhotoCaptureFlowResult {
  const [file, setFile] = useState<File | null>(null);
  const [isReadingPhoto, setIsReadingPhoto] = useState(false);
  const [captureDate, setCaptureDate] = useState<Date | null>(null);
  const [ocr, setOcr] = useState<FuelReadingOcrResult | null>(null);
  const handleSelectPhoto = async (selected: File) => {
    setFile(selected);
    setOcr(null);
    setCaptureDate(null);
    setIsReadingPhoto(true);
    try {
      const [fecha, lectura] = await Promise.all([
        readCaptureDate(selected),
        runOcr ? ocrConTimeout(selected) : Promise.resolve(SIN_SUGERENCIA),
      ]);
      setCaptureDate(fecha);
      // Se guarda el resultado completo aunque `value` sea `null` — el modal
      // lo necesita para distinguir "sin sugerencia" (muestra aviso de baja
      // confianza) de "todavía no se leyó" (mientras `isReadingPhoto`).
      setOcr(lectura);
      if (lectura.value != null) {
        // El backend ya entrega `value` con el punto decimal puesto (ej.
        // "183.089"), pero igual se guarda el guard de NaN por si alguna vez
        // llega un string no numérico — no autorrellenamos con NaN: se deja
        // el campo como estaba y el usuario corrige a mano.
        const parsedValue = Number(lectura.value);
        if (Number.isFinite(parsedValue)) {
          onReadingDetected(parsedValue);
        }
      }
    } finally {
      setIsReadingPhoto(false);
    }
  };

  const handleClearPhoto = () => {
    setFile(null);
    setCaptureDate(null);
    setOcr(null);
  };

  const resetPhoto = () => {
    setFile(null);
    setCaptureDate(null);
    setOcr(null);
    setIsReadingPhoto(false);
  };

  return {
    file,
    isReadingPhoto,
    captureDate,
    ocr,
    handleSelectPhoto,
    handleClearPhoto,
    resetPhoto,
  };
}
