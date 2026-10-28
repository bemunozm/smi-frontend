/**
 * Marca local "este usuario activó el push EN ESTE dispositivo", por `userId`
 * (clave `smi.push-optin.<userId>` en localStorage). Es lo que permite que el
 * re-login resuscriba en silencio (`push-device.ts#resubscribeIfOptedIn`)
 * después de que el logout desuscribió el dispositivo: el permiso del sistema
 * ya está concedido, así que no hace falta ningún gesto nuevo.
 *
 * El logout NO la borra a propósito (diseño: el apagado que persiste es el
 * del toggle, que sí la borra vía `disablePush`). Todo va en try/catch:
 * localStorage puede lanzar en modo privado y el push es un extra, nunca
 * puede romper la app.
 */
const KEY_PREFIX = 'smi.push-optin.';

export function readPushOptIn(userId: string): boolean {
  try {
    return localStorage.getItem(`${KEY_PREFIX}${userId}`) === '1';
  } catch {
    return false;
  }
}

export function savePushOptIn(userId: string): void {
  try {
    localStorage.setItem(`${KEY_PREFIX}${userId}`, '1');
  } catch {
    // Sin storage no hay resuscripción automática, pero el toggle sigue
    // funcionando en la sesión actual.
  }
}

export function clearPushOptIn(userId: string): void {
  try {
    localStorage.removeItem(`${KEY_PREFIX}${userId}`);
  } catch {
    // Igual que arriba: best-effort.
  }
}
