import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, within } from '@testing-library/react';

import type { InformePendiente } from '../../hooks/useMisInformesProjection';
import type { InformeTemporal } from '../../types/informe-temporal';

const { proyeccion } = vi.hoisted(() => ({ proyeccion: vi.fn() }));
vi.mock('../../hooks/useMisInformesProjection', () => ({ useMisInformesProjection: () => proyeccion() }));

import { HistorialReportes } from './HistorialReportes';

const informe = (over: Partial<InformeTemporal> & Pick<InformeTemporal, 'id' | 'numero'>): InformeTemporal => ({
  antiguo: false,
  equiposRegistrados: [],
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

/** Abre la hoja del historial desde su botón. */
function abrirHistorial() {
  fireEvent.click(screen.getByRole('button', { name: /Ver historial de reportes/ }));
  return screen.getByRole('dialog', { name: 'Historial de reportes' });
}

const PENDIENTE: InformePendiente = {
  id: 'p1',
  fecha: '2026-11-25',
  turno: 'NOCTURNO',
  actividad1: 'Despeje',
  actividad2: null,
  equipos: 3,
  numero: null,
  requiereAtencion: false,
};

describe('HistorialReportes', () => {
  it('es solo un botón con la cantidad: el historial no se muestra en línea', () => {
    render(<HistorialReportes />);
    expect(screen.getByRole('button', { name: 'Ver historial de reportes (2)' })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.queryByRole('button', { name: /Ver informe/ })).toBeNull();
  });

  it('el botón abre la hoja con sus informes: número, fecha, turno, actividades y cantidad de equipos', () => {
    render(<HistorialReportes />);
    const hoja = abrirHistorial();
    const lista = within(hoja).getByRole('list', { name: 'Informes enviados' });
    const filas = within(lista).getAllByRole('button');
    expect(filas).toHaveLength(2);
    expect(filas[0]?.textContent).toContain('#8 · 20-11-2026 · Diurno');
    expect(filas[0]?.textContent).toContain('Carga de material · Riego de caminos');
    expect(filas[0]?.textContent).toContain('2 equipos');
    expect(filas[1]?.textContent).toContain('#7');

    fireEvent.click(within(hoja).getAllByRole('button', { name: 'Cerrar' })[0]!);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('muestra todos los informes, sin tope', () => {
    const informes = Array.from({ length: 12 }, (_, k) => informe({ id: `i${12 - k}`, numero: 12 - k }));
    proyeccion.mockReturnValue(estado({ informes, pendientes: [PENDIENTE] }));
    render(<HistorialReportes />);
    expect(screen.getByRole('button', { name: 'Ver historial de reportes (13)' })).toBeTruthy();
    const hoja = abrirHistorial();
    expect(within(hoja).getByTestId('mi-informe-pendiente-p1')).toBeTruthy();
    const enviados = within(hoja).getByRole('list', { name: 'Informes enviados' });
    const etiquetas = within(enviados)
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label'));
    expect(etiquetas).toHaveLength(12);
    expect(etiquetas[0]).toBe('Ver informe N° 12');
  });

  it('sin informes la hoja muestra el aviso vacío', () => {
    proyeccion.mockReturnValue(estado());
    render(<HistorialReportes />);
    expect(screen.getByRole('button', { name: 'Ver historial de reportes' })).toBeTruthy();
    expect(screen.queryByText('Aún no has enviado reportes.')).toBeNull();
    const hoja = abrirHistorial();
    expect(within(hoja).getByText('Aún no has enviado reportes.')).toBeTruthy();
  });

  it('mientras carga lo dice en la hoja', () => {
    proyeccion.mockReturnValue(estado({ isPending: true }));
    render(<HistorialReportes />);
    const hoja = abrirHistorial();
    expect(within(hoja).getByText('Cargando tus reportes…')).toBeTruthy();
    expect(within(hoja).queryByText('Aún no has enviado reportes.')).toBeNull();
  });

  it('un error se muestra aunque haya pendientes, y los pendientes siguen a la vista', () => {
    proyeccion.mockReturnValue({
      ...estado({ pendientes: [PENDIENTE] }),
      isError: true,
      error: new Error('Sin conexión con el servidor.'),
    });
    render(<HistorialReportes />);
    const hoja = abrirHistorial();
    expect(within(hoja).getByRole('alert').textContent).toBe('Sin conexión con el servidor.');
    expect(within(hoja).getByTestId('mi-informe-pendiente-p1')).toBeTruthy();
    expect(within(hoja).queryByText('Aún no has enviado reportes.')).toBeNull();
  });

  it('el detalle es solo de lectura y al cerrarlo vuelve a la hoja del historial', () => {
    render(<HistorialReportes />);
    fireEvent.click(within(abrirHistorial()).getByRole('button', { name: 'Ver informe N° 8' }));
    // Sin hojas apiladas: el historial se oculta mientras el detalle está abierto.
    expect(screen.queryByRole('dialog', { name: 'Historial de reportes' })).toBeNull();
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

    fireEvent.click(within(hoja).getAllByRole('button', { name: 'Cerrar' })[0]!);
    expect(screen.queryByRole('dialog', { name: 'Informe N° 8' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Historial de reportes' })).toBeTruthy();
  });

  it('los informes que siguen en la cola van arriba con la marca «Sin sincronizar»', () => {
    proyeccion.mockReturnValue(estado({ informes: [informe({ id: 'i1', numero: 7 })], pendientes: [PENDIENTE] }));
    render(<HistorialReportes />);
    const hoja = abrirHistorial();
    const pendiente = within(hoja).getByTestId('mi-informe-pendiente-p1');
    expect(pendiente.textContent).toContain('25-11-2026 · Nocturno');
    expect(pendiente.textContent).toContain('3 equipos');
    expect(within(pendiente).getByText('Sin sincronizar')).toBeTruthy();
    // Va antes de la lista de enviados.
    const enviados = within(hoja).getByRole('list', { name: 'Informes enviados' });
    expect(pendiente.compareDocumentPosition(enviados) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('solo con pendientes no muestra el aviso vacío', () => {
    proyeccion.mockReturnValue(
      estado({ isPending: true, pendientes: [{ ...PENDIENTE, turno: 'DIURNO', equipos: 1, requiereAtencion: true }] }),
    );
    render(<HistorialReportes />);
    const hoja = abrirHistorial();
    expect(within(hoja).queryByText('Aún no has enviado reportes.')).toBeNull();
    expect(within(hoja).getByText('Requiere atención · ver Sincronización')).toBeTruthy();
  });
});
