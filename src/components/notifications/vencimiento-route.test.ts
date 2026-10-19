import { describe, expect, it } from 'vitest';

import { rutaDeVencimiento } from './vencimiento-route';
import type { Notificacion } from '../../types/notificacion';

const aviso = (tipo: string, data: Record<string, unknown> | null = { equipmentId: 'eq_1' }): Notificacion =>
  ({ id: 'n1', userId: 'u1', tipo, titulo: '', cuerpo: '', leida: false, data }) as unknown as Notificacion;

describe('rutaDeVencimiento', () => {
  it('un documento por vencer lleva a la ficha del equipo (con su calendario)', () => {
    expect(rutaDeVencimiento(aviso('document.expiring'), 'ADMIN')).toBe('/equipos/eq_1');
    expect(rutaDeVencimiento(aviso('document.expiring'), 'MANTENEDOR')).toBe('/mantenimiento/equipos/eq_1');
  });

  it('la mantención por km lleva al mantenedor a sus órdenes y al admin a la ficha', () => {
    expect(rutaDeVencimiento(aviso('light-service.due'), 'MANTENEDOR')).toBe('/mantenimiento/ordenes');
    expect(rutaDeVencimiento(aviso('light-service.due'), 'ADMIN')).toBe('/equipos/eq_1');
  });

  it('sin equipo en el aviso, al calendario de todos los livianos', () => {
    expect(rutaDeVencimiento(aviso('document.expiring', null), 'ADMIN')).toBe('/equipos/vencimientos');
    expect(rutaDeVencimiento(aviso('document.expiring', null), 'MANTENEDOR')).toBe('/mantenimiento/vencimientos');
  });

  it('otros avisos no son de vencimientos', () => {
    expect(rutaDeVencimiento(aviso('hallazgo.created'), 'ADMIN')).toBeNull();
  });
});
