import { describe, expect, it } from 'vitest';

import { gruposPorClase, opcionesEquipoPorClase, pesadosPrimero } from './equipos-por-clase';

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

describe('pesadosPrimero', () => {
  it('deja los pesados arriba y los livianos abajo, sin cambiar el orden dentro de cada clase', () => {
    expect(pesadosPrimero(EQUIPOS).map((e) => e.codigo)).toEqual(['BD-005', 'EX-001', 'CN-007', 'CN-099']);
  });

  it('un equipo sin clase conocida va con los pesados', () => {
    const lista = [{ codigo: 'CN-1', equipmentClass: 'LIGHT' as const }, { codigo: 'X', equipmentClass: undefined }];
    expect(pesadosPrimero(lista).map((e) => e.codigo)).toEqual(['X', 'CN-1']);
  });
});

describe('gruposPorClase', () => {
  it('arma los grupos con su título, pesados primero, y omite el grupo vacío', () => {
    expect(gruposPorClase(EQUIPOS).map((g) => [g.titulo, g.equipos.map((e) => e.codigo)])).toEqual([
      ['Equipos pesados', ['BD-005', 'EX-001']],
      ['Equipos livianos', ['CN-007', 'CN-099']],
    ]);
    expect(gruposPorClase(EQUIPOS.filter((e) => e.equipmentClass === 'LIGHT')).map((g) => g.clase)).toEqual(['LIGHT']);
  });
});
