import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { CierreTemporalForm } from './CierreTemporalForm';
import { DomainError } from '../../lib/api-error';
import type { TarjetaTemporal } from '../../lib/informe-temporal';

const { mutateAsyncMock } = vi.hoisted(() => ({ mutateAsyncMock: vi.fn() }));

vi.mock('../../hooks/useInformesTemporales', () => ({
  useCrearInformeTemporal: () => ({ mutateAsync: mutateAsyncMock, isPending: false }),
}));
vi.mock('../../hooks/useOperators', () => ({ useOperators: () => ({ data: [], isPending: false }) }));
vi.mock('../../api/OcrAPI', () => ({ fuelReadingOcr: vi.fn() }));
vi.mock('@heroui/react', async (original) => ({
  ...(await original<typeof import('@heroui/react')>()),
  toast: { danger: vi.fn(), success: vi.fn() },
}));

const INFORME_ID = '7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';

const TARJETAS: TarjetaTemporal[] = [
  { id: 'c1', equipoId: 'e1', codigo: 'CA-003', nombre: 'Cargador SEM 656F', liviano: false, inicial: 1200 },
  { id: 'c2', equipoId: 'e2', codigo: 'CM-001', nombre: 'Camioneta Toyota Hilux', liviano: true, inicial: 45120 },
];

function renderForm(onEnviado = vi.fn()) {
  const queryClient = new QueryClient();
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  render(
    <QueryClientProvider client={queryClient}>
      <CierreTemporalForm
        informeId={INFORME_ID}
        tarjetas={TARJETAS}
        supervisorNombre="Pedro Soto"
        onEnviado={onEnviado}
      />
    </QueryClientProvider>,
  );
  return { onEnviado, invalidate };
}

function llenarMinimo() {
  const fila1 = screen.getByRole('group', { name: /CA-003/ });
  fireEvent.change(within(fila1).getByLabelText(/Horómetro final/), { target: { value: '1210' } });
  const fila2 = screen.getByRole('group', { name: /CM-001/ });
  fireEvent.change(within(fila2).getByLabelText(/Kilometraje final/), { target: { value: '45200' } });
  fireEvent.change(screen.getByLabelText(/Actividad realizada 1/), { target: { value: 'Limpieza de cancha' } });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('CierreTemporalForm', () => {
  it('muestra una fila por cada tarjeta abierta', () => {
    renderForm();
    expect(screen.getByRole('group', { name: /CA-003/ })).toBeTruthy();
    expect(screen.getByRole('group', { name: /CM-001/ })).toBeTruthy();
    expect(screen.getByText('Cargador SEM 656F')).toBeTruthy();
    // AdBlue solo en el pesado.
    expect(within(screen.getByRole('group', { name: /CA-003/ })).getByText('¿Se cargó AdBlue?')).toBeTruthy();
    expect(within(screen.getByRole('group', { name: /CM-001/ })).queryByText('¿Se cargó AdBlue?')).toBeNull();
    // El supervisor responsable 1 viene precargado.
    expect((screen.getByLabelText(/Supervisor responsable 1/) as HTMLInputElement).value).toBe('Pedro Soto');
  });

  it('avisa si tiene algo escrito, comparando con lo inicial', () => {
    const onCambiosChange = vi.fn();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CierreTemporalForm
          informeId={INFORME_ID}
          tarjetas={TARJETAS}
          supervisorNombre="Pedro Soto"
          onEnviado={vi.fn()}
          onCambiosChange={onCambiosChange}
        />
      </QueryClientProvider>,
    );
    // Recién abierto (con el supervisor precargado y las filas avisando su foto vacía): limpio.
    expect(onCambiosChange).toHaveBeenLastCalledWith(false);

    const fila = screen.getByRole('group', { name: /CA-003/ });
    fireEvent.change(within(fila).getByLabelText(/Horómetro final/), { target: { value: '1210' } });
    expect(onCambiosChange).toHaveBeenLastCalledWith(true);
    fireEvent.change(within(fila).getByLabelText(/Horómetro final/), { target: { value: '' } });
    expect(onCambiosChange).toHaveBeenLastCalledWith(false);

    fireEvent.change(screen.getByLabelText(/Observaciones/), { target: { value: 'Lluvia' } });
    expect(onCambiosChange).toHaveBeenLastCalledWith(true);
  });

  it('sin actividad 1 no envía y lo dice', async () => {
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: /Enviar informe/ }));
    expect(await screen.findAllByText(/Escribe la actividad realizada/)).toBeTruthy();
    expect(mutateAsyncMock).not.toHaveBeenCalled();
  });

  it('enviar llama al hook con un cierre por tarjeta y los datos de la hoja', async () => {
    mutateAsyncMock.mockResolvedValue({ status: 'sent', data: null });
    const { onEnviado } = renderForm();
    llenarMinimo();
    fireEvent.click(screen.getByRole('button', { name: 'Escribir nombre en actividad 1' }));
    fireEvent.change(screen.getByLabelText('Nombre de la persona 1 de la actividad 1'), {
      target: { value: 'Juan Pérez' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Enviar informe/ }));

    await waitFor(() => expect(mutateAsyncMock).toHaveBeenCalledTimes(1));
    const { informe, fotos } = mutateAsyncMock.mock.calls[0]![0];
    expect(informe).toMatchObject({
      actividad1: 'Limpieza de cancha',
      supervisorResponsable1: 'Pedro Soto',
      personal: [{ actividad: 1, operatorId: null, nombre: 'Juan Pérez' }],
    });
    expect(informe.id).toBe(INFORME_ID);
    expect(informe.cierres).toHaveLength(2);
    expect(informe.cierres[0]).toMatchObject({ cardId: 'c1', valorFinal: 1210, fuelLiters: 0 });
    expect(informe.cierres[1]).toMatchObject({ cardId: 'c2', valorFinal: 45200, fuelLiters: 0 });
    expect(informe.cierres[0].closeClientId).not.toBe(informe.cierres[1].closeClientId);
    expect(fotos).toEqual({});
    await waitFor(() => expect(onEnviado).toHaveBeenCalledTimes(1));
  });

  it('un 409 INFORME_TARJETAS_DESCUADRADAS se muestra en el formulario y el reintento repite los ids', async () => {
    mutateAsyncMock.mockRejectedValueOnce(
      new DomainError('Hay tarjetas abiertas que no están en el informe.', {
        code: 'INFORME_TARJETAS_DESCUADRADAS',
        status: 409,
      }),
    );
    const { onEnviado, invalidate } = renderForm();
    llenarMinimo();
    fireEvent.click(screen.getByRole('button', { name: /Enviar informe/ }));

    expect(await screen.findByText('Hay tarjetas abiertas que no están en el informe.')).toBeTruthy();
    expect(onEnviado).not.toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalled();

    mutateAsyncMock.mockResolvedValueOnce({ status: 'queued', opId: 'op1' });
    fireEvent.click(screen.getByRole('button', { name: /Enviar informe/ }));
    await waitFor(() => expect(mutateAsyncMock).toHaveBeenCalledTimes(2));
    const primero = mutateAsyncMock.mock.calls[0]![0].informe;
    const segundo = mutateAsyncMock.mock.calls[1]![0].informe;
    expect(segundo.id).toBe(primero.id);
    expect(segundo.cierres.map((c: { closeClientId: string }) => c.closeClientId)).toEqual(
      primero.cierres.map((c: { closeClientId: string }) => c.closeClientId),
    );
    await waitFor(() => expect(onEnviado).toHaveBeenCalledTimes(1));
  });
});
