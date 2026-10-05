import { AlertTriangle } from 'lucide-react';

import { ADBLUE_AVISO_LITROS, type ResultadoAdBlue } from '../../lib/adblue';
import { Campo, Input, Label, Segmentado } from './ui';

/**
 * AdBlue del cierre de tarjeta: ¿cargó? Sí/No y, si sí, cuántos
 * litros. El error (sin litros, más de 1000 L) impide guardar; el aviso de más
 * de 30 L no — es un «¿seguro?», no un rechazo.
 */
export function AdBlueCampos({
  adBlue,
  litros,
  resultado,
  onAdBlue,
  onLitros,
}: {
  adBlue: boolean;
  litros: string;
  resultado: ResultadoAdBlue;
  onAdBlue: (adBlue: boolean) => void;
  onLitros: (litros: string) => void;
}) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label>AdBlue</Label>
        <Segmentado
          etiqueta="¿Cargó AdBlue en el turno?"
          valor={adBlue ? 'si' : 'no'}
          onChange={(valor) => onAdBlue(valor === 'si')}
          opciones={[
            { valor: 'no', label: 'No cargó' },
            { valor: 'si', label: 'Sí cargó' },
          ]}
        />
      </div>
      {adBlue && (
        <Campo label="AdBlue cargado" requerido unidad="L">
          <Input numerico value={litros} onChange={(e) => onLitros(e.target.value)} />
        </Campo>
      )}
      {resultado.error && <span className="text-[13px] font-semibold text-[var(--danger)]">{resultado.error}</span>}
      {resultado.aviso && (
        <p
          role="status"
          className="m-0 flex items-start gap-2 rounded-2xl bg-[var(--warning-soft)] px-3 py-2.5 text-[13px] text-[var(--warning-soft-foreground)]"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            Son más de {ADBLUE_AVISO_LITROS} L de AdBlue: revisá que el valor esté bien. Podés guardar igual.
          </span>
        </p>
      )}
    </>
  );
}
