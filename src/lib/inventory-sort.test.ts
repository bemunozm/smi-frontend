import { describe, expect, it } from 'vitest';

import { ALL_BRANCHES } from '../components/inventario/shared';
import type { InventoryItem } from '../types/inventory';
import {
  defaultInventoryOrder,
  equipmentsSortKey,
  inventorySortColumns,
  inventorySortOptions,
  statusSeverity,
} from './inventory-sort';
import { sortRows } from './table-sort';

const CASA = { id: 'b1', name: 'Casa Matriz' };
const FAENA = { id: 'b2', name: 'Faena' };

function item(over: Partial<InventoryItem> & Pick<InventoryItem, 'id' | 'name'>): InventoryItem {
  return {
    sku: over.id.toUpperCase(),
    description: null,
    unit: 'UNIT',
    type: 'SUPPLY',
    categoryId: null,
    category: null,
    partNumber: null,
    defaultSupplier: null,
    isCritical: false,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    stocks: [],
    compatibilities: [],
    ...over,
  };
}

const eq = (internalCode: string) => ({ equipmentId: internalCode, internalCode, note: null });
const ids = (rows: InventoryItem[]) => rows.map((r) => r.id);

describe('equipmentsSortKey', () => {
  it('sin equipos no tiene clave (va al final); uno y varios se distinguen', () => {
    expect(equipmentsSortKey(item({ id: 'a', name: 'A' }))).toBeNull();
    expect(equipmentsSortKey(item({ id: 'a', name: 'A', compatibilities: [eq('EXC-01')] }))).toBe('a|EXC-01');
    expect(equipmentsSortKey(item({ id: 'a', name: 'A', compatibilities: [eq('EXC-01'), eq('CAM-02')] }))).toBe(
      'b|EXC-01',
    );
  });
});

describe('statusSeverity', () => {
  const con = (quantity: number, minimumQuantity: number) =>
    item({ id: 'x', name: 'X', stocks: [{ branchId: 'b1', quantity, minimumQuantity, branch: CASA }] });

  it('sin stock < bajo mínimo < riesgo < OK', () => {
    expect(statusSeverity(con(0, 5), ALL_BRANCHES)).toBe(0);
    expect(statusSeverity(con(4, 5), ALL_BRANCHES)).toBe(1);
    expect(statusSeverity(con(6, 5), ALL_BRANCHES)).toBe(2);
    expect(statusSeverity(con(50, 5), ALL_BRANCHES)).toBe(3);
  });
});

describe('inventorySortColumns', () => {
  const A = item({
    id: 'a',
    name: 'Aceite',
    type: 'SUPPLY',
    category: { id: 'c1', name: 'Líquidos' },
    stocks: [
      { branchId: 'b1', quantity: 10, minimumQuantity: 4, branch: CASA },
      { branchId: 'b2', quantity: 2, minimumQuantity: 0, branch: FAENA },
    ],
    compatibilities: [eq('EXC-01')],
  });
  const B = item({
    id: 'b',
    name: 'Bujía',
    type: 'PART',
    stocks: [{ branchId: 'b2', quantity: 30, minimumQuantity: 0, branch: FAENA }],
    compatibilities: [eq('CAM-02'), eq('EXC-01')],
  });
  const C = item({ id: 'c', name: 'Correa', type: 'PART', category: { id: 'c2', name: 'Correas' } });
  const rows = [C, B, A];

  const ordenar = (column: string, direction: 'ascending' | 'descending' = 'ascending', branchId = ALL_BRANCHES) =>
    ids(sortRows(rows, { column, direction }, inventorySortColumns(branchId)));

  it('texto: tipo y categoría (sin categoría al final)', () => {
    expect(ordenar('tipo')).toEqual(['b', 'c', 'a']); // Repuesto, Repuesto, Suministro (desempate por nombre)
    expect(ordenar('categoria')).toEqual(['c', 'a', 'b']);
    expect(ordenar('categoria', 'descending')).toEqual(['a', 'c', 'b']);
  });

  it('equipos: uno solo, luego «Varios», los vacíos al final en ambos sentidos', () => {
    expect(ordenar('equipos')).toEqual(['a', 'b', 'c']);
    expect(ordenar('equipos', 'descending')).toEqual(['b', 'a', 'c']);
  });

  it('existencia: numérico, con el total o con la sucursal elegida', () => {
    expect(ordenar('existencia')).toEqual(['c', 'a', 'b']); // 0, 12, 30
    expect(ordenar('existencia', 'ascending', 'b2')).toEqual(['c', 'a', 'b']); // 0, 2, 30
  });

  it('sucursal: por el nombre de donde más hay; sin existencia al final', () => {
    expect(ordenar('sucursal')).toEqual(['a', 'b', 'c']); // Casa Matriz, Faena, vacío
  });

  it('estado: lo más urgente primero', () => {
    // C sin stock (0), A: bajo mínimo? 10>4*1.25 → OK pero Faena sin mínimo con 2 → OK (3); B OK (3)
    expect(ordenar('estado')[0]).toBe('c');
  });

  it('el mínimo solo es una opción con una sucursal elegida', () => {
    expect(inventorySortOptions(ALL_BRANCHES).map((o) => o.id)).not.toContain('minimo');
    expect(inventorySortOptions('b1').map((o) => o.id)).toContain('minimo');
  });
});

describe('defaultInventoryOrder', () => {
  it('los críticos primero y, dentro de cada grupo, el orden que ya traía', () => {
    const lista = [
      item({ id: 'a', name: 'A' }),
      item({ id: 'b', name: 'B', isCritical: true }),
      item({ id: 'c', name: 'C' }),
      item({ id: 'd', name: 'D', isCritical: true }),
    ];
    expect(ids(defaultInventoryOrder(lista))).toEqual(['b', 'd', 'a', 'c']);
  });
});
