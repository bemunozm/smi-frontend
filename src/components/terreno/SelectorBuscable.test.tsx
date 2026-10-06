import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { SelectorBuscable, type OpcionSelector } from './ui';

afterEach(cleanup);

const OPCIONES: OpcionSelector[] = [
  { valor: 'i1', titulo: 'AC-1540', detalle: 'Aceite motor 15W-40', grupo: 'Suministros', motivo: 'Sin stock en Faena' },
  { valor: 'i2', titulo: 'FL-220', detalle: 'Filtro de aceite', grupo: 'Repuestos', aviso: '4 u en Faena' },
];

function renderSelector(onChange = vi.fn()) {
  render(
    <SelectorBuscable
      etiqueta="Insumo"
      opciones={OPCIONES}
      placeholder="Busca por código o nombre…"
      tituloTabular
      valor=""
      onChange={onChange}
    />,
  );
  return onChange;
}

describe('SelectorBuscable (kit de Terreno)', () => {
  it('abre con grupos, avisos y lo sin stock apagado con su motivo', async () => {
    renderSelector();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Insumo' }));

    await waitFor(() => expect(screen.getByText('Suministros')).toBeTruthy());
    expect(screen.getByText('Repuestos')).toBeTruthy();
    const sinStock = screen.getByRole('option', { name: /AC-1540/ });
    expect(sinStock.textContent).toContain('Sin stock en Faena');
    expect(sinStock.getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByRole('option', { name: /FL-220/ }).textContent).toContain('4 u en Faena');
  });

  it('filtra ESCRIBIENDO y entrega el valor al elegir', async () => {
    const onChange = renderSelector();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Insumo' }));
    await waitFor(() => screen.getByRole('option', { name: /AC-1540/ }));

    fireEvent.change(screen.getByPlaceholderText('Busca por código o nombre…'), {
      target: { value: 'filtro' },
    });

    const opcion = await waitFor(() => screen.getByRole('option', { name: /FL-220/ }));
    expect(screen.queryByRole('option', { name: /AC-1540/ })).toBeNull();
    fireEvent.click(opcion);

    await waitFor(() => expect(onChange).toHaveBeenCalledWith('i2'));
  });
});
