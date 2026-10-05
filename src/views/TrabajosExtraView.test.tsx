import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TrabajosExtraView } from './TrabajosExtraView';
import { updateTrabajoExtra } from '../api/TrabajosExtraAPI';

/**
 * La edición y el historial de cambios van al servidor; acá se simulan. Lo
 * demás del API queda real, y las pruebas lo alimentan por la caché.
 */
vi.mock('../api/TrabajosExtraAPI', async (original) => ({
  ...(await original<typeof import('../api/TrabajosExtraAPI')>()),
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

afterEach(cleanup);

const REGISTRO = {
  id: 'r1',
  equipoId: 'e1',
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
  return render(
    <QueryClientProvider client={qc}>
      <TrabajosExtraView />
    </QueryClientProvider>,
  );
}

describe('TrabajosExtraView', () => {
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
          // CM-003 no está en uso, pero tiene operador ASIGNADO en Flota.
          { id: 'e1', internalCode: 'CM-003', type: 'Camión', status: 'OPERATIONAL', operator: { id: 'u1', name: 'Luis Contreras' } },
          { id: 'e2', internalCode: 'CA-011', type: 'Cargador', status: 'OPERATIONAL', operator: null },
          { id: 'e3', internalCode: 'EX-002', type: 'Excavadora', status: 'IN_WORKSHOP', operator: null },
          // CM-040: ni turno abierto ni operador asignado.
          { id: 'e4', internalCode: 'CM-040', type: 'Camión', status: 'OPERATIONAL', operator: null },
        ],
      );
      qc.setQueryData(['trabajos-extra'], []);
      // CA-011 abrió turno y todavía no lo cerró: `valorFinal` en null.
      qc.setQueryData(
        ['horometro'],
        [
          { id: 'h1', equipoId: 'e2', operador: 'Patricio Rojas', valorInicial: 100, valorFinal: null },
          { id: 'h2', equipoId: 'e1', operador: 'Luis Contreras', valorInicial: 50, valorFinal: 62 },
        ],
      );
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

    it('deja elegir un equipo en uso y avisa con quién está', () => {
      const lista = renderConTurnoAbierto();

      const enUso = lista.getByRole('option', { name: /CA-011/ });
      expect(enUso.getAttribute('aria-disabled')).not.toBe('true');
      expect(enUso.textContent).toContain('En uso · Patricio Rojas');

      fireEvent.click(enUso);
      expect(screen.getByText(/CA-011 está en uso con Patricio Rojas/)).toBeTruthy();
      // Su operador se propone mientras el campo esté vacío.
      expect((screen.getByLabelText('Operador') as HTMLInputElement).value).toBe('Patricio Rojas');
    });

    it('muestra los equipos en taller sin dejar elegirlos', () => {
      const lista = renderConTurnoAbierto();

      const enTaller = lista.getByRole('option', { name: /EX-002/ });
      expect(enTaller.getAttribute('aria-disabled')).toBe('true');
      expect(enTaller.textContent).toContain('En taller');
    });

    /**
     * El operador acompaña a la máquina: al cambiar de equipo, el campo se
     * sincroniza con el operador que corresponde al elegido — el del turno
     * abierto si está en uso, si no el asignado en Flota, y vacío si no
     * tiene ninguno. Antes solo se proponía con el campo vacío, y al cambiar
     * de equipo quedaba el operador de la máquina anterior.
     */
    it('al cambiar de equipo, el operador pasa a ser el del equipo elegido', () => {
      const lista = renderConTurnoAbierto();
      const operador = () => (screen.getByLabelText('Operador') as HTMLInputElement).value;

      fireEvent.click(lista.getByRole('option', { name: /CA-011/ }));
      expect(operador()).toBe('Patricio Rojas');

      // CM-003 no está en uso: manda su operador asignado en Flota.
      fireEvent.click(screen.getByLabelText('Equipo'));
      fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: /CM-003/ }));
      expect(operador()).toBe('Luis Contreras');
    });

    it('al cambiar a un equipo sin operador, el campo queda vacío', () => {
      const lista = renderConTurnoAbierto();
      const operador = () => (screen.getByLabelText('Operador') as HTMLInputElement).value;

      fireEvent.click(lista.getByRole('option', { name: /CA-011/ }));
      expect(operador()).toBe('Patricio Rojas');

      fireEvent.click(screen.getByLabelText('Equipo'));
      fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: /CM-040/ }));
      expect(operador()).toBe('');
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
    qc.setQueryData(['horometro'], []);

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
      const operador = ventana.getByLabelText('Operador') as HTMLInputElement;
      expect(operador.value).toBe('Juan Rojas');

      fireEvent.change(operador, { target: { value: 'Pedro Soto' } });
      fireEvent.click(ventana.getByRole('button', { name: /Guardar cambios/ }));

      await waitFor(() => expect(updateTrabajoExtra).toHaveBeenCalled());
      const [{ id, payload }] = vi.mocked(updateTrabajoExtra).mock.calls[0];
      expect(id).toBe('r1');
      expect(payload.operador).toBe('Pedro Soto');
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
