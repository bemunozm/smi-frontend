import { describe, expect, it } from 'vitest';

import {
  agruparPorTurno,
  primeroLasMias,
  registradaDespues,
  rotuloTurno,
  type TarjetaTurno,
} from './shift-register-helpers';

const tarjeta = (extra: Partial<TarjetaTurno>): TarjetaTurno => ({
  id: extra.id ?? 'x',
  equipoId: 'e1',
  equipo: 'SEM 06',
  tipo: 'CF',
  operador: 'Flavio Bustamante',
  inicial: 1461,
  final: 1469,
  grupo: 'anterior',
  estado: 'cerrada',
  supervisor: 'Limberth Villacorta',
  ...extra,
});

const ACTUAL = { tipo: 'NOCTURNO', fecha: '2026-11-11' };
const ANTERIOR = { tipo: 'DIURNO', fecha: '2026-11-11' };

describe('rotuloTurno', () => {
  it('una carga del 03-11 hecha el 11-11 se rotula con su propio turno, no con el anterior', () => {
    const t = tarjeta({ turnoFecha: '2026-11-03', turnoTipo: 'DIURNO' });
    expect(rotuloTurno(t, 'NOCTURNO mié 11-11', 'DIURNO mié 11-11')).toBe('DIURNO mar 03-11');
  });

  it('sin turno propio cae al rótulo por grupo', () => {
    expect(rotuloTurno(tarjeta({ grupo: 'actual' }), 'NOCTURNO mié 11-11', 'DIURNO mié 11-11')).toBe(
      'NOCTURNO mié 11-11',
    );
  });
});

describe('agruparPorTurno', () => {
  it('agrupa por el turno real, del más reciente al más viejo', () => {
    const grupos = agruparPorTurno(
      [
        tarjeta({ id: 'a', turnoFecha: '2026-11-03', turnoTipo: 'DIURNO' }),
        tarjeta({ id: 'b', turnoFecha: '2026-11-11', turnoTipo: 'DIURNO' }),
        tarjeta({ id: 'c', grupo: 'actual', turnoFecha: '2026-11-11', turnoTipo: 'NOCTURNO' }),
        tarjeta({ id: 'd', turnoFecha: '2026-11-03', turnoTipo: 'DIURNO' }),
      ],
      ACTUAL,
      ANTERIOR,
    );
    expect(grupos.map((g) => `${g.tipo} ${g.fecha} ${g.ts.map((t) => t.id).join('')}`)).toEqual([
      'NOCTURNO 2026-11-11 c',
      'DIURNO 2026-11-11 b',
      'DIURNO 2026-11-03 ad',
    ]);
  });

  it('una tarjeta sin turno va al de su grupo', () => {
    const [g] = agruparPorTurno([tarjeta({ grupo: 'anterior' })], ACTUAL, ANTERIOR);
    expect(g).toMatchObject({ tipo: 'DIURNO', fecha: '2026-11-11' });
  });
});

describe('registradaDespues', () => {
  it('marca la carga de un turno pasado con el día en que se registró', () => {
    const t = tarjeta({
      turnoFecha: '2026-11-03',
      turnoTipo: 'DIURNO',
      cerradaIso: new Date(2026, 10, 11, 13, 16).toISOString(),
    });
    // `Intl` puede separar la hora del «p. m.» con espacio común, no separable
    // (U+00A0) o angosto (U+202F), según la versión de ICU de Node — por eso
    // el separador se acepta como "cualquier espacio".
    expect(registradaDespues(t)).toMatch(/11-11[\s  ]+(13:16|01:16[\s  ]+p\.[\s  ]?m\.)/);
  });

  it('un DIURNO cerrado el mismo día no se marca', () => {
    const t = tarjeta({
      turnoFecha: '2026-11-11',
      turnoTipo: 'DIURNO',
      cerradaIso: new Date(2026, 10, 11, 19, 30).toISOString(),
    });
    expect(registradaDespues(t)).toBeUndefined();
  });

  it('un NOCTURNO cerrado a la mañana siguiente no se marca', () => {
    const t = tarjeta({
      turnoFecha: '2026-11-10',
      turnoTipo: 'NOCTURNO',
      cerradaIso: new Date(2026, 10, 11, 7, 45).toISOString(),
    });
    expect(registradaDespues(t)).toBeUndefined();
  });
});

describe('primeroLasMias', () => {
  const lista = [
    tarjeta({ id: 'a', supervisorId: 'otro' }),
    tarjeta({ id: 'b', supervisorId: 'yo' }),
    tarjeta({ id: 'c' }),
    tarjeta({ id: 'd', supervisorId: 'yo' }),
  ];

  it('las que abrió el usuario van primero y el resto conserva su orden', () => {
    expect(primeroLasMias(lista, 'yo').map((t) => t.id)).toEqual(['b', 'd', 'a', 'c']);
  });

  it('sin usuario o sin tarjetas propias no reordena', () => {
    expect(primeroLasMias(lista, undefined).map((t) => t.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(primeroLasMias(lista, 'nadie').map((t) => t.id)).toEqual(['a', 'b', 'c', 'd']);
  });
});
