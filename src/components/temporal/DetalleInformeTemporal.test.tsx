import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';

import type { InformeTemporal } from '../../types/informe-temporal';
import { DetalleInformeTemporal } from './DetalleInformeTemporal';

const informe = (over: Partial<InformeTemporal> = {}): InformeTemporal => ({
  antiguo: false,
  equiposRegistrados: [],
  id: 'i1',
  numero: 7,
  fecha: '2026-11-20',
  turno: 'DIURNO',
  actividad1: 'Carga de material',
  actividad2: null,
  personal: [{ actividad: 1, operatorId: null, nombre: 'Luis Vera' }],
  observaciones: null,
  supervisorResponsable1: 'Ana Soto',
  supervisorResponsable2: null,
  supervisorId: 'u1',
  supervisorNombre: 'Tomás Rojas',
  inicio: '2026-11-20T10:00:00.000Z',
  fin: '2026-11-20T20:00:00.000Z',
  createdAt: '2026-11-20T20:00:00.000Z',
  updatedAt: '2026-11-20T20:00:00.000Z',
  tarjetas: [],
  ...over,
});

afterEach(cleanup);

describe('DetalleInformeTemporal · foto del report', () => {
  it('muestra «Foto del report» con la URL firmada cuando el informe la trae', () => {
    render(<DetalleInformeTemporal informe={informe({ fotoUrl: 'https://fotos.test/report.jpg' })} />);

    expect(screen.getByText('Foto del report')).toBeTruthy();
    const img = screen.getByRole('img', { name: 'Foto del report' });
    expect(img.getAttribute('src')).toBe('https://fotos.test/report.jpg');
  });

  it('no muestra la sección cuando no hay foto (null o ausente)', () => {
    render(<DetalleInformeTemporal informe={informe({ fotoUrl: null })} />);
    expect(screen.queryByText('Foto del report')).toBeNull();
    cleanup();

    render(<DetalleInformeTemporal informe={informe()} />);
    expect(screen.queryByText('Foto del report')).toBeNull();
    expect(screen.queryByRole('img')).toBeNull();
  });
});

describe('DetalleInformeTemporal · informe subido después', () => {
  it('muestra el chip y sus equipos escritos a mano como los de una tarjeta, sin «Corregir»', () => {
    render(
      <DetalleInformeTemporal
        informe={informe({
          antiguo: true,
          equiposRegistrados: [
            { equipoId: 'e1', codigo: 'COMPRESOR', nombre: 'Compresor Kaeser M50', unidad: 'h', inicial: 484.92, final: 487.1, litros: 12 },
          ],
        })}
        onCorregirTarjeta={() => {}}
      />,
    );
    expect(screen.getByText('Subido después')).toBeTruthy();
    expect(screen.getByText('Equipos · 1')).toBeTruthy();
    expect(screen.getByText('COMPRESOR')).toBeTruthy();
    expect(screen.getByText('Inicial: 484,92 h')).toBeTruthy();
    expect(screen.getByText('Final: 487,1 h')).toBeTruthy();
    expect(screen.getByText('Combustible: 12 L')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Corregir/ })).toBeNull();
    // Sin tarjetas no hay ventana real que mostrar.
    expect(screen.queryByText('Inicio')).toBeNull();
  });
});
