import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { DomainError } from '../lib/api-error';

const signedFileUrl = vi.hoisted(() => vi.fn());
const toastDanger = vi.hoisted(() => vi.fn());

vi.mock('../api/ShiftReportAPI', () => ({ ShiftReportAPI: { signedFileUrl } }));
vi.mock('@heroui/react', () => ({ toast: { danger: toastDanger, success: vi.fn() } }));

import { REPORTE_ELIMINADO, useAbrirPdfReporte } from './useShiftReports';

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

/** Pestaña falsa: lo que `window.open('', '_blank')` devolvería. */
function pestana() {
  return {
    opener: {} as unknown,
    closed: false,
    close: vi.fn(),
    location: { href: '' },
    document: { title: '', body: { textContent: '' } },
  };
}

let ventana: ReturnType<typeof pestana>;

beforeEach(() => {
  ventana = pestana();
  vi.spyOn(window, 'open').mockReturnValue(ventana as unknown as Window);
});

afterEach(() => {
  vi.restoreAllMocks();
  signedFileUrl.mockReset();
  toastDanger.mockReset();
});

describe('useAbrirPdfReporte', () => {
  it('abre la pestaña en el mismo toque y después le pone la URL firmada', async () => {
    signedFileUrl.mockResolvedValue('https://bucket/r1.pdf?firma');
    const { result } = renderHook(() => useAbrirPdfReporte(), { wrapper });

    result.current('r1');

    expect(window.open).toHaveBeenCalledWith('', '_blank');
    expect(ventana.opener).toBeNull();
    await waitFor(() => expect(ventana.location.href).toBe('https://bucket/r1.pdf?firma'));
    expect(toastDanger).not.toHaveBeenCalled();
  });

  it('si el reporte se eliminó, cierra la pestaña y avisa en la app (sin el 404 crudo)', async () => {
    signedFileUrl.mockRejectedValue(new DomainError('Reporte no encontrado', { status: 404 }));
    const { result } = renderHook(() => useAbrirPdfReporte(), { wrapper });

    result.current('borrado');

    await waitFor(() => expect(ventana.close).toHaveBeenCalled());
    expect(toastDanger).toHaveBeenCalledWith(REPORTE_ELIMINADO);
    expect(ventana.location.href).toBe('');
  });
});
