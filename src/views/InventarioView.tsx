import { useState } from 'react';
import { Link } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import {
  AlertDialog,
  Button,
  Chip,
  Dropdown,
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
import { useEquipos } from '../hooks/useEquipos';
import {
  useAjustarStock,
  useCreateInsumo,
  useCreateMovimiento,
  useDeleteInsumo,
  useInsumos,
  useResumenInventario,
  useUpdateInsumo,
} from '../hooks/useInventario';
import { UNIDAD_LABELS, unidadSimbolo } from '../config/flota-colors';
import { ROLES } from '../types/roles';
import {
  AjusteFormSchema,
  estaBajoMinimo,
  InsumoFormSchema,
  ORIGENES_MOVIMIENTO,
  toInsumoPayload,
  toMovimientoPayload,
  MovimientoFormSchema,
  TIPOS_MOVIMIENTO,
  UNIDADES_INSUMO,
  type AjusteFormValues,
  type Insumo,
  type InsumoFormValues,
  type MovimientoFormValues,
} from '../types/inventario';

const NUMERO = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 });

const UNIDAD_OPTIONS = UNIDADES_INSUMO.map((unidad) => ({
  value: unidad,
  label: UNIDAD_LABELS[unidad],
}));

const ORIGEN_LABELS: Record<(typeof ORIGENES_MOVIMIENTO)[number], string> = {
  COMPRA: 'Compra / reposición',
  DEVOLUCION: 'Devolución a bodega',
  AJUSTE_FISICO: 'Ajuste por conteo físico',
  INTERVENCION: 'Consumo en mantención',
  ACTIVIDAD: 'Consumo en actividad',
  TRABAJO_EXTRAORDINARIO: 'Consumo en trabajo extraordinario',
};

function KebabIcon() {
  return (
    <svg aria-hidden="true" fill="currentColor" height="15" viewBox="0 0 24 24" width="15">
      <circle cx="12" cy="5" r="1.9" />
      <circle cx="12" cy="12" r="1.9" />
      <circle cx="12" cy="19" r="1.9" />
    </svg>
  );
}

// --- Alta de insumo --------------------------------------------------------

const DEFAULT_INSUMO: InsumoFormValues = {
  codigo: '',
  nombre: '',
  descripcion: '',
  unidad: 'UNIDAD',
  stock: '0',
  stockMinimo: '0',
};

function CreateInsumoModal() {
  const createInsumo = useCreateInsumo();
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InsumoFormValues>({
    resolver: zodResolver(InsumoFormSchema),
    defaultValues: DEFAULT_INSUMO,
  });

  return (
    <Modal>
      <Button>Nuevo insumo</Button>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-lg">
            {({ close }) => {
              const onSubmit = (values: InsumoFormValues): void => {
                createInsumo.mutate(toInsumoPayload(values), {
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
                      Nuevo insumo
                    </Modal.Heading>
                  </Modal.Header>
                  <Modal.Body>
                    <form
                      className="flex flex-col gap-4"
                      id="create-insumo-form"
                      noValidate
                      onSubmit={(e) => void handleSubmit(onSubmit)(e)}
                    >
                      <Controller
                        control={control}
                        name="codigo"
                        render={({ field }) => (
                          <TextField
                            fullWidth
                            isInvalid={!!errors.codigo}
                            name={field.name}
                            onBlur={field.onBlur}
                            onChange={field.onChange}
                            value={field.value}
                          >
                            <Label>Código</Label>
                            <Input autoFocus placeholder="FIL-001" />
                            {errors.codigo ? <FieldError>{errors.codigo.message}</FieldError> : null}
                          </TextField>
                        )}
                      />

                      <Controller
                        control={control}
                        name="nombre"
                        render={({ field }) => (
                          <TextField
                            fullWidth
                            isInvalid={!!errors.nombre}
                            name={field.name}
                            onBlur={field.onBlur}
                            onChange={field.onChange}
                            value={field.value}
                          >
                            <Label>Nombre</Label>
                            <Input placeholder="Filtro de aceite motor" />
                            {errors.nombre ? <FieldError>{errors.nombre.message}</FieldError> : null}
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
                            <Label>Descripción (opcional)</Label>
                            <Input placeholder="Compatible con motores serie C" />
                            {errors.descripcion ? (
                              <FieldError>{errors.descripcion.message}</FieldError>
                            ) : null}
                          </TextField>
                        )}
                      />

                      <Controller
                        control={control}
                        name="unidad"
                        render={({ field }) => (
                          <Select
                            fullWidth
                            isInvalid={!!errors.unidad}
                            name={field.name}
                            value={field.value}
                            onChange={(value) => {
                              if (value) field.onChange(value);
                            }}
                          >
                            <Label>Unidad de medida</Label>
                            <Select.Trigger>
                              <Select.Value />
                              <Select.Indicator />
                            </Select.Trigger>
                            <Select.Popover>
                              <ListBox>
                                {UNIDAD_OPTIONS.map((option) => (
                                  <ListBox.Item
                                    key={option.value}
                                    id={option.value}
                                    textValue={option.label}
                                  >
                                    {option.label}
                                    <ListBox.ItemIndicator />
                                  </ListBox.Item>
                                ))}
                              </ListBox>
                            </Select.Popover>
                            {errors.unidad ? <FieldError>{errors.unidad.message}</FieldError> : null}
                          </Select>
                        )}
                      />

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Controller
                          control={control}
                          name="stock"
                          render={({ field }) => (
                            <TextField
                              fullWidth
                              isInvalid={!!errors.stock}
                              name={field.name}
                              onBlur={field.onBlur}
                              onChange={field.onChange}
                              value={field.value}
                            >
                              <Label>Stock inicial</Label>
                              <Input inputMode="decimal" placeholder="0" />
                              {errors.stock ? <FieldError>{errors.stock.message}</FieldError> : null}
                            </TextField>
                          )}
                        />

                        <Controller
                          control={control}
                          name="stockMinimo"
                          render={({ field }) => (
                            <TextField
                              fullWidth
                              isInvalid={!!errors.stockMinimo}
                              name={field.name}
                              onBlur={field.onBlur}
                              onChange={field.onChange}
                              value={field.value}
                            >
                              <Label>Stock mínimo</Label>
                              <Input inputMode="decimal" placeholder="0" />
                              {errors.stockMinimo ? (
                                <FieldError>{errors.stockMinimo.message}</FieldError>
                              ) : null}
                            </TextField>
                          )}
                        />
                      </div>

                      <p className="text-xs text-(--muted)">
                        El stock inicial queda registrado como una entrada por compra: el kardex
                        parte explicando de dónde salió el saldo.
                      </p>
                    </form>
                  </Modal.Body>
                  <Modal.Footer>
                    <Button variant="secondary" onPress={close}>
                      Cancelar
                    </Button>
                    <Button form="create-insumo-form" isPending={createInsumo.isPending} type="submit">
                      {({ isPending }) =>
                        isPending ? <Spinner color="current" size="sm" /> : 'Crear insumo'
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

// --- Movimiento manual -----------------------------------------------------

const SIN_EQUIPO = '__sin_equipo__';

/**
 * Entrada o salida manual de bodega. El select de equipo es opcional: solo
 * aplica cuando el material se imputa a una unidad concreta.
 */
function CreateMovimientoModal({ insumos }: { insumos: Insumo[] }) {
  const createMovimiento = useCreateMovimiento();
  const { data: equipos } = useEquipos();
  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<MovimientoFormValues>({
    resolver: zodResolver(MovimientoFormSchema),
    defaultValues: {
      insumoId: '',
      tipo: 'SALIDA',
      origen: 'INTERVENCION',
      cantidad: '',
      equipoId: '',
      observacion: '',
    },
  });

  const insumoId = watch('insumoId');
  const seleccionado = insumos.find((insumo) => insumo.id === insumoId);

  return (
    <Modal>
      <Button variant="secondary">Registrar movimiento</Button>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-lg">
            {({ close }) => {
              const onSubmit = (values: MovimientoFormValues): void => {
                createMovimiento.mutate(toMovimientoPayload(values), {
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
                      Registrar movimiento
                    </Modal.Heading>
                  </Modal.Header>
                  <Modal.Body>
                    <form
                      className="flex flex-col gap-4"
                      id="create-movimiento-form"
                      noValidate
                      onSubmit={(e) => void handleSubmit(onSubmit)(e)}
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
                            <Label>Insumo</Label>
                            <Select.Trigger>
                              <Select.Value />
                              <Select.Indicator />
                            </Select.Trigger>
                            <Select.Popover>
                              <ListBox>
                                {insumos.map((insumo) => (
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

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Controller
                          control={control}
                          name="tipo"
                          render={({ field }) => (
                            <Select
                              fullWidth
                              name={field.name}
                              value={field.value}
                              onChange={(value) => {
                                if (value) field.onChange(value);
                              }}
                            >
                              <Label>Tipo</Label>
                              <Select.Trigger>
                                <Select.Value />
                                <Select.Indicator />
                              </Select.Trigger>
                              <Select.Popover>
                                <ListBox>
                                  {TIPOS_MOVIMIENTO.map((tipo) => (
                                    <ListBox.Item key={tipo} id={tipo} textValue={tipo}>
                                      {tipo === 'ENTRADA' ? 'Entrada (suma)' : 'Salida (resta)'}
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
                          name="cantidad"
                          render={({ field }) => (
                            <TextField
                              fullWidth
                              isInvalid={!!errors.cantidad}
                              name={field.name}
                              onBlur={field.onBlur}
                              onChange={field.onChange}
                              value={field.value}
                            >
                              <Label>
                                Cantidad
                                {seleccionado
                                  ? ` (${unidadSimbolo(seleccionado.unidad)}) · stock ${NUMERO.format(seleccionado.stock)}`
                                  : ''}
                              </Label>
                              <Input inputMode="decimal" placeholder="0" />
                              {errors.cantidad ? (
                                <FieldError>{errors.cantidad.message}</FieldError>
                              ) : null}
                            </TextField>
                          )}
                        />
                      </div>

                      <Controller
                        control={control}
                        name="origen"
                        render={({ field }) => (
                          <Select
                            fullWidth
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
                                {ORIGENES_MOVIMIENTO.map((origen) => (
                                  <ListBox.Item
                                    key={origen}
                                    id={origen}
                                    textValue={ORIGEN_LABELS[origen]}
                                  >
                                    {ORIGEN_LABELS[origen]}
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
                        name="equipoId"
                        render={({ field }) => (
                          <Select
                            fullWidth
                            name={field.name}
                            value={field.value || SIN_EQUIPO}
                            onChange={(value) => {
                              field.onChange(value === SIN_EQUIPO ? '' : String(value ?? ''));
                            }}
                          >
                            <Label>Equipo (opcional)</Label>
                            <Select.Trigger>
                              <Select.Value />
                              <Select.Indicator />
                            </Select.Trigger>
                            <Select.Popover>
                              <ListBox>
                                <ListBox.Item id={SIN_EQUIPO} textValue="Sin equipo asociado">
                                  Sin equipo asociado
                                  <ListBox.ItemIndicator />
                                </ListBox.Item>
                                {(equipos ?? []).map((equipo) => (
                                  <ListBox.Item
                                    key={equipo.id}
                                    id={equipo.id}
                                    textValue={`${equipo.codigo} · ${equipo.tipo}`}
                                  >
                                    {equipo.codigo} · {equipo.tipo}
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
                        name="observacion"
                        render={({ field }) => (
                          <TextField
                            fullWidth
                            isInvalid={!!errors.observacion}
                            name={field.name}
                            onBlur={field.onBlur}
                            onChange={field.onChange}
                            value={field.value}
                          >
                            <Label>Observación (opcional)</Label>
                            <Input placeholder="Cambio de aceite programado" />
                            {errors.observacion ? (
                              <FieldError>{errors.observacion.message}</FieldError>
                            ) : null}
                          </TextField>
                        )}
                      />
                    </form>
                  </Modal.Body>
                  <Modal.Footer>
                    <Button variant="secondary" onPress={close}>
                      Cancelar
                    </Button>
                    <Button
                      form="create-movimiento-form"
                      isPending={createMovimiento.isPending}
                      type="submit"
                    >
                      {({ isPending }) =>
                        isPending ? <Spinner color="current" size="sm" /> : 'Registrar'
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

// --- Acciones por fila -----------------------------------------------------

interface InsumoModalProps {
  insumo: Insumo;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

function EditInsumoModal({ insumo, isOpen, onOpenChange }: InsumoModalProps) {
  const updateInsumo = useUpdateInsumo();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<InsumoFormValues>({
    resolver: zodResolver(InsumoFormSchema),
    values: {
      codigo: insumo.codigo,
      nombre: insumo.nombre,
      descripcion: insumo.descripcion ?? '',
      unidad: insumo.unidad,
      stock: String(insumo.stock),
      stockMinimo: String(insumo.stockMinimo),
    },
  });

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-lg">
          {({ close }) => {
            const onSubmit = (values: InsumoFormValues): void => {
              const { codigo: _codigo, stock: _stock, ...input } = toInsumoPayload(values);
              updateInsumo.mutate({ id: insumo.id, input }, { onSuccess: () => close() });
            };

            return (
              <>
                <Modal.CloseTrigger />
                <Modal.Header>
                  <Modal.Heading className="font-display text-xl font-semibold tracking-[-0.02em]">
                    Editar {insumo.codigo}
                  </Modal.Heading>
                </Modal.Header>
                <Modal.Body>
                  <form
                    className="flex flex-col gap-4"
                    id={`edit-insumo-form-${insumo.id}`}
                    noValidate
                    onSubmit={(e) => void handleSubmit(onSubmit)(e)}
                  >
                    <Controller
                      control={control}
                      name="nombre"
                      render={({ field }) => (
                        <TextField
                          fullWidth
                          isInvalid={!!errors.nombre}
                          name={field.name}
                          onBlur={field.onBlur}
                          onChange={field.onChange}
                          value={field.value}
                        >
                          <Label>Nombre</Label>
                          <Input autoFocus />
                          {errors.nombre ? <FieldError>{errors.nombre.message}</FieldError> : null}
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
                          <Label>Descripción (opcional)</Label>
                          <Input />
                          {errors.descripcion ? (
                            <FieldError>{errors.descripcion.message}</FieldError>
                          ) : null}
                        </TextField>
                      )}
                    />

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Controller
                        control={control}
                        name="unidad"
                        render={({ field }) => (
                          <Select
                            fullWidth
                            name={field.name}
                            value={field.value}
                            onChange={(value) => {
                              if (value) field.onChange(value);
                            }}
                          >
                            <Label>Unidad</Label>
                            <Select.Trigger>
                              <Select.Value />
                              <Select.Indicator />
                            </Select.Trigger>
                            <Select.Popover>
                              <ListBox>
                                {UNIDAD_OPTIONS.map((option) => (
                                  <ListBox.Item
                                    key={option.value}
                                    id={option.value}
                                    textValue={option.label}
                                  >
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
                        name="stockMinimo"
                        render={({ field }) => (
                          <TextField
                            fullWidth
                            isInvalid={!!errors.stockMinimo}
                            name={field.name}
                            onBlur={field.onBlur}
                            onChange={field.onChange}
                            value={field.value}
                          >
                            <Label>Stock mínimo</Label>
                            <Input inputMode="decimal" />
                            {errors.stockMinimo ? (
                              <FieldError>{errors.stockMinimo.message}</FieldError>
                            ) : null}
                          </TextField>
                        )}
                      />
                    </div>

                    <p className="text-xs text-(--muted)">
                      El stock actual ({NUMERO.format(insumo.stock)}{' '}
                      {unidadSimbolo(insumo.unidad)}) no se edita acá: se mueve con movimientos de
                      inventario o con un ajuste por conteo físico.
                    </p>
                  </form>
                </Modal.Body>
                <Modal.Footer>
                  <Button variant="secondary" onPress={close}>
                    Cancelar
                  </Button>
                  <Button
                    form={`edit-insumo-form-${insumo.id}`}
                    isPending={updateInsumo.isPending}
                    type="submit"
                  >
                    {({ isPending }) =>
                      isPending ? <Spinner color="current" size="sm" /> : 'Guardar cambios'
                    }
                  </Button>
                </Modal.Footer>
              </>
            );
          }}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function AjusteModal({ insumo, isOpen, onOpenChange }: InsumoModalProps) {
  const ajustar = useAjustarStock();
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<AjusteFormValues>({
    resolver: zodResolver(AjusteFormSchema),
    values: { stockContado: String(insumo.stock), observacion: '' },
  });

  const contado = Number(watch('stockContado'));
  const diferencia = Number.isFinite(contado) ? contado - insumo.stock : 0;

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-md">
          {({ close }) => {
            const onSubmit = (values: AjusteFormValues): void => {
              ajustar.mutate(
                {
                  id: insumo.id,
                  input: {
                    stockContado: Number(values.stockContado),
                    ...(values.observacion.trim()
                      ? { observacion: values.observacion.trim() }
                      : {}),
                  },
                },
                { onSuccess: () => close() },
              );
            };

            return (
              <>
                <Modal.CloseTrigger />
                <Modal.Header>
                  <Modal.Heading className="font-display text-xl font-semibold tracking-[-0.02em]">
                    Conteo físico · {insumo.codigo}
                  </Modal.Heading>
                </Modal.Header>
                <Modal.Body>
                  <form
                    className="flex flex-col gap-4"
                    id={`ajuste-form-${insumo.id}`}
                    noValidate
                    onSubmit={(e) => void handleSubmit(onSubmit)(e)}
                  >
                    <p className="text-sm text-(--muted)">
                      El sistema tiene <strong>{NUMERO.format(insumo.stock)}</strong>{' '}
                      {unidadSimbolo(insumo.unidad)}. Ingresa lo que contaste en bodega y se
                      registrará la diferencia como movimiento.
                    </p>

                    <Controller
                      control={control}
                      name="stockContado"
                      render={({ field }) => (
                        <TextField
                          fullWidth
                          isInvalid={!!errors.stockContado}
                          name={field.name}
                          onBlur={field.onBlur}
                          onChange={field.onChange}
                          value={field.value}
                        >
                          <Label>Cantidad contada</Label>
                          <Input autoFocus inputMode="decimal" />
                          {errors.stockContado ? (
                            <FieldError>{errors.stockContado.message}</FieldError>
                          ) : null}
                        </TextField>
                      )}
                    />

                    {diferencia !== 0 ? (
                      <Chip color={diferencia > 0 ? 'success' : 'warning'} size="sm" variant="soft">
                        Diferencia: {diferencia > 0 ? '+' : ''}
                        {NUMERO.format(diferencia)} {unidadSimbolo(insumo.unidad)}
                      </Chip>
                    ) : (
                      <Chip size="sm" variant="soft">
                        Sin diferencia con el sistema
                      </Chip>
                    )}

                    <Controller
                      control={control}
                      name="observacion"
                      render={({ field }) => (
                        <TextField
                          fullWidth
                          isInvalid={!!errors.observacion}
                          name={field.name}
                          onBlur={field.onBlur}
                          onChange={field.onChange}
                          value={field.value}
                        >
                          <Label>Observación (opcional)</Label>
                          <Input placeholder="Conteo mensual de bodega" />
                          {errors.observacion ? (
                            <FieldError>{errors.observacion.message}</FieldError>
                          ) : null}
                        </TextField>
                      )}
                    />
                  </form>
                </Modal.Body>
                <Modal.Footer>
                  <Button variant="secondary" onPress={close}>
                    Cancelar
                  </Button>
                  <Button form={`ajuste-form-${insumo.id}`} isPending={ajustar.isPending} type="submit">
                    {({ isPending }) =>
                      isPending ? <Spinner color="current" size="sm" /> : 'Ajustar stock'
                    }
                  </Button>
                </Modal.Footer>
              </>
            );
          }}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function DeleteInsumoAlertDialog({ insumo, isOpen, onOpenChange }: InsumoModalProps) {
  const deleteInsumo = useDeleteInsumo();

  return (
    <AlertDialog.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <AlertDialog.Container>
        <AlertDialog.Dialog className="sm:max-w-105">
          {({ close }) => (
            <>
              <AlertDialog.CloseTrigger />
              <AlertDialog.Header>
                <AlertDialog.Icon status="danger" />
                <AlertDialog.Heading>¿Eliminar {insumo.nombre}?</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                <p>
                  Solo se pueden eliminar insumos sin movimientos registrados. Si ya tiene kardex,
                  el sistema rechazará la operación para no perder la trazabilidad.
                </p>
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button variant="tertiary" onPress={close}>
                  Cancelar
                </Button>
                <Button
                  isPending={deleteInsumo.isPending}
                  variant="danger"
                  onPress={() => {
                    deleteInsumo.mutate(insumo.id, { onSuccess: () => close() });
                  }}
                >
                  {deleteInsumo.isPending ? <Spinner color="current" size="sm" /> : 'Eliminar'}
                </Button>
              </AlertDialog.Footer>
            </>
          )}
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}

function InsumoActionsMenu({ insumo }: { insumo: Insumo }) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAjusteOpen, setIsAjusteOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  return (
    <>
      <Dropdown>
        <Button isIconOnly aria-label={`Acciones para ${insumo.nombre}`} size="sm" variant="secondary">
          <KebabIcon />
        </Button>
        <Dropdown.Popover placement="bottom end">
          <Dropdown.Menu
            onAction={(key) => {
              if (key === 'edit') setIsEditOpen(true);
              if (key === 'ajuste') setIsAjusteOpen(true);
              if (key === 'delete') setIsDeleteOpen(true);
            }}
          >
            <Dropdown.Item id="ajuste" textValue="Ajustar por conteo físico">
              <Label>Ajustar por conteo físico</Label>
            </Dropdown.Item>
            <Dropdown.Item id="edit" textValue="Editar ficha">
              <Label>Editar ficha</Label>
            </Dropdown.Item>
            <Dropdown.Item id="delete" textValue="Eliminar" variant="danger">
              <Label>Eliminar</Label>
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>

      <EditInsumoModal insumo={insumo} isOpen={isEditOpen} onOpenChange={setIsEditOpen} />
      <AjusteModal insumo={insumo} isOpen={isAjusteOpen} onOpenChange={setIsAjusteOpen} />
      <DeleteInsumoAlertDialog insumo={insumo} isOpen={isDeleteOpen} onOpenChange={setIsDeleteOpen} />
    </>
  );
}

// --- Vista -----------------------------------------------------------------

export function InventarioView() {
  const { user } = useCurrentUser();
  const [busqueda, setBusqueda] = useState('');
  const [soloBajoStock, setSoloBajoStock] = useState(false);

  const esAdmin = user?.role === ROLES.ADMIN;

  const { data: resumen } = useResumenInventario();
  const {
    data: insumos,
    isPending,
    isError,
    error,
  } = useInsumos({
    ...(busqueda.trim() ? { q: busqueda.trim() } : {}),
    ...(soloBajoStock ? { bajoStock: true } : {}),
  });

  // Los selects del modal de movimiento necesitan la lista completa, no la
  // filtrada por la pantalla.
  const { data: todosLosInsumos } = useInsumos();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium tracking-[0.14em] text-(--eyebrow-color) uppercase">
            SMI · Inventario
          </span>
          <h1 className="font-display text-[28px] font-semibold tracking-[-0.03em] text-foreground">
            Insumos y repuestos
          </h1>
          <p className="text-sm text-(--muted)">
            Stock de bodega con alerta de mínimos y trazabilidad de cada movimiento.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {todosLosInsumos && todosLosInsumos.length > 0 ? (
            <CreateMovimientoModal insumos={todosLosInsumos} />
          ) : null}
          {esAdmin ? <CreateInsumoModal /> : null}
        </div>
      </div>

      {resumen ? (
        <div className="flex flex-wrap items-center gap-2">
          <Chip size="sm" variant="secondary">
            {resumen.total} insumos
          </Chip>
          <Chip color={resumen.bajoMinimo > 0 ? 'danger' : 'success'} size="sm" variant="soft">
            {resumen.bajoMinimo} bajo el mínimo
          </Chip>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-4">
        <TextField
          className="w-full sm:w-64"
          aria-label="Buscar insumo"
          value={busqueda}
          onChange={setBusqueda}
        >
          <Label>Buscar</Label>
          <Input placeholder="Código o nombre" />
        </TextField>

        <Switch
          className="pb-2.5"
          isSelected={soloBajoStock}
          onChange={setSoloBajoStock}
        >
          Solo bajo mínimo
        </Switch>
      </div>

      {isPending ? (
        <div className="flex justify-center py-16">
          <Spinner color="accent" size="lg" />
        </div>
      ) : null}

      {isError ? (
        <div
          className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger-soft-foreground"
          role="alert"
        >
          {error instanceof Error ? error.message : 'No se pudo cargar el inventario.'}
        </div>
      ) : null}

      {!isPending && !isError && insumos.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-sm font-medium text-foreground">No hay insumos que coincidan</p>
          <p className="text-sm text-(--muted)">Ajusta los filtros o crea el primero.</p>
        </div>
      ) : null}

      {!isPending && !isError && insumos.length > 0 ? (
        <Table variant="secondary">
          <Table.ScrollContainer>
            <Table.Content aria-label="Insumos" className="min-w-200">
              <Table.Header>
                <Table.Column isRowHeader>Código</Table.Column>
                <Table.Column>Nombre</Table.Column>
                <Table.Column>Unidad</Table.Column>
                <Table.Column>Stock</Table.Column>
                <Table.Column>Mínimo</Table.Column>
                <Table.Column>Estado</Table.Column>
                <Table.Column>Acciones</Table.Column>
              </Table.Header>
              <Table.Body>
                <Table.Collection items={insumos}>
                  {(insumo) => (
                    <Table.Row>
                      <Table.Cell>
                        <Link
                          className="font-mono text-sm font-medium text-(--accent) hover:underline"
                          to={`/inventario/${insumo.id}`}
                        >
                          {insumo.codigo}
                        </Link>
                      </Table.Cell>
                      <Table.Cell>{insumo.nombre}</Table.Cell>
                      <Table.Cell className="text-sm text-(--muted)">
                        {UNIDAD_LABELS[insumo.unidad]}
                      </Table.Cell>
                      <Table.Cell className="font-mono text-sm">
                        {NUMERO.format(insumo.stock)} {unidadSimbolo(insumo.unidad)}
                      </Table.Cell>
                      <Table.Cell className="font-mono text-sm text-(--muted)">
                        {NUMERO.format(insumo.stockMinimo)}
                      </Table.Cell>
                      <Table.Cell>
                        {estaBajoMinimo(insumo) ? (
                          <Chip color="danger" size="sm" variant="soft">
                            Stock bajo
                          </Chip>
                        ) : (
                          <Chip color="success" size="sm" variant="soft">
                            OK
                          </Chip>
                        )}
                      </Table.Cell>
                      <Table.Cell>
                        <div className="flex justify-end">
                          {esAdmin ? (
                            <InsumoActionsMenu insumo={insumo} />
                          ) : (
                            <Link
                              className="text-sm text-(--accent) hover:underline"
                              to={`/inventario/${insumo.id}`}
                            >
                              Ver kardex
                            </Link>
                          )}
                        </div>
                      </Table.Cell>
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
