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
        stocks: [],
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

describe('FinishTaskModal', () => {
  it('un horómetro no tocado NO se envía (no inventa una lectura 0 del medidor)', async () => {
    openModal();
    fillDetalle();
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

  it('el insumo se busca ESCRIBIENDO: filtra por código/nombre y al elegir viaja su id', async () => {
    openModal();
    fillDetalle();
    fireEvent.click(screen.getByRole('button', { name: /Agregar insumo/ }));

    const buscador = await waitFor(
      () => screen.getByPlaceholderText('Busca por código o nombre…') as HTMLInputElement,
    );
    // Abrir la lista (patrón OperatorPicker.test) y recién ahí escribir.
    const trigger = document.querySelector('.combo-box__trigger') as HTMLButtonElement;
    fireEvent.click(trigger);
    await waitFor(() => screen.getByRole('option', { name: /AC-1540/ }));

    fireEvent.change(buscador, { target: { value: 'filtro' } });

    // Solo el que calza queda en la lista.
    const opcion = await waitFor(() => screen.getByRole('option', { name: /FL-220/ }));
    expect(screen.queryByRole('option', { name: /AC-1540/ })).toBeNull();
    fireEvent.click(opcion);

    submitForm();
    await waitFor(() => expect(mutateMock).toHaveBeenCalledTimes(1));
    const { intervencion } = mutateMock.mock.calls[0][0] as {
      intervencion: { insumos?: { insumoId: string }[] };
    };
    expect(intervencion.insumos?.[0]?.insumoId).toBe('item-2');
  });

  it('un insumo sin seleccionar bloquea el guardado CON mensaje visible (no en silencio)', async () => {
    openModal();
    fillDetalle();
    fireEvent.click(screen.getByRole('button', { name: /Agregar insumo/ }));
    submitForm();

    await waitFor(() => expect(screen.getByText('El insumo es obligatorio')).toBeTruthy());
    expect(mutateMock).not.toHaveBeenCalled();
  });
});
