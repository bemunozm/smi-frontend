import { useEffect, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, ClipboardCheck } from 'lucide-react';
import { Button, Card, Checkbox, Modal, Spinner } from '@heroui/react';

import { useCurrentUser } from '../../hooks/useCurrentUser';
import { usePermissions } from '../../hooks/usePermissions';
import { useMaintenanceCycle, useSetMaintenanceRecord } from '../../hooks/useMaintenancePlans';
import { fmtContador } from '../../lib/maintenance-plan';
import {
  planItemKindLabel,
  type CycleColumn,
  type MaintenanceCycleView,
  type MaintenanceRecord,
  type PlanItemKind,
} from '../../types/maintenance-plan';
import { ROLES } from '../../types/roles';

/**
 * La grilla necesita ancho, como la de la pauta: casi a borde en PC y hoja a
 * pantalla completa en tablet y celular, con la tabla desplazable de lado.
 */
const DIALOG_CLASS =
  'flex h-full max-h-full w-full max-w-full flex-col rounded-none sm:h-auto sm:max-h-[92vh] sm:w-[min(96vw,1280px)] sm:max-w-none sm:rounded-2xl';

const fmtFecha = (iso: string) =>
  new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });

const kindLabel = (k: string) => planItemKindLabel[k as PlanItemKind] ?? k;

/** Ven el ciclo los mismos que ven la pauta: administrador, mantenedor y supervisor. */
function usePuedeVerCiclo(): boolean {
  const { role } = useCurrentUser();
  return role === ROLES.ADMIN || role === ROLES.MANTENEDOR || role === ROLES.SUPERVISOR;
}

/**
 * «Ciclo de mantenciones» en la ficha del equipo: en qué vuelta del ciclo va,
 * cuántos hitos están completos y cuál quedó pendiente, con el botón que abre
 * la grilla completa. Es el registro de lo que se le hizo al equipo según su
 * pauta, para que el administrador sepa cómo va.
 */
export function CicloMantencionesCard({ equipmentId }: { equipmentId: string }) {
  const puedeVer = usePuedeVerCiclo();
  const { data: vista, isLoading } = useMaintenanceCycle(equipmentId, undefined, puedeVer);
  const [abierto, setAbierto] = useState(false);
  if (!puedeVer) return null;

  const completos = vista?.columns.filter((c) => c.complete).length ?? 0;
  const pendientes = vista?.columns.filter((c) => c.reached && !c.complete) ?? [];

  return (
    <Card>
      <Card.Header>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Card.Title>Ciclo de mantenciones</Card.Title>
            <Card.Description>Qué mantenciones de la pauta se le han hecho a la unidad.</Card.Description>
          </div>
          {vista?.hasPlan ? (
            <Button onPress={() => setAbierto(true)} size="sm" variant="secondary">
              <ClipboardCheck className="h-3.5 w-3.5" />
              Ver ciclo de mantenciones
            </Button>
          ) : null}
        </div>
      </Card.Header>
      <Card.Content className="mt-1">
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Spinner size="sm" />
          </div>
        ) : !vista?.hasPlan ? (
          <p className="text-sm text-(--muted)">
            La unidad todavía no tiene pauta. Asígnala desde Equipos → «Asignar mantenciones».
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <Resumen titulo="Ciclo en curso">
              Ciclo {vista.cycle}
              {vista.cycleStart != null && vista.cycleEnd != null ? (
                <span className="block text-xs font-normal text-(--muted)">
                  {fmtContador(vista.cycleStart, vista.equipment.unit)} a{' '}
                  {fmtContador(vista.cycleEnd, vista.equipment.unit)}
                </span>
              ) : null}
            </Resumen>
            <Resumen titulo="Hitos completos">
              {completos} de {vista.columns.length}
            </Resumen>
            <Resumen titulo="Pendientes">
              {pendientes.length === 0 ? (
                'Al día'
              ) : (
                <span className="text-warning">
                  {pendientes.map((c) => fmtContador(c.milestone, vista.equipment.unit)).join(', ')}
                </span>
              )}
            </Resumen>
          </div>
        )}
      </Card.Content>
      {vista?.hasPlan ? (
        <CicloMantencionesModal equipmentId={equipmentId} isOpen={abierto} onOpenChange={setAbierto} />
      ) : null}
    </Card>
  );
}

function Resumen({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-bold tracking-wide text-(--muted) uppercase">{titulo}</span>
      <span className="text-base font-semibold tabular-nums text-foreground">{children}</span>
    </div>
  );
}

/**
 * La grilla del ciclo: una fila por operación de la pauta (tipo y nombre a la
 * izquierda) y una columna por hito, en orden de horas hacia la derecha. Cada
 * casilla es una operación hecha o pendiente en esa vuelta; cuando todas las
 * de un hito están hechas, la columna entera se pinta en verde.
 *
 * Marca solo el mantenedor, que es quien hace la mantención (queda quién,
 * cuándo y con qué horómetro); administrador y supervisor la ven en solo
 * lectura. Se marca en orden: un hito se habilita cuando el anterior está
 * completo, y no se desmarca uno si un hito posterior ya tiene registros.
 */
export function CicloMantencionesModal({
  equipmentId,
  isOpen,
  onOpenChange,
}: {
  equipmentId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // `undefined` = la vuelta en curso; al navegar se fija un número.
  const [ciclo, setCiclo] = useState<number | undefined>(undefined);
  const { data: vista, isLoading, isError, error } = useMaintenanceCycle(equipmentId, ciclo, isOpen);
  const marcar = useSetMaintenanceRecord();
  const { can } = usePermissions();
  const puedeMarcar = can('maintenanceRecord.set');

  // Cada vez que se abre arranca en la vuelta en curso.
  useEffect(() => {
    if (isOpen) setCiclo(undefined);
  }, [isOpen]);

  const unit = vista?.equipment.unit ?? 'h';
  const registro = (planItemId: string, milestone: number): MaintenanceRecord | undefined =>
    vista?.records.find((r) => r.planItemId === planItemId && r.milestone === milestone);

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog className={DIALOG_CLASS}>
          {({ close }) => (
            <>
              <Modal.CloseTrigger />
              <Modal.Header>
                <div className="flex flex-col gap-1">
                  <Modal.Heading className="font-display text-xl font-semibold tracking-[-0.02em]">
                    Ciclo de mantenciones{vista ? ` · ${vista.equipment.internalCode}` : ''}
                  </Modal.Heading>
                  <p className="text-sm text-muted-foreground">
                    {puedeMarcar
                      ? 'Marcá cada operación al hacerla. Se completan en orden: un hito se habilita cuando el anterior está completo, y entonces su columna queda en verde.'
                      : 'Registro de lo que hizo el mantenedor. Cuando todas las operaciones de un hito están hechas, su columna queda en verde.'}
                  </p>
                </div>
              </Modal.Header>

              <Modal.Body className="flex flex-col gap-4">
                {isLoading && !vista ? (
                  <div className="flex justify-center py-10">
                    <Spinner />
                  </div>
                ) : isError || !vista ? (
                  <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger-soft-foreground">
                    {error instanceof Error ? error.message : 'No se pudo cargar el ciclo.'}
                  </p>
                ) : (
                  <>
                    <NavegadorCiclo vista={vista} onCambiar={setCiclo} />
                    <GrillaCiclo
                      vista={vista}
                      unit={unit}
                      registro={registro}
                      puedeMarcar={puedeMarcar}
                      pendiente={marcar.isPending}
                      onMarcar={(planItemId, milestone, done) =>
                        marcar.mutate({ equipmentId, planItemId, cycle: vista.cycle, milestone, done })
                      }
                    />
                  </>
                )}
              </Modal.Body>

              <Modal.Footer>
                {vista ? (
                  <p className="mr-auto text-sm text-muted-foreground">
                    {vista.columns.filter((c) => c.complete).length} de {vista.columns.length} hitos completos en este
                    ciclo
                  </p>
                ) : null}
                <Button variant="secondary" onPress={close}>
                  Cerrar
                </Button>
              </Modal.Footer>
            </>
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

/** «‹ Ciclo 2 · 2.000 a 4.000 h ›» y el contador actual del equipo. */
function NavegadorCiclo({ vista, onCambiar }: { vista: MaintenanceCycleView; onCambiar: (c: number) => void }) {
  const { unit, counter } = vista.equipment;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface-secondary px-3 py-2.5">
      <div className="flex items-center gap-2">
        <Button
          isIconOnly
          aria-label="Ciclo anterior"
          isDisabled={vista.cycle <= 1}
          size="sm"
          variant="ghost"
          onPress={() => onCambiar(vista.cycle - 1)}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <div className="min-w-44 text-center">
          <div className="font-semibold">
            Ciclo {vista.cycle}
            {vista.cycle === vista.currentCycle ? (
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">(en curso)</span>
            ) : null}
          </div>
          {vista.cycleStart != null && vista.cycleEnd != null ? (
            <div className="text-xs text-muted-foreground tabular-nums">
              {fmtContador(vista.cycleStart, unit)} a {fmtContador(vista.cycleEnd, unit)}
            </div>
          ) : null}
        </div>
        <Button
          isIconOnly
          aria-label="Ciclo siguiente"
          isDisabled={vista.cycle >= vista.currentCycle}
          size="sm"
          variant="ghost"
          onPress={() => onCambiar(vista.cycle + 1)}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
      <div className="text-sm">
        <span className="text-muted-foreground">{unit === 'km' ? 'Kilometraje' : 'Horómetro'} actual: </span>
        <b className="tabular-nums">{counter != null ? fmtContador(counter, unit) : 'sin lectura'}</b>
        {vista.baselineCounter != null ? (
          <span className="block text-xs text-muted-foreground">
            Entró al sistema con {fmtContador(vista.baselineCounter, unit)}: lo anterior se da por hecho
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** Estado de una columna, para el encabezado y el color. */
function estadoColumna(c: CycleColumn): { texto: string; clase: string } {
  if (c.preSystem) return { texto: 'Previa al sistema', clase: 'text-success' };
  if (c.complete) return { texto: 'Completa', clase: 'text-success' };
  if (c.total === 0) return { texto: 'Sin operaciones', clase: 'text-muted-foreground' };
  // Las mantenciones van en orden: con un hito anterior a medias, esta espera.
  if (!c.unlocked) return { texto: 'En espera', clase: 'text-muted-foreground' };
  if (c.done > 0) return { texto: `${c.done} de ${c.total}`, clase: 'text-warning' };
  if (c.reached) return { texto: 'Pendiente', clase: 'text-warning' };
  return { texto: 'Próxima', clase: 'text-muted-foreground' };
}

/** Por qué una casilla no se puede tocar, para el aviso al pasar el mouse. */
function bloqueo(c: CycleColumn, hecho: boolean, columnas: CycleColumn[]): string | null {
  if (!hecho && !c.unlocked) {
    const falta = columnas.find((x) => x.total > 0 && !x.complete);
    return falta ? `Primero hay que completar la mantención de ${falta.milestone.toLocaleString('es-CL')}` : null;
  }
  if (hecho && !c.canUndo) return 'No se puede desmarcar: ya hay mantenciones registradas después';
  return null;
}

function GrillaCiclo({
  vista,
  unit,
  registro,
  puedeMarcar,
  pendiente,
  onMarcar,
}: {
  vista: MaintenanceCycleView;
  unit: 'h' | 'km';
  registro: (planItemId: string, milestone: number) => MaintenanceRecord | undefined;
  puedeMarcar: boolean;
  pendiente: boolean;
  onMarcar: (planItemId: string, milestone: number, done: boolean) => void;
}) {
  const verde = (c: CycleColumn) => (c.complete ? 'bg-success-soft' : '');

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-xs text-muted-foreground">
            <th className="sticky left-0 z-[1] min-w-60 bg-surface-secondary px-3 py-2 text-left font-semibold">
              Operación
            </th>
            {vista.columns.map((c) => {
              const estado = estadoColumna(c);
              return (
                <th
                  key={`${c.firstTimeOnly ? 'i' : 'h'}${c.milestone}`}
                  className={`min-w-24 px-2 py-2 text-center font-semibold ${c.complete ? 'bg-success-soft text-success-soft-foreground' : 'bg-surface-secondary'}`}
                  title={
                    c.preSystem && vista.baselineCounter != null
                      ? `Tocaba a las ${fmtContador(c.dueAt, unit)}: antes de que el equipo entrara al sistema con ${fmtContador(vista.baselineCounter, unit)}, se da por hecha`
                      : `Toca a las ${fmtContador(c.dueAt, unit)}`
                  }
                >
                  <div className="text-sm text-foreground tabular-nums">
                    {c.firstTimeOnly ? `1ra ${c.milestone}` : c.milestone.toLocaleString('es-CL')} {unit}
                  </div>
                  <div className={`flex items-center justify-center gap-1 font-medium ${estado.clase}`}>
                    {c.complete ? <Check aria-hidden className="size-3.5" /> : null}
                    {estado.texto}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {vista.items.map((item) => (
            <tr key={item.id} className="border-t border-border">
              <th scope="row" className="sticky left-0 z-[1] bg-surface px-3 py-2 text-left font-normal">
                <span className="mr-2 inline-flex rounded-md bg-surface-secondary px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                  {kindLabel(item.kind)}
                </span>
                <span className="font-medium text-foreground">{item.description}</span>
                {item.quantity != null ? (
                  <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">
                    · {item.quantity.toLocaleString('es-CL')}
                    {item.unit ? ` ${item.unit}` : ''}
                  </span>
                ) : null}
              </th>
              {vista.columns.map((c) => {
                const aplica = item.milestones.includes(c.milestone);
                const hecho = aplica ? registro(item.id, c.milestone) : undefined;
                const motivo = puedeMarcar && aplica && !c.preSystem ? bloqueo(c, hecho != null, vista.columns) : null;
                return (
                  <td
                    key={`${c.firstTimeOnly ? 'i' : 'h'}${c.milestone}`}
                    className={`px-2 py-2 text-center ${verde(c)}`}
                    title={
                      [
                        hecho
                          ? `Hecha por ${hecho.doneByName} el ${fmtFecha(hecho.doneAt)}${hecho.counterAt != null ? `, con ${fmtContador(hecho.counterAt, unit)}` : ''}`
                          : null,
                        motivo,
                      ]
                        .filter(Boolean)
                        .join('. ') || undefined
                    }
                  >
                    {aplica && c.preSystem ? (
                      // Hecha antes de que el equipo entrara al sistema: no hay
                      // registro que marcar ni desmarcar, solo se informa.
                      <Check aria-label={`${item.description} a las ${c.milestone} ${unit}: previa al sistema`} className="mx-auto size-4 text-success" />
                    ) : aplica ? (
                      <Checkbox
                        aria-label={`${item.description} a las ${c.milestone} ${unit}`}
                        className="inline-flex"
                        isDisabled={!puedeMarcar || pendiente || motivo != null}
                        isSelected={hecho != null}
                        onChange={(done) => onMarcar(item.id, c.milestone, done)}
                      >
                        <Checkbox.Content>
                          <Checkbox.Control>
                            <Checkbox.Indicator />
                          </Checkbox.Control>
                        </Checkbox.Content>
                      </Checkbox>
                    ) : (
                      <span aria-hidden className="text-muted-foreground/50">
                        —
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
