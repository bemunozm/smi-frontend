import { describe, it, expect } from 'vitest';
import { hallazgoFormSchema } from './schema';

describe('hallazgoFormSchema', () => {
  it('acepta un hallazgo válido', () => {
    const r = hallazgoFormSchema.safeParse({ equipoId: 'e1', descripcion: 'Fuga', prioridad: 'ALTA' });
    expect(r.success).toBe(true);
  });

  it('rechaza prioridad inválida', () => {
    const r = hallazgoFormSchema.safeParse({ equipoId: 'e1', descripcion: 'Fuga', prioridad: 'URGENTE' });
    expect(r.success).toBe(false);
  });
});
