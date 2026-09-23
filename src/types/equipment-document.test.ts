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
    fileUrl: null,
    notes: '',
  };

  it('acepta el form mínimo (solo tipo, el resto vacío/null)', () => {
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

  it('acepta un `fileUrl` ya subido', () => {
    expect(EquipmentDocumentFormSchema.safeParse({ ...valido, fileUrl: '/uploads/doc.pdf' }).success).toBe(true);
  });
});

describe('toCreateEquipmentDocumentPayload', () => {
  it('manda solo `type` cuando el resto de los campos vienen vacíos', () => {
    const payload = toCreateEquipmentDocumentPayload({
      type: 'OTHER',
      title: '',
      expiryDate: '',
      fileUrl: null,
      notes: '',
    });

    expect(payload).toEqual({ type: 'OTHER' });
  });

  it('manda title/expiryDate/fileUrl/notes recortados cuando vienen informados', () => {
    const payload = toCreateEquipmentDocumentPayload({
      type: 'INSURANCE',
      title: '  Póliza 2026 ',
      expiryDate: '2026-11-15',
      fileUrl: '/uploads/poliza.pdf',
      notes: '  Cubre robo y daños ',
    });

    expect(payload).toEqual({
      type: 'INSURANCE',
      title: 'Póliza 2026',
      expiryDate: '2026-11-15',
      fileUrl: '/uploads/poliza.pdf',
      notes: 'Cubre robo y daños',
    });
  });
});

describe('toUpdateEquipmentDocumentPayload', () => {
  it('manda `null` explícito en title/expiryDate/fileUrl/notes cuando vienen vacíos (a diferencia de crear)', () => {
    // Contrato del backend: en PATCH es la única forma de limpiar un valor ya
    // guardado — `type` es opcional pero NUNCA nullable.
    const payload = toUpdateEquipmentDocumentPayload({
      type: 'CERTIFICATION',
      title: '',
      expiryDate: '',
      fileUrl: null,
      notes: '',
    });

    expect(payload).toEqual({
      type: 'CERTIFICATION',
      title: null,
      expiryDate: null,
      fileUrl: null,
      notes: null,
    });
  });

  it('normaliza y manda el valor cuando el campo viene informado', () => {
    const payload = toUpdateEquipmentDocumentPayload({
      type: 'CIRCULATION_PERMIT',
      title: '  Permiso municipal ',
      expiryDate: '2027-03-01',
      fileUrl: '/uploads/permiso.pdf',
      notes: '  Renovar en marzo ',
    });

    expect(payload).toEqual({
      type: 'CIRCULATION_PERMIT',
      title: 'Permiso municipal',
      expiryDate: '2027-03-01',
      fileUrl: '/uploads/permiso.pdf',
      notes: 'Renovar en marzo',
    });
  });
});
