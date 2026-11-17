import { useState } from 'react';
import { Button, Input, Label, ListBox, Modal, Select, Spinner, TextArea, TextField } from '@heroui/react';

import { useCorregirUltimoCambio, type CorregirUltimoCambioVars } from '../../../hooks/useMaintenancePlans';
import { fmtNum } from '../../../lib/format';
import { toDateOnly } from '../../../lib/turno';
import type { TipoOT } from '../../../types/mantenimiento';
import type { MaintenanceBoardRow } from '../../../types/maintenance-board';
import { DecimalField } from '../../DecimalField';
import { RESPONSIVE_SHEET_DIALOG_CLASS } from '../../flota/modal-styles';
import { FechaPasadaPicker } from '../FechaPasadaPicker';
import { opcionesHito, TIPO_OPTIONS } from '../opciones-mantencion';

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
 * «Editar último cambio» de la pizarra (solo ADMIN): corrige el último cambio
 * real, el ancla desde la que se cuenta el próximo, con los mismos campos que
 * «Registrar mantención anterior». Se monta con la fila elegida y abre con los
 * valores actuales; al guardar se manda todo lo editable (lo que no cambió no
 * hace nada en el backend).
 *
 * Qué se puede tocar depende del origen del cambio:
 * - sin orden asociada: solo fecha, lectura e hito;
 * - OT del taller: fecha, lectura y título (el hito y el resto vienen de la orden);
 * - mantención anterior cargada por el admin: todo.
 * El hito solo se elige en equipos con pauta. Las reglas de fecha y lectura
 * las valida el backend y sus mensajes llegan en el toast de error.
 */
export function EditarUltimoCambioModal({ fila, onClose }: { fila: MaintenanceBoardRow; onClose: () => void }) {
  const corregir = useCorregirUltimoCambio();
  const ultimo = fila.lastChange;
  const fechaOriginal = ultimo ? diaLocal(ultimo.doneAt) : '';
  const tipoOriginal: TipoOT = ultimo?.tipo ?? 'PREVENTIVA';
  const [fecha, setFecha] = useState(fechaOriginal);
  const [tipo, setTipo] = useState<TipoOT>(tipoOriginal);
  const [hito, setHito] = useState<number | null>(ultimo?.milestone ?? null);
  const [titulo, setTitulo] = useState(ultimo?.titulo ?? '');
  const [realizadaPor, setRealizadaPor] = useState(ultimo?.realizadaPor ?? '');
  const [lectura, setLectura] = useState<number>(ultimo?.counterAt ?? Number.NaN);
  const [observaciones, setObservaciones] = useState(ultimo?.observaciones ?? '');
  // Pasar a correctiva saca la mantención del conteo: se pide un segundo clic.
  const [confirmando, setConfirmando] = useState(false);

  const esKm = fila.unit === 'km';
  const unidad = esKm ? 'km' : 'h';
  const conOrden = ultimo?.ordenId != null;
  const editaTitulo = conOrden;
  // Tipo, quién la hizo y observaciones solo en una mantención anterior: los de
  // una OT del taller vienen de la orden.
  const editaDatosOrden = conOrden && ultimo?.historica === true;
  const esOtTaller = conOrden && ultimo?.historica === false;
  // El hito solo existe en equipos con pauta; el de una OT del taller no se toca.
  const muestraHito = fila.source === 'PAUTA';
  const editaHito = muestraHito && !esOtTaller;
  const opciones = opcionesHito(fila, unidad);
  // Si el hito guardado ya no está en la pauta, igual se muestra para no perderlo.
  if (ultimo && muestraHito && !opciones.some((o) => o.valor === ultimo.milestone)) {
    opciones.unshift({ valor: ultimo.milestone, label: `${fmtNum(ultimo.milestone)} ${unidad}` });
  }

  const fechaValida = /^\d{4}-\d{2}-\d{2}$/.test(fecha) && fecha <= toDateOnly(new Date());
  const lecturaValida = Number.isFinite(lectura) && lectura >= 0 && lectura <= LECTURA_MAXIMA;
  const tituloValido = !editaTitulo || titulo.trim().length > 0;
  const cambio =
    fecha !== fechaOriginal ||
    lectura !== ultimo?.counterAt ||
    (editaHito && hito !== ultimo?.milestone) ||
    (editaTitulo && titulo.trim() !== (ultimo?.titulo ?? '')) ||
    (editaDatosOrden &&
      (tipo !== tipoOriginal ||
        realizadaPor.trim() !== (ultimo?.realizadaPor ?? '') ||
        observaciones.trim() !== (ultimo?.observaciones ?? '')));
  const puedeGuardar =
    ultimo != null &&
    !corregir.isPending &&
    fechaValida &&
    lecturaValida &&
    tituloValido &&
    (!editaHito || hito != null) &&
    cambio;
  const pasaACorrectiva = editaDatosOrden && tipo === 'CORRECTIVA' && tipoOriginal !== 'CORRECTIVA';

  const cerrar = () => {
    if (!corregir.isPending) onClose();
  };

  const guardar = () => {
    if (!puedeGuardar) return;
    if (pasaACorrectiva && !confirmando) {
      setConfirmando(true);
      return;
    }
    const vars: CorregirUltimoCambioVars = {
      equipmentId: fila.equipmentId,
      internalCode: fila.internalCode,
      doneAt: fecha,
      counterAt: lectura,
      ...(editaHito && hito != null ? { milestone: hito } : {}),
      ...(editaTitulo ? { titulo: titulo.trim() } : {}),
      ...(editaDatosOrden ? { tipo, realizadaPor: realizadaPor.trim(), observaciones: observaciones.trim() } : {}),
    };
    corregir.mutate(vars, { onSuccess: onClose });
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
                {ultimo && !muestraHito ? (
                  <span className="text-sm text-muted-foreground">{textoHito(fila, ultimo.milestone)}</span>
                ) : null}
              </div>
              <p className="m-0 text-sm text-muted-foreground">
                Corrige los datos del último cambio. El próximo cambio se vuelve a contar desde aquí.
              </p>
              {!conOrden ? (
                <p className="m-0 text-sm text-muted-foreground">
                  Este último cambio no tiene una orden asociada: solo se pueden corregir fecha, lectura e hito.
                </p>
              ) : esOtTaller ? (
                <p className="m-0 text-sm text-muted-foreground">
                  Viene de una orden del taller: solo se pueden corregir fecha, lectura y título.
                </p>
              ) : null}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FechaPasadaPicker label="Fecha de la mantención" onChange={setFecha} value={fecha} />

                <Select
                  data-testid="select-tipo"
                  fullWidth
                  isDisabled={!editaDatosOrden}
                  onChange={(value) => {
                    if (!value) return;
                    setTipo(value as TipoOT);
                    setConfirmando(false);
                  }}
                  value={tipo}
                >
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

              {muestraHito ? (
                <Select
                  data-testid="select-mantencion"
                  fullWidth
                  isDisabled={!editaHito}
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
                      {opciones.map((opcion) => (
                        <ListBox.Item id={String(opcion.valor)} key={opcion.valor} textValue={opcion.label}>
                          {opcion.label}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              ) : null}

              <TextField
                fullWidth
                isDisabled={!editaTitulo}
                isInvalid={editaTitulo && !tituloValido}
                name="titulo"
                onChange={setTitulo}
                value={titulo}
              >
                <Label>Título</Label>
                <Input placeholder="Cambio de aceite y filtros, mantención 10.000 km…" />
              </TextField>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField
                  fullWidth
                  isDisabled={!editaDatosOrden}
                  name="realizadaPor"
                  onChange={setRealizadaPor}
                  value={realizadaPor}
                >
                  <Label>Quién la hizo</Label>
                  <Input placeholder="Mecánico o taller que la realizó" />
                </TextField>

                <DecimalField
                  decimales={1}
                  isInvalid={!Number.isNaN(lectura) && !lecturaValida}
                  label={esKm ? 'Kilometraje en la mantención (km)' : 'Horómetro en la mantención (h)'}
                  onChange={setLectura}
                  value={lectura}
                />
              </div>

              <TextField
                fullWidth
                isDisabled={!editaDatosOrden}
                name="observaciones"
                onChange={setObservaciones}
                value={observaciones}
              >
                <Label>Observaciones (opcional)</Label>
                <TextArea placeholder=" " rows={2} />
              </TextField>

              {confirmando ? (
                <p
                  className="m-0 rounded-2xl bg-warning-soft px-3.5 py-2.5 text-[13.5px] text-warning-soft-foreground"
                  role="alert"
                >
                  Esta mantención dejará de contar como último cambio; el equipo volverá a pedir registrar su mantención
                  anterior.
                </p>
              ) : null}
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button isDisabled={corregir.isPending} onPress={cerrar} variant="tertiary">
              Cancelar
            </Button>
            <Button
              isDisabled={!puedeGuardar}
              isPending={corregir.isPending}
              onPress={guardar}
              variant={confirmando ? 'danger' : 'primary'}
            >
              {({ isPending }) =>
                isPending ? (
                  <Spinner color="current" size="sm" />
                ) : confirmando ? (
                  'Sí, guardar como correctiva'
                ) : (
                  'Guardar cambios'
                )
              }
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
