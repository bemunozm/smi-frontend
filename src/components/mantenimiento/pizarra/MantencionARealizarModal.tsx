import { Button, Modal } from '@heroui/react';

import { fmtDecimales, fmtNum } from '../../../lib/format';
import type { MaintenanceBoardRow } from '../../../types/maintenance-board';
import { planItemKindLabel, type PlanItemKind } from '../../../types/maintenance-plan';
import { RESPONSIVE_SHEET_DIALOG_CLASS } from '../../flota/modal-styles';
import { Chip } from '../../ui/Chip';
import { lectura } from './pizarra';

const KIND_COLOR: Record<string, 'accent' | 'warning' | 'success' | 'default'> = {
  FILTRO: 'accent',
  ACEITE: 'warning',
  CORREA: 'success',
};

const kindLabel = (kind: string) => planItemKindLabel[kind as PlanItemKind] ?? kind;

/**
 * «Ver mantención a realizar» de la pizarra: las operaciones del próximo hito
 * de la pauta (filtros, aceite, correas, operaciones) con cantidad y código de
 * repuesto, para preparar los insumos antes de que el equipo llegue al taller.
 * Un liviano sin pauta no tiene lista: su mantención es el servicio fijo.
 */
export function MantencionARealizarModal({ fila, onClose }: { fila: MaintenanceBoardRow | null; onClose: () => void }) {
  const liviano = fila?.source === 'LIVIANO';
  // Sin próximo hito (pauta sin hitos o sin lectura) no hay número que mostrar:
  // «Mantención de 0 h» sería falso.
  const titulo = !fila
    ? ''
    : liviano || fila.nextMilestone == null
      ? `Mantención a realizar · ${fila.internalCode}`
      : `Mantención de ${fmtNum(fila.nextMilestone)} ${fila.unit} · ${fila.internalCode}`;
  const toca = fila ? lectura(fila.dueAt, fila.unit) : null;

  return (
    <Modal.Backdrop
      isDismissable
      isOpen={fila != null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Container>
        <Modal.Dialog className={RESPONSIVE_SHEET_DIALOG_CLASS}>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading className="font-display text-xl font-semibold tracking-[-0.02em]">{titulo}</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            {fila ? (
              <div className="flex flex-col gap-3">
                {toca ? (
                  <p className="text-sm text-muted-foreground">
                    Toca a los <b className="text-foreground tabular-nums">{toca}</b>
                    {fila.estimated ? ' (estimado: el equipo no tiene un cambio anterior registrado)' : ''}.
                  </p>
                ) : null}
                {liviano ? (
                  <p className="m-0 rounded-xl bg-surface-secondary px-3 py-2.5 text-[15px] font-semibold">
                    Servicio de 10.000 km
                  </p>
                ) : fila.counter == null ? (
                  // Sin lectura no hay próximo hito: no es que la pauta esté vacía.
                  <p className="text-sm text-muted-foreground">
                    Sin lectura: no se puede calcular la próxima mantención.
                  </p>
                ) : fila.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    La pauta no tiene operaciones marcadas para este hito.
                  </p>
                ) : (
                  <ul className="m-0 flex list-none flex-col gap-2 p-0">
                    {fila.items.map((item) => (
                      <li
                        className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border px-3 py-2.5"
                        key={item.id}
                      >
                        <Chip color={KIND_COLOR[item.kind] ?? 'default'} size="sm" variant="soft">
                          {kindLabel(item.kind)}
                        </Chip>
                        <span className="min-w-0 flex-1 text-sm font-medium break-words">{item.description}</span>
                        {item.quantity != null ? (
                          <span className="text-sm tabular-nums">
                            {`${fmtDecimales(item.quantity, 2)}${item.unit ? ` ${item.unit}` : ''}`}
                          </span>
                        ) : null}
                        {item.partNumber ? (
                          <span className="font-mono text-xs text-muted-foreground">{`cód. ${item.partNumber}`}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </Modal.Body>
          <Modal.Footer>
            <Button onPress={onClose} variant="tertiary">
              Cerrar
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
