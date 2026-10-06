import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import {
  Button,
  Chip,
  FieldError,
  Label,
  ListBox,
  Modal,
  NumberField,
  Select,
  Spinner,
  TextArea,
  TextField,
} from '@heroui/react';
import { Check, CircleCheck, Plus, Trash2 } from 'lucide-react';

import { PhotoCaptureField } from '../flota/PhotoCaptureField';
import { useBranches } from '../../hooks/useBranches';
import { useFinishTask } from '../../hooks/useIntervenciones';
import { useItems } from '../../hooks/useInventory';
import { TIPO_OT_LABELS } from '../../config/mantenimiento-colors';
import {
  CreateIntervencionSchema,
  type CreateIntervencionInput,
  type OrdenTrabajo,
} from '../../types/mantenimiento';
import {
  UNIT_SYMBOLS,
  quantityAt,
  totalQuantity,
  type InventoryItem,
} from '../../types/inventory';
import { equipmentLabel, findEquipment, type EquipmentRef } from './workshop';

/**
 * Stock ACTUAL del insumo en la bodega elegida (de ahí sale el descuento al
 * guardar); sin bodega elegida todavía, el consolidado de la empresa.
 */
function CurrentStock({
  item,
  branchId,
}: {
  item: InventoryItem | undefined;
  branchId: string | undefined;
}) {
  return (
    <div className="flex min-w-20 flex-col gap-1">
      <span className="text-[11px] font-semibold tracking-wider text-(--eyebrow-color) uppercase">
        {branchId ? 'Stock en bodega' : 'Stock total'}
      </span>
      <span className="font-mono text-sm text-foreground">
        {item
          ? `${branchId ? quantityAt(item, branchId) : totalQuantity(item)} ${UNIT_SYMBOLS[item.unit]}`
          : '—'}
      </span>
    </div>
  );
}

/**
 * Pop-up "Finalizar tarea": qué se hizo + qué se utilizó + horómetro de
 * cierre. Registra la intervención y pasa la OT a COMPLETADA (useFinishTask).
 * La vista solo lo renderiza para MANTENEDOR (el backend restringe el POST
 * de intervenciones a ese rol).
 */
export function FinishTaskModal({
  orden,
  equipment,
}: {
  orden: OrdenTrabajo;
  equipment: readonly EquipmentRef[] | undefined;
}) {
  const finishTask = useFinishTask();
  const { data: items } = useItems({ isActive: true });
  const { data: branches } = useBranches({ isActive: true });
  const [foto, setFoto] = useState<File | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<CreateIntervencionInput>({
    resolver: zodResolver(CreateIntervencionSchema),
    defaultValues: {
      tipo: orden.tipo,
      detalle: '',
      horasHombre: 0,
      // Sin default: un horómetro no tocado NO se envía — mandar 0 inventaría
      // una lectura del medidor que nadie tomó.
      horometro: undefined,
      branchId: undefined,
      insumos: [],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'insumos' });
  const insumosValues = useWatch({ control, name: 'insumos' });
  const branchId = useWatch({ control, name: 'branchId' });

  // Default de bodega: la base del equipo de la OT SOLO si está entre las
  // activas (una base inactiva/borrada dejaría un branchId fantasma que el
  // Select no puede mostrar); si no, la primera activa. Editable abajo.
  const home = findEquipment(orden.equipoId, equipment)?.homeBranchId;
  const defaultBranchId =
    home && branches?.some((branch) => branch.id === home) ? home : branches?.[0]?.id;
  useEffect(() => {
    if (defaultBranchId && !getValues('branchId')) {
      setValue('branchId', defaultBranchId);
    }
  }, [defaultBranchId, getValues, setValue]);

  return (
    <Modal>
      <Button size="sm">
        <Check className="size-4" />
        Finalizar tarea
      </Button>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-xl">
            {({ close }) => {
              const onSubmit = (values: CreateIntervencionInput): void => {
                finishTask.mutate(
                  { orden, intervencion: values, foto },
                  {
                    onSuccess: () => {
                      reset();
                      setFoto(null);
                      close();
                    },
                  },
                );
              };

              return (
                <>
                  <Modal.CloseTrigger />
                  <Modal.Header>
                    <Modal.Heading className="font-display text-xl font-semibold tracking-[-0.02em]">
                      Finalizar tarea
                    </Modal.Heading>
                    <p className="text-sm text-muted-foreground">
                      Registra qué hiciste y qué utilizaste para cerrar la operación.
                    </p>
                  </Modal.Header>
                  <Modal.Body>
                    <form
                      className="flex flex-col gap-4"
                      id={`finish-task-${orden.id}`}
                      noValidate
                      onSubmit={(e) => void handleSubmit(onSubmit)(e)}
                    >
                      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted px-3.5 py-3">
                        <Chip size="sm" variant="secondary">
                          {TIPO_OT_LABELS[orden.tipo]}
                        </Chip>
                        <span className="font-mono text-xs text-muted-foreground">
                          {equipmentLabel(orden.equipoId, equipment)}
                        </span>
                        <strong className="text-sm">{orden.titulo}</strong>
                        <Chip className="ms-auto" color="warning" size="sm" variant="soft">
                          En proceso
                        </Chip>
                      </div>

                      <Controller
                        control={control}
                        name="detalle"
                        render={({ field }) => (
                          <TextField
                            fullWidth
                            isInvalid={!!errors.detalle}
                            name={field.name}
                            onBlur={field.onBlur}
                            onChange={field.onChange}
                            value={field.value}
                          >
                            <Label>¿Qué se hizo?</Label>
                            <TextArea placeholder="Describe el trabajo realizado..." rows={3} />
                            {errors.detalle ? <FieldError>{errors.detalle.message}</FieldError> : null}
                          </TextField>
                        )}
                      />

                      <PhotoCaptureField
                        file={foto}
                        subtitle="Respalda el trabajo o los insumos ocupados."
                        title="Foto de lo realizado (opcional)"
                        onClear={() => setFoto(null)}
                        onSelect={setFoto}
                      />

                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold tracking-wider text-(--eyebrow-color) uppercase">
                            ¿Qué se utilizó?
                          </span>
                          <Button
                            size="sm"
                            variant="secondary"
                            onPress={() => append({ insumoId: '', cantidad: 1 })}
                          >
                            <Plus className="size-4" />
                            Agregar insumo
                          </Button>
                        </div>

                        {fields.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            Sin insumos registrados en esta operación.
                          </p>
                        ) : (
                          <div className="flex flex-col gap-3">
                            <Controller
                              control={control}
                              name="branchId"
                              render={({ field }) => (
                                <Select
                                  className="sm:max-w-60"
                                  isInvalid={!!errors.branchId}
                                  name={field.name}
                                  placeholder="Elige la bodega"
                                  value={field.value}
                                  onChange={(value) => {
                                    if (typeof value === 'string') field.onChange(value);
                                  }}
                                >
                                  <Label>Bodega</Label>
                                  <Select.Trigger>
                                    <Select.Value />
                                    <Select.Indicator />
                                  </Select.Trigger>
                                  <Select.Popover>
                                    <ListBox>
                                      {(branches ?? []).map((branch) => (
                                        <ListBox.Item key={branch.id} id={branch.id} textValue={branch.name}>
                                          {branch.name}
                                          <ListBox.ItemIndicator />
                                        </ListBox.Item>
                                      ))}
                                    </ListBox>
                                  </Select.Popover>
                                  {errors.branchId ? (
                                    <FieldError>{errors.branchId.message}</FieldError>
                                  ) : null}
                                </Select>
                              )}
                            />
                            {fields.map((row, index) => {
                              const selectedItem = items?.find(
                                (item) => item.id === insumosValues?.[index]?.insumoId,
                              );
                              return (
                                <div
                                  key={row.id}
                                  className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-muted p-3"
                                >
                                  <Controller
                                    control={control}
                                    name={`insumos.${index}.insumoId`}
                                    render={({ field }) => (
                                      <Select
                                        className="min-w-44 flex-1"
                                        isInvalid={!!errors.insumos?.[index]?.insumoId}
                                        name={field.name}
                                        placeholder="Selecciona un insumo"
                                        value={field.value}
                                        onChange={(value) => {
                                          if (typeof value === 'string') field.onChange(value);
                                        }}
                                      >
                                        <Label>Insumo</Label>
                                        <Select.Trigger>
                                          <Select.Value />
                                          <Select.Indicator />
                                        </Select.Trigger>
                                        <Select.Popover>
                                          <ListBox>
                                            {(items ?? []).map((item) => (
                                              <ListBox.Item
                                                key={item.id}
                                                id={item.id}
                                                textValue={`${item.sku} · ${item.name}`}
                                              >
                                                {item.sku} · {item.name}
                                                <ListBox.ItemIndicator />
                                              </ListBox.Item>
                                            ))}
                                          </ListBox>
                                        </Select.Popover>
                                        {errors.insumos?.[index]?.insumoId ? (
                                          <FieldError>
                                            {errors.insumos[index]?.insumoId?.message}
                                          </FieldError>
                                        ) : null}
                                      </Select>
                                    )}
                                  />
                                  <Controller
                                    control={control}
                                    name={`insumos.${index}.cantidad`}
                                    render={({ field }) => (
                                      <NumberField
                                        className="w-32"
                                        isInvalid={!!errors.insumos?.[index]?.cantidad}
                                        minValue={0.01}
                                        value={field.value}
                                        onChange={field.onChange}
                                      >
                                        <Label>Cant.</Label>
                                        <NumberField.Group>
                                          <NumberField.DecrementButton />
                                          <NumberField.Input onBlur={field.onBlur} />
                                          <NumberField.IncrementButton />
                                        </NumberField.Group>
                                        {errors.insumos?.[index]?.cantidad ? (
                                          <FieldError>
                                            {errors.insumos[index]?.cantidad?.message}
                                          </FieldError>
                                        ) : null}
                                      </NumberField>
                                    )}
                                  />
                                  <CurrentStock branchId={branchId} item={selectedItem} />
                                  <Button
                                    isIconOnly
                                    aria-label="Quitar insumo"
                                    size="sm"
                                    variant="tertiary"
                                    onPress={() => remove(index)}
                                  >
                                    <Trash2 className="size-4" />
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Controller
                          control={control}
                          name="horasHombre"
                          render={({ field }) => (
                            <NumberField
                              fullWidth
                              isInvalid={!!errors.horasHombre}
                              minValue={0}
                              value={field.value}
                              onChange={field.onChange}
                            >
                              <Label>Horas hombre</Label>
                              <NumberField.Group>
                                <NumberField.DecrementButton />
                                <NumberField.Input onBlur={field.onBlur} />
                                <NumberField.IncrementButton />
                              </NumberField.Group>
                              {errors.horasHombre ? (
                                <FieldError>{errors.horasHombre.message}</FieldError>
                              ) : null}
                            </NumberField>
                          )}
                        />
                        <Controller
                          control={control}
                          name="horometro"
                          render={({ field }) => (
                            <NumberField
                              fullWidth
                              isInvalid={!!errors.horometro}
                              minValue={0}
                              // NaN = campo vacío para react-aria; al schema viaja
                              // `undefined` (es opcional), nunca un 0 inventado.
                              value={field.value ?? NaN}
                              onChange={(value) => field.onChange(Number.isNaN(value) ? undefined : value)}
                            >
                              <Label>Horómetro de cierre (opcional)</Label>
                              <NumberField.Group>
                                <NumberField.DecrementButton />
                                <NumberField.Input onBlur={field.onBlur} />
                                <NumberField.IncrementButton />
                              </NumberField.Group>
                              {errors.horometro ? (
                                <FieldError>{errors.horometro.message}</FieldError>
                              ) : null}
                            </NumberField>
                          )}
                        />
                      </div>

                      <div className="flex items-start gap-2.5 rounded-lg bg-success-soft px-3.5 py-3 text-[13px] leading-5 text-success-soft-foreground">
                        <CircleCheck className="mt-0.5 size-4 shrink-0" />
                        <span>
                          Al guardar <strong>se descuenta el stock</strong> de la bodega elegida
                          (movimientos trazables en Inventario) y la operación pasa a{' '}
                          <strong>Finalizado</strong>, en solo lectura. Si un insumo no alcanza, no
                          se guarda nada.
                        </span>
                      </div>
                    </form>
                  </Modal.Body>
                  <Modal.Footer>
                    <Button variant="secondary" onPress={close}>
                      Cancelar
                    </Button>
                    <Button
                      form={`finish-task-${orden.id}`}
                      isPending={finishTask.isPending}
                      type="submit"
                    >
                      {({ isPending }) =>
                        isPending ? <Spinner color="current" size="sm" /> : 'Guardar y finalizar'
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
