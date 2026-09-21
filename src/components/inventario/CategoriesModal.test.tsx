import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { CategoriesModal } from './CategoriesModal';
import type { ItemCategory } from '../../types/category';

afterEach(cleanup);

function category(
  over: Partial<ItemCategory> & Pick<ItemCategory, 'id' | 'name'>,
): ItemCategory {
  return {
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    _count: { items: 0 },
    ...over,
  };
}

const EN_USO = category({ id: 'c1', name: 'Filtros', _count: { items: 12 } });
const VACIA = category({ id: 'c2', name: 'Filttros' });

function renderModal(categories: ItemCategory[]) {
  const qc = new QueryClient();
  qc.setQueryData(['inventory', 'categories', {}], categories);

  render(
    <QueryClientProvider client={qc}>
      <CategoriesModal />
    </QueryClientProvider>,
  );

  fireEvent.click(screen.getByRole('button', { name: 'Categorías' }));
}

describe('CategoriesModal', () => {
  it('explica por qué no puede eliminar, en vez de apagar el botón', () => {
    // Un botón apagado no dice por qué lo está: el usuario aprieta, no pasa
    // nada, y se queda sin saber qué hacer. Se deja vivo y al apretarlo
    // explica el paso que falta.
    renderModal([EN_USO, VACIA]);

    const [enUso] = screen.getAllByRole('button', { name: 'Eliminar' });
    expect(enUso.hasAttribute('disabled')).toBe(false);

    fireEvent.click(enUso);

    expect(screen.getByText(/no se puede eliminar/)).toBeTruthy();
    expect(screen.getByText(/cambiale la/)).toBeTruthy();
    expect(screen.getByText('12 ítems')).toBeTruthy();
  });

  it('elimina sin ceremonia la categoría que nadie usa', () => {
    renderModal([VACIA]);

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));

    expect(screen.queryByText(/no se puede eliminar/)).toBeNull();
  });

  it('no deja guardar un renombrado que no cambia nada', () => {
    renderModal([VACIA]);

    expect(
      screen.getByRole('button', { name: 'Guardar' }).hasAttribute('disabled'),
    ).toBe(true);

    fireEvent.change(screen.getByLabelText('Nombre de Filttros'), {
      target: { value: 'Filtros' },
    });

    expect(
      screen.getByRole('button', { name: 'Guardar' }).hasAttribute('disabled'),
    ).toBe(false);
  });

  it('no deja agregar una categoría con un nombre de una letra', () => {
    renderModal([]);

    const agregar = screen.getByRole('button', { name: 'Agregar' });
    expect(agregar.hasAttribute('disabled')).toBe(true);

    fireEvent.change(screen.getByLabelText('Nueva categoría'), {
      target: { value: 'A' },
    });
    expect(agregar.hasAttribute('disabled')).toBe(true);

    fireEvent.change(screen.getByLabelText('Nueva categoría'), {
      target: { value: 'EPP' },
    });
    expect(agregar.hasAttribute('disabled')).toBe(false);
  });
});
