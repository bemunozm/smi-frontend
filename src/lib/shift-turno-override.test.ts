import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { clearTurnoOverride, readTurnoOverride, saveTurnoOverride } from './shift-turno-override';

beforeEach(() => window.localStorage.clear());
afterEach(() => window.localStorage.clear());

describe('shift-turno-override', () => {
  it('guarda y relee la preferencia, aislada por userId', () => {
    saveTurnoOverride('u1', { baseTurno: 'NOCTURNO', baseFecha: '2026-09-23' });
    saveTurnoOverride('u2', { baseTurno: 'DIURNO', baseFecha: '2026-09-24' });

    expect(readTurnoOverride('u1')).toEqual({ baseTurno: 'NOCTURNO', baseFecha: '2026-09-23' });
    expect(readTurnoOverride('u2')).toEqual({ baseTurno: 'DIURNO', baseFecha: '2026-09-24' });
  });

  it('devuelve null si no hay nada guardado', () => {
    expect(readTurnoOverride('sin-nada')).toBeNull();
  });

  it('devuelve null (no revienta) ante contenido corrupto', () => {
    window.localStorage.setItem('smi-shift-register-turno:u1', '{not json');
    expect(readTurnoOverride('u1')).toBeNull();
  });

  it('devuelve null si el shape guardado no calza (versión vieja, turno inválido)', () => {
    window.localStorage.setItem('smi-shift-register-turno:u1', JSON.stringify({ baseTurno: 'TARDE', baseFecha: 'x' }));
    expect(readTurnoOverride('u1')).toBeNull();
  });

  it('clearTurnoOverride borra solo la clave del usuario indicado', () => {
    saveTurnoOverride('u1', { baseTurno: 'DIURNO', baseFecha: '2026-09-24' });
    saveTurnoOverride('u2', { baseTurno: 'DIURNO', baseFecha: '2026-09-24' });

    clearTurnoOverride('u1');

    expect(readTurnoOverride('u1')).toBeNull();
    expect(readTurnoOverride('u2')).not.toBeNull();
  });
});
