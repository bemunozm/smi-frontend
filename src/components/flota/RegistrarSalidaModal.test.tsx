import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { RegistrarSalidaModal } from './RegistrarSalidaModal';
import type { OpenShift } from '../../types/equipment';

const mutateMock = vi.fn();
let isPending = false;
vi.mock('../../hooks/useHorometro', () => ({
  useCerrarHorometro: () => ({ mutate: mutateMock, isPending }),
}));

afterEach(cleanup);

// Lectura inicial chica a propósito: el registro es manual (sin foto/OCR),
// así que estos tests suben la lectura final con el stepper del
// `NumberField` (mismo patrón ya validado para "Nivel de combustible") — un
// `valorInicial` de miles habría exigido cientos de clicks para superarlo.
const OPEN_SHIFT: OpenShift = {
  id: 'h_abierto',
  valorInicial: 5,
  operador: 'Ana Rojas',
  turno: 'DIURNO',
  fecha: '2026-09-15T08:00:00.000Z',
};

function renderModal(openShift: OpenShift = OPEN_SHIFT, controlUnit: 'HOURS' | 'KM' = 'HOURS') {
  const qc = new QueryClient();
  const onOpenChange = vi.fn();
  const utils = render(
    <QueryClientProvider client={qc}>
      <RegistrarSalidaModal
        controlUnit={controlUnit}
        equipoLabel="EX-001"
        isOpen
        onOpenChange={onOpenChange}
        openShift={openShift}
      />
    </QueryClientProvider>,
  );
  return { onOpenChange, qc, ...utils };
}

function incrementar(label: string, veces = 1) {
  const boton = screen.getByRole('button', { name: `Increase ${label}` });
  for (let i = 0; i < veces; i += 1) fireEvent.click(boton);
}

describe('RegistrarSalidaModal', () => {
  beforeEach(() => {
    mutateMock.mockReset();
    isPending = false;
  });

  it('muestra el contexto del turno abierto: operador, turno y lectura inicial', () => {
    renderModal();

    expect(screen.getByText('Ana Rojas')).toBeTruthy();
    expect(screen.getByText('Diurno')).toBeTruthy();
    expect(screen.getByText('5 h')).toBeTruthy();
  });

  it('el label de la lectura final es dinámico según controlUnit (KM → odómetro)', () => {
    renderModal(OPEN_SHIFT, 'KM');
    expect(screen.getByText('Odómetro total al terminar (km)')).toBeTruthy();
  });

  it('el botón guardar está deshabilitado por defecto (el valor final por defecto es menor que la inicial)', () => {
    renderModal();
    const guardar = screen.getByRole('button', { name: 'Registrar salida' });
    expect(guardar.hasAttribute('disabled')).toBe(true);
  });

  it('muestra el preview de uso en vivo (verde) cuando la lectura final es válida', () => {
    renderModal();
    incrementar('Horómetro total al terminar (h)', 8);

    // 8 (final) − 5 (inicial) = 3 h de uso.
    expect(screen.getByText(/Uso: 3/)).toBeTruthy();
    expect(screen.queryByText(/no puede ser menor que la inicial/)).toBeNull();
  });

  it('marca la lectura final como inválida (y deshabilita guardar) si es menor que la inicial', () => {
    renderModal();
    incrementar('Horómetro total al terminar (h)', 2);

    expect(screen.getByText(/no puede ser menor que la inicial/)).toBeTruthy();
    const guardar = screen.getByRole('button', { name: 'Registrar salida' });
    expect(guardar.hasAttribute('disabled')).toBe(true);
  });

  it('guarda con el payload esperado (id del turno abierto, sin fotoUrlSalida, sin nivel de combustible si no se tocó)', async () => {
    const { onOpenChange } = renderModal();
    incrementar('Horómetro total al terminar (h)', 8);

    const guardar = screen.getByRole('button', { name: 'Registrar salida' });
    expect(guardar.hasAttribute('disabled')).toBe(false);
    fireEvent.click(guardar);

    await waitFor(() => expect(mutateMock).toHaveBeenCalledTimes(1));
    const [args, options] = mutateMock.mock.calls[0];
    expect(args).toEqual({
      id: 'h_abierto',
      payload: {
        valorFinal: 8,
        nivelCombustible: undefined,
      },
    });
    expect(args.payload.fotoUrlSalida).toBeUndefined();

    options.onSuccess();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('si el usuario sí ingresa un nivel de combustible, lo incluye en el payload', async () => {
    renderModal();
    incrementar('Horómetro total al terminar (h)', 8);
    incrementar('Nivel de combustible (%, opcional)');

    const guardar = screen.getByRole('button', { name: 'Registrar salida' });
    expect(guardar.hasAttribute('disabled')).toBe(false);
    fireEvent.click(guardar);

    await waitFor(() => expect(mutateMock).toHaveBeenCalledTimes(1));
    const [{ payload }] = mutateMock.mock.calls[0];
    expect(payload.nivelCombustible).toBe(1);
  });

  it('Cancelar limpia el estado y no queda arrastrado al reabrir', () => {
    const { onOpenChange, qc, rerender } = renderModal();
    incrementar('Horómetro total al terminar (h)', 8);
    expect(screen.getByText(/Uso: 3/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);

    rerender(
      <QueryClientProvider client={qc}>
        <RegistrarSalidaModal
          controlUnit="HOURS"
          equipoLabel="EX-001"
          isOpen={false}
          onOpenChange={onOpenChange}
          openShift={OPEN_SHIFT}
        />
      </QueryClientProvider>,
    );
    rerender(
      <QueryClientProvider client={qc}>
        <RegistrarSalidaModal
          controlUnit="HOURS"
          equipoLabel="EX-001"
          isOpen
          onOpenChange={onOpenChange}
          openShift={OPEN_SHIFT}
        />
      </QueryClientProvider>,
    );

    // El preview vuelve a su estado inicial (valorFinal en 0, por debajo de
    // la lectura inicial) — no queda arrastrado el "Uso: 3" del intento
    // anterior. El chip en sí sigue presente (danger, "—") porque el
    // `NumberField` siempre parte controlado en 0, igual que antes de tocarlo.
    expect(screen.queryByText(/Uso: 3/)).toBeNull();
    const guardar = screen.getByRole('button', { name: 'Registrar salida' });
    expect(guardar.hasAttribute('disabled')).toBe(true);
  });

  it('mientras la mutación está pendiente, Guardar y Cancelar quedan deshabilitados (evita doble submit)', () => {
    isPending = true;

    renderModal();

    const guardar = document.querySelector('button[form="registrar-salida-form"]') as HTMLButtonElement;
    const cancelar = screen.getByRole('button', { name: 'Cancelar' });
    expect(guardar.hasAttribute('disabled')).toBe(true);
    expect(cancelar.hasAttribute('disabled')).toBe(true);
  });
});
