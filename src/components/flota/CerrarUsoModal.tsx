import { useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Button, Chip, Input, Label, Modal, Spinner, TextField } from '@heroui/react';

import { DecimalField } from '../DecimalField';
import { useUpdateEquipmentStatus } from '../../hooks/useEquipment';
import { useAdminCloseShiftCard } from '../../hooks/useShiftCards';
import { controlUnitSuffix, equipmentStatusLabel, turnoLabel } from '../../config/flota-colors';
import { fmtDate, fmtTime } from '../../lib/format';
import type { Equipment, EquipmentStatus, OpenShift } from '../../types/equipment';
import { RESPONSIVE_SHEET_DIALOG_CLASS } from './modal-styles';

const NUMERO = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 });

export interface CerrarUsoModalProps {
  equipo: Equipment & { openShift: OpenShift };
  /** Con estado: se abrió al cambiar el equipo a «Fuera de servicio» / «En
   * taller»; al confirmar cierra el uso Y cambia el estado. Sin él, solo
   * cierra el uso (botón «Cerrar uso» de la ventana «Uso en curso»). */
  nuevoEstado?: EquipmentStatus;
  onClose: () => void;
  /** Además de `onClose`, solo cuando todo salió bien. */
  onHecho?: () => void;
}

/**
 * El administrador cierra un uso que quedó colgado: la tarjeta de turno
 * abierta de un equipo que pasó a fuera de servicio, o que el supervisor no
 * cerró. Sin foto ni combustible: solo la lectura final (viene con la
 * inicial = 0 h; se cambia si se sabe hasta dónde trabajó) y el motivo, que
 * queda en la tarjeta. El servidor también suelta el operador y el
 * supervisor asignados, así el equipo deja de figurar «En uso».
 */
export function CerrarUsoModal({ equipo, nuevoEstado, onClose, onHecho }: CerrarUsoModalProps) {
  const { openShift } = equipo;
  const cerrarUso = useAdminCloseShiftCard();
  const updateStatus = useUpdateEquipmentStatus();
  const sufijo = controlUnitSuffix(equipo.controlUnit);
  const liviano = equipo.equipmentClass === 'LIGHT';

  const [valorFinal, setValorFinal] = useState(openShift.valorInicial);
  const [motivo, setMotivo] = useState(
    nuevoEstado ? `equipo marcado como ${equipmentStatusLabel(nuevoEstado).toLowerCase()}` : '',
  );

  const tieneLectura = Number.isFinite(valorFinal);
  const lecturaValida = tieneLectura && valorFinal >= openShift.valorInicial;
  const uso = lecturaValida ? valorFinal - openShift.valorInicial : null;
  const enCurso = cerrarUso.isPending || updateStatus.isPending;

  const confirmar = () => {
    if (!lecturaValida) return;
    cerrarUso.mutate(
      {
        id: openShift.id,
        equipoCodigo: equipo.internalCode,
        input: { valorFinal, motivo: motivo.trim() || undefined },
      },
      {
        onSuccess: () => {
          const terminar = () => {
            onHecho?.();
            onClose();
          };
          if (nuevoEstado) {
            updateStatus.mutate({ equipo, status: nuevoEstado }, { onSuccess: terminar });
          } else {
            terminar();
          }
        },
      },
    );
  };

  return (
    <Modal.Backdrop
      isDismissable={!enCurso}
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Container>
        <Modal.Dialog className={RESPONSIVE_SHEET_DIALOG_CLASS}>
          <Modal.CloseTrigger isDisabled={enCurso} />
          <Modal.Header>
            <Modal.Heading className="font-display text-xl font-semibold tracking-[-0.02em]">
              {nuevoEstado
                ? `Marcar como ${equipmentStatusLabel(nuevoEstado)} · ${equipo.internalCode}`
                : `Cerrar uso · ${equipo.internalCode}`}
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-2.5 rounded-xl bg-[var(--warning-soft)] px-3.5 py-3 text-[13px] text-[var(--warning-soft-foreground)]">
                <TriangleAlert className="mt-0.5 h-[18px] w-[18px] shrink-0" />
                <span>
                  {nuevoEstado
                    ? 'Este equipo está en uso. Al marcarlo se cierra ese uso: deja de figurar a nombre del operador y del supervisor.'
                    : 'Se cierra el uso a tu nombre, sin foto ni combustible, y el equipo deja de figurar a nombre del operador y del supervisor.'}
                </span>
              </div>

              <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface-secondary px-3.5 py-3 text-sm text-foreground">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-bold tracking-wider text-(--muted) uppercase">En uso</span>
                  {!liviano && (
                    <Chip color="accent" size="sm" variant="soft">
                      {turnoLabel(openShift.turno)}
                    </Chip>
                  )}
                </div>
                {!liviano && (
                  <span>
                    Operador: <strong className="font-semibold">{openShift.operador || '—'}</strong>
                  </span>
                )}
                <span>
                  {liviano ? 'A cargo' : 'Supervisor'}:{' '}
                  <strong className="font-semibold">{openShift.supervisorName ?? '—'}</strong>
                </span>
                <span>
                  Lectura al abrir:{' '}
                  <strong className="font-mono font-semibold">
                    {NUMERO.format(openShift.valorInicial)} {sufijo}
                  </strong>
                </span>
                <span className="text-xs text-(--muted)">
                  Desde {fmtDate(openShift.fecha)} {fmtTime(openShift.fecha)}
                </span>
              </div>

              <DecimalField
                className="label-outside"
                errorMessage={
                  tieneLectura && !lecturaValida
                    ? `No puede ser menor que la lectura al abrir (${NUMERO.format(openShift.valorInicial)} ${sufijo}).`
                    : undefined
                }
                isInvalid={tieneLectura && !lecturaValida}
                label={equipo.controlUnit === 'KM' ? 'Kilometraje final (km)' : 'Horómetro final (h)'}
                labelAddon={
                  uso != null ? (
                    <Chip color={uso > 0 ? 'success' : 'default'} size="sm" variant="soft">
                      Uso: {NUMERO.format(uso)} {sufijo}
                    </Chip>
                  ) : undefined
                }
                onChange={setValorFinal}
                value={valorFinal}
              />
              <p className="-mt-2 text-xs text-muted-foreground">
                Viene con la lectura al abrir (sin uso). Cámbiala si sabes hasta dónde trabajó.
              </p>

              <TextField fullWidth onChange={setMotivo} value={motivo}>
                <Label>Motivo</Label>
                <Input maxLength={300} placeholder="Por ejemplo: el supervisor no cerró la tarjeta" />
              </TextField>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button isDisabled={enCurso} onPress={onClose} variant="secondary">
              Cancelar
            </Button>
            <Button isDisabled={!lecturaValida || enCurso} isPending={enCurso} onPress={confirmar} variant="danger">
              {({ isPending }) =>
                isPending ? (
                  <Spinner color="current" size="sm" />
                ) : nuevoEstado ? (
                  `Cerrar uso y marcar como ${equipmentStatusLabel(nuevoEstado)}`
                ) : (
                  'Cerrar uso'
                )
              }
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
