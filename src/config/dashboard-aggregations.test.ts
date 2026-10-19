import { describe, expect, it } from 'vitest';

import { hallazgosAbiertosRecientes } from './dashboard-aggregations';
import type { Hallazgo } from '../types/hallazgos';

const h = (n: number, estado: string): Hallazgo => ({
  id: `h${n}`,
  equipoId: 'e1',
  descripcion: `Hallazgo ${n}`,
  prioridad: 'ALTA',
  estado,
  fotoUrl: null,
  fecha: `2026-10-${String(n).padStart(2, '0')}T12:00:00.000Z`,
  equipo: { internalCode: 'CG-002' },
});

describe('hallazgosAbiertosRecientes', () => {
  it('devuelve solo los abiertos, el más reciente primero, con tope', () => {
    const todos = [
      ...Array.from({ length: 12 }, (_, i) => h(i + 1, 'ABIERTO')),
      h(20, 'CERRADO'),
    ];
    const r = hallazgosAbiertosRecientes(todos);
    expect(r).toHaveLength(10);
    expect(r.map((x) => x.id)).toEqual(['h12', 'h11', 'h10', 'h9', 'h8', 'h7', 'h6', 'h5', 'h4', 'h3']);
    expect(r.every((x) => x.estado === 'ABIERTO')).toBe(true);
  });
});
