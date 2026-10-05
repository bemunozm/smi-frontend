import { describe, expect, it } from 'vitest';

import { NAV_ITEMS } from './nav-items';
import { PREP_KEYS, prepKeysFor } from './offline-prep';
import { ROLES } from '../types/roles';

describe('prepKeysFor — qué se precarga por rol', () => {
  it('ADMIN y MANTENEDOR precargan equipos, sucursales, operadores, inventario y mantenimiento', () => {
    for (const role of [ROLES.ADMIN, ROLES.MANTENEDOR]) {
      expect(prepKeysFor(role), role).toEqual(
        expect.arrayContaining(['equipment', 'branches', 'operators', 'inventory', 'maintenance']),
      );
    }
  });

  it('MANTENEDOR no ve Terreno: no precarga tarjetas, hallazgos ni trabajos', () => {
    const keys = prepKeysFor(ROLES.MANTENEDOR);

    expect(keys).not.toContain('shiftCards');
    expect(keys).not.toContain('hallazgos');
    expect(keys).not.toContain('trabajosExtra');
    expect(keys).not.toContain('horometro');
  });

  it('SUPERVISOR no ve Mantenimiento pero sí Terreno, Equipos, Inventario y Operadores', () => {
    const keys = prepKeysFor(ROLES.SUPERVISOR);

    expect(keys).not.toContain('maintenance');
    expect(keys).toEqual(
      expect.arrayContaining(['equipment', 'inventory', 'branches', 'operators', 'shiftCards', 'hallazgos', 'trabajosExtra', 'horometro']),
    );
  });

  it('ADMIN ve todo: precarga todas las listas', () => {
    expect(prepKeysFor(ROLES.ADMIN)).toEqual([...PREP_KEYS]);
  });

  it('todos los roles con menú precargan el panel y las notificaciones; los movimientos acompañan a Inventario', () => {
    for (const role of [ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.MANTENEDOR]) {
      expect(prepKeysFor(role), role).toEqual(expect.arrayContaining(['dashboard', 'notificaciones', 'movimientos']));
    }
  });

  it('la bitácora acompaña a Mantenimiento y el combustible a Terreno', () => {
    expect(prepKeysFor(ROLES.MANTENEDOR)).toContain('bitacora');
    expect(prepKeysFor(ROLES.MANTENEDOR)).not.toContain('combustible');
    expect(prepKeysFor(ROLES.SUPERVISOR)).toContain('combustible');
    expect(prepKeysFor(ROLES.SUPERVISOR)).not.toContain('bitacora');
  });

  it('sin rol reconocido se prepara lo de Terreno (la barra de Terreno antes de resolver la sesión)', () => {
    expect(prepKeysFor(null)).toEqual([
      'equipment',
      'operators',
      'shiftCards',
      'hallazgos',
      'trabajosExtra',
      'horometro',
      'combustible',
    ]);
    expect(prepKeysFor(undefined)).toEqual(prepKeysFor(null));
  });

  it('sigue al menú: una pantalla que el rol no ve en NAV_ITEMS no aporta listas', () => {
    for (const role of Object.values(ROLES)) {
      const rutas = NAV_ITEMS.filter((item) => item.roles.includes(role)).map((item) => item.to);
      if (!rutas.includes('/mantenimiento')) expect(prepKeysFor(role)).not.toContain('maintenance');
      if (!rutas.includes('/inventario')) expect(prepKeysFor(role)).not.toContain('inventory');
    }
  });

  it('sin repetidos y en un orden estable', () => {
    const keys = prepKeysFor(ROLES.ADMIN);

    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toEqual(prepKeysFor(ROLES.ADMIN));
  });
});
