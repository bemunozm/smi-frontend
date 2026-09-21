import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HallazgosView } from './HallazgosView';

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

    const tabla = screen.getByRole('grid', { name: 'Hallazgos del turno' });
    expect(tabla).toBeTruthy();
    for (const columna of ['Equipo', 'Prioridad', 'Descripción', 'Estado', 'Fecha']) {
      expect(screen.getByRole('columnheader', { name: columna })).toBeTruthy();
    }

    expect(screen.getByText('Registrar hallazgo')).toBeTruthy();
    expect(screen.getByText('Nivel de prioridad')).toBeTruthy();
  });
});
