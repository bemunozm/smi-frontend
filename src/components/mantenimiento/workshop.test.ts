import { describe, expect, it } from 'vitest';

import type { OrdenTrabajo } from '../../types/mantenimiento';
import {
  buildWorkshopStats,
  equipmentLabel,
  formatDate,
  groupWorkshopBoard,
} from './workshop';

/** OT mínima válida; cada test pisa solo lo que le importa. */
function orden(overrides: Partial<OrdenTrabajo> = {}): OrdenTrabajo {
  return {
    id: 'ot-1',
    equipoId: 'EX-014',
    hallazgoId: null,
    titulo: 'Fuga de aceite hidráulico en pluma',
    estado: 'PENDIENTE',
    prioridad: 'MEDIA',
    tipo: 'CORRECTIVA',
    origen: 'HALLAZGO',
    origenDetalle: 'J. Soto · Operador',
    asignadoA: null,
    tareas: [],
    createdAt: '2026-10-05T10:00:00.000Z',
    updatedAt: '2026-10-05T10:00:00.000Z',
    ...overrides,
  };
}

describe('groupWorkshopBoard', () => {
  it('reparte cada estado en su columna', () => {
    const board = groupWorkshopBoard([
      orden({ id: 'a', estado: 'PENDIENTE' }),
      orden({ id: 'b', estado: 'ASIGNADA' }),
      orden({ id: 'c', estado: 'EN_PROCESO' }),
      orden({ id: 'd', estado: 'COMPLETADA' }),
      orden({ id: 'e', estado: 'CANCELADA' }),
    ]);
    expect(board.backlog.map((o) => o.id)).toEqual(['a', 'b']);
    expect(board.inProgress.map((o) => o.id)).toEqual(['c']);
    expect(board.finished.map((o) => o.id).sort()).toEqual(['d', 'e']);
  });

  it('ordena la bandeja por prioridad (crítica primero) y luego por fecha desc', () => {
    const board = groupWorkshopBoard([
      orden({ id: 'media-vieja', prioridad: 'MEDIA', createdAt: '2026-10-01T08:00:00.000Z' }),
      orden({ id: 'critica', prioridad: 'CRITICA', createdAt: '2026-10-02T08:00:00.000Z' }),
      orden({ id: 'media-nueva', prioridad: 'MEDIA', createdAt: '2026-10-04T08:00:00.000Z' }),
    ]);
    expect(board.backlog.map((o) => o.id)).toEqual(['critica', 'media-nueva', 'media-vieja']);
  });

  it('ordena en proceso y finalizado por última actualización desc', () => {
    const board = groupWorkshopBoard([
      orden({ id: 'f-vieja', estado: 'COMPLETADA', updatedAt: '2026-10-01T08:00:00.000Z' }),
      orden({ id: 'f-nueva', estado: 'COMPLETADA', updatedAt: '2026-10-05T08:00:00.000Z' }),
      orden({ id: 'p-vieja', estado: 'EN_PROCESO', updatedAt: '2026-10-02T08:00:00.000Z' }),
      orden({ id: 'p-nueva', estado: 'EN_PROCESO', updatedAt: '2026-10-05T09:00:00.000Z' }),
    ]);
    expect(board.inProgress.map((o) => o.id)).toEqual(['p-nueva', 'p-vieja']);
    expect(board.finished.map((o) => o.id)).toEqual(['f-nueva', 'f-vieja']);
  });
});

describe('buildWorkshopStats', () => {
  it('cuenta bandeja, en proceso, finalizadas hoy y total', () => {
    const now = new Date('2026-10-05T15:00:00');
    const stats = buildWorkshopStats(
      [
        orden({ id: 'a', estado: 'PENDIENTE' }),
        orden({ id: 'b', estado: 'ASIGNADA' }),
        orden({ id: 'c', estado: 'EN_PROCESO' }),
        // Completada HOY (mismo día local que `now`).
        orden({ id: 'd', estado: 'COMPLETADA', updatedAt: '2026-10-05T11:05:00' }),
        // Completada AYER: cuenta en total pero no en "finalizadas hoy".
        orden({ id: 'e', estado: 'COMPLETADA', updatedAt: '2026-10-04T11:05:00' }),
        // Cancelada: no es "finalizada hoy".
        orden({ id: 'f', estado: 'CANCELADA', updatedAt: '2026-10-05T09:00:00' }),
      ],
      now,
    );
    expect(stats).toEqual({ backlog: 2, inProgress: 1, finishedToday: 1, total: 6 });
  });
});

describe('equipmentLabel', () => {
  const fleet = [
    { id: 'eq-1', internalCode: 'EX-014', brand: 'CAT', model: '320' },
    { id: 'eq-2', internalCode: 'CM-007', brand: 'Volvo', model: 'FMX' },
  ];

  it('resuelve por código interno', () => {
    expect(equipmentLabel('EX-014', fleet)).toBe('EX-014 · CAT 320');
  });

  it('resuelve por id', () => {
    expect(equipmentLabel('eq-2', fleet)).toBe('CM-007 · Volvo FMX');
  });

  it('cae al valor crudo si no hay match o no hay flota', () => {
    expect(equipmentLabel('ZZ-999', fleet)).toBe('ZZ-999');
    expect(equipmentLabel('EX-014', undefined)).toBe('EX-014');
  });
});

describe('formatDate', () => {
  it('devuelve el string crudo si la fecha es inválida', () => {
    expect(formatDate('no-es-fecha')).toBe('no-es-fecha');
  });

  it('formatea día/mes y hora para una fecha válida', () => {
    const formatted = formatDate('2026-10-05T11:05:00');
    // El separador y el 12h/24h dependen de los datos de locale del runtime;
    // lo que importa es que aparezcan día, mes y hora, no el string exacto.
    expect(formatted).toMatch(/0?5[-/]10/);
    expect(formatted).toContain('11:05');
  });
});
