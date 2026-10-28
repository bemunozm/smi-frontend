import { describe, expect, it } from 'vitest';

import {
  ItemListResponseSchema,
  isBelowMinimumAt,
  quantityAt,
  contenidoDe,
  equivalencia,
  toCreateItemPayload,
  toItemEditValues,
  toUpdateItemPayload,
  totalQuantity,
  type InventoryItem,
} from './inventory';

function item(stocks: InventoryItem['stocks']): InventoryItem {
  return {
    id: 'item_1',
    sku: 'NEU-001',
    name: 'Neumático 29.5R25',
    description: null,
    unit: 'UNIT',
    type: 'PART',
    categoryId: null,
    category: null,
    partNumber: null,
    defaultSupplier: null,
    isCritical: false,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    stocks,
  };
}

const CASA = { id: 'b1', name: 'Casa Matriz' };
const FAENA = { id: 'b2', name: 'Faena' };

describe('quantityAt', () => {
  it('devuelve 0 si la bodega nunca manejó el ítem', () => {
    // Sin fila no es un error: "existe en la empresa pero NO acá" es justamente
    // la información que la pantalla tiene que dar.
    expect(quantityAt(item([]), 'b1')).toBe(0);
  });

  it('devuelve el saldo de esa bodega y no el de otra', () => {
    const subject = item([
      { branchId: 'b1', quantity: 4, minimumQuantity: 0, branch: CASA },
      { branchId: 'b2', quantity: 20, minimumQuantity: 0, branch: FAENA },
    ]);
    expect(quantityAt(subject, 'b1')).toBe(4);
    expect(quantityAt(subject, 'b2')).toBe(20);
  });
});

describe('totalQuantity', () => {
  it('suma las bodegas en vez de leer un total guardado', () => {
    // RFC-3: no hay columna espejo en el ítem, así que no hay dos números que
    // puedan discrepar.
    const subject = item([
      { branchId: 'b1', quantity: 4, minimumQuantity: 0, branch: CASA },
      { branchId: 'b2', quantity: 20, minimumQuantity: 0, branch: FAENA },
    ]);
    expect(totalQuantity(subject)).toBe(24);
  });
});

describe('isBelowMinimumAt', () => {
  it('alerta cuando el saldo cruzó el mínimo de esa bodega', () => {
    const subject = item([
      { branchId: 'b1', quantity: 2, minimumQuantity: 5, branch: CASA },
    ]);
    expect(isBelowMinimumAt(subject, 'b1')).toBe(true);
  });

  it('NO alerta si la bodega no fijó un mínimo propio', () => {
    // `minimumQuantity = 0` es "no configurado". Heredar el umbral de la
    // empresa encendería la alerta en todas las filas a la vez, y una alerta
    // que se enciende siempre enseña a ignorar la pantalla.
    const subject = item([
      { branchId: 'b1', quantity: 0, minimumQuantity: 0, branch: CASA },
    ]);
    expect(isBelowMinimumAt(subject, 'b1')).toBe(false);
  });

  it('NO alerta por una bodega que no maneja el ítem', () => {
    const subject = item([
      { branchId: 'b2', quantity: 1, minimumQuantity: 5, branch: FAENA },
    ]);
    expect(isBelowMinimumAt(subject, 'b1')).toBe(false);
  });
});

describe('toCreateItemPayload', () => {
  it('omite la bodega cuando no hay existencia inicial', () => {
    // El backend solo exige `branchId` si entra material: mandarlo igual
    // obligaría a elegir bodega para dar de alta un ítem que llega después.
    const payload = toCreateItemPayload(
      {
        name: '  Filtro  ',
        description: '',
        unit: 'UNIT',
        contentPerUnit: '',
        contentUnit: 'LITER',
        type: 'PART',
        categoryId: '',
        partNumber: '',
        defaultSupplier: '',
        isCritical: false,
        initialQuantity: '0',
      },
      'b1',
    );
    // Sin SKU: lo genera el servidor.
    expect(payload).toEqual({
      name: 'Filtro',
      unit: 'UNIT',
      type: 'PART',
      isCritical: false,
    });
  });

  it('manda cantidad y bodega cuando hay existencia inicial', () => {
    const payload = toCreateItemPayload(
      {
        name: 'Filtro',
        description: 'Serie C',
        unit: 'UNIT',
        contentPerUnit: '',
        contentUnit: 'LITER',
        type: 'PART',
        categoryId: 'c1',
        partNumber: '1R-0750',
        defaultSupplier: '  Comercial Iquique  ',
        isCritical: true,
        initialQuantity: '40',
      },
      'b1',
    );
    expect(payload).toMatchObject({
      initialQuantity: 40,
      branchId: 'b1',
      categoryId: 'c1',
      partNumber: '1R-0750',
      defaultSupplier: 'Comercial Iquique',
      isCritical: true,
      description: 'Serie C',
    });
  });
});

describe('contenido por unidad', () => {
  const base = {
    name: 'AdBlue',
    description: '',
    type: 'SUPPLY' as const,
    categoryId: '',
    partNumber: '',
    defaultSupplier: '',
    isCritical: false,
  };

  it('en unidades con 10 L c/u: viaja el contenido y la existencia se lee en litros', () => {
    const values = { ...base, unit: 'UNIT' as const, contentPerUnit: '10', contentUnit: 'LITER' as const, initialQuantity: '12' };
    expect(toCreateItemPayload(values, 'b1')).toMatchObject({
      unit: 'UNIT',
      contentPerUnit: 10,
      contentUnit: 'LITER',
      initialQuantity: 12,
    });
    expect(equivalencia(12, contenidoDe(values))).toBe('12 u × 10 L = 120 L');
  });

  it('en litros no viaja contenido: 120 son 120 L', () => {
    const values = { ...base, unit: 'LITER' as const, contentPerUnit: '10', contentUnit: 'LITER' as const, initialQuantity: '120' };
    const payload = toCreateItemPayload(values, 'b1');
    expect(payload).not.toHaveProperty('contentPerUnit');
    expect(payload).toMatchObject({ unit: 'LITER', initialQuantity: 120 });
    expect(contenidoDe(values)).toBeNull();
  });

  it('al editar, pasar a litros borra el contenido (null explícito)', () => {
    expect(
      toUpdateItemPayload({ ...base, unit: 'LITER', contentPerUnit: '10', contentUnit: 'LITER', isActive: true }),
    ).toMatchObject({ contentPerUnit: null, contentUnit: null });
  });
});

describe('toUpdateItemPayload', () => {
  it('manda categoryId en null cuando se quitó la categoría', () => {
    // Omitirlo significa "no lo toques" para el backend: si el formulario
    // omitiera el campo vacío, un ítem mal clasificado se podría reclasificar
    // pero nunca dejar sin categoría.
    const payload = toUpdateItemPayload({
      name: 'Filtro',
      description: '',
      unit: 'UNIT',
      contentPerUnit: '',
      contentUnit: 'LITER',
      type: 'PART',
      categoryId: '',
      partNumber: '',
      defaultSupplier: '',
      isCritical: false,
      isActive: true,
    });

    expect(payload.categoryId).toBeNull();
  });

  it('carga la ficha guardada sin perder los campos nulos', () => {
    // `null` en la base es "" en el formulario: un `null` llegando a un input
    // controlado lo vuelve no controlado y React se queja en consola.
    const values = toItemEditValues({
      ...item([]),
      description: null,
      partNumber: null,
      defaultSupplier: null,
      categoryId: null,
      category: null,
    });

    expect(values).toMatchObject({
      description: '',
      partNumber: '',
      defaultSupplier: '',
      categoryId: '',
    });
  });
});

describe('ItemListResponseSchema', () => {
  it('valida la envoltura { data, message } del backend', () => {
    const parsed = ItemListResponseSchema.parse({
      data: [
        item([{ branchId: 'b1', quantity: 4, minimumQuantity: 2, branch: CASA }]),
      ],
      message: 'ok',
    });
    expect(parsed.data[0].sku).toBe('NEU-001');
  });

  it('rechaza un tipo de ítem fuera del vocabulario', () => {
    const result = ItemListResponseSchema.safeParse({
      data: [{ ...item([]), type: 'OTRO' }],
      message: 'ok',
    });
    expect(result.success).toBe(false);
  });
});
