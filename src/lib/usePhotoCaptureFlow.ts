import { useRef, useState } from 'react';
import { toast } from '@heroui/react';

import { uploadFile } from '../api/UploadsAPI';
import { fuelReadingOcr, type FuelReadingOcrResult } from '../api/OcrAPI';
import { readCaptureDate } from './photo-reading';

/** Mismo shape que `OcrAPI.ts#SIN_SUGERENCIA` (privado ahí) — "no hay
 * sugerencia" para cuando ni siquiera se intenta el OCR (sin señal) o
 * cuando se agotó el tiempo de espera (ver `ocrConTimeout`). */
const SIN_SUGERENCIA: FuelReadingOcrResult = { value: null, status: 'UNREADABLE', confidence: 0 };

/** El backend hace OCR con dos modelos (ver `api/OcrAPI.ts`) — normalmente
 * responde en segundos, pero puede colgarse con mala señal. 8 s es "todavía
 * vale la pena esperar" sin trabar la pantalla de cierre de tarjeta más que
 * eso (RFC "Supervisión en Terreno" §Diseño → Offline). No cancela la
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
  isUploadingPhoto: boolean;
  captureDate: Date | null;
  ocr: FuelReadingOcrResult | null;
  handleSelectPhoto: (file: File) => Promise<void>;
  handleClearPhoto: () => void;
  /** Resetea todo el estado de la foto (file/OCR/EXIF/subida) — el llamador
   * lo combina con el `reset()` de react-hook-form en su propio
   * `limpiarTodo`. NO toca el flag de cancelación (ver `cancelar`), que vive
   * aparte porque su ciclo de vida es distinto (se lee después de un
   * `await` ya en vuelo, no en cada limpieza de estado). */
  resetPhoto: () => void;
  /** Marca el flujo como cancelado — se llama al cerrar/cancelar el modal
   * ANTES de `resetPhoto`. Aborta un `onSubmit` en vuelo: si la foto se
   * estaba subiendo cuando el usuario cerró, evita que igual se cree el
   * registro cuando esa subida (no cancelable) termine. */
  cancelar: () => void;
  /**
   * Sube la foto (`uploadFile`, Flota vía R2/MinIO — ver Diseño del RFC
   * R2-storage) con el mismo patrón anti-doble-submit que ya tenían los 3
   * modales: resetea el flag de cancelación al empezar, togglea
   * `isUploadingPhoto`, y devuelve `null` (sin lanzar) tanto si la subida
   * falló (ya toasteó el error, con el mensaje claro de `uploadFile`) como si
   * el flujo se canceló mientras subía — en ambos casos el llamador
   * simplemente no debe crear el registro/turno. En éxito devuelve la KEY
   * `tmp/<userId>/<uuid>.<ext>` (no la URL): el caller la manda como
   * `fotoKey` al guardar.
   */
  upload: (file: File) => Promise<string | null>;
}

export interface UsePhotoCaptureFlowOptions {
  /** `false` para una foto que no tiene un display que leer (ej. un
   * hallazgo): se salta la request de OCR — gasta datos y demora la
   * selección sin devolver nada útil. Default `true`. */
  ocr?: boolean;
}

/**
 * Orquestación del flujo foto→OCR→EXIF de trazabilidad anti-falsificación,
 * antes triplicada casi verbatim entre `RegistrarEntradaModal`,
 * `RegistrarSalidaModal` y `RegistrarCargaCombustibleModal` (Fix F-MEDIA #1,
 * review adversarial): al seleccionar la foto corre EXIF (fecha real de
 * captura, `readCaptureDate`) y OCR (sugerencia numérica) EN PARALELO, y
 * expone una subida con cancelación para el `onSubmit` de cada modal.
 *
 * `RegistrarEntradaModal`/`RegistrarSalidaModal` ya no usan foto (se sacó
 * del horómetro), así que hoy `RegistrarCargaCombustibleModal` es el único
 * consumidor — el OCR está hardcodeado a `fuelReadingOcr` (server-side, ver
 * `api/OcrAPI.ts`; reemplazó al `recognizeReading` client-side de
 * `tesseract.js`, que no servía para el display de 7 segmentos del
 * surtidor) en vez de inyectarse, para no sumar una abstracción sin un
 * segundo consumidor real que la necesite. Si en el futuro otro modal vuelve
 * a necesitar foto+OCR con OTRO reconocedor, ese es el momento de convertir
 * `fuelReadingOcr` en un parámetro.
 *
 * `onReadingDetected` es el único punto que variaba entre los 3 llamadores
 * originales — qué campo del form recibe la lectura sugerida
 * (`valorInicial`/`valorFinal`/`litros`), vía el
 * `setValue(..., { shouldValidate: true })` propio de cada modal.
 */
export function usePhotoCaptureFlow(
  onReadingDetected: (value: number) => void,
  { ocr: runOcr = true }: UsePhotoCaptureFlowOptions = {},
): UsePhotoCaptureFlowResult {
  const [file, setFile] = useState<File | null>(null);
  const [isReadingPhoto, setIsReadingPhoto] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [captureDate, setCaptureDate] = useState<Date | null>(null);
  const [ocr, setOcr] = useState<FuelReadingOcrResult | null>(null);
  // Se marca en `cancelar()` y se revisa después del `await uploadImage(...)`
  // en `upload`: la subida de la foto no es cancelable (es una promesa ya en
  // vuelo), así que si el usuario cierra/cancela MIENTRAS sube, esto evita
  // que igual se cree el registro/turno cuando la subida termine.
  const canceladoRef = useRef(false);

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
    setIsUploadingPhoto(false);
  };

  const cancelar = () => {
    canceladoRef.current = true;
  };

  const upload = async (fileToUpload: File): Promise<string | null> => {
    canceladoRef.current = false;
    setIsUploadingPhoto(true);
    let key: string;
    try {
      ({ key } = await uploadFile(fileToUpload));
    } catch (error) {
      setIsUploadingPhoto(false);
      if (!canceladoRef.current) {
        toast.danger(error instanceof Error ? error.message : 'No se pudo subir la foto. Intentá de nuevo.');
      }
      return null;
    }
    setIsUploadingPhoto(false);

    // El usuario canceló/cerró MIENTRAS la foto subía: la subida no se pudo
    // abortar (ya estaba en vuelo), pero al menos evitamos crear el
    // registro/turno después de que cerró el modal.
    if (canceladoRef.current) return null;

    return key;
  };

  return {
    file,
    isReadingPhoto,
    isUploadingPhoto,
    captureDate,
    ocr,
    handleSelectPhoto,
    handleClearPhoto,
    resetPhoto,
    cancelar,
    upload,
  };
}
