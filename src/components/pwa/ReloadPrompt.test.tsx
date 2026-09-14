import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Toast } from '@heroui/react';

import { ReloadPrompt } from './ReloadPrompt';

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
  useRegisterSW: () => ({
    needRefresh: [mocks.needRefresh, mocks.setNeedRefresh],
    offlineReady: [mocks.offlineReady, mocks.setOfflineReady],
    updateServiceWorker: mocks.updateServiceWorker,
  }),
}));

function renderPrompt() {
  // El toast se pinta donde vive el `Toast.Provider` (portal), igual que en
  // `AppProviders` real — sin este provider en el árbol no hay dónde pintar.
  return render(
    <>
      <Toast.Provider placement="bottom end" />
      <ReloadPrompt />
    </>,
  );
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

  it('muestra el toast de "listo sin conexión" cuando offlineReady es true', async () => {
    mocks.offlineReady = true;

    renderPrompt();

    expect(await screen.findByText('Listo para usar sin conexión')).toBeTruthy();
  });
});
