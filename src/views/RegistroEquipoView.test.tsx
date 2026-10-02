import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, within, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { RegistroEquipoView } from './RegistroEquipoView';

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

function renderView(size: 'phone' | 'desktop' = 'phone') {
  setViewport(size);
  const qc = new QueryClient();
  qc.setQueryData(['equipment'], EQUIPOS);
  return render(
    <QueryClientProvider client={qc}>
      <RegistroEquipoView />
    </QueryClientProvider>,
  );
}

afterEach(cleanup);

describe('RegistroEquipoView', () => {
  /**
   * R1 de la especificación: una unidad en taller o fuera de servicio no puede
   * salir a turno, así que no aparece en el selector. Si apareciera, el
   * supervisor podría abrirle turno a una máquina que no está en la faena.
   */
  it('solo ofrece equipos operativos', () => {
    renderView();

    fireEvent.click(screen.getByLabelText('Equipo'));

    const lista = within(screen.getByRole('listbox'));
    expect(lista.getByRole('option', { name: /EX-005/ })).toBeTruthy();
    expect(lista.getByRole('option', { name: /PE-009/ })).toBeTruthy();
    expect(lista.queryByRole('option', { name: /CA-003/ })).toBeNull();
    expect(lista.queryByRole('option', { name: /CM-099/ })).toBeNull();
  });

  it('propone el último horómetro registrado del equipo', () => {
    renderView();

    expect(screen.getByText(/Último registrado/)).toBeTruthy();
    expect(screen.getByText('4.218,7 h')).toBeTruthy();
  });

  /**
   * La foto del totalizador es obligatoria: es el respaldo de la carga y el
   * cliente la pidió explícitamente. El botón queda deshabilitado hasta que
   * exista, y la pantalla dice por qué — un botón apagado sin explicación deja
   * al supervisor sin saber qué le falta.
   */
  it('no deja cerrar una tarjeta sin la foto del surtidor', () => {
    renderView('desktop');

    fireEvent.click(screen.getAllByRole('button', { name: /^Cerrar$/ })[0]);

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
    renderView('desktop');

    fireEvent.click(screen.getAllByRole('button', { name: /^Cerrar$/ })[0]);

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
      renderView('desktop');
      fireEvent.click(screen.getAllByRole('button', { name: /^Cerrar$/ })[0]);
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
    renderView('desktop');

    fireEvent.click(screen.getAllByRole('button', { name: /^Cerrar$/ })[0]);
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
    renderView('desktop');

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
   * R4: el supervisor trabaja sobre lo suyo y sobre lo que sigue abierto. Las
   * tarjetas de otros supervisores no puede cerrarlas, y las cerradas ya no
   * piden nada — al final del turno son todas, y taparían lo único accionable.
   */
  describe('qué tarjetas ve el supervisor', () => {
    it('no lista las tarjetas de otro supervisor', () => {
      renderView('desktop');

      // CM-021 y CM-015 (cerrada) son de Marcela Pizarro en los datos de ejemplo.
      expect(screen.queryByText('CM-021')).toBeNull();
    });

    it('deja las cerradas fuera de la lista, detrás del historial', () => {
      renderView('desktop');

      // CA-011 cerrada del turno anterior: no está a la vista…
      expect(screen.queryByText('Cerrada')).toBeNull();

      // …hasta que se abre el historial, que es una ventana aparte.
      fireEvent.click(screen.getByRole('button', { name: /historial de cerradas/i }));
      const ventana = within(screen.getByRole('dialog'));
      expect(ventana.getAllByText('Cerrada').length).toBeGreaterThan(0);
    });

    /** Igual que en Reporte diario: la lista y el detalle viven en la misma ventana. */
    it('abre el detalle de una cerrada, con sus observaciones, y vuelve a la lista', () => {
      renderView('desktop');

      fireEvent.click(screen.getByRole('button', { name: /historial de cerradas/i }));
      fireEvent.click(screen.getAllByRole('button', { name: /Ver detalle/ })[0]);

      const ventana = within(screen.getByRole('dialog'));
      expect(ventana.getByRole('heading', { name: 'CA-011 · Cargador' })).toBeTruthy();
      expect(ventana.getByText('Jorge Pizarro')).toBeTruthy();
      expect(ventana.getByText(/Revisar pasadores/)).toBeTruthy();
      expect(ventana.getByText('AdBlue').parentElement?.textContent).toContain('12 L');

      fireEvent.click(ventana.getByText('Volver al historial'));
      expect(within(screen.getByRole('dialog')).getAllByRole('button', { name: /Ver detalle/ }).length).toBe(2);
    });
  });

  /**
   * Acta N.° 004, R13: una tarjeta cerrada se corrige desde el historial, sin
   * autorización pero avisando al administrador, y el detalle guarda quién
   * cambió qué. Guardar sin tocar nada no es un cambio.
   */
  describe('editar una tarjeta cerrada', () => {
    const abrirCerrada = () => {
      renderView('desktop');
      fireEvent.click(screen.getByRole('button', { name: /historial de cerradas/i }));
      fireEvent.click(screen.getAllByRole('button', { name: /Ver detalle/ })[0]);
      return () => within(screen.getByRole('dialog'));
    };

    it('muestra los cambios anteriores en el detalle', () => {
      const ventana = abrirCerrada();

      expect(ventana().getByText('Historial de cambios')).toBeTruthy();
      expect(ventana().getByText('José Pérez')).toBeTruthy();
    });

    it('guarda la corrección, avisa y la suma al historial', () => {
      const ventana = abrirCerrada();
      fireEvent.click(ventana().getByRole('button', { name: /Editar/ }));

      expect(ventana().getByText(/Al guardar se avisa al administrador/)).toBeTruthy();
      fireEvent.change(ventana().getByLabelText(/Horómetro final/), { target: { value: '12.490,0' } });
      fireEvent.click(ventana().getByRole('button', { name: /Guardar cambios/ }));

      expect(ventana().getByText(/Cambio guardado. Se avisó al administrador./)).toBeTruthy();
      expect(ventana().getByText('Historial de cambios').parentElement?.textContent).toContain('2 cambios');
      expect(ventana().getByText('12.490,0 h')).toBeTruthy();
    });

    it('no deja guardar un final menor que el inicial', () => {
      const ventana = abrirCerrada();
      fireEvent.click(ventana().getByRole('button', { name: /Editar/ }));
      fireEvent.change(ventana().getByLabelText(/Horómetro final/), { target: { value: '1' } });

      expect(ventana().getByRole('button', { name: /Guardar cambios/ }).hasAttribute('disabled')).toBe(true);
      expect(ventana().getByText('El horómetro final no puede ser menor que el inicial.')).toBeTruthy();
    });

    it('guardar sin cambiar nada no agrega un cambio', () => {
      const ventana = abrirCerrada();
      fireEvent.click(ventana().getByRole('button', { name: /Editar/ }));
      fireEvent.click(ventana().getByRole('button', { name: /Guardar cambios/ }));

      expect(ventana().queryByText(/Cambio guardado/)).toBeNull();
      expect(ventana().getByText('Historial de cambios').parentElement?.textContent).toContain('1 cambio');
    });
  });
});
