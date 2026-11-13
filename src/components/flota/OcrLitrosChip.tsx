import { Chip } from '@heroui/react';

import { fmtLitros } from '../../lib/format';
import type { SugerenciaOcr } from '../../lib/usePhotoCaptureFlow';

interface OcrLitrosChipProps {
  /** Resultado del OCR ya leído (el llamador lo anula mientras `isReadingPhoto`). */
  ocr: SugerenciaOcr;
  /** Valor ACTUAL del campo Litros — el chip habla de lo que se ve en pantalla. */
  litros: number;
}

/**
 * Chip de estado del OCR junto al campo Litros — antes duplicado verbatim
 * entre `RegistrarCargaCombustibleModal` y `NuevaCargaCombustibleModal`.
 *
 * El chip solo afirma «Leído de la foto» cuando el valor en pantalla ES el de
 * la foto: si difieren (el usuario lo tipeó antes y el guard de isDirty no
 * autollenó, o lo corrigió después), decir «Leído de la foto» avalaría con la
 * foto un número que la foto contradice — en ese caso muestra la lectura para
 * que el usuario concilie. Con un `value` que no parsea (NaN) no hay número
 * que comparar: se mantiene el chip por `status` (decisión existente, ver el
 * test «si el valor sugerido no es numérico» del modal de Terreno).
 */
export function OcrLitrosChip({ ocr, litros }: OcrLitrosChipProps) {
  if (ocr.fueraDeRango) {
    // El OCR puede saltarse el punto decimal del display («100.000» leído como
    // cien mil): sobre el umbral no se autollena nada — ver `OCR_AUTOFILL_MAX_LITROS`.
    return (
      <Chip color="danger" size="sm" variant="soft">
        ⚠️ Lectura inusual de la foto: escribí los litros a mano
      </Chip>
    );
  }
  const valorOcr = ocr.value != null ? Number(ocr.value) : null;
  if (valorOcr != null && Number.isFinite(valorOcr) && valorOcr !== litros) {
    return (
      <Chip color="warning" size="sm" variant="soft">
        ⚠️ La foto dice {fmtLitros(valorOcr)} L
      </Chip>
    );
  }
  if (ocr.status === 'CONFIRMED') {
    return (
      <Chip color="success" size="sm" variant="soft">
        Leído de la foto
      </Chip>
    );
  }
  if (ocr.status === 'REVIEW') {
    return (
      <Chip color="warning" size="sm" variant="soft">
        ⚠️ Verificá el valor leído
      </Chip>
    );
  }
  return (
    <Chip color="default" size="sm" variant="soft">
      No se pudo leer la foto, ingresá los litros a mano
    </Chip>
  );
}
