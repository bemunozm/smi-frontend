import { useEffect } from 'react';

import { FotoRespaldoField } from '../flota/FotoRespaldoField';
import { AdBlueCampos } from '../terreno/AdBlueCampos';
import { Campo, Input } from '../terreno/ui';
import { validarAdBlue } from '../../lib/adblue';
import { formatDecimalInput, parseDecimal } from '../../lib/decimal';
import { claveError, fmtLectura, type FilaCierreForm, type TarjetaTemporal } from '../../lib/informe-temporal';
import { AYUDA_LITROS, validarLitros } from '../../lib/litros';
import { usePhotoCaptureFlow } from '../../lib/usePhotoCaptureFlow';

/** Estado de una fila: lo que valida `validarInformeTemporal` más si la foto se está leyendo. */
export type FilaCierreEstado = FilaCierreForm & { leyendoFoto: boolean };

/**
 * El cierre de UNA tarjeta dentro del informe: lectura final, foto del
 * surtidor (con OCR que llena los litros, el mismo bloque del cierre de
 * Terreno), litros y AdBlue en los pesados. Cada fila tiene su propia foto:
 * `usePhotoCaptureFlow` vive acá y le avisa al formulario qué foto quedó.
 */
export function CierreTarjetaFila({
  tarjeta,
  fila,
  errores,
  onCambio,
}: {
  tarjeta: TarjetaTemporal;
  fila: FilaCierreEstado;
  /** Errores del formulario (solo se muestran tras intentar enviar). */
  errores: Record<string, string>;
  onCambio: (cardId: string, cambio: Partial<FilaCierreEstado>) => void;
}) {
  const { id, liviano } = tarjeta;
  // Los 3 decimales del surtidor tal cual, como en el cierre de Terreno.
  const foto = usePhotoCaptureFlow((litros) => onCambio(id, { litros: formatDecimalInput(litros, 3) }));
  const { file, captureDate, isReadingPhoto } = foto;
  useEffect(() => {
    onCambio(id, { foto: file, fotoCapturada: captureDate, leyendoFoto: isReadingPhoto });
  }, [onCambio, id, file, captureDate, isReadingPhoto]);

  const litros = validarLitros(fila.litros, { liviano });
  const fotoRequerida = (litros.valor ?? 0) > 0;
  const adBlue = validarAdBlue(fila.adBlue, parseDecimal(fila.adBlueLitros), fila.adBlueLitros.trim() !== '');

  return (
    <section
      role="group"
      aria-label={`${tarjeta.codigo} · ${tarjeta.nombre}`}
      className="flex flex-col gap-3 rounded-2xl border border-border p-3.5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <span className="tabular text-[17px] font-bold">{tarjeta.codigo}</span>
          <span className="text-[13px] text-[var(--label-color)]">{tarjeta.nombre}</span>
        </div>
        <span className="tabular text-[13.5px] text-muted-foreground">
          Inicial <b className="font-semibold text-foreground">{fmtLectura(tarjeta.inicial, liviano)}</b>
        </span>
      </div>

      <Campo
        label={liviano ? 'Kilometraje final' : 'Horómetro final'}
        requerido
        unidad={liviano ? 'km' : 'h'}
        error={errores[claveError('final', id)]}
      >
        <Input numerico value={fila.final} onChange={(e) => onCambio(id, { final: e.target.value })} />
      </Campo>

      <FotoRespaldoField
        file={foto.file}
        isReadingPhoto={foto.isReadingPhoto}
        captureDate={foto.captureDate}
        onSelect={foto.handleSelectPhoto}
        onClear={foto.handleClearPhoto}
        requerida={fotoRequerida}
        title="Foto del surtidor"
        subtitle="Solo si se cargó combustible: debe verse el totalizador. Los litros se leen de la foto y quedan editables."
        staleQuestion="¿Es la carga de esta jornada?"
      />
      {errores[claveError('foto', id)] && (
        <span className="text-[12.5px] leading-snug font-semibold text-[var(--danger)]" role="alert">
          {errores[claveError('foto', id)]}
        </span>
      )}

      <Campo
        label="Combustible cargado (opcional)"
        unidad="L"
        litros
        hint={`${AYUDA_LITROS} Déjalo vacío si no se cargó.`}
        error={litros.error ?? errores[claveError('litros', id)]}
        aviso={litros.aviso ?? undefined}
      >
        <Input numerico value={fila.litros} onChange={(e) => onCambio(id, { litros: e.target.value })} />
      </Campo>

      {!liviano && (
        <AdBlueCampos
          adBlue={fila.adBlue}
          litros={fila.adBlueLitros}
          resultado={{ ...adBlue, error: adBlue.error ?? errores[claveError('adBlue', id)] ?? null }}
          onAdBlue={(valor) => onCambio(id, { adBlue: valor })}
          onLitros={(adBlueLitros) => onCambio(id, { adBlueLitros })}
        />
      )}
    </section>
  );
}
