import { useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import {
  Button,
  Card,
  FieldError,
  Input,
  Label,
  ListBox,
  Select,
  Spinner,
  TextField,
} from '@heroui/react';
import { ArrowRight, Clock, Info, Truck, TriangleAlert, Wrench } from 'lucide-react';

import { StatusChip } from '../components/flota/StatusChip';
import { PendientesStrip } from '../components/sync/PendientesStrip';
import { usePermissions } from '../hooks/usePermissions';
import { useLogOperation, useOrdenes } from '../hooks/useOrdenes';
import { useEquipment } from '../hooks/useEquipment';
import { RECURSOS_DE_ORDENES } from '../lib/pending-resources';
import { Segmented } from '../components/inventario/shared';
import {
  ESTADO_OT_LABELS,
  TIPO_OT_LABELS,
  estadoOTChipColor,
} from '../config/mantenimiento-colors';
import {
  LogOperationFormSchema,
  TIPO_OT,
  toCreateOrdenInput,
  type LogOperationFormValues,
  type OrdenTrabajo,
} from '../types/mantenimiento';
import { formatDate } from '../components/mantenimiento/workshop';

const EMPTY_FORM: LogOperationFormValues = {
  equipoId: '',
  tipo: TIPO_OT.CORRECTIVA,
  hallazgo: '',
  titulo: '',
};

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-border py-11 text-center">
      <span className="mb-1 text-muted-foreground">{icon}</span>
      <p className="m-0 text-sm font-semibold text-foreground">{title}</p>
      <p className="m-0 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

/** Ítem del historial de operaciones del equipo seleccionado. */
function OperationTimelineItem({ orden }: { orden: OrdenTrabajo }) {
  return (
    <div className="flex flex-col gap-1.5 border-t border-border py-3.5 first:border-t-0 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip tone="secondary">
          {TIPO_OT_LABELS[orden.tipo]}
        </StatusChip>
        <StatusChip tone={estadoOTChipColor(orden.estado)}>
          {ESTADO_OT_LABELS[orden.estado]}
        </StatusChip>
        <span className="ms-auto font-mono text-xs text-muted-foreground">
          {formatDate(orden.updatedAt)}
        </span>
      </div>
      <p className="m-0 text-sm font-semibold">{orden.titulo}</p>
      {orden.origen === 'HALLAZGO' && orden.origenDetalle ? (
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <TriangleAlert className="size-3.5 shrink-0" />
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
 * Sub-vista "Bitácora" del taller (diseño Mantenedor Taller): registrar una
 * operación desde cero —equipo + tipo + nombre, hallazgo si es correctiva—
 * y ver el historial de operaciones del equipo elegido. La operación nace
 * EN_PROCESO (`useLogOperation`: POST + PATCH). El backend restringe
 * `POST /ordenes` a ADMIN/SUPERVISOR, así que para el MANTENEDOR el form va
 * deshabilitado con el aviso correspondiente.
 */
export function BitacoraView() {
  const { can } = usePermissions();
  const { data: equipment } = useEquipment();
  const { data: ordenes } = useOrdenes();
  const logOperation = useLogOperation();

  // Espejo del backend vía `lib/permissions`: `POST /ordenes` es de
  // ADMIN/SUPERVISOR; para el MANTENEDOR el form va deshabilitado con aviso.
  const canCreate = can('orden.create');

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
      // Se conserva el equipo elegido: lo normal es registrar varias
      // operaciones seguidas del mismo equipo y mirar su historial al lado.
      onSuccess: () => reset({ ...EMPTY_FORM, equipoId: values.equipoId }),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-xl font-semibold tracking-[-0.02em] text-foreground">
          Bitácora — Registrar operación
        </h2>
        <p className="text-sm text-muted-foreground">
          Elige el equipo y el tipo, nombra la operación y, si es correctiva, asóciala a un
          hallazgo. Al iniciarla pasa a "en proceso".
        </p>
      </div>

      <PendientesStrip recursos={RECURSOS_DE_ORDENES} />

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Card>
          <Card.Header>
            <Card.Title>Nueva operación</Card.Title>
            <Card.Description>Selecciona el equipo, el tipo y nombra la operación.</Card.Description>
          </Card.Header>
          <Card.Content className="flex flex-col gap-4">
            {!canCreate ? (
              <div className="rounded-lg bg-warning-soft px-4 py-3 text-sm text-warning-soft-foreground">
                Tu rol no puede registrar operaciones — puedes consultar el historial del equipo.
              </div>
            ) : null}

            <form className="flex flex-col gap-4" noValidate onSubmit={(e) => void handleSubmit(onSubmit)(e)}>
              <Controller
                control={control}
                name="equipoId"
                render={({ field }) => (
                  <Select
                    fullWidth
                    isDisabled={!canCreate}
                    isInvalid={!!errors.equipoId}
                    name={field.name}
                    placeholder="Escoge un equipo"
                    value={field.value}
                    onChange={(value) => {
                      if (typeof value === 'string') field.onChange(value);
                    }}
                  >
                    <Label>Equipo</Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {(equipment ?? []).map((eq) => (
                          <ListBox.Item
                            key={eq.id}
                            id={eq.internalCode}
                            textValue={`${eq.internalCode} · ${eq.brand} ${eq.model}`}
                          >
                            {eq.internalCode} · {eq.brand} {eq.model}
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                )}
              />

              <Controller
                control={control}
                name="tipo"
                render={({ field }) => (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-semibold tracking-wider text-(--eyebrow-color) uppercase">
                      Tipo de operación
                    </span>
                    <Segmented
                      label="Tipo de operación"
                      options={[
                        {
                          id: TIPO_OT.CORRECTIVA,
                          label: (
                            <span className="inline-flex items-center gap-1.5">
                              <Wrench className="size-3.5" />
                              Correctiva
                            </span>
                          ),
                        },
                        {
                          id: TIPO_OT.PREVENTIVA,
                          label: (
                            <span className="inline-flex items-center gap-1.5">
                              <Clock className="size-3.5" />
                              Preventiva
                            </span>
                          ),
                        },
                      ]}
                      value={field.value}
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
                    <TextField
                      fullWidth
                      isDisabled={!canCreate}
                      name={field.name}
                      onBlur={field.onBlur}
                      onChange={field.onChange}
                      value={field.value ?? ''}
                    >
                      <Label>Hallazgo asociado (opcional)</Label>
                      <Input placeholder="Ej. Fuga de aceite hidráulico en pluma" />
                      <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <TriangleAlert className="size-3 shrink-0" />
                        La operación quedará ligada a este hallazgo.
                      </span>
                    </TextField>
                  )}
                />
              ) : null}

              <Controller
                control={control}
                name="titulo"
                render={({ field }) => (
                  <TextField
                    fullWidth
                    isDisabled={!canCreate}
                    isInvalid={!!errors.titulo}
                    name={field.name}
                    onBlur={field.onBlur}
                    onChange={field.onChange}
                    value={field.value}
                  >
                    <Label>Nombre de la operación</Label>
                    <Input
                      placeholder={
                        tipo === TIPO_OT.CORRECTIVA
                          ? 'Ej. Reparación de fuga hidráulica'
                          : 'Ej. Cambio de aceite preventivo 250 h'
                      }
                    />
                    {errors.titulo ? <FieldError>{errors.titulo.message}</FieldError> : null}
                  </TextField>
                )}
              />

              <div className="flex items-start gap-2.5 rounded-lg bg-accent px-3.5 py-3 text-[13px] leading-5 text-accent-foreground">
                <Info className="mt-0.5 size-4 shrink-0" />
                <span>
                  Lo que hiciste, la foto y los insumos utilizados se registran al{' '}
                  <strong>finalizar la tarea</strong>. Ahí se descuenta el stock.
                </span>
              </div>

              <div className="flex justify-end gap-2.5">
                <Button isDisabled={!canCreate} variant="secondary" onPress={() => reset(EMPTY_FORM)}>
                  Limpiar
                </Button>
                <Button isDisabled={!canCreate} isPending={logOperation.isPending} type="submit">
                  {({ isPending }) =>
                    isPending ? (
                      <Spinner color="current" size="sm" />
                    ) : (
                      <>
                        <ArrowRight className="size-4" />
                        Iniciar operación
                      </>
                    )
                  }
                </Button>
              </div>
            </form>
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title>Operaciones de este equipo</Card.Title>
            <Card.Description>
              {selectedEquipment
                ? `${selectedEquipment.internalCode} · ${selectedEquipment.brand} ${selectedEquipment.model} — las finalizadas quedan en solo lectura.`
                : 'Selecciona un equipo para ver su historial.'}
            </Card.Description>
          </Card.Header>
          <Card.Content>
            {!equipoId ? (
              <EmptyState
                description="Elige un equipo en el formulario para ver sus operaciones."
                icon={<Truck className="size-6" />}
                title="Selecciona un equipo"
              />
            ) : equipmentOperations.length === 0 ? (
              <EmptyState
                description="Este equipo todavía no tiene operaciones en bitácora."
                icon={<Wrench className="size-6" />}
                title="Sin operaciones registradas"
              />
            ) : (
              <div className="flex flex-col">
                {equipmentOperations.map((orden) => (
                  <OperationTimelineItem key={orden.id} orden={orden} />
                ))}
              </div>
            )}
          </Card.Content>
        </Card>
      </div>
    </div>
  );
}
