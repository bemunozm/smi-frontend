import { describe, expect, it } from 'vitest';

import { mensajeErrorLogin } from './login-error';

describe('mensajeErrorLogin', () => {
  it('el bloqueo por cuenta muestra el mensaje del servidor (ya en español, con los minutos)', () => {
    const message = 'Demasiados intentos fallidos con esta cuenta. Espera 15 minutos y vuelve a intentar.';
    expect(mensajeErrorLogin({ status: 429, code: 'ACCOUNT_TEMPORARILY_LOCKED', message })).toBe(message);
  });

  it('el límite por red se traduce en vez de mostrar el «Too many requests» de Better Auth', () => {
    expect(mensajeErrorLogin({ status: 429, message: 'Too many requests. Please try again later.' })).toBe(
      'Hubo muchos intentos seguidos desde esta red. Espera un minuto y vuelve a intentar.',
    );
  });

  it('clave o correo equivocados', () => {
    expect(mensajeErrorLogin({ status: 401, code: 'INVALID_EMAIL_OR_PASSWORD', message: 'Invalid email or password' })).toBe(
      'Correo o contraseña incorrectos.',
    );
  });

  it('cualquier otro error conserva su mensaje', () => {
    expect(mensajeErrorLogin({ message: 'Sin conexión' })).toBe('Sin conexión');
    expect(mensajeErrorLogin({})).toBe('No se pudo iniciar sesión. Verifica tus credenciales.');
  });
});
