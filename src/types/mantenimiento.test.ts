import { describe, expect, it } from 'vitest';

import { toCreateOrdenInput } from './mantenimiento';

describe('toCreateOrdenInput (form "Nueva operación" de la Bitácora)', () => {
  it('correctiva con hallazgo → origen HALLAZGO con el detalle', () => {
    const input = toCreateOrdenInput({
      equipoId: 'EX-014',
      tipo: 'CORRECTIVA',
      hallazgo: 'Fuga de aceite hidráulico en pluma',
      titulo: 'Reparación de fuga hidráulica',
    });
    expect(input).toEqual({
      equipoId: 'EX-014',
      titulo: 'Reparación de fuga hidráulica',
      prioridad: 'MEDIA',
      tipo: 'CORRECTIVA',
      origen: 'HALLAZGO',
      origenDetalle: 'Fuga de aceite hidráulico en pluma',
    });
  });

  it('correctiva sin hallazgo → origen MANUAL, sin origenDetalle', () => {
    const input = toCreateOrdenInput({
      equipoId: 'EX-014',
      tipo: 'CORRECTIVA',
      hallazgo: '   ',
      titulo: 'Ajuste de frenos',
    });
    expect(input.origen).toBe('MANUAL');
    expect(input).not.toHaveProperty('origenDetalle');
  });

  it('preventiva → origen PREVENTIVO e ignora el hallazgo', () => {
    const input = toCreateOrdenInput({
      equipoId: 'CM-007',
      tipo: 'PREVENTIVA',
      hallazgo: 'esto no aplica',
      titulo: 'Cambio de aceite 250 h',
    });
    expect(input.origen).toBe('PREVENTIVO');
    expect(input).not.toHaveProperty('origenDetalle');
  });
});
