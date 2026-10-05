import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';

const { fuelReadingOcrMock, readCaptureDateMock } = vi.hoisted(() => ({
  fuelReadingOcrMock: vi.fn(),
  readCaptureDateMock: vi.fn(),
}));

vi.mock('../api/OcrAPI', () => ({ fuelReadingOcr: fuelReadingOcrMock }));
vi.mock('./photo-reading', () => ({ readCaptureDate: readCaptureDateMock }));
vi.mock('@heroui/react', () => ({ toast: { danger: vi.fn() } }));

import { usePhotoCaptureFlow } from './usePhotoCaptureFlow';

function onlineArchivo(): File {
  return new File(['x'], 'surtidor.jpg', { type: 'image/jpeg' });
}

beforeEach(() => {
  readCaptureDateMock.mockResolvedValue(null);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** Solo pisa el GETTER de `navigator.onLine` — reemplazar `navigator`
 * entero (`vi.stubGlobal`) perdería el resto de sus propiedades (definidas
 * como getters en el prototipo, no copiables con un spread). */
function stubOnline(value: boolean): void {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(value);
}

describe('usePhotoCaptureFlow — OCR offline/timeout', () => {
  it('sin señal (`navigator.onLine === false`), NI SIQUIERA llama a fuelReadingOcr', async () => {
    stubOnline(false);
    const onReadingDetected = vi.fn();
    const { result } = renderHook(() => usePhotoCaptureFlow(onReadingDetected));

    await act(async () => {
      await result.current.handleSelectPhoto(onlineArchivo());
    });

    expect(fuelReadingOcrMock).not.toHaveBeenCalled();
    expect(result.current.ocr).toEqual({ value: null, status: 'UNREADABLE', confidence: 0 });
    expect(onReadingDetected).not.toHaveBeenCalled();
  });

  it('sin señal, no dispara ningún toast de error — el litraje se tipea a mano', async () => {
    stubOnline(false);
    const { toast } = await import('@heroui/react');
    const { result } = renderHook(() => usePhotoCaptureFlow(vi.fn()));

    await act(async () => {
      await result.current.handleSelectPhoto(onlineArchivo());
    });

    expect(toast.danger).not.toHaveBeenCalled();
  });

  it('en línea pero el OCR no contesta: corta a los 8 s y cae a "sin sugerencia" sin toast', async () => {
    vi.useFakeTimers();
    let resolverTardio: (v: { value: string | null; status: string; confidence: number }) => void = () => {};
    fuelReadingOcrMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolverTardio = resolve;
        }),
    );
    const { toast } = await import('@heroui/react');
    const { result } = renderHook(() => usePhotoCaptureFlow(vi.fn()));

    let promesa!: Promise<void>;
    act(() => {
      promesa = result.current.handleSelectPhoto(onlineArchivo());
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(8_000);
      await promesa;
    });

    expect(result.current.ocr).toEqual({ value: null, status: 'UNREADABLE', confidence: 0 });
    expect(toast.danger).not.toHaveBeenCalled();

    // La respuesta tardía, si llega después, ya no se usa — no debe romper
    // nada ni pisar el estado (el componente sigue vivo).
    resolverTardio({ value: '183.0', status: 'CONFIRMED', confidence: 0.9 });
  });

  it('en línea y el OCR contesta rápido, usa esa lectura (comportamiento sin cambios)', async () => {
    fuelReadingOcrMock.mockResolvedValue({ value: '20.5', status: 'CONFIRMED', confidence: 0.95 });
    const onReadingDetected = vi.fn();
    const { result } = renderHook(() => usePhotoCaptureFlow(onReadingDetected));

    await act(async () => {
      await result.current.handleSelectPhoto(onlineArchivo());
    });

    await waitFor(() => expect(result.current.ocr?.status).toBe('CONFIRMED'));
    expect(onReadingDetected).toHaveBeenCalledWith(20.5);
  });
});

describe('usePhotoCaptureFlow — opción `ocr: false`', () => {
  it('con señal y `ocr: false`, NO llama a fuelReadingOcr pero sí lee la fecha EXIF', async () => {
    stubOnline(true);
    const fecha = new Date('2026-09-24T09:00:00.000Z');
    readCaptureDateMock.mockResolvedValue(fecha);
    const { result } = renderHook(() => usePhotoCaptureFlow(vi.fn(), { ocr: false }));

    await act(async () => {
      await result.current.handleSelectPhoto(onlineArchivo());
    });

    expect(fuelReadingOcrMock).not.toHaveBeenCalled();
    expect(result.current.captureDate).toEqual(fecha);
    expect(result.current.ocr).toEqual({ value: null, status: 'UNREADABLE', confidence: 0 });
  });
});
