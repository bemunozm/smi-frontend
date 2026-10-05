import { toast } from '@heroui/react';

/**
 * Aviso tras encolar un registro en el outbox. Encolar solo garantiza que
 * quedó guardado en el equipo — el envío real pasa después en segundo plano
 * (`offline/replay.ts`) —, así que el texto nunca promete que ya llegó al
 * servidor: con señal dice que se envía solo, sin señal que espera la
 * conexión.
 */
export function avisarGuardadoEnCola(): void {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    toast.success('Guardado en el equipo. Se enviará al volver la señal.');
    return;
  }
  toast.success('Guardado. Se enviará automáticamente.');
}
