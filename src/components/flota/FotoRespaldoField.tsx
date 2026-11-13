import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Spinner } from '@heroui/react';

import { fmtDate, fmtTime } from '../../lib/format';
import { formatRelative, isFresh } from '../../lib/photo-reading';
import { PhotoCaptureField } from './PhotoCaptureField';

interface FotoRespaldoFieldProps {
  file: File | null;
  isReadingPhoto: boolean;
  captureDate: Date | null;
  onSelect: (file: File) => void;
  onClear: () => void;
  title: string;
  subtitle: string;
  /** Pregunta del aviso ámbar cuando la foto no es reciente — distingue
   * "¿es la lectura actual?" (horómetro, entrada/salida) de "¿es la carga
   * actual?" (combustible). */
  staleQuestion: string;
  /**
   * Por defecto la foto es requerida (los tres usos de Flota la exigen). En
   * Hallazgos es opcional, y el encabezado tiene que decirlo: si dice
   * "requerida" en rojo sobre un campo que no lo es, el supervisor saca una
   * foto de más o abandona el formulario creyendo que le falta algo.
   */
  requerida?: boolean;
  /**
   * Guía de encuadre. La de Flota habla del display porque lo que se fotografía
   * es un contador; un hallazgo no tiene display.
   */
  guia?: string;
  /** Bloquea elegir, tomar o quitar la foto (p. ej. mientras se guarda). */
  disabled?: boolean;
  /**
   * Registro de un día que ya pasó: sirve cualquier foto de respaldo (el
   * surtidor, la boleta o el registro en papel), y no tiene sentido evaluar
   * su antigüedad ni avisar que no trae fecha — una foto del papel o de
   * WhatsApp casi nunca la trae, y el aviso se leía como un rechazo.
   */
  registroAnterior?: boolean;
  /**
   * `true` cuando el formulario tiene un campo de fecha del registro editable
   * (las altas de carga de combustible): el aviso de "foto sin fecha" agrega
   * la instrucción de revisarla. En los flujos del día (cierre de tarjeta,
   * entrada/salida, checklist) no existe ese campo — mandar a revisarlo hace
   * buscar un campo que no está.
   */
  fechaEditable?: boolean;
}

/**
 * Bloque "Foto de respaldo" completo (label + `PhotoCaptureField` + estado de
 * frescura EXIF) — antes triplicado verbatim entre `RegistrarEntradaModal`,
 * `RegistrarSalidaModal` y `RegistrarCargaCombustibleModal`. El estado
 * (file/OCR/EXIF) lo sigue
 * gestionando el modal vía `usePhotoCaptureFlow` — este componente solo
 * presenta ese estado, para que el DOM que produce (y los textos que buscan
 * los tests: "Analizando la foto…", "· reciente", etc.) quede idéntico al de
 * antes de la extracción.
 *
 * Incluye una guía de captura fija (texto, sin overlay de cámara — alcanza
 * para el MVP) para mejorar la tasa de acierto del OCR server-side: pedirle
 * al usuario que encuadre de frente, sin sombras/reflejos, reduce fotos
 * ilegibles antes de que lleguen al backend.
 */
export function FotoRespaldoField({
  file,
  isReadingPhoto,
  captureDate,
  onSelect,
  onClear,
  title,
  subtitle,
  staleQuestion,
  requerida = true,
  guia = 'Saca la foto de frente al display, sin la mano sobre el vidrio, evitando reflejos y sombras.',
  disabled = false,
  registroAnterior = false,
  fechaEditable = false,
}: FotoRespaldoFieldProps) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-bold tracking-wider text-(--muted) uppercase">
        Foto de respaldo{' '}
        {requerida ? (
          <span className="text-(--danger)">· requerida</span>
        ) : (
          <span className="text-(--muted)">· opcional</span>
        )}
      </p>
      <p className="mb-2 text-xs text-(--muted)">{guia}</p>
      <PhotoCaptureField
        file={file}
        isBusy={isReadingPhoto || disabled}
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
      {!registroAnterior && !isReadingPhoto && captureDate && (
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
            {fmtTime(captureDate.toISOString())}){isFresh(captureDate) ? ' · reciente' : ` · ${staleQuestion}`}
          </span>
        </div>
      )}
      {/* Informativo, no bloquea: la foto se acepta igual. */}
      {!registroAnterior && !isReadingPhoto && file && !captureDate && (
        <p className="mt-2 text-xs text-(--muted)">
          La foto no trae su fecha (pasa con fotos del papel o reenviadas): se acepta igual.
          {fechaEditable ? ' Revisa que la fecha del registro sea la correcta.' : ''}
        </p>
      )}
    </div>
  );
}
