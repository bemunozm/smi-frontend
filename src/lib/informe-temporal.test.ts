import { describe, expect, it } from 'vitest';

import {
  armarInformeTemporal,
  cardIdsEnInformePendiente,
  validarInformeTemporal,
  type FilaCierreForm,
  type InformeTemporalForm,
} from './informe-temporal';
import type { OutboxOp } from '../offline/db';

function fila(overrides: Partial<FilaCierreForm> = {}): FilaCierreForm {
  return {
    cardId: 'c1',
    inicial: 1200,
    liviano: false,
    final: '1210',
    litros: '',
    foto: null,
    fotoCapturada: null,
    adBlue: false,
    adBlueLitros: '',
    ...overrides,
  };
}

function form(overrides: Partial<InformeTemporalForm> = {}): InformeTemporalForm {
  return {
    fecha: '2026-11-24',
    turno: 'DIURNO',
    actividad1: 'Limpieza de cancha',
    actividad2: '',
    personal1: [],
    personal2: [],
    observaciones: '',
    supervisor1: 'Pedro Soto',
    supervisor2: '',
    fotosEnviadas: false,
    infoSubidaApp: false,
    cierres: [fila()],
    ...overrides,
  };
}

const persona = (nombre: string) => ({ operatorId: null, nombre });

describe('validarInformeTemporal', () => {
  it('un formulario completo no tiene errores', () => {
    expect(validarInformeTemporal(form())).toEqual({});
  });

  it('exige la actividad 1', () => {
    expect(validarInformeTemporal(form({ actividad1: '   ' }))).toHaveProperty('actividad1');
  });

  it('exige el supervisor responsable 1', () => {
    expect(validarInformeTemporal(form({ supervisor1: '' }))).toHaveProperty('supervisor1');
  });

  it('exige la lectura final y que no sea menor que la inicial', () => {
    expect(validarInformeTemporal(form({ cierres: [fila({ final: '' })] }))).toHaveProperty('final.c1');
    expect(validarInformeTemporal(form({ cierres: [fila({ final: 'abc' })] }))).toHaveProperty('final.c1');
    expect(validarInformeTemporal(form({ cierres: [fila({ final: '1199,5' })] }))).toHaveProperty('final.c1');
    expect(validarInformeTemporal(form({ cierres: [fila({ final: '1200' })] }))).toEqual({});
  });

  it('exige la foto del surtidor solo si hay litros', () => {
    expect(validarInformeTemporal(form({ cierres: [fila({ litros: '48,493' })] }))).toHaveProperty('foto.c1');
    const foto = new File(['x'], 'surtidor.jpg', { type: 'image/jpeg' });
    expect(validarInformeTemporal(form({ cierres: [fila({ litros: '48,493', foto })] }))).toEqual({});
    expect(validarInformeTemporal(form({ cierres: [fila({ litros: '0' })] }))).toEqual({});
  });

  it('rechaza litros que no son número', () => {
    expect(validarInformeTemporal(form({ cierres: [fila({ litros: 'mucho' })] }))).toHaveProperty('litros.c1');
  });

  it('exige los litros de AdBlue si se marcó', () => {
    expect(validarInformeTemporal(form({ cierres: [fila({ adBlue: true })] }))).toHaveProperty('adBlue.c1');
    expect(validarInformeTemporal(form({ cierres: [fila({ adBlue: true, adBlueLitros: '20' })] }))).toEqual({});
  });

  it('máximo 10 personas por actividad (las filas vacías no cuentan)', () => {
    const diez = Array.from({ length: 10 }, (_, i) => persona(`P${i}`));
    expect(validarInformeTemporal(form({ personal1: [...diez, persona('  ')] }))).toEqual({});
    expect(validarInformeTemporal(form({ personal1: [...diez, persona('Once')] }))).toHaveProperty('personal1');
    expect(validarInformeTemporal(form({ actividad2: 'Riego', personal2: [...diez, persona('Once')] }))).toHaveProperty(
      'personal2',
    );
  });

  it('personal en la actividad 2 exige la actividad 2', () => {
    expect(validarInformeTemporal(form({ personal2: [persona('Juan')] }))).toHaveProperty('personal2');
    expect(validarInformeTemporal(form({ actividad2: 'Riego', personal2: [persona('Juan')] }))).toEqual({});
  });
});

describe('armarInformeTemporal', () => {
  it('arma un cierre por tarjeta con su closeClientId y separa las fotos', () => {
    const foto = new File(['x'], 'surtidor.jpg', { type: 'image/jpeg' });
    const { informe, fotos } = armarInformeTemporal(
      form({
        actividad2: ' Riego ',
        personal1: [{ operatorId: 'op1', nombre: 'Juan Rojas' }, persona(' ')],
        personal2: [persona(' Ana ')],
        observaciones: '  ',
        cierres: [
          fila({ litros: '48,493', foto, fotoCapturada: new Date('2026-11-24T17:00:00.000Z') }),
          fila({ cardId: 'c2', liviano: true, final: '45200', adBlue: true, adBlueLitros: '5' }),
        ],
      }),
      { id: 'inf-1', closeClientIdDe: (cardId) => `cc-${cardId}`, ahora: new Date('2026-11-24T18:00:00.000Z') },
    );
    expect(informe).toMatchObject({
      id: 'inf-1',
      fecha: '2026-11-24',
      turno: 'DIURNO',
      actividad1: 'Limpieza de cancha',
      actividad2: 'Riego',
      personal: [
        { actividad: 1, operatorId: 'op1', nombre: 'Juan Rojas' },
        { actividad: 2, operatorId: null, nombre: 'Ana' },
      ],
      supervisorResponsable1: 'Pedro Soto',
      fotosEnviadas: false,
      infoSubidaApp: false,
    });
    expect(informe.observaciones).toBeUndefined();
    expect(informe.supervisorResponsable2).toBeUndefined();
    expect(informe.cierres).toEqual([
      {
        cardId: 'c1',
        closeClientId: 'cc-c1',
        valorFinal: 1210,
        fuelLiters: 48.493,
        adBlue: false,
        capturedAt: '2026-11-24T18:00:00.000Z',
        photoCapturedAt: '2026-11-24T17:00:00.000Z',
      },
      // Un liviano no lleva AdBlue aunque el estado lo diga.
      {
        cardId: 'c2',
        closeClientId: 'cc-c2',
        valorFinal: 45200,
        fuelLiters: 0,
        capturedAt: '2026-11-24T18:00:00.000Z',
      },
    ]);
    expect(fotos).toEqual({ c1: foto });
  });
});

describe('cardIdsEnInformePendiente', () => {
  it('junta las tarjetas de los informes que siguen en la cola', () => {
    const ops = [
      {
        type: 'httpWrite',
        endpoint: 'informeTemporal.create',
        body: { cierres: [{ cardId: 'c1' }, { cardId: 'c2' }] },
      },
      { type: 'httpWrite', endpoint: 'shiftCard.edit', body: { cierres: [{ cardId: 'x' }] } },
      { type: 'openCard', id: 'c3' },
    ] as unknown as OutboxOp[];
    expect([...cardIdsEnInformePendiente(ops)]).toEqual(['c1', 'c2']);
  });
});
