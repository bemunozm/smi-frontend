import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { instalarReboteAtras } from './back-trap';

/** Simula el modo de visualización: `true` = PWA instalada (standalone). */
function conModoStandalone(instalada: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({ matches: instalada }),
  );
}

/** El estado con que React Router deja la entrada inicial (`idx: 0`). */
function conEntradaInicialDelRouter() {
  window.history.replaceState({ usr: null, key: 'inicial', idx: 0 }, '', '/inicio');
}

function volverAtras(state: unknown) {
  window.dispatchEvent(new PopStateEvent('popstate', { state }));
}

describe('instalarReboteAtras', () => {
  let pushSpy: ReturnType<typeof vi.spyOn>;
  // Los tests comparten el `window` de jsdom: cada instalación se desinstala
  // en `afterEach` o sus listeners de `popstate` se acumularían entre tests.
  let desinstalar: () => void = () => {};

  function instalar() {
    desinstalar = instalarReboteAtras();
  }

  beforeEach(() => {
    conEntradaInicialDelRouter();
    pushSpy = vi.spyOn(window.history, 'pushState');
  });

  afterEach(() => {
    desinstalar();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('en una pestaña de navegador no toca el historial', () => {
    conModoStandalone(false);

    instalar();
    volverAtras({ idx: 0 });

    expect(pushSpy).not.toHaveBeenCalled();
  });

  it('como PWA instalada deja una entrada colchón bajo la vista inicial', () => {
    conModoStandalone(true);

    instalar();

    // La entrada duplicada conserva la URL y el estado del router (su `idx`).
    expect(pushSpy).toHaveBeenCalledTimes(1);
    expect(window.location.pathname).toBe('/inicio');
    expect(window.history.state).toMatchObject({ idx: 0 });
  });

  it('atrás en la raíz del historial rebota en vez de salir de la app', () => {
    conModoStandalone(true);
    instalar();
    pushSpy.mockClear();

    volverAtras({ usr: null, key: 'inicial', idx: 0 });

    expect(pushSpy).toHaveBeenCalledTimes(1);
  });

  it('atrás en una vista interior navega normal, sin rebote', () => {
    conModoStandalone(true);
    instalar();
    pushSpy.mockClear();

    volverAtras({ usr: null, key: 'otra', idx: 2 });

    expect(pushSpy).not.toHaveBeenCalled();
  });

  it('tras una recarga a mitad del historial no mete colchón (atrás sigue funcionando)', () => {
    conModoStandalone(true);
    window.history.replaceState({ usr: null, key: 'profunda', idx: 3 }, '', '/equipos');

    instalar();

    expect(pushSpy).not.toHaveBeenCalled();
  });
});
