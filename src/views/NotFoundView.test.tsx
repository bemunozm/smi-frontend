import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';

import { NotFoundView } from './NotFoundView';

vi.mock('../hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ role: 'ADMIN' }) }));

afterEach(cleanup);

/** El mismo armado que `routes.tsx`: la redirección vieja y el comodín al final. */
function renderEn(ruta: string) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route element={<div>Dashboard</div>} path="/" />
        <Route element={<div>Calendario de livianos</div>} path="/equipos/vencimientos" />
        <Route element={<Navigate replace to="/equipos/vencimientos" />} path="/vencimientos" />
        <Route element={<NotFoundView />} path="*" />
      </Routes>
    </MemoryRouter>,
  );
}

describe('NotFoundView', () => {
  it('una dirección que no existe muestra «Página no encontrada» y vuelve al inicio', () => {
    renderEn('/algo-que-no-existe');
    expect(screen.getByText('Página no encontrada')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Volver al inicio' }));
    expect(screen.getByText('Dashboard')).toBeTruthy();
  });

  it('el calendario en su dirección vieja (/vencimientos) llega a la nueva', () => {
    renderEn('/vencimientos');
    expect(screen.getByText('Calendario de livianos')).toBeTruthy();
  });
});
