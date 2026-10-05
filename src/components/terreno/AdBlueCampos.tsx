import { ADBLUE_NOTA_ESTANQUE, type ResultadoAdBlue } from '../../lib/adblue';
import { Campo, Input, Label, Segmentado } from './ui';

/**
 * AdBlue del cierre de tarjeta: ¿se cargó? No/Sí y, si sí, cuántos litros. El
 * error (sin litros, más de 1000 L) impide guardar; el aviso de más de 30 L no:
 * es un «revisá el dato», no un rechazo, y reemplaza a la nota del estanque.
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
        <Label>¿Se cargó AdBlue?</Label>
        <Segmentado
          etiqueta="¿Se cargó AdBlue?"
          valor={adBlue ? 'si' : 'no'}
          onChange={(valor) => onAdBlue(valor === 'si')}
          opciones={[
            { valor: 'no', label: 'No' },
            { valor: 'si', label: 'Sí' },
          ]}
        />
      </div>
      {adBlue && (
        <Campo
          label="AdBlue cargado"
          requerido
          unidad="L"
          hint={resultado.aviso ? undefined : ADBLUE_NOTA_ESTANQUE}
          error={resultado.error}
          aviso={resultado.aviso}
        >
          <Input numerico value={litros} onChange={(e) => onLitros(e.target.value)} />
        </Campo>
      )}
    </>
  );
}
