import { useState } from 'react';
import { Button, Modal, Spinner } from '@heroui/react';

import { useCorregirUltimoCambio } from '../../../hooks/useMaintenancePlans';
import { fmtNum } from '../../../lib/format';
import { toDateOnly } from '../../../lib/turno';
import type { MaintenanceBoardRow } from '../../../types/maintenance-board';
import { DecimalField } from '../../DecimalField';
import { RESPONSIVE_SHEET_DIALOG_CLASS } from '../../flota/modal-styles';
import { FechaPasadaPicker } from '../FechaPasadaPicker';

/** Tope de la lectura que acepta el backend. */
const LECTURA_MAXIMA = 1_000_000;

/** `2026-10-01T12:00:00.000Z` → el día en la hora local, como lo muestra la pizarra (`fechaCorta`). */
function diaLocal(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : toDateOnly(d);
}

/** Qué hito fue el último cambio: «Mantención de 250 h» o, en un liviano, «Servicio de 10.000 km». */
function textoHito(fila: MaintenanceBoardRow, hito: number): string {
  return `${fila.source === 'LIVIANO' ? 'Servicio' : 'Mantención'} de ${fmtNum(hito)} ${fila.unit}`;
}

/**
 * «Editar último cambio» de la pizarra (solo ADMIN): corrige la fecha y la
 * lectura del último cambio real, el ancla desde la que se cuenta el próximo.
 * Se monta con la fila elegida y abre con los valores actuales; al guardar se
 * mandan los dos juntos. El hito no se cambia acá: se muestra solo como
 * referencia. Las reglas (fecha no futura ni anterior al cambio previo, lectura
 * entre la del cambio previo y la actual) las valida el backend y sus mensajes
 * llegan en el toast de error.
 */
export function EditarUltimoCambioModal({ fila, onClose }: { fila: MaintenanceBoardRow; onClose: () => void }) {
  const corregir = useCorregirUltimoCambio();
  const ultimo = fila.lastChange;
  const fechaOriginal = ultimo ? diaLocal(ultimo.doneAt) : '';
  const [fecha, setFecha] = useState(fechaOriginal);
  const [lectura, setLectura] = useState<number>(ultimo?.counterAt ?? Number.NaN);

  const esKm = fila.unit === 'km';
  const fechaValida = /^\d{4}-\d{2}-\d{2}$/.test(fecha) && fecha <= toDateOnly(new Date());
  const lecturaValida = Number.isFinite(lectura) && lectura >= 0 && lectura <= LECTURA_MAXIMA;
  const cambio = fecha !== fechaOriginal || lectura !== ultimo?.counterAt;
  const puedeGuardar = ultimo != null && !corregir.isPending && fechaValida && lecturaValida && cambio;

  const cerrar = () => {
    if (!corregir.isPending) onClose();
  };

  const guardar = () => {
    if (!puedeGuardar) return;
    corregir.mutate(
      { equipmentId: fila.equipmentId, internalCode: fila.internalCode, doneAt: fecha, counterAt: lectura },
      { onSuccess: onClose },
    );
  };

  return (
    <Modal.Backdrop
      isDismissable={!corregir.isPending}
      isOpen
      onOpenChange={(open) => {
        if (!open) cerrar();
      }}
    >
      <Modal.Container>
        <Modal.Dialog className={RESPONSIVE_SHEET_DIALOG_CLASS}>
          <Modal.CloseTrigger isDisabled={corregir.isPending} />
          <Modal.Header>
            <Modal.Heading className="font-display text-xl font-semibold tracking-[-0.02em]">
              Editar último cambio
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-0.5">
                <span className="font-mono font-semibold text-foreground">{fila.internalCode}</span>
                {ultimo ? (
                  <span className="text-sm text-muted-foreground">{textoHito(fila, ultimo.milestone)}</span>
                ) : null}
              </div>
              <p className="m-0 text-sm text-muted-foreground">
                Corrige la fecha y {esKm ? 'el kilometraje' : 'el horómetro'} del último cambio. El próximo cambio se
                vuelve a contar desde aquí.
              </p>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FechaPasadaPicker label="Fecha del último cambio" onChange={setFecha} value={fecha} />
                <DecimalField
                  decimales={1}
                  isInvalid={!Number.isNaN(lectura) && !lecturaValida}
                  label={esKm ? 'Km del último cambio' : 'Horómetro del último cambio (h)'}
                  onChange={setLectura}
                  value={lectura}
                />
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button isDisabled={corregir.isPending} onPress={cerrar} variant="tertiary">
              Cancelar
            </Button>
            <Button isDisabled={!puedeGuardar} isPending={corregir.isPending} onPress={guardar}>
              {({ isPending }) => (isPending ? <Spinner color="current" size="sm" /> : 'Guardar cambios')}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
