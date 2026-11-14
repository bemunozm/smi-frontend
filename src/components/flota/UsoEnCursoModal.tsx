import { useMemo, useState } from 'react';
import { Button, Chip, Modal, Spinner } from '@heroui/react';

import { useCombustibleList } from '../../hooks/useCombustible';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { ROLES } from '../../types/roles';
import { CerrarUsoModal } from './CerrarUsoModal';
import { fmtLitros } from '../../lib/format';
import { tiempoEnUso } from '../../lib/tiempo-en-uso';
import { controlUnitSuffix, equipoIdentidad, turnoLabel } from '../../config/flota-colors';
import type { Equipment } from '../../types/equipment';
import { RESPONSIVE_SHEET_DIALOG_CLASS } from './modal-styles';

const FECHA_LARGA = new Intl.DateTimeFormat('es-CL', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const NUMERO = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 });

function formatFecha(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : FECHA_LARGA.format(date);
}

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3.5 border-t border-separator py-2.5 first:border-t-0">
      <span className="shrink-0 text-[11px] font-bold tracking-wider text-(--label-color) uppercase">{label}</span>
      <span className="text-right text-sm text-foreground">{value}</span>
    </div>
  );
}

/**
 * Popup «Uso en curso» del listado de Equipos (se abre tocando el chip
 * "En uso"): el REGISTRO del uso actual — desde qué día y hora está en uso
 * (la apertura de la tarjeta de turno), cuánto lleva, quién lo tiene y la
 * lectura con que partió — más la última carga de combustible del equipo
 * (fecha, litros, lectura al cargar y quién). Las cargas se piden recién al
 * abrir el popup (el componente se monta solo abierto) y quedan cacheadas
 * bajo la misma key que usa la vista de Cargas del panel.
 */
export function UsoEnCursoModal({ equipo, onClose }: { equipo: Equipment; onClose: () => void }) {
  const { openShift } = equipo;
  const { role } = useCurrentUser();
  // Solo el administrador cierra un uso ajeno (sin foto ni combustible). La
  // ventana se reemplaza por la de cierre: dos diálogos apilados se pelean el foco.
  const [cerrando, setCerrando] = useState(false);
  const { data: cargas, isPending: cargandoCargas } = useCombustibleList();
  const liviano = equipo.equipmentClass === 'LIGHT';
  const sufijo = controlUnitSuffix(equipo.controlUnit);
  const identidad = equipoIdentidad(equipo);

  // La carga más reciente DE ESTE equipo — el listado del backend trae todas.
  const ultimaCarga = useMemo(() => {
    const delEquipo = (cargas ?? []).filter((carga) => carga.equipoId === equipo.id);
    if (delEquipo.length === 0) return null;
    return delEquipo.reduce((max, carga) => (carga.fecha > max.fecha ? carga : max));
  }, [cargas, equipo.id]);

  if (cerrando && openShift) {
    return <CerrarUsoModal equipo={{ ...equipo, openShift }} onClose={() => setCerrando(false)} onHecho={onClose} />;
  }

  return (
    <Modal.Backdrop
      isDismissable
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Container>
        <Modal.Dialog className={`${RESPONSIVE_SHEET_DIALOG_CLASS} sm:w-full`}>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading className="font-display text-xl font-semibold tracking-[-0.02em]">
              Uso en curso
            </Modal.Heading>
            <div className="flex flex-wrap items-center gap-2 pt-1.5">
              <Chip color="success" size="sm" variant="soft">
                En uso
              </Chip>
              <span className="font-mono text-sm font-semibold text-foreground">{equipo.internalCode}</span>
              <span className="text-sm text-muted-foreground">{identidad.marcaModelo}</span>
            </div>
          </Modal.Header>
          <Modal.Body>
            {openShift ? (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col">
                  <Dato label="En uso desde" value={formatFecha(openShift.fecha)} />
                  <Dato label="Tiempo en uso" value={tiempoEnUso(openShift.fecha, new Date())} />
                  {liviano ? (
                    <Dato label="A cargo" value={openShift.supervisorName ?? '—'} />
                  ) : (
                    <>
                      <Dato label="Operador" value={openShift.operador || '—'} />
                      <Dato label="Supervisor" value={openShift.supervisorName ?? '—'} />
                      <Dato label="Turno" value={turnoLabel(openShift.turno)} />
                    </>
                  )}
                  <Dato label="Lectura al abrir" value={`${NUMERO.format(openShift.valorInicial)} ${sufijo}`} />
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-bold tracking-wider text-(--label-color) uppercase">
                    Última carga de combustible
                  </span>
                  {cargandoCargas ? (
                    <div className="flex justify-center py-3">
                      <Spinner color="accent" size="sm" />
                    </div>
                  ) : ultimaCarga ? (
                    <div className="flex flex-col rounded-xl border border-border px-3 pb-1">
                      <Dato label="Fecha" value={formatFecha(ultimaCarga.fecha)} />
                      <Dato label="Litros" value={`${fmtLitros(ultimaCarga.litros)} L`} />
                      <Dato
                        label="Lectura al cargar"
                        value={ultimaCarga.lectura != null ? `${NUMERO.format(ultimaCarga.lectura)} ${sufijo}` : '—'}
                      />
                      <Dato label="Realizada por" value={ultimaCarga.realizadoPor ?? '—'} />
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Sin cargas registradas para este equipo.</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Este equipo ya no tiene una tarjeta de turno abierta.</p>
            )}
          </Modal.Body>
          {openShift && role === ROLES.ADMIN ? (
            <Modal.Footer>
              <Button onPress={() => setCerrando(true)} variant="danger-soft">
                Cerrar uso
              </Button>
            </Modal.Footer>
          ) : null}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
