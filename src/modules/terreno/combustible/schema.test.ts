import { describe, it, expect } from 'vitest';
import { combustibleFormSchema } from './schema';

describe('combustibleFormSchema', () => {
  it('rechaza litros <= 0', () => {
    const r = combustibleFormSchema.safeParse({ equipoId: 'e1', litros: 0 });
    expect(r.success).toBe(false);
  });

  it('acepta un registro válido', () => {
    const r = combustibleFormSchema.safeParse({ equipoId: 'e1', litros: 50 });
    expect(r.success).toBe(true);
  });

  it('rechaza equipoId vacío', () => {
    const r = combustibleFormSchema.safeParse({ equipoId: '', litros: 50 });
    expect(r.success).toBe(false);
  });
});
