import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { ArrowRight, Info, TriangleAlert } from 'lucide-react';

import {
  Boton,
  Campo,
  Chip,
  ChipEstado,
  Form,
  GrupoHead,
  Hint,
  Input,
  Label,
  ModalTerreno,
  Segmentado,
  Selector,
  type OpcionSelector,
} from '../terreno/ui';
import { useLogOperation, useOrdenes } from '../../hooks/useOrdenes';
import { useEquipment } from '../../hooks/useEquipment';
import { ESTADO_OT_LABELS, TIPO_OT_LABELS } from '../../config/mantenimiento-colors';
import {
  LogOperationFormSchema,
  TIPO_OT,
  toCreateOrdenInput,
  type EstadoOT,
  type LogOperationFormValues,
  type OrdenTrabajo,
} from '../../types/mantenimiento';
import { formatDate } from './workshop';

const EMPTY_FORM: LogOperationFormValues = {
  equipoId: '',
  tipo: TIPO_OT.CORRECTIVA,
  hallazgo: '',
  titulo: '',
};

/** Mismos hex de estado que usa Terreno en sus `ChipEstado`. */
const ESTADO_OT_HEX: Record<EstadoOT, string> = {
  PENDIENTE: '#92590a',
  ASIGNADA: '#1a3a9c',
  EN_PROCESO: '#1a3a9c',
  COMPLETADA: '#156237',
  CANCELADA: '#971414',
};

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl border border-dashed border-border px-4 py-10 text-center">
      <p className="m-0 text-sm font-semibold">{title}</p>
      <p className="m-0 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

/** Ítem del historial de operaciones del equipo seleccionado. */
function OperationTimelineItem({ orden }: { orden: OrdenTrabajo }) {
  return (
    <div className="flex flex-col gap-1.5 border-t border-border py-3.5 first:border-t-0 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-2">
        <Chip tono={orden.tipo === 'PREVENTIVA' ? 'info' : 'neutral'}>
          {TIPO_OT_LABELS[orden.tipo]}
        </Chip>
        <ChipEstado color={ESTADO_OT_HEX[orden.estado]}>
          {ESTADO_OT_LABELS[orden.estado]}
        </ChipEstado>
        <span className="tabular ms-auto text-xs text-muted-foreground">
          {formatDate(orden.updatedAt)}
        </span>
      </div>
      <p className="m-0 text-sm font-semibold">{orden.titulo}</p>
      {orden.origen === 'HALLAZGO' && orden.origenDetalle ? (
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
          Hallazgo: {orden.origenDetalle}
        </span>
      ) : null}
      <span className="text-xs text-muted-foreground">
        Por: {orden.asignadoA?.nombre ?? 'Sin asignar'}
      </span>
    </div>
  );
}

/**
 * "Crear orden" del taller — kit de Terreno: formulario (Selector de equipo
 * real + Segmentado correctiva/preventiva + hallazgo + nombre) con el
 * historial del equipo elegido al lado. La operación nace EN_PROCESO
 * (`useLogOperation` encola POST + PATCH).
 */
export function CreateOperationModal() {
  const { data: equipment } = useEquipment();
  const { data: ordenes } = useOrdenes();
  const logOperation = useLogOperation();
  const [abierto, setAbierto] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LogOperationFormValues>({
    resolver: zodResolver(LogOperationFormSchema),
    defaultValues: EMPTY_FORM,
  });
  const tipo = useWatch({ control, name: 'tipo' });
  const equipoId = useWatch({ control, name: 'equipoId' });

  const opcionesEquipo: OpcionSelector[] = useMemo(
    () =>
      (equipment ?? []).map((eq) => ({
        valor: eq.internalCode,
        titulo: eq.internalCode,
        detalle: `${eq.brand} ${eq.model}`,
      })),
    [equipment],
  );

  const selectedEquipment = useMemo(
    () => equipment?.find((eq) => eq.internalCode === equipoId),
    [equipment, equipoId],
  );
  const equipmentOperations = useMemo(
    () =>
      (ordenes ?? []).filter(
        (orden) =>
          orden.equipoId === equipoId ||
          (selectedEquipment ? orden.equipoId === selectedEquipment.id : false),
      ),
    [ordenes, equipoId, selectedEquipment],
  );

  const onSubmit = (values: LogOperationFormValues): void => {
    logOperation.mutate(toCreateOrdenInput(values), {
      onSuccess: () => {
        reset(EMPTY_FORM);
        setAbierto(false);
      },
    });
  };

  return (
    <>
      <Boton variante="contorno" onClick={() => setAbierto(true)}>
        Crear orden
      </Boton>
      <ModalTerreno
        abierto={abierto}
        detalle='Elige el equipo y el tipo, nombra la operación y, si es correctiva, asóciala a un hallazgo. Al crearla pasa a "en proceso".'
        titulo="Nueva operación"
        onAbiertoChange={setAbierto}
      >
        <div className="grid items-start gap-5 lg:grid-cols-2">
          <form
            className="flex flex-col gap-3.5"
            id="create-operation-form"
            noValidate
            onSubmit={(e) => void handleSubmit(onSubmit)(e)}
          >
            <Form>
              <Controller
                control={control}
                name="equipoId"
                render={({ field }) => (
                  <Campo error={errors.equipoId?.message} label="Equipo" requerido>
                    <Selector
                      etiqueta="Equipo"
                      opciones={opcionesEquipo}
                      placeholder="Escoge un equipo"
                      tituloTabular
                      valor={field.value}
                      onChange={field.onChange}
                    />
                  </Campo>
                )}
              />

              <Controller
                control={control}
                name="tipo"
                render={({ field }) => (
                  <div className="flex flex-col gap-1.5">
                    <Label>Tipo de operación</Label>
                    <Segmentado
                      etiqueta="Tipo de operación"
                      opciones={[
                        { valor: TIPO_OT.CORRECTIVA, label: 'Correctiva' },
                        { valor: TIPO_OT.PREVENTIVA, label: 'Preventiva' },
                      ]}
                      valor={field.value}
                      onChange={field.onChange}
                    />
                  </div>
                )}
              />

              {tipo === TIPO_OT.CORRECTIVA ? (
                <Controller
                  control={control}
                  name="hallazgo"
                  render={({ field }) => (
                    <Campo
                      hint={
                        <span className="flex items-center gap-1.5">
                          <TriangleAlert className="h-3 w-3 shrink-0" />
                          La operación quedará ligada a este hallazgo.
                        </span>
                      }
                      label="Hallazgo asociado (opcional)"
                    >
                      <Input
                        placeholder="Ej. Fuga de aceite hidráulico en pluma"
                        value={field.value ?? ''}
                        onBlur={field.onBlur}
                        onChange={field.onChange}
                      />
                    </Campo>
                  )}
                />
              ) : null}

              <Controller
                control={control}
                name="titulo"
                render={({ field }) => (
                  <Campo error={errors.titulo?.message} label="Nombre de la operación" requerido>
                    <Input
                      placeholder={
                        tipo === TIPO_OT.CORRECTIVA
                          ? 'Ej. Reparación de fuga hidráulica'
                          : 'Ej. Cambio de aceite preventivo 250 h'
                      }
                      value={field.value}
                      onBlur={field.onBlur}
                      onChange={field.onChange}
                    />
                  </Campo>
                )}
              />
            </Form>

            <div className="flex items-start gap-2.5 rounded-2xl bg-[var(--accent-soft)] px-3.5 py-3 text-[13px] leading-5 text-[var(--accent-soft-foreground)]">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Lo que hiciste, la foto y los insumos utilizados se registran al{' '}
                <strong>finalizar la tarea</strong>. Ahí se descuenta el stock.
              </span>
            </div>

            <div className="mt-1 flex gap-2.5">
              <Boton ancho type="button" variante="contorno" onClick={() => reset(EMPTY_FORM)}>
                Limpiar
              </Boton>
              <Boton ancho disabled={logOperation.isPending} type="submit" variante="acento">
                {logOperation.isPending ? (
                  'Iniciando…'
                ) : (
                  <>
                    <ArrowRight className="h-5 w-5" />
                    Iniciar operación
                  </>
                )}
              </Boton>
            </div>
          </form>

          <section className="flex flex-col gap-2 rounded-2xl border border-border bg-[#fafbfc] p-4">
            <GrupoHead
              detalle={
                selectedEquipment
                  ? `${selectedEquipment.internalCode} · ${selectedEquipment.brand} ${selectedEquipment.model}`
                  : undefined
              }
              titulo="Operaciones de este equipo"
            />
            {!equipoId ? (
              <EmptyState
                description="Elige un equipo en el formulario para ver sus operaciones."
                title="Selecciona un equipo"
              />
            ) : equipmentOperations.length === 0 ? (
              <EmptyState
                description="Este equipo todavía no tiene operaciones registradas."
                title="Sin operaciones registradas"
              />
            ) : (
              <div className="flex max-h-80 flex-col overflow-y-auto">
                {equipmentOperations.map((orden) => (
                  <OperationTimelineItem key={orden.id} orden={orden} />
                ))}
              </div>
            )}
            <Hint>Las finalizadas quedan en solo lectura.</Hint>
          </section>
        </div>
      </ModalTerreno>
    </>
  );
}
