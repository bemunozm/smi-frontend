import { describe, expect, it } from 'vitest';

import { buildAssignmentDiff, idDesdeSentinel, SIN_ASIGNAR } from './equipment-assignment';
import type { EquipmentAssignee } from '../types/equipment';

const OPERATOR: EquipmentAssignee = { id: 'op_1', name: 'Patricio Rojas' };
const SUPERVISOR: EquipmentAssignee = { id: 'u_sup', name: 'Ana Soto' };

describe('idDesdeSentinel', () => {
  it('SIN_ASIGNAR se resuelve a null', () => {
    expect(idDesdeSentinel(SIN_ASIGNAR)).toBeNull();
  });

  it('cualquier otro valor se devuelve tal cual (es el id real)', () => {
    expect(idDesdeSentinel('op_2')).toBe('op_2');
  });
});

describe('buildAssignmentDiff', () => {
  const equipoActual = { operator: OPERATOR, supervisor: SUPERVISOR };

  it('sin cambios: el body queda vacío (ninguna clave viaja)', () => {
    expect(buildAssignmentDiff(equipoActual, OPERATOR.id, SUPERVISOR.id)).toEqual({});
  });

  it('cambia solo el operador: el body trae únicamente operatorId', () => {
    expect(buildAssignmentDiff(equipoActual, 'op_2', SUPERVISOR.id)).toEqual({ operatorId: 'op_2' });
  });

  it('cambia solo el supervisor: el body trae únicamente supervisorId', () => {
    expect(buildAssignmentDiff(equipoActual, OPERATOR.id, 'u_otro')).toEqual({ supervisorId: 'u_otro' });
  });

  it('liberar explícitamente (sentinel SIN_ASIGNAR) manda null aunque el otro campo no cambie', () => {
    expect(buildAssignmentDiff(equipoActual, SIN_ASIGNAR, SUPERVISOR.id)).toEqual({ operatorId: null });
  });

  it('un equipo sin asignación previa y sin elegir nada tampoco genera diff', () => {
    const sinAsignar = { operator: null, supervisor: null };
    expect(buildAssignmentDiff(sinAsignar, SIN_ASIGNAR, SIN_ASIGNAR)).toEqual({});
  });
});
