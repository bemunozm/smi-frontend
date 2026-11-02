import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

import { capturarInvitacionInstalar, reiniciarInvitacionInstalar, useInstalarApp } from '../../pwa/install-prompt';
import { InstallAppBanner } from './InstallAppBanner';

vi.mock('@heroui/react', () => ({
  Button: ({ children, onPress }: { children?: ReactNode; onPress?: () => void }) => (
    <button type="button" onClick={onPress}>
      {children}
    </button>
  ),
}));

const UA_ORIGINAL = navigator.userAgent;

function simularUserAgent(ua: string) {
  Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
}

/** Lo que Chrome dispara cuando la app es instalable. */
function avisarInstalable(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const evento = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome }),
  });
  act(() => {
    window.dispatchEvent(evento);
  });
  return evento;
}

/** Botón de menú de prueba: reabre el aviso como lo hacen los menús de usuario. */
function Reabrir() {
  const { modo, reabrir } = useInstalarApp();
  return modo ? (
    <button type="button" onClick={reabrir}>
      Instalar app
    </button>
  ) : null;
}

beforeAll(() => {
  capturarInvitacionInstalar();
});

beforeEach(() => {
  localStorage.clear();
  simularUserAgent(UA_ORIGINAL);
  reiniciarInvitacionInstalar();
});

afterEach(() => {
  cleanup();
});

describe('InstallAppBanner', () => {
  it('no aparece si el navegador no ofrece instalar', () => {
    render(<InstallAppBanner />);
    expect(screen.queryByRole('region', { name: 'Instalar la app' })).toBeNull();
  });

  it('con el aviso de Chrome, «Instalar» abre el diálogo del sistema y el aviso se va', async () => {
    render(<InstallAppBanner />);
    const evento = avisarInstalable('accepted');
    expect(evento.defaultPrevented).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Instalar' }));
    expect(evento.prompt).toHaveBeenCalledTimes(1);
    await act(async () => {
      await evento.userChoice;
    });
    expect(screen.queryByRole('region', { name: 'Instalar la app' })).toBeNull();
  });

  it('«Ahora no» lo recuerda en el dispositivo, y el menú puede volver a abrirlo', () => {
    render(<InstallAppBanner />);
    avisarInstalable();
    fireEvent.click(screen.getByRole('button', { name: 'Ahora no' }));
    expect(screen.queryByRole('region', { name: 'Instalar la app' })).toBeNull();
    expect(localStorage.getItem('smi.pwa-install-dismissed')).toBe('1');

    // Otra carga de la app: sigue descartado.
    cleanup();
    reiniciarInvitacionInstalar();
    render(
      <>
        <InstallAppBanner />
        <Reabrir />
      </>,
    );
    avisarInstalable();
    expect(screen.queryByRole('region', { name: 'Instalar la app' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Instalar app' }));
    expect(screen.getByRole('region', { name: 'Instalar la app' })).toBeTruthy();
  });

  it('después de instalar no vuelve a invitar desde el navegador (aunque Chrome siga ofreciendo)', async () => {
    render(<InstallAppBanner />);
    const evento = avisarInstalable('accepted');
    fireEvent.click(screen.getByRole('button', { name: 'Instalar' }));
    await act(async () => {
      await evento.userChoice;
    });
    expect(localStorage.getItem('smi.pwa-installed')).toBe('1');

    // Próxima visita en una pestaña: Chrome dejó un acceso directo y vuelve a
    // avisar que es instalable. El aviso no sale; el menú sí puede reabrirlo.
    cleanup();
    reiniciarInvitacionInstalar();
    render(
      <>
        <InstallAppBanner />
        <Reabrir />
      </>,
    );
    avisarInstalable();
    expect(screen.queryByRole('region', { name: 'Instalar la app' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Instalar app' }));
    expect(screen.getByRole('region', { name: 'Instalar la app' })).toBeTruthy();
  });

  it('el evento appinstalled también deja la marca', () => {
    render(<InstallAppBanner />);
    avisarInstalable();
    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });
    expect(screen.queryByRole('region', { name: 'Instalar la app' })).toBeNull();
    expect(localStorage.getItem('smi.pwa-installed')).toBe('1');
  });

  it('en iPhone explica los pasos (no hay diálogo del sistema)', () => {
    simularUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1');
    render(<InstallAppBanner />);
    expect(screen.getByText('Agrega SMI a tu pantalla de inicio')).toBeTruthy();
    expect(screen.getByText('Compartir')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Instalar' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    expect(screen.queryByRole('region', { name: 'Instalar la app' })).toBeNull();
  });

  it('ya instalada (pantalla completa) no invita', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q === '(display-mode: standalone)' }));
    render(<InstallAppBanner />);
    avisarInstalable();
    expect(screen.queryByRole('region', { name: 'Instalar la app' })).toBeNull();
    vi.unstubAllGlobals();
  });
});
