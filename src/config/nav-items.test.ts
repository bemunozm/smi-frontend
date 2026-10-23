import { describe, expect, it } from 'vitest';

import { ROLES } from '../types/roles';
import { NAV_ITEMS, NAV_SECCIONES } from './nav-items';

describe('NAV_ITEMS', () => {
  it('el menú se agrupa en Administración → Reportes → Usuarios, en ese orden', () => {
    expect(NAV_SECCIONES).toEqual(['Administración', 'Reportes', 'Usuarios']);

    // Cada item pertenece a una sección conocida, y el orden del arreglo
    // sigue el de las secciones (el Sidebar los pinta agrupados).
    const secuencia = NAV_ITEMS.map((item) => NAV_SECCIONES.indexOf(item.seccion));
    expect(secuencia.every((indice) => indice >= 0)).toBe(true);
    expect([...secuencia].sort((a, b) => a - b)).toEqual(secuencia);
  });

  it('cada sección agrupa lo suyo: administración, registros/reportes y personas', () => {
    const labelsDe = (seccion: string) =>
      NAV_ITEMS.filter((item) => item.seccion === seccion).map((item) => item.label);

    expect(labelsDe('Administración')).toEqual(['Dashboard', 'Equipos', 'Inventario']);
    expect(labelsDe('Reportes')).toEqual([
      'Reportes',
      'Reportes diarios',
      'Hallazgos',
      'Trabajos extra',
      'Mantenciones',
    ]);
    expect(labelsDe('Usuarios')).toEqual(['Operadores', 'Usuarios', 'Notificaciones']);
  });

  it('el Dashboard (`/`) es solo ADMIN: el resto consumiría 403 de /api/dashboard/*', () => {
    const dashboard = NAV_ITEMS.find((item) => item.to === '/');
    expect(dashboard?.roles).toEqual([ROLES.ADMIN]);
  });

  it('Terreno y Mantenimiento no van en el menú: son los home de sus roles', () => {
    expect(NAV_ITEMS.find((item) => item.to === '/terreno')).toBeUndefined();
    expect(NAV_ITEMS.find((item) => item.to === '/mantenimiento')).toBeUndefined();
  });
});
