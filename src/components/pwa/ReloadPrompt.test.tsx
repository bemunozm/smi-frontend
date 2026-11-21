import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Toast } from '@heroui/react';

import { REPROMPT_AFTER_MS } from '../../pwa/update-policy';
import { ReloadPrompt, type NavigationSource } from './ReloadPrompt';

// `vi.mock` se hoistea sobre los imports: las variables que su factory lee
// deben venir de `vi.hoisted` para no pisar el TDZ (mismo motivo por el que
// `NotificationBell.test.tsx` usa `let` reasignable — acá además necesitamos
// que la reasignación sea visible ANTES de que se registre el mock).
const mocks = vi.hoisted(() => ({
  needRefresh: false,
  offlineReady: false,
  setNeedRefresh: vi.fn(),
  setOfflineReady: vi.fn(),
  updateServiceWorker: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: (_options?: unknown) => ({
    needRefresh: [mocks.needRefresh, mocks.setNeedRefresh],
    offlineReady: [mocks.offlineReady, mocks.setOfflineReady],
    updateServiceWorker: mocks.updateServiceWorker,
  }),
}));

function renderPrompt(navigation?: NavigationSource) {
  // El toast se pinta donde vive el `Toast.Provider` (portal), igual que en
  // `AppProviders` real — sin este provider en el árbol no hay dónde pintar.
  return render(
    <>
      <Toast.Provider placement="bottom end" />
      <ReloadPrompt navigation={navigation} />
    </>,
  );
}

/** Router de mentira: `navegar` avisa a los suscriptores como lo haría el real. */
function navegacionFalsa(inicial: string) {
  let actual = inicial;
  const oyentes = new Set<(pathname: string) => void>();
  const navigation: NavigationSource = {
    pathname: () => actual,
    subscribe: (oyente) => {
      oyentes.add(oyente);
      return () => oyentes.delete(oyente);
    },
  };
  const navegar = (ruta: string) => {
    actual = ruta;
    act(() => oyentes.forEach((oyente) => oyente(ruta)));
  };
  return { navigation, navegar };
}

afterEach(() => {
  cleanup();
  mocks.needRefresh = false;
  mocks.offlineReady = false;
  mocks.setNeedRefresh.mockClear();
  mocks.setOfflineReady.mockClear();
  mocks.updateServiceWorker.mockClear();
});

describe('ReloadPrompt', () => {
  it('no muestra ningún toast cuando no hay novedades', () => {
    renderPrompt();

    expect(screen.queryByText('Nueva versión disponible')).toBeNull();
    expect(screen.queryByText('Listo para usar sin conexión')).toBeNull();
  });

  it('muestra el banner de actualización cuando needRefresh es true', async () => {
    mocks.needRefresh = true;

    renderPrompt();

    expect(await screen.findByText('Nueva versión disponible')).toBeTruthy();
  });

  it('el botón "Actualizar" llama a updateServiceWorker(true)', async () => {
    mocks.needRefresh = true;

    renderPrompt();

    const actionButton = await screen.findByRole('button', { name: 'Actualizar' });
    fireEvent.click(actionButton);

    expect(mocks.updateServiceWorker).toHaveBeenCalledWith(true);
  });

  it('cerrar el aviso no descarta la versión nueva: vuelve a aparecer pasado un rato', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      mocks.needRefresh = true;
      renderPrompt();

      expect(await screen.findByText('Nueva versión disponible')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: /cerrar|close/i }));
      // HeroUI llama a onClose en el siguiente frame de animación.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(50);
      });
      await vi.waitFor(() => expect(screen.queryByText('Nueva versión disponible')).toBeNull());
      expect(mocks.setNeedRefresh).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(REPROMPT_AFTER_MS);
      });
      expect(await screen.findByText('Nueva versión disponible')).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('en el panel, cambiar de pantalla con una versión en espera la instala sin preguntar', () => {
    mocks.needRefresh = true;
    const { navigation, navegar } = navegacionFalsa('/reportes');
    renderPrompt(navigation);

    navegar('/reportes');
    expect(mocks.updateServiceWorker).not.toHaveBeenCalled();

    navegar('/trabajos-extra');
    expect(mocks.updateServiceWorker).toHaveBeenCalledWith(true);
  });

  it('en Terreno no se instala sola al navegar (puede haber un formulario a medio llenar)', () => {
    mocks.needRefresh = true;
    const { navigation, navegar } = navegacionFalsa('/terreno/registro');
    renderPrompt(navigation);

    navegar('/terreno/hallazgos');
    navegar('/');
    expect(mocks.updateServiceWorker).not.toHaveBeenCalled();
  });

  it('sin versión en espera, navegar no hace nada', () => {
    const { navigation, navegar } = navegacionFalsa('/reportes');
    renderPrompt(navigation);

    navegar('/trabajos-extra');
    expect(mocks.updateServiceWorker).not.toHaveBeenCalled();
  });

  it('muestra el toast de "listo sin conexión" cuando offlineReady es true', async () => {
    mocks.offlineReady = true;

    renderPrompt();

    expect(await screen.findByText('Listo para usar sin conexión')).toBeTruthy();
  });
});
