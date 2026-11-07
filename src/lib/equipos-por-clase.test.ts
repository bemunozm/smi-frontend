import { describe, expect, it } from 'vitest';

import { opcionesEquipoPorClase } from './equipos-por-clase';

const EQUIPOS = [
  { codigo: 'CN-007', equipmentClass: 'LIGHT' as const },
  { codigo: 'BD-005', equipmentClass: 'HEAVY' as const },
  { codigo: 'CN-099', equipmentClass: 'LIGHT' as const },
  { codigo: 'EX-001', equipmentClass: 'HEAVY' as const },
];
const opcion = (e: (typeof EQUIPOS)[number]) => ({ valor: e.codigo, titulo: e.codigo });

describe('opcionesEquipoPorClase', () => {
  it('pesados primero: separa en dos grupos y respeta el orden dentro de cada uno', () => {
    expect(opcionesEquipoPorClase(EQUIPOS, 'HEAVY', opcion).map((o) => [o.valor, o.grupo])).toEqual([
      ['BD-005', 'Equipos pesados'],
      ['EX-001', 'Equipos pesados'],
      ['CN-007', 'Equipos livianos'],
      ['CN-099', 'Equipos livianos'],
    ]);
  });

  it('livianos primero: invierte los grupos', () => {
    expect(opcionesEquipoPorClase(EQUIPOS, 'LIGHT', opcion).map((o) => o.grupo)).toEqual([
      'Equipos livianos',
      'Equipos livianos',
      'Equipos pesados',
      'Equipos pesados',
    ]);
  });
});
