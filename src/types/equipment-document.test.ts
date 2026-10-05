import { describe, expect, it } from 'vitest';

import {
  EquipmentDocumentFormSchema,
  toCreateEquipmentDocumentPayload,
  toUpdateEquipmentDocumentPayload,
} from './equipment-document';

describe('EquipmentDocumentFormSchema', () => {
  const valido = {
    type: 'TECHNICAL_INSPECTION' as const,
    title: '',
    expiryDate: '',
    notes: '',
  };

  it('acepta el form mínimo (solo tipo, el resto vacío)', () => {
    expect(EquipmentDocumentFormSchema.safeParse(valido).success).toBe(true);
  });

  it('rechaza un tipo fuera del vocabulario', () => {
    expect(EquipmentDocumentFormSchema.safeParse({ ...valido, type: 'OTRO_INVENTADO' }).success).toBe(false);
  });

  it('acepta una fecha de vencimiento bien formada (`YYYY-MM-DD`, formato de `<Input type="date">`)', () => {
    expect(EquipmentDocumentFormSchema.safeParse({ ...valido, expiryDate: '2026-11-15' }).success).toBe(true);
  });

  it('rechaza una fecha de vencimiento mal formada', () => {
    expect(EquipmentDocumentFormSchema.safeParse({ ...valido, expiryDate: '15/11/2026' }).success).toBe(false);
  });
});

describe('toCreateEquipmentDocumentPayload', () => {
  it('manda solo `type` cuando el resto de los campos vienen vacíos y sin archivo', () => {
    const payload = toCreateEquipmentDocumentPayload({
      type: 'OTHER',
      title: '',
      expiryDate: '',
      notes: '',
    });

    expect(payload).toEqual({ type: 'OTHER' });
  });

  it('manda title/expiryDate/notes recortados cuando vienen informados', () => {
    const payload = toCreateEquipmentDocumentPayload({
      type: 'INSURANCE',
      title: '  Póliza 2026 ',
      expiryDate: '2026-11-15',
      notes: '  Cubre robo y daños ',
    });

    expect(payload).toEqual({
      type: 'INSURANCE',
      title: 'Póliza 2026',
      expiryDate: '2026-11-15',
      notes: 'Cubre robo y daños',
    });
  });

  it('manda solo fileName cuando el usuario adjuntó un archivo (el archivo viaja aparte)', () => {
    const payload = toCreateEquipmentDocumentPayload(
      { type: 'INSURANCE', title: '', expiryDate: '', notes: '' },
      new File(['x'], 'Póliza Seguro.pdf', { type: 'application/pdf' }),
    );

    expect(payload).toEqual({
      type: 'INSURANCE',
      fileName: 'Póliza Seguro.pdf',
    });
  });
});

describe('toUpdateEquipmentDocumentPayload', () => {
  it('manda `null` explícito en title/expiryDate/notes cuando vienen vacíos (a diferencia de crear)', () => {
    // Contrato del backend: en PATCH es la única forma de limpiar un valor ya
    // guardado — `type` es opcional pero NUNCA nullable.
    const payload = toUpdateEquipmentDocumentPayload({
      type: 'CERTIFICATION',
      title: '',
      expiryDate: '',
      notes: '',
    });

    expect(payload).toEqual({
      type: 'CERTIFICATION',
      title: null,
      expiryDate: null,
      notes: null,
    });
  });

  it('normaliza y manda el valor cuando el campo viene informado', () => {
    const payload = toUpdateEquipmentDocumentPayload({
      type: 'CIRCULATION_PERMIT',
      title: '  Permiso municipal ',
      expiryDate: '2027-03-01',
      notes: '  Renovar en marzo ',
    });

    expect(payload).toEqual({
      type: 'CIRCULATION_PERMIT',
      title: 'Permiso municipal',
      expiryDate: '2027-03-01',
      notes: 'Renovar en marzo',
    });
  });

  it('el archivo no va en este body: lo recibe aparte el hook', () => {
    const payload = toUpdateEquipmentDocumentPayload({ type: 'OTHER', title: '', expiryDate: '', notes: '' });

    expect('fileKey' in payload).toBe(false);
    expect('fileName' in payload).toBe(false);
  });
});
