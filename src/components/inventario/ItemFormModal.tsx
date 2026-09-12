import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, type Control } from 'react-hook-form';
import {
  Button,
  FieldError,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  Spinner,
  Switch,
  TextField,
} from '@heroui/react';

import { useCategories } from '../../hooks/useCategories';
import { useCreateItem, useUpdateItem } from '../../hooks/useInventory';
import type { ItemCategory } from '../../types/category';
import {
  ITEM_TYPES,
  ITEM_TYPE_LABELS,
  ItemEditFormSchema,
  ItemFormSchema,
  UNITS_OF_MEASURE,
  UNIT_LABELS,
  toCreateItemPayload,
  toItemEditValues,
  toUpdateItemPayload,
  type InventoryItem,
  type ItemCardValues,
  type ItemEditFormValues,
  type ItemFormValues,
  type ItemType,
} from '../../types/inventory';
import { SectionLabel } from './shared';

/** Opción del selector de categoría para "no clasificado". */
const NO_CATEGORY = '__none__';

const EMPTY_ITEM: ItemFormValues = {
  sku: '',
  name: '',
  description: '',
  unit: 'UNIT',
  type: 'SUPPLY',
  categoryId: '',
  partNumber: '',
  defaultSupplier: '',
  isCritical: false,
  initialQuantity: '0',
};

/**
 * Los campos que comparten el alta y la edición. Se escriben una sola vez
 * porque son los mismos datos: lo único que cambia entre los dos formularios es
 * lo que los rodea (SKU y existencia inicial al crear; baja lógica al editar).
 *
 * El `control` viene tipado con el esquema del formulario completo, que es más
 * ancho que `ItemCardValues`. `Control` es invariante en su parámetro, así que
 * el cast es inevitable; es seguro porque los nombres de campo que toca este
 * componente existen en ambos esquemas — `ItemFormSchema` y
 * `ItemEditFormSchema` extienden `ItemCardSchema`.
 */
function ItemCardFields({
  control,
  categories,
  errors,
}: {
  control: Control<ItemCardValues>;
  categories: ItemCategory[];
  errors: { name?: { message?: string } };
}) {
  return (
    <>
      <Controller
        control={control}
        name="name"
        render={({ field }) => (
          <TextField
            fullWidth
            isInvalid={!!errors.name}
            name={field.name}
            onBlur={field.onBlur}
            onChange={field.onChange}
            value={field.value}
          >
            <Label>Nombre</Label>
            <Input placeholder="Filtro de aceite motor" />
            {errors.name ? <FieldError>{errors.name.message}</FieldError> : null}
          </TextField>
        )}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <Select
              fullWidth
              name={field.name}
              onChange={(value) => {
                if (value) field.onChange(value);
              }}
              value={field.value}
            >
              <Label>Clasificación</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {ITEM_TYPES.map((type) => (
                    <ListBox.Item
                      id={type}
                      key={type}
                      textValue={ITEM_TYPE_LABELS[type]}
                    >
                      {ITEM_TYPE_LABELS[type]}
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
          name="unit"
          render={({ field }) => (
            <Select
              fullWidth
              name={field.name}
              onChange={(value) => {
                if (value) field.onChange(value);
              }}
              value={field.value}
            >
              <Label>Unidad</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {UNITS_OF_MEASURE.map((unit) => (
                    <ListBox.Item
                      id={unit}
                      key={unit}
                      textValue={UNIT_LABELS[unit]}
                    >
                      {UNIT_LABELS[unit]}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          )}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Controller
          control={control}
          name="categoryId"
          render={({ field }) => (
            <Select
              fullWidth
              name={field.name}
              onChange={(value) => {
                field.onChange(value === NO_CATEGORY ? '' : String(value ?? ''));
              }}
              // El `Select` no maneja `''` como selección: se usa un centinela
              // y se traduce a "sin categoría" al guardar.
              value={field.value || NO_CATEGORY}
            >
              <Label>Categoría</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id={NO_CATEGORY} textValue="Sin categoría">
                    Sin categoría
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                  {categories.map((category) => (
                    <ListBox.Item
                      id={category.id}
                      key={category.id}
                      textValue={category.name}
                    >
                      {category.name}
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
          name="partNumber"
          render={({ field }) => (
            <TextField
              fullWidth
              name={field.name}
              onBlur={field.onBlur}
              onChange={field.onChange}
              value={field.value}
            >
              <Label>Nº de parte (opcional)</Label>
              <Input placeholder="1R-0750" />
            </TextField>
          )}
        />
      </div>

      <Controller
        control={control}
        name="defaultSupplier"
        render={({ field }) => (
          <TextField
            fullWidth
            name={field.name}
            onBlur={field.onBlur}
            onChange={field.onChange}
            value={field.value}
          >
            <Label>Proveedor habitual (opcional)</Label>
            <Input placeholder="Comercial Iquique Ltda." />
          </TextField>
        )}
      />

      <Controller
        control={control}
        name="isCritical"
        render={({ field }) => (
          <Switch isSelected={field.value} onChange={field.onChange}>
            Crítico: su falta detiene la máquina
          </Switch>
        )}
      />
    </>
  );
}

// --- Alta ------------------------------------------------------------------

export function NewItemModal({
  branchId,
  branchName,
  defaultType,
  isOpen,
  onOpenChange,
}: {
  branchId: string;
  branchName: string;
  defaultType: ItemType;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const createItem = useCreateItem();
  const { data: categories } = useCategories();
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ItemFormValues>({
    resolver: zodResolver(ItemFormSchema),
    defaultValues: { ...EMPTY_ITEM, type: defaultType },
  });

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-lg">
          {({ close }) => {
            const onSubmit = (values: ItemFormValues): void => {
              createItem.mutate(toCreateItemPayload(values, branchId), {
                onSuccess: () => {
                  reset({ ...EMPTY_ITEM, type: defaultType });
                  close();
                },
              });
            };

            return (
              <>
                <Modal.CloseTrigger />
                <Modal.Header>
                  <Modal.Heading className="font-display text-xl font-semibold tracking-[-0.02em]">
                    Nuevo ítem
                  </Modal.Heading>
                </Modal.Header>
                <Modal.Body>
                  <form
                    className="flex flex-col gap-4"
                    id="new-item-form"
                    noValidate
                    onSubmit={(event) => void handleSubmit(onSubmit)(event)}
                  >
                    <Controller
                      control={control}
                      name="sku"
                      render={({ field }) => (
                        <TextField
                          fullWidth
                          isInvalid={!!errors.sku}
                          name={field.name}
                          onBlur={field.onBlur}
                          onChange={field.onChange}
                          value={field.value}
                        >
                          <Label>SKU</Label>
                          <Input autoFocus placeholder="FIL-001" />
                          {errors.sku ? (
                            <FieldError>{errors.sku.message}</FieldError>
                          ) : null}
                        </TextField>
                      )}
                    />

                    <ItemCardFields
                      categories={categories ?? []}
                      control={control as unknown as Control<ItemCardValues>}
                      errors={errors}
                    />

                    <Controller
                      control={control}
                      name="initialQuantity"
                      render={({ field }) => (
                        <TextField
                          fullWidth
                          isInvalid={!!errors.initialQuantity}
                          name={field.name}
                          onBlur={field.onBlur}
                          onChange={field.onChange}
                          value={field.value}
                        >
                          <Label>Existencia inicial en {branchName}</Label>
                          <Input inputMode="decimal" placeholder="0" />
                          {errors.initialQuantity ? (
                            <FieldError>
                              {errors.initialQuantity.message}
                            </FieldError>
                          ) : null}
                        </TextField>
                      )}
                    />

                    <p className="text-xs text-muted-foreground">
                      La existencia inicial queda registrada como una entrada por
                      compra en {branchName}: el kardex parte explicando de dónde
                      salió el saldo. El mínimo se fija después, desde las
                      acciones del ítem.
                    </p>
                  </form>
                </Modal.Body>
                <Modal.Footer>
                  <Button onPress={close} variant="secondary">
                    Cancelar
                  </Button>
                  <Button
                    form="new-item-form"
                    isPending={createItem.isPending}
                    type="submit"
                  >
                    {({ isPending }) =>
                      isPending ? <Spinner color="current" size="sm" /> : 'Crear'
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

// --- Edición ---------------------------------------------------------------

/**
 * Corrige la ficha, no el saldo. No ofrece SKU ni existencia: el SKU es la
 * referencia con la que el ítem aparece en el kardex histórico, y el saldo solo
 * se mueve con movimientos. El backend rechaza los dos campos, así que el
 * formulario ni los muestra.
 */
export function EditItemModal({
  item,
  isOpen,
  onOpenChange,
}: {
  item: InventoryItem;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const updateItem = useUpdateItem();
  const { data: categories } = useCategories();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ItemEditFormValues>({
    resolver: zodResolver(ItemEditFormSchema),
    defaultValues: toItemEditValues(item),
  });

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-lg">
          {({ close }) => {
            const onSubmit = (values: ItemEditFormValues): void => {
              updateItem.mutate(
                { id: item.id, input: toUpdateItemPayload(values) },
                { onSuccess: () => close() },
              );
            };

            return (
              <>
                <Modal.CloseTrigger />
                <Modal.Header>
                  <Modal.Heading className="font-display text-xl font-semibold tracking-[-0.02em]">
                    Editar · {item.sku}
                  </Modal.Heading>
                </Modal.Header>
                <Modal.Body>
                  <form
                    className="flex flex-col gap-4"
                    id="edit-item-form"
                    noValidate
                    onSubmit={(event) => void handleSubmit(onSubmit)(event)}
                  >
                    <ItemCardFields
                      categories={categories ?? []}
                      control={control as unknown as Control<ItemCardValues>}
                      errors={errors}
                    />

                    <SectionLabel>Estado</SectionLabel>
                    <Controller
                      control={control}
                      name="isActive"
                      render={({ field }) => (
                        <Switch
                          isSelected={field.value}
                          onChange={field.onChange}
                        >
                          Activo en los selectores
                        </Switch>
                      )}
                    />

                    <p className="text-xs text-muted-foreground">
                      Darlo de baja lo saca de los listados y selectores sin
                      borrar su kardex: los movimientos históricos lo siguen
                      nombrando. El SKU y la existencia no se editan acá — la
                      existencia se corrige con «Ajustar por conteo».
                    </p>
                  </form>
                </Modal.Body>
                <Modal.Footer>
                  <Button onPress={close} variant="secondary">
                    Cancelar
                  </Button>
                  <Button
                    form="edit-item-form"
                    isPending={updateItem.isPending}
                    type="submit"
                  >
                    {({ isPending }) =>
                      isPending ? (
                        <Spinner color="current" size="sm" />
                      ) : (
                        'Guardar'
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
  );
}
