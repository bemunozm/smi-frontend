import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { RegistrarEntradaModal } from './RegistrarEntradaModal';

const mutateMock = vi.fn();
let isPending = false;
vi.mock('../../hooks/useHorometro', () => ({
  useCreateHorometro: () => ({ mutate: mutateMock, isPending }),
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

function llenarOperador(nombre = 'Juan Pérez') {
  fireEvent.change(screen.getByPlaceholderText('Nombre y apellido'), { target: { value: nombre } });
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

  it('el botón guardar está deshabilitado mientras no haya operador', () => {
    renderModal();
    const guardar = screen.getByRole('button', { name: 'Registrar entrada' });
    expect(guardar.hasAttribute('disabled')).toBe(true);
  });

  it('el botón guardar se habilita con solo cargar el operador — no requiere foto', () => {
    renderModal();
    llenarOperador();
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

  it('guarda con el payload esperado a partir de la carga manual, sin fotoUrl (sin nivel de combustible tocado, no lo manda)', async () => {
    const { onOpenChange } = renderModal();
    llenarOperador();
    incrementar('Horómetro total al iniciar (h)', 3);

    const guardar = screen.getByRole('button', { name: 'Registrar entrada' });
    expect(guardar.hasAttribute('disabled')).toBe(false);
    fireEvent.click(guardar);

    await waitFor(() => expect(mutateMock).toHaveBeenCalledTimes(1));
    const [payload, options] = mutateMock.mock.calls[0];
    expect(payload).toMatchObject({
      equipoId: 'eq_1',
      operador: 'Juan Pérez',
      turno: 'DIURNO',
      valorInicial: 3,
    });
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
    llenarOperador();
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
    llenarOperador();
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

    expect((screen.getByPlaceholderText('Nombre y apellido') as HTMLInputElement).value).toBe('');
    const guardar = screen.getByRole('button', { name: 'Registrar entrada' });
    expect(guardar.hasAttribute('disabled')).toBe(true);
  });

  it('mientras la mutación está pendiente, Guardar y Cancelar quedan deshabilitados (evita doble submit)', () => {
    isPending = true;

    renderModal();
    llenarOperador();

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
    llenarOperador();

    const guardar = screen.getByRole('button', { name: 'Registrar entrada' });
    fireEvent.click(guardar);

    await waitFor(() => expect(mutateMock).toHaveBeenCalledTimes(1));
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
