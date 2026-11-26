import { describe, expect, it } from 'vitest';

import {
  armarInformeAntiguo,
  claveErrorEquipo,
  equiposDelInforme,
  filasDeEquipos,
  numerosEnCola,
  validarInformeAntiguo,
  type InformeAntiguoForm,
} from './informe-antiguo';
import type { OutboxOp } from '../offline/db';
import type { InformeTemporal } from '../types/informe-temporal';

const form = (over: Partial<InformeAntiguoForm> = {}): InformeAntiguoForm => ({
  numero: '12',
  fecha: '2026-11-20',
  turno: 'DIURNO',
  actividad1: 'Limpieza de cancha',
  actividad2: '',
  personal1: [{ operatorId: 'op1', nombre: 'Juan Rojas' }],
  personal2: [],
  observaciones: '',
  supervisor1: 'Pedro Soto',
  supervisor2: '',
  supervisorId: '',
  equipos: [{ id: 'f1', equipoId: 'e1', inicial: '484,92', final: '487,1', litros: '' }],
  ...over,
});

const opciones = { numerosTomados: new Set<number>(), exigirSupervisor: false, hoy: '2026-11-26' };

describe('validarInformeAntiguo', () => {
  it('un informe completo no tiene errores', () => {
    expect(validarInformeAntiguo(form(), opciones)).toEqual({});
  });

  it('el N° es obligatorio, entero positivo y libre', () => {
    expect(validarInformeAntiguo(form({ numero: '' }), opciones).numero).toBe('Escribe el N° del informe en papel.');
    expect(validarInformeAntiguo(form({ numero: '1,5' }), opciones).numero).toMatch(/entero mayor que 0/);
    expect(validarInformeAntiguo(form({ numero: '0' }), opciones).numero).toMatch(/entero mayor que 0/);
    expect(validarInformeAntiguo(form(), { ...opciones, numerosTomados: new Set([12]) }).numero).toBe(
      'El N° 12 ya está registrado en otro informe.',
    );
  });

  it('la fecha no puede tener más de un año', () => {
    expect(validarInformeAntiguo(form({ fecha: '2025-11-01' }), { ...opciones, desde: '2025-11-26' }).fecha).toBe(
      'La fecha tiene más de un año de antigüedad.',
    );
  });

  it('la fecha no puede ser futura', () => {
    expect(validarInformeAntiguo(form({ fecha: '2026-11-27' }), opciones).fecha).toBe('La fecha no puede ser futura.');
  });

  it('la oficina tiene que elegir el supervisor temporal', () => {
    expect(validarInformeAntiguo(form(), { ...opciones, exigirSupervisor: true }).supervisorId).toBeTruthy();
    expect(
      validarInformeAntiguo(form({ supervisorId: 'u1' }), { ...opciones, exigirSupervisor: true }).supervisorId,
    ).toBeUndefined();
  });

  it('exige al menos un equipo, sin repetir, con final ≥ inicial y litros válidos', () => {
    expect(validarInformeAntiguo(form({ equipos: [] }), opciones).equipos).toBe('Agrega al menos un equipo.');
    const errores = validarInformeAntiguo(
      form({
        equipos: [
          { id: 'a', equipoId: 'e1', inicial: '10', final: '9', litros: 'x' },
          { id: 'b', equipoId: 'e1', inicial: '', final: '5', litros: '' },
          { id: 'c', equipoId: '', inicial: '1', final: '2', litros: '' },
        ],
      }),
      opciones,
    );
    expect(errores[claveErrorEquipo('final', 'a')]).toBe('No puede ser menor que la lectura inicial.');
    expect(errores[claveErrorEquipo('litros', 'a')]).toBeTruthy();
    expect(errores[claveErrorEquipo('equipo', 'b')]).toBe('Este equipo ya está en el informe.');
    expect(errores[claveErrorEquipo('inicial', 'b')]).toBe('Escribe la lectura inicial.');
    expect(errores[claveErrorEquipo('equipo', 'c')]).toBe('Elige el equipo.');
  });

  it('reusa las reglas del informe normal (actividad y supervisor responsable)', () => {
    const errores = validarInformeAntiguo(form({ actividad1: ' ', supervisor1: '' }), opciones);
    expect(errores.actividad1).toBeTruthy();
    expect(errores.supervisor1).toBeTruthy();
  });
});

describe('armarInformeAntiguo', () => {
  it('arma el body: N° como número, equipos con sus cifras y litros null si van vacíos', () => {
    const body = armarInformeAntiguo(form({ observaciones: ' Sin novedades ', supervisorId: 'u9' }), {
      id: 'i1',
      conSupervisor: false,
    });
    expect(body).toEqual({
      id: 'i1',
      numero: 12,
      fecha: '2026-11-20',
      turno: 'DIURNO',
      actividad1: 'Limpieza de cancha',
      personal: [{ actividad: 1, operatorId: 'op1', nombre: 'Juan Rojas' }],
      supervisorResponsable1: 'Pedro Soto',
      observaciones: 'Sin novedades',
      equipos: [{ equipoId: 'e1', inicial: 484.92, final: 487.1, litros: null }],
    });
  });

  it('la oficina manda el supervisor temporal elegido', () => {
    expect(armarInformeAntiguo(form({ supervisorId: 'u9' }), { id: 'i1', conSupervisor: true }).supervisorId).toBe(
      'u9',
    );
  });
});

describe('equiposDelInforme', () => {
  const base = { tarjetas: [], equiposRegistrados: [] } as unknown as InformeTemporal;

  it('junta tarjetas y equipos escritos a mano en la misma forma', () => {
    const informe = {
      ...base,
      tarjetas: [
        {
          id: 'c1',
          equipo: { id: 'e1', internalCode: 'SEM05', name: 'Cargador' },
          operador: 'Juan',
          valorInicial: 1,
          valorFinal: 2,
          fuelLiters: 30,
          adBlueLiters: null,
          pumpPhotoUrl: null,
          fecha: '',
          fechaSalida: null,
        },
      ],
      equiposRegistrados: [
        {
          equipoId: 'e2',
          codigo: 'COMPRESOR',
          nombre: 'Compresor',
          unidad: 'h',
          inicial: 484.92,
          final: 487.1,
          litros: null,
        },
      ],
    } as InformeTemporal;
    expect(equiposDelInforme(informe)).toEqual([
      expect.objectContaining({ tarjetaId: 'c1', codigo: 'SEM05', inicial: 1, final: 2, litros: 30, unidad: null }),
      expect.objectContaining({ tarjetaId: null, codigo: 'COMPRESOR', inicial: 484.92, final: 487.1, unidad: 'h' }),
    ]);
  });

  it('las filas guardadas vuelven al formulario con coma decimal', () => {
    expect(filasDeEquipos([{ equipoId: 'e1', inicial: 484.92, final: 487.1, litros: null }], () => 'x')).toEqual([
      { id: 'x', equipoId: 'e1', inicial: '484,92', final: '487,1', litros: '' },
    ]);
  });
});

describe('numerosEnCola', () => {
  it('toma el N° de los informes antiguos que esperan en la cola', () => {
    const ops = [
      { type: 'httpWrite', endpoint: 'informeTemporal.createAntiguo', body: { numero: 7 } },
      { type: 'httpWrite', endpoint: 'informeTemporal.create', body: { id: 'x' } },
      { type: 'createHallazgo', payload: {} },
    ] as unknown as OutboxOp[];
    expect(numerosEnCola(ops)).toEqual([7]);
  });
});
