import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HallazgosView } from './HallazgosView';
import { updateHallazgo } from '../api/HallazgosAPI';

/** La corrección y el historial de cambios van al servidor; acá se simulan. */
vi.mock('../api/HallazgosAPI', async (original) => ({
  ...(await original<typeof import('../api/HallazgosAPI')>()),
  updateHallazgo: vi.fn(async ({ id }: { id: string }) => ({ id })),
  listCambiosHallazgo: vi.fn(async () => [
    {
      id: 'c1',
      userName: 'José Pérez',
      createdAt: '2026-10-01T22:10:00.000Z',
      changes: [{ field: 'prioridad', label: 'Prioridad', before: 'Media', after: 'Alta' }],
    },
  ]),
}));

/** jsdom no cambia de tamaño; el ancho se simula igual que en Inventario. */
function setViewport(size: 'phone' | 'desktop'): void {
  window.matchMedia = ((query: string) => ({
    matches: size === 'desktop' && query.includes('1024px'),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

function renderView(size: 'phone' | 'desktop' = 'phone') {
  setViewport(size);
  const qc = new QueryClient();
  qc.setQueryData(
    ['equipment'],
    [{ id: 'e1', internalCode: 'PE-004', type: 'Perforadora' }],
  );
  qc.setQueryData(
    ['hallazgos'],
    [{ id: 'h1', equipoId: 'e1', descripcion: 'Fuga de aceite hidráulico', prioridad: 'ALTA', estado: 'ABIERTO', fotoUrl: null, fecha: '2026-08-01T08:12:00.000Z', equipo: { internalCode: 'PE-004' } }],
  );

  return render(
    <QueryClientProvider client={qc}>
      <HallazgosView />
    </QueryClientProvider>,
  );
}

afterEach(cleanup);

describe('HallazgosView', () => {
  it('renderiza con datos sin lanzar', () => {
    renderView();

    expect(screen.getByText('Nivel de prioridad')).toBeTruthy();
    expect(screen.getByText('Registrar hallazgo')).toBeTruthy();
    expect(screen.getByText('Fuga de aceite hidráulico')).toBeTruthy();
  });

  /**
   * En escritorio el historial es una tabla, como en Inventario — pero el
   * formulario sigue siendo un formulario al lado, no se convierte en nada.
   */
  it('en escritorio muestra el historial como tabla, sin perder el formulario', () => {
    renderView('desktop');

    expect(screen.getByRole('table', { name: /Hallazgos recientes/ })).toBeTruthy();
    for (const columna of ['Fecha', 'Equipo', 'Prioridad', 'Descripción', 'Foto', 'Estado']) {
      expect(screen.getByRole('columnheader', { name: columna })).toBeTruthy();
    }

    expect(screen.getByText('Registrar hallazgo')).toBeTruthy();
    expect(screen.getByText('Nivel de prioridad')).toBeTruthy();
  });

  /**
   * La foto de un hallazgo se sube al storage privado (el mismo campo que usa
   * Flota), no por `/api/uploads`. Y es opcional: el encabezado tiene que
   * decirlo, porque ese componente por defecto dice "requerida" en rojo.
   */
  /** Acta N.° 004, R11: para que el supervisor no lo avise además por radio. */
  it('dice que el aviso llega a mantenedores y administrador', () => {
    renderView();

    expect(screen.getByText(/se avisa a los mantenedores y al administrador/)).toBeTruthy();
  });

  it('ofrece la foto de respaldo como opcional', () => {
    renderView();

    expect(screen.getByText('· opcional')).toBeTruthy();
    expect(screen.queryByText('· requerida')).toBeNull();
    expect(screen.getByText('Foto del hallazgo')).toBeTruthy();
  });

  /**
   * Acta N.° 004, R13: un hallazgo mal cargado se corrige sin autorización,
   * avisando antes de guardar que el administrador se entera, y con el
   * historial de quién cambió qué.
   */
  describe('corregir un hallazgo', () => {
    afterEach(() => vi.clearAllMocks());

    const abrirEdicion = (size: 'phone' | 'desktop' = 'phone') => {
      renderView(size);
      fireEvent.click(screen.getByRole('button', { name: /Editar hallazgo de PE-004/ }));
      return within(screen.getByRole('dialog'));
    };

    it('abre la corrección prellenada, con el aviso y el historial', async () => {
      const ventana = abrirEdicion();

      expect(ventana.getByText(/Al guardar se avisa al administrador/)).toBeTruthy();
      expect(ventana.getByDisplayValue('Fuga de aceite hidráulico')).toBeTruthy();
      expect(await ventana.findByText('José Pérez')).toBeTruthy();
    });

    it('guarda la corrección con el registro completo', async () => {
      const ventana = abrirEdicion('desktop');

      fireEvent.click(within(ventana.getByRole('group', { name: 'Nivel de prioridad' })).getByRole('button', { name: 'CRÍTICA' }));
      fireEvent.click(ventana.getByRole('button', { name: /Guardar cambios/ }));

      await waitFor(() => expect(updateHallazgo).toHaveBeenCalled());
      expect(vi.mocked(updateHallazgo).mock.calls[0][0]).toEqual({
        id: 'h1',
        payload: { equipoId: 'e1', descripcion: 'Fuga de aceite hidráulico', prioridad: 'CRITICA', estado: 'ABIERTO' },
      });
      expect(await ventana.findByText(/Cambio guardado. Se avisó al administrador./)).toBeTruthy();
    });

    it('no deja guardar sin descripción', () => {
      const ventana = abrirEdicion();
      fireEvent.change(ventana.getByDisplayValue('Fuga de aceite hidráulico'), { target: { value: '' } });

      expect(ventana.getByRole('button', { name: /Guardar cambios/ }).hasAttribute('disabled')).toBe(true);
    });
  });
});
