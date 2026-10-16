import { describe, expect, it } from 'vitest';

import { ReporteDiarioSchema } from './reporte-diario';

const payload = {
  id: '7b0d8c1e-3f5a-4e6b-9c2d-1a2b3c4d5e6f',
  fecha: '2026-10-14T00:00:00.000Z',
  turno: 'DIURNO',
  supervisorId: 'u1',
  supervisorNombre: 'Limbert Villacorta',
  observaciones: null,
  createdAt: '2026-10-14T19:00:00.000Z',
  updatedAt: '2026-10-14T19:00:00.000Z',
  produccion: [
    { id: 'x1', reporteId: 'r', seccion: 'INTERNOS', camiones: 5, vueltasPorCamion: 4 },
  ],
  tolvas: [{ id: 'x2', reporteId: 'r', tolva: 1, cargas: 2 }],
  plantas: [
    { id: 'x3', reporteId: 'r', plantaId: 'p1', producto: 'Sal gruesa', planta: { nombre: 'P.P.1' } },
  ],
  traspasos: [{ id: 'x4', reporteId: 'r', tipo: 'INTERNOS', cantidad: 3 }],
  empresas: [{ id: 'x5', reporteId: 'r', empresaId: 'e1', empresa: { nombre: 'Hyd' } }],
  personal: [{ id: 'x6', reporteId: 'r', rol: 'Jefe de turno mina', nombre: 'Álvaro', orden: 0 }],
};

describe('ReporteDiarioSchema', () => {
  it('parsea la respuesta del backend', () => {
    expect(ReporteDiarioSchema.parse(payload).turno).toBe('DIURNO');
  });

  it('rechaza un turno fuera de vocabulario', () => {
    expect(() =>
      ReporteDiarioSchema.parse({ ...payload, turno: 'TARDE' }),
    ).toThrow();
  });
});
