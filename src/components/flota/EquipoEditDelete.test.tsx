import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { EditEquipoModal } from './EquipoEditDelete';
import type { Equipment } from '../../types/equipment';

/**
 * Tests focalizados de `EditEquipoModal` (Fix 1, review QA del RFC
 * R2-storage): un refetch en segundo plano de `['equipment']` — disparado por
 * `useEquipmentDocuments`/`useCombustible`/`useHorometro` al invalidar esa
 * key, `EquipoThumb.onError`, o la rotación de la URL firmada — no debe pisar
 * una foto recién subida ni texto que el usuario ya escribió mientras el
 * modal sigue abierto. Cancelar sin guardar y reabrir de verdad sí debe
 * seguir reseteando todo (comportamiento previo, cubierto también a nivel de
 * integración en `EquiposView.interactions.test.tsx`).
 *
 * Se mockean los hooks de datos (no la capa de API) para poder ejercer
 * `EditEquipoModal` de forma aislada, sin depender de `EquiposView`/
 * `EquipoDetalleView` — mismo criterio que `RegistrarCargaCombustibleModal.test.tsx`.
 */
const updateMutateAsyncMock = vi.fn();
const assignMutateAsyncMock = vi.fn();
vi.mock('../../hooks/useEquipment', () => ({
  useUpdateEquipment: () => ({ mutateAsync: updateMutateAsyncMock, isPending: false }),
  useAssignEquipment: () => ({ mutateAsync: assignMutateAsyncMock, isPending: false }),
  useDeleteEquipment: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('../../hooks/useBranches', () => ({
  useBranches: () => ({ data: [] }),
  useBranch: () => ({ data: undefined }),
}));

vi.mock('../../hooks/useUsers', () => ({
  useUsers: () => ({ data: [] }),
}));

const uploadFileMock = vi.fn();
vi.mock('../../api/UploadsAPI', () => ({
  uploadFile: (...args: unknown[]) => uploadFileMock(...args),
}));

afterEach(cleanup);

const EQUIPO: Equipment = {
  id: 'eq_1',
  internalCode: 'EX-001',
  licensePlate: 'AB-CD-12',
  equipmentClass: 'HEAVY',
  type: 'Excavadora',
  brand: 'Caterpillar',
  model: '336',
  year: 2019,
  controlUnit: 'HOURS',
  currentHourmeter: 1200,
  currentMileage: null,
  status: 'OPERATIONAL',
  homeBranchId: null,
  photoUrl: null,
  operator: null,
  supervisor: null,
  inUse: false,
  currentFuelLevel: null,
  openShift: null,
  documentsAlert: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const FILE = new File(['foto'], 'nueva.jpg', { type: 'image/jpeg' });

function renderModal(equipo: Equipment, isOpen = true) {
  const qc = new QueryClient();
  const onOpenChange = vi.fn();
  const utils = render(
    <QueryClientProvider client={qc}>
      <EditEquipoModal equipo={equipo} isOpen={isOpen} onOpenChange={onOpenChange} />
    </QueryClientProvider>,
  );
  return { onOpenChange, qc, ...utils };
}

function subirFoto() {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [FILE] } });
}

beforeEach(() => {
  uploadFileMock.mockReset();
  uploadFileMock.mockResolvedValue({ key: 'tmp/u1/nueva.jpg', url: 'https://minio.local/nueva.jpg' });
  updateMutateAsyncMock.mockReset().mockResolvedValue(EQUIPO);
  assignMutateAsyncMock.mockReset().mockResolvedValue(EQUIPO);
});

describe('EditEquipoModal — un refetch en segundo plano no pisa una subida pendiente ni texto sin guardar', () => {
  it('rerender con una NUEVA referencia del mismo equipo (isOpen sigue true) conserva la foto recién subida y el campo editado', async () => {
    const { rerender, qc } = renderModal(EQUIPO);

    subirFoto();
    await waitFor(() => expect(uploadFileMock).toHaveBeenCalledWith(FILE));
    await waitFor(() =>
      expect(screen.getByAltText('Foto del equipo').getAttribute('src')).toBe('https://minio.local/nueva.jpg'),
    );

    fireEvent.change(screen.getByLabelText('Modelo'), { target: { value: '336 Next Gen' } });
    expect((screen.getByLabelText('Modelo') as HTMLInputElement).value).toBe('336 Next Gen');

    // Simula el refetch: MISMO equipo (mismos valores), pero una referencia de
    // objeto nueva — exactamente lo que entrega TanStack Query tras
    // invalidar `['equipment']`. El modal sigue abierto (`isOpen` no cambia).
    const equipoRefetched: Equipment = { ...EQUIPO };
    rerender(
      <QueryClientProvider client={qc}>
        <EditEquipoModal equipo={equipoRefetched} isOpen onOpenChange={vi.fn()} />
      </QueryClientProvider>,
    );

    // Ni la foto pendiente ni el texto editado se perdieron.
    expect(screen.getByAltText('Foto del equipo').getAttribute('src')).toBe('https://minio.local/nueva.jpg');
    expect((screen.getByLabelText('Modelo') as HTMLInputElement).value).toBe('336 Next Gen');

    // Y viajan de verdad en el submit — confirma que `photoKey` no se limpió
    // por el refetch (antes: `setPhotoKey(undefined)` corría en cada cambio
    // de referencia de `equipo` mientras el modal seguía abierto).
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(updateMutateAsyncMock).toHaveBeenCalledTimes(1));
    const [{ input }] = updateMutateAsyncMock.mock.calls[0] as [{ input: Record<string, unknown> }];
    expect(input.photoKey).toBe('tmp/u1/nueva.jpg');
    expect(input.model).toBe('336 Next Gen');
  });
});

describe('EditEquipoModal — cerrar y reabrir de verdad sí resetea', () => {
  it('la transición isOpen true→false→true descarta la foto pendiente y el texto editado (no guardados)', async () => {
    const { rerender, qc } = renderModal(EQUIPO);

    subirFoto();
    await waitFor(() => expect(uploadFileMock).toHaveBeenCalledWith(FILE));
    await waitFor(() => expect(screen.getByAltText('Foto del equipo')).toBeTruthy());
    fireEvent.change(screen.getByLabelText('Modelo'), { target: { value: '336 Next Gen' } });

    // Cerrar — mismo efecto observable que "Cancelar" (`onOpenChange(false)`).
    rerender(
      <QueryClientProvider client={qc}>
        <EditEquipoModal equipo={EQUIPO} isOpen={false} onOpenChange={vi.fn()} />
      </QueryClientProvider>,
    );
    // Reabrir de verdad: transición false→true.
    rerender(
      <QueryClientProvider client={qc}>
        <EditEquipoModal equipo={EQUIPO} isOpen onOpenChange={vi.fn()} />
      </QueryClientProvider>,
    );

    expect((screen.getByLabelText('Modelo') as HTMLInputElement).value).toBe(EQUIPO.model);
    expect(screen.queryByAltText('Foto del equipo')).toBeNull();
  });
});
