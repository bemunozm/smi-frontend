import { describe, expect, it } from 'vitest';

import { ENDPOINTS } from './index';

/**
 * Cerrar una orden preventiva (o marcar una de sus tareas) escribe el último
 * cambio real del equipo: la pizarra, la próxima mantención y la fecha
 * estimada cuelgan de `maintenancePlans` y tienen que recalcularse.
 */
describe('invalidaciones de las órdenes de mantenimiento', () => {
  it.each(['orden.update', 'orden.toggleTarea'] as const)(
    '%s refresca las pautas (ancla, pizarra y pronóstico)',
    (endpoint) => {
      expect(ENDPOINTS[endpoint].invalidate).toContain('maintenancePlans');
      expect(ENDPOINTS[endpoint].invalidate).toContain('ordenes');
    },
  );
});
