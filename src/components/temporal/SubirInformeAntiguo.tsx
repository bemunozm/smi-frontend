import { useCallback, useState } from 'react';

import { ConfirmarDescarte } from './ConfirmarDescarte';
import { InformeAntiguoForm } from './InformeAntiguoForm';
import { Hoja } from '../terreno/ui';

/**
 * La hoja de «Subir informe antiguo», con el mismo resguardo que la del
 * cierre: tocar el fondo no la cierra, la X no responde mientras se envía y,
 * con algo escrito, pregunta antes de descartarlo. Se monta al abrirla (quien
 * la abre la desmonta con `onCerrar`), así cada apertura es un informe nuevo
 * con su propio id.
 */
export function SubirInformeAntiguo({
  informeId,
  oficina = false,
  supervisorNombre,
  numerosConocidos,
  onCerrar,
}: {
  /** Generado UNA vez por quien abre la hoja: el reintento no duplica el informe. */
  informeId: string;
  oficina?: boolean;
  supervisorNombre?: string;
  numerosConocidos: readonly number[];
  onCerrar: () => void;
}) {
  const [conCambios, setConCambios] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const pedirCerrar = useCallback(() => {
    if (enviando) return;
    if (conCambios) setConfirmando(true);
    else onCerrar();
  }, [enviando, conCambios, onCerrar]);

  return (
    <>
      <Hoja
        eyebrow="Subir informe antiguo"
        titulo="Informe de actividad en papel"
        bajada="Un informe de una jornada pasada: sus equipos se escriben a mano y no abren ni cierran nada."
        amplia
        cerrarAlTocarFuera={false}
        cerrarDeshabilitado={enviando}
        onCerrar={pedirCerrar}
      >
        <InformeAntiguoForm
          informeId={informeId}
          oficina={oficina}
          supervisorNombre={supervisorNombre}
          numerosConocidos={numerosConocidos}
          onEnviado={onCerrar}
          onCambiosChange={setConCambios}
          onEnviandoChange={setEnviando}
        />
      </Hoja>
      <ConfirmarDescarte abierto={confirmando} onSeguir={() => setConfirmando(false)} onDescartar={onCerrar} />
    </>
  );
}
