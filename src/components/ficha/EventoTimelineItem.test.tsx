import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { EventoTimelineItem } from './EventoTimelineItem';
import type { EventoFicha } from '../../types/ficha';

afterEach(cleanup);

/**
 * Un evento por cada uno de los 7 tipos de la timeline, con el `meta`
 * mínimo que `metaFields` (`EventoTimelineItem.tsx`) sabe leer para ese
 * tipo. Cubre la regresión de `smi-backend`: si el equipo backend minimiza
 * `meta` (quita `asignadoAId`/`realizadaPorId`), estos tests no dependen de
 * esas claves — solo de las que la UI realmente muestra.
 */
const EVENTOS: Record<EventoFicha['tipo'], EventoFicha> = {
  COMBUSTIBLE: {
    id: 'ev_combustible',
    tipo: 'COMBUSTIBLE',
    fecha: '2026-08-01T10:00:00.000Z',
    titulo: 'Carga de combustible',
    detalle: 'Carga en surtidor propio',
    meta: { litros: 45, tipo: 'DIESEL', fotoUrl: null },
  },
  HOROMETRO: {
    id: 'ev_horometro',
    tipo: 'HOROMETRO',
    fecha: '2026-07-28T07:00:00.000Z',
    titulo: 'Registro de horómetro',
    detalle: 'Operador: Juan',
    meta: { operador: 'Juan', turno: 'NOCHE', valorInicial: 100, valorFinal: 110 },
  },
  TRABAJO_EXTRA: {
    id: 'ev_trabajo_extra',
    tipo: 'TRABAJO_EXTRA',
    fecha: '2026-07-27T06:00:00.000Z',
    titulo: 'Trabajo extraordinario',
    detalle: 'Turno DIA',
    meta: { totalHoras: 3, turno: 'DIA' },
  },
  HALLAZGO: {
    id: 'ev_hallazgo',
    tipo: 'HALLAZGO',
    fecha: '2026-07-30T09:00:00.000Z',
    titulo: 'Hallazgo CRITICA',
    detalle: 'Fuga de aceite',
    meta: { prioridad: 'CRITICA', estado: 'CERRADO', fotoUrl: null },
  },
  ORDEN_TRABAJO: {
    id: 'ev_orden',
    tipo: 'ORDEN_TRABAJO',
    fecha: '2026-07-29T08:00:00.000Z',
    titulo: 'Orden de trabajo — Cambio de aceite',
    detalle: 'PREVENTIVA · origen: MANUAL',
    meta: { estado: 'PENDIENTE', prioridad: 'MEDIA', tipo: 'PREVENTIVA', origen: 'MANUAL' },
  },
  INTERVENCION: {
    id: 'ev_intervencion',
    tipo: 'INTERVENCION',
    fecha: '2026-07-26T05:00:00.000Z',
    titulo: 'Intervención — Cambio de aceite',
    detalle: 'Cambio de filtro y aceite',
    meta: { tipo: 'CORRECTIVA', horasHombre: 4 },
  },
  ACTIVIDAD: {
    id: 'ev_actividad',
    tipo: 'ACTIVIDAD',
    fecha: '2026-07-25T04:00:00.000Z',
    titulo: 'Actividad — Revisión general',
    detalle: 'Revisión programada',
    meta: { origen: 'EQUIPO', estado: 'COMPLETADA' },
  },
};

describe('EventoTimelineItem', () => {
  it('COMBUSTIBLE muestra Litros y Tipo', () => {
    render(<EventoTimelineItem evento={EVENTOS.COMBUSTIBLE} />);

    expect(screen.getByText('Combustible')).toBeTruthy();
    expect(screen.getByText(/Litros: 45 L/)).toBeTruthy();
    expect(screen.getByText(/Tipo: DIESEL/)).toBeTruthy();
  });

  it('HOROMETRO muestra Turno y el rango de Horómetro', () => {
    render(<EventoTimelineItem evento={EVENTOS.HOROMETRO} />);

    expect(screen.getByText('Horómetro')).toBeTruthy();
    expect(screen.getByText(/Turno: NOCHE/)).toBeTruthy();
    expect(screen.getByText(/Horómetro: 100 → 110 h/)).toBeTruthy();
  });

  it('TRABAJO_EXTRA muestra Horas y Turno', () => {
    render(<EventoTimelineItem evento={EVENTOS.TRABAJO_EXTRA} />);

    expect(screen.getByText('Trabajo extra')).toBeTruthy();
    expect(screen.getByText(/Horas: 3 h/)).toBeTruthy();
    expect(screen.getByText(/Turno: DIA/)).toBeTruthy();
  });

  it('HALLAZGO muestra Prioridad y Estado con sus etiquetas en español', () => {
    render(<EventoTimelineItem evento={EVENTOS.HALLAZGO} />);

    expect(screen.getByText('Hallazgo')).toBeTruthy();
    expect(screen.getByText(/Prioridad: Crítica/)).toBeTruthy();
    expect(screen.getByText(/Estado: Cerrado/)).toBeTruthy();
  });

  it('ORDEN_TRABAJO muestra Tipo y Prioridad con sus etiquetas en español', () => {
    render(<EventoTimelineItem evento={EVENTOS.ORDEN_TRABAJO} />);

    expect(screen.getByText('Orden de trabajo')).toBeTruthy();
    expect(screen.getByText(/Tipo: Preventiva/)).toBeTruthy();
    expect(screen.getByText(/Prioridad: Media/)).toBeTruthy();
  });

  it('INTERVENCION muestra Tipo y Horas hombre', () => {
    render(<EventoTimelineItem evento={EVENTOS.INTERVENCION} />);

    expect(screen.getByText('Intervención')).toBeTruthy();
    expect(screen.getByText(/Tipo: Correctiva/)).toBeTruthy();
    expect(screen.getByText(/Horas hombre: 4 h/)).toBeTruthy();
  });

  it('ACTIVIDAD muestra Origen y Estado con sus etiquetas en español', () => {
    render(<EventoTimelineItem evento={EVENTOS.ACTIVIDAD} />);

    expect(screen.getByText('Actividad')).toBeTruthy();
    expect(screen.getByText(/Origen: Equipo/)).toBeTruthy();
    expect(screen.getByText(/Estado: Completada/)).toBeTruthy();
  });
});
