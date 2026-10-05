import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DomainError, OPERATOR_INACTIVE_MESSAGE } from '../lib/api-error';
import { TrabajosExtraView } from './TrabajosExtraView';
import { updateTrabajoExtra } from '../api/TrabajosExtraAPI';

/**
 * Crear, editar y el historial de cambios van al servidor; acá se simulan
 * (`createTrabajoExtra` con un mock controlable para probar el flujo completo
 * vista → hook → API, incluido el mapeo de errores a toast). Lo demás del API
 * queda real: `listTrabajosExtra` se alimenta por la caché de las pruebas.
 */
const { createTrabajoExtraMock } = vi.hoisted(() => ({ createTrabajoExtraMock: vi.fn() }));

vi.mock('../api/TrabajosExtraAPI', async (original) => ({
  ...(await original<typeof import('../api/TrabajosExtraAPI')>()),
  createTrabajoExtra: createTrabajoExtraMock,
  updateTrabajoExtra: vi.fn(async ({ id }: { id: string }) => ({ id })),
  listCambiosTrabajoExtra: vi.fn(async () => [
    {
      id: 'c1',
      userName: 'Limbert Villacorta',
      createdAt: '2026-10-01T14:20:00.000Z',
      changes: [{ field: 'operador', label: 'Operador', before: 'Pedro Soto', after: 'Juan Rojas' }],
    },
  ]),
}));

const { toastDangerMock } = vi.hoisted(() => ({ toastDangerMock: vi.fn() }));
vi.mock('@heroui/react', () => ({ toast: { danger: toastDangerMock, success: vi.fn() } }));

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
  qc.setQueryData(['operators', { isActive: true }], [OPERADOR, OPERADOR_NUEVO]);
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
  beforeEach(() => {
    createTrabajoExtraMock.mockReset();
    toastDangerMock.mockClear();
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
   * Una salida suele mezclar tareas, así que las actividades son varias. Y
   * «Otro» sin texto dejaría la actividad como «otro» a secas: el trabajo no
   * se podría justificar ni cobrar, así que el campo aparece solo al elegirlo.
   */
  it('permite elegir varias actividades y pide el texto al marcar Otro', () => {
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

  it('no deja enviar sin elegir un operador: muestra el error y no llama a la API', async () => {
    renderConRegistro();

    completarFormularioValido({ conOperador: false });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar trabajo' }));

    await waitFor(() => expect(screen.getByText('Elegí el operador')).toBeTruthy());
    expect(createTrabajoExtraMock).not.toHaveBeenCalled();
  });

  it('al guardar, manda operatorId del operador elegido y no manda operador', async () => {
    createTrabajoExtraMock.mockResolvedValueOnce({ ...REGISTRO, id: 'r2' });
    renderConRegistro();

    completarFormularioValido();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar trabajo' }));

    await waitFor(() => expect(createTrabajoExtraMock).toHaveBeenCalledTimes(1));
    const payload = createTrabajoExtraMock.mock.calls[0][0];
    expect(payload).toMatchObject({
      equipoId: 'e1',
      operatorId: 'op_1',
      horometroInicial: 100,
      horometroFinal: 112,
      actividades: ['SOLTAR_MATERIAL'],
      descripcion: 'Carga de material extra',
    });
    expect(payload.operador).toBeUndefined();
  });

  // El operador es un `operatorId` validado contra el catálogo
  // (`OperatorsService.assertActive`, backend): guardar puede fallar con 409
  // `OPERATOR_INACTIVE` si se desactivó entre que se abrió el formulario y
  // se guardó — mismo texto que `hooks/useShiftCards.ts`/`hooks/useEquipment.ts`
  // (ver `lib/api-error.ts#OPERATOR_INACTIVE_MESSAGE`), no el mensaje técnico
  // del backend.
  it('un 409 OPERATOR_INACTIVE al guardar muestra un toast claro', async () => {
    createTrabajoExtraMock.mockRejectedValueOnce(
      new DomainError('Operator op_1 is inactive', { code: 'OPERATOR_INACTIVE', status: 409 }),
    );
    renderConRegistro();

    completarFormularioValido();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar trabajo' }));

    await waitFor(() => expect(toastDangerMock).toHaveBeenCalledWith(OPERATOR_INACTIVE_MESSAGE));
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

      await waitFor(() => expect(updateTrabajoExtra).toHaveBeenCalled());
      const [{ id, payload }] = vi.mocked(updateTrabajoExtra).mock.calls[0];
      expect(id).toBe('r1');
      expect(payload.operatorId).toBe('op_3');
      // El operador viaja como `operatorId` del catálogo, nunca como texto libre.
      expect((payload as Record<string, unknown>).operador).toBeUndefined();
      // Lo que no se tocó viaja igual: el servidor compara el registro entero.
      expect(payload.horometroFinal).toBe(5400);
    });

    it('cancelar vuelve al detalle sin guardar', () => {
      const ventana = abrirDetalle();
      fireEvent.click(ventana.getByRole('button', { name: /Editar/ }));
      fireEvent.click(ventana.getByRole('button', { name: 'Cancelar' }));

      expect(ventana.getByRole('button', { name: /Editar/ })).toBeTruthy();
      expect(updateTrabajoExtra).not.toHaveBeenCalled();
    });
  });
});
