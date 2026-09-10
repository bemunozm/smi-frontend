import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import {
  AlertDialog,
  Button,
  Chip,
  FieldError,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  Spinner,
  Switch,
  Table,
  TextField,
} from '@heroui/react';

import { useCurrentUser } from '../hooks/useCurrentUser';
import { useInsumos } from '../hooks/useInventario';
import {
  useCreateCompatibilidad,
  useDeleteCompatibilidad,
  useOrigenesReplicables,
  useReplicarCompatibilidades,
  useRepuestosDeEquipo,
} from '../hooks/useCompatibilidad';
import { useSucursales } from '../hooks/useSucursales';
import { unidadSimbolo } from '../config/flota-colors';
import { ROLES } from '../types/roles';
import { sucursalPorDefecto } from '../types/sucursal';
import {
  DISPONIBILIDAD_COLORS,
  DISPONIBILIDAD_LABELS,
  disponibilidad as calcularDisponibilidad,
} from '../types/disponibilidad';
import {
  CompatibilidadFormSchema,
  toCompatibilidadPayload,
  type CompatibilidadFormValues,
  type RepuestoCompatible,
} from '../types/compatibilidad';

const NUMERO = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 });

// --- Declarar una compatibilidad ------------------------------------------

function DeclararModal({ equipoId }: { equipoId: string }) {
  const crear = useCreateCompatibilidad();
  // La lista completa del maestro: un suministro también puede declararse
  // compatible, así que no se filtra por tipo en la consulta.
  const { data: insumos } = useInsumos();
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CompatibilidadFormValues>({
    resolver: zodResolver(CompatibilidadFormSchema),
    defaultValues: { insumoId: '', nota: '' },
  });

  return (
    <Modal>
      <Button>Declarar repuesto</Button>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-lg">
            {({ close }) => {
              const onSubmit = (values: CompatibilidadFormValues): void => {
                crear.mutate(toCompatibilidadPayload(equipoId, values), {
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
                      Declarar repuesto compatible
                    </Modal.Heading>
                  </Modal.Header>
                  <Modal.Body>
                    <form
                      className="flex flex-col gap-4"
                      id="declarar-compatibilidad-form"
                      noValidate
                      onSubmit={(event) => void handleSubmit(onSubmit)(event)}
                    >
                      <Controller
                        control={control}
                        name="insumoId"
                        render={({ field }) => (
                          <Select
                            fullWidth
                            isInvalid={!!errors.insumoId}
                            name={field.name}
                            value={field.value}
                            onChange={(value) => {
                              if (value) field.onChange(value);
                            }}
                          >
                            <Label>Repuesto o suministro</Label>
                            <Select.Trigger>
                              <Select.Value />
                              <Select.Indicator />
                            </Select.Trigger>
                            <Select.Popover>
                              <ListBox>
                                {(insumos ?? []).map((insumo) => (
                                  <ListBox.Item
                                    key={insumo.id}
                                    id={insumo.id}
                                    textValue={`${insumo.codigo} · ${insumo.nombre}`}
                                  >
                                    {insumo.codigo} · {insumo.nombre}
                                    <ListBox.ItemIndicator />
                                  </ListBox.Item>
                                ))}
                              </ListBox>
                            </Select.Popover>
                            {errors.insumoId ? (
                              <FieldError>{errors.insumoId.message}</FieldError>
                            ) : null}
                          </Select>
                        )}
                      />

                      <Controller
                        control={control}
                        name="nota"
                        render={({ field }) => (
                          <TextField
                            fullWidth
                            isInvalid={!!errors.nota}
                            name={field.name}
                            onBlur={field.onBlur}
                            onChange={field.onChange}
                            value={field.value}
                          >
                            <Label>Salvedad (opcional)</Label>
                            <Input placeholder="Solo desde nº serie 4500" />
                            {errors.nota ? (
                              <FieldError>{errors.nota.message}</FieldError>
                            ) : null}
                          </TextField>
                        )}
                      />

                      <p className="text-xs text-muted-foreground">
                        La salvedad es lo que hoy vive en la cabeza del mecánico:
                        cuándo sirve y con qué condición.
                      </p>
                    </form>
                  </Modal.Body>
                  <Modal.Footer>
                    <Button variant="secondary" onPress={close}>
                      Cancelar
                    </Button>
                    <Button
                      form="declarar-compatibilidad-form"
                      isPending={crear.isPending}
                      type="submit"
                    >
                      {({ isPending }) =>
                        isPending ? (
                          <Spinner color="current" size="sm" />
                        ) : (
                          'Declarar'
                        )
                      }
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

// --- Quitar ----------------------------------------------------------------

function QuitarDialog({
  repuesto,
  isOpen,
  onOpenChange,
}: {
  repuesto: RepuestoCompatible;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const quitar = useDeleteCompatibilidad();

  return (
    <AlertDialog.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <AlertDialog.Container>
        <AlertDialog.Dialog className="sm:max-w-105">
          {({ close }) => (
            <>
              <AlertDialog.Header>
                <AlertDialog.Heading className="font-display text-lg font-semibold">
                  Quitar {repuesto.codigo}
                </AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                <p className="text-sm text-muted-foreground">
                  Dejará de aparecer como compatible con este equipo. No afecta
                  al stock ni al historial de consumo.
                </p>
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button variant="tertiary" onPress={close}>
                  Cancelar
                </Button>
                <Button
                  variant="danger"
                  isPending={quitar.isPending}
                  onPress={() =>
                    quitar.mutate(repuesto.compatibilidadId, {
                      onSuccess: () => close(),
                    })
                  }
                >
                  {({ isPending }) =>
                    isPending ? <Spinner color="current" size="sm" /> : 'Quitar'
                  }
                </Button>
              </AlertDialog.Footer>
            </>
          )}
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}

// --- Fila ------------------------------------------------------------------

function FilaRepuesto({
  repuesto,
  puedeEditar,
}: {
  repuesto: RepuestoCompatible;
  puedeEditar: boolean;
}) {
  const [confirmar, setConfirmar] = useState(false);
  const disponibilidad = calcularDisponibilidad(
    repuesto.stockSucursal,
    repuesto.stockTotal,
  );

  return (
    <>
      <Table.Row>
        <Table.Cell>
          <Link
            className="font-mono text-sm font-medium text-(--accent) hover:underline"
            to={`/inventario/${repuesto.insumoId}`}
          >
            {repuesto.codigo}
          </Link>
        </Table.Cell>
        <Table.Cell>
          <div className="flex flex-col">
            <span>{repuesto.nombre}</span>
            {repuesto.nota ? (
              <span className="text-xs text-muted-foreground">
                {repuesto.nota}
              </span>
            ) : null}
          </div>
        </Table.Cell>
        <Table.Cell className="font-mono text-sm">
          {NUMERO.format(repuesto.stockSucursal)}{' '}
          {unidadSimbolo(repuesto.unidad)}
        </Table.Cell>
        <Table.Cell className="font-mono text-sm text-muted-foreground">
          {NUMERO.format(repuesto.stockTotal)}
        </Table.Cell>
        <Table.Cell>
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip
              color={DISPONIBILIDAD_COLORS[disponibilidad]}
              size="sm"
              variant="soft"
            >
              {DISPONIBILIDAD_LABELS[disponibilidad]}
            </Chip>
            {/* Tener poco no es lo mismo que no tener: la alerta de reposición
                va aparte del estado de disponibilidad. */}
            {disponibilidad === 'en-bodega' && repuesto.bajoMinimo ? (
              <Chip color="warning" size="sm" variant="soft">
                Bajo mínimo
              </Chip>
            ) : null}
          </div>
        </Table.Cell>
        <Table.Cell>
          <div className="flex justify-end">
            {puedeEditar ? (
              <button
                className="text-sm text-danger hover:underline"
                type="button"
                onClick={() => setConfirmar(true)}
              >
                Quitar
              </button>
            ) : null}
          </div>
        </Table.Cell>
      </Table.Row>

      {confirmar ? (
        <QuitarDialog
          isOpen={confirmar}
          repuesto={repuesto}
          onOpenChange={setConfirmar}
        />
      ) : null}
    </>
  );
}

// --- Vista -----------------------------------------------------------------

export function RepuestosEquipoView() {
  const { id = '' } = useParams<{ id: string }>();
  const { user } = useCurrentUser();
  const puedeEditar =
    user?.role === ROLES.ADMIN || user?.role === ROLES.MANTENEDOR;

  const [sucursalId, setSucursalId] = useState('');
  const [soloConStock, setSoloConStock] = useState(false);

  const { data: sucursales } = useSucursales({ activa: true });

  useEffect(() => {
    if (sucursalId || !sucursales) return;
    const inicial = sucursalPorDefecto(sucursales);
    if (inicial) setSucursalId(inicial.id);
  }, [sucursales, sucursalId]);

  const { data, isPending, isError, error } = useRepuestosDeEquipo(id, {
    ...(sucursalId ? { sucursalId } : {}),
    ...(soloConStock ? { soloConStock: true } : {}),
  });

  const sinCompatibilidades = data?.repuestos.length === 0 && !soloConStock;

  // El atajo de replicación solo se busca cuando hace falta: si el equipo ya
  // tiene repuestos declarados, la consulta sería trabajo desperdiciado.
  const { data: origenes } = useOrigenesReplicables(
    id,
    Boolean(sinCompatibilidades && puedeEditar),
  );
  const replicar = useReplicarCompatibilidades();
  const origen = origenes?.[0];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium tracking-[0.14em] text-(--eyebrow-color) uppercase">
            SMI · Flota
          </span>
          <h1 className="font-display text-[28px] font-semibold tracking-[-0.03em] text-foreground">
            Repuestos compatibles
          </h1>
          {data ? (
            <p className="text-sm text-(--muted)">
              {data.equipo.codigo} · {data.equipo.marca} {data.equipo.modelo} (
              {data.equipo.tipo})
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            className="text-sm text-(--accent) hover:underline"
            to={`/equipos/${id}`}
          >
            Volver al equipo
          </Link>
          {puedeEditar ? <DeclararModal equipoId={id} /> : null}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <Select
          className="w-full sm:w-56"
          value={sucursalId}
          onChange={(value) => {
            if (value) setSucursalId(String(value));
          }}
        >
          <Label>Stock en</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {(sucursales ?? []).map((sucursal) => (
                <ListBox.Item
                  key={sucursal.id}
                  id={sucursal.id}
                  textValue={sucursal.nombre}
                >
                  {sucursal.nombre}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>

        <Switch
          className="pb-2.5"
          isSelected={soloConStock}
          onChange={setSoloConStock}
        >
          Solo los que tengo acá
        </Switch>
      </div>

      {isPending ? (
        <div className="flex justify-center py-16">
          <Spinner color="accent" size="lg" />
        </div>
      ) : null}

      {isError ? (
        <div className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger-soft-foreground">
          {error instanceof Error
            ? error.message
            : 'No se pudieron obtener los repuestos compatibles.'}
        </div>
      ) : null}

      {/* El punto débil del modelo elegido (RFC-12 §4) es que un equipo nuevo no
          hereda las compatibilidades de sus gemelos. Se cierra acá, en el
          momento exacto en que se nota: al abrir la pantalla y verla vacía. */}
      {sinCompatibilidades && origen ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted px-4 py-3">
          <p className="text-sm text-foreground">
            {origen.codigo} es del mismo modelo y tiene {origen.cantidad}{' '}
            repuesto(s) declarados. ¿Copiarlos a este equipo?
          </p>
          <Button
            isPending={replicar.isPending}
            size="sm"
            variant="secondary"
            onPress={() =>
              replicar.mutate({ equipoId: id, origenId: origen.equipoId })
            }
          >
            {({ isPending }) =>
              isPending ? (
                <Spinner color="current" size="sm" />
              ) : (
                `Copiar de ${origen.codigo}`
              )
            }
          </Button>
        </div>
      ) : null}

      {data && data.repuestos.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-sm font-medium text-foreground">
            {soloConStock
              ? 'Ningún compatible tiene stock en esta bodega'
              : 'Este equipo todavía no tiene repuestos declarados'}
          </p>
          <p className="text-sm text-(--muted)">
            {soloConStock
              ? 'Quita el filtro para ver los que hay en otras sucursales.'
              : 'Declara el primero para que el taller no tenga que adivinar.'}
          </p>
        </div>
      ) : null}

      {data && data.repuestos.length > 0 ? (
        <Table variant="secondary">
          <Table.ScrollContainer>
            <Table.Content
              aria-label="Repuestos compatibles"
              className="min-w-200"
            >
              <Table.Header>
                <Table.Column isRowHeader>Código</Table.Column>
                <Table.Column>Repuesto</Table.Column>
                <Table.Column>Stock acá</Table.Column>
                <Table.Column>Total empresa</Table.Column>
                <Table.Column>Disponibilidad</Table.Column>
                <Table.Column>Acciones</Table.Column>
              </Table.Header>
              <Table.Body>
                {data.repuestos.map((repuesto) => (
                  <FilaRepuesto
                    key={repuesto.compatibilidadId}
                    puedeEditar={puedeEditar}
                    repuesto={repuesto}
                  />
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      ) : null}
    </div>
  );
}
