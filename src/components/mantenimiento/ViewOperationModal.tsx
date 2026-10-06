import { useNavigate } from 'react-router-dom';
import { Button, Modal, Spinner } from '@heroui/react';

import { StatusChip } from '../flota/StatusChip';
import { Lock, Package } from 'lucide-react';

import { useIntervenciones } from '../../hooks/useIntervenciones';
import { useItems } from '../../hooks/useInventory';
import { ESTADO_OT_LABELS, TIPO_OT_LABELS, estadoOTChipColor } from '../../config/mantenimiento-colors';
import type { OrdenTrabajo } from '../../types/mantenimiento';
import { UNIT_SYMBOLS } from '../../types/inventory';
import { equipmentLabel, formatDate, type EquipmentRef } from './workshop';

function ReadOnlyBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold tracking-wider text-(--eyebrow-color) uppercase">
        {label}
      </span>
      {children}
    </div>
  );
}

/**
 * Contenido del pop-up. Componente aparte para que `useIntervenciones` se
 * monte (y consulte) recién cuando el dialog se abre, no una vez por cada
 * tarjeta finalizada del tablero.
 */
function OperationDetail({
  orden,
  equipment,
}: {
  orden: OrdenTrabajo;
  equipment: readonly EquipmentRef[] | undefined;
}) {
  const { data: intervenciones, isPending, isError, error } = useIntervenciones(orden.id);
  const { data: items } = useItems();
  // La lista viene ordenada `fecha desc` → la primera es la de cierre.
  const cierre = intervenciones?.[0] ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted px-3.5 py-3">
        <StatusChip tone="secondary">
          {TIPO_OT_LABELS[orden.tipo]}
        </StatusChip>
        <StatusChip tone={estadoOTChipColor(orden.estado)}>
          {ESTADO_OT_LABELS[orden.estado]}
        </StatusChip>
        <StatusChip className="ms-auto gap-1" tone="default">
          <Lock className="size-3" />
          Solo lectura
        </StatusChip>
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <ReadOnlyBlock label="Equipo">
          <span className="text-sm text-foreground">
            {equipmentLabel(orden.equipoId, equipment)}
          </span>
        </ReadOnlyBlock>
        <ReadOnlyBlock label="Operación">
          <strong className="text-sm">{orden.titulo}</strong>
        </ReadOnlyBlock>
      </div>

      {isPending ? (
        <div className="flex justify-center py-6">
          <Spinner color="accent" size="sm" />
        </div>
      ) : isError ? (
        // Un fetch fallido NO es "sin bitácora": decir eso afirmaría algo
        // falso sobre el registro. Mismo bloque de error que el resto del módulo.
        <div className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger-soft-foreground" role="alert">
          {error instanceof Error ? error.message : 'No se pudo cargar la bitácora de la operación.'}
        </div>
      ) : cierre ? (
        <>
          <ReadOnlyBlock label="¿Qué se hizo?">
            <p className="m-0 text-sm text-foreground">{cierre.detalle}</p>
          </ReadOnlyBlock>

          {cierre.fotoUrl ? (
            <ReadOnlyBlock label="Foto del cierre">
              <a href={cierre.fotoUrl} rel="noreferrer" target="_blank">
                <img
                  alt="Foto del cierre"
                  className="max-h-48 w-fit rounded-lg border border-border object-cover"
                  src={cierre.fotoUrl}
                />
              </a>
            </ReadOnlyBlock>
          ) : null}

          {cierre.insumos.length > 0 ? (
            <ReadOnlyBlock label="¿Qué se utilizó?">
              <div className="flex flex-col gap-2">
                {cierre.insumos.map((insumo) => {
                  const item = items?.find((candidate) => candidate.id === insumo.insumoId);
                  return (
                    <div
                      key={insumo.id}
                      className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted px-3 py-2.5 text-sm"
                    >
                      <span>
                        <strong>{item?.name ?? insumo.insumoId}</strong>
                        {item ? (
                          <span className="ms-1.5 font-mono text-xs text-muted-foreground">
                            · {item.sku}
                          </span>
                        ) : null}
                      </span>
                      <span className="font-mono text-sm">
                        {insumo.cantidad} {item ? UNIT_SYMBOLS[item.unit] : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            </ReadOnlyBlock>
          ) : null}

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <ReadOnlyBlock label="Horómetro de cierre">
              <span className="font-mono text-[15px]">
                {cierre.horometro !== null ? `${cierre.horometro} h` : '—'}
              </span>
            </ReadOnlyBlock>
            <ReadOnlyBlock label="Registrada">
              <span className="text-sm">{formatDate(cierre.fecha)}</span>
            </ReadOnlyBlock>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-border py-8 text-center">
          <p className="m-0 text-sm font-medium text-foreground">Sin bitácora registrada</p>
          <p className="m-0 text-sm text-muted-foreground">
            Esta operación se cerró sin una intervención asociada.
          </p>
        </div>
      )}

      <div className="flex items-start gap-2.5 rounded-lg bg-muted px-3.5 py-3 text-[13px] leading-5 text-muted-foreground">
        <Package className="mt-0.5 size-4 shrink-0" />
        <span>
          Stock descontado al finalizar — cada insumo quedó como salida trazable ligada a esta OT
          en Inventario.
        </span>
      </div>
    </div>
  );
}

/** Pop-up "Ver operación" (solo lectura) de una OT finalizada o cancelada. */
export function ViewOperationModal({
  orden,
  equipment,
}: {
  orden: OrdenTrabajo;
  equipment: readonly EquipmentRef[] | undefined;
}) {
  const navigate = useNavigate();

  return (
    <Modal>
      <Button className="w-full lg:w-fit" size="sm" variant="tertiary">
        Ver operación
      </Button>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-lg">
            {({ close }) => (
              <>
                <Modal.CloseTrigger />
                <Modal.Header>
                  <Modal.Heading className="font-display text-xl font-semibold tracking-[-0.02em]">
                    {orden.estado === 'CANCELADA' ? 'Operación cancelada' : 'Operación finalizada'}
                  </Modal.Heading>
                  <p className="text-sm text-muted-foreground">Registro cerrado — solo lectura.</p>
                </Modal.Header>
                <Modal.Body>
                  <OperationDetail equipment={equipment} orden={orden} />
                </Modal.Body>
                <Modal.Footer>
                  <Button
                    variant="secondary"
                    onPress={() => {
                      close();
                      void navigate('/inventario/movimientos');
                    }}
                  >
                    Ver movimientos de stock
                  </Button>
                  <Button variant="secondary" onPress={close}>
                    Cerrar
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
