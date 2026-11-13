import 'fake-indexeddb/auto';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { db } from '../offline/db';
import { toDateOnly } from '../lib/turno';
import { TrabajosExtraView } from './TrabajosExtraView';
import { listCambiosTrabajoExtra } from '../api/TrabajosExtraAPI';

/**
 * El alta ya no llama a la API: encola en el outbox (Dexie, con
 * `fake-indexeddb`) y el replay lo manda en segundo plano. Sin usuario fijado
 * en el motor (`setCurrentUser`), `requestSync` no procesa nada, así que acá
 * solo se prueba lo que ve la vista: la operación encolada y su proyección en
 * el historial. El replay y los errores de negocio (`OPERATOR_INACTIVE`, 404)
 * los cubre `offline/replay.test.ts`.
 *
 * La edición y el historial de cambios sí van al servidor; acá se simulan.
 */
vi.mock('../api/TrabajosExtraAPI', async (original) => ({
  ...(await original<typeof import('../api/TrabajosExtraAPI')>()),
  listCambiosTrabajoExtra: vi.fn(async () => [
    {
      id: 'c1',
      userName: 'Limbert Villacorta',
      createdAt: '2026-10-01T14:20:00.000Z',
      changes: [{ field: 'operador', label: 'Operador', before: 'Pedro Soto', after: 'Juan Rojas' }],
    },
  ]),
}));

const { toastDangerMock, toastSuccessMock } = vi.hoisted(() => ({
  toastDangerMock: vi.fn(),
  toastSuccessMock: vi.fn(),
}));
// Parcial: `FotoRespaldoField` (la foto del report) usa componentes reales de
// la librería — solo el `toast` se reemplaza, igual que en `HallazgosView.test`.
vi.mock('@heroui/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@heroui/react')>();
  return { ...actual, toast: { danger: toastDangerMock, success: toastSuccessMock } };
});
vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { id: 'u1' }, role: null, isOfflineSnapshot: false }),
}));

afterEach(cleanup);

const OPERADOR = {
  id: 'op_1',
  name: 'Rodrigo Paredes',
  rut: null,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const OPERADOR_NUEVO = { ...OPERADOR, id: 'op_3', name: 'Pedro Soto' };

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
  detalleActividades: [{ actividad: 'REGULACION_CARGA', lugar: 'TRANSPORTE', planta: null, horas: 12 }],
  otraActividad: null,
  descripcion: 'Carga de material',
  observaciones: 'Neumático trasero pinchado a media tarea',
  reportNumero: '4509',
  fecha: '2026-08-01T09:00:00.000Z',
  equipo: { internalCode: 'CM-003' },
};

function renderConRegistro() {
  const qc = new QueryClient();
  qc.setQueryData(['equipment'], [{ id: 'e1', internalCode: 'CM-003', type: 'Camión' }]);
  qc.setQueryData(['trabajos-extra'], [REGISTRO]);
  qc.setQueryData(['operators', { isActive: true }], [OPERADOR, OPERADOR_NUEVO]);
  qc.setQueryData(['plantas'], [{ id: 'p1', nombre: 'Planta 1' }, { id: 'p4', nombre: 'Planta 4' }]);
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
  completarFila(1, { actividad: 'Soltar material', lugar: 'Transporte', horas: '12' });
  fireEvent.change(screen.getByLabelText('Descripción de la tarea'), {
    target: { value: 'Carga de material extra' },
  });
  // Los campos del report: folio y la foto obligatoria.
  fireEvent.change(screen.getByLabelText('N° del report (boleta)'), { target: { value: '4509' } });
  elegirFoto();
}

/** Completa una fila del desglose (actividad · tipo · HM · descripción). Sin
 * `descripcion` explícita la fila lleva «Frente norte»: es obligatoria. */
function completarFila(
  n: number,
  { descripcion = 'Frente norte', ...fila }: { actividad?: string; lugar?: string; horas?: string; descripcion?: string },
) {
  fireEvent.change(screen.getByLabelText(`Descripción de la actividad ${n}`), { target: { value: descripcion } });
  if (fila.actividad) {
    fireEvent.click(screen.getByLabelText(`Actividad ${n}`));
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: fila.actividad }));
  }
  if (fila.lugar) {
    fireEvent.click(screen.getByLabelText(`Tipo de la actividad ${n}`));
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: fila.lugar }));
  }
  if (fila.horas != null) {
    fireEvent.change(screen.getByLabelText(`Horas máquina de la actividad ${n}`), {
      target: { value: fila.horas },
    });
  }
}

/** Elige la foto del report (obligatoria) en el único input de archivo del
 * formulario de alta — mismo helper que `HallazgosView.test`. */
function elegirFoto() {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const foto = new File(['report'], 'report.jpg', { type: 'image/jpeg' });
  fireEvent.change(input, { target: { files: [foto] } });
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

    expect(screen.getByRole('heading', { name: 'Report' })).toBeTruthy();
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
   * Acta N.° 004 (R10): el selector separa los equipos en terreno de los
   * disponibles, y un equipo en turno SE PUEDE elegir — el trabajo extra usa
   * la misma máquina del turno. El turno abierto queda como aviso, con el
   * operador, para no tener que coordinarlo por radio.
   */
  describe('selector de equipo', () => {
    function renderConTurnoAbierto() {
      const qc = new QueryClient();
      qc.setQueryData(
        ['equipment'],
        [
          { id: 'e1', internalCode: 'CM-003', type: 'Camión', status: 'OPERATIONAL' },
          {
            id: 'e2',
            internalCode: 'CA-011',
            type: 'Cargador',
            status: 'OPERATIONAL',
            openShift: { operador: 'Patricio Rojas', operatorId: 'op_2' },
          },
          { id: 'e3', internalCode: 'EX-002', type: 'Excavadora', status: 'IN_WORKSHOP' },
        ],
      );
      qc.setQueryData(['trabajos-extra'], []);
      qc.setQueryData(['operators', { isActive: true }], [OPERADOR, { ...OPERADOR, id: 'op_2', name: 'Patricio Rojas' }]);
      render(
        <QueryClientProvider client={qc}>
          <TrabajosExtraView />
        </QueryClientProvider>,
      );
      fireEvent.click(screen.getByLabelText('Equipo'));
      return within(screen.getByRole('listbox'));
    }

    it('separa los equipos en terreno de los disponibles', () => {
      const lista = renderConTurnoAbierto();

      const enTerreno = lista.getByRole('group', { name: 'En terreno' });
      const disponibles = lista.getByRole('group', { name: 'Disponibles' });
      expect(within(enTerreno).getByRole('option', { name: /CA-011/ })).toBeTruthy();
      expect(within(disponibles).getByRole('option', { name: /CM-003/ })).toBeTruthy();
    });

    it('deja elegir un equipo en turno y avisa con quién está', () => {
      const lista = renderConTurnoAbierto();

      const enTurno = lista.getByRole('option', { name: /CA-011/ });
      expect(enTurno.getAttribute('aria-disabled')).not.toBe('true');
      expect(enTurno.textContent).toContain('En turno · Patricio Rojas');

      fireEvent.click(enTurno);
      expect(screen.getByText(/CA-011 está en turno con Patricio Rojas/)).toBeTruthy();
      // Su operador (por `openShift.operatorId`) se propone mientras el campo esté vacío.
      expect(screen.getByLabelText('Operador').textContent).toContain('Patricio Rojas');
    });

    it('no pisa el operador ya elegido al escoger un equipo en turno', () => {
      const lista = renderConTurnoAbierto();
      fireEvent.click(lista.getByRole('option', { name: /CM-003/ }));
      fireEvent.click(screen.getByLabelText('Operador'));
      fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: OPERADOR.name }));

      fireEvent.click(screen.getByLabelText('Equipo'));
      fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: /CA-011/ }));

      expect(screen.getByLabelText('Operador').textContent).toContain(OPERADOR.name);
    });

    it('sin operatorId en el turno abierto no propone operador', () => {
      const qc = new QueryClient();
      qc.setQueryData(['equipment'], [
        { id: 'e2', internalCode: 'CA-011', type: 'Cargador', status: 'OPERATIONAL', openShift: { operador: 'Patricio Rojas', operatorId: null } },
      ]);
      qc.setQueryData(['trabajos-extra'], []);
      qc.setQueryData(['operators', { isActive: true }], [OPERADOR]);
      render(
        <QueryClientProvider client={qc}>
          <TrabajosExtraView />
        </QueryClientProvider>,
      );
      fireEvent.click(screen.getByLabelText('Equipo'));
      fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: /CA-011/ }));

      expect(screen.getByLabelText('Operador').textContent).toContain('Elegí el operador');
    });

    it('muestra los equipos en taller sin dejar elegirlos', () => {
      const lista = renderConTurnoAbierto();

      const enTaller = lista.getByRole('option', { name: /EX-002/ });
      expect(enTaller.getAttribute('aria-disabled')).toBe('true');
      expect(enTaller.textContent).toContain('En taller');
    });
  });

  /** Acta N.° 004: por regla se cobra un mínimo de una hora máquina. */
  describe('horas a cobrar', () => {
    const conHorometros = (inicial: string, final: string) => {
      renderConRegistro();
      fireEvent.change(screen.getByLabelText('Horómetro inicial'), { target: { value: inicial } });
      fireEvent.change(screen.getByLabelText('Horómetro final'), { target: { value: final } });
      return screen.getByText('Horas a cobrar').closest('div')!.parentElement!.textContent ?? '';
    };

    it('cobra una hora aunque el trabajo dure minutos', () => {
      const calculado = conHorometros('100', '100.3');
      expect(calculado).toContain('1 h');
      expect(calculado).toContain('Duró 0,3 h');
    });

    it('cobra las horas reales cuando pasan del mínimo', () => {
      expect(conHorometros('100', '102.5')).toContain('2,5 h');
    });
  });

  /**
   * Una salida suele mezclar tareas, así que el desglose acepta varias filas
   * (cada una con su lugar y sus HM). Y «Otro» sin texto dejaría la actividad
   * como «otro» a secas: el campo aparece solo al elegirlo en alguna fila.
   */
  it('permite agregar filas de actividades y pide el texto al elegir Otro', () => {
    const qc = new QueryClient();
    qc.setQueryData(['equipment'], [{ id: 'e1', internalCode: 'CM-003', type: 'Camión' }]);
    qc.setQueryData(['trabajos-extra'], []);
    qc.setQueryData(['operators', { isActive: true }], [OPERADOR]);

    render(
      <QueryClientProvider client={qc}>
        <TrabajosExtraView />
      </QueryClientProvider>,
    );

    // El campo de texto no está hasta que se elige «Otro».
    expect(screen.queryByLabelText(/otra actividad/i)).toBeNull();

    completarFila(1, { actividad: 'Soltar material', lugar: 'Transporte', horas: '2' });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar actividad' }));
    completarFila(2, { actividad: 'Limpieza de cancha', lugar: 'Variado', horas: '1' });

    // Las dos filas conviven, cada una con su actividad.
    expect(screen.getByLabelText('Actividad 1').textContent).toContain('Soltar material');
    expect(screen.getByLabelText('Actividad 2').textContent).toContain('Limpieza de cancha');

    completarFila(2, { actividad: 'Otro' });
    expect(screen.getByLabelText(/otra actividad/i)).toBeTruthy();

    // Quitar la fila de «Otro» también quita su campo de texto.
    fireEvent.click(screen.getByRole('button', { name: 'Quitar la actividad 2' }));
    expect(screen.queryByLabelText(/otra actividad/i)).toBeNull();
  });

  /** Los trabajos del Report los hacen los pesados: las camionetas no se ofrecen. */
  it('el selector de equipo ofrece solo equipos pesados, bajo el título «Nuevo report»', () => {
    const qc = new QueryClient();
    qc.setQueryData(['equipment'], [
      { id: 'e1', internalCode: 'SEM 02', type: 'CF', equipmentClass: 'HEAVY', status: 'OPERATIONAL' },
      { id: 'e2', internalCode: 'PJWS83', type: 'Camioneta', equipmentClass: 'LIGHT', status: 'OPERATIONAL' },
    ]);
    qc.setQueryData(['trabajos-extra'], []);
    qc.setQueryData(['operators', { isActive: true }], [OPERADOR]);
    render(
      <QueryClientProvider client={qc}>
        <TrabajosExtraView />
      </QueryClientProvider>,
    );

    expect(screen.getByText('Nuevo report')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Equipo'));
    const opciones = within(screen.getByRole('listbox')).getAllByRole('option').map((o) => o.textContent);
    expect(opciones.some((t) => t?.includes('SEM 02'))).toBe(true);
    expect(opciones.some((t) => t?.includes('PJWS83'))).toBe(false);
  });

  /**
   * El tipo define cómo se paga. La limpieza de silos es SIEMPRE Planta y es
   * la única (13-11: se marcaban como Transporte): el tipo se asigna solo y no
   * se elige; las demás eligen entre Transporte y Variado, sin Planta.
   */
  it('la limpieza de silos queda de tipo Planta sola y pide en qué planta', () => {
    const qc = new QueryClient();
    qc.setQueryData(['equipment'], [{ id: 'e1', internalCode: 'CM-003', type: 'Camión' }]);
    qc.setQueryData(['trabajos-extra'], []);
    qc.setQueryData(['operators', { isActive: true }], [OPERADOR]);

    render(
      <QueryClientProvider client={qc}>
        <TrabajosExtraView />
      </QueryClientProvider>,
    );

    // Otra actividad: el tipo se elige y Planta no está entre las opciones.
    completarFila(1, { actividad: 'Soltar material' });
    fireEvent.click(screen.getByLabelText('Tipo de la actividad 1'));
    const opciones = within(screen.getByRole('listbox')).getAllByRole('option').map((o) => o.textContent);
    expect(opciones).toEqual(['Transporte', 'Variado']);
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Transporte' }));

    // Limpieza de silos: tipo Planta fijo y la pregunta de en qué planta.
    completarFila(1, { actividad: 'Limpieza de silos' });
    expect((screen.getByLabelText('Tipo de la actividad 1') as HTMLInputElement).value).toBe('Planta · automático');
    // Puede abarcar varias plantas: se marcan las que correspondan.
    const grupo = screen.getByRole('group', { name: 'Plantas de la actividad 1' });
    // Solo las cinco plantas de silos, con su nombre largo (P.P. producto, P.R. rechazo).
    expect(within(grupo).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'P.P.1Planta 1',
      'P.P.2Planta 2',
      'P.R.2Rechazo planta 2',
      'P.P.4Planta 4',
      'P.R.4Rechazo planta 4',
    ]);
    fireEvent.click(within(grupo).getByRole('button', { name: /^P.P.1/  }));
    fireEvent.click(within(grupo).getByRole('button', { name: /^P.P.4/  }));
    expect(within(grupo).getByRole('button', { name: /^P.P.1/  }).getAttribute('aria-pressed')).toBe('true');
    expect(within(grupo).getByRole('button', { name: /^P.P.4/  }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(within(grupo).getByRole('button', { name: /^P.P.1/  }));
    expect(within(grupo).getByRole('button', { name: /^P.P.1/  }).getAttribute('aria-pressed')).toBe('false');

    // Volver a otra actividad deja el tipo por elegir.
    completarFila(1, { actividad: 'Soltar material' });
    expect(screen.getByLabelText('Tipo de la actividad 1').textContent).not.toContain('Planta');
    expect(screen.queryByRole('group', { name: 'Plantas de la actividad 1' })).toBeNull();
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
    // `pending_upload`: la foto del report (obligatoria) viaja como blob y se
    // sube recién en el replay — mismo pipeline que la foto de un hallazgo.
    expect(op).toMatchObject({ userId: 'u1', status: 'pending_upload', photoId: op.id });
    expect(op.payload).toMatchObject({
      equipoId: 'e1',
      operatorId: 'op_1',
      horometroInicial: 100,
      horometroFinal: 112,
      // El desglose viaja normalizado: plantas solo en filas PLANTA (vacías acá).
      detalle: [
        { actividad: 'SOLTAR_MATERIAL', lugar: 'TRANSPORTE', plantas: [], horas: 12, descripcion: 'Frente norte' },
      ],
      descripcion: 'Carga de material extra',
      reportNumero: '4509',
    });
    expect(await db.blobs.count()).toBe(1);
    expect(op.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(op.payload.id).toBe(op.id);
    expect(Date.parse(op.payload.capturedAt)).not.toBeNaN();
    expect('operador' in op.payload).toBe(false);
    expect('fotoKey' in op.payload).toBe(false);
  });

  it('la fecha por defecto es hoy y NO viaja en el payload (conserva la hora real de captura)', async () => {
    renderConRegistro();

    completarFormularioValido();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar trabajo' }));

    await waitFor(async () => expect(await db.outbox.count()).toBe(1));
    const op = (await db.outbox.toArray())[0]!;
    if (op.type !== 'createTrabajoExtra') throw new Error('tipo inesperado');
    expect('fecha' in op.payload).toBe(false);
  });

  it('con una fecha pasada elegida, el payload la lleva (carga histórica)', async () => {
    const ayer = toDateOnly(new Date(Date.now() - 86_400_000));
    renderConRegistro();

    completarFormularioValido();
    fireEvent.click(screen.getByRole('button', { name: 'Fecha del trabajo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ayer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Registrar trabajo' }));

    await waitFor(async () => expect(await db.outbox.count()).toBe(1));
    const op = (await db.outbox.toArray())[0]!;
    if (op.type !== 'createTrabajoExtra') throw new Error('tipo inesperado');
    expect(op.payload).toMatchObject({ fecha: ayer });
  });

  it('un equipo en turno se encola igual, con su operador propuesto y las horas reales sin redondear', async () => {
    const qc = new QueryClient();
    qc.setQueryData(
      ['equipment'],
      [
        {
          id: 'e1',
          internalCode: 'CM-003',
          type: 'Camión',
          status: 'OPERATIONAL',
          openShift: { operador: 'Rodrigo Paredes', operatorId: 'op_1' },
        },
      ],
    );
    qc.setQueryData(['trabajos-extra'], []);
    qc.setQueryData(['operators', { isActive: true }], [OPERADOR]);
    render(
      <QueryClientProvider client={qc}>
        <TrabajosExtraView />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByLabelText('Equipo'));
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: /CM-003/ }));
    fireEvent.change(screen.getByLabelText('Horómetro inicial'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('Horómetro final'), { target: { value: '100.3' } });
    completarFila(1, { actividad: 'Soltar material', lugar: 'Variado', horas: '0.3' });
    fireEvent.change(screen.getByLabelText('Descripción de la tarea'), { target: { value: 'Despeje' } });
    fireEvent.change(screen.getByLabelText('N° del report (boleta)'), { target: { value: '4510' } });
    elegirFoto();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar trabajo' }));

    await waitFor(async () => expect(await db.outbox.count()).toBe(1));
    const op = (await db.outbox.toArray())[0]!;
    if (op.type !== 'createTrabajoExtra') throw new Error('tipo inesperado');
    expect(op.payload.operatorId).toBe('op_1');
    // El mínimo de cobro se aplica al leer, no al guardar.
    expect(op.payload.horometroFinal - op.payload.horometroInicial).toBeCloseTo(0.3);
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
    // El registro del servidor sigue ahí.
    expect(ventana.getByText('Juan Rojas')).toBeTruthy();
  });

  /**
   * Un trabajo guardado solo en el equipo todavía no existe en el servidor:
   * no se puede editar ni tiene historial de cambios hasta que sincronice.
   */
  it('el detalle de un pendiente muestra la marca de sin sincronizar y no deja editar', async () => {
    renderConRegistro();

    completarFormularioValido();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar trabajo' }));
    await waitFor(async () => expect(await db.outbox.count()).toBe(1));

    fireEvent.click(screen.getByRole('button', { name: /Ver historial de trabajos/ }));
    const ventana = within(screen.getByRole('dialog'));
    await waitFor(() => expect(ventana.getAllByRole('button', { name: /Ver detalle/ })).toHaveLength(2));
    // El pendiente va primero en la lista.
    fireEvent.click(ventana.getAllByRole('button', { name: /Ver detalle/ })[0]!);

    const detalle = within(screen.getByRole('dialog'));
    expect(detalle.getByText('Sin sincronizar')).toBeTruthy();
    expect(detalle.getByRole('button', { name: /Editar/ }).hasAttribute('disabled')).toBe(true);
    expect(detalle.getByText(/Se puede editar cuando termine de sincronizarse/)).toBeTruthy();
    const idPendiente = (await db.outbox.toArray())[0]!.id;
    expect(listCambiosTrabajoExtra).not.toHaveBeenCalledWith(idPendiente);
  });

  /**
   * Acta N.° 004, R13: lo ya registrado se puede editar desde el historial,
   * avisando antes de guardar que el administrador se entera, y el detalle
   * muestra quién cambió qué.
   */
  describe('editar un trabajo registrado', () => {
    afterEach(() => vi.clearAllMocks());

    const abrirDetalle = () => {
      renderConRegistro();
      fireEvent.click(screen.getByRole('button', { name: /Ver historial de trabajos/ }));
      fireEvent.click(screen.getByRole('button', { name: /Ver detalle/ }));
      return within(screen.getByRole('dialog'));
    };

    it('muestra el historial de cambios en el detalle', async () => {
      const ventana = abrirDetalle();

      expect(await ventana.findByText('Limbert Villacorta')).toBeTruthy();
      expect(ventana.getByText('Pedro Soto')).toBeTruthy();
    });

    it('edita con el formulario prellenado, avisa al administrador y guarda', async () => {
      const ventana = abrirDetalle();
      fireEvent.click(ventana.getByRole('button', { name: /Editar/ }));

      expect(ventana.getByText(/Al guardar se avisa al administrador/)).toBeTruthy();
      // El operador guardado (`operatorId`) llega seleccionado del catálogo.
      expect(ventana.getByLabelText('Operador').textContent).toContain(OPERADOR.name);

      fireEvent.click(ventana.getByLabelText('Operador'));
      fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Pedro Soto' }));
      fireEvent.click(ventana.getByRole('button', { name: /Guardar cambios/ }));

      await waitFor(async () => expect(await db.outbox.count()).toBe(1));
      const [op] = await db.outbox.toArray();
      expect(op).toMatchObject({
        type: 'httpWrite',
        endpoint: 'trabajoExtra.edit',
        params: { id: 'r1' },
        // Solo lo tocado, y como `operatorId` del catálogo, nunca como texto libre.
        body: { operatorId: 'op_3' },
        expected: { operatorId: 'op_1' },
        entityKey: 'trabajo-extra:r1',
      });
      expect(Object.keys(op!.type === 'httpWrite' ? op.body : {})).toEqual(['operatorId']);
    });

    it('cancelar vuelve al detalle sin guardar', async () => {
      const ventana = abrirDetalle();
      fireEvent.click(ventana.getByRole('button', { name: /Editar/ }));
      fireEvent.click(ventana.getByRole('button', { name: 'Cancelar' }));

      expect(ventana.getByRole('button', { name: /Editar/ })).toBeTruthy();
      expect(await db.outbox.count()).toBe(0);
    });
  });
});
