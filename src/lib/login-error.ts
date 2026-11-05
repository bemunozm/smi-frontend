/** Lo que el cliente de Better Auth devuelve cuando falla el login. */
export interface LoginError {
  message?: string;
  status?: number;
  code?: string;
}

/**
 * El mensaje de un login fallido, en español. Better Auth responde en inglés
 * («Too many requests…», «Invalid email or password»), así que se traduce por
 * código o estado; el bloqueo por cuenta (`ACCOUNT_TEMPORARILY_LOCKED`, ver
 * `login-guard.ts` del backend) ya viene en español y con los minutos.
 */
export function mensajeErrorLogin(error: LoginError): string {
  if (error.code === 'ACCOUNT_TEMPORARILY_LOCKED' && error.message) return error.message;
  if (error.status === 429) {
    return 'Hubo muchos intentos seguidos desde esta red. Espera un minuto y vuelve a intentar.';
  }
  if (error.code === 'INVALID_EMAIL_OR_PASSWORD' || error.status === 401) {
    return 'Correo o contraseña incorrectos.';
  }
  return error.message ?? 'No se pudo iniciar sesión. Verifica tus credenciales.';
}
