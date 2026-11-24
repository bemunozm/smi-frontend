import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, toast } from '@heroui/react';
import { AlertTriangle, Camera, ImagePlus, ImageUp, X } from 'lucide-react';

import { copiarAMemoria } from '../../lib/copiar-a-memoria';
import { FOTO_ILEGIBLE, formatRelative, isFresh, readCaptureDate } from '../../lib/photo-reading';
import { Label } from './ui';

/** Tope de fotos de un campo: el del chequeo diario y el del cierre de una operación. */
export const MAX_FOTOS = 10;

/**
 * Varias fotos, cada una con su botón para quitarla. Nunca deja pasar de
 * `MAX_FOTOS`: al llegar al tope desaparece el botón de agregar, y si en la
 * galería se eligen de más se agregan las que caben y se avisa. Lo usan el
 * chequeo diario (por ítem) y el cierre de una operación del taller.
 *
 * Dos variantes: `terreno` (kit de Terreno: recuadro grande, cámara directa
 * con `capture` o galería) y `panel` (HeroUI, compacta: un botón «Agregar
 * fotos» que abre el selector de archivos y la grilla de miniaturas).
 *
 * `fotos` puede traer, además de archivos nuevos, fotos ya guardadas con su
 * URL (al corregir un chequeo rechazado); las nuevas se muestran con una URL
 * local que se libera al quitarlas.
 *
 * Con `copiarAMemoria`, cada foto elegida se copia a memoria al agregarla
 * (como `usePhotoCaptureFlow`): el `File` de la galería es solo una referencia
 * y Android puede quitar el permiso de leerla antes de guardar. Una foto que
 * ya no se puede leer no se agrega y se avisa.
 *
 * Con `preguntaAntigua`, cada foto nueva se revisa por su fecha EXIF y, si no
 * es reciente, lleva un aviso ámbar con esa pregunta — informativo, no bloquea.
 */
export function FotosField<F extends File | { url: string }>({
  fotos,
  onChange,
  label = 'Fotos',
  requerida = false,
  descripcion,
  preguntaAntigua,
  copiarAMemoria: copiar = false,
  variante = 'terreno',
}: {
  fotos: readonly F[];
  onChange: (fotos: (F | File)[]) => void;
  label?: string;
  requerida?: boolean;
  /** Bajo el botón de agregar; por defecto, que es opcional y hasta cuántas. */
  descripcion?: string;
  preguntaAntigua?: string;
  copiarAMemoria?: boolean;
  variante?: 'terreno' | 'panel';
}) {
  const input = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);
  // La copia a memoria es asíncrona: al terminar se agrega sobre la lista
  // vigente, no sobre la que había al elegir.
  const fotosRef = useRef(fotos);
  fotosRef.current = fotos;
  // Las ya guardadas traen su URL; las nuevas, una local.
  const urls = useMemo(() => fotos.map((f) => (f instanceof File ? URL.createObjectURL(f) : f.url)), [fotos]);
  useEffect(() => () => urls.forEach((u, i) => fotos[i] instanceof File && URL.revokeObjectURL(u)), [urls, fotos]);

  // Fecha EXIF de cada foto nueva (`null`: no la trae), solo de las que siguen
  // en la lista. Solo se leen si se pidió el aviso.
  const [fechas, setFechas] = useState<ReadonlyMap<File, Date | null>>(new Map());
  useEffect(() => {
    const actuales = new Set<File>(fotos.filter((f): f is F & File => f instanceof File));
    if ([...fechas.keys()].some((f) => !actuales.has(f))) {
      setFechas((previas) => new Map([...previas].filter(([f]) => actuales.has(f))));
      return;
    }
    if (!preguntaAntigua) return;
    const porLeer = [...actuales].filter((f) => !fechas.has(f));
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

  const agregar = async (lista: FileList | null) => {
    const elegidas = Array.from(lista ?? []);
    if (elegidas.length === 0) return;
    let nuevas = elegidas;
    if (copiar) {
      const copias = await Promise.all(elegidas.map((f) => copiarAMemoria(f).catch(() => null)));
      nuevas = copias.filter((f): f is File => f !== null);
      const fallidas = elegidas.length - nuevas.length;
      if (fallidas === 1) toast.danger(FOTO_ILEGIBLE);
      else if (fallidas > 1) toast.danger(`No se pudieron leer ${fallidas} fotos. ${FOTO_ILEGIBLE}`);
    }
    if (nuevas.length === 0) return;
    const actuales = fotosRef.current;
    const libres = MAX_FOTOS - actuales.length;
    if (libres <= 0) return;
    if (nuevas.length > libres) {
      toast.warning(`Se agregaron ${libres} de ${nuevas.length}: el máximo es ${MAX_FOTOS} fotos.`);
    }
    onChange([...actuales, ...nuevas.slice(0, libres)]);
  };

  const quitar = (i: number) => onChange(fotos.filter((_, j) => j !== i));
  const hayLugar = fotos.length < MAX_FOTOS;
  const textoAyuda = descripcion ?? `Opcional. Puedes agregar varias, hasta ${MAX_FOTOS}.`;

  const avisoAntigua = (i: number) => {
    const foto = fotos[i];
    const fecha = foto instanceof File ? fechas.get(foto) : null;
    if (!preguntaAntigua || !fecha || isFresh(fecha)) return null;
    return (
      <p className="m-0 flex items-center gap-1.5 bg-warning-soft px-3 py-2 text-xs font-medium text-warning-soft-foreground">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        Foto tomada {formatRelative(fecha)} · {preguntaAntigua}
      </p>
    );
  };

  const inputGaleria = (
    // Sin `capture`: la galería o el explorador, para fotos ya sacadas (se pueden elegir varias).
    <input
      ref={galeria}
      hidden
      multiple
      accept="image/*"
      type="file"
      onChange={(e) => {
        void agregar(e.target.files);
        e.target.value = '';
      }}
    />
  );

  if (variante === 'panel') {
    return (
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {urls.length > 0 && (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {urls.map((url, i) => (
              <div key={url} className="relative overflow-hidden rounded-lg border border-border">
                <img alt={`Foto ${i + 1}`} className="h-20 w-full object-cover" src={url} />
                <Button
                  aria-label={`Quitar foto ${i + 1}`}
                  className="absolute top-1 right-1"
                  isIconOnly
                  onPress={() => quitar(i)}
                  size="sm"
                  variant="secondary"
                >
                  <X aria-hidden size={14} />
                </Button>
                {avisoAntigua(i)}
              </div>
            ))}
          </div>
        )}
        {hayLugar && (
          <Button className="self-start" onPress={() => galeria.current?.click()} size="sm" variant="tertiary">
            <ImagePlus aria-hidden size={16} />
            Agregar fotos
          </Button>
        )}
        <p className="m-0 text-xs text-muted-foreground">{textoAyuda}</p>
        {inputGaleria}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Label requerido={requerida}>{label}</Label>
      {/* Fotos a todo el ancho: una por fila en el teléfono, dos desde `sm`. */}
      {urls.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {urls.map((url, i) => (
            <div key={url} className="relative overflow-hidden rounded-2xl border border-border">
              <img alt={`Foto ${i + 1}`} className="h-44 w-full object-cover" src={url} />
              <button
                aria-label={`Quitar foto ${i + 1}`}
                className="absolute top-2 right-2 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/75"
                type="button"
                onClick={() => quitar(i)}
              >
                <X className="h-4 w-4" />
              </button>
              {avisoAntigua(i)}
            </div>
          ))}
        </div>
      )}
      {/* El mismo recuadro que «Foto del hallazgo» y «Foto del surtidor». */}
      {hayLugar && (
        <button
          className="flex w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-(--accent)/40 bg-(--accent-soft)/60 px-4 py-8 text-center transition hover:bg-(--accent-soft)"
          type="button"
          onClick={() => input.current?.click()}
        >
          <Camera className="h-6 w-6 text-(--accent)" aria-hidden />
          <span className="text-[15px] font-semibold text-(--accent-soft-foreground)">
            {fotos.length === 0 ? 'Agregar foto' : 'Agregar otra foto'}
          </span>
          <span className="text-[13px] text-(--muted)">{textoAyuda}</span>
        </button>
      )}
      {hayLugar && (
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
          void agregar(e.target.files);
          e.target.value = '';
        }}
      />
      {inputGaleria}
    </div>
  );
}
