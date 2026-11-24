import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

import type { Equipment } from '../../types/equipment';
import type { CompatibilityEntry } from '../../types/inventory';
import type { InventoryItem } from '../../types/inventory';
import { EditEquipmentsModal, EquipmentPicker, ItemEquipmentsCell } from './ItemEquipments';

const saveMock = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false }));
vi.mock('../../hooks/useInventory', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../hooks/useInventory')>()),
  useSaveItemEquipments: () => saveMock,
}));

afterEach(() => {
  cleanup();
  saveMock.mutate.mockClear();
});

const equipo = (id: string, internalCode: string, licensePlate: string | null = null, equipmentClass: 'HEAVY' | 'LIGHT' = 'HEAVY') =>
  ({ id, internalCode, licensePlate, equipmentClass, type: 'Excavadora', brand: 'CAT', model: '320' }) as unknown as Equipment;

const EQUIPOS = [equipo('e1', 'EXC-01'), equipo('e2', 'CAM-02', 'AB1234', 'LIGHT'), equipo('e3', 'CAR-03')];

/** El picker es controlado: este envoltorio guarda el set y lo expone a la prueba. */
function Wrapper({ inicial = [], onValue }: { inicial?: CompatibilityEntry[]; onValue?: (v: CompatibilityEntry[]) => void }) {
  const [value, setValue] = useState<CompatibilityEntry[]>(inicial);
  return (
    <EquipmentPicker
      onChange={(next) => {
        setValue(next);
        onValue?.(next);
      }}
      value={value}
    />
  );
}

function renderPicker(props: Parameters<typeof Wrapper>[0] = {}) {
  const qc = new QueryClient();
  qc.setQueryData(['equipment'], EQUIPOS);
  return render(
    <QueryClientProvider client={qc}>
      <Wrapper {...props} />
    </QueryClientProvider>,
  );
}

describe('ItemEquipmentsCell', () => {
  const eq = (internalCode: string, note: string | null = null) => ({ equipmentId: internalCode, internalCode, note });

  it('ninguno: «—»', () => {
    render(<ItemEquipmentsCell equipments={[]} />);
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('uno: su código', () => {
    render(<ItemEquipmentsCell equipments={[eq('EXC-01')]} />);
    expect(screen.getByText('EXC-01')).toBeTruthy();
  });

  it('varios: «Varios · N» se toca y muestra cada equipo (con su nota) enlazado a su ficha', async () => {
    render(
      <MemoryRouter>
        <ItemEquipmentsCell equipments={[eq('EXC-01', 'serie 4500'), eq('CAM-02'), eq('CAR-03')]} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Ver los 3 equipos/ }));

    const dialogo = await screen.findByRole('dialog', { name: 'Equipos asignados' });
    expect(dialogo.querySelector('a[href="/equipos/EXC-01"]')?.textContent).toBe('EXC-01');
    expect(dialogo.textContent).toContain('serie 4500');
    expect(dialogo.textContent).toContain('CAM-02');
    expect(dialogo.textContent).toContain('CAR-03');
  });

  it('inline (tarjeta del celular): todos los códigos a la vista, sin botón', () => {
    render(<ItemEquipmentsCell equipments={[eq('EXC-01'), eq('CAM-02')]} inline />);
    expect(screen.getByText('EXC-01')).toBeTruthy();
    expect(screen.getByText('CAM-02')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('EquipmentPicker', () => {
  it('sin escribir muestra todos los equipos: pesados primero, después livianos, cada grupo separado', () => {
    renderPicker();
    const grupos = within(screen.getByRole('group', { name: 'Equipos disponibles' })).getAllByRole('region');
    expect(grupos.map((g) => g.getAttribute('aria-label'))).toEqual(['Equipos pesados', 'Equipos livianos']);
    expect(within(grupos[0]!).getAllByRole('button').map((b) => b.textContent)).toEqual([
      expect.stringContaining('CAR-03'),
      expect.stringContaining('EXC-01'),
    ]);
    expect(within(grupos[1]!).getByRole('button').textContent).toContain('CAM-02');
  });

  it('escribir filtra dentro de los grupos y deja solo los que tienen coincidencias', () => {
    renderPicker();
    fireEvent.change(screen.getByLabelText('Agregar equipo'), { target: { value: 'ab12' } });
    const grupos = within(screen.getByRole('group', { name: 'Equipos disponibles' })).getAllByRole('region');
    expect(grupos.map((g) => g.getAttribute('aria-label'))).toEqual(['Equipos livianos']);
  });

  it('busca por código o patente y agrega el equipo elegido', () => {
    const onValue = vi.fn();
    renderPicker({ onValue });

    fireEvent.change(screen.getByLabelText('Agregar equipo'), { target: { value: 'ab12' } });
    fireEvent.click(screen.getByRole('button', { name: /CAM-02/ }));

    expect(onValue).toHaveBeenLastCalledWith([{ equipmentId: 'e2' }]);
    expect(screen.getByRole('button', { name: 'Quitar CAM-02' })).toBeTruthy();
  });

  it('no ofrece de nuevo un equipo ya elegido y avisa si nada coincide', () => {
    renderPicker({ inicial: [{ equipmentId: 'e1' }] });

    fireEvent.change(screen.getByLabelText('Agregar equipo'), { target: { value: 'EXC-01' } });
    expect(screen.getByText(/Ningún equipo coincide/)).toBeTruthy();
  });

  it('guarda la nota de cada equipo y permite quitarlo', () => {
    const onValue = vi.fn();
    renderPicker({ inicial: [{ equipmentId: 'e1' }, { equipmentId: 'e3' }], onValue });

    fireEvent.change(screen.getByLabelText('Nota para EXC-01'), { target: { value: 'solo serie 4500' } });
    expect(onValue).toHaveBeenLastCalledWith([{ equipmentId: 'e1', note: 'solo serie 4500' }, { equipmentId: 'e3' }]);

    fireEvent.click(screen.getByRole('button', { name: 'Quitar EXC-01' }));
    expect(onValue).toHaveBeenLastCalledWith([{ equipmentId: 'e3' }]);
    expect(screen.queryByRole('button', { name: 'Quitar EXC-01' })).toBeNull();
  });

  it('Enter en el buscador agrega la primera coincidencia sin enviar el formulario', () => {
    const onValue = vi.fn();
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
    const qc = new QueryClient();
    qc.setQueryData(['equipment'], EQUIPOS);
    render(
      <QueryClientProvider client={qc}>
        <form onSubmit={onSubmit}>
          <Wrapper onValue={onValue} />
        </form>
      </QueryClientProvider>,
    );

    const campo = screen.getByLabelText('Agregar equipo');
    fireEvent.change(campo, { target: { value: 'CAR-03' } });
    fireEvent.keyDown(campo, { key: 'Enter' });

    expect(onValue).toHaveBeenLastCalledWith([{ equipmentId: 'e3' }]);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('EditEquipmentsModal', () => {
  const ITEM = { id: 'i1', sku: 'SUM-0010', name: 'Aceite 80-90', compatibilities: [{ equipmentId: 'e1', internalCode: 'EXC-01', note: 'usa este aceite' }] } as unknown as InventoryItem;

  function renderModal(onOpenChange = vi.fn()) {
    const qc = new QueryClient();
    qc.setQueryData(['equipment'], EQUIPOS);
    render(
      <QueryClientProvider client={qc}>
        <EditEquipmentsModal isOpen item={ITEM} onOpenChange={onOpenChange} />
      </QueryClientProvider>,
    );
    return onOpenChange;
  }

  it('sin cambios, Guardar está deshabilitado y Cancelar cierra sin preguntar', () => {
    const onOpenChange = renderModal();
    expect(screen.getByRole('button', { name: 'Guardar' }).hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('quitar con la X avisa que hay cambios sin guardar; cerrar pide confirmar y no descarta solo', () => {
    const onOpenChange = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Quitar EXC-01' }));
    expect(screen.getByRole('status').textContent).toContain('cambios sin guardar');

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog', { name: 'Cambios sin guardar' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Seguir editando' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(onOpenChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Descartar cambios' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(saveMock.mutate).not.toHaveBeenCalled();
  });

  it('Guardar envía la lista sin el equipo quitado', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Quitar EXC-01' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(saveMock.mutate).toHaveBeenCalledWith({ item: ITEM, entries: [] }, expect.anything());
  });
});
