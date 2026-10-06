import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ROLES, type Role } from '../types/roles';
import { MantenimientoView } from './MantenimientoView';

let mockRole: Role = ROLES.MANTENEDOR;

vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ role: mockRole }),
}));

// Los paneles tienen sus propias suites — acá solo importa qué panel se monta.
vi.mock('./OrdenesTrabajoView', () => ({ OrdenesTrabajoView: () => <p>panel-ordenes</p> }));
vi.mock('./WorkshopStockView', () => ({ WorkshopStockView: () => <p>panel-stock</p> }));
vi.mock('./PreventivoView', () => ({ PreventivoView: () => <p>panel-preventivo</p> }));
vi.mock('./ActividadesView', () => ({ ActividadesView: () => <p>panel-tareas</p> }));

afterEach(cleanup);

describe('MantenimientoView', () => {
  it('la barra inferior es sticky (mecánica de TerrenoLayout), nunca fixed: fixed se superpone al BottomNav global', () => {
    render(<MantenimientoView />);
    const nav = screen.getByRole('navigation', { name: 'Secciones de Mantenimiento' });
    expect(nav.className).toContain('sticky');
    expect(nav.className).toContain('bottom-0');
    expect(nav.className).not.toContain('fixed');
  });

  it('MANTENEDOR ve solo Órdenes y Stock', () => {
    render(<MantenimientoView />);
    const nav = screen.getByRole('navigation', { name: 'Secciones de Mantenimiento' });
    const labels = Array.from(nav.querySelectorAll('button')).map((b) => b.textContent);
    expect(labels).toEqual(['Órdenes', 'Stock']);
  });

  it('ADMIN ve también Preventivo y Tareas', () => {
    mockRole = ROLES.ADMIN;
    render(<MantenimientoView />);
    const nav = screen.getByRole('navigation', { name: 'Secciones de Mantenimiento' });
    const labels = Array.from(nav.querySelectorAll('button')).map((b) => b.textContent);
    expect(labels).toEqual(['Órdenes', 'Stock', 'Preventivo', 'Tareas']);
    mockRole = ROLES.MANTENEDOR;
  });

  it('cambiar de sección monta el panel correspondiente y marca el botón activo', () => {
    render(<MantenimientoView />);
    expect(screen.getByText('panel-ordenes')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Stock' }));
    expect(screen.getByText('panel-stock')).toBeTruthy();
    expect(screen.queryByText('panel-ordenes')).toBeNull();
    expect(screen.getByRole('button', { name: 'Stock' }).getAttribute('aria-current')).toBe('page');
  });
});
