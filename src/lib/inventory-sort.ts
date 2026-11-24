import { ALL_BRANCHES, stockStatus, type StatusTone } from '../components/inventario/shared';
import { ITEM_TYPE_LABELS, quantityAt, stockAt, totalQuantity, type InventoryItem } from '../types/inventory';
import { compareText, type SortColumn } from './table-sort';

/** Columnas de la tabla de Inventario que ordenan (el `id` es el de `Table.Column`). */
export const INVENTORY_SORT_COLUMNS = [
  'sku',
  'nombre',
  'tipo',
  'categoria',
  'equipos',
  'existencia',
  'sucursal',
  'minimo',
  'estado',
] as const;
export type InventorySortColumn = (typeof INVENTORY_SORT_COLUMNS)[number];

/**
 * Severidad del estado: 0 = lo más urgente. En ascendente quedan primero los
 * «Sin stock», luego «Bajo stock mínimo», «Riesgo» y al final los OK.
 */
export function statusSeverity(item: InventoryItem, branchId: string): number {
  const status = stockStatus(item, branchId);
  if (status.label === 'Sin stock') return 0;
  const byTone: Record<StatusTone, number> = { peligro: 1, riesgo: 2, ok: 3 };
  return byTone[status.tone];
}

/**
 * Clave de la columna «Equipos»: los de un solo equipo ordenan por su código y
 * los «Varios» van después de ellos; sin equipos = vacío (siempre al final).
 */
export function equipmentsSortKey(item: InventoryItem): string | null {
  const [first] = item.compatibilities;
  if (!first) return null;
  return item.compatibilities.length === 1 ? `a|${first.internalCode}` : `b|${first.internalCode}`;
}

/** Sucursal donde más hay (la que mejor responde «¿dónde está?»); vacío sin existencia. */
function mainBranchName(item: InventoryItem, branchId: string): string | null {
  if (branchId !== ALL_BRANCHES) return quantityAt(item, branchId) > 0 ? (stockAt(item, branchId)?.branch.name ?? null) : null;
  const withStock = item.stocks.filter((s) => s.quantity > 0).sort((a, b) => b.quantity - a.quantity);
  return withStock[0]?.branch.name ?? null;
}

/** Desempate de todas las columnas: por nombre. */
const byName = (a: InventoryItem, b: InventoryItem): number => compareText(a.name, b.name);

export function inventorySortColumns(branchId: string): Record<InventorySortColumn, SortColumn<InventoryItem>> {
  const isAll = branchId === ALL_BRANCHES;
  return {
    sku: { kind: 'text', value: (i) => i.sku, tiebreak: byName },
    nombre: { kind: 'text', value: (i) => i.name },
    tipo: { kind: 'text', value: (i) => ITEM_TYPE_LABELS[i.type], tiebreak: byName },
    categoria: { kind: 'text', value: (i) => i.category?.name, tiebreak: byName },
    equipos: { kind: 'text', value: equipmentsSortKey, tiebreak: byName },
    existencia: {
      kind: 'number',
      value: (i) => (isAll ? totalQuantity(i) : quantityAt(i, branchId)),
      tiebreak: byName,
    },
    sucursal: { kind: 'text', value: (i) => mainBranchName(i, branchId), tiebreak: byName },
    minimo: {
      kind: 'number',
      value: (i) => {
        const minimum = stockAt(i, branchId)?.minimumQuantity ?? 0;
        return minimum > 0 ? minimum : null;
      },
      tiebreak: byName,
    },
    estado: { kind: 'number', value: (i) => statusSeverity(i, branchId), tiebreak: byName },
  };
}

/** Opciones del «Ordenar por» del celular (las columnas que hay en la tabla). */
export function inventorySortOptions(branchId: string): { id: string; label: string }[] {
  const options = [
    { id: 'sku', label: 'SKU' },
    { id: 'nombre', label: 'Nombre' },
    { id: 'tipo', label: 'Tipo' },
    { id: 'categoria', label: 'Categoría' },
    { id: 'equipos', label: 'Equipos' },
    { id: 'existencia', label: 'Existencia' },
    { id: 'sucursal', label: 'Sucursal' },
    ...(branchId === ALL_BRANCHES ? [] : [{ id: 'minimo', label: 'Mínimo' }]),
    { id: 'estado', label: 'Estado' },
  ];
  return options;
}

/** Orden por defecto de la lista: los críticos primero y, dentro de cada grupo, el del servidor (por nombre). */
export function defaultInventoryOrder(items: readonly InventoryItem[]): InventoryItem[] {
  return [...items].sort((a, b) => Number(b.isCritical) - Number(a.isCritical));
}
