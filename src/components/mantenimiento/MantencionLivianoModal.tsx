import { useEffect, useState } from 'react';
import { FileUp, Pencil } from 'lucide-react';
import { Button, Input, Label, Modal, Spinner } from '@heroui/react';

import { useEquipmentDocuments } from '../../hooks/useEquipmentDocuments';
import { usePermissions } from '../../hooks/usePermissions';
import { useLightConfig, useSaveLightConfig } from '../../hooks/useVencimientos';
import type { EquipmentDocument } from '../../types/equipment-document';
import { EquipmentDocumentModal } from '../flota/EquipmentDocumentModal';
import { fmtNum } from '../../lib/format';
import { aBorrador, problemaLiviano, type Borrador } from '../../lib/mantencion-liviano';
import {
  LIGHT_DOC_ALERT_FIELD,
  type LightConfig,
  type LightConfigView,
  type LightDocType,
} from '../../types/vencimientos';

interface EquipoLiviano {
  id: string;
  internalCode: string;
  brand: string;
  model: string;
}

const fechaLegible = (d: string) => d.split('-').reverse().join('-');

/**
 * «Asignar mantenciones» de un vehículo liviano (Módulo 4). Los livianos no
 * usan la pauta por hitos de los pesados: su mantención es siempre cada 10.000
 * km. Acá se elige con cuántos km avisar antes de esa mantención (y crear la
 * orden del taller) y con cuántos días avisar antes de que venza cada papel:
 * revisión técnica, permiso de circulación y seguro. Los avisos les llegan al
 * mantenedor y al administrador.
 */
export function MantencionLivianoModal({
  equipo,
  isOpen,
  onOpenChange,
  soloLectura,
}: {
  equipo: EquipoLiviano;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  soloLectura: boolean;
}) {
  const { data: vista, isLoading, isError, error } = useLightConfig(equipo.id, isOpen);
  const guardar = useSaveLightConfig();
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  // Cargar o editar uno de sus papeles: el mismo formulario de la ficha del
  // equipo, con el tipo ya elegido. Solo el administrador carga documentos.
  const { can } = usePermissions();
  const puedeCargarPapeles = can('equipmentDocument.create');
  const { data: documentos } = useEquipmentDocuments(isOpen ? equipo.id : '');
  const [papel, setPapel] = useState<{ type: LightDocType; documento: EquipmentDocument | null } | null>(null);
  /** El papel vigente de ese tipo: el de vencimiento más lejano (o el último cargado). */
  const papelDe = (type: LightDocType) =>
    (documentos ?? [])
      .filter((d) => d.type === type)
      .sort((a, b) => (b.expiryDate ?? '').localeCompare(a.expiryDate ?? ''))[0] ?? null;

  // Al abrir (y cuando llega lo guardado) el borrador arranca de ahí: cerrar
  // sin guardar descarta lo que se tocó.
  useEffect(() => {
    if (isOpen && vista) setBorrador(aBorrador(vista.config));
  }, [isOpen, vista]);

  const problema = borrador ? problemaLiviano(borrador) : null;
  const campo = (k: keyof LightConfig, valor: string) =>
    setBorrador((b) => (b ? { ...b, [k]: valor.replace(/\D/g, '') } : b));

  return (
    <>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
        <Modal.Container>
          <Modal.Dialog className="flex h-full max-h-full w-full max-w-full flex-col rounded-none sm:h-auto sm:max-h-[92vh] sm:w-[min(96vw,760px)] sm:max-w-none sm:rounded-2xl">
            {({ close }) => (
              <>
                <Modal.CloseTrigger />
                <Modal.Header>
                  <div className="flex flex-col gap-1">
                    <Modal.Heading className="font-display text-xl font-semibold tracking-[-0.02em]">
                      Mantención del liviano · {equipo.internalCode}
                    </Modal.Heading>
                    <p className="text-sm text-muted-foreground">
                      {equipo.brand} {equipo.model}. La mantención es cada 10.000 km; elige con cuánto avisar antes de
                      ella y de cada papel.
                    </p>
                  </div>
                </Modal.Header>

                <Modal.Body className="flex flex-col gap-5">
                  {isLoading || (!borrador && !isError) ? (
                    <div className="flex justify-center py-10">
                      <Spinner />
                    </div>
                  ) : isError || !vista || !borrador ? (
                    <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger-soft-foreground">
                      {error instanceof Error ? error.message : 'No se pudo cargar la mantención del liviano.'}
                    </p>
                  ) : (
                    <>
                      <Resumen vista={vista} />

                      <section className="flex flex-col gap-3">
                        <div>
                          <h3 className="text-base font-semibold">Mantención cada 10.000 km</h3>
                          <p className="text-sm text-muted-foreground">
                            Al llegar a este margen se crea la orden en el tablero del taller y se avisa al mantenedor y
                            al administrador.
                          </p>
                        </div>
                        <div className="flex max-w-xs flex-col gap-1">
                          <Label htmlFor="aviso-km">Avisar antes (km)</Label>
                          <Input
                            disabled={soloLectura}
                            id="aviso-km"
                            inputMode="numeric"
                            placeholder="1000"
                            value={borrador.serviceAlertKm}
                            onChange={(e) => campo('serviceAlertKm', e.target.value)}
                          />
                          <span className="text-xs text-muted-foreground">
                            Con 1.000, avisa a los 9.000, 19.000, 29.000 km…
                          </span>
                        </div>
                      </section>

                      <section className="flex flex-col gap-3">
                        <div>
                          <h3 className="text-base font-semibold">Aviso de vencimiento de los papeles</h3>
                          <p className="text-sm text-muted-foreground">
                            Cárgalos acá al dar de alta el vehículo y edítalos cuando se renueven. Los días de aviso
                            aplican a todos los papeles de ese tipo de este vehículo.
                          </p>
                        </div>
                        <div className="flex flex-col divide-y divide-border rounded-2xl border border-border">
                          {vista.documents.map((d) => {
                            const k = LIGHT_DOC_ALERT_FIELD[d.type];
                            return (
                              <div key={d.type} className="flex flex-wrap items-center gap-3 px-4 py-3">
                                <div className="min-w-0 flex-1">
                                  <p className="text-[15px] font-semibold">{d.label}</p>
                                  <p
                                    className={`text-sm ${
                                      d.status === 'VENCIDO'
                                        ? 'text-danger'
                                        : d.status === 'POR_VENCER'
                                          ? 'text-warning'
                                          : 'text-muted-foreground'
                                    }`}
                                  >
                                    {d.expiryDate
                                      ? d.daysToExpiry != null && d.daysToExpiry < 0
                                        ? `Venció el ${fechaLegible(d.expiryDate)}`
                                        : `Vence el ${fechaLegible(d.expiryDate)}${
                                            d.daysToExpiry != null ? ` · en ${d.daysToExpiry} días` : ''
                                          }`
                                      : 'Sin papel cargado'}
                                  </p>
                                </div>
                                {puedeCargarPapeles ? (
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onPress={() => setPapel({ type: d.type, documento: papelDe(d.type) })}
                                  >
                                    {papelDe(d.type) ? (
                                      <>
                                        <Pencil className="size-3.5" aria-hidden /> Editar
                                      </>
                                    ) : (
                                      <>
                                        <FileUp className="size-3.5" aria-hidden /> Cargar
                                      </>
                                    )}
                                  </Button>
                                ) : null}
                                <div className="flex w-36 flex-col gap-1">
                                  <Label htmlFor={`aviso-${d.type}`}>Avisar (días antes)</Label>
                                  <Input
                                    disabled={soloLectura}
                                    id={`aviso-${d.type}`}
                                    inputMode="numeric"
                                    placeholder="30"
                                    value={borrador[k]}
                                    onChange={(e) => campo(k, e.target.value)}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    </>
                  )}
                </Modal.Body>

                <Modal.Footer className="flex-wrap items-center">
                  {!soloLectura && problema && <p className="mr-auto text-sm text-danger">{problema}</p>}
                  <Button variant="secondary" onPress={close}>
                    {soloLectura ? 'Cerrar' : 'Cancelar'}
                  </Button>
                  {!soloLectura && (
                    <Button
                      isDisabled={!borrador || problema != null || isLoading || isError}
                      isPending={guardar.isPending}
                      onPress={() =>
                        borrador &&
                        guardar.mutate(
                          {
                            equipmentId: equipo.id,
                            config: {
                              serviceAlertKm: Number(borrador.serviceAlertKm),
                              technicalInspectionAlertDays: Number(borrador.technicalInspectionAlertDays),
                              circulationPermitAlertDays: Number(borrador.circulationPermitAlertDays),
                              insuranceAlertDays: Number(borrador.insuranceAlertDays),
                            },
                          },
                          { onSuccess: close },
                        )
                      }
                    >
                      {({ isPending }) => (isPending ? <Spinner color="current" size="sm" /> : 'Guardar')}
                    </Button>
                  )}
                </Modal.Footer>
              </>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
      {/* El formulario de documentos de la ficha, con el tipo ya elegido. Al
        guardarlo, la cola refresca los documentos y esta configuración. */}
      {puedeCargarPapeles ? (
        <EquipmentDocumentModal
          document={papel?.documento ?? null}
          equipmentId={equipo.id}
          esLiviano
          isOpen={papel != null}
          tipoInicial={papel?.type}
          onOpenChange={(abierto) => !abierto && setPapel(null)}
        />
      ) : null}
    </>
  );
}

function Resumen({ vista }: { vista: LightConfigView }) {
  const s = vista.service;
  return (
    <section className="grid gap-3 rounded-2xl border border-border bg-surface-secondary p-4 sm:grid-cols-3">
      <Dato titulo="Kilometraje actual">
        {vista.equipment.mileage != null ? `${fmtNum(vista.equipment.mileage)} km` : 'Sin lectura'}
      </Dato>
      <Dato titulo="Mantención">Cada {fmtNum(vista.intervalKm)} km</Dato>
      <Dato titulo="Próxima mantención">
        {s ? (
          <span>
            {fmtNum(s.nextAt)} km ·{' '}
            <span className={s.due ? 'text-danger' : ''}>
              {s.remaining <= 0 ? 'toca ahora' : `faltan ${fmtNum(s.remaining)} km`}
            </span>
          </span>
        ) : (
          'Sin lectura del odómetro'
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
