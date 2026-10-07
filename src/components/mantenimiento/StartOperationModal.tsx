import { useState } from 'react';
import { ArrowRight, Info } from 'lucide-react';

import { useActualizarOrden } from '../../hooks/useOrdenes';
import { Boton, Campo, Chip, Form, Input, ModalTerreno } from '../terreno/ui';
import {
  PRIORIDAD_OT_LABELS,
  TIPO_OT_LABELS,
  chipColorToTono,
  prioridadOTChipColor,
} from '../../config/mantenimiento-colors';
import type { OrdenTrabajo } from '../../types/mantenimiento';
import { equipmentLabel, type EquipmentRef } from './workshop';

/**
 * Pop-up "Iniciar operación" desde una OT pendiente de la bandeja — kit de
 * Terreno (`ModalTerreno` + campos táctiles). El horómetro y los insumos NO
 * se piden acá a propósito: se registran al finalizar la tarea.
 */
export function StartOperationModal({
  orden,
  equipment,
}: {
  orden: OrdenTrabajo;
  equipment: readonly EquipmentRef[] | undefined;
}) {
  const actualizarOrden = useActualizarOrden();
  const [abierto, setAbierto] = useState(false);
  const [titulo, setTitulo] = useState(orden.titulo);

  return (
    <>
      <Boton ancho variante="acento" onClick={() => setAbierto(true)}>
        <ArrowRight className="h-5 w-5" />
        Iniciar operación
      </Boton>
      <ModalTerreno
        abierto={abierto}
        detalle='Desde el hallazgo reportado. Al iniciar, el hallazgo pasa a "en proceso".'
        titulo="Iniciar operación"
        onAbiertoChange={setAbierto}
      >
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-[#fafbfc] px-3.5 py-3">
          <Chip tono={chipColorToTono(prioridadOTChipColor(orden.prioridad))}>
            {PRIORIDAD_OT_LABELS[orden.prioridad]}
          </Chip>
          <span className="tabular text-xs text-muted-foreground">
            {equipmentLabel(orden.equipoId, equipment)}
          </span>
          <strong className="text-sm">{orden.titulo}</strong>
          <Chip className="ms-auto" tono="neutral">
            {TIPO_OT_LABELS[orden.tipo]}
          </Chip>
        </div>

        <Form>
          <Campo label="Nombre de la operación" requerido>
            <Input
              placeholder="Ej. Reparación de fuga hidráulica"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
            />
          </Campo>
        </Form>

        <div className="flex items-start gap-2.5 rounded-2xl bg-[var(--accent-soft)] px-3.5 py-3 text-[13px] leading-5 text-[var(--accent-soft-foreground)]">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Lo que hiciste, la foto y los insumos utilizados se registran al{' '}
            <strong>finalizar la tarea</strong>. Ahí se descuenta el stock.
          </span>
        </div>

        <div className="mt-1 flex gap-2.5">
          <Boton ancho variante="contorno" onClick={() => setAbierto(false)}>
            Cancelar
          </Boton>
          <Boton
            ancho
            disabled={!titulo.trim() || actualizarOrden.isPending}
            variante="acento"
            onClick={() => {
              actualizarOrden.mutate(
                { orden, input: { estado: 'EN_PROCESO', titulo: titulo.trim() } },
                { onSuccess: () => setAbierto(false) },
              );
            }}
          >
            {actualizarOrden.isPending ? 'Iniciando…' : 'Iniciar operación'}
          </Boton>
        </div>
      </ModalTerreno>
    </>
  );
}
