import type { ReactNode } from 'react';
import { Spinner } from '@heroui/react';

import { KpiDetailModal } from '../dashboard/KpiDetailModal';
import type { RegistroCombustible } from '../../types/combustible';
import type { EquipmentDetail } from '../../types/equipment';
import type { RegistroHorometro } from '../../types/horometro';
import { fmtFechaHora } from '../../lib/format';
import { useFicha } from '../../hooks/useFicha';
import type { EventoFichaTipo } from '../../types/ficha';
import { EventoTimelineItem } from '../ficha/EventoTimelineItem';
import { FuelHistoryTable } from './FuelHistoryTable';
import { UsageHistoryList } from './UsageHistoryList';

/** Popup que abre cada tarjeta KPI de la ficha del equipo. */
export type EquipmentKpiPopupKind = 'usage' | 'maintenance' | 'fuel' | 'extraWorks' | 'findings';

interface PopupBaseProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Historial de horómetro/kilometraje (mismo contenido que la sección inferior). */
export function UsageHistoryPopup({
  equipo,
  registros,
  isOpen,
  onOpenChange,
}: PopupBaseProps & { equipo: EquipmentDetail; registros: RegistroHorometro[] }) {
  return (
    <KpiDetailModal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={equipo.equipmentClass === 'LIGHT' ? 'Historial de kilometraje' : 'Historial de horómetro'}
    >
      <UsageHistoryList equipo={equipo} registros={registros} />
    </KpiDetailModal>
  );
}

/** Cargas de combustible, más recientes primero. */
export function FuelHistoryPopup({
  registros,
  isOpen,
  onOpenChange,
  verTodoTo,
}: PopupBaseProps & { registros: RegistroCombustible[]; verTodoTo?: string }) {
  return (
    <KpiDetailModal isOpen={isOpen} onOpenChange={onOpenChange} title="Cargas de combustible" verTodoTo={verTodoTo}>
      <FuelHistoryTable registros={registros} />
    </KpiDetailModal>
  );
}

interface TimelinePopupProps extends PopupBaseProps {
  equipoId: string;
  tipos: readonly EventoFichaTipo[];
  title: string;
  emptyText: string;
  total?: number;
  header?: ReactNode;
  verTodoTo?: string;
  verTodoLabel?: string;
}

/** Eventos de la bitácora del equipo filtrados por tipo. */
function TimelinePopup({
  equipoId,
  tipos,
  title,
  emptyText,
  total,
  header,
  isOpen,
  onOpenChange,
  verTodoTo,
  verTodoLabel,
}: TimelinePopupProps) {
  const ficha = useFicha(equipoId);
  const eventos = (ficha.data?.timeline ?? []).filter((e) => tipos.includes(e.tipo));

  return (
    <KpiDetailModal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={title}
      verTodoTo={verTodoTo}
      verTodoLabel={verTodoLabel}
    >
      <div className="flex flex-col gap-3">
        {header}
        {ficha.isPending ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : ficha.isError ? (
          <p className="text-sm text-muted-foreground">No se pudo cargar el detalle.</p>
        ) : eventos.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <>
            {eventos.map((evento) => (
              <EventoTimelineItem key={evento.id} evento={evento} />
            ))}
            {total != null && total > eventos.length ? (
              <p className="text-xs text-muted-foreground">
                Mostrando los {eventos.length} más recientes de {total}.
              </p>
            ) : null}
          </>
        )}
      </div>
    </KpiDetailModal>
  );
}

/** Última mantención + intervenciones de la bitácora. */
export function MaintenancePopup({
  equipo,
  fichaBase,
  isOpen,
  onOpenChange,
}: PopupBaseProps & { equipo: EquipmentDetail; fichaBase: string }) {
  const ultima = equipo.ultimaMantencion;
  return (
    <TimelinePopup
      equipoId={equipo.id}
      tipos={['INTERVENCION']}
      title="Mantenciones"
      emptyText="Esta unidad todavía no tiene mantenciones registradas."
      header={
        ultima ? (
          <div className="rounded-lg bg-muted p-3 text-sm">
            <p className="text-xs uppercase text-muted-foreground">Última mantención</p>
            <p className="font-semibold text-foreground">{ultima.titulo}</p>
            <p className="text-xs text-muted-foreground">
              {fmtFechaHora(ultima.fecha)} · {ultima.realizadaPor ?? '—'}
            </p>
          </div>
        ) : undefined
      }
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      verTodoTo={`${fichaBase}/${equipo.id}/ficha`}
      verTodoLabel="Ver bitácora completa →"
    />
  );
}

/** Trabajos extra de la bitácora. */
export function ExtraWorksPopup({
  equipo,
  isOpen,
  onOpenChange,
  verTodoTo,
}: PopupBaseProps & { equipo: EquipmentDetail; verTodoTo?: string }) {
  return (
    <TimelinePopup
      equipoId={equipo.id}
      tipos={['TRABAJO_EXTRA']}
      title="Trabajos extra"
      emptyText="Esta unidad todavía no tiene trabajos extra registrados."
      total={equipo._count.trabajosExtra}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      verTodoTo={verTodoTo}
    />
  );
}

/** Hallazgos de la bitácora. */
export function FindingsPopup({
  equipo,
  isOpen,
  onOpenChange,
  verTodoTo,
}: PopupBaseProps & { equipo: EquipmentDetail; verTodoTo?: string }) {
  return (
    <TimelinePopup
      equipoId={equipo.id}
      tipos={['HALLAZGO']}
      title="Hallazgos"
      emptyText="Esta unidad todavía no tiene hallazgos reportados."
      total={equipo._count.hallazgos}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      verTodoTo={verTodoTo}
    />
  );
}
