import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import {
  Button,
  Card,
  Chip,
  FieldError,
  Input,
  Label,
  Modal,
  NumberField,
  Spinner,
  TextField,
} from '@heroui/react';

import { useCurrentUser } from '../hooks/useCurrentUser';
import { useMantencionesProximas } from '../hooks/useDashboard';
import { useCrearUmbral, useUmbrales } from '../hooks/useUmbrales';
import { ROLES } from '../types/roles';
import { CreateUmbralSchema, type CreateUmbralInput } from '../types/mantenimiento';

/** Modal de creación de umbral (ADMIN) — mismo patrón que `CreateUserModal`. */
function CreateUmbralModal() {
  const crearUmbral = useCrearUmbral();
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateUmbralInput>({
    resolver: zodResolver(CreateUmbralSchema),
    defaultValues: { tipoEquipo: '', tipoMantencion: '', umbralHoras: 250 },
  });

  return (
    <Modal>
      <Button>Crear umbral</Button>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-md">
            {({ close }) => {
              const onSubmit = (values: CreateUmbralInput): void => {
                crearUmbral.mutate(values, {
                  onSuccess: () => {
                    reset();
                    close();
                  },
                });
              };

              return (
                <>
                  <Modal.CloseTrigger />
                  <Modal.Header>
                    <Modal.Heading className="font-display text-xl font-semibold tracking-[-0.02em]">
                      Nuevo umbral preventivo
                    </Modal.Heading>
                  </Modal.Header>
                  <Modal.Body>
                    <form
                      className="flex flex-col gap-4"
                      id="create-umbral-form"
                      noValidate
                      onSubmit={(e) => void handleSubmit(onSubmit)(e)}
                    >
                      <Controller
                        control={control}
                        name="tipoEquipo"
                        render={({ field }) => (
                          <TextField
                            fullWidth
                            isInvalid={!!errors.tipoEquipo}
                            name={field.name}
                            onBlur={field.onBlur}
                            onChange={field.onChange}
                            value={field.value}
                          >
                            <Label>Tipo de equipo</Label>
                            <Input autoFocus placeholder="Ej. Excavadora" />
                            {errors.tipoEquipo ? <FieldError>{errors.tipoEquipo.message}</FieldError> : null}
                          </TextField>
                        )}
                      />

                      <Controller
                        control={control}
                        name="tipoMantencion"
                        render={({ field }) => (
                          <TextField
                            fullWidth
                            isInvalid={!!errors.tipoMantencion}
                            name={field.name}
                            onBlur={field.onBlur}
                            onChange={field.onChange}
                            value={field.value}
                          >
                            <Label>Tipo de mantención</Label>
                            <Input placeholder="Ej. Mantención 250 h" />
                            {errors.tipoMantencion ? (
                              <FieldError>{errors.tipoMantencion.message}</FieldError>
                            ) : null}
                          </TextField>
                        )}
                      />

                      <Controller
                        control={control}
                        name="umbralHoras"
                        render={({ field }) => (
                          <NumberField fullWidth minValue={1} value={field.value} onChange={field.onChange}>
                            <Label>Umbral (horas)</Label>
                            <NumberField.Group>
                              <NumberField.DecrementButton />
                              <NumberField.Input onBlur={field.onBlur} />
                              <NumberField.IncrementButton />
                            </NumberField.Group>
                            {errors.umbralHoras ? <FieldError>{errors.umbralHoras.message}</FieldError> : null}
                          </NumberField>
                        )}
                      />
                    </form>
                  </Modal.Body>
                  <Modal.Footer>
                    <Button variant="secondary" onPress={close}>
                      Cancelar
                    </Button>
                    <Button form="create-umbral-form" isPending={crearUmbral.isPending} type="submit">
                      {({ isPending }) => (isPending ? <Spinner color="current" size="sm" /> : 'Crear umbral')}
                    </Button>
                  </Modal.Footer>
                </>
              );
            }}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

/**
 * Equipos cerca de su umbral de horómetro (horómetro actual vs. umbral). Es un
 * dato del dominio Mantenimiento: se reutiliza `useMantencionesProximas` (mismo
 * hook/tipo/estilo que el Dashboard de Benjamín) — hoy mockeado hasta que Flota
 * exponga el horómetro real. `horometroRestante === 0` ⇒ umbral alcanzado (rojo).
 */
function EquiposCercaUmbralSection() {
  const { data: mantenciones, isPending, isError, error } = useMantencionesProximas();

  return (
    <Card className="flex flex-col gap-3">
      <Card.Header>
        <Card.Title>Equipos cerca de su umbral</Card.Title>
        <Card.Description className="text-muted-foreground">
          Horómetro restante hasta la próxima mantención. En rojo, los que ya alcanzaron el umbral.
        </Card.Description>
      </Card.Header>

      {isPending ? (
        <div className="flex justify-center py-8">
          <Spinner color="accent" size="sm" />
        </div>
      ) : null}

      {isError ? (
        <p className="px-1 text-sm text-danger-soft-foreground" role="alert">
          {error instanceof Error ? error.message : 'No se pudo cargar los equipos cerca del umbral.'}
        </p>
      ) : null}

      {!isPending && !isError && mantenciones.length > 0 ? (
        <ul className="flex flex-col">
          {mantenciones.map((mantencion) => (
            <li
              key={mantencion.id}
              className="flex items-center justify-between gap-3 border-t border-border py-3 first:border-t-0"
            >
              <div className="flex min-w-0 flex-col">
                <span className="font-mono text-sm font-semibold text-foreground">{mantencion.equipo}</span>
                <span className="text-xs text-muted-foreground">
                  {mantencion.tipo === 'PREVENTIVA' ? 'Preventiva' : 'Correctiva'}
                </span>
              </div>
              {mantencion.horometroRestante > 0 ? (
                <span className="font-mono text-sm font-semibold text-foreground">
                  {mantencion.horometroRestante} h
                </span>
              ) : (
                <Chip color="danger" size="sm" variant="soft">
                  Umbral alcanzado
                </Chip>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {!isPending && !isError && mantenciones.length === 0 ? (
        <p className="px-1 text-sm text-muted-foreground">No hay equipos cerca de su umbral.</p>
      ) : null}
    </Card>
  );
}

/**
 * Sub-vista "Preventivo" del dominio Mantenimiento. Dos bloques:
 *  1. Equipos cerca de su umbral (horómetro restante, rojo si ya lo alcanzaron).
 *  2. Umbrales configurados (horas por tipo de equipo/mantención) — CRUD real
 *     vía `useUmbrales` / `useCrearUmbral`, renderizados como grid de cards.
 */
export function PreventivoView() {
  const { role } = useCurrentUser();
  const { data: umbrales, isPending, isError, error } = useUmbrales();

  const puedeCrear = role === ROLES.ADMIN;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-xl font-semibold tracking-[-0.02em] text-foreground">
            Umbrales por horómetro
          </h2>
          <p className="text-sm text-muted-foreground">
            Motor preventivo: define cada cuántas horas corresponde una mantención.
          </p>
        </div>
        {puedeCrear ? <CreateUmbralModal /> : null}
      </div>

      <EquiposCercaUmbralSection />

      <div className="flex flex-col gap-3">
        <h3 className="font-display text-base font-semibold text-foreground">Umbrales configurados</h3>

        {isPending ? (
          <div className="flex justify-center py-16">
            <Spinner color="accent" size="lg" />
          </div>
        ) : null}

        {isError ? (
          <div className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger-soft-foreground" role="alert">
            {error instanceof Error ? error.message : 'No se pudo cargar la lista de umbrales.'}
          </div>
        ) : null}

        {!isPending && !isError && umbrales && umbrales.length === 0 ? (
          <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-border py-16 text-center">
            <p className="text-sm font-medium text-foreground">Todavía no hay umbrales configurados</p>
            <p className="text-sm text-muted-foreground">Crea el primero con el botón "Crear umbral".</p>
          </div>
        ) : null}

        {!isPending && !isError && umbrales && umbrales.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {umbrales.map((umbral) => (
              <Card key={umbral.id}>
                <Card.Header>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <Card.Title className="font-display text-base font-semibold text-foreground">
                        {umbral.tipoEquipo}
                      </Card.Title>
                      <Card.Description className="text-sm text-muted-foreground">
                        {umbral.tipoMantencion}
                      </Card.Description>
                    </div>
                    <Chip color="accent" size="sm" variant="soft">
                      {umbral.umbralHoras} h
                    </Chip>
                  </div>
                </Card.Header>
              </Card>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
