import { beforeEach, describe, expect, it, vi } from 'vitest';

const { cambiosMock } = vi.hoisted(() => ({ cambiosMock: vi.fn() }));
vi.mock('../offline/outbox', () => ({ cambiosPendientes: cambiosMock }));

import { buildQueuedEdit, pendingBase } from './queued-edit';

interface Orden {
  estado: string;
  asignadoAId: string | null;
  titulo: string;
}

const base: Orden = { estado: 'ABIERTA', asignadoAId: null, titulo: 'Fuga' };
const campos = ['estado', 'asignadoAId', 'titulo'] as const;
const spec = { entity: 'orden:o1', ops: ['orden.update'] as const, base, fields: campos };

beforeEach(() => {
  cambiosMock.mockReset();
  cambiosMock.mockResolvedValue({});
});

describe('pendingBase', () => {
  it('parte de lo que la pantalla muestra más lo que esa entidad ya tiene esperando en la cola', async () => {
    cambiosMock.mockResolvedValue({ estado: 'EN_CURSO' });

    expect(await pendingBase(spec)).toEqual({ estado: 'EN_CURSO', asignadoAId: null, titulo: 'Fuga' });
    expect(cambiosMock).toHaveBeenCalledWith('orden:o1', ['orden.update']);
  });
});

describe('buildQueuedEdit', () => {
  it('manda solo lo que cambió, con la base como precondición', async () => {
    const edicion = await buildQueuedEdit({ ...spec, next: { titulo: 'Fuga de aceite' } });

    expect(edicion).toEqual({
      cambios: { titulo: 'Fuga de aceite' },
      esperado: { titulo: 'Fuga' },
      hayCambios: true,
    });
  });

  it('dos ediciones seguidas del mismo campo: la segunda espera lo que dejó la primera', async () => {
    cambiosMock.mockResolvedValue({ titulo: 'B' });

    const edicion = await buildQueuedEdit({ ...spec, next: { titulo: 'C' } });

    expect(edicion.esperado).toEqual({ titulo: 'B' });
  });

  it('un campo omitido no se toca; null desasigna', async () => {
    const edicion = await buildQueuedEdit<Orden>({
      ...spec,
      base: { ...base, asignadoAId: 'u1' },
      next: { asignadoAId: null },
    });

    expect(edicion.cambios).toEqual({ asignadoAId: null });
    expect(edicion.esperado).toEqual({ asignadoAId: 'u1' });
  });

  it('sin cambios, nada que encolar', async () => {
    const edicion = await buildQueuedEdit({ ...spec, next: { estado: 'ABIERTA', titulo: undefined } });

    expect(edicion.hayCambios).toBe(false);
    expect(edicion.esperado).toBeUndefined();
  });
});
