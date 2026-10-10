import { useEffect, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { Button, Checkbox, Input, Label, ListBox, Modal, Select, Spinner } from '@heroui/react';

import { useMaintenancePlan, useSaveMaintenancePlan } from '../../hooks/useMaintenancePlans';
import { DocumentosPauta } from './DocumentosPauta';
import {
  aEntrada,
  agregarHito,
  alternarMarca,
  borradorDesde,
  columnas,
  filaVacia,
  fmtContador,
  leerNumero,
  problemaDe,
  quitarHito,
  type FilaBorrador,
  type PautaBorrador,
} from '../../lib/maintenance-plan';
import { PLAN_ITEM_KINDS, planItemKindLabel, type MaintenancePlanView, type PlanItemKind } from '../../types/maintenance-plan';

/**
 * La matriz necesita ancho: en PC la ventana llega casi al borde; en tablet y
 * celular es hoja a pantalla completa, como el resto de los modales de Flota,
 * y la tabla se desplaza de lado.
 */
const DIALOG_CLASS =
  'flex h-full max-h-full w-full max-w-full flex-col rounded-none sm:h-auto sm:max-h-[92vh] sm:w-[min(96vw,1280px)] sm:max-w-none sm:rounded-2xl';

interface EquipoPauta {
  id: string;
  internalCode: string;
  brand: string;
  model: string;
}

/**
 * «Asignar mantenciones»: la pauta preventiva de un equipo, armada a mano como
 * las planillas del cliente — una fila por operación o material, una columna
 * por hito de horas (o km) y una casilla donde se hace. El hito más alto
 * reinicia el ciclo: con 2.000 h, un equipo con 2.250 h vuelve a estar en las
 * 250. Arriba se ve en qué punto va y cuál es su próxima mantención.
 *
 * `soloLectura`: el supervisor la ve pero no la cambia (el servidor solo deja
 * guardarla a administrador y mantenedor).
 */
export function PautaMantencionModal({
  equipo,
  isOpen,
  onOpenChange,
  soloLectura,
}: {
  equipo: EquipoPauta;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  soloLectura: boolean;
}) {
  const { data: vista, isLoading, isError, error } = useMaintenancePlan(equipo.id, isOpen);
  const guardar = useSaveMaintenancePlan();
  const [borrador, setBorrador] = useState<PautaBorrador>(() => borradorDesde(undefined));
  const [nuevoHito, setNuevoHito] = useState('');

  // Al abrir (y cuando llega la pauta) el borrador arranca de lo guardado:
  // cerrar sin guardar descarta lo que se tocó.
  useEffect(() => {
    if (isOpen && !isLoading) {
      setBorrador(borradorDesde(vista));
      setNuevoHito('');
    }
  }, [isOpen, isLoading, vista]);

  const problema = problemaDe(borrador);
  const cols = columnas(borrador);
  const hitoEscrito = leerNumero(nuevoHito);
  const hitoValido = hitoEscrito != null && Number.isInteger(hitoEscrito) && hitoEscrito > 0;

  const editarFila = (key: string, cambio: Partial<FilaBorrador>) =>
    setBorrador((b) => ({ ...b, items: b.items.map((i) => (i.key === key ? { ...i, ...cambio } : i)) }));

  const sumarHito = () => {
    if (!hitoValido) return;
    setBorrador((b) => agregarHito(b, hitoEscrito));
    setNuevoHito('');
  };

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
                    Pauta de mantención · {equipo.internalCode}
                  </Modal.Heading>
                  <p className="text-sm text-muted-foreground">
                    {equipo.brand} {equipo.model}. Marcá en cada hito lo que se hace; el hito más alto reinicia el
                    ciclo.
                  </p>
                </div>
              </Modal.Header>

              <Modal.Body className="flex flex-col gap-5">
                {isLoading ? (
                  <div className="flex justify-center py-10">
                    <Spinner />
                  </div>
                ) : isError ? (
                  <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger-soft-foreground">
                    {error instanceof Error ? error.message : 'No se pudo cargar la pauta.'}
                  </p>
                ) : (
                  <>
                    {vista && <ResumenProxima vista={vista} />}

                    <DocumentosPauta equipmentId={equipo.id} internalCode={equipo.internalCode} />

                    <section className="flex flex-col gap-3">
                      <h3 className="text-sm font-semibold">Hitos del ciclo</h3>
                      <div className="flex flex-wrap items-center gap-2">
                        {borrador.milestones.map((m, i) => (
                          <span
                            key={m}
                            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-sm font-medium tabular-nums"
                          >
                            {fmtContador(m, vista?.equipment.unit ?? 'h')}
                            {i === borrador.milestones.length - 1 && (
                              <span className="text-xs font-normal text-muted-foreground">· reinicia</span>
                            )}
                            {!soloLectura && (
                              <button
                                type="button"
                                aria-label={`Quitar el hito ${m}`}
                                className="-mr-1 rounded-full p-0.5 text-muted-foreground hover:bg-surface-secondary hover:text-foreground"
                                onClick={() => setBorrador((b) => quitarHito(b, m))}
                              >
                                <X className="size-3.5" />
                              </button>
                            )}
                          </span>
                        ))}
                        {borrador.milestones.length === 0 && (
                          <span className="text-sm text-muted-foreground">Sin hitos todavía.</span>
                        )}
                      </div>
                      {!soloLectura && (
                        <div className="flex flex-wrap items-end gap-3">
                          <div className="flex w-36 flex-col gap-1">
                            <Label htmlFor="nuevo-hito">Nuevo hito ({vista?.equipment.unit ?? 'h'})</Label>
                            <Input
                              id="nuevo-hito"
                              inputMode="numeric"
                              placeholder="Ej. 250"
                              value={nuevoHito}
                              onChange={(e) => setNuevoHito(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  sumarHito();
                                }
                              }}
                            />
                          </div>
                          <Button variant="secondary" isDisabled={!hitoValido} onPress={sumarHito}>
                            <Plus className="size-4" /> Agregar hito
                          </Button>
                          {/* El aviso es lo que dispara la tarjeta del mantenedor: al
                              entrar en este margen se le crea una orden preventiva
                              con las operaciones del hito que viene. */}
                          <div className="ml-auto flex w-56 flex-col gap-1">
                            <Label htmlFor="aviso-mantenedor">
                              Avisar al mantenedor ({vista?.equipment.unit ?? 'h'} antes, opcional)
                            </Label>
                            <Input
                              id="aviso-mantenedor"
                              inputMode="numeric"
                              placeholder="Ej. 50"
                              value={borrador.alertBefore}
                              onChange={(e) => setBorrador((b) => ({ ...b, alertBefore: e.target.value }))}
                            />
                          </div>
                          <div className="flex w-56 flex-col gap-1">
                            <Label htmlFor="hito-inicial">Servicio inicial, solo una vez (opcional)</Label>
                            <Input
                              id="hito-inicial"
                              inputMode="numeric"
                              placeholder="Ej. 50"
                              value={borrador.initialMilestone}
                              onChange={(e) => setBorrador((b) => ({ ...b, initialMilestone: e.target.value }))}
                            />
                          </div>
                        </div>
                      )}
                    </section>

                    <section className="flex flex-col gap-3">
                      <h3 className="text-sm font-semibold">Operaciones y materiales</h3>
                      <div className="overflow-x-auto rounded-xl border border-border">
                        <table className="w-full border-collapse text-sm">
                          <thead className="bg-surface-secondary text-xs text-muted-foreground">
                            <tr>
                              <th className="px-2 py-2 text-left font-semibold">Tipo</th>
                              <th className="min-w-56 px-2 py-2 text-left font-semibold">Operación / material</th>
                              <th className="px-2 py-2 text-left font-semibold">Cant.</th>
                              <th className="px-2 py-2 text-left font-semibold">Unidad</th>
                              <th className="px-2 py-2 text-left font-semibold">Código</th>
                              {cols.map((c) => (
                                <th
                                  key={`${c.inicial ? 'i' : 'h'}${c.hito}`}
                                  className={`px-1.5 py-2 text-center font-semibold tabular-nums ${c.inicial ? 'bg-accent-soft text-accent-soft-foreground' : ''}`}
                                  title={c.inicial ? 'Servicio inicial: se hace una sola vez' : undefined}
                                >
                                  {c.inicial ? `1ra ${c.hito}` : c.hito.toLocaleString('es-CL')}
                                </th>
                              ))}
                              {!soloLectura && <th className="w-10" aria-label="Quitar" />}
                            </tr>
                          </thead>
                          <tbody>
                            {borrador.items.map((fila) => (
                              <tr key={fila.key} className="border-t border-border">
                                <td className="px-2 py-1.5">
                                  <Select
                                    aria-label="Tipo"
                                    className="w-32"
                                    isDisabled={soloLectura}
                                    value={fila.kind}
                                    onChange={(v) => v && editarFila(fila.key, { kind: v as PlanItemKind })}
                                  >
                                    <Select.Trigger>
                                      <Select.Value />
                                      <Select.Indicator />
                                    </Select.Trigger>
                                    <Select.Popover>
                                      <ListBox>
                                        {PLAN_ITEM_KINDS.map((k) => (
                                          <ListBox.Item key={k} id={k} textValue={planItemKindLabel[k]}>
                                            {planItemKindLabel[k]}
                                            <ListBox.ItemIndicator />
                                          </ListBox.Item>
                                        ))}
                                      </ListBox>
                                    </Select.Popover>
                                  </Select>
                                </td>
                                <td className="px-2 py-1.5">
                                  <Input
                                    aria-label="Operación o material"
                                    disabled={soloLectura}
                                    placeholder="Ej. Cambio filtro aceite motor"
                                    value={fila.description}
                                    onChange={(e) => editarFila(fila.key, { description: e.target.value })}
                                  />
                                </td>
                                <td className="px-2 py-1.5">
                                  <Input
                                    aria-label="Cantidad"
                                    className="w-20"
                                    disabled={soloLectura}
                                    inputMode="decimal"
                                    value={fila.quantity}
                                    onChange={(e) => editarFila(fila.key, { quantity: e.target.value })}
                                  />
                                </td>
                                <td className="px-2 py-1.5">
                                  <Input
                                    aria-label="Unidad"
                                    className="w-20"
                                    disabled={soloLectura}
                                    placeholder="LT"
                                    value={fila.unit}
                                    onChange={(e) => editarFila(fila.key, { unit: e.target.value })}
                                  />
                                </td>
                                <td className="px-2 py-1.5">
                                  <Input
                                    aria-label="Código del repuesto"
                                    className="w-32"
                                    disabled={soloLectura}
                                    placeholder="Ej. LF9009"
                                    value={fila.partNumber}
                                    onChange={(e) => editarFila(fila.key, { partNumber: e.target.value })}
                                  />
                                </td>
                                {cols.map((c) => (
                                  <td
                                    key={`${c.inicial ? 'i' : 'h'}${c.hito}`}
                                    className={`px-1.5 py-1.5 text-center ${c.inicial ? 'bg-accent-soft/40' : ''}`}
                                  >
                                    <Checkbox
                                      aria-label={`${fila.description || 'Operación'} en ${c.hito}`}
                                      className="inline-flex"
                                      isDisabled={soloLectura}
                                      isSelected={fila.milestones.includes(c.hito)}
                                      onChange={() => setBorrador((b) => alternarMarca(b, fila.key, c.hito))}
                                    >
                                      <Checkbox.Content>
                                        <Checkbox.Control>
                                          <Checkbox.Indicator />
                                        </Checkbox.Control>
                                      </Checkbox.Content>
                                    </Checkbox>
                                  </td>
                                ))}
                                {!soloLectura && (
                                  <td className="px-1 py-1.5 text-center">
                                    <Button
                                      isIconOnly
                                      aria-label={`Quitar ${fila.description || 'la fila'}`}
                                      size="sm"
                                      variant="ghost"
                                      onPress={() =>
                                        setBorrador((b) => ({ ...b, items: b.items.filter((i) => i.key !== fila.key) }))
                                      }
                                    >
                                      <Trash2 className="size-4" />
                                    </Button>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {!soloLectura && (
                        <div>
                          <Button
                            variant="secondary"
                            onPress={() => setBorrador((b) => ({ ...b, items: [...b.items, filaVacia()] }))}
                          >
                            <Plus className="size-4" /> Agregar operación
                          </Button>
                        </div>
                      )}
                    </section>
                  </>
                )}
              </Modal.Body>

              <Modal.Footer className="flex-wrap items-center">
                {!soloLectura && problema && !isLoading && (
                  <p className="mr-auto text-sm text-muted-foreground">{problema}</p>
                )}
                <Button variant="secondary" onPress={close}>
                  {soloLectura ? 'Cerrar' : 'Cancelar'}
                </Button>
                {!soloLectura && (
                  <Button
                    isDisabled={problema != null || isLoading || isError}
                    isPending={guardar.isPending}
                    onPress={() =>
                      guardar.mutate(
                        { equipmentId: equipo.id, internalCode: equipo.internalCode, plan: aEntrada(borrador) },
                        { onSuccess: close },
                      )
                    }
                  >
                    {({ isPending }) => (isPending ? <Spinner color="current" size="sm" /> : 'Guardar pauta')}
                  </Button>
                )}
              </Modal.Footer>
            </>
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

/**
 * En qué punto del ciclo va el equipo y qué le toca. Se calcula sobre la pauta
 * GUARDADA (lo que devolvió el servidor), no sobre lo que se está editando.
 */
function ResumenProxima({ vista }: { vista: MaintenancePlanView }) {
  const { unit, counter } = vista.equipment;
  const { cycleLength, positionInCycle, next } = vista.status;

  return (
    <section className="grid gap-3 rounded-2xl border border-border bg-surface-secondary p-4 sm:grid-cols-3">
      <Dato titulo={unit === 'km' ? 'Kilometraje actual' : 'Horómetro actual'}>
        {counter != null ? fmtContador(counter, unit) : 'Sin lectura'}
      </Dato>
      <Dato titulo="Punto del ciclo">
        {cycleLength != null && positionInCycle != null
          ? `${fmtContador(positionInCycle, unit)} de ${fmtContador(cycleLength, unit)}`
          : '—'}
      </Dato>
      <Dato titulo="Próxima mantención">
        {next ? (
          <span>
            {next.firstTimeOnly ? 'Servicio inicial de ' : ''}
            {fmtContador(next.milestone, unit)} ·{' '}
            <span className={next.remaining === 0 ? 'text-danger' : ''}>
              {next.remaining === 0 ? 'toca ahora' : `faltan ${fmtContador(next.remaining, unit)}`}
            </span>
            <span className="block text-xs font-normal text-muted-foreground">
              {next.items.length} {next.items.length === 1 ? 'operación' : 'operaciones'}
            </span>
          </span>
        ) : vista.plan ? (
          '—'
        ) : (
          'El equipo todavía no tiene pauta'
        )}
      </Dato>
    </section>
  );
}

function Dato({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{titulo}</span>
      <span className="text-base font-semibold tabular-nums">{children}</span>
    </div>
  );
}
