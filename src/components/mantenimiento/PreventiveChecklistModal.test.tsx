import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { OrdenTrabajo, Tarea } from '../../types/mantenimiento';
import { PreventiveChecklistModal, tareasHechas } from './PreventiveChecklistModal';
import type { EquipmentRef } from './workshop';

const { mutateMock } = vi.hoisted(() => ({ mutateMock: vi.fn() }));
vi.mock('../../hooks/useOrdenes', () => ({
  useCompletarTarea: () => ({ mutate: mutateMock, isPending: false }),
}));

// Insumos de Faena (`useInsumosFaena`): se mockean las lecturas de abajo,
// igual que en `FinishTaskModal.test.tsx`.
vi.mock('../../hooks/useBranches', () => ({
  useBranches: () => ({
    data: [
      { id: 'br-1', name: 'Casa Matriz' },
      { id: 'br-2', name: 'Faena' },
    ],
  }),
}));
vi.mock('../../hooks/useInventory', () => ({
  useItems: () => ({
    data: [
      {
        id: 'item-aceite',
        sku: 'ACE-002',
        name: 'Aceite hidráulico ISO 68',
        type: 'SUPPLY',
        unit: 'LITER',
        stocks: [{ branchId: 'br-2', quantity: 27, minimumQuantity: 5, branch: { id: 'br-2', name: 'Faena' } }],
      },
    ],
  }),
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
  return {
    hecha: false,
    posicion: 0,
    notas: null,
    fotoUrl: null,
    hechaPorNombre: null,
    hechaAt: null,
    ...over,
  };
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
      notas: 'se cambio el aceite',
      fotoUrl: 'https://signed/aceite.jpg',
      hechaPorNombre: 'Mantenedor SMI',
      hechaAt: '2026-10-10T15:30:00.000Z',
    }),
    tarea({ id: 'ta-2', texto: 'Cambio de filtro', posicion: 1 }),
  ],
  createdAt: '2026-10-10T12:00:00.000Z',
  updatedAt: '2026-10-10T12:00:00.000Z',
};

const FLEET: EquipmentRef[] = [
  {
    id: 'eq-1',
    internalCode: 'EX-014',
    brand: 'CAT',
    model: '320',
    controlUnit: 'HOURS',
    currentHourmeter: 251.5,
    currentMileage: null,
  },
];

function abrir(
  orden: OrdenTrabajo = ORDEN,
  soloLectura = false,
  equipment: EquipmentRef[] = FLEET,
) {
  render(
    <PreventiveChecklistModal equipment={equipment} orden={orden} soloLectura={soloLectura} />,
  );
  fireEvent.click(screen.getByRole('button', { name: soloLectura ? /Ver mantención/ : /Registrar mantención/ }));
}

describe('tareasHechas', () => {
  it('cuenta el avance del checklist', () => {
    expect(tareasHechas(ORDEN)).toEqual({ hechas: 1, total: 2 });
  });
});

describe('PreventiveChecklistModal', () => {
  it('«Ver detalle» abre un pop-up con fecha, quién, qué se hizo y la foto', () => {
    abrir();

    // En la fila solo queda el nombre de la tarea: la evidencia vive en el pop-up.
    expect(screen.queryByText('se cambio el aceite')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle' }));

    // El pop-up (ModalTerreno anidado) con la evidencia completa.
    expect(screen.getByText('Realizada')).toBeTruthy();
    expect(screen.getByText('Mantenedor SMI')).toBeTruthy();
    expect(screen.getByText('se cambio el aceite')).toBeTruthy();
    const foto = screen.getByRole('img', { name: 'Foto de respaldo de Cambio de aceite' });
    expect(foto.getAttribute('src')).toBe('https://signed/aceite.jpg');
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

  it('con descripción y foto guarda la tarea por separado (sin insumos, sin bodega)', () => {
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
      // Última tarea pendiente de una OT de pauta: la lectura prellenada viaja.
      lecturaMantencion: 251.5,
    });
  });

  it('los insumos usados van con la bodega de Faena FIJA y avisan del descuento de stock', () => {
    mockFile = new File(['x'], 'filtro.jpg', { type: 'image/jpeg' });
    abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Completar' }));
    fireEvent.click(screen.getByRole('button', { name: /Agregar insumo/ }));

    // Bodega fija del taller — sin opción de cambiarla.
    expect(screen.getByText('Faena')).toBeTruthy();
    expect(screen.getByText('Fija del taller')).toBeTruthy();
    expect(screen.queryByText('Casa Matriz')).toBeNull();
    expect(screen.getByText(/descuentan automáticamente/)).toBeTruthy();

    // Con la fila incompleta (sin insumo elegido) no se puede guardar.
    fireEvent.change(screen.getByPlaceholderText(/Se cambió el aceite/), {
      target: { value: 'Filtro nuevo instalado' },
    });
    expect(screen.getByRole('button', { name: /Guardar tarea/ }).hasAttribute('disabled')).toBe(
      true,
    );
  });

  describe('lectura de la mantención (última tarea de una OT de pauta)', () => {
    const LECTURA = /Horómetro al momento de la mantención \(h\)/;

    function completarConNotas() {
      fireEvent.change(screen.getByPlaceholderText(/Se cambió el aceite/), {
        target: { value: 'Filtro nuevo instalado' },
      });
    }

    it('se prellena con el horómetro actual y acepta coma decimal', () => {
      mockFile = new File(['x'], 'filtro.jpg', { type: 'image/jpeg' });
      abrir();
      fireEvent.click(screen.getByRole('button', { name: 'Completar' }));

      const campo = screen.getByLabelText(LECTURA) as HTMLInputElement;
      expect(campo.value).toBe('251,5');
      fireEvent.change(campo, { target: { value: '250,5' } });
      completarConNotas();
      fireEvent.click(screen.getByRole('button', { name: /Guardar tarea/ }));

      expect(mutateMock.mock.calls[0]![0]).toMatchObject({
        tareaId: 'ta-2',
        lecturaMantencion: 250.5,
      });
    });

    it('es obligatoria: sin lectura conocida queda vacía y no deja guardar', () => {
      mockFile = new File(['x'], 'filtro.jpg', { type: 'image/jpeg' });
      abrir(ORDEN, false, [{ ...FLEET[0]!, currentHourmeter: null }]);
      fireEvent.click(screen.getByRole('button', { name: 'Completar' }));

      const campo = screen.getByLabelText(LECTURA) as HTMLInputElement;
      expect(campo.value).toBe('');
      completarConNotas();
      expect(screen.getByRole('button', { name: /Guardar tarea/ }).hasAttribute('disabled')).toBe(
        true,
      );

      fireEvent.change(campo, { target: { value: '252' } });
      expect(screen.getByRole('button', { name: /Guardar tarea/ }).hasAttribute('disabled')).toBe(
        false,
      );
    });

    it('un liviano por km la pide en kilómetros', () => {
      abrir(ORDEN, false, [
        { ...FLEET[0]!, controlUnit: 'KM', currentHourmeter: null, currentMileage: 84306 },
      ]);
      fireEvent.click(screen.getByRole('button', { name: 'Completar' }));

      const campo = screen.getByLabelText(
        /Kilometraje al momento de la mantención \(km\)/,
      ) as HTMLInputElement;
      expect(campo.value).toBe('84306');
    });

    it('una tarea que NO es la última no la pide ni la envía', () => {
      mockFile = new File(['x'], 'filtro.jpg', { type: 'image/jpeg' });
      const dosPendientes = { ...ORDEN, tareas: ORDEN.tareas.map((t) => ({ ...t, hecha: false })) };
      abrir(dosPendientes);
      fireEvent.click(screen.getAllByRole('button', { name: 'Completar' })[0]!);

      expect(screen.queryByLabelText(LECTURA)).toBeNull();
      completarConNotas();
      fireEvent.click(screen.getByRole('button', { name: /Guardar tarea/ }));
      expect(mutateMock.mock.calls[0]![0]).not.toHaveProperty('lecturaMantencion');
    });

    it('una orden sin pauta (sin vuelta) no la pide', () => {
      abrir({ ...ORDEN, pautaCycle: null, pautaMilestone: null });
      fireEvent.click(screen.getByRole('button', { name: 'Completar' }));
      expect(screen.queryByLabelText(LECTURA)).toBeNull();
    });
  });

  it('en solo lectura no se puede completar nada', () => {
    abrir({ ...ORDEN, estado: 'COMPLETADA' }, true);

    expect(screen.queryByRole('button', { name: 'Completar' })).toBeNull();
    expect(screen.getByText('Pendiente')).toBeTruthy();
  });
});
