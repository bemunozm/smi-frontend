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

  it('manda fileKey + fileName cuando el usuario adjuntó un archivo', () => {
    const payload = toCreateEquipmentDocumentPayload(
      { type: 'INSURANCE', title: '', expiryDate: '', notes: '' },
      { key: 'tmp/u1/poliza.pdf', name: 'Póliza Seguro.pdf' },
    );

    expect(payload).toEqual({
      type: 'INSURANCE',
      fileKey: 'tmp/u1/poliza.pdf',
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

  // `fileKey`/`fileName` son tri-state — igual criterio que `photoKey` en
  // `types/equipment.test.ts`: sin tocarlo, el PATCH no debe pisar el
  // archivo ya guardado.
  describe('fileKey/fileName (tri-state)', () => {
    const base = { type: 'OTHER' as const, title: '', expiryDate: '', notes: '' };

    it('sin segundo argumento, omite fileKey y fileName por completo (sin cambios)', () => {
      const payload = toUpdateEquipmentDocumentPayload(base);

      expect('fileKey' in payload).toBe(false);
      expect('fileName' in payload).toBe(false);
    });

    it('con {key: null, name: null}, los manda para quitar el archivo', () => {
      const payload = toUpdateEquipmentDocumentPayload(base, { key: null, name: null });

      expect(payload.fileKey).toBeNull();
      expect(payload.fileName).toBeNull();
    });

    it('con {key, name}, manda el archivo nuevo', () => {
      const payload = toUpdateEquipmentDocumentPayload(base, {
        key: 'tmp/u1/nuevo.pdf',
        name: 'Certificado.pdf',
      });

      expect(payload.fileKey).toBe('tmp/u1/nuevo.pdf');
      expect(payload.fileName).toBe('Certificado.pdf');
    });
  });
});
