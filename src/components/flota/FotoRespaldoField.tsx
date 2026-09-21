import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Spinner } from '@heroui/react';

import { fmtDate, fmtTime } from '../../lib/format';
import { formatRelative, isFresh } from '../../lib/photo-reading';
import { PhotoCaptureField } from './PhotoCaptureField';

interface FotoRespaldoFieldProps {
  file: File | null;
  isReadingPhoto: boolean;
  isUploadingPhoto: boolean;
  captureDate: Date | null;
  onSelect: (file: File) => void;
  onClear: () => void;
  title: string;
  subtitle: string;
  /** Pregunta del aviso ámbar cuando la foto no es reciente — distingue
   * "¿es la lectura actual?" (horómetro, entrada/salida) de "¿es la carga
   * actual?" (combustible). */
  staleQuestion: string;
}

/**
 * Bloque "Foto de respaldo" completo (label + `PhotoCaptureField` + estado de
 * frescura EXIF) — antes triplicado verbatim entre `RegistrarEntradaModal`,
 * `RegistrarSalidaModal` y `RegistrarCargaCombustibleModal` (Fix F-MEDIA #1,
 * review adversarial). El estado (file/OCR/EXIF/subida) lo sigue
 * gestionando el modal vía `usePhotoCaptureFlow` — este componente solo
 * presenta ese estado, para que el DOM que produce (y los textos que buscan
 * los tests: "Analizando la foto…", "· reciente", etc.) quede idéntico al de
 * antes de la extracción.
 */
export function FotoRespaldoField({
  file,
  isReadingPhoto,
  isUploadingPhoto,
  captureDate,
  onSelect,
  onClear,
  title,
  subtitle,
  staleQuestion,
}: FotoRespaldoFieldProps) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-bold tracking-wider text-(--muted) uppercase">
        Foto de respaldo <span className="text-(--danger)">· requerida</span>
      </p>
      <PhotoCaptureField
        file={file}
        isBusy={isReadingPhoto || isUploadingPhoto}
        onClear={onClear}
        onSelect={onSelect}
        subtitle={subtitle}
        title={title}
      />
      {isReadingPhoto && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-(--muted)">
          <Spinner size="sm" /> Analizando la foto…
        </p>
      )}
      {!isReadingPhoto && captureDate && (
        <div
          className={`mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${
            isFresh(captureDate)
              ? 'bg-success-soft text-success-soft-foreground'
              : 'bg-warning-soft text-warning-soft-foreground'
          }`}
        >
          {isFresh(captureDate) ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0" />
          )}
          <span>
            Foto tomada {formatRelative(captureDate)} ({fmtDate(captureDate.toISOString())}{' '}
            {fmtTime(captureDate.toISOString())})
            {isFresh(captureDate) ? ' · reciente' : ` · ${staleQuestion}`}
          </span>
        </div>
      )}
      {!isReadingPhoto && file && !captureDate && (
        <p className="mt-2 text-xs text-(--muted)">
          La foto no trae fecha de captura (EXIF) — no se pudo validar su antigüedad.
        </p>
      )}
    </div>
  );
}
