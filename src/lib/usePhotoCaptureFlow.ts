import { useRef, useState } from 'react';
import { toast } from '@heroui/react';

import { uploadImage } from '../api/UploadsAPI';
import { readCaptureDate, recognizeReading, type OcrResult } from './photo-reading';

export interface UsePhotoCaptureFlowResult {
  file: File | null;
  isReadingPhoto: boolean;
  isUploadingPhoto: boolean;
  captureDate: Date | null;
  ocr: OcrResult | null;
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
   * Sube la foto (`uploadImage`) con el mismo patrón anti-doble-submit que
   * ya tenían los 3 modales: resetea el flag de cancelación al empezar,
   * togglea `isUploadingPhoto`, y devuelve `null` (sin lanzar) tanto si la
   * subida falló (ya toasteó el error) como si el flujo se canceló mientras
   * subía — en ambos casos el llamador simplemente no debe crear el
   * registro/turno.
   */
  upload: (file: File) => Promise<string | null>;
}

/**
 * Orquestación del flujo foto→OCR→EXIF de trazabilidad anti-falsificación,
 * antes triplicada casi verbatim entre `RegistrarEntradaModal`,
 * `RegistrarSalidaModal` y `RegistrarCargaCombustibleModal` (Fix F-MEDIA #1,
 * review adversarial): al seleccionar la foto corre EXIF (fecha real de
 * captura, `readCaptureDate`) y OCR (sugerencia numérica, `recognizeReading`)
 * EN PARALELO, y expone una subida con cancelación para el `onSubmit` de
 * cada modal.
 *
 * `onReadingDetected` es el único punto que varía entre los 3 llamadores —
 * qué campo del form recibe la lectura sugerida (`valorInicial`/`valorFinal`/
 * `litros`), vía el `setValue(..., { shouldValidate: true })` propio de cada
 * modal. El resto del estado (file/OCR/EXIF/subida) es idéntico en los tres.
 */
export function usePhotoCaptureFlow(onReadingDetected: (value: number) => void): UsePhotoCaptureFlowResult {
  const [file, setFile] = useState<File | null>(null);
  const [isReadingPhoto, setIsReadingPhoto] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [captureDate, setCaptureDate] = useState<Date | null>(null);
  const [ocr, setOcr] = useState<OcrResult | null>(null);
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
      const [fecha, lectura] = await Promise.all([readCaptureDate(selected), recognizeReading(selected)]);
      setCaptureDate(fecha);
      if (lectura.value) {
        setOcr(lectura);
        onReadingDetected(Number(lectura.value));
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
    let url: string;
    try {
      url = await uploadImage(fileToUpload);
    } catch {
      setIsUploadingPhoto(false);
      if (!canceladoRef.current) toast.danger('No se pudo subir la foto. Intentá de nuevo.');
      return null;
    }
    setIsUploadingPhoto(false);

    // El usuario canceló/cerró MIENTRAS la foto subía: la subida no se pudo
    // abortar (ya estaba en vuelo), pero al menos evitamos crear el
    // registro/turno después de que cerró el modal.
    if (canceladoRef.current) return null;

    return url;
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
