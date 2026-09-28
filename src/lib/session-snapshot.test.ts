import { afterEach, describe, expect, it } from 'vitest';

import { clearSessionSnapshot, readSessionSnapshot, saveSessionSnapshot } from './session-snapshot';
import { ROLES } from '../types/roles';

const SNAPSHOT = {
  userId: 'u1',
  name: 'Juan Rojas',
  email: 'juan@smi.local',
  role: ROLES.SUPERVISOR,
  savedAt: 1_700_000_000_000,
};

afterEach(() => {
  window.localStorage.clear();
});

describe('saveSessionSnapshot / readSessionSnapshot', () => {
  it('guarda y relee el mismo snapshot', () => {
    saveSessionSnapshot(SNAPSHOT);
    expect(readSessionSnapshot()).toEqual(SNAPSHOT);
  });

  it('devuelve null si no hay nada guardado', () => {
    expect(readSessionSnapshot()).toBeNull();
  });

  it('devuelve null ante contenido corrupto en localStorage (no lanza)', () => {
    window.localStorage.setItem('smi-session-snapshot', 'no es json{{{');
    expect(readSessionSnapshot()).toBeNull();
  });

  it('devuelve null si el shape guardado no calza (storage viejo/corrupto)', () => {
    window.localStorage.setItem('smi-session-snapshot', JSON.stringify({ foo: 'bar' }));
    expect(readSessionSnapshot()).toBeNull();
  });

  it('re-angosta un rol que ya no existe en el union `Role` a null', () => {
    window.localStorage.setItem(
      'smi-session-snapshot',
      JSON.stringify({ ...SNAPSHOT, role: 'ROL_VIEJO_QUE_YA_NO_EXISTE' }),
    );
    expect(readSessionSnapshot()).toEqual({ ...SNAPSHOT, role: null });
  });
});

describe('clearSessionSnapshot', () => {
  it('borra el snapshot guardado', () => {
    saveSessionSnapshot(SNAPSHOT);
    clearSessionSnapshot();
    expect(readSessionSnapshot()).toBeNull();
  });
});
