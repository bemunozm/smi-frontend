/**
 * Único punto por el que el código registra un error que NO se le muestra a la
 * persona (algo que falló en segundo plano y no cambia lo que ve). Un solo lugar
 * permite sumar después un destino (un servicio de errores) sin tocar a los
 * llamadores.
 */
export const logger = {
  error(message: string, error?: unknown): void {
    if (error === undefined) console.error(message);
    else console.error(message, error);
  },
};
