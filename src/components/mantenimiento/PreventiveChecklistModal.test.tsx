import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { OrdenTrabajo, Tarea } from '../../types/mantenimiento';
import { PreventiveChecklistModal, tareasHechas } from './PreventiveChecklistModal';

const { mutateMock } = vi.hoisted(() => ({ mutateMock: vi.fn() }));
vi.mock('../../hooks/useOrdenes', () => ({
  useCompletarTarea: () => ({ mutate: mutateMock, isPending: false }),
}));

// La captura real lee EXIF del archivo; acá se controla qué foto "hay".
let mockFile: File | null = null;
vi.mock('../../lib/usePhotoCaptureFlow', () => ({
  usePhotoCaptureFlow: () => ({
    file: mockFile,
    captureDate: null,
    isReadingPhoto: false,
    handleSelectPhoto: vi.fn(),
    handleClearPhoto: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mockFile = null;
});

function tarea(over: Partial<Tarea> & Pick<Tarea, 'id' | 'texto'>): Tarea {
  return { hecha: false, posicion: 0, notas: null, fotoUrl: null, ...over };
}

const ORDEN: OrdenTrabajo = {
  id: 'ot-prev',
  equipoId: 'EX-014',
  hallazgoId: null,
  titulo: 'Mantención preventiva 250 h · EX-014',
  estado: 'PENDIENTE',
  prioridad: 'MEDIA',
  tipo: 'PREVENTIVA',
  origen: 'PREVENTIVO',
  origenDetalle: 'Pauta: 250 h · ciclo 1',
  pautaMilestone: 250,
  pautaCycle: 1,
  asignadoA: null,
  tareas: [
    tarea({
      id: 'ta-1',
      texto: 'Cambio de aceite',
      hecha: true,
      notas: 'Aceite 15W-40 nuevo',
      fotoUrl: 'https://signed/aceite.jpg',
    }),
    tarea({ id: 'ta-2', texto: 'Cambio de filtro', posicion: 1 }),
  ],
  createdAt: '2026-10-10T12:00:00.000Z',
  updatedAt: '2026-10-10T12:00:00.000Z',
};

const FLEET = [
  { id: 'eq-1', internalCode: 'EX-014', brand: 'CAT', model: '320' },
];

function abrir(orden: OrdenTrabajo = ORDEN, soloLectura = false) {
  render(
    <PreventiveChecklistModal equipment={FLEET} orden={orden} soloLectura={soloLectura} />,
  );
  fireEvent.click(screen.getByRole('button', { name: soloLectura ? /Ver mantención/ : /Registrar mantención/ }));
}

describe('tareasHechas', () => {
  it('cuenta el avance del checklist', () => {
    expect(tareasHechas(ORDEN)).toEqual({ hechas: 1, total: 2 });
  });
});

describe('PreventiveChecklistModal', () => {
  it('muestra el hito, el avance y cada tarea con su evidencia', () => {
    abrir();

    expect(screen.getByText('Mantención de 250')).toBeTruthy();
    expect(screen.getByText('1 de 2 tareas')).toBeTruthy();
    // La hecha es de solo lectura, con sus notas y su foto.
    expect(screen.getByText('Aceite 15W-40 nuevo')).toBeTruthy();
    const foto = screen.getByRole('link', { name: 'Ver foto de respaldo' });
    expect(foto.getAttribute('href')).toBe('https://signed/aceite.jpg');
    // La pendiente ofrece completarla.
    expect(screen.getByRole('button', { name: 'Completar' })).toBeTruthy();
  });

  it('exige descripción Y foto antes de poder guardar la tarea', () => {
    abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Completar' }));

    const guardar = screen.getByRole('button', { name: /Guardar tarea/ });
    expect(guardar.hasAttribute('disabled')).toBe(true);

    fireEvent.change(screen.getByPlaceholderText(/Se cambió el aceite/), {
      target: { value: 'Filtro nuevo instalado' },
    });
    // Notas sin foto: sigue bloqueado — el checklist deja evidencia.
    expect(guardar.hasAttribute('disabled')).toBe(true);
  });

  it('con descripción y foto guarda la tarea por separado', () => {
    mockFile = new File(['x'], 'filtro.jpg', { type: 'image/jpeg' });
    abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Completar' }));

    fireEvent.change(screen.getByPlaceholderText(/Se cambió el aceite/), {
      target: { value: 'Filtro nuevo instalado' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Guardar tarea/ }));

    expect(mutateMock).toHaveBeenCalledTimes(1);
    expect(mutateMock.mock.calls[0]![0]).toEqual({
      ordenId: 'ot-prev',
      tareaId: 'ta-2',
      notas: 'Filtro nuevo instalado',
      foto: mockFile,
    });
  });

  it('en solo lectura no se puede completar nada', () => {
    abrir({ ...ORDEN, estado: 'COMPLETADA' }, true);

    expect(screen.queryByRole('button', { name: 'Completar' })).toBeNull();
    expect(screen.getByText('Pendiente')).toBeTruthy();
  });
});
