import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import {
  Button,
  Card,
  FieldError,
  Input,
  Label,
  Modal,
  NumberField,
  Spinner,
  Table,
  TextField,
} from '@heroui/react';

import { useCurrentUser } from '../hooks/useCurrentUser';
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
 * Sub-vista "Preventivo" del dominio Mantenimiento: lista los umbrales reales
 * (horas por tipo de equipo/mantención) desde `useUmbrales`. El avance real
 * por equipo (horómetro actual vs. umbral) depende del dominio Flota, que
 * todavía no expone un endpoint — se muestra una nota explícita en vez de
 * inventar porcentajes u horas.
 */
export function PreventivoView() {
  const { role } = useCurrentUser();
  const { data: umbrales, isPending, isError, error } = useUmbrales();

  const puedeCrear = role === ROLES.ADMIN;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-xl font-semibold tracking-[-0.02em] text-foreground">
            Umbrales por horómetro
          </h2>
          <p className="text-sm text-muted">Motor preventivo: define cada cuántas horas corresponde una mantención.</p>
        </div>
        {puedeCrear ? <CreateUmbralModal /> : null}
      </div>

      <Card>
        <Card.Content>
          <p className="text-sm text-foreground">
            El avance por equipo (horómetro actual vs. umbral configurado) depende del dominio
            Flota, que todavía no expone un endpoint de horómetros —{' '}
            <span className="font-semibold">pendiente de integración con Flota</span>. Por ahora
            esta pestaña solo administra los umbrales configurados.
          </p>
        </Card.Content>
      </Card>

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
          <p className="text-sm text-muted">Crea el primero con el botón "Crear umbral".</p>
        </div>
      ) : null}

      {!isPending && !isError && umbrales && umbrales.length > 0 ? (
        <Table variant="secondary">
          <Table.ScrollContainer>
            <Table.Content aria-label="Umbrales preventivos" className="min-w-140">
              <Table.Header>
                <Table.Column isRowHeader>Tipo de equipo</Table.Column>
                <Table.Column>Tipo de mantención</Table.Column>
                <Table.Column>Umbral (horas)</Table.Column>
                <Table.Column>Avance por equipo</Table.Column>
              </Table.Header>
              <Table.Body>
                <Table.Collection items={umbrales}>
                  {(umbral) => (
                    <Table.Row>
                      <Table.Cell>{umbral.tipoEquipo}</Table.Cell>
                      <Table.Cell>{umbral.tipoMantencion}</Table.Cell>
                      <Table.Cell className="font-mono">{umbral.umbralHoras} h</Table.Cell>
                      <Table.Cell className="text-muted">Pendiente de integración con Flota</Table.Cell>
                    </Table.Row>
                  )}
                </Table.Collection>
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      ) : null}
    </div>
  );
}
