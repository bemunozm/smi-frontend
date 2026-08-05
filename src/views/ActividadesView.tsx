import { useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import {
  Button,
  Card,
  Checkbox,
  Chip,
  FieldError,
  Input,
  Label,
  ListBox,
  Select,
  Spinner,
  TextArea,
  TextField,
} from '@heroui/react';

import { useCurrentUser } from '../hooks/useCurrentUser';
import { useActividades, useActualizarActividad, useCrearActividad } from '../hooks/useActividades';
import {
  ESTADO_ACTIVIDAD_LABELS,
  ORIGEN_ACTIVIDAD_LABELS,
  ORIGEN_ACTIVIDAD_OPTIONS,
  estadoActividadChipColor,
} from '../config/mantenimiento-colors';
import { ROLES } from '../types/roles';
import {
  CreateActividadSchema,
  ESTADO_ACTIVIDAD,
  ORIGEN_ACTIVIDAD,
  type CreateActividadInput,
  type OrigenActividad,
} from '../types/mantenimiento';

const CAMPO_REFERENCIA: Record<OrigenActividad, { label: string; placeholder: string }> = {
  [ORIGEN_ACTIVIDAD.HALLAZGO]: { label: 'ID del hallazgo', placeholder: 'Ej. HAL-0231' },
  [ORIGEN_ACTIVIDAD.EQUIPO]: { label: 'Código de equipo', placeholder: 'Ej. EX-001' },
  [ORIGEN_ACTIVIDAD.MANUAL]: { label: 'Referencia libre (opcional)', placeholder: 'Contexto adicional' },
};

const EMPTY_ACTIVIDAD: CreateActividadInput = {
  descripcion: '',
  origen: ORIGEN_ACTIVIDAD.MANUAL,
  referencia: '',
  asignadoAId: '',
  equipoId: '',
  hallazgoId: '',
};

/**
 * Form "Asignar actividad" — RHF + `zodResolver` + `useCrearActividad`. El
 * campo de referencia cambia según `origen`: `equipoId` (HALLAZGO/EQUIPO
 * quedan como texto libre porque Flota/Hallazgos no exponen todavía un
 * selector real, ver TODOs inline). `asignadoAId` también queda como texto
 * opcional — no hay endpoint público de usuarios para roles no-admin.
 */
function AsignarActividadForm() {
  const crearActividad = useCrearActividad();
  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<CreateActividadInput>({
    resolver: zodResolver(CreateActividadSchema),
    defaultValues: EMPTY_ACTIVIDAD,
  });
  const origen = watch('origen');
  const campoReferencia = CAMPO_REFERENCIA[origen];

  const onSubmit = (values: CreateActividadInput): void => {
    const payload: CreateActividadInput = {
      descripcion: values.descripcion,
      origen: values.origen,
      referencia: values.referencia?.trim() ? values.referencia.trim() : undefined,
      asignadoAId: values.asignadoAId?.trim() ? values.asignadoAId.trim() : undefined,
      equipoId:
        origen === ORIGEN_ACTIVIDAD.EQUIPO && values.equipoId?.trim() ? values.equipoId.trim() : undefined,
      hallazgoId:
        origen === ORIGEN_ACTIVIDAD.HALLAZGO && values.hallazgoId?.trim()
          ? values.hallazgoId.trim()
          : undefined,
    };
    crearActividad.mutate(payload, { onSuccess: () => reset(EMPTY_ACTIVIDAD) });
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => void handleSubmit(onSubmit)(e)}>
      <Controller
        control={control}
        name="origen"
        render={({ field }) => (
          <Select
            fullWidth
            isInvalid={!!errors.origen}
            name={field.name}
            value={field.value}
            onChange={(value) => {
              if (value) field.onChange(value);
            }}
          >
            <Label>Origen</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {ORIGEN_ACTIVIDAD_OPTIONS.map((option) => (
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

      {origen === ORIGEN_ACTIVIDAD.EQUIPO ? (
        <Controller
          control={control}
          name="equipoId"
          render={({ field }) => (
            <TextField fullWidth name={field.name} onBlur={field.onBlur} onChange={field.onChange} value={field.value}>
              <Label>{campoReferencia.label}</Label>
              {/* TODO(flota): reemplazar por selector real de equipos cuando Flota exponga el endpoint */}
              <Input placeholder={campoReferencia.placeholder} />
            </TextField>
          )}
        />
      ) : null}

      {origen === ORIGEN_ACTIVIDAD.HALLAZGO ? (
        <Controller
          control={control}
          name="hallazgoId"
          render={({ field }) => (
            <TextField fullWidth name={field.name} onBlur={field.onBlur} onChange={field.onChange} value={field.value}>
              <Label>{campoReferencia.label}</Label>
              {/* TODO: reemplazar por selector real de hallazgos cuando ese dominio exponga el endpoint */}
              <Input placeholder={campoReferencia.placeholder} />
            </TextField>
          )}
        />
      ) : null}

      <Controller
        control={control}
        name="referencia"
        render={({ field }) => (
          <TextField fullWidth name={field.name} onBlur={field.onBlur} onChange={field.onChange} value={field.value}>
            <Label>Referencia / nota (opcional)</Label>
            <Input placeholder="Contexto adicional" />
          </TextField>
        )}
      />

      <Controller
        control={control}
        name="asignadoAId"
        render={({ field }) => (
          <TextField fullWidth name={field.name} onBlur={field.onBlur} onChange={field.onChange} value={field.value}>
            <Label>Asignar a (opcional)</Label>
            {/* TODO: reemplazar por selector real de usuarios (rol MANTENEDOR) — no hay
                endpoint público de usuarios para roles no-admin todavía */}
            <Input placeholder="ID del usuario" />
          </TextField>
        )}
      />

      <Controller
        control={control}
        name="descripcion"
        render={({ field }) => (
          <TextField
            fullWidth
            isInvalid={!!errors.descripcion}
            name={field.name}
            onBlur={field.onBlur}
            onChange={field.onChange}
            value={field.value}
          >
            <Label>Descripción</Label>
            <TextArea placeholder="Describe la actividad a realizar..." rows={3} />
            {errors.descripcion ? <FieldError>{errors.descripcion.message}</FieldError> : null}
          </TextField>
        )}
      />

      <Button isPending={crearActividad.isPending} type="submit">
        {({ isPending }) => (isPending ? <Spinner color="current" size="sm" /> : 'Asignar actividad')}
      </Button>
    </form>
  );
}

/**
 * Sub-vista "Tareas" (Actividades) del dominio Mantenimiento: form de
 * asignación + lista de seguimiento con toggle de estado
 * (`useActualizarActividad`). Sin try/catch ni toasts acá — viven en los
 * hooks.
 */
export function ActividadesView() {
  const { role } = useCurrentUser();
  const { data: actividades, isPending, isError, error } = useActividades();
  const actualizarActividad = useActualizarActividad();

  const stats = useMemo(() => {
    const lista = actividades ?? [];
    return {
      completadas: lista.filter((actividad) => actividad.estado === 'COMPLETADA').length,
      total: lista.length,
    };
  }, [actividades]);

  const puedeAsignar = role === ROLES.ADMIN || role === ROLES.SUPERVISOR;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-xl font-semibold tracking-[-0.02em] text-foreground">Actividades</h2>
        <p className="text-sm text-muted">Asigna y da seguimiento a tareas fuera de una orden de trabajo.</p>
      </div>

      {puedeAsignar ? (
        <Card>
          <Card.Header>
            <Card.Title className="font-display text-base font-semibold text-foreground">
              Asignar actividad
            </Card.Title>
          </Card.Header>
          <Card.Content>
            <AsignarActividadForm />
          </Card.Content>
        </Card>
      ) : (
        <div className="rounded-lg bg-warning-soft px-4 py-3 text-sm text-warning-soft-foreground">
          Solo Administradores o Supervisores pueden asignar nuevas actividades. Puedes marcar como
          completadas las que tengas asignadas abajo.
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold tracking-wider text-(--eyebrow-color) uppercase">
          Seguimiento del día
        </span>
        <Chip color="success" size="sm" variant="soft">
          Completadas {stats.completadas} / {stats.total}
        </Chip>
      </div>

      {isPending ? (
        <div className="flex justify-center py-16">
          <Spinner color="accent" size="lg" />
        </div>
      ) : null}

      {isError ? (
        <div className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger-soft-foreground" role="alert">
          {error instanceof Error ? error.message : 'No se pudo cargar la lista de actividades.'}
        </div>
      ) : null}

      {!isPending && !isError && actividades && actividades.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-sm font-medium text-foreground">Todavía no hay actividades asignadas</p>
          <p className="text-sm text-muted">Usa el formulario de arriba para asignar la primera.</p>
        </div>
      ) : null}

      {!isPending && !isError && actividades && actividades.length > 0 ? (
        <div className="flex flex-col gap-2">
          {actividades.map((actividad) => (
            <Card key={actividad.id}>
              <Card.Content className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <Checkbox
                    aria-label={`Marcar "${actividad.descripcion}" como completada`}
                    isSelected={actividad.estado === 'COMPLETADA'}
                    onChange={(isCompletada) => {
                      actualizarActividad.mutate({
                        id: actividad.id,
                        input: { estado: isCompletada ? ESTADO_ACTIVIDAD.COMPLETADA : ESTADO_ACTIVIDAD.PENDIENTE },
                      });
                    }}
                  >
                    <Checkbox.Content>
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                    </Checkbox.Content>
                  </Checkbox>
                  <div className="flex flex-col gap-1">
                    <p
                      className={
                        actividad.estado === 'COMPLETADA'
                          ? 'text-sm text-muted line-through'
                          : 'text-sm text-foreground'
                      }
                    >
                      {actividad.descripcion}
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs text-muted">
                      <span>{ORIGEN_ACTIVIDAD_LABELS[actividad.origen]}</span>
                      {actividad.referencia ? <span>· {actividad.referencia}</span> : null}
                      {actividad.equipoId ? <span>· Equipo {actividad.equipoId}</span> : null}
                      {actividad.hallazgoId ? <span>· Hallazgo {actividad.hallazgoId}</span> : null}
                      {actividad.asignadoA ? <span>· Asignado a {actividad.asignadoA.nombre}</span> : null}
                    </div>
                  </div>
                </div>
                <Chip color={estadoActividadChipColor(actividad.estado)} size="sm" variant="soft">
                  {ESTADO_ACTIVIDAD_LABELS[actividad.estado]}
                </Chip>
              </Card.Content>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
