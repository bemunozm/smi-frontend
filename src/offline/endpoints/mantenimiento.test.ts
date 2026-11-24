import { describe, expect, it } from 'vitest';

import { ENDPOINTS } from './index';

/**
 * Cerrar una orden preventiva (o marcar una de sus tareas) escribe el último
 * cambio real del equipo: la pizarra, la próxima mantención y la fecha
 * estimada cuelgan de `maintenancePlans` y tienen que recalcularse.
 */
describe('invalidaciones de las órdenes de mantenimiento', () => {
  it.each(['orden.update', 'orden.toggleTarea', 'orden.finalizar'] as const)(
    '%s refresca las pautas (ancla, pizarra y pronóstico)',
    (endpoint) => {
      expect(ENDPOINTS[endpoint].invalidate).toContain('maintenancePlans');
      expect(ENDPOINTS[endpoint].invalidate).toContain('ordenes');
    },
  );
});

/**
 * «Finalizar tarea» en una sola escritura: la intervención (con su stock), el
 * paso a COMPLETADA y el ancla de la mantención se guardan juntos o nada.
 */
describe('orden.finalizar', () => {
  const def = ENDPOINTS['orden.finalizar'];

  it('es un POST a /ordenes/:id/finalizar que actúa sobre la orden', () => {
    expect(def.method).toBe('POST');
    expect(def.path({ id: 'ot-1' })).toBe('/api/mantenimiento/ordenes/ot-1/finalizar');
    expect(def.entity?.({ id: 'ot-1' }, { id: 'int-1' })).toBe('orden:ot-1');
    expect(def.notFoundIsDone).toBe(false);
  });

  it('lleva la foto del cierre como archivo', () => {
    expect(def.carriesFiles).toBe(true);
  });

  it('invalida lo que invalidaban la intervención y la edición de la orden juntas', () => {
    const union = new Set([...ENDPOINTS['intervencion.create'].invalidate, ...ENDPOINTS['orden.update'].invalidate]);
    expect(new Set(def.invalidate)).toEqual(union);
  });

  it('lee la respuesta { orden, intervencion }', () => {
    const orden = {
      id: 'ot-1',
      equipoId: 'TLJD77',
      hallazgoId: null,
      pautaMilestone: null,
      pautaCycle: null,
      titulo: 'Mantención 264.582 km',
      estado: 'COMPLETADA',
      prioridad: 'MEDIA',
      tipo: 'PREVENTIVA',
      origen: 'PREVENTIVO',
      origenDetalle: null,
      asignadoA: null,
      tareas: [],
      createdAt: '2026-11-20T10:00:00.000Z',
      updatedAt: '2026-11-24T10:00:00.000Z',
    };
    const intervencion = {
      id: 'int-1',
      ordenId: 'ot-1',
      tipo: 'PREVENTIVA',
      detalle: 'Cambio de aceite',
      horasHombre: 0,
      horometro: null,
      fotoUrl: null,
      soloLectura: true,
      insumos: [],
      fecha: '2026-11-24T10:00:00.000Z',
    };
    expect(def.parse({ orden, intervencion })).toMatchObject({ orden: { estado: 'COMPLETADA' }, intervencion });
    expect(def.parse({ orden })).toBeNull();
    // Un backend que aún no manda `fotoUrls` (desplegado antes): la lista queda vacía.
    expect(def.parse({ orden, intervencion })?.intervencion.fotoUrls).toEqual([]);
    const fotoUrls = ['https://s/1.jpg', 'https://s/2.jpg'];
    expect(
      def.parse({ orden, intervencion: { ...intervencion, fotoUrl: fotoUrls[0], fotoUrls } })?.intervencion,
    ).toMatchObject({ fotoUrl: fotoUrls[0], fotoUrls });
  });
});
