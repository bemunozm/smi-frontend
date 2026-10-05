import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { RegistroEquipoView } from './RegistroEquipoView';

// Las tarjetas EN CURSO se derivan de las lecturas de horómetro abiertas del
// servidor, y abrir/cerrar una tarjeta registra la entrada/salida allá — la
// misma señal (`valorFinal == null`) que marca «En uso» en el selector de
// Trabajos extraordinarios. Se mockea la capa de API (no los hooks), mismo
// criterio que `CombustibleView.test.tsx`.
const { createHorometroMock, cerrarHorometroMock, listHorometroMock } = vi.hoisted(() => ({
  createHorometroMock: vi.fn(),
  cerrarHorometroMock: vi.fn(),
  listHorometroMock: vi.fn(),
}));
vi.mock('../api/HorometroAPI', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/HorometroAPI')>();
  return {
    ...actual,
    listHorometro: (...args: unknown[]) => listHorometroMock(...args),
    createHorometro: (...args: unknown[]) => createHorometroMock(...args),
    cerrarHorometro: (...args: unknown[]) => cerrarHorometroMock(...args),
  };
});

// La foto del cierre sube por `uploadFile`; el OCR sin mock pegaría a `/api/ocr`.
const { uploadFileMock } = vi.hoisted(() => ({ uploadFileMock: vi.fn() }));
vi.mock('../api/UploadsAPI', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/UploadsAPI')>();
  return { ...actual, uploadFile: uploadFileMock };
});
vi.mock('../api/OcrAPI', () => ({ fuelReadingOcr: vi.fn(async () => ({ value: null })) }));

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

const EQUIPOS = [
  { id: 'e1', internalCode: 'EX-005', type: 'Excavadora', status: 'OPERATIONAL', currentHourmeter: 4218.7 },
  { id: 'e2', internalCode: 'PE-009', type: 'Perforadora', status: 'OPERATIONAL', currentHourmeter: 3120.4 },
  { id: 'e3', internalCode: 'CA-003', type: 'Cargador', status: 'IN_WORKSHOP', currentHourmeter: 880.2 },
  { id: 'e4', internalCode: 'CM-099', type: 'Camión', status: 'OUT_OF_SERVICE', currentHourmeter: 12.0 },
];

/** Lectura ABIERTA de EX-005 en el turno en curso (la fecha es «ahora»). */
const lecturaAbierta = (over: Record<string, unknown> = {}) => ({
  id: 'lect-1',
  equipoId: 'e1',
  operador: 'Patricio Rojas',
  turno: 'DIURNO',
  valorInicial: 4218.7,
  valorFinal: null,
  nivelCombustible: null,
  fotoUrl: null,
  fecha: new Date().toISOString(),
  fechaSalida: null,
  fotoUrlSalida: null,
  equipo: { internalCode: 'EX-005' },
  ...over,
});

/** Lectura CERRADA de EX-005 en el turno en curso. */
const lecturaCerrada = (over: Record<string, unknown> = {}) =>
  lecturaAbierta({ id: 'lect-2', valorFinal: 4300, fechaSalida: new Date().toISOString(), ...over });

function renderView(size: 'phone' | 'desktop' = 'phone', lecturas: ReturnType<typeof lecturaAbierta>[] = []) {
  setViewport(size);
  listHorometroMock.mockResolvedValue(lecturas);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(['equipment'], EQUIPOS);
  qc.setQueryData(['horometro'], lecturas);
  return render(
    <QueryClientProvider client={qc}>
      <RegistroEquipoView />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('RegistroEquipoView', () => {
  /**
   * Misma lógica que el selector de Trabajos extraordinarios (R10): los
   * equipos en uso y los no operativos SE VEN —para que no parezca que
   * desaparecieron— pero no se pueden abrir: uno en uso no sale dos veces y
   * uno en taller o fuera de servicio no está en la faena (R1). A diferencia
   * de Trabajos extra, acá el equipo en uso también queda bloqueado.
   */
  it('muestra los equipos en uso y los no operativos, sin dejar elegirlos', () => {
    renderView('phone', [lecturaAbierta()]);

    fireEvent.click(screen.getByLabelText('Equipo'));
    const lista = within(screen.getByRole('listbox'));

    const enUso = lista.getByRole('option', { name: /EX-005/ });
    expect(enUso.getAttribute('aria-disabled')).toBe('true');
    expect(enUso.textContent).toContain('En uso · Patricio Rojas');

    const enTaller = lista.getByRole('option', { name: /CA-003/ });
    expect(enTaller.getAttribute('aria-disabled')).toBe('true');
    expect(enTaller.textContent).toContain('En taller');

    const fueraDeServicio = lista.getByRole('option', { name: /CM-099/ });
    expect(fueraDeServicio.getAttribute('aria-disabled')).toBe('true');
    expect(fueraDeServicio.textContent).toContain('Fuera de servicio');

    const disponibles = lista.getByRole('group', { name: 'Disponibles' });
    expect(within(disponibles).getByRole('option', { name: /PE-009/ })).toBeTruthy();
  });

  it('propone el último horómetro registrado del equipo', () => {
    renderView();

    expect(screen.getByText(/Último registrado/)).toBeTruthy();
    expect(screen.getByText('4.218,7 h')).toBeTruthy();
  });

  /**
   * Las tarjetas en curso YA NO son datos de ejemplo: salen de las lecturas
   * abiertas del servidor, así cualquier navegador (y el administrador) ve lo
   * mismo. Una lectura abierta en otro turno aparece como arrastrada.
   */
  describe('tarjetas derivadas del servidor', () => {
    it('muestra una tarjeta por cada lectura abierta', () => {
      renderView('desktop', [lecturaAbierta()]);

      // «Patricio Rojas» también está en el selector de operadores: se busca
      // dentro de la fila de la tarjeta, no en toda la pantalla.
      const fila = screen.getByText('EX-005').closest('tr')!;
      expect(within(fila).getByText('Patricio Rojas')).toBeTruthy();
      expect(within(fila).getByText('En curso')).toBeTruthy();
    });

    it('sin lecturas abiertas no hay tarjetas', () => {
      renderView('desktop');

      expect(screen.queryByRole('button', { name: /^Cerrar$/ })).toBeNull();
      expect(screen.getByText('Sin tarjetas abiertas en este turno.')).toBeTruthy();
    });

    it('una lectura abierta en un turno anterior aparece como arrastrada', () => {
      // Abierta hace 24 horas: pertenece a un turno que ya terminó.
      const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      renderView('phone', [lecturaAbierta({ fecha: ayer })]);

      expect(screen.getByText(/Quedó en curso al terminar el turno anterior/)).toBeTruthy();
    });

    /**
     * El historial de cerradas también deriva del servidor: una tarjeta
     * cerrada en otra sesión (u otro navegador) sigue apareciendo, con sus
     * horómetros y hora de salida reales. Los extras que todavía no tienen
     * tabla (litros, foto, observaciones) se muestran vacíos — «—».
     */
    it('una lectura cerrada del servidor aparece en el historial aunque la sesión sea nueva', () => {
      renderView('desktop', [lecturaCerrada()]);

      fireEvent.click(screen.getByRole('button', { name: /historial de cerradas/i }));
      const ventana = within(screen.getByRole('dialog'));
      expect(ventana.getByText('EX-005')).toBeTruthy();
      expect(ventana.getAllByText('Cerrada').length).toBeGreaterThan(0);
    });

    it('una cerrada de un turno más viejo que el anterior no entra al historial', () => {
      const hace3dias = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      renderView('desktop', [lecturaCerrada({ fecha: hace3dias, fechaSalida: hace3dias })]);

      fireEvent.click(screen.getByRole('button', { name: /historial de cerradas/i }));
      const ventana = within(screen.getByRole('dialog'));
      expect(ventana.getByText('Todavía no cerraste ninguna tarjeta.')).toBeTruthy();
    });
  });

  /**
   * Abrir un equipo registra la ENTRADA de horómetro en el servidor; la
   * tarjeta aparece cuando el servidor confirma (es la lectura abierta que
   * enciende «En uso» en Trabajos extraordinarios).
   */
  describe('abrir equipo contra el servidor', () => {
    it('registra la entrada y la tarjeta aparece al confirmarse', async () => {
      createHorometroMock.mockImplementation(async () => {
        const nueva = lecturaAbierta({ id: 'lect-9' });
        listHorometroMock.mockResolvedValue([nueva]);
        return nueva;
      });
      renderView('desktop');

      fireEvent.click(screen.getByRole('button', { name: /Agregar equipo/ }));

      await waitFor(() => expect(createHorometroMock).toHaveBeenCalledTimes(1));
      expect(createHorometroMock.mock.calls[0][0]).toMatchObject({
        equipoId: 'e1',
        operador: 'Sebastián Tapia',
        valorInicial: 4218.7,
      });
      expect(await screen.findByRole('button', { name: /^Cerrar$/ })).toBeTruthy();
    });

    it('si el servidor rechaza la entrada, no queda ninguna tarjeta', async () => {
      createHorometroMock.mockRejectedValue(new Error('El equipo ya tiene un turno abierto'));
      renderView('desktop');

      fireEvent.click(screen.getByRole('button', { name: /Agregar equipo/ }));

      await waitFor(() => expect(createHorometroMock).toHaveBeenCalledTimes(1));
      expect(screen.queryByRole('button', { name: /^Cerrar$/ })).toBeNull();
    });
  });

  /**
   * La foto del totalizador es obligatoria: es el respaldo de la carga y el
   * cliente la pidió explícitamente. El botón queda deshabilitado hasta que
   * exista, y la pantalla dice por qué — un botón apagado sin explicación deja
   * al supervisor sin saber qué le falta.
   */
  it('no deja cerrar una tarjeta sin la foto del surtidor', () => {
    renderView('desktop', [lecturaAbierta()]);

    fireEvent.click(screen.getByRole('button', { name: /^Cerrar$/ }));

    const cerrar = screen.getByRole('button', { name: /Cerrar tarjeta/ });
    expect(cerrar.hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('Falta la foto del surtidor para cerrar.')).toBeTruthy();
  });

  /**
   * La captura en sí —cámara, OCR de los litros, frescura por EXIF y subida a
   * R2— es el flujo compartido de Flota (`usePhotoCaptureFlow` +
   * `FotoRespaldoField`), y tiene sus propios tests ahí. Acá solo se verifica
   * que esta vista lo está usando y no una versión propia.
   */
  it('usa el campo de foto compartido de Flota, no uno propio', () => {
    renderView('desktop', [lecturaAbierta()]);

    fireEvent.click(screen.getByRole('button', { name: /^Cerrar$/ }));

    expect(screen.getByText(/Foto de respaldo/)).toBeTruthy();
    expect(screen.getByText(/sin la mano sobre el vidrio/)).toBeTruthy();
  });

  /**
   * Acta N.° 004, R12: el cierre pregunta si se cargó AdBlue. El caso común
   * es que no —de lunes a viernes lo cargan los mantenedores—, así que los
   * litros solo se piden al marcar que sí, y entonces son obligatorios.
   */
  describe('AdBlue en el cierre', () => {
    const abrirCierre = () => {
      renderView('desktop', [lecturaAbierta()]);
      fireEvent.click(screen.getByRole('button', { name: /^Cerrar$/ }));
    };

    it('arranca en «No» y no pide litros', () => {
      abrirCierre();

      const grupo = within(screen.getByRole('group', { name: '¿Se cargó AdBlue?' }));
      expect(grupo.getByRole('button', { name: 'No' }).getAttribute('aria-pressed')).toBe('true');
      expect(screen.queryByLabelText(/AdBlue cargado/)).toBeNull();
    });

    it('al marcar «Sí» pide los litros y no deja cerrar sin ellos', () => {
      abrirCierre();

      const grupo = within(screen.getByRole('group', { name: '¿Se cargó AdBlue?' }));
      fireEvent.click(grupo.getByRole('button', { name: 'Sí' }));

      expect(screen.getByLabelText(/AdBlue cargado/)).toBeTruthy();
      expect(screen.getByText('Indicá cuántos litros de AdBlue se cargaron.')).toBeTruthy();
      expect(screen.getByRole('button', { name: /Cerrar tarjeta/ }).hasAttribute('disabled')).toBe(true);
    });

    it('avisa si los litros superan el estanque de 30 L', () => {
      abrirCierre();

      fireEvent.click(within(screen.getByRole('group', { name: '¿Se cargó AdBlue?' })).getByRole('button', { name: 'Sí' }));
      fireEvent.change(screen.getByLabelText(/AdBlue cargado/), { target: { value: '45' } });

      expect(screen.getByText(/más de lo que cabe en un estanque de 30 L/)).toBeTruthy();
      expect(screen.queryByText('Indicá cuántos litros de AdBlue se cargaron.')).toBeNull();
    });
  });

  /** El horómetro final no puede ser menor que el inicial. */
  it('avisa si el horómetro final es menor que el inicial', () => {
    renderView('desktop', [lecturaAbierta()]);

    fireEvent.click(screen.getByRole('button', { name: /^Cerrar$/ }));
    fireEvent.change(screen.getByLabelText(/Horómetro final/), { target: { value: '1' } });

    expect(screen.getByText('No puede ser menor que el horómetro inicial.')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Cerrar tarjeta/ }).hasAttribute('disabled')).toBe(true);
  });

  /**
   * El paso que resuelve el problema del cliente: hoy la administración se
   * entera por WhatsApp y tarde. El reporte tiene que ser visible y decir que
   * todavía no se envió.
   */
  it('muestra el reporte de salida como pendiente hasta que se envía', () => {
    renderView('desktop', [lecturaAbierta()]);

    expect(screen.getByText('Sin enviar')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Enviar reporte de salida/ }));
    fireEvent.click(screen.getByRole('button', { name: /Enviar ahora/ }));

    expect(screen.getByText('Enviado')).toBeTruthy();
    expect(screen.queryByText('Sin enviar')).toBeNull();
  });
  /**
   * El turno, el día y la hora son lo primero de la pantalla. Antes eran tres
   * renglones chicos al fondo del formulario, con la fecha escrita a mano
   * ('24/09/2026 08:35'), así que a las 20:01 seguía diciendo DIURNO.
   */
  describe('cabecera de turno', () => {
    afterEach(() => vi.useRealTimers());

    const conReloj = (fecha: Date) => {
      vi.useFakeTimers();
      vi.setSystemTime(fecha);
      renderView('desktop');
    };

    it('a media tarde anuncia el turno diurno del día del reloj', () => {
      conReloj(new Date(2026, 8, 24, 14, 30));

      expect(screen.getByRole('region', { name: 'Turno DIURNO' })).toBeTruthy();
      expect(screen.getByText('TURNO DIURNO')).toBeTruthy();
    });

    it('pasadas las 20:00 ya es nocturno, sin recargar nada', () => {
      conReloj(new Date(2026, 8, 24, 20, 1));

      expect(screen.getByText('TURNO NOCTURNO')).toBeTruthy();
    });

    /** De madrugada el turno es el que arrancó AYER — ver . */
    it('de madrugada sigue en el nocturno del día anterior', () => {
      conReloj(new Date(2026, 8, 24, 2, 14));

      // La cabecera anuncia el turno del día ANTERIOR (23/09/2026, miércoles),
      // no el del reloj.
      const cabecera = screen.getByRole('region', { name: 'Turno NOCTURNO' });
      expect(within(cabecera).getByText(/mié 23-09/)).toBeTruthy();
      // …y el sello del registro sigue siendo la hora real.
      expect(within(cabecera).getByText(/02:14/)).toBeTruthy();
    });

    it('firma el registro con el usuario de la sesión', () => {
      renderView('desktop');

      expect(screen.getByText(/Supervisor:/)).toBeTruthy();
    });
  });

  /**
   * Cerrar registra la SALIDA en el servidor (apaga «En uso» en Trabajos
   * extraordinarios) y la tarjeta pasa al historial de cerradas, desde donde
   * se corrige sin autorización pero avisando al administrador (Acta N.° 004,
   * R13). Guardar sin tocar nada no es un cambio.
   */
  describe('cerrar una tarjeta y corregirla (R13)', () => {
    /** Cierra la única tarjeta abierta (EX-005) con final, litros y foto. */
    const cerrarTarjeta = async () => {
      cerrarHorometroMock.mockResolvedValue({});
      uploadFileMock.mockResolvedValue({ key: 'tmp/u1/foto.jpg', url: 'https://firmada' });
      renderView('desktop', [lecturaAbierta()]);

      fireEvent.click(screen.getByRole('button', { name: /^Cerrar$/ }));
      fireEvent.change(screen.getByLabelText(/Horómetro final/), { target: { value: '4.300' } });
      fireEvent.change(screen.getByLabelText(/Combustible cargado/), { target: { value: '120' } });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(fileInput, { target: { files: [new File(['x'], 'surtidor.jpg', { type: 'image/jpeg' })] } });
      await waitFor(() =>
        expect(screen.getByRole('button', { name: /Cerrar tarjeta/ }).hasAttribute('disabled')).toBe(false),
      );
      fireEvent.click(screen.getByRole('button', { name: /Cerrar tarjeta/ }));
      await waitFor(() => expect(cerrarHorometroMock).toHaveBeenCalledTimes(1));
    };

    /** Cierra y abre el detalle de la cerrada en el historial. */
    const abrirCerrada = async () => {
      await cerrarTarjeta();
      fireEvent.click(screen.getByRole('button', { name: /historial de cerradas/i }));
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Ver detalle/ }));
      return () => within(screen.getByRole('dialog'));
    };

    it('registra la salida y pasa la tarjeta al historial de cerradas', async () => {
      await cerrarTarjeta();

      expect(cerrarHorometroMock.mock.calls[0]).toEqual(['lect-1', { valorFinal: 4300 }]);
      // Ya no hay abiertas a la vista…
      expect(screen.queryByRole('button', { name: /^Cerrar$/ })).toBeNull();

      // …y la cerrada vive detrás del historial, que es una ventana aparte.
      fireEvent.click(screen.getByRole('button', { name: /historial de cerradas/i }));
      const ventana = within(screen.getByRole('dialog'));
      expect(ventana.getAllByText('Cerrada').length).toBeGreaterThan(0);
      expect(ventana.getByText('EX-005')).toBeTruthy();
    });

    it('si el servidor rechaza la salida, la tarjeta sigue abierta', async () => {
      cerrarHorometroMock.mockRejectedValue(new Error('El registro ya está cerrado'));
      uploadFileMock.mockResolvedValue({ key: 'tmp/u1/foto.jpg', url: 'https://firmada' });
      renderView('desktop', [lecturaAbierta()]);

      fireEvent.click(screen.getByRole('button', { name: /^Cerrar$/ }));
      fireEvent.change(screen.getByLabelText(/Horómetro final/), { target: { value: '4.300' } });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(fileInput, { target: { files: [new File(['x'], 'surtidor.jpg', { type: 'image/jpeg' })] } });
      await waitFor(() =>
        expect(screen.getByRole('button', { name: /Cerrar tarjeta/ }).hasAttribute('disabled')).toBe(false),
      );
      fireEvent.click(screen.getByRole('button', { name: /Cerrar tarjeta/ }));

      await waitFor(() => expect(cerrarHorometroMock).toHaveBeenCalledTimes(1));
      expect(screen.getByRole('button', { name: /^Cerrar$/ })).toBeTruthy();
    });

    it('guarda la corrección, avisa y la suma al historial', async () => {
      const ventana = await abrirCerrada();
      fireEvent.click(ventana().getByRole('button', { name: /Editar/ }));

      expect(ventana().getByText(/Al guardar se avisa al administrador/)).toBeTruthy();
      fireEvent.change(ventana().getByLabelText(/Horómetro final/), { target: { value: '4.320' } });
      fireEvent.click(ventana().getByRole('button', { name: /Guardar cambios/ }));

      expect(ventana().getByText(/Cambio guardado. Se avisó al administrador./)).toBeTruthy();
      expect(ventana().getByText('Historial de cambios').parentElement?.textContent).toContain('1 cambio');
      expect(ventana().getByText('4.320,0 h')).toBeTruthy();
    });

    it('no deja guardar un final menor que el inicial', async () => {
      const ventana = await abrirCerrada();
      fireEvent.click(ventana().getByRole('button', { name: /Editar/ }));
      fireEvent.change(ventana().getByLabelText(/Horómetro final/), { target: { value: '1' } });

      expect(ventana().getByRole('button', { name: /Guardar cambios/ }).hasAttribute('disabled')).toBe(true);
      expect(ventana().getByText('El horómetro final no puede ser menor que el inicial.')).toBeTruthy();
    });

    it('guardar sin cambiar nada no agrega un cambio', async () => {
      const ventana = await abrirCerrada();
      fireEvent.click(ventana().getByRole('button', { name: /Editar/ }));
      fireEvent.click(ventana().getByRole('button', { name: /Guardar cambios/ }));

      expect(ventana().queryByText(/Cambio guardado/)).toBeNull();
    });
  });
});
