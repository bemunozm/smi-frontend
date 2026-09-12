import { z } from 'zod';

/**
 * Contrato del dominio Inventario (`/api/inventory/items`,
 * `/api/inventory/movements`) — RFC-3, modelo en inglés.
 *
 * El cambio de fondo respecto del contrato anterior: el ítem ya NO trae un
 * saldo propio. Trae `stocks[]`, una fila por bodega donde tiene existencia, y
 * el consolidado se calcula sumándolas. No hay dos números que puedan
 * discrepar.
 */
export const UNITS_OF_MEASURE = ['UNIT', 'LITER', 'KILOGRAM', 'METER'] as const;
export type UnitOfMeasure = (typeof UNITS_OF_MEASURE)[number];

/** Gobierna las pestañas de la pantalla: suministros vs. repuestos. */
export const ITEM_TYPES = ['SUPPLY', 'PART'] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export const MOVEMENT_DIRECTIONS = ['IN', 'OUT'] as const;
export type MovementDirection = (typeof MOVEMENT_DIRECTIONS)[number];

export const MOVEMENT_REASONS = [
  'PURCHASE',
  'RETURN',
  'PHYSICAL_ADJUSTMENT',
  'INTERVENTION',
  'ACTIVITY',
  'EXTRAORDINARY_WORK',
  'TRANSFER',
] as const;
export type MovementReason = (typeof MOVEMENT_REASONS)[number];

/** Existencia del ítem en UNA bodega. */
export const ItemStockSchema = z.object({
  branchId: z.string(),
  quantity: z.number(),
  /** Umbral propio de esa bodega. `0` = no configurado, y por lo tanto no alerta. */
  minimumQuantity: z.number(),
  branch: z.object({ id: z.string(), name: z.string() }),
});
export type ItemStock = z.infer<typeof ItemStockSchema>;

export const InventoryItemSchema = z.object({
  id: z.string(),
  sku: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  unit: z.enum(UNITS_OF_MEASURE),
  type: z.enum(ITEM_TYPES),
  categoryId: z.string().nullable(),
  category: z.object({ id: z.string(), name: z.string() }).nullable(),
  partNumber: z.string().nullable(),
  defaultSupplier: z.string().nullable(),
  isCritical: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  /** Una fila por bodega donde el ítem tiene ficha de saldo. */
  stocks: z.array(ItemStockSchema),
});
export type InventoryItem = z.infer<typeof InventoryItemSchema>;

export const StockMovementSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  branchId: z.string(),
  direction: z.enum(MOVEMENT_DIRECTIONS),
  reason: z.enum(MOVEMENT_REASONS),
  quantity: z.number(),
  /** Saldo de ESA bodega después del asiento. */
  resultingBalance: z.number(),
  reference: z.string().nullable(),
  /** Guía de despacho / OC que respalda el movimiento. */
  documentNumber: z.string().nullable().optional(),
  performedById: z.string().nullable(),
  equipmentId: z.string().nullable(),
  notes: z.string().nullable(),
  occurredAt: z.string().datetime(),
  branch: z.object({ id: z.string(), name: z.string() }).nullable().optional(),
  sourceBranch: z.object({ id: z.string(), name: z.string() }).nullable().optional(),
  destinationBranch: z
    .object({ id: z.string(), name: z.string() })
    .nullable()
    .optional(),
  equipment: z
    .object({ id: z.string(), internalCode: z.string() })
    .nullable()
    .optional(),
  item: z
    .object({
      id: z.string(),
      sku: z.string(),
      name: z.string(),
      unit: z.enum(UNITS_OF_MEASURE),
    })
    .nullable()
    .optional(),
});
export type StockMovement = z.infer<typeof StockMovementSchema>;

// --- Envolturas `{ data, message }` ---------------------------------------

export const ItemListResponseSchema = z.object({
  data: z.array(InventoryItemSchema),
  message: z.string(),
});

export const ItemResponseSchema = z.object({
  data: InventoryItemSchema,
  message: z.string(),
});

export const KardexResponseSchema = z.object({
  data: z.object({
    item: InventoryItemSchema,
    movements: z.array(StockMovementSchema),
  }),
  message: z.string(),
});

export const MovementResponseSchema = z.object({
  data: StockMovementSchema,
  message: z.string(),
});

export const MovementListResponseSchema = z.object({
  data: z.array(StockMovementSchema),
  message: z.string(),
});

/** El ajuste devuelve el ítem y el asiento, que es `null` si el conteo coincidía. */
export const AdjustResponseSchema = z.object({
  data: z.object({
    item: InventoryItemSchema,
    movement: StockMovementSchema.nullable(),
  }),
  message: z.string(),
});

export const DeleteItemResponseSchema = z.object({
  data: z.object({ id: z.string() }).nullable(),
  message: z.string(),
});

// --- Lecturas derivadas ----------------------------------------------------

/** Existencia del ítem en la bodega elegida. Sin fila = 0, no es un error. */
export function stockAt(item: InventoryItem, branchId: string): ItemStock | undefined {
  return item.stocks.find((stock) => stock.branchId === branchId);
}

export function quantityAt(item: InventoryItem, branchId: string): number {
  return stockAt(item, branchId)?.quantity ?? 0;
}

/** Consolidado de la empresa: la suma de las bodegas, no una columna aparte. */
export function totalQuantity(item: InventoryItem): number {
  return item.stocks.reduce((sum, stock) => sum + stock.quantity, 0);
}

/**
 * Alerta de reposición de UNA bodega. `minimumQuantity = 0` significa "esta
 * bodega no fijó umbral" y no alerta: el umbral de la empresa y el de una
 * sucursal no son la misma magnitud, y heredar uno como el otro encendería la
 * alerta en todas las filas a la vez.
 */
export function isBelowMinimumAt(item: InventoryItem, branchId: string): boolean {
  const stock = stockAt(item, branchId);
  if (!stock || stock.minimumQuantity <= 0) return false;
  return stock.quantity <= stock.minimumQuantity;
}

// --- Etiquetas -------------------------------------------------------------

export const UNIT_LABELS: Record<UnitOfMeasure, string> = {
  UNIT: 'Unidades',
  LITER: 'Litros',
  KILOGRAM: 'Kilogramos',
  METER: 'Metros',
};

export const UNIT_SYMBOLS: Record<UnitOfMeasure, string> = {
  UNIT: 'u',
  LITER: 'L',
  KILOGRAM: 'kg',
  METER: 'm',
};

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  SUPPLY: 'Suministro',
  PART: 'Repuesto',
};

export const MOVEMENT_REASON_LABELS: Record<MovementReason, string> = {
  PURCHASE: 'Compra / reposición',
  RETURN: 'Devolución a bodega',
  PHYSICAL_ADJUSTMENT: 'Ajuste por conteo físico',
  INTERVENTION: 'Consumo en mantención',
  ACTIVITY: 'Consumo en actividad',
  EXTRAORDINARY_WORK: 'Consumo en trabajo extraordinario',
  TRANSFER: 'Traspaso entre sucursales',
};

/** Motivos que ofrece el formulario manual, por dirección. */
export const REASONS_BY_DIRECTION: Record<MovementDirection, MovementReason[]> = {
  IN: ['PURCHASE', 'RETURN'],
  OUT: ['INTERVENTION', 'ACTIVITY', 'EXTRAORDINARY_WORK'],
};

// --- Entradas --------------------------------------------------------------

export interface CreateItemInput {
  sku: string;
  name: string;
  description?: string;
  unit: UnitOfMeasure;
  type: ItemType;
  categoryId?: string;
  partNumber?: string;
  defaultSupplier?: string;
  isCritical?: boolean;
  initialQuantity?: number;
  branchId?: string;
}

export type UpdateItemInput = Omit<
  CreateItemInput,
  'sku' | 'initialQuantity' | 'branchId' | 'categoryId'
> & {
  /** `null` desvincula la categoría; omitirlo la deja como está. */
  categoryId?: string | null;
  isActive?: boolean;
};

export interface CreateMovementInput {
  itemId: string;
  branchId: string;
  direction: MovementDirection;
  reason: MovementReason;
  quantity: number;
  equipmentId?: string;
  /** Guía de despacho, OC o factura. Distinto de `reference`, que es interno. */
  documentNumber?: string;
  notes?: string;
}

export interface AdjustStockInput {
  branchId: string;
  countedQuantity: number;
  notes?: string;
}

// --- Formularios (RHF + zodResolver) --------------------------------------

/** Campo numérico de formulario: string en el input, número al enviar. */
const quantityField = (message: string) =>
  z
    .string()
    .min(1, message)
    .refine((value) => Number.isFinite(Number(value)) && Number(value) >= 0, {
      message: 'Ingresa un número válido',
    });

/**
 * Ficha del ítem. `categoryId` es un string vacío cuando no se eligió
 * categoría: el `Select` no sabe de `null`, y la conversión a "campo ausente"
 * se hace al armar el payload.
 */
export const ItemCardSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio').max(80),
  description: z.string().max(240).or(z.literal('')),
  unit: z.enum(UNITS_OF_MEASURE),
  type: z.enum(ITEM_TYPES),
  categoryId: z.string(),
  partNumber: z.string().max(60).or(z.literal('')),
  defaultSupplier: z.string().max(120).or(z.literal('')),
  isCritical: z.boolean(),
});

export type ItemCardValues = z.infer<typeof ItemCardSchema>;

export const ItemFormSchema = ItemCardSchema.extend({
  sku: z.string().min(1, 'El SKU es obligatorio').max(20, 'Máximo 20 caracteres'),
  initialQuantity: quantityField('La existencia inicial es obligatoria'),
});
export type ItemFormValues = z.infer<typeof ItemFormSchema>;

/**
 * Edición: sin `sku` ni existencia inicial. El SKU es la referencia con la que
 * el ítem aparece en el kardex histórico — renombrarlo dejaría los reportes
 * viejos hablando de otro código — y el saldo solo se mueve con movimientos.
 * El backend rechaza ambos campos, así que el formulario ni los ofrece.
 */
export const ItemEditFormSchema = ItemCardSchema.extend({
  /** Baja lógica: lo saca de los selectores sin perder su kardex. */
  isActive: z.boolean(),
});
export type ItemEditFormValues = z.infer<typeof ItemEditFormSchema>;

/**
 * Campos de la ficha, ya limpios. Los textos vacíos se omiten en vez de
 * mandarse como `''`: el backend corre con `forbidNonWhitelisted` y un string
 * vacío solo deja basura en la base.
 */
function toCardPayload(values: z.infer<typeof ItemCardSchema>) {
  return {
    name: values.name.trim(),
    ...(values.description.trim()
      ? { description: values.description.trim() }
      : {}),
    unit: values.unit,
    type: values.type,
    ...(values.partNumber.trim()
      ? { partNumber: values.partNumber.trim() }
      : {}),
    ...(values.defaultSupplier.trim()
      ? { defaultSupplier: values.defaultSupplier.trim() }
      : {}),
    isCritical: values.isCritical,
  };
}

export function toCreateItemPayload(
  values: ItemFormValues,
  branchId: string,
): CreateItemInput {
  const initialQuantity = Number(values.initialQuantity);
  return {
    sku: values.sku.trim().toUpperCase(),
    ...toCardPayload(values),
    ...(values.categoryId ? { categoryId: values.categoryId } : {}),
    ...(initialQuantity > 0 ? { initialQuantity, branchId } : {}),
  };
}

export function toUpdateItemPayload(
  values: ItemEditFormValues,
): UpdateItemInput {
  return {
    ...toCardPayload(values),
    // Al editar, "sin categoría" viaja como `null` explícito y no omitido:
    // omitirlo significa "no lo toques", y entonces un ítem mal clasificado se
    // podría reclasificar pero nunca dejar sin categoría.
    categoryId: values.categoryId || null,
    isActive: values.isActive,
  };
}

/** Carga la ficha guardada en el formulario de edición. */
export function toItemEditValues(item: InventoryItem): ItemEditFormValues {
  return {
    name: item.name,
    description: item.description ?? '',
    unit: item.unit,
    type: item.type,
    categoryId: item.categoryId ?? '',
    partNumber: item.partNumber ?? '',
    defaultSupplier: item.defaultSupplier ?? '',
    isCritical: item.isCritical,
    isActive: item.isActive,
  };
}

export const MovementFormSchema = z.object({
  quantity: quantityField('La cantidad es obligatoria').refine(
    (value) => Number(value) > 0,
    { message: 'La cantidad debe ser mayor a 0' },
  ),
  reason: z.enum(MOVEMENT_REASONS),
  equipmentId: z.string(),
  documentNumber: z.string().max(60, 'Máximo 60 caracteres').or(z.literal('')),
  notes: z.string().max(240).or(z.literal('')),
});
export type MovementFormValues = z.infer<typeof MovementFormSchema>;

export const MinimumFormSchema = z.object({
  minimumQuantity: quantityField('Ingresa el mínimo'),
});
export type MinimumFormValues = z.infer<typeof MinimumFormSchema>;

export const AdjustFormSchema = z.object({
  countedQuantity: quantityField('Ingresa la cantidad contada'),
  notes: z.string().max(240).or(z.literal('')),
});
export type AdjustFormValues = z.infer<typeof AdjustFormSchema>;
