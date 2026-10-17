import { describe, expect, it } from 'vitest';

import type { ChecklistItem } from '../../types/daily-checklist';
import {
  ENTRADA_VACIA,
  armarEnvio,
  cuentaFotos,
  entradasDesdeDetalle,
  motivosBloqueo,
  noEsNumero,
  pendientesItem,
  soloNumero,
  type EntradaForm,
} from './checklist-form';

const item = (id: string, extra: Partial<ChecklistItem> = {}): ChecklistItem => ({
  id,
  name: id,
  position: 0,
  requiresPhoto: false,
  requiresTemperature: false,
  ...extra,
});

const ITEMS = [
  item('ac', { name: 'Aire acondicionado', requiresPhoto: true, requiresTemperature: true }),
  item('neumaticos', { name: 'Neumáticos' }),
  item('espejos', { name: 'Espejos' }),
];
const foto = () => new File(['x'], 'f.jpg', { type: 'image/jpeg' });
const e = (cambio: Partial<EntradaForm>): EntradaForm => ({ ...ENTRADA_VACIA, ...cambio });
const EQUIPO = { equipmentId: 'eq_1', counter: '2150', branchId: 'faena' };

describe('checklist diario (formulario)', () => {
  it('las fotos obligatorias son las de los críticos con mantención', () => {
    const soloRevisados = {
      ac: e({ status: 'CHECKED' }),
      neumaticos: e({ status: 'CHECKED' }),
      espejos: e({ status: 'NOT_CHECKED' }),
    };
    expect(cuentaFotos(ITEMS, soloRevisados)).toEqual({ declarados: 2, obligatorias: 0, conFoto: 0 });

    const conMantenciones = {
      ac: e({ status: 'MAINTAINED', description: 'Recarga', photos: [foto()] }),
      neumaticos: e({ status: 'MAINTAINED', description: 'Se infló' }),
      espejos: e({ status: 'CHECKED' }),
    };
    // Neumáticos no es crítico: su mantención no pide foto.
    expect(cuentaFotos(ITEMS, conMantenciones)).toEqual({ declarados: 3, obligatorias: 1, conFoto: 1 });
  });

  it('un crítico con mantención y sin foto no deja enviar', () => {
    const entradas = {
      ac: e({ status: 'MAINTAINED', description: 'Recarga', temperature: '6' }),
      neumaticos: e({ status: 'CHECKED' }),
      espejos: e({ status: 'CHECKED' }),
    };
    expect(motivosBloqueo(ITEMS, entradas, EQUIPO)).toEqual([
      '«Aire acondicionado»: falta la foto obligatoria de la mantención.',
    ]);
  });

  it('los «Se revisó» sin foto no frenan el envío', () => {
    const entradas = {
      ac: e({ status: 'CHECKED', temperature: '6' }),
      neumaticos: e({ status: 'CHECKED' }),
      espejos: e({ status: 'CHECKED' }),
    };
    expect(motivosBloqueo(ITEMS, entradas, EQUIPO)).toEqual([]);
  });

  it('dice por qué no se puede enviar', () => {
    const motivos = motivosBloqueo(
      ITEMS,
      {
        ac: e({ status: 'MAINTAINED', description: 'Recarga' }),
        neumaticos: e({ status: 'MAINTAINED', description: '' }),
      },
      { equipmentId: '', counter: '' },
    );
    expect(motivos).toEqual(
      expect.arrayContaining([
        'Elige el equipo.',
        'Falta marcar «Espejos».',
        '«Neumáticos»: describe la mantención.',
        '«Aire acondicionado»: falta la foto obligatoria de la mantención.',
        '«Aire acondicionado»: anota la temperatura.',
      ]),
    );
  });

  it('el horómetro es obligatorio', () => {
    const motivos = motivosBloqueo(ITEMS, {}, { ...EQUIPO, counter: ' ' });
    expect(motivos).toContain('Anota el horómetro u odómetro del equipo.');
  });

  it('no deja un horómetro menor que la lectura con que partió el equipo', () => {
    const motivos = motivosBloqueo(ITEMS, {}, { ...EQUIPO, counter: '2099', lecturaInicial: 2100 });
    expect(motivos).toContain('El horómetro u odómetro es menor que la lectura con que partió el equipo.');
    expect(motivosBloqueo(ITEMS, {}, { ...EQUIPO, counter: '2100', lecturaInicial: 2100 })).not.toContain(
      'El horómetro u odómetro es menor que la lectura con que partió el equipo.',
    );
  });

  it('el campo no deja pasar letras ni símbolos', () => {
    expect(soloNumero("960000'9¿'¿'")).toBe('9600009');
    expect(soloNumero('abc')).toBe('');
    expect(soloNumero('-6,5°', { negativo: true })).toBe('-6,5');
    expect(soloNumero('6-5', { negativo: true })).toBe('65');
  });

  it('lo que no se lee como número es un error, no un campo vacío', () => {
    expect(noEsNumero('1.2.3')).toBe(true);
    expect(noEsNumero(',')).toBe(true);
    expect(noEsNumero('')).toBe(false);
    expect(noEsNumero('96500')).toBe(false);
    const motivos = motivosBloqueo(ITEMS, {}, { ...EQUIPO, counter: '96.500.1', lecturaInicial: 96500 });
    expect(motivos).toContain('El horómetro u odómetro no es un número válido.');
  });

  it('con punto de miles se lee como decimal y queda bajo la lectura: no pasa', () => {
    const motivos = motivosBloqueo(ITEMS, {}, { ...EQUIPO, counter: '96.500', lecturaInicial: 96500 });
    expect(motivos).toContain('El horómetro u odómetro es menor que la lectura con que partió el equipo.');
  });

  it('cada tarjeta dice qué le falta; la foto solo si es crítico con mantención', () => {
    expect(pendientesItem(ITEMS[0], e({ status: 'CHECKED' }))).toEqual(['Falta temperatura']);
    expect(pendientesItem(ITEMS[0], e({ status: 'MAINTAINED' }))).toEqual([
      'Falta qué se hizo',
      'Falta temperatura',
      'Falta foto',
    ]);
    expect(pendientesItem(ITEMS[0], e({ status: 'NOT_CHECKED' }))).toEqual([]);
    expect(pendientesItem(ITEMS[1], e({ status: 'MAINTAINED' }))).toEqual(['Falta qué se hizo']);
    expect(pendientesItem(ITEMS[1], e({ status: 'CHECKED' }))).toEqual([]);
  });

  it('un checklist completo no tiene motivos', () => {
    const entradas = {
      ac: e({ status: 'CHECKED', temperature: '6,5', photos: [foto()] }),
      neumaticos: e({ status: 'MAINTAINED', description: 'Se infló', photos: [foto()] }),
      espejos: e({ status: 'NOT_CHECKED' }),
    };
    expect(motivosBloqueo(ITEMS, entradas, EQUIPO)).toEqual([]);
  });

  it('arma el envío con cada foto en su campo anidado', () => {
    const entradas = {
      ac: e({ status: 'CHECKED', temperature: '6,5', photos: [foto(), foto()] }),
      neumaticos: e({
        status: 'MAINTAINED',
        description: ' Se infló ',
        photos: [foto()],
        supplies: [{ insumoId: 'item_1', cantidad: '2' }],
      }),
      espejos: e({ status: 'NOT_CHECKED', note: 'no se manda' }),
    };
    const { input, files } = armarEnvio(ITEMS, entradas, {
      equipmentId: 'eq_1',
      date: '2026-10-14',
      counter: '2.150',
      branchId: 'faena',
    });
    expect(files.map((f) => f.field)).toEqual([
      'entries.0.photoKeys.0',
      'entries.0.photoKeys.1',
      'entries.1.photoKeys.0',
    ]);
    expect(input).toEqual({
      equipmentId: 'eq_1',
      date: '2026-10-14',
      counter: 2.15,
      branchId: 'faena',
      entries: [
        { itemId: 'ac', status: 'CHECKED', temperature: 6.5 },
        {
          itemId: 'neumaticos',
          status: 'MAINTAINED',
          description: 'Se infló',
          supplies: [{ insumoId: 'item_1', cantidad: 2 }],
        },
        { itemId: 'espejos', status: 'NOT_CHECKED' },
      ],
    });
  });

  it('al corregir, las fotos que ya estaban van por su id y las nuevas a continuación', () => {
    const entradas = {
      ac: e({
        status: 'MAINTAINED',
        description: 'Recarga',
        temperature: '6',
        photos: [{ id: 'vieja.jpg', url: 'u' }, foto()],
      }),
      neumaticos: e({ status: 'CHECKED' }),
      espejos: e({ status: 'CHECKED' }),
    };
    const { input, files } = armarEnvio(ITEMS, entradas, { equipmentId: 'eq_1', date: '2026-10-16', counter: '2150' });
    expect(input.entries[0]).toMatchObject({ photoKeys: ['vieja.jpg'] });
    expect(files.map((x) => x.field)).toEqual(['entries.0.photoKeys.1']);
  });

  it('un checklist rechazado vuelve al formulario con lo que tenía', () => {
    const entradas = entradasDesdeDetalle({
      entries: [
        {
          itemId: 'ac',
          itemName: 'Aire acondicionado',
          status: 'MAINTAINED',
          description: 'Recarga',
          note: 'Ojo con el filtro',
          temperature: 6.5,
          photos: [{ id: 'a.jpg', url: 'u' }],
          supplies: [{ itemId: 'item_1', sku: 'GAS', name: 'Gas', quantity: 1.5 }],
        },
      ],
    } as never);
    expect(entradas.ac).toEqual({
      status: 'MAINTAINED',
      description: 'Recarga',
      note: 'Ojo con el filtro',
      temperature: '6,5',
      photos: [{ id: 'a.jpg', url: 'u' }],
      supplies: [{ insumoId: 'item_1', cantidad: '1,5' }],
    });
  });
});
