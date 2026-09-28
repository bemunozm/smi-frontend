import { describe, expect, it } from 'vitest';

import {
  OperatorFormSchema,
  toCreateOperatorPayload,
  toUpdateOperatorPayload,
  type OperatorFormValues,
} from './operator';

describe('OperatorFormSchema', () => {
  it('acepta un nombre sin RUT (opcional)', () => {
    const r = OperatorFormSchema.safeParse({ name: 'Juan Rojas', rut: '', isActive: true });
    expect(r.success).toBe(true);
  });

  it('acepta un RUT válido', () => {
    const r = OperatorFormSchema.safeParse({ name: 'Juan Rojas', rut: '12345678-5', isActive: true });
    expect(r.success).toBe(true);
  });

  it('rechaza un RUT con dígito verificador incorrecto', () => {
    const r = OperatorFormSchema.safeParse({ name: 'Juan Rojas', rut: '12345678-9', isActive: true });
    expect(r.success).toBe(false);
  });

  it('rechaza un nombre vacío', () => {
    const r = OperatorFormSchema.safeParse({ name: '', rut: '', isActive: true });
    expect(r.success).toBe(false);
  });
});

describe('toCreateOperatorPayload', () => {
  it('normaliza el RUT al formato canónico', () => {
    const values: OperatorFormValues = { name: '  Juan Rojas  ', rut: '12.345.678-5', isActive: true };
    expect(toCreateOperatorPayload(values)).toEqual({ name: 'Juan Rojas', rut: '12345678-5' });
  });

  it('omite `rut` si viene vacío (no manda una clave vacía)', () => {
    const values: OperatorFormValues = { name: 'Juan Rojas', rut: '  ', isActive: true };
    expect(toCreateOperatorPayload(values)).toEqual({ name: 'Juan Rojas' });
  });
});

describe('toUpdateOperatorPayload', () => {
  it('incluye `isActive` (el create no lo manda, el update sí)', () => {
    const values: OperatorFormValues = { name: 'Juan Rojas', rut: '', isActive: false };
    expect(toUpdateOperatorPayload(values)).toEqual({ name: 'Juan Rojas', rut: undefined, isActive: false });
  });

  it('normaliza el RUT igual que en la creación', () => {
    const values: OperatorFormValues = { name: 'Juan Rojas', rut: '40000000-k', isActive: true };
    expect(toUpdateOperatorPayload(values).rut).toBe('40000000-K');
  });
});
