import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { Table } from '@heroui/react';

import { COLUMNA, Historial, Tabla } from './historial';

/** Mismo truco que `InventarioView.test.tsx`: jsdom no cambia de tamaño. */
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

const REGISTROS = [
  { id: 'r1', equipo: 'PE-004' },
  { id: 'r2', equipo: 'CA-011' },
];

function renderHistorial(size: 'phone' | 'desktop', registros = REGISTROS) {
  setViewport(size);
  return render(
    <Historial
      titulo="Hallazgos del turno"
      vacio="Sin hallazgos del turno."
      hayRegistros={registros.length > 0}
      tarjetas={() => registros.map((r) => <article key={r.id}>{r.equipo}</article>)}
      tabla={() => (
        <Tabla label="Hallazgos del turno">
          <Table.Header>
            <Table.Column className={COLUMNA} isRowHeader>
              Equipo
            </Table.Column>
          </Table.Header>
          <Table.Body>
            {registros.map((r) => (
              <Table.Row key={r.id}>
                <Table.Cell>{r.equipo}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Tabla>
      )}
    />,
  );
}

afterEach(cleanup);

describe('Historial', () => {
  it('en teléfono y tablet muestra tarjetas, no tabla', () => {
    renderHistorial('phone');

    expect(screen.queryByRole('grid')).toBeNull();
    expect(screen.getByText('PE-004')).toBeTruthy();
  });

  it('desde escritorio muestra la tabla', () => {
    renderHistorial('desktop');

    const tabla = screen.getByRole('grid', { name: 'Hallazgos del turno' });
    expect(tabla).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Equipo' })).toBeTruthy();
  });

  /**
   * El motivo de que `tabla` y `tarjetas` sean funciones y no JSX: se construye
   * y se monta UNA sola. Montar las dos y tapar una con CSS dejaría cada
   * registro dos veces en el DOM, y un lector de pantalla leería el historial
   * duplicado — el criterio que documenta `useMediaQuery`.
   */
  it.each(['phone', 'desktop'] as const)('no deja los registros dos veces en el DOM (%s)', (size) => {
    renderHistorial(size);

    for (const registro of REGISTROS) {
      expect(screen.getAllByText(registro.equipo)).toHaveLength(1);
    }
  });

  it('sin registros no monta ninguna de las dos, y dice por qué', () => {
    renderHistorial('desktop', []);

    expect(screen.getByText('Sin hallazgos del turno.')).toBeTruthy();
    expect(screen.queryByRole('grid')).toBeNull();
  });
});
