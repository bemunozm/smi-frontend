import { axiosInstance } from '../lib/axios';

export type FuelReadingOcrStatus = 'CONFIRMED' | 'REVIEW' | 'UNREADABLE';

export interface FuelReadingOcrResult {
  /** Litros sugeridos por el OCR server-side, como string — el backend YA
   * entrega el punto decimal puesto (formato `NNN.NNN`, p. ej. "183.089"),
   * no hay que insertarlo acá. `null` solo cuando `status` es `UNREADABLE` —
   * el llamador debe tratarlo como "sin sugerencia", nunca como un valor a
   * autocompletar. */
  value: string | null;
  /** Resultado del ensemble de dos modelos independientes (Florence-2
   * fine-tuneado + CRNN) que corren en el worker Python:
   * - `CONFIRMED`: ambos modelos coincidieron en la lectura — `value` es
   *   confiable, se puede autorrellenar sin más aviso.
   * - `REVIEW`: los modelos difirieron, o solo uno de los dos leyó algo —
   *   `value` es una sugerencia (la lectura de Florence, o la de CRNN si
   *   Florence no leyó nada) que el usuario debe verificar antes de guardar.
   * - `UNREADABLE`: ningún modelo pudo leer nada — `value` es `null`.
   */
  status: FuelReadingOcrStatus;
  /** Confianza del modelo que aportó `value`, 0-1 (no 0-100). Es la
   * confianza cruda de ese modelo — no un promedio ni una calibración propia
   * del backend —, así que no es comparable entre requests con distinto
   * `status` ni con la escala del OCR tesseract que este endpoint reemplazó. */
  confidence: number;
}

const SIN_SUGERENCIA: FuelReadingOcrResult = { value: null, status: 'UNREADABLE', confidence: 0 };

/**
 * OCR server-side sobre la foto del surtidor para sugerir los litros de una
 * carga de combustible — reemplaza el OCR client-side de `tesseract.js`
 * (`recognizeReading`, removido de `lib/photo-reading.ts`), que no servía
 * para el display de 7 segmentos del surtidor. El usuario SIEMPRE puede
 * editar el resultado.
 *
 * Nunca lanza: tanto un resultado `UNREADABLE` que devuelva el backend (no
 * pudo leer la foto) como cualquier falla de la request (red, 401 sin
 * sesión, 400 si el archivo no es imagen) se resuelven acá mismo como "sin
 * sugerencia", para no bloquear el registro manual — mismo contrato que
 * tenía `recognizeReading` antes de este cambio.
 */
export async function fuelReadingOcr(file: File): Promise<FuelReadingOcrResult> {
  const form = new FormData();
  form.append('file', file);
  try {
    // `Content-Type: multipart/form-data` explícito: la instancia axios fuerza
    // `application/json` por default, y axios v1 con ese header SERIALIZA el
    // FormData a JSON (el archivo no llega → 400 "No se recibió archivo").
    // Sobrescribir acá deja que el navegador arme el multipart con boundary.
    const res = await axiosInstance.post<{ data: FuelReadingOcrResult; message: string }>(
      '/api/ocr/fuel-reading',
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return res.data.data;
  } catch {
    return SIN_SUGERENCIA;
  }
}
