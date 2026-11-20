import { BackLink } from '../components/ui/BackLink';
import { useMemo, useState } from 'react';
import { Spinner } from '@heroui/react';

import { Chip, Input, Segmentado, TD, TH, Tabla } from '../components/terreno/ui';
import { useEquipment } from '../hooks/useEquipment';
import { useOrdenes } from '../hooks/useOrdenes';
import { TIPO_OT_LABELS } from '../config/mantenimiento-colors';
import {
  equipmentLabel,
  esChecklistPauta,
  findEquipment,
  formatDate,
  groupWorkshopBoard,
  responsableDe,
  type EquipmentRef,
} from '../components/mantenimiento/workshop';
import { PreventiveChecklistModal } from '../components/mantenimiento/PreventiveChecklistModal';
import { ViewOperationModal } from '../components/mantenimiento/ViewOperationModal';

type FiltroTipo = 'TODAS' | 'CORRECTIVA' | 'PREVENTIVA';

/**
 * Historial de operaciones finalizadas del taller
 * (`/mantenimiento/ordenes/historial`): TODAS las finalizadas y canceladas en
 * una tabla, de la más reciente a la más antigua, con búsqueda por equipo u
 * operación y filtro por tipo. Se entra desde «Historial» del tablero, que
 * solo muestra la última semana. Cada fila abre la operación en solo lectura
 * (el mismo «Ver operación» de las tarjetas).
 */
export function HistorialOperacionesView() {
  const { data: ordenes, isPending, isError, error } = useOrdenes();
  const { data: equipment } = useEquipment();
  const fleet: readonly EquipmentRef[] | undefined = equipment;
  const [busqueda, setBusqueda] = useState('');
  const [tipo, setTipo] = useState<FiltroTipo>('TODAS');

  const finalizadas = useMemo(() => groupWorkshopBoard(ordenes ?? []).finished, [ordenes]);
  const texto = busqueda.trim().toLowerCase();
  const lista = finalizadas.filter((orden) => {
    if (tipo !== 'TODAS' && orden.tipo !== tipo) return false;
    if (!texto) return true;
    return (
      orden.titulo.toLowerCase().includes(texto) || equipmentLabel(orden.equipoId, fleet).toLowerCase().includes(texto)
    );
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <BackLink to="/mantenimiento/ordenes">Volver al tablero</BackLink>
        <h2 className="font-display text-[24px] leading-tight font-bold tracking-[-0.02em] text-foreground">
          Historial de finalizadas
        </h2>
        <p className="m-0 text-[15px] leading-snug text-[var(--label-color)]">
          Todas las operaciones finalizadas o canceladas del taller, de la más reciente a la más antigua.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          aria-label="Buscar en el historial"
          className="sm:w-80"
          onChange={(event) => setBusqueda(event.target.value)}
          placeholder="Buscar por equipo u operación…"
          value={busqueda}
        />
        <Segmentado
          etiqueta="Tipo de operación"
          onChange={setTipo}
          opciones={[
            { valor: 'TODAS', label: 'Todas' },
            { valor: 'CORRECTIVA', label: 'Correctivas' },
            { valor: 'PREVENTIVA', label: 'Preventivas' },
          ]}
          valor={tipo}
        />
      </div>

      {isPending ? (
        <div className="flex justify-center py-16">
          <Spinner color="accent" size="lg" />
        </div>
      ) : null}

      {isError ? (
        <div className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger-soft-foreground" role="alert">
          {error instanceof Error ? error.message : 'No se pudo cargar el historial.'}
        </div>
      ) : null}

      {!isPending && !isError && lista.length === 0 ? (
        <p className="m-0 rounded-2xl border border-dashed border-border px-4 py-8 text-center text-[15px] text-[var(--label-color)]">
          {finalizadas.length === 0
            ? 'Todavía no hay operaciones finalizadas.'
            : 'Ninguna operación del historial calza con el filtro.'}
        </p>
      ) : null}

      {!isPending && !isError && lista.length > 0 ? (
        <Tabla
          detalle={`${lista.length.toLocaleString('es-CL')} ${lista.length === 1 ? 'operación' : 'operaciones'}`}
          titulo="Operaciones finalizadas"
        >
          <thead>
            <tr>
              <th className={TH}>Finalizada</th>
              <th className={TH}>Equipo</th>
              <th className={TH}>Operación</th>
              <th className={TH}>Tipo</th>
              <th className={TH}>Mantenedor</th>
              <th className={TH}>
                <span className="sr-only">Ver</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {lista.map((orden) => {
              const equipo = findEquipment(orden.equipoId, fleet);
              return (
                <tr data-testid={`historial-fila-${orden.id}`} key={orden.id}>
                  <td className={`${TD} whitespace-nowrap text-muted-foreground`}>{formatDate(orden.updatedAt)}</td>
                  <td className={`${TD} whitespace-nowrap`}>
                    <span className="tabular font-semibold text-foreground">{equipo?.internalCode ?? orden.equipoId}</span>
                    {equipo ? (
                      <span className="block text-[12.5px] text-muted-foreground">
                        {equipo.brand} {equipo.model}
                      </span>
                    ) : null}
                  </td>
                  <td className={`${TD} min-w-[16rem] text-foreground`}>
                    {orden.estado === 'CANCELADA' ? (
                      <Chip className="mr-2" tono="danger">
                        Cancelada
                      </Chip>
                    ) : null}
                    {orden.titulo}
                  </td>
                  <td className={TD}>
                    <Chip tono={orden.tipo === 'PREVENTIVA' ? 'info' : 'neutral'}>{TIPO_OT_LABELS[orden.tipo]}</Chip>
                  </td>
                  <td className={`${TD} whitespace-nowrap`}>{responsableDe(orden) ?? 'Sin asignar'}</td>
                  <td className={`${TD} whitespace-nowrap`}>
                    {esChecklistPauta(orden) ? (
                      <PreventiveChecklistModal equipment={fleet} orden={orden} soloLectura />
                    ) : (
                      <ViewOperationModal ancho={false} equipment={fleet} orden={orden} />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Tabla>
      ) : null}
    </div>
  );
}
