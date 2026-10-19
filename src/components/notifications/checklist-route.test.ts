import { describe, expect, it } from 'vitest';

import { rutaDeChecklist } from './checklist-route';
import type { Notificacion } from '../../types/notificacion';

const aviso = (tipo: string, data: Record<string, unknown> | null): Notificacion =>
  ({ id: 'n1', userId: 'u1', tipo, titulo: '', cuerpo: '', leida: false, data }) as unknown as Notificacion;

describe('rutaDeChecklist', () => {
  it('el aviso de un checklist enviado lleva al supervisor a validarlo', () => {
    expect(rutaDeChecklist(aviso('checklist.submitted', { checklistId: 'c1' }), 'SUPERVISOR')).toBe(
      '/terreno/checklists?id=c1',
    );
  });

  it('un rechazo lleva al mantenedor directo a corregirlo', () => {
    expect(
      rutaDeChecklist(aviso('checklist.reviewed', { checklistId: 'c1', decision: 'REJECTED' }), 'MANTENEDOR'),
    ).toBe('/mantenimiento/checklist?corregir=c1');
    expect(
      rutaDeChecklist(aviso('checklist.reviewed', { checklistId: 'c1', decision: 'ACCEPTED' }), 'MANTENEDOR'),
    ).toBe('/mantenimiento/checklist');
  });

  it('al administrador lo lleva al detalle en Terreno', () => {
    expect(rutaDeChecklist(aviso('checklist.reviewed', { checklistId: 'c1', decision: 'ACCEPTED' }), 'ADMIN')).toBe(
      '/terreno/checklists?id=c1',
    );
  });

  it('sin checklist en el aviso no navega', () => {
    expect(rutaDeChecklist(aviso('checklist.submitted', null), 'SUPERVISOR')).toBeNull();
  });
});
