import { describe, expect, it } from 'vitest';

import {
  aEntrada,
  agregarHito,
  alternarMarca,
  borradorDesde,
  columnas,
  filaVacia,
  HITOS_SUGERIDOS,
  leerNumero,
  problemaDe,
  quitarHito,
  type PautaBorrador,
} from './maintenance-plan';

const base = (): PautaBorrador => ({
  milestones: [250, 500, 2000],
  initialMilestone: '',
  alertBefore: '',
  items: [{ ...filaVacia(), key: 'a', kind: 'ACEITE', description: 'Aceite motor', quantity: '24', unit: 'LT', milestones: [250, 2000] }],
});

describe('borrador de la pauta', () => {
  it('una pauta nueva arranca con los hitos del ejemplo del cliente', () => {
    expect(borradorDesde(undefined).milestones).toEqual(HITOS_SUGERIDOS);
  });

  it('agrega hitos en orden y no repite', () => {
    const b = agregarHito(agregarHito(base(), 1000), 1000);
    expect(b.milestones).toEqual([250, 500, 1000, 2000]);
  });

  /** El servidor rechaza una marca en un hito que no existe: quitar el hito quita sus marcas. */
  it('quitar un hito quita también sus marcas', () => {
    const b = quitarHito(base(), 2000);
    expect(b.milestones).toEqual([250, 500]);
    expect(b.items[0].milestones).toEqual([250]);
  });

  it('marca y desmarca una casilla', () => {
    const marcada = alternarMarca(base(), 'a', 500);
    expect(marcada.items[0].milestones).toEqual([250, 500, 2000]);
    expect(alternarMarca(marcada, 'a', 500).items[0].milestones).toEqual([250, 2000]);
  });

  it('dibuja el servicio inicial como primera columna', () => {
    expect(columnas({ ...base(), initialMilestone: '50' }).map((c) => c.hito)).toEqual([50, 250, 500, 2000]);
  });

  it('lee cantidades en formato es-CL', () => {
    expect(leerNumero('26,2')).toBe(26.2);
    expect(leerNumero('1.500')).toBe(1500);
    expect(leerNumero('')).toBeNull();
  });
});

describe('problemaDe', () => {
  it('el aviso al mantenedor tiene que ser un entero positivo', () => {
    expect(problemaDe({ ...base(), alertBefore: '50' })).toBeNull();
    expect(problemaDe({ ...base(), alertBefore: '-5' })).toMatch(/aviso al mantenedor/);
  });

  it('una pauta completa se puede guardar', () => {
    expect(problemaDe(base())).toBeNull();
  });

  it('pide al menos un hito', () => {
    expect(problemaDe({ ...base(), milestones: [], items: [] })).toMatch(/al menos un hito/);
  });

  it('el servicio inicial va antes del primer hito', () => {
    expect(problemaDe({ ...base(), initialMilestone: '300' })).toMatch(/antes del primer hito/);
  });

  it('una fila marcada necesita descripción', () => {
    const b = base();
    b.items.push({ ...filaVacia(), milestones: [500] });
    expect(problemaDe(b)).toMatch(/necesita una descripción/);
  });
});

describe('aEntrada · filas guardadas', () => {
  /** El id ata lo registrado en el ciclo a la operación: no se puede perder al guardar. */
  it('manda el id de las filas que vinieron del servidor y no el de las nuevas', () => {
    const b = base();
    b.items[0] = { ...b.items[0], key: 'cmuk123' };
    b.items.push({ ...filaVacia(), description: 'Nueva', milestones: [250] });

    const items = aEntrada(b).items;
    expect(items[0].id).toBe('cmuk123');
    expect(items[1].id).toBeUndefined();
  });
});

describe('aEntrada', () => {
  it('convierte el borrador a la forma del servidor y omite las filas vacías', () => {
    const b = base();
    b.items.push(filaVacia());

    expect(aEntrada(b)).toEqual({
      milestones: [250, 500, 2000],
      initialMilestone: null,
      alertBefore: null,
      items: [{ id: 'a', kind: 'ACEITE', description: 'Aceite motor', quantity: 24, unit: 'LT', milestones: [250, 2000] }],
    });
  });
});
