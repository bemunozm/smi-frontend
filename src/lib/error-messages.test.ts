import { describe, expect, it } from 'vitest';

import { mensajeErrorOperacion } from './error-messages';
import { DomainError } from './api-error';

describe('mensajeErrorOperacion', () => {
  it('EQUIPMENT_BUSY: muestra el mensaje del backend tal cual (trae quién y desde cuándo)', () => {
    const error = new DomainError('CA-011 está ocupado por Marcela Pizarro desde las 07:40', {
      code: 'EQUIPMENT_BUSY',
    });
    expect(mensajeErrorOperacion(error)).toBe('CA-011 está ocupado por Marcela Pizarro desde las 07:40');
  });

  it('OPERATOR_IN_USE: muestra el mensaje del backend tal cual (deliberadamente sin mapear)', () => {
    const error = new DomainError('El operador tiene trabajos extraordinarios registrados.', {
      code: 'OPERATOR_IN_USE',
    });
    expect(mensajeErrorOperacion(error)).toBe('El operador tiene trabajos extraordinarios registrados.');
  });

  it('HOURMETER_BELOW_INITIAL: usa el texto amigable mapeado por code', () => {
    const error = new DomainError('mensaje técnico', { code: 'HOURMETER_BELOW_INITIAL' });
    expect(mensajeErrorOperacion(error)).toBe('El horómetro final no puede ser menor que el inicial.');
  });

  it('OPERATOR_INACTIVE: mismo texto compartido con la asignación de equipos y trabajos extra', () => {
    const error = new DomainError('Operator op_1 is inactive', { code: 'OPERATOR_INACTIVE' });
    expect(mensajeErrorOperacion(error)).toBe('Ese operador ya no está activo. Elegí otro del catálogo.');
  });

  it('ALREADY_CLOSED: explica que otra persona cerró la tarjeta y que litros/foto no se enviaron', () => {
    const error = new DomainError('mensaje técnico', { code: 'ALREADY_CLOSED' });
    expect(mensajeErrorOperacion(error)).toContain('ya cerró esta tarjeta');
    expect(mensajeErrorOperacion(error)).toContain('registrar la carga de combustible por separado');
  });

  it.each([
    ['ID_CONFLICT', 'Ya existe una tarjeta con ese identificador. Reintentá la acción.'],
    ['INVALID_SHIFT_DATE', 'La fecha del turno no es válida — revisá la fecha y la hora del equipo.'],
    ['REPORT_RATE_LIMITED', 'Se mandaron demasiados reportes seguidos — esperá unos minutos y reintentá.'],
    ['PHOTO_MISSING', 'Falta la foto guardada para este cierre — descartalo y volvé a cerrar la tarjeta.'],
    ['INVALID_RESPONSE', 'Respuesta inesperada del servidor — reintentá más tarde o avisá si sigue pasando.'],
    [
      'CARD_NOT_FOUND',
      'La tarjeta no existe en el servidor (su apertura no llegó). Revisá la apertura pendiente o descartá este cierre.',
    ],
  ])('%s: usa el texto amigable mapeado por code', (code, esperado) => {
    expect(mensajeErrorOperacion(new DomainError('mensaje técnico', { code }))).toBe(esperado);
  });

  // Anexo 3 (cierre): códigos nuevos que la revisión final pidió cubrir con
  // mensaje amigable.
  it('SHIFT_CARD_CLOSE_ELSEWHERE: avisa que la tarjeta se cerró por otra vía', () => {
    const error = new DomainError('mensaje técnico', { code: 'SHIFT_CARD_CLOSE_ELSEWHERE' });
    expect(mensajeErrorOperacion(error)).toContain('se cerró por otra vía');
  });

  it('NO_CARDS: avisa que no hay tarjetas para el reporte', () => {
    const error = new DomainError('mensaje técnico', { code: 'NO_CARDS' });
    expect(mensajeErrorOperacion(error)).toBe(
      'No hay tarjetas para incluir en el reporte de salida — abrí o cerrá al menos un equipo antes de enviarlo.',
    );
  });

  it('SHIFT_NOT_FOUND: avisa que el turno del reporte no existe en el servidor', () => {
    const error = new DomainError('mensaje técnico', { code: 'SHIFT_NOT_FOUND' });
    expect(mensajeErrorOperacion(error)).toContain('no existe en el servidor');
  });

  it('sin code ni DomainError, cae al mensaje genérico de Error', () => {
    expect(mensajeErrorOperacion(new Error('boom'))).toBe('boom');
  });

  it('un valor no-Error cae al fallback genérico', () => {
    expect(mensajeErrorOperacion('rareza')).toBe('No se pudo completar la operación.');
  });

  it('acepta un fallback distinto por caller', () => {
    expect(mensajeErrorOperacion('rareza', 'No se pudo actualizar la asignación.')).toBe(
      'No se pudo actualizar la asignación.',
    );
  });
});
