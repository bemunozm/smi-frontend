import { useMemo } from 'react';
import { Button, Chip, Modal, Spinner } from '@heroui/react';
import { ArrowLeft, Download, Pencil } from 'lucide-react';

import { ShiftReportAPI } from '../../api/ShiftReportAPI';
import { RESPONSIVE_SHEET_DIALOG_WIDE_CLASS } from '../flota/modal-styles';
import { EditorTarjeta } from '../terreno/EditorTarjeta';
import { turnoLabel } from '../../config/flota-colors';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useEditarTarjeta } from '../../hooks/useEditarTarjeta';
import { useOperators } from '../../hooks/useOperators';
import { usePermissions } from '../../hooks/usePermissions';
import { useShiftReportCards } from '../../hooks/useShiftReports';
import { mapCardToTarjeta, type TarjetaTurno } from '../../hooks/shift-register-helpers';
import { NUM_CL_1 } from '../../lib/dashboard-format';
import { contextoTurno, fromDateOnly } from '../../lib/turno';
import { useOutboxOps } from '../../offline/useOutboxOps';
import type { ShiftReportListItem } from '../../types/shift';

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="m-0 text-sm text-foreground">{value}</dd>
    </div>
  );
}

/** Una tarjeta del turno: lo mismo que resume el PDF, con «Editar» si se puede. */
function FilaTarjeta({ tarjeta, onEditar }: { tarjeta: TarjetaTurno; onEditar?: () => void }) {
  const unidad = tarjeta.liviano ? 'km' : 'h';
  const uso = tarjeta.final != null ? tarjeta.final - tarjeta.inicial : null;
  return (
    <li className="flex flex-col gap-2.5 rounded-2xl border border-border p-3.5" data-testid={`tarjeta-${tarjeta.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col">
          <span className="font-mono text-[15px] font-semibold text-foreground">{tarjeta.equipo}</span>
          <span className="text-sm text-muted-foreground">
            {tarjeta.tipo} · {tarjeta.operador}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Chip color={tarjeta.estado === 'cerrada' ? 'success' : 'warning'} size="sm" variant="soft">
            {tarjeta.estado === 'cerrada' ? 'Cerrada' : 'En curso'}
          </Chip>
          {onEditar ? (
            <Button onPress={onEditar} size="sm" variant="secondary">
              <Pencil aria-hidden size={14} /> Editar
            </Button>
          ) : null}
        </div>
      </div>
      <dl className="m-0 grid grid-cols-2 gap-2 rounded-xl bg-surface-secondary px-3 py-2.5 sm:grid-cols-4">
        <Dato
          label={tarjeta.liviano ? 'Kilometraje' : 'Horómetro'}
          value={`${NUM_CL_1.format(tarjeta.inicial)} → ${tarjeta.final != null ? NUM_CL_1.format(tarjeta.final) : '—'}`}
        />
        <Dato label={tarjeta.liviano ? 'Recorrido' : 'Horas máquina'} value={uso != null ? `${NUM_CL_1.format(uso)} ${unidad}` : '—'} />
        <Dato label="Combustible" value={tarjeta.litros != null ? `${NUM_CL_1.format(tarjeta.litros)} L` : '—'} />
        <Dato
          label="AdBlue"
          value={tarjeta.adBlue ? (tarjeta.adBlueLitros != null ? `${NUM_CL_1.format(tarjeta.adBlueLitros)} L` : 'Sí') : 'No'}
        />
      </dl>
      {tarjeta.observaciones ? <p className="m-0 text-sm text-foreground">{tarjeta.observaciones}</p> : null}
      {tarjeta.pumpPhotoUrl ? (
        <a className="text-xs text-(--accent) hover:underline" href={tarjeta.pumpPhotoUrl} rel="noreferrer" target="_blank">
          Ver foto del surtidor
        </a>
      ) : null}
    </li>
  );
}

/**
 * «Ver registro» de un reporte de salida: las tarjetas del turno (equipo,
 * operador, horómetros, combustible, AdBlue), además del PDF. En un caso
 * extremo el administrador corrige una tarjeta con el mismo editor de Terreno
 * (`useEditarTarjeta` + `EditorTarjeta`): el cambio queda en su historial. El
 * PDF no se regenera — sigue siendo lo que se envió.
 */
export function RegistroTurnoModal({ reporte, onClose }: { reporte: ShiftReportListItem | null; onClose: () => void }) {
  const { data: cards, isPending, isError, error } = useShiftReportCards(reporte?.id ?? null);
  const { user } = useCurrentUser();
  const ops = useOutboxOps(user?.id);
  const puedeEditar = usePermissions().can('shiftCard.edit');
  const { data: operadores = [] } = useOperators({ isActive: true });

  const tarjetas = useMemo(() => {
    const ctx = contextoTurno(new Date());
    return (cards ?? []).map((card) => mapCardToTarjeta(card, ctx));
  }, [cards]);
  const edicion = useEditarTarjeta({ tarjetas, ops, userId: user?.id });

  const opcionesOperador = operadores.map((o) => ({ valor: o.id, titulo: o.name }));
  const actual = edicion.editando;
  if (actual?.operatorId && !opcionesOperador.some((o) => o.valor === actual.operatorId)) {
    opcionesOperador.unshift({ valor: actual.operatorId, titulo: actual.operador });
  }

  const cerrar = () => {
    edicion.cerrarEdicion();
    onClose();
  };

  return (
    <Modal.Backdrop
      isDismissable
      isOpen={reporte !== null}
      onOpenChange={(open) => {
        if (!open) cerrar();
      }}
    >
      <Modal.Container>
        <Modal.Dialog className={`${RESPONSIVE_SHEET_DIALOG_WIDE_CLASS} sm:w-full`}>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading className="font-display text-xl font-semibold tracking-[-0.02em]">
              {actual
                ? `Editar · ${actual.equipo}`
                : reporte
                  ? `Registro · ${fromDateOnly(reporte.shiftDate).toLocaleDateString('es-CL')} · ${turnoLabel(reporte.shiftType)}`
                  : ''}
            </Modal.Heading>
            {reporte && !actual ? (
              <p className="pt-1 text-sm text-muted-foreground">Supervisor: {reporte.supervisor ?? '—'}</p>
            ) : null}
          </Modal.Header>
          <Modal.Body>
            {actual ? (
              <div className="flex flex-col gap-3">
                <Button className="w-fit" onPress={edicion.cerrarEdicion} size="sm" variant="tertiary">
                  <ArrowLeft aria-hidden size={15} /> Volver al registro
                </Button>
                <EditorTarjeta edicion={edicion} operadores={opcionesOperador} />
              </div>
            ) : isPending ? (
              <div className="flex justify-center py-8">
                <Spinner color="accent" size="sm" />
              </div>
            ) : isError ? (
              <p className="text-sm text-danger-soft-foreground" role="alert">
                {error instanceof Error ? error.message : 'No se pudo cargar el registro del turno.'}
              </p>
            ) : tarjetas.length === 0 ? (
              <p className="text-sm text-muted-foreground">El turno no tiene tarjetas registradas.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {puedeEditar ? (
                  <p className="m-0 text-xs text-muted-foreground">
                    Corregir una tarjeta queda en su historial y avisa al administrador. El PDF ya enviado no cambia.
                  </p>
                ) : null}
                <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                  {tarjetas.map((tarjeta) => (
                    <FilaTarjeta
                      key={tarjeta.id}
                      tarjeta={tarjeta}
                      {...(puedeEditar && edicion.motivoSinEdicion(tarjeta) == null
                        ? { onEditar: () => edicion.abrirEdicion(tarjeta.id) }
                        : {})}
                    />
                  ))}
                </ul>
              </div>
            )}
          </Modal.Body>
          {reporte && !actual ? (
            <Modal.Footer>
              <a
                className="inline-flex items-center gap-1.5 text-sm font-medium text-(--accent) hover:underline"
                href={ShiftReportAPI.fileUrl(reporte.id)}
                rel="noreferrer"
                target="_blank"
              >
                <Download aria-hidden size={15} />
                Descargar PDF
              </a>
            </Modal.Footer>
          ) : null}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
