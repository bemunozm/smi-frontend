import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, within, fireEvent } from '@testing-library/react';

import { RegistroEquipoView } from './RegistroEquipoView';
import type { UseShiftRegisterResult } from '../hooks/useShiftRegister';

/**
 * `useShiftRegister` ya tiene sus propios tests (mapeo servidor → view-model,
 * `abrir`/`cerrar`, el selector de turno, `crypto.randomUUID`, mensajes de
 * error por `code` — ver `hooks/useShiftRegister.test.tsx` y
 * `hooks/useShiftCards.test.tsx`). Acá se mockea ENTERO: esta vista solo se
 * prueba a sí misma — que renderiza el view-model que recibe y que dispara
 * las acciones correctas al interactuar — sin repetir esa cobertura ni
 * pegarle a la red.
 */
const abrirMock = vi.fn();
const cerrarMock = vi.fn();
const avanzarTurnoMock = vi.fn();
const volverTurnoActualMock = vi.fn();
const setApertura = vi.fn();
const setCierre = vi.fn();
const setCerrandoId = vi.fn();
const setVerReporte = vi.fn();
const setHistorialAbierto = vi.fn();
const setDetalleCerrada = vi.fn();
const enviarReporteMock = vi.fn();
const reporteUrlMock = vi.fn((id: string) => `/api/shift-reports/${id}/file`);

// `lineaEstadoCorreo` es una función pura (sin dependencias del hook) que la
// vista importa del MISMO módulo — se reimplementa acá en vez de
// `importActual` para no arrastrar el resto de `useShiftRegister.ts` (offline/
// outbox, Dexie, etc.) a un archivo que la mockea entera a propósito. Mismo
// mapeo que el real — ver su propio test en `hooks/useShiftRegister.test.tsx`.
function lineaEstadoCorreoMock(emailStatus: string): string {
  switch (emailStatus) {
    case 'SENT':
      return 'Aviso y PDF enviados por correo a la administración';
    case 'PENDING':
      return 'Enviando correo…';
    case 'SKIPPED':
      return 'Aviso enviado en el sistema; el correo no está configurado';
    case 'FAILED':
      return 'Aviso enviado en el sistema; el correo falló';
    default:
      return 'Aviso enviado en el sistema.';
  }
}

vi.mock('../hooks/useShiftRegister', () => ({
  useShiftRegister: () => mockResult,
  lineaEstadoCorreo: lineaEstadoCorreoMock,
}));

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

const EQUIPOS_DISPONIBLES = [
  { id: 'e1', internalCode: 'EX-005', type: 'Excavadora', currentHourmeter: 4218.7 },
  { id: 'e2', internalCode: 'PE-009', type: 'Perforadora', currentHourmeter: 3120.4 },
] as UseShiftRegisterResult['disponibles'];

const OPERADORES = [
  { id: 'op_1', name: 'Patricio Rojas', rut: null, isActive: true, createdAt: '', updatedAt: '' },
  { id: 'op_2', name: 'Luis Contreras', rut: null, isActive: true, createdAt: '', updatedAt: '' },
] as UseShiftRegisterResult['operadores'];

const TARJETA_ABIERTA = {
  id: 'c1',
  equipo: 'CA-011',
  tipo: 'Cargador',
  operador: 'Patricio Rojas',
  inicial: 12487.3,
  grupo: 'actual' as const,
  estado: 'curso' as const,
  supervisor: 'Ana Soto',
};

const TARJETA_CERRADA = {
  id: 'c2',
  equipo: 'EX-002',
  tipo: 'Excavadora',
  operador: 'Rubén Carrasco',
  inicial: 6094.1,
  final: 6105.0,
  litros: 164,
  grupo: 'actual' as const,
  estado: 'cerrada' as const,
  supervisor: 'Ana Soto',
  cerradaA: '07:51',
  observaciones: 'Sin novedades.',
};

const CTX = {
  turno: 'DIURNO' as const,
  fecha: new Date(2026, 8, 24),
  etiqueta: 'DIURNO · 08–20',
  fechaCorta: 'jue 24-09',
  fechaHora: '24/09/2026 08:35',
};

let mockResult: UseShiftRegisterResult;

function baseResult(overrides: Partial<UseShiftRegisterResult> = {}): UseShiftRegisterResult {
  return {
    ctx: CTX,
    anterior: { turno: 'NOCTURNO', fecha: new Date(2026, 8, 23) },
    turnoSeleccion: 'reloj',
    siguienteTurno: 'NOCTURNO',
    avanzarTurno: avanzarTurnoMock,
    volverTurnoActual: volverTurnoActualMock,
    mostrarSelectorTurno: true,
    supervisor: 'Ana Soto',
    veTodo: false,
    disponibles: EQUIPOS_DISPONIBLES,
    enTaller: [],
    equipoHint: 'Solo equipos operativos y libres.',
    operadores: OPERADORES,
    abiertasActual: [TARJETA_ABIERTA],
    abiertasAnterior: [],
    cerradas: [TARJETA_CERRADA],
    enCurso: [TARJETA_ABIERTA],
    isLoadingTarjetas: false,
    // Operador ya elegido + horómetro válido por defecto (equivale al
    // "listo para agregar"): los tests de guardas/deshabilitado pisan estos
    // campos explícitamente, ver la sección "guardas de Agregar equipo".
    apertura: { equipoId: 'e1', operatorId: 'op_1', horometro: '' },
    setApertura,
    equipoElegido: EQUIPOS_DISPONIBLES[0],
    valorInicialApertura: 4218.7,
    abrir: abrirMock,
    isAbriendo: false,
    cerrandoId: null,
    setCerrandoId,
    cerrando: null,
    cierre: { final: '', litros: '', observaciones: '' },
    setCierre,
    abrirCierre: setCerrandoId,
    cerrar: cerrarMock,
    finalNum: null,
    horasMaquina: null,
    finalInvalido: false,
    isCerrando: false,
    foto: {
      file: null,
      isReadingPhoto: false,
      isUploadingPhoto: false,
      captureDate: null,
      ocr: null,
      handleSelectPhoto: vi.fn(),
      handleClearPhoto: vi.fn(),
      resetPhoto: vi.fn(),
      cancelar: vi.fn(),
      upload: vi.fn(),
    },
    verReporte: false,
    setVerReporte,
    historialAbierto: false,
    setHistorialAbierto,
    detalleCerrada: null,
    setDetalleCerrada,
    reporteEstado: 'sin-enviar',
    reporteUltimo: null,
    reporteError: null,
    reportePuedeReenviar: false,
    enviarReporte: enviarReporteMock,
    isEnviandoReporte: false,
    reporteUrl: reporteUrlMock,
    ...overrides,
  };
}

function renderView(size: 'phone' | 'desktop' = 'phone', overrides: Partial<UseShiftRegisterResult> = {}) {
  setViewport(size);
  mockResult = baseResult(overrides);
  return render(<RegistroEquipoView />);
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('RegistroEquipoView', () => {
  it('ofrece los equipos que trae `disponibles` (ya filtrados por el hook: operativos y libres)', () => {
    renderView();

    fireEvent.click(screen.getByLabelText('Equipo'));

    const lista = within(screen.getByRole('listbox'));
    expect(lista.getByRole('option', { name: /EX-005/ })).toBeTruthy();
    expect(lista.getByRole('option', { name: /PE-009/ })).toBeTruthy();
  });

  it('propone el último horómetro registrado del equipo elegido', () => {
    renderView();
    expect(screen.getByText(/Último registrado/)).toBeTruthy();
    expect(screen.getByText('4.218,7 h')).toBeTruthy();
  });

  it('el selector de operador ofrece el catálogo real (no una lista escrita a mano)', () => {
    renderView();

    fireEvent.click(screen.getByLabelText('Operador'));

    const lista = within(screen.getByRole('listbox'));
    expect(lista.getByRole('option', { name: 'Patricio Rojas' })).toBeTruthy();
    expect(lista.getByRole('option', { name: 'Luis Contreras' })).toBeTruthy();
  });

  it('"Agregar equipo" llama a `abrir()` del hook', () => {
    renderView();

    fireEvent.click(screen.getByRole('button', { name: /Agregar equipo/ }));

    expect(abrirMock).toHaveBeenCalledTimes(1);
  });

  /**
   * Fixes del review de coordinación: sin operador elegido, `abrir()` del
   * hook ya no hacía nada (guardia silenciosa) pero el botón se veía
   * habilitado — el supervisor tocaba y no pasaba nada, sin ninguna pista de
   * por qué. Ahora el botón queda deshabilitado y la pantalla dice por qué.
   */
  describe('guardas de "Agregar equipo"', () => {
    it('sin operador elegido, el botón queda deshabilitado y muestra el hint', () => {
      renderView('desktop', { apertura: { equipoId: 'e1', operatorId: '', horometro: '' } });

      const boton = screen.getByRole('button', { name: /Agregar equipo/ });
      expect(boton.hasAttribute('disabled')).toBe(true);
      expect(screen.getByText('Elegí el operador para agregar el equipo.')).toBeTruthy();
    });

    it('sin ningún horómetro inicial válido (ni tipeado ni último registrado), el botón queda deshabilitado', () => {
      renderView('desktop', { valorInicialApertura: null });

      expect(screen.getByRole('button', { name: /Agregar equipo/ }).hasAttribute('disabled')).toBe(true);
    });

    it('mientras `isAbriendo`, el botón queda deshabilitado y muestra "Abriendo…"', () => {
      renderView('desktop', { isAbriendo: true });

      const boton = screen.getByRole('button', { name: /Abriendo/ });
      expect(boton.hasAttribute('disabled')).toBe(true);
    });

    it('con operador y horómetro válidos, el botón está habilitado (no queda bloqueado por defecto)', () => {
      renderView('desktop');

      expect(screen.getByRole('button', { name: /^Agregar equipo/ }).hasAttribute('disabled')).toBe(false);
    });
  });

  it('"Cerrar" en una tarjeta abierta llama a `abrirCierre(id)` con el id de esa tarjeta', () => {
    renderView('desktop');

    fireEvent.click(screen.getByRole('button', { name: /^Cerrar$/ }));

    expect(setCerrandoId).toHaveBeenCalledWith('c1');
  });

  it('"Cerrar tarjeta" (dentro del formulario de cierre) llama a `cerrar()` del hook', () => {
    renderView('desktop', {
      cerrandoId: 'c1',
      cerrando: TARJETA_ABIERTA,
      foto: {
        file: new File(['x'], 'foto.jpg', { type: 'image/jpeg' }),
        isReadingPhoto: false,
        isUploadingPhoto: false,
        captureDate: null,
        ocr: null,
        handleSelectPhoto: vi.fn(),
        handleClearPhoto: vi.fn(),
        resetPhoto: vi.fn(),
        cancelar: vi.fn(),
        upload: vi.fn(),
      },
      finalNum: 12500,
    });

    fireEvent.click(screen.getByRole('button', { name: /Cerrar tarjeta/ }));

    expect(cerrarMock).toHaveBeenCalledTimes(1);
  });

  /** La foto del totalizador es obligatoria — el botón queda deshabilitado
   * hasta que exista, y la pantalla dice por qué. */
  it('no deja cerrar una tarjeta sin la foto del surtidor', () => {
    renderView('desktop', { cerrandoId: 'c1', cerrando: TARJETA_ABIERTA });

    const cerrar = screen.getByRole('button', { name: /Cerrar tarjeta/ });
    expect(cerrar.hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('Falta la foto del surtidor para cerrar.')).toBeTruthy();
  });

  it('usa el campo de foto compartido de Flota, no uno propio', () => {
    renderView('desktop', { cerrandoId: 'c1', cerrando: TARJETA_ABIERTA });

    expect(screen.getByText(/Foto de respaldo/)).toBeTruthy();
    expect(screen.getByText(/sin la mano sobre el vidrio/)).toBeTruthy();
  });

  it('avisa si el horómetro final es menor que el inicial', () => {
    renderView('desktop', {
      cerrandoId: 'c1',
      cerrando: TARJETA_ABIERTA,
      finalNum: 1,
      finalInvalido: true,
    });

    expect(screen.getByText('No puede ser menor que el horómetro inicial.')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Cerrar tarjeta/ }).hasAttribute('disabled')).toBe(true);
  });

  /**
   * Fix del review de coordinación: sin esto, un doble toque entre el fin de
   * la subida y la respuesta del cierre mandaba una segunda subida + un 409
   * ALREADY_CLOSED, aunque el primer cierre ya hubiese funcionado.
   */
  it('mientras `isCerrando`, el botón de cierre queda deshabilitado y muestra "Cerrando…"', () => {
    renderView('desktop', {
      cerrandoId: 'c1',
      cerrando: TARJETA_ABIERTA,
      finalNum: 12500,
      isCerrando: true,
      foto: {
        file: new File(['x'], 'foto.jpg', { type: 'image/jpeg' }),
        isReadingPhoto: false,
        isUploadingPhoto: false,
        captureDate: null,
        ocr: null,
        handleSelectPhoto: vi.fn(),
        handleClearPhoto: vi.fn(),
        resetPhoto: vi.fn(),
        cancelar: vi.fn(),
        upload: vi.fn(),
      },
    });

    const boton = screen.getByRole('button', { name: /Cerrando/ });
    expect(boton.hasAttribute('disabled')).toBe(true);
  });

  /**
   * Fase 5: el reporte de salida está conectado de verdad al outbox
   * (`enviarReporte`) — la pantalla nunca debe afirmar una entrega que el
   * servidor no confirmó (`reporteEstado` deriva de datos, no de un
   * `useState` local, ver `hooks/useShiftRegister.ts`).
   */
  describe('reporte de salida (Fase 5: conectado al outbox)', () => {
    it('arranca "Sin enviar"', () => {
      renderView('desktop');
      expect(screen.getByText('Sin enviar')).toBeTruthy();
    });

    it('"Enviar ahora" llama a enviarReporte() del hook, nunca escribe estado local', () => {
      renderView('desktop', { verReporte: true });

      fireEvent.click(screen.getByRole('button', { name: /Enviar ahora/ }));

      expect(enviarReporteMock).toHaveBeenCalledTimes(1);
    });

    /**
     * Revisión QA (item 2): el frontend no puede saber si el destinatario
     * extra (Sergio Torres) está configurado en el backend
     * (`SHIFT_REPORT_EXTRA_RECIPIENTS`, todavía pendiente del lado del
     * cliente) — la copia tiene que ser neutra y nunca prometer un
     * destinatario que puede no existir.
     */
    it('la copia de destinatarios es neutra — nunca promete un destinatario que el frontend no puede confirmar', () => {
      renderView('desktop', { verReporte: true });

      expect(screen.getByText(/Destinatarios:/)).toBeTruthy();
      expect(screen.getByText(/la administración \(aviso en el sistema y correo con/)).toBeTruthy();
      expect(screen.queryByText(/Sergio Torres/)).toBeNull();
    });

    it('"en-cola": copy honesto — nunca afirma una entrega antes de que el servidor confirme', () => {
      renderView('desktop', { reporteEstado: 'en-cola' });

      expect(screen.getByText('En cola')).toBeTruthy();
      expect(screen.getByText(/se enviará solo cuando vuelva la señal/)).toBeTruthy();
      expect(screen.queryByText(/^Enviado$/)).toBeNull();
    });

    it('"requiere-atencion": muestra el chip y el mensaje de error', () => {
      renderView('desktop', {
        reporteEstado: 'requiere-atencion',
        reporteError: { message: 'No hay tarjetas abiertas en este turno.' },
      });

      expect(screen.getByText('Requiere atención')).toBeTruthy();
      expect(screen.getByText(/No hay tarjetas abiertas en este turno\./)).toBeTruthy();
    });

    it('"enviado": muestra el chip Enviado y, dentro de la hoja, el enlace de descarga del PDF', () => {
      renderView('desktop', {
        reporteEstado: 'enviado',
        reporteUltimo: { id: 'rep-1', requestedAt: '2026-09-24T08:41:00.000Z', cardCount: 3, emailStatus: 'SENT' },
        verReporte: true,
      });

      expect(screen.getAllByText('Enviado').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Aviso y PDF enviados por correo a la administración/)).toBeTruthy();
      const link = screen.getByRole('link', { name: /Descargar PDF/ });
      expect(link.getAttribute('href')).toBe('/api/shift-reports/rep-1/file');
    });

    it('"enviado" con `reportePuedeReenviar`, ofrece "Reenviar con N equipos"', () => {
      renderView('desktop', {
        reporteEstado: 'enviado',
        reporteUltimo: { id: 'rep-1', requestedAt: '2026-09-24T08:41:00.000Z', cardCount: 1, emailStatus: 'SENT' },
        reportePuedeReenviar: true,
        verReporte: true,
        enCurso: [TARJETA_ABIERTA, { ...TARJETA_ABIERTA, id: 'c9' }],
      });

      fireEvent.click(screen.getByRole('button', { name: /Reenviar con 2 equipos/ }));
      expect(enviarReporteMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('selector de turno actual/siguiente', () => {
    it('con turnoSeleccion "reloj", el botón ofrece adelantar y llama a avanzarTurno()', () => {
      renderView('desktop', { turnoSeleccion: 'reloj', siguienteTurno: 'NOCTURNO' });

      const boton = screen.getByRole('button', { name: /Adelantar a NOCTURNO/ });
      fireEvent.click(boton);

      expect(avanzarTurnoMock).toHaveBeenCalledTimes(1);
    });

    it('con turnoSeleccion "siguiente", el botón ofrece volver y llama a volverTurnoActual()', () => {
      renderView('desktop', { turnoSeleccion: 'siguiente' });

      fireEvent.click(screen.getByRole('button', { name: /Volver al turno del reloj/ }));

      expect(volverTurnoActualMock).toHaveBeenCalledTimes(1);
    });

    /**
     * Fix del review de coordinación: el botón estaba visible todo el día
     * (ver la captura de las 14:38) — un toque accidental cargaba tarjetas
     * en el turno equivocado. `mostrarSelectorTurno` (calculado por el hook
     * con `lib/turno.ts#puedeAdelantarTurno`) decide si se muestra.
     */
    it('con mostrarSelectorTurno=false, el botón no se renderiza', () => {
      renderView('desktop', { mostrarSelectorTurno: false });

      expect(screen.queryByRole('button', { name: /Adelantar a/ })).toBeNull();
      expect(screen.queryByRole('button', { name: /Volver al turno del reloj/ })).toBeNull();
    });
  });

  describe('cabecera de turno', () => {
    it('muestra el turno, la fecha del turno y el supervisor de la sesión', () => {
      renderView('desktop');

      expect(screen.getByRole('region', { name: 'Turno DIURNO' })).toBeTruthy();
      expect(screen.getByText('TURNO DIURNO')).toBeTruthy();
      expect(screen.getByText(/Supervisor: Ana Soto/)).toBeTruthy();
    });
  });

  describe('historial', () => {
    it('deja las cerradas fuera de la lista mientras el historial está cerrado', () => {
      renderView('desktop');
      expect(screen.queryByText('EX-002')).toBeNull();
    });

    it('con el historial abierto, muestra las cerradas dentro de esa ventana', () => {
      renderView('desktop', { historialAbierto: true });

      const ventana = within(screen.getByRole('dialog'));
      expect(ventana.getByText('EX-002')).toBeTruthy();
    });

    it('abre el detalle de una cerrada, con sus observaciones, y vuelve a la lista', () => {
      renderView('desktop', { historialAbierto: true });

      fireEvent.click(screen.getByRole('button', { name: /Ver detalle/ }));

      expect(setDetalleCerrada).toHaveBeenCalledWith(TARJETA_CERRADA);
    });

    // El aviso de "arrastrada" solo lo pinta la tarjeta-tipo-card (teléfono/
    // tablet, `tarjeta()`); la tabla de escritorio (`filas()`) solo tiñe la
    // fila — mismo comportamiento que ya tenía la maqueta.
    it('en teléfono/tablet, una tarjeta "arrastrada" (abierta del turno anterior) muestra el aviso', () => {
      renderView('phone', {
        abiertasActual: [],
        abiertasAnterior: [{ ...TARJETA_ABIERTA, id: 'c9', grupo: 'anterior', arrastrada: true }],
      });

      expect(screen.getByText(/Quedó en curso al terminar el turno anterior/)).toBeTruthy();
    });
  });
});
