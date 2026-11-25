import { describe, expect, it } from 'vitest';

import { ROLES } from '../types/roles';
import { NAV_ITEMS, NAV_SECCIONES, navItemsDe } from './nav-items';

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

    expect(labelsDe('Administración')).toEqual(['Dashboard', 'Equipos', 'Inventario', 'Mi camioneta', 'Empresas externas']);
    expect(labelsDe('Reportes')).toEqual([
      'Informe diario equipos',
      'Chequeos diarios',
      'Informe de producción diaria',
      'Hallazgos',
      'Report',
      'Report supervisor temporal',
      'Cargas de combustible',
      'Mantenciones',
      'Asistencia',
      'Registro de actividad',
    ]);
    expect(labelsDe('Usuarios')).toEqual(['Operadores', 'Usuarios', 'Notificaciones']);
  });

  it('el Dashboard (`/`) es de ADMIN y SECRETARIA: el resto consumiría 403 de /api/dashboard/*', () => {
    const dashboard = NAV_ITEMS.find((item) => item.to === '/');
    expect(dashboard?.roles).toEqual([ROLES.ADMIN, ROLES.SECRETARIA]);
  });

  it('SECRETARIA ve el dashboard, Equipos, Inventario, los diez reportes del administrador y notificaciones', () => {
    const suyos = NAV_ITEMS.filter((item) => item.roles.includes(ROLES.SECRETARIA)).map((item) => item.to);
    expect(suyos).toEqual([
      '/',
      '/equipos',
      '/inventario',
      '/reportes',
      '/chequeos-diarios',
      '/reportes-diarios',
      '/hallazgos',
      '/trabajos-extra',
      '/informes-temporales',
      '/cargas-combustible',
      '/mantenciones',
      '/asistencia',
      '/registro-actividad',
      '/notificaciones',
    ]);
  });

  it('Terreno y Mantenimiento no van en el menú: son los home de sus roles', () => {
    expect(NAV_ITEMS.find((item) => item.to === '/terreno')).toBeUndefined();
    expect(NAV_ITEMS.find((item) => item.to === '/mantenimiento')).toBeUndefined();
  });
});

describe('navItemsDe', () => {
  it('«Report supervisor temporal» es de ADMIN y SECRETARIA, no del supervisor', () => {
    const labels = (rol: Parameters<typeof navItemsDe>[0]) => navItemsDe(rol, false).map((i) => i.label);
    expect(labels(ROLES.ADMIN)).toContain('Report supervisor temporal');
    expect(labels(ROLES.SECRETARIA)).toContain('Report supervisor temporal');
    expect(labels(ROLES.SUPERVISOR)).not.toContain('Report supervisor temporal');
  });

  it('«Mi camioneta» solo le aparece al administrador que usa camioneta', () => {
    const labels = (usa: boolean) => navItemsDe(ROLES.ADMIN, usa).map((i) => i.label);
    expect(labels(true)).toContain('Mi camioneta');
    expect(labels(false)).not.toContain('Mi camioneta');
    expect(labels(false)).toContain('Inventario');
  });

  it('sin rol no hay menú', () => {
    expect(navItemsDe(null, true)).toEqual([]);
  });
});
