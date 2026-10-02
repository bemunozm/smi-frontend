import { describe, expect, it } from 'vitest';

import {
  contextoTurno,
  fechaCorta,
  fechaDeTurno,
  fromDateOnly,
  puedeAdelantarTurno,
  toDateOnly,
  turnoAnterior,
  turnoDe,
  turnoSiguiente,
} from './turno';

/** Fecha local (no UTC): el turno se calcula contra el reloj de la faena. */
const local = (y: number, m: number, d: number, h: number, min = 0) =>
  new Date(y, m - 1, d, h, min);

const iso = (f: Date) =>
  `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;

describe('turnoDe', () => {
  it('parte el día en 08–20 diurno y 20–08 nocturno', () => {
    expect(turnoDe(local(2026, 9, 24, 12, 0))).toBe('DIURNO');
    expect(turnoDe(local(2026, 9, 24, 22, 0))).toBe('NOCTURNO');
    expect(turnoDe(local(2026, 9, 24, 3, 0))).toBe('NOCTURNO');
  });

  /** Los bordes son el caso que se presta a quedar sin dueño o con dos. */
  it('manda cada borde al turno que empieza', () => {
    expect(turnoDe(local(2026, 9, 24, 8, 0))).toBe('DIURNO');
    expect(turnoDe(local(2026, 9, 24, 7, 59))).toBe('NOCTURNO');
    expect(turnoDe(local(2026, 9, 24, 20, 0))).toBe('NOCTURNO');
    expect(turnoDe(local(2026, 9, 24, 19, 59))).toBe('DIURNO');
  });
});

describe('fechaDeTurno', () => {
  it('de día, el turno es del día del reloj', () => {
    expect(iso(fechaDeTurno(local(2026, 9, 24, 8, 0)))).toBe('2026-09-24');
    expect(iso(fechaDeTurno(local(2026, 9, 24, 19, 59)))).toBe('2026-09-24');
  });

  /**
   * El nocturno pertenece al día en que ARRANCÓ. Un registro de las 02:00 del
   * 24 es del nocturno del 23 — si se contara como del 24, media noche de
   * trabajo caería en el día equivocado.
   */
  it('antes de las 08:00 el turno sigue siendo el del día anterior', () => {
    expect(iso(fechaDeTurno(local(2026, 9, 24, 2, 0)))).toBe('2026-09-23');
    expect(iso(fechaDeTurno(local(2026, 9, 24, 0, 0)))).toBe('2026-09-23');
    expect(iso(fechaDeTurno(local(2026, 9, 24, 7, 59)))).toBe('2026-09-23');
  });

  it('a las 20:00 el nocturno todavía es del mismo día', () => {
    expect(iso(fechaDeTurno(local(2026, 9, 24, 20, 0)))).toBe('2026-09-24');
    expect(iso(fechaDeTurno(local(2026, 9, 24, 23, 59)))).toBe('2026-09-24');
  });

  it('cruza mes y año sin romperse', () => {
    expect(iso(fechaDeTurno(local(2026, 10, 1, 3, 0)))).toBe('2026-09-30');
    expect(iso(fechaDeTurno(local(2027, 1, 1, 3, 0)))).toBe('2026-12-31');
    // 2028 es bisiesto: el nocturno del 29/02 se registra a las 02:00 del 01/03.
    expect(iso(fechaDeTurno(local(2028, 3, 1, 2, 0)))).toBe('2028-02-29');
  });

  it('devuelve el día a medianoche, no la hora del reloj', () => {
    const f = fechaDeTurno(local(2026, 9, 24, 14, 37));
    expect([f.getHours(), f.getMinutes(), f.getSeconds()]).toEqual([0, 0, 0]);
  });
});

describe('contextoTurno', () => {
  it('arma turno, etiqueta y las dos fechas de un registro nocturno de madrugada', () => {
    const ctx = contextoTurno(local(2026, 9, 24, 2, 14));

    expect(ctx.turno).toBe('NOCTURNO');
    expect(ctx.etiqueta).toBe('NOCTURNO · 20–08');
    // La fecha del turno es la del día anterior…
    expect(iso(ctx.fecha)).toBe('2026-09-23');
    // …pero el sello del registro es la hora del reloj.
    expect(ctx.fechaHora).toContain('02:14');
  });

  it('etiqueta el diurno con su rango', () => {
    expect(contextoTurno(local(2026, 9, 24, 8, 35)).etiqueta).toBe('DIURNO · 08–20');
  });
});

describe('turnoAnterior', () => {
  /**
   * 'Anterior' no es 'ayer': al nocturno del 24 lo precede el diurno del
   * MISMO 24, porque los dos arrancan ese día.
   */
  it('al nocturno lo precede el diurno del mismo día', () => {
    const { turno, fecha } = turnoAnterior('NOCTURNO', local(2026, 9, 24, 0));
    expect(turno).toBe('DIURNO');
    expect(iso(fecha)).toBe('2026-09-24');
  });

  it('al diurno lo precede el nocturno del día anterior', () => {
    const { turno, fecha } = turnoAnterior('DIURNO', local(2026, 9, 24, 0));
    expect(turno).toBe('NOCTURNO');
    expect(iso(fecha)).toBe('2026-09-23');
  });

  it('no muta la fecha que recibe', () => {
    const fecha = local(2026, 9, 24, 0);
    turnoAnterior('DIURNO', fecha);
    expect(iso(fecha)).toBe('2026-09-24');
  });

  it('cruza el inicio de mes', () => {
    expect(iso(turnoAnterior('DIURNO', local(2026, 10, 1, 0)).fecha)).toBe('2026-09-30');
  });
});

describe('fechaCorta', () => {
  /** Guion como el resto de la app (`fmtDate`), y sin la coma del locale. */
  it('escribe el día con el formato corto de es-CL, sin coma', () => {
    expect(fechaCorta(local(2026, 9, 23, 0))).toBe('mié 23-09');
  });
});

describe('turnoSiguiente', () => {
  /** Espejo de `turnoAnterior`: al diurno del 24 lo sigue el nocturno del MISMO 24. */
  it('al diurno lo sigue el nocturno del mismo día', () => {
    const { turno, fecha } = turnoSiguiente('DIURNO', local(2026, 9, 24, 0));
    expect(turno).toBe('NOCTURNO');
    expect(iso(fecha)).toBe('2026-09-24');
  });

  it('al nocturno lo sigue el diurno del día SIGUIENTE', () => {
    const { turno, fecha } = turnoSiguiente('NOCTURNO', local(2026, 9, 24, 0));
    expect(turno).toBe('DIURNO');
    expect(iso(fecha)).toBe('2026-09-25');
  });

  it('no muta la fecha que recibe', () => {
    const fecha = local(2026, 9, 24, 0);
    turnoSiguiente('NOCTURNO', fecha);
    expect(iso(fecha)).toBe('2026-09-24');
  });

  it('cruza fin de mes', () => {
    expect(iso(turnoSiguiente('NOCTURNO', local(2026, 9, 30, 0)).fecha)).toBe('2026-10-01');
  });
});

describe('toDateOnly / fromDateOnly', () => {
  /**
   * El bug que hay que evitar: `toISOString()` convierte a UTC. En un huso
   * horario negativo (Chile, UTC-3/-4) una hora de la noche cae, en UTC, del
   * lado del día SIGUIENTE — `toDateOnly` tiene que usar partes locales para
   * no correr el `shiftDate` que manda `POST /api/shift-cards`.
   */
  it('arma YYYY-MM-DD con partes LOCALES de la fecha recibida', () => {
    const fecha = local(2026, 9, 24, 23, 30);
    expect(toDateOnly(fecha)).toBe('2026-09-24');
    expect([fecha.getFullYear(), fecha.getMonth(), fecha.getDate()]).toEqual([2026, 8, 24]);
  });

  it('rellena con ceros mes y día de un dígito', () => {
    expect(toDateOnly(local(2026, 1, 5, 0))).toBe('2026-01-05');
  });

  it('fromDateOnly es la inversa de toDateOnly (ida y vuelta)', () => {
    const original = local(2026, 9, 24, 0);
    expect(toDateOnly(fromDateOnly(toDateOnly(original)))).toBe(toDateOnly(original));
  });

  it('fromDateOnly arma la fecha con partes locales (medianoche local, no UTC)', () => {
    const fecha = fromDateOnly('2026-09-24');
    expect([fecha.getFullYear(), fecha.getMonth(), fecha.getDate()]).toEqual([2026, 8, 24]);
    expect([fecha.getHours(), fecha.getMinutes()]).toEqual([0, 0]);
  });
});

describe('puedeAdelantarTurno', () => {
  it('ventana del diurno: 05:59 false, 06:00 true, 07:59 true, 08:00 false', () => {
    expect(puedeAdelantarTurno(local(2026, 9, 24, 5, 59))).toBe(false);
    expect(puedeAdelantarTurno(local(2026, 9, 24, 6, 0))).toBe(true);
    expect(puedeAdelantarTurno(local(2026, 9, 24, 7, 59))).toBe(true);
    expect(puedeAdelantarTurno(local(2026, 9, 24, 8, 0))).toBe(false);
  });

  it('ventana del nocturno: 17:59 false, 18:00 true, 19:59 true, 20:00 false', () => {
    expect(puedeAdelantarTurno(local(2026, 9, 24, 17, 59))).toBe(false);
    expect(puedeAdelantarTurno(local(2026, 9, 24, 18, 0))).toBe(true);
    expect(puedeAdelantarTurno(local(2026, 9, 24, 19, 59))).toBe(true);
    expect(puedeAdelantarTurno(local(2026, 9, 24, 20, 0))).toBe(false);
  });

  it('fuera de ambas ventanas (media tarde, madrugada) es false', () => {
    expect(puedeAdelantarTurno(local(2026, 9, 24, 14, 0))).toBe(false);
    expect(puedeAdelantarTurno(local(2026, 9, 24, 2, 0))).toBe(false);
  });
});
