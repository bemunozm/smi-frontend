import 'fake-indexeddb/auto';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// El guardado ya no llama a la API: encola en el outbox (Dexie, con
// `fake-indexeddb`) y el replay lo manda en segundo plano. Sin usuario
// fijado en el motor (`setCurrentUser`), `requestSync` no procesa nada, así
// que acá solo se prueba lo que ve la vista: la operación encolada y su
// proyección en el historial. El replay y los errores de negocio
// (`OPERATOR_INACTIVE`, `EQUIPMENT_ON_SHIFT`, 404) los cubre
// `offline/replay.test.ts`.
const { toastDangerMock, toastSuccessMock } = vi.hoisted(() => ({
  toastDangerMock: vi.fn(),
  toastSuccessMock: vi.fn(),
}));
vi.mock('@heroui/react', () => ({ toast: { danger: toastDangerMock, success: toastSuccessMock } }));
vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { id: 'u1' }, role: null, isOfflineSnapshot: false }),
}));

import { db } from '../offline/db';
import { TrabajosExtraView } from './TrabajosExtraView';

afterEach(cleanup);

const OPERADOR = {
  id: 'op_1',
  name: 'Rodrigo Paredes',
  rut: null,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const REGISTRO = {
  id: 'r1',
  equipoId: 'e1',
  operatorId: 'op_1',
  operador: 'Juan Rojas',
  faena: 'Rajo Norte',
  turno: 'DIURNO',
  horometroInicial: 5388,
  horometroFinal: 5400,
  totalHoras: 12,
  actividades: ['REGULACION_CARGA'],
  otraActividad: null,
  descripcion: 'Carga de material',
  observaciones: 'Neumático trasero pinchado a media tarea',
  fecha: '2026-08-01T09:00:00.000Z',
  equipo: { internalCode: 'CM-003' },
};

function renderConRegistro() {
  const qc = new QueryClient();
  qc.setQueryData(['equipment'], [{ id: 'e1', internalCode: 'CM-003', type: 'Camión' }]);
  qc.setQueryData(['trabajos-extra'], [REGISTRO]);
  qc.setQueryData(['horometro'], []);
  qc.setQueryData(['operators', { isActive: true }], [OPERADOR]);
  return render(
    <QueryClientProvider client={qc}>
      <TrabajosExtraView />
    </QueryClientProvider>,
  );
}

/** Completa el formulario con valores válidos — opcionalmente sin elegir
 * operador, para probar la validación de ese campo en particular. */
function completarFormularioValido({ conOperador = true }: { conOperador?: boolean } = {}) {
  fireEvent.click(screen.getByLabelText('Equipo'));
  fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: /CM-003/ }));

  if (conOperador) {
    fireEvent.click(screen.getByLabelText('Operador'));
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: OPERADOR.name }));
  }

  fireEvent.change(screen.getByLabelText('Horómetro inicial'), { target: { value: '100' } });
  fireEvent.change(screen.getByLabelText('Horómetro final'), { target: { value: '112' } });
  fireEvent.click(screen.getByRole('button', { name: 'Soltar material' }));
  fireEvent.change(screen.getByLabelText('Descripción de la tarea'), {
    target: { value: 'Carga de material extra' },
  });
}

describe('TrabajosExtraView', () => {
  beforeEach(async () => {
    await db.outbox.clear();
    toastDangerMock.mockClear();
    toastSuccessMock.mockClear();
  });

  afterEach(() => vi.useRealTimers());

  it('renderiza con datos sin lanzar', () => {
    renderConRegistro();

    expect(screen.getByRole('heading', { name: 'Trabajos extraordinarios' })).toBeTruthy();
    expect(screen.getByText('Registrar trabajo')).toBeTruthy();
  });

  /**
   * Los trabajos ya registrados viven en una ventana, como el historial de
   * Reporte diario: no están a la vista hasta abrirla.
   */
  it('muestra los trabajos registrados en la ventana del historial', () => {
    renderConRegistro();

    expect(screen.queryByText(/Rajo Norte/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Ver historial de trabajos/ }));

    const ventana = within(screen.getByRole('dialog'));
    // La faena del registro histórico se muestra tal como quedó guardada,
    // aunque el formulario ya solo ofrezca Patillo y Kainita.
    expect(ventana.getByText(/Rajo Norte/)).toBeTruthy();
    expect(ventana.getByText('Regulación y carga')).toBeTruthy();
  });

  it('abre el detalle de un trabajo con su descripción y observaciones', () => {
    renderConRegistro();

    fireEvent.click(screen.getByRole('button', { name: /Ver historial de trabajos/ }));
    fireEvent.click(screen.getByRole('button', { name: /Ver detalle/ }));

    const ventana = within(screen.getByRole('dialog'));
    expect(ventana.getByText('Carga de material')).toBeTruthy();
    expect(ventana.getByText('Neumático trasero pinchado a media tarea')).toBeTruthy();

    fireEvent.click(ventana.getByText('Volver al historial'));
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: /Ver detalle/ })).toBeTruthy();
  });

  /** El turno lo propone el reloj: de noche ya no arranca en DIURNO. */
  it('propone el turno que corre según la hora', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 28, 22, 30));
    renderConRegistro();

    const turno = within(screen.getByRole('group', { name: 'Turno' }));
    expect(turno.getByRole('button', { name: /NOCTURNO/ }).getAttribute('aria-pressed')).toBe('true');
    expect(turno.getByRole('button', { name: /DIURNO/ }).getAttribute('aria-pressed')).toBe('false');
  });

  /**
   * Un equipo con turno en curso está ocupado: sus horas todavía no están
   * cerradas, así que las del trabajo extraordinario podrían terminar
   * contadas dos veces. El servidor lo rechaza; la vista además lo muestra en
   * gris, para que se sepa que el equipo existe y por qué no se puede elegir.
   */
  it('muestra los equipos en turno como ocupados y no deja elegirlos', () => {
    const qc = new QueryClient();
    qc.setQueryData(
      ['equipment'],
      [
        { id: 'e1', internalCode: 'CM-003', type: 'Camión' },
        { id: 'e2', internalCode: 'CA-011', type: 'Cargador' },
      ],
    );
    qc.setQueryData(['trabajos-extra'], []);
    // CA-011 abrió turno y todavía no lo cerró: `valorFinal` en null.
    qc.setQueryData(
      ['horometro'],
      [
        { id: 'h1', equipoId: 'e2', valorInicial: 100, valorFinal: null },
        { id: 'h2', equipoId: 'e1', valorInicial: 50, valorFinal: 62 },
      ],
    );
    qc.setQueryData(['operators', { isActive: true }], [OPERADOR]);

    render(
      <QueryClientProvider client={qc}>
        <TrabajosExtraView />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByLabelText('Equipo'));
    const lista = within(screen.getByRole('listbox'));

    // El libre se puede elegir.
    const libre = lista.getByRole('option', { name: /CM-003/ });
    expect(libre.getAttribute('aria-disabled')).not.toBe('true');

    // El ocupado sigue a la vista —para que se sepa que existe— pero
    // deshabilitado y diciendo por qué.
    const ocupado = lista.getByRole('option', { name: /CA-011/ });
    expect(ocupado.getAttribute('aria-disabled')).toBe('true');
    expect(ocupado.textContent).toContain('Ocupado, en turno');

    expect(screen.getByText(/1 equipo está en turno/)).toBeTruthy();
  });

  /**
   * Una salida suele mezclar tareas, así que las actividades son varias. Y
   * «Otro» sin texto dejaría la actividad como «otro» a secas: el trabajo no
   * se podría justificar ni cobrar, así que el campo aparece solo al elegirlo.
   */
  it('permite elegir varias actividades y pide el texto al marcar Otro', () => {
    const qc = new QueryClient();
    qc.setQueryData(['equipment'], [{ id: 'e1', internalCode: 'CM-003', type: 'Camión' }]);
    qc.setQueryData(['trabajos-extra'], []);
    qc.setQueryData(['horometro'], []);
    qc.setQueryData(['operators', { isActive: true }], [OPERADOR]);

    render(
      <QueryClientProvider client={qc}>
        <TrabajosExtraView />
      </QueryClientProvider>,
    );

    // El campo de texto no está hasta que se elige «Otro».
    expect(screen.queryByLabelText(/otra actividad/i)).toBeNull();

    const soltar = screen.getByRole('button', { name: 'Soltar material' });
    const limpiar = screen.getByRole('button', { name: 'Limpieza de cancha' });
    fireEvent.click(soltar);
    fireEvent.click(limpiar);

    // Las dos quedan marcadas a la vez: no es excluyente.
    expect(soltar.getAttribute('aria-pressed')).toBe('true');
    expect(limpiar.getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Otro' }));
    expect(screen.getByLabelText(/otra actividad/i)).toBeTruthy();
  });

  /**
   * El operador dejó de ser texto libre: sale del catálogo propio
   * (`useOperators({ isActive: true })`), mismo `Selector` del kit de
   * Terreno y mismo criterio que `RegistroEquipoView`.
   */
  it('el selector de operador ofrece el catálogo real (no texto libre)', () => {
    renderConRegistro();

    fireEvent.click(screen.getByLabelText('Operador'));

    const lista = within(screen.getByRole('listbox'));
    expect(lista.getByRole('option', { name: OPERADOR.name })).toBeTruthy();
  });

  /** El historial sigue leyendo el snapshot `operador` (texto), no el
   * catálogo — así un registro sigue siendo legible aunque el operador que
   * lo hizo se haya borrado o desactivado después. */
  it('el historial sigue mostrando el nombre del operador (snapshot)', () => {
    renderConRegistro();

    fireEvent.click(screen.getByRole('button', { name: /Ver historial de trabajos/ }));

    expect(within(screen.getByRole('dialog')).getByText('Juan Rojas')).toBeTruthy();
  });

  it('no deja enviar sin elegir un operador: muestra el error y no encola nada', async () => {
    renderConRegistro();

    completarFormularioValido({ conOperador: false });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar trabajo' }));

    await waitFor(() => expect(screen.getByText('Elegí el operador')).toBeTruthy());
    expect(await db.outbox.count()).toBe(0);
  });

  it('al guardar, encola con id y capturedAt del cliente, manda operatorId y no manda operador', async () => {
    renderConRegistro();

    completarFormularioValido();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar trabajo' }));

    await waitFor(async () => expect(await db.outbox.count()).toBe(1));
    const op = (await db.outbox.toArray())[0]!;
    if (op.type !== 'createTrabajoExtra') throw new Error('tipo inesperado');
    expect(op).toMatchObject({ userId: 'u1', status: 'pending' });
    expect(op.payload).toMatchObject({
      equipoId: 'e1',
      operatorId: 'op_1',
      horometroInicial: 100,
      horometroFinal: 112,
      actividades: ['SOLTAR_MATERIAL'],
      descripcion: 'Carga de material extra',
    });
    expect(op.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(op.payload.id).toBe(op.id);
    expect(Date.parse(op.payload.capturedAt)).not.toBeNaN();
    expect('operador' in op.payload).toBe(false);
  });

  it('tras guardar avisa, limpia el formulario y vuelve a habilitar el botón', async () => {
    renderConRegistro();

    completarFormularioValido();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar trabajo' }));

    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith(expect.stringContaining('Guardado')));
    await waitFor(() =>
      expect((screen.getByLabelText('Descripción de la tarea') as HTMLTextAreaElement).value).toBe(''),
    );
    expect((screen.getByRole('button', { name: 'Registrar trabajo' }) as HTMLButtonElement).disabled).toBe(false);
    expect(toastDangerMock).not.toHaveBeenCalled();
  });

  it('el trabajo pendiente aparece en el historial como "Sin sincronizar", con el nombre del operador del catálogo', async () => {
    renderConRegistro();

    completarFormularioValido();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar trabajo' }));
    await waitFor(async () => expect(await db.outbox.count()).toBe(1));

    fireEvent.click(screen.getByRole('button', { name: /Ver historial de trabajos/ }));
    const ventana = within(screen.getByRole('dialog'));
    await waitFor(() => expect(ventana.getByText('Sin sincronizar')).toBeTruthy());
    expect(ventana.getByText('Rodrigo Paredes')).toBeTruthy();
    expect(ventana.getByText('Soltar material')).toBeTruthy();
    // Horas calculadas localmente como el servidor (112 - 100): la del
    // pendiente y la del registro del servidor, ambas de 12 h.
    expect(ventana.getAllByText('12 h')).toHaveLength(2);
    // El registro del servidor sigue ahí.
    expect(ventana.getByText('Juan Rojas')).toBeTruthy();
  });

  it('el detalle de un pendiente muestra la marca de sin sincronizar', async () => {
    renderConRegistro();

    completarFormularioValido();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar trabajo' }));
    await waitFor(async () => expect(await db.outbox.count()).toBe(1));

    fireEvent.click(screen.getByRole('button', { name: /Ver historial de trabajos/ }));
    const ventana = within(screen.getByRole('dialog'));
    await waitFor(() => expect(ventana.getAllByRole('button', { name: /Ver detalle/ })).toHaveLength(2));
    fireEvent.click(ventana.getAllByRole('button', { name: /Ver detalle/ })[0]!);

    expect(within(screen.getByRole('dialog')).getByText('Sin sincronizar')).toBeTruthy();
  });
});
