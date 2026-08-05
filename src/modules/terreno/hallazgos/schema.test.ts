import { describe, it, expect } from 'vitest';
import { hallazgoFormSchema } from './schema';

describe('hallazgoFormSchema', () => {
  it('acepta un hallazgo válido', () => {
    const r = hallazgoFormSchema.safeParse({ equipoId: 'e1', descripcion: 'Fuga', criticidad: 'ALTA' });
    expect(r.success).toBe(true);
  });

  it('rechaza criticidad inválida', () => {
    const r = hallazgoFormSchema.safeParse({ equipoId: 'e1', descripcion: 'Fuga', criticidad: 'URGENTE' });
    expect(r.success).toBe(false);
  });
});
