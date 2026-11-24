import { useState } from 'react';
import { Button, Modal, Spinner, toast } from '@heroui/react';

import { RESPONSIVE_SHEET_DIALOG_WIDE_CLASS } from '../flota/modal-styles';
import { Campo, Input } from '../terreno/ui';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useQueuedMutation } from '../../hooks/useQueuedMutation';
import { formatDecimalInput, parseDecimal } from '../../lib/decimal';
import { diferenciaEdicion, precondicion } from '../../lib/edit-diff';
import { AYUDA_LITROS, validarLitros } from '../../lib/litros';
import type { InformeTemporalTarjeta } from '../../types/informe-temporal';
import type { EditShiftCardBody } from '../../types/shift';

type CamposCorregibles = Pick<EditShiftCardBody, 'valorInicial' | 'valorFinal' | 'fuelLiters'>;

const CAMPOS = ['valorInicial', 'valorFinal', 'fuelLiters'] as const;

/**
 * Corrige las lecturas y los litros de UNA tarjeta de un informe temporal
 * (ADMIN y SECRETARIA, desde el detalle del informe). Va por el mismo
 * `PATCH /api/shift-cards/:id` que la edición de Terreno: solo los campos que
 * cambiaron, con su precondición, y el backend deja el cambio en el historial
 * de la tarjeta.
 */
export function CorregirTarjetaTemporalModal({
  tarjeta,
  onClose,
}: {
  tarjeta: InformeTemporalTarjeta;
  onClose: () => void;
}) {
  const { user } = useCurrentUser();
  const [inicial, setInicial] = useState(formatDecimalInput(tarjeta.valorInicial));
  const [final, setFinal] = useState(formatDecimalInput(tarjeta.valorFinal));
  // 3 decimales, como el surtidor (mismo criterio que el editor de Terreno).
  const [litros, setLitros] = useState(formatDecimalInput(tarjeta.fuelLiters, 3));
  const [intentado, setIntentado] = useState(false);

  const edicion = useQueuedMutation<'shiftCard.edit', { id: string; nuevo: CamposCorregibles }>({
    endpoint: 'shiftCard.edit',
    userId: user?.id,
    build: ({ id, nuevo }) => {
      const base: CamposCorregibles = {
        valorInicial: tarjeta.valorInicial,
        valorFinal: tarjeta.valorFinal ?? undefined,
        fuelLiters: tarjeta.fuelLiters ?? undefined,
      };
      const diff = diferenciaEdicion(base, nuevo, CAMPOS);
      const campos = Object.keys(diff.cambios);
      if (campos.length === 0) return null;
      return { params: { id }, body: diff.cambios, expected: precondicion(diff.esperado, campos) };
    },
    onSent: () => {
      toast.success('Corrección guardada');
    },
    errorFallback: 'No se pudo guardar la corrección de la tarjeta.',
  });

  const inicialNum = parseDecimal(inicial);
  const finalNum = parseDecimal(final);
  const revisionLitros = validarLitros(litros, { liviano: false });

  const errores: Record<string, string> = {};
  if (inicialNum == null || inicialNum < 0) errores.inicial = 'Escribe la lectura inicial.';
  if (finalNum == null || finalNum < 0) errores.final = 'Escribe la lectura final.';
  else if (inicialNum != null && finalNum < inicialNum)
    errores.final = 'La lectura final no puede ser menor que la inicial.';
  if (revisionLitros.error) errores.litros = revisionLitros.error;
  else if (revisionLitros.valor == null) errores.litros = 'Indica los litros de combustible (cero si no cargó).';
  // La final menor que la inicial se avisa apenas se escribe; el resto, al guardar.
  const visibles = intentado ? errores : errores.final && finalNum != null ? { final: errores.final } : {};

  const guardar = () => {
    setIntentado(true);
    if (Object.keys(errores).length > 0 || inicialNum == null || finalNum == null || revisionLitros.valor == null) {
      return;
    }
    edicion.mutate(
      { id: tarjeta.id, nuevo: { valorInicial: inicialNum, valorFinal: finalNum, fuelLiters: revisionLitros.valor } },
      { onSuccess: onClose },
    );
  };

  return (
    <Modal.Backdrop
      isDismissable
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Container>
        <Modal.Dialog className={`${RESPONSIVE_SHEET_DIALOG_WIDE_CLASS} sm:w-full`}>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading className="font-display text-xl font-semibold tracking-[-0.02em]">
              Corregir {tarjeta.equipo.internalCode}
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">{tarjeta.equipo.name}</p>
              <Campo label="Lectura inicial" requerido error={visibles.inicial}>
                <Input numerico value={inicial} onChange={(e) => setInicial(e.target.value)} />
              </Campo>
              <Campo label="Lectura final" requerido error={visibles.final}>
                <Input numerico value={final} onChange={(e) => setFinal(e.target.value)} />
              </Campo>
              <Campo
                label="Combustible cargado"
                unidad="L"
                litros
                requerido
                error={visibles.litros}
                hint={`${AYUDA_LITROS} Cero si no cargó.`}
              >
                <Input numerico value={litros} onChange={(e) => setLitros(e.target.value)} />
              </Campo>
              <p className="text-xs text-muted-foreground">
                El cambio queda en el historial de la tarjeta y se avisa al administrador.
              </p>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button onPress={onClose} variant="tertiary">
              Cancelar
            </Button>
            <Button isPending={edicion.isPending} onPress={guardar}>
              {({ isPending }) => (isPending ? <Spinner color="current" size="sm" /> : 'Guardar corrección')}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
