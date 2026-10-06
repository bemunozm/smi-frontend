import { useState } from 'react';
import { Button, Input, Label, Modal, Spinner, TextField } from '@heroui/react';

import { StatusChip } from '../flota/StatusChip';
import { ArrowRight, Info } from 'lucide-react';

import { useActualizarOrden } from '../../hooks/useOrdenes';
import {
  PRIORIDAD_OT_LABELS,
  TIPO_OT_LABELS,
  prioridadOTChipColor,
} from '../../config/mantenimiento-colors';
import type { OrdenTrabajo } from '../../types/mantenimiento';
import { equipmentLabel, type EquipmentRef } from './workshop';

/**
 * Pop-up "Iniciar operación" (diseño Mantenedor Taller): toma un hallazgo de
 * la bandeja, deja nombrar la operación y pasa la OT a EN_PROCESO. El
 * horómetro y los insumos NO se piden acá a propósito — se registran al
 * finalizar la tarea (campo de la intervención), igual que dice el banner.
 */
export function StartOperationModal({
  orden,
  equipment,
}: {
  orden: OrdenTrabajo;
  equipment: readonly EquipmentRef[] | undefined;
}) {
  const actualizarOrden = useActualizarOrden();
  const [titulo, setTitulo] = useState(orden.titulo);

  return (
    <Modal>
      <Button className="w-full lg:w-fit" size="sm">
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
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted px-3.5 py-3">
                    <StatusChip tone={prioridadOTChipColor(orden.prioridad)}>
                      {PRIORIDAD_OT_LABELS[orden.prioridad]}
                    </StatusChip>
                    <span className="font-mono text-xs text-muted-foreground">
                      {equipmentLabel(orden.equipoId, equipment)}
                    </span>
                    <strong className="text-sm">{orden.titulo}</strong>
                    <StatusChip className="ms-auto" tone="secondary">
                      {TIPO_OT_LABELS[orden.tipo]}
                    </StatusChip>
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
                    isPending={actualizarOrden.isPending}
                    onPress={() => {
                      actualizarOrden.mutate(
                        { orden, input: { estado: 'EN_PROCESO', titulo: titulo.trim() } },
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
