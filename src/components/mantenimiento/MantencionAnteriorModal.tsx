import { useState } from 'react';
import { Button, Input, Label, ListBox, Modal, Select, Spinner, TextArea, TextField } from '@heroui/react';
import type { DateValue } from 'react-aria-components/Calendar';

import { useRegistrarMantencionHistorica } from '../../hooks/useOrdenes';
import { fmtNum } from '../../lib/format';
import { toDateOnly } from '../../lib/turno';
import type { ControlUnit } from '../../types/equipment';
import type { TipoOT } from '../../types/mantenimiento';
import { RESPONSIVE_SHEET_DIALOG_CLASS } from '../flota/modal-styles';
import { FechaPasadaPicker } from './FechaPasadaPicker';

const TIPO_OPTIONS = [
  { value: 'PREVENTIVA', label: 'Preventiva' },
  { value: 'CORRECTIVA', label: 'Correctiva' },
] as const;

/**
 * «Registrar mantención anterior» de la ficha del equipo (solo ADMIN): la
 * mantención que se le hizo a un equipo antiguo ANTES de usar la aplicación.
 * El backend la guarda como una OT ya COMPLETADA fechada en `fecha`, así
 * aparece en el KPI «Última mantención» de la ficha y en el registro
 * «Mantenciones» del admin igual que una mantención real del taller.
 */
export function MantencionAnteriorModal({
  equipo,
  isOpen,
  onOpenChange,
  pauta,
  lecturaObligatoria = false,
}: {
  equipo: { id: string; internalCode: string; controlUnit: ControlUnit };
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /** Desde la pizarra: los hitos de la pauta del equipo. Con ella se elige
   * qué mantención fue (de ahí cuenta el próximo cambio) y la lectura es obligatoria. */
  pauta?: { milestones: number[]; initialMilestone: number | null };
  /** La pizarra siempre pide la lectura: sin ella no hay desde dónde contar. */
  lecturaObligatoria?: boolean;
}) {
  const registrar = useRegistrarMantencionHistorica();
  // El día elegido en el calendario; su `toString()` es el `YYYY-MM-DD` que
  // espera el backend (y se compara directo contra `hoy`).
  const [dia, setDia] = useState<DateValue | null>(null);
  const fecha = dia?.toString() ?? '';
  const [tipo, setTipo] = useState<TipoOT>('PREVENTIVA');
  const [titulo, setTitulo] = useState('');
  const [realizadaPor, setRealizadaPor] = useState('');
  const [lectura, setLectura] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [hito, setHito] = useState<number | null>(null);

  // La unidad de la lectura la decide el equipo: un liviano se controla por
  // kilómetros, un pesado por horas de motor.
  const esKm = equipo.controlUnit === 'KM';
  const lecturaLabel = esKm ? 'Kilometraje en la mantención (km)' : 'Horómetro en la mantención (h)';
  // Coma o punto decimal, como los demás campos numéricos de texto del admin.
  const lecturaNumero = lectura.trim() === '' ? undefined : Number(lectura.replace(',', '.'));
  const lecturaRequerida = lecturaObligatoria || pauta != null;
  const lecturaValida =
    lecturaNumero === undefined ? !lecturaRequerida : Number.isFinite(lecturaNumero) && lecturaNumero >= 0;
  const unidad = esKm ? 'km' : 'h';
  // Servicio inicial (si la pauta lo tiene) y cada hito, en la unidad del equipo.
  const opcionesHito = [
    ...(pauta?.initialMilestone != null
      ? [{ valor: pauta.initialMilestone, label: `Servicio inicial ${fmtNum(pauta.initialMilestone)} ${unidad}` }]
      : []),
    ...(pauta?.milestones ?? []).map((n) => ({ valor: n, label: `${fmtNum(n)} ${unidad}` })),
  ];
  // El título se rellena solo si quedó vacío; si ya escribieron uno, se respeta.
  const tituloEfectivo = titulo.trim() || (hito != null ? `Mantención ${fmtNum(hito)} ${unidad}` : '');

  const hoy = toDateOnly(new Date());
  const puedeGuardar =
    !registrar.isPending &&
    /^\d{4}-\d{2}-\d{2}$/.test(fecha) &&
    fecha <= hoy &&
    tituloEfectivo.length > 0 &&
    (pauta == null || hito != null) &&
    lecturaValida;

  const cerrar = () => {
    if (!registrar.isPending) onOpenChange(false);
  };

  const guardar = () => {
    if (!puedeGuardar) return;
    registrar.mutate(
      {
        equipoId: equipo.id,
        fecha,
        tipo,
        titulo: tituloEfectivo,
        ...(realizadaPor.trim() ? { realizadaPor: realizadaPor.trim() } : {}),
        ...(lecturaNumero !== undefined ? { lectura: lecturaNumero } : {}),
        ...(observaciones.trim() ? { observaciones: observaciones.trim() } : {}),
        ...(pauta && hito != null ? { milestone: hito } : {}),
      },
      {
        onSuccess: () => {
          setDia(null);
          setTipo('PREVENTIVA');
          setTitulo('');
          setRealizadaPor('');
          setLectura('');
          setObservaciones('');
          setHito(null);
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Modal.Backdrop
      isDismissable={!registrar.isPending}
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) cerrar();
      }}
    >
      <Modal.Container>
        <Modal.Dialog className={RESPONSIVE_SHEET_DIALOG_CLASS}>
          <Modal.CloseTrigger isDisabled={registrar.isPending} />
          <Modal.Header>
            <Modal.Heading className="font-display text-xl font-semibold tracking-[-0.02em]">
              Registrar mantención anterior
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                Para la historia previa de {equipo.internalCode}: una mantención que se le hizo antes de usar la
                aplicación. Queda en el registro de Mantenciones y como «Última mantención» de la ficha.
              </p>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FechaPasadaPicker label="Fecha de la mantención" onChange={setDia} value={dia} />

                <Select fullWidth value={tipo} onChange={(value) => value && setTipo(value as TipoOT)}>
                  <Label>Tipo</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {TIPO_OPTIONS.map((opcion) => (
                        <ListBox.Item id={opcion.value} key={opcion.value} textValue={opcion.label}>
                          {opcion.label}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              </div>

              {pauta ? (
                <Select
                  data-testid="select-mantencion"
                  fullWidth
                  isRequired
                  onChange={(value) => value != null && setHito(Number(value))}
                  placeholder="Elegí la mantención"
                  value={hito != null ? String(hito) : null}
                >
                  <Label>Qué mantención fue</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {opcionesHito.map((opcion) => (
                        <ListBox.Item id={String(opcion.valor)} key={opcion.valor} textValue={opcion.label}>
                          {opcion.label}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              ) : null}

              <TextField fullWidth name="titulo" onChange={setTitulo} value={titulo}>
                <Label>{pauta ? 'Título (opcional)' : 'Qué mantención fue'}</Label>
                <Input
                  placeholder={
                    pauta
                      ? hito != null
                        ? `Mantención ${fmtNum(hito)} ${unidad}`
                        : 'Se completa con la mantención elegida'
                      : 'Cambio de aceite y filtros, mantención 10.000 km…'
                  }
                />
              </TextField>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField fullWidth name="realizadaPor" onChange={setRealizadaPor} value={realizadaPor}>
                  <Label>Quién la hizo</Label>
                  <Input placeholder="Mecánico o taller que la realizó" />
                </TextField>

                <TextField fullWidth name="lectura" onChange={setLectura} value={lectura}>
                  <Label>{lecturaLabel}</Label>
                  <Input inputMode="decimal" placeholder={esKm ? '84306' : '1250'} />
                </TextField>
              </div>

              <TextField fullWidth name="observaciones" onChange={setObservaciones} value={observaciones}>
                <Label>Observaciones (opcional)</Label>
                <TextArea placeholder=" " rows={2} />
              </TextField>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button isDisabled={registrar.isPending} onPress={cerrar} variant="tertiary">
              Cancelar
            </Button>
            <Button isDisabled={!puedeGuardar} isPending={registrar.isPending} onPress={guardar}>
              {({ isPending }) => (isPending ? <Spinner color="current" size="sm" /> : 'Registrar mantención')}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
