import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Camera, ImageUp, X } from 'lucide-react';

import { formatRelative, isFresh, readCaptureDate } from '../../lib/photo-reading';
import { Label } from './ui';

/** Tope de fotos de un campo: el del chequeo diario y el del cierre de una operación. */
export const MAX_FOTOS = 10;

/**
 * Varias fotos, de a una con la cámara (`capture`) o varias de la galería, cada
 * una con su botón para quitarla. Nunca deja pasar de `MAX_FOTOS`: al llegar al
 * tope desaparece «Agregar otra foto». Lo usan el chequeo diario (por ítem) y
 * el cierre de una operación del taller (mantenedor y panel).
 *
 * `fotos` puede traer, además de archivos nuevos, fotos ya guardadas con su
 * URL (al corregir un chequeo rechazado); las nuevas se muestran con una URL
 * local que se libera al quitarlas.
 *
 * Con `preguntaAntigua`, cada foto nueva se revisa por su fecha EXIF y, si no
 * es reciente, lleva un aviso ámbar con esa pregunta — informativo, no bloquea
 * (como el aviso de `FotoRespaldoField` cuando era una sola foto).
 */
export function FotosField<F extends File | { url: string }>({
  fotos,
  onChange,
  label = 'Fotos',
  requerida = false,
  descripcion,
  preguntaAntigua,
}: {
  fotos: readonly F[];
  onChange: (fotos: (F | File)[]) => void;
  label?: string;
  requerida?: boolean;
  /** Bajo «Agregar foto»; por defecto, que es opcional y hasta cuántas. */
  descripcion?: string;
  preguntaAntigua?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);
  // Las ya guardadas traen su URL; las nuevas, una local.
  const urls = useMemo(() => fotos.map((f) => (f instanceof File ? URL.createObjectURL(f) : f.url)), [fotos]);
  useEffect(() => () => urls.forEach((u, i) => fotos[i] instanceof File && URL.revokeObjectURL(u)), [urls, fotos]);

  // Fecha EXIF de cada foto nueva (`null`: no la trae). Solo si se pidió el aviso.
  const [fechas, setFechas] = useState<ReadonlyMap<File, Date | null>>(new Map());
  useEffect(() => {
    if (!preguntaAntigua) return;
    const porLeer = fotos.filter((f): f is F & File => f instanceof File && !fechas.has(f));
    if (porLeer.length === 0) return;
    let vigente = true;
    void Promise.all(porLeer.map(async (f) => [f, await readCaptureDate(f)] as const)).then((leidas) => {
      if (!vigente) return;
      setFechas((previas) => new Map([...previas, ...leidas]));
    });
    return () => {
      vigente = false;
    };
  }, [fotos, fechas, preguntaAntigua]);

  const agregar = (lista: FileList | null) => {
    const nuevas = Array.from(lista ?? []);
    if (nuevas.length) onChange([...fotos, ...nuevas].slice(0, MAX_FOTOS));
  };

  return (
    <div className="flex flex-col gap-2">
      <Label requerido={requerida}>{label}</Label>
      {/* Fotos a todo el ancho: una por fila en el teléfono, dos desde `sm`. */}
      {urls.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {urls.map((url, i) => {
            const foto = fotos[i];
            const fecha = foto instanceof File ? fechas.get(foto) : null;
            return (
              <div key={url} className="relative overflow-hidden rounded-2xl border border-border">
                <img alt={`Foto ${i + 1}`} className="h-44 w-full object-cover" src={url} />
                <button
                  aria-label={`Quitar foto ${i + 1}`}
                  className="absolute top-2 right-2 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/75"
                  type="button"
                  onClick={() => onChange(fotos.filter((_, j) => j !== i))}
                >
                  <X className="h-4 w-4" />
                </button>
                {preguntaAntigua && fecha && !isFresh(fecha) && (
                  <p className="m-0 flex items-center gap-1.5 bg-warning-soft px-3 py-2 text-xs font-medium text-warning-soft-foreground">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    Foto tomada {formatRelative(fecha)} · {preguntaAntigua}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
      {/* El mismo recuadro que «Foto del hallazgo» y «Foto del surtidor». */}
      {fotos.length < MAX_FOTOS && (
        <button
          className="flex w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-(--accent)/40 bg-(--accent-soft)/60 px-4 py-8 text-center transition hover:bg-(--accent-soft)"
          type="button"
          onClick={() => input.current?.click()}
        >
          <Camera className="h-6 w-6 text-(--accent)" aria-hidden />
          <span className="text-[15px] font-semibold text-(--accent-soft-foreground)">
            {fotos.length === 0 ? 'Agregar foto' : 'Agregar otra foto'}
          </span>
          <span className="text-[13px] text-(--muted)">
            {descripcion ?? `Opcional. Puedes agregar varias, hasta ${MAX_FOTOS}.`}
          </span>
        </button>
      )}
      {fotos.length < MAX_FOTOS && (
        <button
          className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 self-center rounded-xl px-3 text-sm font-semibold text-(--accent) transition hover:bg-(--accent-soft)"
          type="button"
          onClick={() => galeria.current?.click()}
        >
          <ImageUp aria-hidden className="h-4 w-4" />
          Elegir de la galería
        </button>
      )}
      <input
        ref={input}
        hidden
        accept="image/*"
        capture="environment"
        type="file"
        onChange={(e) => {
          agregar(e.target.files);
          e.target.value = '';
        }}
      />
      {/* Sin `capture`: la galería, para fotos ya sacadas (se pueden elegir varias). */}
      <input
        ref={galeria}
        hidden
        multiple
        accept="image/*"
        type="file"
        onChange={(e) => {
          agregar(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
