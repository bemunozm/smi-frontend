import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { RegistrarEntradaModal } from './RegistrarEntradaModal';
import type { Operator } from '../../types/operator';

const OPERATOR: Operator = {
  id: 'op_1',
  name: 'Juan Pérez',
  rut: '12345678-5',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const mutateMock = vi.fn();
let isPending = false;
vi.mock('../../hooks/useHorometro', () => ({
  useCreateHorometro: () => ({ mutate: mutateMock, isPending }),
}));

vi.mock('../../hooks/useOperators', () => ({
  useOperators: () => ({ data: [OPERATOR], isPending: false }),
}));

afterEach(cleanup);

function renderModal(equipoId = 'eq_1', controlUnit: 'HOURS' | 'KM' = 'HOURS') {
  const qc = new QueryClient();
  const onOpenChange = vi.fn();
  const utils = render(
    <QueryClientProvider client={qc}>
      <RegistrarEntradaModal
        controlUnit={controlUnit}
        equipoId={equipoId}
        equipoLabel="EX-001"
        isOpen
        onOpenChange={onOpenChange}
      />
    </QueryClientProvider>,
  );
  return { onOpenChange, qc, ...utils };
}

/** Selecciona el operador de prueba desde el `OperatorPicker` — el trigger se
 * ubica por clase (no por rol/nombre: su nombre accesible termina
 * resolviendo al label del campo, `aria-labelledby` gana sobre `aria-label`,
 * ver `components/operators/OperatorPicker.test.tsx`) y se busca en todo
 * `document`, no en el `container` de `render()`: `Modal.Backdrop` porta su
 * contenido a `document.body` (React Portal), fuera del árbol devuelto. */
function elegirOperador(nombre = 'Juan Pérez') {
  const trigger = document.querySelector('.combo-box__trigger') as HTMLButtonElement;
  fireEvent.click(trigger);
  const opcion = screen.getByRole('option', { name: new RegExp(nombre) });
  fireEvent.click(opcion);
}

/** El registro es manual (sin foto/OCR) — usa el stepper del `NumberField`,
 * mismo patrón ya validado para "Nivel de combustible" en este archivo. */
function incrementar(label: string, veces = 1) {
  const boton = screen.getByRole('button', { name: `Increase ${label}` });
  for (let i = 0; i < veces; i += 1) fireEvent.click(boton);
}

describe('RegistrarEntradaModal', () => {
  beforeEach(() => {
    mutateMock.mockReset();
    isPending = false;
  });

  it('el botón guardar está deshabilitado mientras no haya operador seleccionado', () => {
    renderModal();
    const guardar = screen.getByRole('button', { name: 'Registrar entrada' });
    expect(guardar.hasAttribute('disabled')).toBe(true);
  });

  it('el botón guardar se habilita al elegir un operador — no requiere foto', () => {
    renderModal();
    elegirOperador();
    const guardar = screen.getByRole('button', { name: 'Registrar entrada' });
    expect(guardar.hasAttribute('disabled')).toBe(false);
  });

  it('el label de la lectura es dinámico según controlUnit (HOURS → horómetro)', () => {
    renderModal('eq_1', 'HOURS');
    expect(screen.getByText('Horómetro total al iniciar (h)')).toBeTruthy();
  });

  it('el label de la lectura es dinámico según controlUnit (KM → odómetro)', () => {
    renderModal('eq_1', 'KM');
    expect(screen.getByText('Odómetro total al iniciar (km)')).toBeTruthy();
  });

  it('guarda con el payload esperado a partir de la selección del operador, con operatorId y sin operador/fotoUrl (sin nivel de combustible tocado, no lo manda)', async () => {
    const { onOpenChange } = renderModal();
    elegirOperador();
    incrementar('Horómetro total al iniciar (h)', 3);

    const guardar = screen.getByRole('button', { name: 'Registrar entrada' });
    expect(guardar.hasAttribute('disabled')).toBe(false);
    fireEvent.click(guardar);

    await waitFor(() => expect(mutateMock).toHaveBeenCalledTimes(1));
    const [payload, options] = mutateMock.mock.calls[0];
    expect(payload).toMatchObject({
      equipoId: 'eq_1',
      operatorId: 'op_1',
      turno: 'DIURNO',
      valorInicial: 3,
    });
    // El servidor deriva `operador` (el nombre) a partir de `operatorId` — el
    // cliente ya no lo manda.
    expect(payload.operador).toBeUndefined();
    // ENTRADA: nunca manda `valorFinal` — así el registro queda como turno
    // abierto (ver `types/horometro.ts`).
    expect(payload.valorFinal).toBeUndefined();
    // Sin foto: ya no se manda `fotoUrl`.
    expect(payload.fotoUrl).toBeUndefined();
    // El usuario nunca tocó el stepper de nivel de combustible — no debe
    // mandarse un 0% falso que enmascare el "último nivel" real de la ficha.
    expect(payload.nivelCombustible).toBeUndefined();

    // Simula el `onSuccess` del hook para confirmar que el modal se cierra.
    options.onSuccess();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('si el usuario sí ingresa un nivel de combustible, lo incluye en el payload', async () => {
    renderModal();
    elegirOperador();
    incrementar('Nivel de combustible (%, opcional)');

    const guardar = screen.getByRole('button', { name: 'Registrar entrada' });
    expect(guardar.hasAttribute('disabled')).toBe(false);
    fireEvent.click(guardar);

    await waitFor(() => expect(mutateMock).toHaveBeenCalledTimes(1));
    const [payload] = mutateMock.mock.calls[0];
    expect(payload.nivelCombustible).toBe(1);
  });

  it('Cancelar limpia el estado — reabrir el mismo modal para otro equipo no arrastra el operador/lectura anterior', () => {
    const { onOpenChange, qc, rerender } = renderModal('eq_1');
    elegirOperador();
    incrementar('Horómetro total al iniciar (h)', 3);

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);

    rerender(
      <QueryClientProvider client={qc}>
        <RegistrarEntradaModal
          controlUnit="HOURS"
          equipoId="eq_2"
          equipoLabel="EX-002"
          isOpen={false}
          onOpenChange={onOpenChange}
        />
      </QueryClientProvider>,
    );
    rerender(
      <QueryClientProvider client={qc}>
        <RegistrarEntradaModal
          controlUnit="HOURS"
          equipoId="eq_2"
          equipoLabel="EX-002"
          isOpen
          onOpenChange={onOpenChange}
        />
      </QueryClientProvider>,
    );

    const guardar = screen.getByRole('button', { name: 'Registrar entrada' });
    expect(guardar.hasAttribute('disabled')).toBe(true);
  });

  it('mientras la mutación está pendiente, Guardar y Cancelar quedan deshabilitados (evita doble submit)', () => {
    isPending = true;

    renderModal();
    elegirOperador();

    // Con `isPending` el botón muestra un spinner en vez del texto "Registrar
    // entrada" (ver el render-prop `{ isPending }` del `Button`), así que acá
    // se busca por el atributo `form` en vez de por nombre accesible.
    const guardar = document.querySelector('button[form="registrar-entrada-form"]') as HTMLButtonElement;
    const cancelar = screen.getByRole('button', { name: 'Cancelar' });
    expect(guardar.hasAttribute('disabled')).toBe(true);
    expect(cancelar.hasAttribute('disabled')).toBe(true);
  });

  // El backend rechaza (400) abrir un segundo turno si el equipo ya tiene
  // uno en curso ("El equipo ya tiene un turno en curso…") — ese mensaje
  // debe llegar tal cual al usuario vía el `onError` de `useCreateHorometro`
  // (no se prueba acá el toast en sí, que está mockeado como hook completo;
  // esto confirma que el modal no hace nada que lo enmascare, como cerrar
  // optimistamente antes de que la mutación resuelva).
  it('un fallo de la mutación no cierra el modal (el error queda visible)', async () => {
    mutateMock.mockImplementation((_payload, options?: { onSuccess?: () => void }) => {
      // No se llama a onSuccess: simula que la mutación falló (400 "turno en
      // curso") — el hook real solo toastea en `onError`, no cierra el modal.
      void options;
    });

    const { onOpenChange } = renderModal();
    elegirOperador();

    const guardar = screen.getByRole('button', { name: 'Registrar entrada' });
    fireEvent.click(guardar);

    await waitFor(() => expect(mutateMock).toHaveBeenCalledTimes(1));
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
