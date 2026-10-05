import 'fake-indexeddb/auto';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { uploadFileMock, toastSuccessMock, toastDangerMock, fuelReadingOcrMock } = vi.hoisted(() => ({
  uploadFileMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastDangerMock: vi.fn(),
  fuelReadingOcrMock: vi.fn(),
}));

vi.mock('../api/UploadsAPI', () => ({ uploadFile: uploadFileMock }));
vi.mock('../api/OcrAPI', () => ({ fuelReadingOcr: fuelReadingOcrMock }));
vi.mock('../lib/photo-reading', () => ({ readCaptureDate: vi.fn().mockResolvedValue(null) }));
vi.mock('@heroui/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@heroui/react')>();
  return { ...actual, toast: { danger: toastDangerMock, success: toastSuccessMock } };
});
vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { id: 'u1' }, role: null, isOfflineSnapshot: false }),
}));

import { db } from '../offline/db';
import { HallazgosView } from './HallazgosView';
import { updateHallazgo } from '../api/HallazgosAPI';

/** La corrección y el historial de cambios van al servidor; acá se simulan. */
vi.mock('../api/HallazgosAPI', async (original) => ({
  ...(await original<typeof import('../api/HallazgosAPI')>()),
  updateHallazgo: vi.fn(async ({ id }: { id: string }) => ({ id })),
  listCambiosHallazgo: vi.fn(async () => [
    {
      id: 'c1',
      userName: 'José Pérez',
      createdAt: '2026-10-01T22:10:00.000Z',
      changes: [{ field: 'prioridad', label: 'Prioridad', before: 'Media', after: 'Alta' }],
    },
  ]),
}));

/** jsdom no cambia de tamaño; el ancho se simula igual que en Inventario. */
function setViewport(size: 'phone' | 'desktop'): void {
  window.matchMedia = ((query: string) => ({
    matches: size === 'desktop' && query.includes('1024px'),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

function renderView(size: 'phone' | 'desktop' = 'phone') {
  setViewport(size);
  const qc = new QueryClient();
  qc.setQueryData(
    ['equipment'],
    [{ id: 'e1', internalCode: 'PE-004', type: 'Perforadora' }],
  );
  qc.setQueryData(
    ['hallazgos'],
    [{ id: 'h1', equipoId: 'e1', descripcion: 'Fuga de aceite hidráulico', prioridad: 'ALTA', estado: 'ABIERTO', fotoUrl: null, fecha: '2026-08-01T08:12:00.000Z', equipo: { internalCode: 'PE-004' } }],
  );

  return render(
    <QueryClientProvider client={qc}>
      <HallazgosView />
    </QueryClientProvider>,
  );
}

beforeEach(async () => {
  await db.outbox.clear();
  await db.photos.clear();
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function completarFormulario() {
  fireEvent.click(screen.getByLabelText('Equipo'));
  fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: /PE-004/ }));
  fireEvent.change(screen.getByPlaceholderText(/Qué se detectó/), { target: { value: 'Mangueras sueltas' } });
}

function elegirFoto() {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const foto = new File([new Uint8Array([1, 2, 3])], 'hallazgo.jpg', { type: 'image/jpeg' });
  fireEvent.change(input, { target: { files: [foto] } });
}

describe('HallazgosView', () => {
  it('renderiza con datos sin lanzar', () => {
    renderView();

    expect(screen.getByText('Nivel de prioridad')).toBeTruthy();
    expect(screen.getByText('Registrar hallazgo')).toBeTruthy();
    expect(screen.getByText('Fuga de aceite hidráulico')).toBeTruthy();
  });

  /**
   * En escritorio el historial es una tabla, como en Inventario — pero el
   * formulario sigue siendo un formulario al lado, no se convierte en nada.
   */
  it('en escritorio muestra el historial como tabla, sin perder el formulario', () => {
    renderView('desktop');

    expect(screen.getByRole('table', { name: /Hallazgos recientes/ })).toBeTruthy();
    for (const columna of ['Fecha', 'Equipo', 'Prioridad', 'Descripción', 'Foto', 'Estado']) {
      expect(screen.getByRole('columnheader', { name: columna })).toBeTruthy();
    }

    expect(screen.getByText('Registrar hallazgo')).toBeTruthy();
    expect(screen.getByText('Nivel de prioridad')).toBeTruthy();
  });

  /** Acta N.° 004, R11: para que el supervisor no lo avise además por radio. */
  it('dice que el aviso llega a mantenedores y administrador', () => {
    renderView();

    expect(screen.getByText(/se avisa a los mantenedores y al administrador/)).toBeTruthy();
  });

  /**
   * La foto de un hallazgo viaja por el outbox (se sube en el replay), no por
   * `/api/uploads` al elegirla. Y es opcional: el encabezado tiene que
   * decirlo, porque ese componente por defecto dice "requerida" en rojo.
   */
  it('ofrece la foto de respaldo como opcional', () => {
    renderView();

    expect(screen.getByText('· opcional')).toBeTruthy();
    expect(screen.queryByText('· requerida')).toBeNull();
    expect(screen.getByText('Foto del hallazgo')).toBeTruthy();
  });

  it('al registrar con foto, encola en el outbox SIN subir la foto en el momento, limpia el formulario y avisa', async () => {
    renderView();

    completarFormulario();
    elegirFoto();
    fireEvent.click(screen.getByRole('button', { name: /Registrar hallazgo/ }));

    await waitFor(async () => expect(await db.outbox.count()).toBe(1));
    const op = (await db.outbox.toArray())[0]!;
    expect(op).toMatchObject({
      type: 'createHallazgo',
      userId: 'u1',
      status: 'pending_upload',
      payload: { equipoId: 'e1', descripcion: 'Mangueras sueltas', prioridad: 'MEDIA' },
    });
    expect(op.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(op.type === 'createHallazgo' && op.payload.id).toBe(op.id);
    expect(op.type === 'createHallazgo' && Date.parse(op.payload.capturedAt)).not.toBeNaN();
    expect(await db.photos.count()).toBe(1);

    expect(uploadFileMock).not.toHaveBeenCalled();
    expect(fuelReadingOcrMock).not.toHaveBeenCalled();
    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith(expect.stringContaining('Guardado')));
    expect((screen.getByPlaceholderText(/Qué se detectó/) as HTMLTextAreaElement).value).toBe('');
  });

  it('el pendiente aparece en el historial como "Sin sincronizar" con "Foto pendiente de subir"', async () => {
    renderView();

    completarFormulario();
    elegirFoto();
    fireEvent.click(screen.getByRole('button', { name: /Registrar hallazgo/ }));

    await waitFor(() => expect(screen.getByText('Mangueras sueltas')).toBeTruthy());
    expect(screen.getByText('Sin sincronizar')).toBeTruthy();
    expect(screen.getByText('Foto pendiente de subir')).toBeTruthy();
    // El del servidor sigue ahí.
    expect(screen.getByText('Fuga de aceite hidráulico')).toBeTruthy();
  });

  it('sin foto, encola en pending y no muestra "Foto pendiente de subir"', async () => {
    renderView();

    completarFormulario();
    fireEvent.click(screen.getByRole('button', { name: /Registrar hallazgo/ }));

    await waitFor(() => expect(screen.getByText('Sin sincronizar')).toBeTruthy());
    expect((await db.outbox.toArray())[0]).toMatchObject({ status: 'pending' });
    expect(await db.photos.count()).toBe(0);
    expect(screen.queryByText('Foto pendiente de subir')).toBeNull();
  });

  it('el pendiente también aparece en la tabla de escritorio', async () => {
    renderView('desktop');

    completarFormulario();
    fireEvent.click(screen.getByRole('button', { name: /Registrar hallazgo/ }));

    const tabla = within(screen.getByRole('table', { name: /Hallazgos recientes/ }));
    await waitFor(() => expect(tabla.getByText('Mangueras sueltas')).toBeTruthy());
    expect(tabla.getByText('Sin sincronizar')).toBeTruthy();
  });

  it('sin equipo no encola: muestra la validación', async () => {
    renderView();

    fireEvent.click(screen.getByRole('button', { name: /Registrar hallazgo/ }));

    await waitFor(() => expect(screen.getByText('Seleccioná un equipo')).toBeTruthy());
    expect(await db.outbox.count()).toBe(0);
  });

  /**
   * Un hallazgo guardado solo en el equipo no existe todavía en el servidor:
   * no se puede corregir hasta que sincronice.
   */
  it('no deja editar un hallazgo pendiente de sincronizar y dice por qué', async () => {
    renderView();

    completarFormulario();
    fireEvent.click(screen.getByRole('button', { name: /Registrar hallazgo/ }));
    await waitFor(() => expect(screen.getByText('Sin sincronizar')).toBeTruthy());

    const pendiente = screen.getAllByRole('button', { name: /Editar hallazgo de PE-004/ });
    // El pendiente va primero en la lista; el del servidor sigue editable.
    expect(pendiente[0]!.hasAttribute('disabled')).toBe(true);
    expect(pendiente[1]!.hasAttribute('disabled')).toBe(false);
    expect(screen.getByText(/Se puede editar cuando termine de sincronizarse/)).toBeTruthy();
  });

  /**
  /**
   * Acta N.° 004, R13: un hallazgo mal cargado se corrige sin autorización,
   * avisando antes de guardar que el administrador se entera, y con el
   * historial de quién cambió qué.
   */
  describe('corregir un hallazgo', () => {
    afterEach(() => vi.clearAllMocks());

    const abrirEdicion = (size: 'phone' | 'desktop' = 'phone') => {
      renderView(size);
      fireEvent.click(screen.getByRole('button', { name: /Editar hallazgo de PE-004/ }));
      return within(screen.getByRole('dialog'));
    };

    it('abre la corrección prellenada, con el aviso y el historial', async () => {
      const ventana = abrirEdicion();

      expect(ventana.getByText(/Al guardar se avisa al administrador/)).toBeTruthy();
      expect(ventana.getByDisplayValue('Fuga de aceite hidráulico')).toBeTruthy();
      expect(await ventana.findByText('José Pérez')).toBeTruthy();
    });

    it('guarda la corrección con el registro completo', async () => {
      const ventana = abrirEdicion('desktop');

      fireEvent.click(within(ventana.getByRole('group', { name: 'Nivel de prioridad' })).getByRole('button', { name: 'CRÍTICA' }));
      fireEvent.click(ventana.getByRole('button', { name: /Guardar cambios/ }));

      await waitFor(() => expect(updateHallazgo).toHaveBeenCalled());
      expect(vi.mocked(updateHallazgo).mock.calls[0][0]).toEqual({
        id: 'h1',
        payload: { equipoId: 'e1', descripcion: 'Fuga de aceite hidráulico', prioridad: 'CRITICA', estado: 'ABIERTO' },
      });
      expect(await ventana.findByText(/Cambio guardado. Se avisó al administrador./)).toBeTruthy();
    });

    it('no deja guardar sin descripción', () => {
      const ventana = abrirEdicion();
      fireEvent.change(ventana.getByDisplayValue('Fuga de aceite hidráulico'), { target: { value: '' } });

      expect(ventana.getByRole('button', { name: /Guardar cambios/ }).hasAttribute('disabled')).toBe(true);
    });
  });
});
