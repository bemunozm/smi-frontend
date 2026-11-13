import { useState } from 'react';
import { ImageOff } from 'lucide-react';

interface RecordPhotoProps {
  src: string;
  alt: string;
  /** Nombre accesible del link (default: `alt`). */
  openLabel?: string;
  /** Leyenda bajo la foto — la affordance táctil; en desktop ya está el hint al hover. */
  caption?: string;
  /** Alto máximo del preview (clase Tailwind), p. ej. `max-h-[420px]`. */
  maxHeightClassName?: string;
}

/**
 * Foto adjunta a un registro (carga de combustible, tarjeta cerrada):
 * preview `object-contain` que se abre completa en otra pestaña — antes
 * duplicado entre `CargasCombustibleAdminView` y `RegistroEquipoView`.
 *
 * Las URLs firmadas vencen: si la imagen no carga, en vez de dejar el ícono
 * roto y un link a un XML de AccessDenied, se reemplaza por un aviso con la
 * salida (recargar la vista renueva la URL). El estado de error es por `src`:
 * un refetch que trae la URL renovada vuelve a mostrar la foto solo.
 */
export function RecordPhoto({ src, alt, openLabel, caption, maxHeightClassName = 'max-h-80' }: RecordPhotoProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (failedSrc === src) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-warning-soft px-3 py-2.5 text-sm text-warning-soft-foreground">
        <ImageOff aria-hidden className="h-4 w-4 shrink-0" />
        <span>No se pudo cargar la foto — puede que el enlace haya vencido. Actualiza la vista para renovarlo.</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <a
        aria-label={openLabel ?? alt}
        className="group relative block overflow-hidden rounded-2xl border border-border bg-surface-secondary"
        href={src}
        rel="noreferrer"
        target="_blank"
      >
        <img
          alt={alt}
          className={`${maxHeightClassName} w-full object-contain`}
          loading="lazy"
          onError={() => setFailedSrc(src)}
          src={src}
        />
        <span className="absolute right-2 bottom-2 rounded-lg bg-black/60 px-2 py-1 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
          Abrir en tamaño completo
        </span>
      </a>
      {caption ? <span className="text-[12.5px] text-muted-foreground">{caption}</span> : null}
    </div>
  );
}
