/**
 * UUID v4 para el `id` (apertura) / `closeClientId` (cierre) de una tarjeta
 * de turno — lo genera el CLIENTE porque es la clave de idempotencia (ver
 * plan "Supervisión en Terreno" §Diseño: "permite que 'abrir tarjeta' sea
 * idempotente sin ida y vuelta al servidor antes de poder escribir, clave
 * para el flujo offline").
 *
 * `crypto.randomUUID()` (Web Crypto) solo existe en un CONTEXTO SEGURO
 * (HTTPS o `localhost`) — en el túnel HTTP temporal a la tablet de faena
 * (ver el plan, "No hay VPS ni dominio") puede faltar. `crypto.
 * getRandomValues()` sí está disponible en más contextos (no exige HTTPS),
 * así que arma el UUID a mano con el mismo algoritmo que usa
 * `crypto.randomUUID()` por dentro.
 */
export function generateUuid(): string {
  const cryptoObj = globalThis.crypto as Crypto | undefined;

  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return cryptoObj.randomUUID();
  }

  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    cryptoObj.getRandomValues(bytes);
    // Versión 4 (aleatoria) + variante RFC 4122 — los mismos dos ajustes de
    // bits que hace `crypto.randomUUID()` por dentro.
    bytes[6] = (bytes[6]! & 0x0f) | 0x40;
    bytes[8] = (bytes[8]! & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
    return [
      hex.slice(0, 4).join(''),
      hex.slice(4, 6).join(''),
      hex.slice(6, 8).join(''),
      hex.slice(8, 10).join(''),
      hex.slice(10, 16).join(''),
    ].join('-');
  }

  throw new Error('No hay una fuente de aleatoriedad criptográfica disponible en este navegador.');
}
