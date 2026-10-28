import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

import { PushToggleCard } from './PushToggleCard';

const { getStatusMock, enableMock, disableMock, toastMock } = vi.hoisted(() => ({
  getStatusMock: vi.fn(),
  enableMock: vi.fn(),
  disableMock: vi.fn(),
  toastMock: { danger: vi.fn(), success: vi.fn() },
}));

vi.mock('../../lib/push-device', () => ({
  getPushDeviceStatus: (...args: unknown[]) => getStatusMock(...args) as unknown,
  enablePush: (...args: unknown[]) => enableMock(...args) as unknown,
  disablePush: (...args: unknown[]) => disableMock(...args) as unknown,
}));

vi.mock('../../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { id: 'u1' }, isAuthenticated: true, isOfflineSnapshot: false }),
}));

// Mismo criterio que `SyncEngineMount.test.tsx`: HeroUI se reemplaza por
// stand-ins mínimos — acá se testea el comportamiento del card, no la librería.
vi.mock('@heroui/react', () => ({
  toast: toastMock,
  Card: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Switch: Object.assign(
    ({
      children,
      isSelected,
      isDisabled,
      onChange,
    }: {
      children?: ReactNode;
      isSelected?: boolean;
      isDisabled?: boolean;
      onChange?: (next: boolean) => void;
    }) => (
      <label>
        <input
          checked={Boolean(isSelected)}
          disabled={Boolean(isDisabled)}
          role="switch"
          type="checkbox"
          onChange={() => onChange?.(!isSelected)}
        />
        {children}
      </label>
    ),
    {
      Content: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
      Control: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
      Thumb: () => null,
    },
  ),
}));

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('PushToggleCard', () => {
  it('estado subscribed: switch encendido con el texto de dispositivo activo', async () => {
    getStatusMock.mockResolvedValue('subscribed');

    render(<PushToggleCard />);

    await waitFor(() =>
      expect(
        screen.getByText('Este dispositivo recibe los avisos del sistema aunque la app esté cerrada.'),
      ).toBeTruthy(),
    );
    expect((screen.getByRole('switch') as HTMLInputElement).checked).toBe(true);
  });

  it('estado unsubscribed: switch apagado; al encenderlo llama enablePush(user.id) y pasa a subscribed', async () => {
    getStatusMock.mockResolvedValue('unsubscribed');
    enableMock.mockResolvedValue('subscribed');

    render(<PushToggleCard />);
    await waitFor(() => expect(screen.getByRole('switch')).toBeTruthy());
    expect((screen.getByRole('switch') as HTMLInputElement).checked).toBe(false);

    fireEvent.click(screen.getByRole('switch'));

    expect(enableMock).toHaveBeenCalledWith('u1');
    await waitFor(() =>
      expect(
        screen.getByText('Este dispositivo recibe los avisos del sistema aunque la app esté cerrada.'),
      ).toBeTruthy(),
    );
  });

  it('enablePush que devuelve "denied" muestra el texto de permiso bloqueado y el switch queda apagado', async () => {
    getStatusMock.mockResolvedValue('unsubscribed');
    enableMock.mockResolvedValue('denied');

    render(<PushToggleCard />);
    await waitFor(() => expect(screen.getByRole('switch')).toBeTruthy());

    fireEvent.click(screen.getByRole('switch'));

    await waitFor(() =>
      expect(screen.getByText(/bloqueadas en este navegador/)).toBeTruthy(),
    );
    expect((screen.getByRole('switch') as HTMLInputElement).checked).toBe(false);
  });

  it('estado unsupported: sin switch; el texto indica instalar SMI en la pantalla de inicio (iPhone)', async () => {
    getStatusMock.mockResolvedValue('unsupported');

    render(<PushToggleCard />);

    await waitFor(() => expect(screen.getByText(/pantalla de inicio/)).toBeTruthy());
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('apagar el switch llama disablePush y vuelve a unsubscribed', async () => {
    getStatusMock.mockResolvedValue('subscribed');
    disableMock.mockResolvedValue(undefined);

    render(<PushToggleCard />);
    await waitFor(() => expect(screen.getByRole('switch')).toBeTruthy());

    fireEvent.click(screen.getByRole('switch'));

    expect(disableMock).toHaveBeenCalledWith('u1');
    await waitFor(() =>
      expect(screen.getByText(/Actívalas para recibir los avisos/)).toBeTruthy(),
    );
    expect((screen.getByRole('switch') as HTMLInputElement).checked).toBe(false);
  });

  it('un enable que lanza muestra toast.danger con el mensaje del error', async () => {
    getStatusMock.mockResolvedValue('unsubscribed');
    enableMock.mockRejectedValue(new Error('No se pudo suscribir este dispositivo a las notificaciones.'));

    render(<PushToggleCard />);
    await waitFor(() => expect(screen.getByRole('switch')).toBeTruthy());

    fireEvent.click(screen.getByRole('switch'));

    await waitFor(() =>
      expect(toastMock.danger).toHaveBeenCalledWith(
        'No se pudo suscribir este dispositivo a las notificaciones.',
      ),
    );
    expect((screen.getByRole('switch') as HTMLInputElement).checked).toBe(false);
  });
});
