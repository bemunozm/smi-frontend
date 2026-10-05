import { describe, expect, it } from 'vitest';

import { FORBIDDEN_MESSAGE, mensajeErrorFormulario, mensajeErrorOperacion } from './error-messages';
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

  it('HOURMETER_BELOW_INITIAL: muestra el mensaje del backend (trae las dos lecturas)', () => {
    const error = new DomainError('La lectura final (1300) no puede ser menor que la inicial (1310)', {
      code: 'HOURMETER_BELOW_INITIAL',
    });
    expect(mensajeErrorOperacion(error)).toBe('La lectura final (1300) no puede ser menor que la inicial (1310)');
  });

  it('INSUFFICIENT_STOCK: muestra el mensaje del backend (disponible, solicitado y otras sucursales)', () => {
    const mensaje =
      'Existencia insuficiente de "Aceite" en Casa Matriz: disponible 16, solicitado 20. Hay 5 en otras sucursales.';
    expect(mensajeErrorOperacion(new DomainError(mensaje, { code: 'INSUFFICIENT_STOCK', status: 409 }))).toBe(mensaje);
  });

  it('un 403 (el backend lo manda en inglés) sale en español', () => {
    const error = new DomainError('Insufficient permissions', { code: 'FORBIDDEN', status: 403 });
    expect(mensajeErrorOperacion(error)).toBe(FORBIDDEN_MESSAGE);
    expect(mensajeErrorFormulario(error)).toBe(FORBIDDEN_MESSAGE);
  });

  it('STALE_UPDATE en la hoja de sincronización: conserva los campos que nombra el servidor y dice qué elegir', () => {
    const error = new DomainError('El registro cambió mientras lo editabas (existencia, estado). Revisa los datos.', {
      code: 'STALE_UPDATE',
      status: 409,
    });
    const mensaje = mensajeErrorOperacion(error);
    expect(mensaje).toContain('(existencia, estado)');
    expect(mensaje).toContain('Sobrescribir');
  });

  it('STALE_UPDATE sin campos en el mensaje del servidor: texto genérico', () => {
    const mensaje = mensajeErrorOperacion(new DomainError('stale', { code: 'STALE_UPDATE', status: 409 }));
    expect(mensaje).toBe(
      'Otra persona cambió estos datos mientras tanto. Elegí Sobrescribir para aplicar tu cambio igual, o Descartar para quedarte con lo que hay.',
    );
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
    ['ID_CONFLICT', 'Ya existe un registro con ese identificador. Descartá este registro en Sincronización y volvé a crearlo.'],
    ['INVALID_SHIFT_DATE', 'La fecha del turno no es válida — revisá la fecha y la hora del equipo.'],
    ['REPORT_RATE_LIMITED', 'Se mandaron demasiados reportes seguidos — esperá unos minutos y reintentá.'],
    ['PHOTO_MISSING', 'Falta la foto guardada de este registro — descartalo y volvé a registrarlo.'],
    ['INVALID_RESPONSE', 'Respuesta inesperada del servidor — reintentá más tarde o avisá si sigue pasando.'],
    [
      'CARD_NOT_FOUND',
      'La tarjeta no existe en el servidor (su apertura no llegó). Revisá la apertura pendiente o descartá este cierre.',
    ],
  ])('%s: usa el texto amigable mapeado por code', (code, esperado) => {
    expect(mensajeErrorOperacion(new DomainError('mensaje técnico', { code }))).toBe(esperado);
  });

  // Códigos de cierre de tarjeta y reporte de salida con mensaje amigable.
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

describe('mensajeErrorFormulario', () => {
  it('STALE_UPDATE: no manda a una hoja de sincronización que el formulario ya no tiene', () => {
    const mensaje = mensajeErrorFormulario(new DomainError('x', { code: 'STALE_UPDATE', status: 409 }));

    expect(mensaje).toContain('Actualizá la pantalla');
    expect(mensaje).not.toContain('Sobrescribir');
  });

  it('STALE_UPDATE: nombra los campos que cambió la otra persona', () => {
    const error = new DomainError('El registro cambió mientras lo editabas (Estado, Título). Revisa.', {
      code: 'STALE_UPDATE',
      status: 409,
    });
    expect(mensajeErrorFormulario(error)).toContain('(Estado, Título)');
  });

  it('ID_CONFLICT: tampoco habla de Sincronización', () => {
    expect(mensajeErrorFormulario(new DomainError('x', { code: 'ID_CONFLICT', status: 409 }))).not.toContain(
      'Sincronización',
    );
  });

  it.each([
    ['ALREADY_CLOSED', 'ya fue cerrado'],
    ['CARD_NOT_FOUND', 'ya no existe'],
    ['SHIFT_CARD_CLOSE_ELSEWHERE', 'desde Terreno'],
  ])('%s: texto del cierre de turno de Flota', (code, texto) => {
    expect(mensajeErrorFormulario(new DomainError('x', { code }))).toContain(texto);
  });

  it('INSUFFICIENT_STOCK: el formulario muestra lo que dice el servidor', () => {
    const mensaje = 'Existencia insuficiente de "Aceite": disponible 16, solicitado 20.';
    expect(mensajeErrorFormulario(new DomainError(mensaje, { code: 'INSUFFICIENT_STOCK', status: 409 }))).toBe(mensaje);
  });

  it('FILE_TYPE_NOT_ALLOWED: dice qué formatos sirven', () => {
    expect(mensajeErrorFormulario(new DomainError('x', { code: 'FILE_TYPE_NOT_ALLOWED' }))).toContain(
      'JPG, PNG, WebP o PDF',
    );
  });

  it('lo demás se comporta como mensajeErrorOperacion (409 sin code: el mensaje del servidor)', () => {
    expect(mensajeErrorFormulario(new DomainError('Ya existe una sucursal con ese nombre', { status: 409 }))).toBe(
      'Ya existe una sucursal con ese nombre',
    );
    expect(mensajeErrorFormulario('rareza', 'Fallback propio')).toBe('Fallback propio');
  });
});
