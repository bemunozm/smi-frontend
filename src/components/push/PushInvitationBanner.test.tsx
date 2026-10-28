import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

import { readPushBannerDismissed, savePushBannerDismissed, savePushOptIn } from '../../lib/push-optin';
import { PushInvitationBanner } from './PushInvitationBanner';

const { isSupportedMock, enableMock, toastMock, useCurrentUserMock } = vi.hoisted(() => ({
  isSupportedMock: vi.fn(),
  enableMock: vi.fn(),
  toastMock: { danger: vi.fn(), success: vi.fn() },
  useCurrentUserMock: vi.fn(),
}));

vi.mock('../../lib/push-device', () => ({
  isPushSupported: (...args: unknown[]) => isSupportedMock(...args) as unknown,
  enablePush: (...args: unknown[]) => enableMock(...args) as unknown,
}));

vi.mock('../../hooks/useCurrentUser', () => ({
  useCurrentUser: () => useCurrentUserMock() as unknown,
}));

vi.mock('@heroui/react', () => ({
  toast: toastMock,
  Button: ({ children, onPress, ...rest }: { children?: ReactNode; onPress?: () => void }) => (
    <button type="button" onClick={onPress} {...rest}>
      {children}
    </button>
  ),
}));

function sesionConfirmada() {
  useCurrentUserMock.mockReturnValue({
    user: { id: 'u1' },
    isAuthenticated: true,
    isOfflineSnapshot: false,
  });
}

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
  vi.unstubAllGlobals();
  isSupportedMock.mockReturnValue(true);
  vi.stubGlobal('Notification', { permission: 'default' });
  sesionConfirmada();
});

describe('PushInvitationBanner', () => {
  it('aparece tras iniciar sesión cuando el push está disponible y nunca se activó ni descartó', () => {
    render(<PushInvitationBanner />);

    expect(screen.getByText(/¿Quieres recibir las notificaciones en este celular\?/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Activar' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ahora no' })).toBeTruthy();
  });

  it('Activar llama enablePush(user.id) y el banner desaparece al quedar suscrito', async () => {
    enableMock.mockResolvedValue('subscribed');
    render(<PushInvitationBanner />);

    fireEvent.click(screen.getByRole('button', { name: 'Activar' }));

    expect(enableMock).toHaveBeenCalledWith('u1');
    await waitFor(() => expect(screen.queryByText(/¿Quieres recibir/)).toBeNull());
  });

  it('Ahora no guarda la marca de descartado, oculta el banner y no vuelve a aparecer', () => {
    const { unmount } = render(<PushInvitationBanner />);

    fireEvent.click(screen.getByRole('button', { name: 'Ahora no' }));

    expect(screen.queryByText(/¿Quieres recibir/)).toBeNull();
    expect(readPushBannerDismissed('u1')).toBe(true);

    unmount();
    render(<PushInvitationBanner />);
    expect(screen.queryByText(/¿Quieres recibir/)).toBeNull();
  });

  it('no aparece si: permiso ya resuelto, ya hay opt-in, fue descartado, no hay soporte, o la sesión es offline', () => {
    vi.stubGlobal('Notification', { permission: 'granted' });
    render(<PushInvitationBanner />);
    expect(screen.queryByText(/¿Quieres recibir/)).toBeNull();
    cleanup();

    vi.stubGlobal('Notification', { permission: 'default' });
    savePushOptIn('u1');
    render(<PushInvitationBanner />);
    expect(screen.queryByText(/¿Quieres recibir/)).toBeNull();
    cleanup();
    localStorage.clear();

    savePushBannerDismissed('u1');
    render(<PushInvitationBanner />);
    expect(screen.queryByText(/¿Quieres recibir/)).toBeNull();
    cleanup();
    localStorage.clear();

    isSupportedMock.mockReturnValue(false);
    render(<PushInvitationBanner />);
    expect(screen.queryByText(/¿Quieres recibir/)).toBeNull();
    cleanup();
    isSupportedMock.mockReturnValue(true);

    useCurrentUserMock.mockReturnValue({
      user: { id: 'u1' },
      isAuthenticated: true,
      isOfflineSnapshot: true,
    });
    render(<PushInvitationBanner />);
    expect(screen.queryByText(/¿Quieres recibir/)).toBeNull();
  });

  it('un enablePush que lanza muestra toast.danger y el banner sigue para reintentar', async () => {
    enableMock.mockRejectedValue(new Error('No se pudo suscribir este dispositivo a las notificaciones.'));
    render(<PushInvitationBanner />);

    fireEvent.click(screen.getByRole('button', { name: 'Activar' }));

    await waitFor(() =>
      expect(toastMock.danger).toHaveBeenCalledWith(
        'No se pudo suscribir este dispositivo a las notificaciones.',
      ),
    );
    expect(screen.getByText(/¿Quieres recibir/)).toBeTruthy();
  });

  it('un enablePush que devuelve "denied" oculta el banner (el estado queda explicado en Notificaciones)', async () => {
    enableMock.mockResolvedValue('denied');
    render(<PushInvitationBanner />);

    fireEvent.click(screen.getByRole('button', { name: 'Activar' }));

    await waitFor(() => expect(screen.queryByText(/¿Quieres recibir/)).toBeNull());
  });
});
