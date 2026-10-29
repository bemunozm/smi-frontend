import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { OrdenTrabajo } from '../../types/mantenimiento';

const mutateMock = vi.fn();

vi.mock('../../hooks/useIntervenciones', () => ({
  useFinishTask: () => ({ mutate: mutateMock, isPending: false }),
  useIntervenciones: () => ({ data: [], isPending: false, isError: false }),
  useCrearIntervencion: () => ({ mutate: vi.fn(), isPending: false }),
}));

// Casa Matriz va PRIMERO a propósito: prueba que la regla elige la FAENA por
// nombre, no "la primera de la lista".
let branchesData = [
  { id: 'br-1', name: 'Casa Matriz', address: null, isActive: true },
  { id: 'br-2', name: 'Faena', address: null, isActive: true },
];

vi.mock('../../hooks/useBranches', () => ({
  useBranches: () => ({ data: branchesData, isPending: false }),
}));

vi.mock('../../hooks/useInventory', () => ({
  useItems: () => ({
    data: [
      {
        id: 'item-1',
        sku: 'AC-1540',
        name: 'Aceite motor 15W-40',
        description: null,
        unit: 'UNIT',
        type: 'SUPPLY',
        categoryId: null,
        category: null,
        partNumber: null,
        defaultSupplier: null,
        isCritical: false,
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        stocks: [],
      },
      {
        id: 'item-2',
        sku: 'FL-220',
        name: 'Filtro de aceite',
        description: null,
        unit: 'UNIT',
        type: 'PART',
        categoryId: null,
        category: null,
        partNumber: null,
        defaultSupplier: null,
        isCritical: false,
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        stocks: [
          {
            branchId: 'br-2',
            quantity: 4,
            minimumQuantity: 0,
            branch: { id: 'br-2', name: 'Faena' },
          },
        ],
      },
    ],
    isPending: false,
  }),
}));

import { FinishTaskModal } from './FinishTaskModal';

const ORDEN: OrdenTrabajo = {
  id: 'ot-1',
  equipoId: 'CM-007',
  hallazgoId: null,
  pautaMilestone: null,
  pautaCycle: null,
  titulo: 'Cambio de aceite motor y filtro',
  estado: 'EN_PROCESO',
  prioridad: 'MEDIA',
  tipo: 'PREVENTIVA',
  origen: 'MANUAL',
  origenDetalle: null,
  asignadoA: null,
  tareas: [],
  createdAt: '2026-10-05T08:30:00.000Z',
  updatedAt: '2026-10-05T08:30:00.000Z',
};

afterEach(() => {
  cleanup();
  mutateMock.mockReset();
  branchesData = [
    { id: 'br-1', name: 'Casa Matriz', address: null, isActive: true },
    { id: 'br-2', name: 'Faena', address: null, isActive: true },
  ];
});

// El equipo de la OT apunta a una bodega FANTASMA (inactiva o borrada): el
// default debe caer a la primera bodega activa, nunca quedar en un id que el
// Select no puede mostrar.
const EQUIPMENT = [
  {
    id: 'eq-9',
    internalCode: 'CM-007',
    brand: 'Volvo',
    model: 'FMX',
    homeBranchId: 'br-fantasma',
  },
];

function openModal() {
  render(<FinishTaskModal equipment={EQUIPMENT} orden={ORDEN} />);
  fireEvent.click(screen.getByRole('button', { name: /Finalizar tarea/ }));
}

function fillDetalle() {
  fireEvent.change(screen.getByPlaceholderText('Describe el trabajo realizado...'), {
    target: { value: 'Drenaje de aceite y cambio de filtro.' },
  });
}

function submitForm() {
  const form = document.querySelector(`form#finish-task-${ORDEN.id}`);
  if (!form) throw new Error('form no encontrado');
  fireEvent.submit(form);
}

/** La declaración obligatoria de cómo queda la unidad al cerrar. */
function elegirComoQueda(opcion: 'Operativo' | 'Inoperativo' = 'Operativo') {
  fireEvent.click(screen.getByRole('button', { name: opcion }));
}

describe('FinishTaskModal', () => {
  it('un horómetro no tocado NO se envía (no inventa una lectura 0 del medidor)', async () => {
    openModal();
    fillDetalle();
    elegirComoQueda();
    submitForm();

    await waitFor(() => expect(mutateMock).toHaveBeenCalledTimes(1));
    const { intervencion } = mutateMock.mock.calls[0][0] as {
      intervencion: { horometro?: number };
    };
    expect(intervencion.horometro).toBeUndefined();
  });

  it('al agregar un insumo aparece la Bodega — el descuento sale de una bodega concreta', async () => {
    openModal();
    expect(screen.queryByText('Bodega')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Agregar insumo/ }));
    await waitFor(() => expect(screen.getByText('Bodega')).toBeTruthy());
  });

  it('la bodega queda FIJA en la faena: se muestra, pero no hay opción de cambiarla', async () => {
    openModal();
    fireEvent.click(screen.getByRole('button', { name: /Agregar insumo/ }));
    await waitFor(() => expect(screen.getByText('Bodega')).toBeTruthy());
    // La faena visible como dato fijo…
    expect(screen.getByText('Faena')).toBeTruthy();
    // …y Casa Matriz ni siquiera existe como opción en el DOM (sin selector).
    expect(screen.queryByText('Casa Matriz')).toBeNull();
    expect(screen.queryByText('Elige la bodega')).toBeNull();
  });

  it('el payload del cierre lleva la bodega de faena aunque no sea la primera de la lista', async () => {
    openModal();
    fillDetalle();
    elegirComoQueda();
    submitForm();

    await waitFor(() => expect(mutateMock).toHaveBeenCalledTimes(1));
    const { intervencion } = mutateMock.mock.calls[0][0] as {
      intervencion: { branchId?: string };
    };
    expect(intervencion.branchId).toBe('br-2');
  });

  it('sin una bodega de faena activa, agrega insumo muestra el aviso y no se puede descontar', async () => {
    branchesData = [{ id: 'br-1', name: 'Casa Matriz', address: null, isActive: true }];
    openModal();
    fillDetalle();
    fireEvent.click(screen.getByRole('button', { name: /Agregar insumo/ }));

    await waitFor(() => expect(screen.getByText(/No hay una bodega de faena/)).toBeTruthy());
    submitForm();
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it('ofrece adjuntar la foto de lo realizado', () => {
    openModal();
    expect(screen.getByText(/Foto de lo realizado/)).toBeTruthy();
  });

  it('no pide horas hombre — el cierre es qué se hizo, foto e insumos', () => {
    openModal();
    expect(screen.queryByText(/Horas hombre/i)).toBeNull();
  });

  it('el insumo se busca ESCRIBIENDO: filtra por código/nombre y al elegir viaja su id', async () => {
    openModal();
    fillDetalle();
    fireEvent.click(screen.getByRole('button', { name: /Agregar insumo/ }));

    const buscador = await waitFor(
      () => screen.getByPlaceholderText('Busca por código o nombre…') as HTMLInputElement,
    );
    // Abrir la lista (patrón OperatorPicker.test) y recién ahí escribir.
    const trigger = screen.getAllByRole('button', { name: 'Abrir Insumo' })[0] as HTMLButtonElement;
    fireEvent.click(trigger);
    await waitFor(() => screen.getByRole('option', { name: /AC-1540/ }));

    fireEvent.change(buscador, { target: { value: 'filtro' } });

    // Solo el que calza queda en la lista.
    const opcion = await waitFor(() => screen.getByRole('option', { name: /FL-220/ }));
    expect(screen.queryByRole('option', { name: /AC-1540/ })).toBeNull();
    fireEvent.click(opcion);

    elegirComoQueda();
    submitForm();
    await waitFor(() => expect(mutateMock).toHaveBeenCalledTimes(1));
    const { intervencion } = mutateMock.mock.calls[0][0] as {
      intervencion: { insumos?: { insumoId: string }[] };
    };
    expect(intervencion.insumos?.[0]?.insumoId).toBe('item-2');
  });

  it('el desplegable separa Suministros de Repuestos (la distinción de Inventario)', async () => {
    openModal();
    fireEvent.click(screen.getByRole('button', { name: /Agregar insumo/ }));
    await waitFor(() => screen.getByPlaceholderText('Busca por código o nombre…'));
    const trigger = screen.getAllByRole('button', { name: 'Abrir Insumo' })[0] as HTMLButtonElement;
    fireEvent.click(trigger);

    // Cabeceras de grupo, con cada ítem bajo la suya.
    await waitFor(() => expect(screen.getByText('Suministros')).toBeTruthy());
    expect(screen.getByText('Repuestos')).toBeTruthy();
    expect(screen.getByRole('option', { name: /AC-1540/ })).toBeTruthy();
    expect(screen.getByRole('option', { name: /FL-220/ })).toBeTruthy();
  });

  it('cada opción muestra su stock en Faena, y sin stock queda apagada (formato Terreno)', async () => {
    openModal();
    fireEvent.click(screen.getByRole('button', { name: /Agregar insumo/ }));
    await waitFor(() => screen.getByPlaceholderText('Busca por código o nombre…'));
    const trigger = screen.getAllByRole('button', { name: 'Abrir Insumo' })[0] as HTMLButtonElement;
    fireEvent.click(trigger);

    // El filtro (4 u en Faena) se puede elegir y lo dice.
    const conStock = await waitFor(() => screen.getByRole('option', { name: /FL-220/ }));
    expect(conStock.textContent).toContain('4 u en Faena');
    // El aceite no tiene existencia en Faena: visible pero no elegible, con el motivo.
    const sinStock = screen.getByRole('option', { name: /AC-1540/ });
    expect(sinStock.textContent).toContain('Sin stock en Faena');
    expect(sinStock.getAttribute('aria-disabled')).toBe('true');
  });

  it('un insumo sin seleccionar bloquea el guardado CON mensaje visible (no en silencio)', async () => {
    openModal();
    fillDetalle();
    fireEvent.click(screen.getByRole('button', { name: /Agregar insumo/ }));
    submitForm();

    await waitFor(() => expect(screen.getByText('El insumo es obligatorio')).toBeTruthy());
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it('cómo queda el equipo parte SIN elección: guardar sin declararlo muestra error y no cierra', async () => {
    openModal();
    fillDetalle();
    // Ninguna de las dos opciones viene marcada.
    expect(screen.getByRole('button', { name: 'Operativo' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'Inoperativo' }).getAttribute('aria-pressed')).toBe('false');
    submitForm();

    await waitFor(() => expect(screen.getByText('Indica cómo queda el equipo.')).toBeTruthy());
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it('con Inoperativo elegido, el cierre viaja con OUT_OF_SERVICE (sacar piezas deja la unidad abajo)', async () => {
    openModal();
    fillDetalle();
    elegirComoQueda('Inoperativo');
    submitForm();

    await waitFor(() => expect(mutateMock).toHaveBeenCalledTimes(1));
    const call = mutateMock.mock.calls[0][0] as { equipmentStatus?: string };
    expect(call.equipmentStatus).toBe('OUT_OF_SERVICE');
  });

  it('con Operativo elegido, el cierre viaja con OPERATIONAL', async () => {
    openModal();
    fillDetalle();
    elegirComoQueda('Operativo');
    submitForm();

    await waitFor(() => expect(mutateMock).toHaveBeenCalledTimes(1));
    const call = mutateMock.mock.calls[0][0] as { equipmentStatus?: string };
    expect(call.equipmentStatus).toBe('OPERATIONAL');
  });

  it('aunque el equipo de la OT no resuelva en Flota, la declaración aparece, se exige y viaja', async () => {
    // `equipoId` es texto libre y la lista de Flota puede no haber cargado:
    // quien resuelve la unidad es el BACKEND (por id o código interno). La
    // declaración no puede desaparecer en silencio del formulario.
    render(<FinishTaskModal equipment={[]} orden={ORDEN} />);
    fireEvent.click(screen.getByRole('button', { name: /Finalizar tarea/ }));
    fillDetalle();

    expect(screen.getByText('¿Cómo queda el equipo?')).toBeTruthy();
    elegirComoQueda('Inoperativo');
    submitForm();

    await waitFor(() => expect(mutateMock).toHaveBeenCalledTimes(1));
    const call = mutateMock.mock.calls[0][0] as { equipmentStatus?: string };
    expect(call.equipmentStatus).toBe('OUT_OF_SERVICE');
  });
});
