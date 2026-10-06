import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Spinner } from '@heroui/react';
import { Package } from 'lucide-react';

import { useIntervenciones } from '../../hooks/useIntervenciones';
import { useItems } from '../../hooks/useInventory';
import { Boton, Chip, ChipEstado, Filas, ModalTerreno } from '../terreno/ui';
import { TIPO_OT_LABELS } from '../../config/mantenimiento-colors';
import type { OrdenTrabajo } from '../../types/mantenimiento';
import { UNIT_SYMBOLS } from '../../types/inventory';
import { equipmentLabel, formatDate, type EquipmentRef } from './workshop';

/** Mismos hex que los estados de hallazgo en Terreno (`HallazgosView`). */
const ESTADO_HEX: Record<string, string> = {
  COMPLETADA: '#156237',
  CANCELADA: '#971414',
};

/**
 * Contenido del pop-up. Componente aparte para que `useIntervenciones` se
 * monte (y consulte) recién cuando el modal se abre, no una vez por cada
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
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Chip tono={orden.tipo === 'PREVENTIVA' ? 'info' : 'neutral'}>
          {TIPO_OT_LABELS[orden.tipo]}
        </Chip>
        <ChipEstado color={ESTADO_HEX[orden.estado] ?? '#1a3a9c'}>
          {orden.estado === 'CANCELADA' ? 'Cancelada' : 'Finalizada'}
        </ChipEstado>
        <Chip className="ms-auto" tono="neutral">
          Solo lectura
        </Chip>
      </div>

      {isPending ? (
        <div className="flex justify-center py-6">
          <Spinner color="accent" size="sm" />
        </div>
      ) : isError ? (
        // Un fetch fallido NO es "sin bitácora": decir eso afirmaría algo
        // falso sobre el registro.
        <div
          className="rounded-2xl bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger-soft-foreground)]"
          role="alert"
        >
          {error instanceof Error ? error.message : 'No se pudo cargar la bitácora de la operación.'}
        </div>
      ) : cierre ? (
        <>
          <Filas
            filas={[
              ['Equipo', equipmentLabel(orden.equipoId, equipment)],
              ['Operación', orden.titulo],
              ['¿Qué se hizo?', cierre.detalle],
              [
                'Horómetro de cierre',
                cierre.horometro !== null ? `${cierre.horometro} h` : '—',
              ],
              ['Registrada', formatDate(cierre.fecha)],
            ]}
          />

          {cierre.fotoUrl ? (
            <a href={cierre.fotoUrl} rel="noreferrer" target="_blank">
              <img
                alt="Foto del cierre"
                className="max-h-48 w-fit rounded-2xl border border-border object-cover"
                src={cierre.fotoUrl}
              />
            </a>
          ) : null}

          {cierre.insumos.length > 0 ? (
            <div className="flex flex-col gap-2">
              <span className="text-[11.5px] font-bold tracking-[0.08em] text-[var(--label-color)] uppercase">
                ¿Qué se utilizó?
              </span>
              {cierre.insumos.map((insumo) => {
                const item = items?.find((candidate) => candidate.id === insumo.insumoId);
                return (
                  <div
                    key={insumo.id}
                    className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-[#fafbfc] px-3.5 py-2.5 text-sm"
                  >
                    <span className="min-w-0 truncate">
                      <span className="tabular font-semibold">{item?.sku ?? insumo.insumoId}</span>
                      {item ? <span className="text-muted-foreground"> · {item.name}</span> : null}
                    </span>
                    <span className="tabular shrink-0 font-semibold">
                      {insumo.cantidad} {item ? UNIT_SYMBOLS[item.unit] : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : null}
        </>
      ) : (
        <div className="flex flex-col items-center gap-1 rounded-2xl border border-dashed border-border py-8 text-center">
          <p className="m-0 text-sm font-semibold">Sin bitácora registrada</p>
          <p className="m-0 text-sm text-muted-foreground">
            Esta operación se cerró sin una intervención asociada.
          </p>
        </div>
      )}

      <div className="flex items-start gap-2.5 rounded-2xl bg-[#fafbfc] px-3.5 py-3 text-[13px] leading-5 text-muted-foreground">
        <Package className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Stock descontado al finalizar — cada insumo quedó como salida trazable ligada a esta OT
          en Inventario.
        </span>
      </div>
    </>
  );
}

/** Pop-up "Ver operación" (solo lectura) — kit de Terreno. */
export function ViewOperationModal({
  orden,
  equipment,
}: {
  orden: OrdenTrabajo;
  equipment: readonly EquipmentRef[] | undefined;
}) {
  const navigate = useNavigate();
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <Boton ancho variante="contorno" onClick={() => setAbierto(true)}>
        Ver operación
      </Boton>
      <ModalTerreno
        abierto={abierto}
        detalle="Registro cerrado — solo lectura."
        titulo={orden.estado === 'CANCELADA' ? 'Operación cancelada' : 'Operación finalizada'}
        onAbiertoChange={setAbierto}
      >
        {abierto ? <OperationDetail equipment={equipment} orden={orden} /> : null}

        <div className="mt-1 flex gap-2.5">
          <Boton
            ancho
            variante="contorno"
            onClick={() => {
              setAbierto(false);
              void navigate('/inventario/movimientos');
            }}
          >
            Ver movimientos de stock
          </Boton>
          <Boton ancho variante="oscuro" onClick={() => setAbierto(false)}>
            Cerrar
          </Boton>
        </div>
      </ModalTerreno>
    </>
  );
}
