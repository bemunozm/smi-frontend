import { describe, expect, it } from 'vitest';
import { ZodError, z } from 'zod';

import { DomainError, extractBackendCode, toDomainError } from './api-error';

/** Error "de axios" tal como lo entrega el backend — mismo helper que usan
 * `BranchAPI.test.ts`/`OperatorAPI.test.ts`. */
function axiosError(status: number, data: unknown): Error {
  return Object.assign(new Error('Request failed'), {
    isAxiosError: true,
    response: { status, data },
  });
}

describe('extractBackendCode', () => {
  it('devuelve el code cuando el body lo trae explícito', () => {
    expect(extractBackendCode({ message: 'Ocupado', code: 'EQUIPMENT_BUSY' })).toBe('EQUIPMENT_BUSY');
  });

  it('devuelve undefined si no hay code, sin inventarlo a partir del message', () => {
    expect(extractBackendCode({ message: 'Ocupado' })).toBeUndefined();
  });

  it('devuelve undefined para valores que no son objeto', () => {
    expect(extractBackendCode(null)).toBeUndefined();
    expect(extractBackendCode('texto')).toBeUndefined();
  });

  it('devuelve undefined si `code` no es string', () => {
    expect(extractBackendCode({ code: 42 })).toBeUndefined();
  });
});

describe('toDomainError', () => {
  it('devuelve un DomainError con el message del backend y su code/status (Módulo A: EQUIPMENT_BUSY)', () => {
    const error = toDomainError(
      axiosError(409, { message: 'CA-011 está ocupado por Marcela Pizarro desde las 07:40', code: 'EQUIPMENT_BUSY' }),
      'No se pudo abrir la tarjeta.',
    );

    expect(error).toBeInstanceOf(DomainError);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('CA-011 está ocupado por Marcela Pizarro desde las 07:40');
    expect(error.code).toBe('EQUIPMENT_BUSY');
    expect(error.status).toBe(409);
  });

  it('deja code/status undefined cuando el backend no los trae', () => {
    const error = toDomainError(axiosError(500, {}), 'Fallback.');

    expect(error.message).toBe('Fallback.');
    expect(error.code).toBeUndefined();
    expect(error.status).toBe(500);
  });

  it('sigue funcionando para los callers existentes que solo leen `.message` (instanceof Error)', () => {
    const error = toDomainError(axiosError(400, { message: 'Datos inválidos' }), 'Fallback.');

    // Patrón de los ~40 callers existentes (`error instanceof Error ? error.message : fallback`).
    const mensaje = error instanceof Error ? error.message : 'nunca';
    expect(mensaje).toBe('Datos inválidos');
  });

  it('un ZodError se traduce a "Respuesta inválida" con code INVALID_RESPONSE (para que el replay lo clasifique como negocio, no como red)', () => {
    const schema = z.object({ id: z.string() });
    const result = schema.safeParse({});
    expect(result.success).toBe(false);

    const error = toDomainError(result.error as ZodError, 'Fallback.');

    expect(error.message).toMatch(/Respuesta inválida/);
    expect(error.code).toBe('INVALID_RESPONSE');
    expect(error.status).toBeUndefined();
  });

  it('un error desconocido cae al fallback', () => {
    const error = toDomainError('algo raro', 'Fallback amigable.');
    expect(error.message).toBe('Fallback amigable.');
  });
});
