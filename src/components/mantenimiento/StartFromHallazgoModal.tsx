import { useState } from 'react';
import { Button, Input, Label, Modal, Spinner, TextField } from '@heroui/react';

import { StatusChip } from '../flota/StatusChip';
import { ArrowRight, Info, TriangleAlert } from 'lucide-react';

import { useLogOperation } from '../../hooks/useOrdenes';
import { PRIORIDAD_OT_LABELS, prioridadOTChipColor } from '../../config/mantenimiento-colors';
import type { Hallazgo } from '../../types/hallazgos';
import { equipmentLabel, toPrioridadOT, type EquipmentRef } from './workshop';

/**
 * Pop-up "Iniciar operación" desde un hallazgo REAL de Terreno: crea la OT
 * ligada (`hallazgoId`) y la deja EN_PROCESO (`useLogOperation` encola ambas
 * escrituras). El backend pasa el hallazgo a EN_PROCESO en la misma
 * transacción del create — por eso desaparece de la bandeja.
 */
export function StartFromHallazgoModal({
  hallazgo,
  equipment,
}: {
  hallazgo: Hallazgo;
  equipment: readonly EquipmentRef[] | undefined;
}) {
  const logOperation = useLogOperation();
  const [titulo, setTitulo] = useState(`Reparación: ${hallazgo.descripcion}`);
  const prioridad = toPrioridadOT(hallazgo.prioridad);

  return (
    <Modal>
      <Button size="sm">
        <ArrowRight className="size-4" />
        Iniciar operación
      </Button>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-lg">
            {({ close }) => (
              <>
                <Modal.CloseTrigger />
                <Modal.Header>
                  <Modal.Heading className="font-display text-xl font-semibold tracking-[-0.02em]">
                    Iniciar operación
                  </Modal.Heading>
                  <p className="text-sm text-muted-foreground">
                    Desde el hallazgo reportado. Al iniciar, el hallazgo pasa a "en proceso".
                  </p>
                </Modal.Header>
                <Modal.Body className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-muted px-3.5 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusChip className="gap-1" tone="danger">
                        <TriangleAlert className="size-3" />
                        Hallazgo
                      </StatusChip>
                      <StatusChip tone={prioridadOTChipColor(prioridad)}>
                        {PRIORIDAD_OT_LABELS[prioridad]}
                      </StatusChip>
                      <span className="ms-auto font-mono text-xs text-muted-foreground">
                        {hallazgo.equipo?.internalCode ?? equipmentLabel(hallazgo.equipoId, equipment)}
                      </span>
                    </div>
                    <strong className="text-sm">{hallazgo.descripcion}</strong>
                    {hallazgo.fotoUrl ? (
                      <img
                        alt="Foto del hallazgo"
                        className="h-24 w-fit rounded-md border border-border object-cover"
                        src={hallazgo.fotoUrl}
                      />
                    ) : null}
                  </div>

                  <TextField
                    fullWidth
                    isInvalid={!titulo.trim()}
                    name="titulo"
                    value={titulo}
                    onChange={setTitulo}
                  >
                    <Label>Nombre de la operación</Label>
                    <Input autoFocus placeholder="Ej. Reparación de fuga hidráulica" />
                  </TextField>

                  <div className="flex items-start gap-2.5 rounded-lg bg-accent px-3.5 py-3 text-[13px] leading-5 text-accent-foreground">
                    <Info className="mt-0.5 size-4 shrink-0" />
                    <span>
                      Lo que hiciste, la foto y los insumos utilizados se registran al{' '}
                      <strong>finalizar la tarea</strong>. Ahí se descuenta el stock.
                    </span>
                  </div>
                </Modal.Body>
                <Modal.Footer>
                  <Button variant="secondary" onPress={close}>
                    Cancelar
                  </Button>
                  <Button
                    isDisabled={!titulo.trim()}
                    isPending={logOperation.isPending}
                    onPress={() => {
                      logOperation.mutate(
                        {
                          equipoId: hallazgo.equipoId,
                          hallazgoId: hallazgo.id,
                          titulo: titulo.trim(),
                          prioridad,
                          tipo: 'CORRECTIVA',
                          origen: 'HALLAZGO',
                          origenDetalle: hallazgo.descripcion,
                        },
                        { onSuccess: close },
                      );
                    }}
                  >
                    {({ isPending }) =>
                      isPending ? <Spinner color="current" size="sm" /> : 'Iniciar operación'
                    }
                  </Button>
                </Modal.Footer>
              </>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
