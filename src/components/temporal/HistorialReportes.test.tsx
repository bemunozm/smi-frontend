import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, within } from '@testing-library/react';

import type { InformePendiente } from '../../hooks/useMisInformesProjection';
import type { InformeTemporal } from '../../types/informe-temporal';

const { proyeccion } = vi.hoisted(() => ({ proyeccion: vi.fn() }));
vi.mock('../../hooks/useMisInformesProjection', () => ({ useMisInformesProjection: () => proyeccion() }));

import { HistorialReportes } from './HistorialReportes';

const informe = (over: Partial<InformeTemporal> & Pick<InformeTemporal, 'id' | 'numero'>): InformeTemporal => ({
  fecha: '2026-11-20',
  turno: 'DIURNO',
  actividad1: 'Carga de material',
  actividad2: 'Riego de caminos',
  personal: [
    { actividad: 1, operatorId: null, nombre: 'Luis Vera' },
    { actividad: 2, operatorId: 'op1', nombre: 'Marta Díaz' },
  ],
  observaciones: 'Sin novedades',
  supervisorResponsable1: 'Ana Soto',
  supervisorResponsable2: 'Pedro Rojas',
  supervisorId: 'u1',
  supervisorNombre: 'Tomás Rojas',
  inicio: '2026-11-20T10:00:00.000Z',
  fin: '2026-11-20T20:00:00.000Z',
  createdAt: '2026-11-20T20:00:00.000Z',
  updatedAt: '2026-11-20T20:00:00.000Z',
  tarjetas: [
    {
      id: 'c1',
      equipo: { id: 'e1', internalCode: 'EX-1', name: 'Excavadora' },
      operador: 'Juan',
      valorInicial: 100,
      valorFinal: 108,
      fuelLiters: 40,
      adBlueLiters: 5,
      pumpPhotoUrl: 'https://fotos.test/bomba.jpg',
      fecha: '2026-11-20T12:00:00.000Z',
      fechaSalida: '2026-11-20T19:00:00.000Z',
    },
    {
      id: 'c2',
      equipo: { id: 'e2', internalCode: 'CA-2', name: 'Camión' },
      operador: 'Pablo',
      valorInicial: 50,
      valorFinal: 52,
      fuelLiters: null,
      adBlueLiters: null,
      pumpPhotoUrl: null,
      fecha: '2026-11-20T12:00:00.000Z',
      fechaSalida: '2026-11-20T19:00:00.000Z',
    },
  ],
  ...over,
});

const estado = (over: { informes?: InformeTemporal[]; pendientes?: InformePendiente[]; isPending?: boolean } = {}) => ({
  informes: [],
  pendientes: [],
  isPending: false,
  isError: false,
  error: null,
  ...over,
});

beforeEach(() => {
  proyeccion.mockReturnValue(
    estado({ informes: [informe({ id: 'i2', numero: 8 }), informe({ id: 'i1', numero: 7, actividad2: null })] }),
  );
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('HistorialReportes', () => {
  it('lista sus informes con número, fecha, turno, actividades y cantidad de equipos', () => {
    render(<HistorialReportes />);
    const lista = screen.getByRole('list', { name: 'Informes enviados' });
    const filas = within(lista).getAllByRole('button');
    expect(filas).toHaveLength(2);
    expect(filas[0]?.textContent).toContain('#8 · 20-11-2026 · Diurno');
    expect(filas[0]?.textContent).toContain('Carga de material · Riego de caminos');
    expect(filas[0]?.textContent).toContain('2 equipos');
    expect(filas[1]?.textContent).toContain('#7');
  });

  it('sin informes muestra el aviso vacío', () => {
    proyeccion.mockReturnValue(estado());
    render(<HistorialReportes />);
    expect(screen.getByText('Aún no has enviado reportes.')).toBeTruthy();
  });

  it('el detalle es solo de lectura: datos, personal, responsables y cada equipo con sus lecturas', () => {
    render(<HistorialReportes />);
    fireEvent.click(screen.getByRole('button', { name: 'Ver informe N° 8' }));
    const hoja = screen.getByRole('dialog', { name: 'Informe N° 8' });
    expect(within(hoja).getByText('Luis Vera')).toBeTruthy();
    expect(within(hoja).getByText('Marta Díaz')).toBeTruthy();
    expect(within(hoja).getByText('Ana Soto · Pedro Rojas')).toBeTruthy();
    expect(within(hoja).getByText('Sin novedades')).toBeTruthy();
    expect(within(hoja).getByText('EX-1')).toBeTruthy();
    expect(within(hoja).getByText(/AdBlue: 5/)).toBeTruthy();
    expect(within(hoja).getByAltText('Foto del surtidor de EX-1')).toBeTruthy();
    // Corregir y eliminar son de oficina.
    expect(within(hoja).queryByRole('button', { name: /Corregir/ })).toBeNull();
    expect(within(hoja).queryByRole('button', { name: /Eliminar/ })).toBeNull();

    fireEvent.click(within(hoja).getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('los informes que siguen en la cola van arriba con la marca «Sin sincronizar»', () => {
    proyeccion.mockReturnValue(
      estado({
        informes: [informe({ id: 'i1', numero: 7 })],
        pendientes: [
          {
            id: 'p1',
            fecha: '2026-11-25',
            turno: 'NOCTURNO',
            actividad1: 'Despeje',
            actividad2: null,
            equipos: 3,
            requiereAtencion: false,
          },
        ],
      }),
    );
    render(<HistorialReportes />);
    const pendiente = screen.getByTestId('mi-informe-pendiente-p1');
    expect(pendiente.textContent).toContain('25-11-2026 · Nocturno');
    expect(pendiente.textContent).toContain('3 equipos');
    expect(within(pendiente).getByText('Sin sincronizar')).toBeTruthy();
    // Va antes de la lista de enviados.
    const enviados = screen.getByRole('list', { name: 'Informes enviados' });
    expect(pendiente.compareDocumentPosition(enviados) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('solo con pendientes no muestra el aviso vacío', () => {
    proyeccion.mockReturnValue(
      estado({
        isPending: true,
        pendientes: [
          {
            id: 'p1',
            fecha: '2026-11-25',
            turno: 'DIURNO',
            actividad1: 'Despeje',
            actividad2: null,
            equipos: 1,
            requiereAtencion: true,
          },
        ],
      }),
    );
    render(<HistorialReportes />);
    expect(screen.queryByText('Aún no has enviado reportes.')).toBeNull();
    expect(screen.getByText('Requiere atención · ver Sincronización')).toBeTruthy();
  });

  it('con más de cinco muestra los cinco más recientes y «Ver historial completo» abre todos', () => {
    const informes = Array.from({ length: 6 }, (_, k) => informe({ id: `i${6 - k}`, numero: 6 - k }));
    const pendiente: InformePendiente = {
      id: 'p1',
      fecha: '2026-11-25',
      turno: 'DIURNO',
      actividad1: 'Despeje',
      actividad2: null,
      equipos: 1,
      requiereAtencion: false,
    };
    proyeccion.mockReturnValue(estado({ informes, pendientes: [pendiente] }));
    render(<HistorialReportes />);

    // El pendiente cuenta dentro de los cinco: quedan cuatro enviados, del más nuevo.
    expect(screen.getByTestId('mi-informe-pendiente-p1')).toBeTruthy();
    const enviados = screen.getByRole('list', { name: 'Informes enviados' });
    expect(
      within(enviados)
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label')),
    ).toEqual(['Ver informe N° 6', 'Ver informe N° 5', 'Ver informe N° 4', 'Ver informe N° 3']);

    fireEvent.click(screen.getByRole('button', { name: 'Ver historial completo (7)' }));
    const hoja = screen.getByRole('dialog', { name: 'Historial de reportes' });
    expect(within(hoja).getByTestId('mi-informe-pendiente-p1')).toBeTruthy();
    expect(within(within(hoja).getByRole('list', { name: 'Informes enviados' })).getAllByRole('button')).toHaveLength(
      6,
    );

    // Abrir uno desde el historial muestra su detalle; al cerrarlo vuelve al historial.
    fireEvent.click(within(hoja).getByRole('button', { name: 'Ver informe N° 1' }));
    expect(screen.queryByRole('dialog', { name: 'Historial de reportes' })).toBeNull();
    const detalle = screen.getByRole('dialog', { name: 'Informe N° 1' });
    fireEvent.click(within(detalle).getAllByRole('button', { name: 'Cerrar' })[0]!);
    expect(screen.getByRole('dialog', { name: 'Historial de reportes' })).toBeTruthy();
  });

  it('con cinco o menos no ofrece el historial completo', () => {
    render(<HistorialReportes />);
    expect(screen.queryByRole('button', { name: /Ver historial completo/ })).toBeNull();
  });
});
