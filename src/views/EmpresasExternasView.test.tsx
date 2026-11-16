import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';

import type { EmpresaExternaAdmin } from '../types/reporte-diario';

const crearMock = vi.hoisted(() => vi.fn());
const actualizarMock = vi.hoisted(() => vi.fn());
const eliminarMock = vi.hoisted(() => vi.fn());

const EMPRESAS: EmpresaExternaAdmin[] = [
  { id: 'e1', nombre: 'Casa Blanca', activa: true, reportes: 12 },
  { id: 'e2', nombre: 'Spence', activa: true, reportes: 0 },
  { id: 'e3', nombre: 'Hyd', activa: false, reportes: 3 },
];

vi.mock('../hooks/useReporteDiario', () => ({
  useEmpresasExternasAdmin: () => ({ data: EMPRESAS, isPending: false, isError: false, error: null }),
  useCrearEmpresaExterna: () => ({ mutate: crearMock, isPending: false }),
  useActualizarEmpresaExterna: () => ({ mutate: actualizarMock, isPending: false }),
  useEliminarEmpresaExterna: () => ({ mutate: eliminarMock, isPending: false }),
}));

import { EmpresasExternasView } from './EmpresasExternasView';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('EmpresasExternasView', () => {
  it('separa las activas de las desactivadas y dice en cuántos reportes sale cada una', () => {
    render(<EmpresasExternasView />);
    expect(screen.getByTestId('total-activas').textContent).toBe('2 empresas');
    expect(within(screen.getByTestId('empresa-e1')).getByText('En 12 reportes')).toBeTruthy();
    expect(within(screen.getByTestId('empresa-e2')).getByText('Sin reportes todavía')).toBeTruthy();
    expect(within(screen.getByTestId('empresa-e3')).getByRole('button', { name: 'Reactivar' })).toBeTruthy();
  });

  it('agrega una empresa con el nombre limpio', () => {
    render(<EmpresasExternasView />);
    fireEvent.change(screen.getByLabelText('Nombre de la empresa'), { target: { value: '  RT   Minería ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));
    expect(crearMock).toHaveBeenCalledWith('RT Minería', expect.anything());
  });

  it('con reportes ofrece desactivar; sin reportes, eliminar', () => {
    render(<EmpresasExternasView />);
    expect(within(screen.getByTestId('empresa-e1')).getByRole('button', { name: 'Desactivar' })).toBeTruthy();
    fireEvent.click(within(screen.getByTestId('empresa-e2')).getByRole('button', { name: 'Eliminar' }));
    expect(screen.getByText('¿Eliminar Spence?')).toBeTruthy();
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Eliminar' }));
    expect(eliminarMock).toHaveBeenCalledWith('e2', expect.anything());
  });

  it('reactiva una desactivada', () => {
    render(<EmpresasExternasView />);
    fireEvent.click(within(screen.getByTestId('empresa-e3')).getByRole('button', { name: 'Reactivar' }));
    expect(actualizarMock).toHaveBeenCalledWith({ id: 'e3', activa: true });
  });
});
