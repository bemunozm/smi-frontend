import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import {
  Button,
  Card,
  Chip,
  FieldError,
  Input,
  Label,
  ListBox,
  NumberField,
  Select,
  Spinner,
  TextArea,
  TextField,
} from '@heroui/react';

import { useCurrentUser } from '../hooks/useCurrentUser';
import { useOrdenes } from '../hooks/useOrdenes';
import { useCrearIntervencion, useIntervenciones } from '../hooks/useIntervenciones';
import { ESTADO_OT_LABELS, TIPO_OT_LABELS, TIPO_OT_OPTIONS } from '../config/mantenimiento-colors';
import { ROLES } from '../types/roles';
import { CreateIntervencionSchema, TIPO_OT, type CreateIntervencionInput } from '../types/mantenimiento';

function TrashIcon() {
  return (
    <svg fill="none" height="15" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="15">
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

function formatFecha(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
}

const EMPTY_INTERVENCION: CreateIntervencionInput = {
  tipo: TIPO_OT.CORRECTIVA,
  detalle: '',
  horasHombre: 0,
  horometro: 0,
  insumos: [],
};

/**
 * Form de registro de intervención — RHF + `zodResolver` + `useCrearIntervencion`.
 * `insumos` es un `useFieldArray` (cantidad con stepper `NumberField`, insumo
 * como texto libre — Inventario no expone todavía un selector real, ver TODO
 * inline). El "stock antes→después" NO se calcula: el backend no decrementa
 * stock ni lo devuelve en este endpoint, así que cada fila solo muestra la
 * cantidad ingresada y un chip "pendiente de Inventario".
 */
function IntervencionForm({ ordenId, disabled }: { ordenId: string; disabled: boolean }) {
  const crearIntervencion = useCrearIntervencion();
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateIntervencionInput>({
    resolver: zodResolver(CreateIntervencionSchema),
    defaultValues: EMPTY_INTERVENCION,
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'insumos' });

  const onSubmit = (values: CreateIntervencionInput): void => {
    crearIntervencion.mutate(
      { ordenId, input: values },
      { onSuccess: () => reset(EMPTY_INTERVENCION) },
    );
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => void handleSubmit(onSubmit)(e)}>
      <Controller
        control={control}
        name="tipo"
        render={({ field }) => (
          <Select
            fullWidth
            isDisabled={disabled}
            isInvalid={!!errors.tipo}
            name={field.name}
            value={field.value}
            onChange={(value) => {
              if (value) field.onChange(value);
            }}
          >
            <Label>Tipo de intervención</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {TIPO_OT_OPTIONS.map((option) => (
                  <ListBox.Item key={option.value} id={option.value} textValue={option.label}>
                    {option.label}
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
        name="detalle"
        render={({ field }) => (
          <TextField
            fullWidth
            isDisabled={disabled}
            isInvalid={!!errors.detalle}
            name={field.name}
            onBlur={field.onBlur}
            onChange={field.onChange}
            value={field.value}
          >
            <Label>Detalle de lo realizado</Label>
            <TextArea placeholder="Describe el trabajo realizado..." rows={3} />
            {errors.detalle ? <FieldError>{errors.detalle.message}</FieldError> : null}
          </TextField>
        )}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Controller
          control={control}
          name="horasHombre"
          render={({ field }) => (
            <NumberField fullWidth isDisabled={disabled} minValue={0} value={field.value} onChange={field.onChange}>
              <Label>Horas hombre</Label>
              <NumberField.Group>
                <NumberField.DecrementButton />
                <NumberField.Input onBlur={field.onBlur} />
                <NumberField.IncrementButton />
              </NumberField.Group>
            </NumberField>
          )}
        />
        <Controller
          control={control}
          name="horometro"
          render={({ field }) => (
            <NumberField
              fullWidth
              isDisabled={disabled}
              minValue={0}
              value={field.value ?? 0}
              onChange={field.onChange}
            >
              <Label>Horómetro</Label>
              <NumberField.Group>
                <NumberField.DecrementButton />
                <NumberField.Input onBlur={field.onBlur} />
                <NumberField.IncrementButton />
              </NumberField.Group>
            </NumberField>
          )}
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold tracking-wider text-(--eyebrow-color) uppercase">
            Insumos usados
          </span>
          <Button
            isDisabled={disabled}
            size="sm"
            variant="secondary"
            onPress={() => append({ insumoId: '', cantidad: 1 })}
          >
            Agregar insumo
          </Button>
        </div>

        {fields.length === 0 ? (
          <p className="text-sm text-muted">Sin insumos registrados en esta intervención.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {fields.map((item, index) => (
              <div
                key={item.id}
                className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-3"
              >
                <Controller
                  control={control}
                  name={`insumos.${index}.insumoId`}
                  render={({ field }) => (
                    <TextField
                      className="min-w-40 flex-1"
                      isDisabled={disabled}
                      isInvalid={!!errors.insumos?.[index]?.insumoId}
                      name={field.name}
                      onBlur={field.onBlur}
                      onChange={field.onChange}
                      value={field.value}
                    >
                      <Label>Insumo</Label>
                      {/* TODO(inventario): reemplazar por selector real de insumos cuando
                          Inventario exponga el endpoint */}
                      <Input placeholder="Código del insumo" />
                      {errors.insumos?.[index]?.insumoId ? (
                        <FieldError>{errors.insumos[index]?.insumoId?.message}</FieldError>
                      ) : null}
                    </TextField>
                  )}
                />
                <Controller
                  control={control}
                  name={`insumos.${index}.cantidad`}
                  render={({ field }) => (
                    <NumberField
                      className="w-36"
                      isDisabled={disabled}
                      minValue={0.01}
                      value={field.value}
                      onChange={field.onChange}
                    >
                      <Label>Cantidad</Label>
                      <NumberField.Group>
                        <NumberField.DecrementButton />
                        <NumberField.Input onBlur={field.onBlur} />
                        <NumberField.IncrementButton />
                      </NumberField.Group>
                    </NumberField>
                  )}
                />
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold tracking-wider text-(--eyebrow-color) uppercase">
                    Stock
                  </span>
                  <Chip color="default" size="sm" variant="soft">
                    Pendiente de Inventario
                  </Chip>
                </div>
                <Button
                  isDisabled={disabled}
                  isIconOnly
                  aria-label="Quitar insumo"
                  size="sm"
                  variant="tertiary"
                  onPress={() => remove(index)}
                >
                  <TrashIcon />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Button isDisabled={disabled} isPending={crearIntervencion.isPending} type="submit">
        {({ isPending }) => (isPending ? <Spinner color="current" size="sm" /> : 'Registrar intervención')}
      </Button>
    </form>
  );
}

/**
 * Sub-vista "Bitácora" del dominio Mantenimiento. La bitácora es por OT
 * (`GET /ordenes/:id/intervenciones`), así que primero se elige la orden de
 * trabajo desde la lista real (`useOrdenes`) y luego se carga/registra su
 * bitácora (`useIntervenciones`/`useCrearIntervencion`).
 */
export function BitacoraView() {
  const { role } = useCurrentUser();
  const { data: ordenes } = useOrdenes();
  const [ordenId, setOrdenId] = useState<string | null>(null);
  const ordenSeleccionada = useMemo(
    () => ordenes?.find((orden) => orden.id === ordenId) ?? null,
    [ordenes, ordenId],
  );
  const { data: intervenciones, isPending, isError, error } = useIntervenciones(ordenId ?? undefined);

  const puedeRegistrar = role === ROLES.MANTENEDOR;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-xl font-semibold tracking-[-0.02em] text-foreground">
          Bitácora de intervenciones
        </h2>
        <p className="text-sm text-muted">
          Registra el trabajo realizado sobre una orden de trabajo y consulta su historial.
        </p>
      </div>

      <Select
        fullWidth
        placeholder="Selecciona una orden de trabajo"
        value={ordenId ?? undefined}
        onChange={(value) => setOrdenId(typeof value === 'string' ? value : null)}
      >
        <Label>Orden de trabajo</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {(ordenes ?? []).map((orden) => (
              <ListBox.Item key={orden.id} id={orden.id} textValue={`${orden.equipoId} · ${orden.titulo}`}>
                {orden.equipoId} · {orden.titulo}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>

      {!ordenId ? (
        <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-sm font-medium text-foreground">Ninguna orden seleccionada</p>
          <p className="text-sm text-muted">
            Elige una orden de trabajo arriba para ver o registrar su bitácora.
          </p>
        </div>
      ) : null}

      {ordenId ? (
        <>
          {ordenSeleccionada ? (
            <Card>
              <Card.Content className="flex flex-wrap gap-6 text-sm">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-semibold tracking-wider text-(--eyebrow-color) uppercase">
                    Equipo
                  </span>
                  {ordenSeleccionada.equipoId}
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-semibold tracking-wider text-(--eyebrow-color) uppercase">
                    Estado
                  </span>
                  {ESTADO_OT_LABELS[ordenSeleccionada.estado]}
                </div>
              </Card.Content>
            </Card>
          ) : null}

          {!puedeRegistrar ? (
            <div className="rounded-lg bg-warning-soft px-4 py-3 text-sm text-warning-soft-foreground">
              Solo un usuario con rol Mantenedor puede registrar intervenciones. Puedes revisar la
              bitácora existente abajo.
            </div>
          ) : null}

          <IntervencionForm disabled={!puedeRegistrar} ordenId={ordenId} />

          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold tracking-wider text-(--eyebrow-color) uppercase">
              Bitácora registrada
            </span>

            {isPending ? (
              <div className="flex justify-center py-8">
                <Spinner color="accent" size="lg" />
              </div>
            ) : null}

            {isError ? (
              <div className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger-soft-foreground" role="alert">
                {error instanceof Error ? error.message : 'No se pudo cargar la bitácora.'}
              </div>
            ) : null}

            {!isPending && !isError && intervenciones && intervenciones.length === 0 ? (
              <p className="text-sm text-muted">Todavía no hay intervenciones registradas.</p>
            ) : null}

            {!isPending && !isError && intervenciones && intervenciones.length > 0 ? (
              <div className="flex flex-col gap-2">
                {intervenciones.map((intervencion) => (
                  <Card key={intervencion.id}>
                    <Card.Header>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Card.Title className="text-sm font-semibold text-foreground">
                          {TIPO_OT_LABELS[intervencion.tipo]}
                        </Card.Title>
                        <div className="flex items-center gap-2">
                          {intervencion.soloLectura ? (
                            <Chip color="default" size="sm" variant="soft">
                              Solo lectura
                            </Chip>
                          ) : null}
                          <span className="text-xs text-muted">{formatFecha(intervencion.fecha)}</span>
                        </div>
                      </div>
                    </Card.Header>
                    <Card.Content className="flex flex-col gap-2 text-sm">
                      <p className="text-foreground">{intervencion.detalle}</p>
                      <div className="flex flex-wrap gap-4 text-xs text-muted">
                        <span>Horas hombre: {intervencion.horasHombre}</span>
                        {intervencion.horometro !== null ? (
                          <span>Horómetro: {intervencion.horometro}</span>
                        ) : null}
                      </div>
                      {intervencion.insumos.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {intervencion.insumos.map((insumo) => (
                            <Chip key={insumo.id} color="default" size="sm" variant="soft">
                              {insumo.insumoId} · {insumo.cantidad} · stock pendiente de Inventario
                            </Chip>
                          ))}
                        </div>
                      ) : null}
                    </Card.Content>
                  </Card>
                ))}
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
