import { describe, expect, it } from 'vitest';

import { ENDPOINTS } from '../offline/endpoints';
import { ROLES, type Role } from '../types/roles';
import { MOVEMENT_ACTIONS, WRITE_ROLES, canCloseShiftCardFromFleet, canWrite, canWriteAny } from './permissions';

const { ADMIN, SUPERVISOR, MANTENEDOR } = ROLES;

describe('WRITE_ROLES', () => {
  it('cubre exactamente las escrituras del registro: ninguna queda sin decidir ni sobra una', () => {
    expect(Object.keys(WRITE_ROLES).sort()).toEqual(Object.keys(ENDPOINTS).sort());
  });

  // Espejo de los `@Roles` de los controllers del backend (verificado a mano contra
  // `smi-backend/src/**/*.controller.ts`): si el backend cambia, este cuadro cambia.
  it.each<[keyof typeof WRITE_ROLES, readonly Role[]]>([
    ['stock.transfer', [ADMIN, SUPERVISOR]],
    ['item.adjust', [ADMIN]],
    ['movement.create', [ADMIN, MANTENEDOR]],
    ['item.setMinimum', [ADMIN, MANTENEDOR]],
    ['horometro.create', [ADMIN, SUPERVISOR]],
    ['horometro.close', [ADMIN, SUPERVISOR]],
    ['combustible.create', [ADMIN, SUPERVISOR]],
    ['equipment.create', [ADMIN]],
    ['equipment.status', [ADMIN, SUPERVISOR]],
    ['intervencion.create', [MANTENEDOR]],
    ['umbral.create', [ADMIN]],
    ['orden.update', [ADMIN, SUPERVISOR, MANTENEDOR]],
  ])('%s la hacen %j', (accion, roles) => {
    expect([...WRITE_ROLES[accion]].sort()).toEqual([...roles].sort());
  });
});

describe('canWrite', () => {
  it('un mantenedor no puede traspasar ni contar, pero sí registrar entradas y salidas', () => {
    expect(canWrite(MANTENEDOR, 'stock.transfer')).toBe(false);
    expect(canWrite(MANTENEDOR, 'item.adjust')).toBe(false);
    expect(canWrite(MANTENEDOR, 'movement.create')).toBe(true);
  });

  it('un supervisor puede traspasar, pero no contar ni registrar movimientos', () => {
    expect(canWrite(SUPERVISOR, 'stock.transfer')).toBe(true);
    expect(canWrite(SUPERVISOR, 'item.adjust')).toBe(false);
    expect(canWrite(SUPERVISOR, 'movement.create')).toBe(false);
  });

  it('un mantenedor no registra horómetro ni combustible', () => {
    expect(canWrite(MANTENEDOR, 'horometro.create')).toBe(false);
    expect(canWrite(MANTENEDOR, 'horometro.close')).toBe(false);
    expect(canWrite(MANTENEDOR, 'combustible.create')).toBe(false);
  });

  it('sin rol (sesión sin resolver) no se ofrece nada', () => {
    expect(canWrite(null, 'orden.update')).toBe(false);
    expect(canWrite(undefined, 'orden.update')).toBe(false);
  });
});

describe('canWriteAny', () => {
  it('ofrece "Registrar movimiento" a quien puede al menos un modo', () => {
    expect(canWriteAny(ADMIN, MOVEMENT_ACTIONS)).toBe(true);
    expect(canWriteAny(MANTENEDOR, MOVEMENT_ACTIONS)).toBe(true);
    expect(canWriteAny(SUPERVISOR, MOVEMENT_ACTIONS)).toBe(true);
    expect(canWriteAny(null, MOVEMENT_ACTIONS)).toBe(false);
  });
});

describe('canCloseShiftCardFromFleet', () => {
  it('desde Flota la tarjeta de un turno de Registro de turno solo la cierra el administrador', () => {
    expect(canCloseShiftCardFromFleet(ADMIN)).toBe(true);
    expect(canCloseShiftCardFromFleet(SUPERVISOR)).toBe(false);
    expect(canCloseShiftCardFromFleet(MANTENEDOR)).toBe(false);
    expect(canCloseShiftCardFromFleet(null)).toBe(false);
  });
});
