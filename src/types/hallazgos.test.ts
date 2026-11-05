import { describe, it, expect } from 'vitest';
import { hallazgoFormSchema } from './hallazgos';

describe('hallazgoFormSchema', () => {
  it('acepta un hallazgo válido', () => {
    const r = hallazgoFormSchema.safeParse({ tipo: 'EQUIPO', equipoId: 'e1', descripcion: 'Fuga', prioridad: 'ALTA' });
    expect(r.success).toBe(true);
  });

  it('uno de equipo sin equipo no pasa', () => {
    const r = hallazgoFormSchema.safeParse({ tipo: 'EQUIPO', descripcion: 'Fuga', prioridad: 'ALTA' });
    expect(r.success).toBe(false);
  });

  it('uno de zona pide faena y lugar, no equipo', () => {
    const base = { tipo: 'ZONA', descripcion: 'Bache en la entrada', prioridad: 'MEDIA' } as const;
    expect(hallazgoFormSchema.safeParse({ ...base, faena: 'Kainita', lugar: 'Cancha norte' }).success).toBe(true);
    expect(hallazgoFormSchema.safeParse({ ...base, faena: 'Kainita', lugar: '  ' }).success).toBe(false);
    expect(hallazgoFormSchema.safeParse({ ...base, lugar: 'Cancha norte' }).success).toBe(false);
  });

  it('rechaza prioridad inválida', () => {
    const r = hallazgoFormSchema.safeParse({ equipoId: 'e1', descripcion: 'Fuga', prioridad: 'URGENTE' });
    expect(r.success).toBe(false);
  });
});
