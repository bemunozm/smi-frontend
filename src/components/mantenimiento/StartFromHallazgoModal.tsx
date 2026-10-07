import { useState } from 'react';
import { ArrowRight, Info, TriangleAlert } from 'lucide-react';

import { useLogOperation } from '../../hooks/useOrdenes';
import { Boton, Campo, Chip, Form, Input, ModalTerreno } from '../terreno/ui';
import {
  PRIORIDAD_OT_LABELS,
  chipColorToTono,
  prioridadOTChipColor,
} from '../../config/mantenimiento-colors';
import type { Hallazgo } from '../../types/hallazgos';
import { equipmentLabel, toPrioridadOT, type EquipmentRef } from './workshop';

/**
 * Pop-up "Iniciar operación" desde un hallazgo REAL de Terreno — kit de
 * Terreno. Crea la OT ligada (`hallazgoId`) y la deja EN_PROCESO
 * (`useLogOperation` encola ambas escrituras); el backend pasa el hallazgo a
 * EN_PROCESO en la misma transacción, por eso desaparece de la bandeja.
 */
export function StartFromHallazgoModal({
  hallazgo,
  equipment,
}: {
  hallazgo: Hallazgo;
  equipment: readonly EquipmentRef[] | undefined;
}) {
  const logOperation = useLogOperation();
  const [abierto, setAbierto] = useState(false);
  const [titulo, setTitulo] = useState(`Reparación: ${hallazgo.descripcion}`);
  const prioridad = toPrioridadOT(hallazgo.prioridad);

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
        <div className="flex flex-col gap-2.5 rounded-2xl border border-border bg-[#fafbfc] px-3.5 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tono="danger">
              <TriangleAlert className="h-3.5 w-3.5" />
              Hallazgo
            </Chip>
            <Chip tono={chipColorToTono(prioridadOTChipColor(prioridad))}>
              {PRIORIDAD_OT_LABELS[prioridad]}
            </Chip>
            <span className="tabular ms-auto text-xs text-muted-foreground">
              {hallazgo.equipo?.internalCode ?? equipmentLabel(hallazgo.equipoId, equipment)}
            </span>
          </div>
          <strong className="text-sm">{hallazgo.descripcion}</strong>
          {hallazgo.fotoUrl ? (
            <img
              alt="Foto del hallazgo"
              className="h-24 w-fit rounded-xl border border-border object-cover"
              src={hallazgo.fotoUrl}
            />
          ) : null}
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
            disabled={!titulo.trim() || logOperation.isPending}
            variante="acento"
            onClick={() => {
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
                { onSuccess: () => setAbierto(false) },
              );
            }}
          >
            {logOperation.isPending ? 'Iniciando…' : 'Iniciar operación'}
          </Boton>
        </div>
      </ModalTerreno>
    </>
  );
}
