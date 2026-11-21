import { describe, expect, it, vi } from 'vitest';

import { checkForUpdate, isAdminPanelPath, shouldAutoUpdateOnNavigation } from './update-policy';

describe('isAdminPanelPath', () => {
  it('las pantallas del panel cuentan', () => {
    for (const ruta of ['/', '/reportes', '/trabajos-extra', '/inventario/abc', '/chequeos-diarios', '/equipos/1/ficha']) {
      expect(isAdminPanelPath(ruta)).toBe(true);
    }
  });

  it('Terreno, Taller, la camioneta del prevencionista, login e inicio no', () => {
    for (const ruta of ['/terreno', '/terreno/registro', '/mantenimiento/ordenes', '/camioneta', '/login', '/inicio']) {
      expect(isAdminPanelPath(ruta)).toBe(false);
    }
  });

  it('no confunde un prefijo parecido', () => {
    expect(isAdminPanelPath('/terrenos')).toBe(true);
    expect(isAdminPanelPath('/mantenciones')).toBe(true);
  });
});

describe('shouldAutoUpdateOnNavigation', () => {
  it('solo al pasar de una pantalla del panel a otra', () => {
    expect(shouldAutoUpdateOnNavigation('/reportes', '/trabajos-extra')).toBe(true);
    expect(shouldAutoUpdateOnNavigation('/reportes', '/reportes')).toBe(false);
    expect(shouldAutoUpdateOnNavigation('/terreno/registro', '/terreno/hallazgos')).toBe(false);
    expect(shouldAutoUpdateOnNavigation('/terreno/registro', '/')).toBe(false);
    expect(shouldAutoUpdateOnNavigation('/', '/mantenimiento/ordenes')).toBe(false);
  });
});

describe('checkForUpdate', () => {
  it('pregunta al servidor con señal y sin otra versión instalándose', async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    await checkForUpdate({ installing: null, update }, true);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('no pregunta sin señal ni si ya hay una instalándose', async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    await checkForUpdate({ installing: null, update }, false);
    await checkForUpdate({ installing: {}, update }, true);
    expect(update).not.toHaveBeenCalled();
  });

  it('un fallo de red no lanza', async () => {
    const update = vi.fn().mockRejectedValue(new Error('offline'));
    await expect(checkForUpdate({ installing: null, update }, true)).resolves.toBeUndefined();
  });
});
