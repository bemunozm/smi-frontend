import { useState } from 'react';
import { Plus } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useController, useForm, useWatch, type Control } from 'react-hook-form';
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

import { useCategories, useCreateCategory } from '../../hooks/useCategories';
import { useCreateItem, useSaveItemWithMinimums } from '../../hooks/useInventory';
import { formatDecimalInput, parseDecimal } from '../../lib/decimal';
import type { Branch } from '../../types/branch';
import type { ItemCategory } from '../../types/category';
import {
  ITEM_TYPES,
  PACKAGED_UNITS,
  UNIT_SINGULAR,
  contentUnitsFor,
  type UnitOfMeasure,
  ITEM_TYPE_LABELS,
  ItemEditFormSchema,
  ItemFormSchema,
  UNITS_OF_MEASURE,
  UNIT_LABELS,
  contenidoDe,
  resumenExistencia,
  stockAt,
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

/** Ejemplo del contenido según en qué se cuenta el suministro. */
const EJEMPLO_CONTENIDO: Partial<Record<UnitOfMeasure, string>> = {
  UNIT: 'Ej.: 10 (bidón de 10 L)',
  PAIL: 'Ej.: 19 (tineta de 19 L)',
  CAN: 'Ej.: 20 (bidón de 20 L)',
  DRUM: 'Ej.: 208 (tambor de 208 L)',
  BOX: 'Ej.: 12 (caja de 12 unidades)',
};

/** El ejemplo de total de la ayuda de «Contenido», según el envase. */
const EJEMPLO_TOTAL: Partial<Record<UnitOfMeasure, string>> = {
  UNIT: '12 unidades de 10 L = 120 L',
  PAIL: '3 tinetas de 19 L = 57 L',
  CAN: '4 bidones de 20 L = 80 L',
  DRUM: '2 tambores de 208 L = 416 L',
  BOX: '5 cajas de 12 unidades = 60 unidades',
};

/** Opción del selector de categoría para "no clasificado". */
const NO_CATEGORY = '__none__';

const EMPTY_ITEM: ItemFormValues = {
  name: '',
  description: '',
  unit: 'UNIT',
  contentPerUnit: '',
  contentUnit: 'LITER',
  type: 'SUPPLY',
  categoryId: '',
  partNumber: '',
  defaultSupplier: '',
  isCritical: false,
  initialQuantity: '',
};

/**
 * Los campos que comparten el alta y la edición. Se escriben una sola vez
 * porque son los mismos datos: lo único que cambia entre los dos formularios es
 * lo que los rodea (existencia inicial al crear; baja lógica al editar). El SKU
 * ya no se pide: lo genera el servidor (`SUM-0001`, `REP-0001`).
 *
 * El `control` viene tipado con el esquema del formulario completo, que es más
 * ancho que `ItemCardValues`. `Control` es invariante en su parámetro, así que
 * el cast es inevitable; es seguro porque los nombres de campo que toca este
 * componente existen en ambos esquemas — `ItemFormSchema` y
 * `ItemEditFormSchema` extienden `ItemCardSchema`.
 *
 * El Nº de parte NO está acá: al crear es ruido (se puede completar después),
 * así que solo lo pide la edición — ver `EditItemModal`.
 */
function ItemCardFields({
  control,
  categories,
  errors,
}: {
  control: Control<ItemCardValues>;
  categories: ItemCategory[];
  errors: { name?: { message?: string }; contentPerUnit?: { message?: string } };
}) {
  const unidad = useWatch({ control, name: 'unit' });
  const tipo = useWatch({ control, name: 'type' });
  const { field: unitField } = useController({ control, name: 'unit' });
  const { field: contentField } = useController({ control, name: 'contentPerUnit' });
  const { field: contentUnitField } = useController({ control, name: 'contentUnit' });
  const { field: categoryField } = useController({ control, name: 'categoryId' });
  // Crear una categoría sin salir del formulario cuando no está la que hace falta.
  const createCategory = useCreateCategory();
  const [creandoCategoria, setCreandoCategoria] = useState(false);
  const [nuevaCategoria, setNuevaCategoria] = useState('');
  const agregarCategoria = () => {
    const nombre = nuevaCategoria.trim();
    if (!nombre || createCategory.isPending) return;
    createCategory.mutate(nombre, {
      onSuccess: (result) => {
        // Confirmada por el servidor: queda elegida en el ítem. Sin señal se
        // crea al sincronizar y se elige después.
        if (result.status === 'sent' && result.data) categoryField.onChange(result.data.id);
        setNuevaCategoria('');
        setCreandoCategoria(false);
      },
    });
  };
  // Un repuesto es una pieza que se monta entera (un filtro, una correa): se
  // cuenta en unidades y no tiene contenido. Las unidades de medida y los
  // envases son de los suministros. Si un repuesto viejo quedó en otra unidad
  // se muestra el selector igual, para poder corregirlo.
  const repuestoEnUnidades = tipo === 'PART' && unidad === 'UNIT';
  // El contenido solo tiene sentido en lo que se cuenta por pieza: la unidad
  // y los envases (una tineta de 19 L, una caja de 12 unidades).
  const porPieza = PACKAGED_UNITS.includes(unidad) && !repuestoEnUnidades;
  // El contenido se pide solo si se activa (o si el ítem ya lo trae, al editar).
  const conContenido = (useWatch({ control, name: 'contentPerUnit' }) ?? '').trim() !== '';
  const [indicarContenido, setIndicarContenido] = useState(false);
  const mostrarContenido = indicarContenido || conContenido;
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
                if (!value) return;
                field.onChange(value);
                // Pasar a repuesto lo deja en unidades y sin contenido.
                if (value === 'PART') {
                  unitField.onChange('UNIT');
                  contentField.onChange('');
                }
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

        {repuestoEnUnidades ? (
          // Fijo y a la vista: el repuesto se cuenta en unidades, sin envases ni
          // medidas que elegir (ver `repuestoEnUnidades`).
          <TextField fullWidth isDisabled value={UNIT_LABELS.UNIT}>
            <Label>Se cuenta en</Label>
            <Input />
          </TextField>
        ) : (
        <Controller
          control={control}
          name="unit"
          render={({ field }) => (
            <Select
              fullWidth
              name={field.name}
              onChange={(value) => {
                if (!value) return;
                field.onChange(value);
                // Si la medida elegida no calza con la nueva forma de contar
                // (una caja en litros, una tineta en unidades) se propone la
                // que corresponde: unidades para la caja, litros para el resto.
                const validas = contentUnitsFor(value as UnitOfMeasure);
                if (validas.length && !validas.includes(contentUnitField.value)) {
                  contentUnitField.onChange(validas[0]);
                }
                // Un envase casi siempre se quiere con su contenido (la tineta
                // de 19 L): se abre de una. La unidad suelta queda apagada.
                setIndicarContenido(value !== 'UNIT' && PACKAGED_UNITS.includes(value as UnitOfMeasure));
              }}
              value={field.value}
            >
              <Label>Se cuenta en</Label>
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
        )}
      </div>

      {porPieza ? (
        // El contenido es opcional: se pregunta con un interruptor en vez de
        // dejar un campo vacío que no se entiende. Apagado, el ítem es «una
        // unidad» y nada más (un filtro, una bolsa de huaipe).
        <div className="flex flex-col gap-3">
        <Switch
          isSelected={mostrarContenido}
          onChange={(on) => {
            setIndicarContenido(on);
            if (!on) contentField.onChange('');
          }}
        >
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            <span className="flex flex-col">
              <span className="text-sm font-medium text-foreground">
                {unidad === 'UNIT' ? 'Cada unidad trae una cantidad (litros, kilos o metros)' : `Indicar cuánto trae cada ${UNIT_SINGULAR[unidad]}`}
              </span>
              <span className="text-xs text-muted-foreground">
                {unidad === 'UNIT'
                  ? 'Por ejemplo, un bidón de 20 L o un cartucho de 0,4 kg. Si se usa entero, como un filtro, déjalo apagado.'
                  : `Así el inventario también muestra el total (${EJEMPLO_TOTAL[unidad] ?? ''}).`}
              </span>
            </span>
          </Switch.Content>
        </Switch>
        {mostrarContenido ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Controller
            control={control}
            name="contentPerUnit"
            render={({ field }) => (
              <TextField
                fullWidth
                isInvalid={!!errors.contentPerUnit}
                name={field.name}
                onBlur={field.onBlur}
                onChange={field.onChange}
                value={field.value}
              >
                <Label>Cada {UNIT_SINGULAR[unidad]} trae</Label>
                <Input inputMode="decimal" placeholder={EJEMPLO_CONTENIDO[unidad] ?? 'Ej.: 10'} />
                {errors.contentPerUnit ? <FieldError>{errors.contentPerUnit.message}</FieldError> : null}
              </TextField>
            )}
          />
          {mostrarContenido ? (
            <Controller
              control={control}
              name="contentUnit"
              render={({ field }) => (
                <Select
                  fullWidth
                  name={field.name}
                  onChange={(value) => {
                    if (value) field.onChange(value);
                  }}
                  value={field.value}
                >
                  <Label>Medido en</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {contentUnitsFor(unidad).map((unit) => (
                        <ListBox.Item id={unit} key={unit} textValue={UNIT_LABELS[unit]}>
                          {UNIT_LABELS[unit]}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              )}
            />
          ) : null}
        </div>
        ) : null}
        </div>
      ) : null}

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

      {/* Fuera del menú y siempre a la vista: dentro de la lista quedaba al
          fondo (o desteñida por el difuminado del borde) y no se encontraba. */}
      {!creandoCategoria ? (
        <Button
          className="-mt-2 self-start bg-accent-soft font-semibold text-accent-soft-foreground hover:bg-accent-soft-hover"
          size="sm"
          variant="ghost"
          onPress={() => setCreandoCategoria(true)}
        >
          <Plus className="h-4 w-4" /> ¿No está la categoría? Crear una nueva
        </Button>
      ) : null}

      {creandoCategoria ? (
        <div className="flex items-start gap-2">
          <TextField
            fullWidth
            value={nuevaCategoria}
            onChange={setNuevaCategoria}
            autoFocus
            // Enter agrega la categoría; sin esto enviaba el formulario del ítem.
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                agregarCategoria();
              }
            }}
          >
            <Label>Nombre de la nueva categoría</Label>
            <Input placeholder="Ej.: Filtros" />
          </TextField>
          <Button
            className="h-12 shrink-0"
            isDisabled={!nuevaCategoria.trim() || createCategory.isPending}
            onPress={agregarCategoria}
          >
            {createCategory.isPending ? <Spinner color="current" size="sm" /> : 'Agregar'}
          </Button>
          <Button
            className="h-12 shrink-0"
            variant="secondary"
            onPress={() => {
              setNuevaCategoria('');
              setCreandoCategoria(false);
            }}
          >
            Cancelar
          </Button>
        </div>
      ) : null}

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
          // Sin `Switch.Control` solo se veía el texto, sin interruptor: parecía
          // un aviso fijo y no una opción que se activa.
          <Switch isSelected={field.value} onChange={field.onChange}>
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              <span className="flex flex-col">
                <span className="text-sm font-medium text-foreground">Marcar como crítico</span>
                <span className="text-xs text-muted-foreground">
                  Si falta, la máquina se detiene. Se destaca en el inventario y se prioriza al comprar.
                </span>
              </span>
            </Switch.Content>
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

  // La existencia se escribe en la unidad del ítem; con contenido por unidad se
  // dice cuánto es en total («12 u × 10 L = 120 L»).
  const [unidad, contenidoPorUnidad, unidadContenido, existencia] = useWatch({
    control,
    name: ['unit', 'contentPerUnit', 'contentUnit', 'initialQuantity'],
  });
  const existenciaNum = parseDecimal(existencia);
  const totalEquivalente =
    existenciaNum != null && existenciaNum > 0
      ? resumenExistencia(
          existenciaNum,
          unidad,
          contenidoDe({ unit: unidad, contentPerUnit: contenidoPorUnidad, contentUnit: unidadContenido }),
        )
      : null;
  // Sin bodega activa la existencia inicial no tiene dónde entrar: se avisa en
  // vez de dejar que el servidor responda con un error técnico.
  const sinBodega = !branchId && existenciaNum != null && existenciaNum > 0;

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
                          <Label>
                            Existencia inicial{branchName ? ` en ${branchName}` : ''} (
                            {UNIT_LABELS[unidad].toLowerCase()})
                          </Label>
                          <Input inputMode="decimal" placeholder="0" />
                          {totalEquivalente ? (
                            <span className="mt-1 rounded-xl bg-muted px-3 py-2 text-sm font-semibold text-foreground tabular-nums">
                              {totalEquivalente}
                            </span>
                          ) : null}
                          {errors.initialQuantity ? (
                            <FieldError>
                              {errors.initialQuantity.message}
                            </FieldError>
                          ) : null}
                        </TextField>
                      )}
                    />

                    {sinBodega ? (
                      <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-soft-foreground">
                        No hay ninguna bodega activa donde dejar la existencia.
                        Crea el ítem con existencia 0 o pide que se active una
                        bodega.
                      </p>
                    ) : null}

                    <p className="text-xs text-muted-foreground">
                      Se escribe en lo que se cuenta el ítem (unidades,
                      tinetas, litros…). Queda registrada como una entrada por
                      compra
                      {branchName ? ` en ${branchName}` : ''}. El SKU se genera
                      solo y el mínimo se fija después, desde las acciones del
                      ítem.
                    </p>
                  </form>
                </Modal.Body>
                <Modal.Footer>
                  <Button onPress={close} variant="secondary">
                    Cancelar
                  </Button>
                  <Button
                    form="new-item-form"
                    isDisabled={sinBodega}
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
  branches,
  isOpen,
  onOpenChange,
}: {
  item: InventoryItem;
  branches: Branch[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const saveItem = useSaveItemWithMinimums();
  const { data: categories } = useCategories();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ItemEditFormValues>({
    resolver: zodResolver(ItemEditFormSchema),
    defaultValues: toItemEditValues(item),
  });

  /**
   * Los mínimos son **por sucursal** (el umbral de la empresa y el de una
   * bodega no son la misma magnitud), así que se editan como una fila por
   * sucursal dentro de la ficha. Antes vivían en una acción aparte y había que
   * abrirla una vez por bodega y por ítem.
   *
   * No van en el mismo formulario que el resto porque no viajan en el mismo
   * endpoint: la ficha es un PATCH del ítem y cada mínimo es un PUT sobre la
   * existencia de esa bodega.
   */
  const [minimums, setMinimums] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      branches.map((branch) => [
        branch.id,
        formatDecimalInput(stockAt(item, branch.id)?.minimumQuantity ?? 0),
      ]),
    ),
  );

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-lg">
          {({ close }) => {
            const onSubmit = (values: ItemEditFormValues): void => {
              saveItem.mutate(
                { item, input: toUpdateItemPayload(values), minimums },
                { onSuccess: close },
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

                    <SectionLabel>Stock mínimo por sucursal</SectionLabel>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {branches.map((branch) => (
                        <TextField
                          fullWidth
                          key={branch.id}
                          onChange={(value) =>
                            setMinimums((current) => ({
                              ...current,
                              [branch.id]: value,
                            }))
                          }
                          value={minimums[branch.id] ?? '0'}
                        >
                          <Label>{branch.name}</Label>
                          <Input inputMode="decimal" placeholder="0" />
                        </TextField>
                      ))}
                    </div>
                    <p className="-mt-2 text-xs text-muted-foreground">
                      En <strong>0</strong> esa bodega deja de alertar por este
                      ítem.
                    </p>

                    <SectionLabel>Estado</SectionLabel>
                    <Controller
                      control={control}
                      name="isActive"
                      render={({ field }) => (
                        <Switch
                          isSelected={field.value}
                          onChange={field.onChange}
                        >
                          <Switch.Content>
                            <Switch.Control>
                              <Switch.Thumb />
                            </Switch.Control>
                            Activo en los selectores
                          </Switch.Content>
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
                    isPending={saveItem.isPending}
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
