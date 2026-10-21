import { describe, expect, it, vi } from 'vitest';

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

  it('MANTENEDOR no ve Terreno: no precarga tarjetas, hallazgos, trabajos ni reportes diarios', () => {
    const keys = prepKeysFor(ROLES.MANTENEDOR);

    expect(keys).not.toContain('shiftCards');
    expect(keys).not.toContain('hallazgos');
    expect(keys).not.toContain('trabajosExtra');
    expect(keys).not.toContain('horometro');
    expect(keys).not.toContain('reporteDiario');
  });

  it('SUPERVISOR no ve Mantenimiento pero sí Terreno, Equipos, Inventario y Operadores', () => {
    const keys = prepKeysFor(ROLES.SUPERVISOR);

    expect(keys).not.toContain('maintenance');
    expect(keys).toEqual(
      expect.arrayContaining(['equipment', 'inventory', 'branches', 'operators', 'shiftCards', 'hallazgos', 'trabajosExtra', 'horometro']),
    );
  });

  it('los checklists diarios se precargan para los dos roles de faena: M2 (mantenedor) y M3 (supervisor)', () => {
    expect(prepKeysFor(ROLES.MANTENEDOR)).toContain('dailyChecklists');
    expect(prepKeysFor(ROLES.SUPERVISOR)).toContain('dailyChecklists');
  });

  it('el reporte diario (con sus catálogos) acompaña a Terreno: SUPERVISOR sí, MANTENEDOR no', () => {
    expect(prepKeysFor(ROLES.SUPERVISOR)).toContain('reporteDiario');
    expect(prepKeysFor(ROLES.MANTENEDOR)).not.toContain('reporteDiario');
  });

  it('el calendario de vencimientos acompaña al taller: MANTENEDOR y ADMIN, no SUPERVISOR', () => {
    expect(prepKeysFor(ROLES.MANTENEDOR)).toContain('vencimientos');
    expect(prepKeysFor(ROLES.ADMIN)).toContain('vencimientos');
    expect(prepKeysFor(ROLES.SUPERVISOR)).not.toContain('vencimientos');
  });

  it('ADMIN ve todo: precarga todas las listas', () => {
    expect(prepKeysFor(ROLES.ADMIN)).toEqual([...PREP_KEYS]);
  });

  it('todos los roles con menú precargan las notificaciones; los movimientos acompañan a Inventario', () => {
    for (const role of [ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.MANTENEDOR]) {
      expect(prepKeysFor(role), role).toEqual(expect.arrayContaining(['notificaciones', 'movimientos']));
    }
  });

  it('el panel (dashboard) se precarga solo para ADMIN: `/` es solo de ese rol', () => {
    expect(prepKeysFor(ROLES.ADMIN)).toContain('dashboard');
    expect(prepKeysFor(ROLES.SUPERVISOR)).not.toContain('dashboard');
    expect(prepKeysFor(ROLES.MANTENEDOR)).not.toContain('dashboard');
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
      'dailyChecklists',
      'shiftCards',
      'hallazgos',
      'trabajosExtra',
      'reporteDiario',
      'horometro',
      'combustible',
    ]);
    expect(prepKeysFor(undefined)).toEqual(prepKeysFor(null));
  });

  /**
   * El punto del desacople: los shells de Terreno/Taller son el home de
   * SUPERVISOR/MANTENEDOR aunque NO aparezcan en el menú (`NAV_ITEMS`). Si la
   * precarga volviera a derivarse del menú, sacar una entrada del menú dejaría
   * a esos roles sin sus listas en el arranque sin señal — este test lo
   * detecta simulando un menú vacío.
   */
  it('no sigue al menú: con NAV_ITEMS vacío, cada rol conserva las listas de sus módulos', async () => {
    vi.resetModules();
    vi.doMock('./nav-items', () => ({ NAV_ITEMS: [] }));
    try {
      const { prepKeysFor: prepSinMenu } = await import('./offline-prep');

      expect(prepSinMenu(ROLES.SUPERVISOR)).toEqual(expect.arrayContaining(['shiftCards', 'hallazgos', 'combustible']));
      expect(prepSinMenu(ROLES.MANTENEDOR)).toEqual(expect.arrayContaining(['maintenance', 'bitacora', 'dailyChecklists']));
    } finally {
      vi.doUnmock('./nav-items');
      vi.resetModules();
    }
  });

  it('sin repetidos y en un orden estable', () => {
    const keys = prepKeysFor(ROLES.ADMIN);

    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toEqual(prepKeysFor(ROLES.ADMIN));
  });
});
