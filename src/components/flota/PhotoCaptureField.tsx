import { useEffect, useRef, useState } from 'react';
import { Camera, ImageUp, RefreshCw, X } from 'lucide-react';

interface PhotoCaptureFieldProps {
  /** Archivo crudo seleccionado — lo controla el padre (necesita el `File`
   * para correr OCR/EXIF antes de decidir si sube la foto). */
  file: File | null;
  onSelect: (file: File) => void;
  onClear: () => void;
  title?: string;
  subtitle?: string;
  /** Deshabilita la interacción mientras se procesa (OCR/EXIF) o se sube. */
  isBusy?: boolean;
}

/**
 * Captura de foto obligatoria para el flujo de trazabilidad anti-falsificación
 * (registro de lectura de horómetro / carga de combustible). A diferencia de
 * `PhotoDropzone` de Terreno (`components/terreno/mobile.tsx`), que sube el
 * archivo al backend apenas se selecciona, este componente NO sube nada: solo
 * expone el `File` crudo, porque el modal que lo usa necesita ese archivo para
 * correr OCR + leer EXIF en el navegador antes de guardar. La subida real
 * (`uploadImage`) ocurre recién al confirmar el registro.
 *
 * El recuadro abre la cámara directo (`capture`), que es lo habitual en
 * faena; «Elegir de la galería» abre las fotos del equipo, para una foto que
 * ya se sacó (pedido del 05/11). La fecha EXIF de una foto vieja la sigue
 * marcando `FotoRespaldoField` con su pregunta de foto antigua.
 */
export function PhotoCaptureField({
  file,
  onSelect,
  onClear,
  title = 'Fotografiar',
  subtitle,
  isBusy = false,
}: PhotoCaptureFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const galeriaRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleFiles = (files: FileList | null) => {
    const picked = files?.[0];
    if (picked) onSelect(picked);
  };

  const alElegir = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    e.target.value = '';
  };
  const inputEl = (
    <>
      <input accept="image/*" capture="environment" className="hidden" onChange={alElegir} ref={inputRef} type="file" />
      {/* Sin `capture`: el sistema ofrece la galería (y la cámara, si se quiere). */}
      <input accept="image/*" className="hidden" onChange={alElegir} ref={galeriaRef} type="file" />
    </>
  );
  const botonGaleria = (
    <button
      className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-(--accent) transition hover:bg-(--accent-soft) disabled:cursor-not-allowed disabled:opacity-60"
      disabled={isBusy}
      onClick={() => galeriaRef.current?.click()}
      type="button"
    >
      <ImageUp aria-hidden className="h-4 w-4" />
      Elegir de la galería
    </button>
  );

  if (previewUrl) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-border">
        <img alt="Foto de respaldo del registro" className="h-44 w-full object-cover" src={previewUrl} />
        <div className="absolute top-2 right-2 flex gap-1.5">
          <button
            aria-label="Reemplazar foto"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/75 disabled:opacity-60"
            disabled={isBusy}
            onClick={() => inputRef.current?.click()}
            type="button"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            aria-label="Quitar foto"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/75 disabled:opacity-60"
            disabled={isBusy}
            onClick={onClear}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="absolute bottom-2 left-2 rounded-xl bg-white/90">{botonGaleria}</div>
        {inputEl}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        className="flex w-full flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-(--accent)/40 bg-(--accent-soft)/60 px-4 py-8 text-center transition hover:bg-(--accent-soft) disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isBusy}
        onClick={() => inputRef.current?.click()}
        type="button"
      >
        <Camera className="h-6 w-6 text-(--accent)" />
        <span className="text-sm font-semibold text-(--accent-soft-foreground)">{title}</span>
        {subtitle && <span className="text-xs text-(--muted)">{subtitle}</span>}
      </button>
      {botonGaleria}
      {inputEl}
    </div>
  );
}
