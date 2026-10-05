import { useCallback, useEffect, useState } from 'react';

import { db } from './db';
import { logger } from '../lib/logger';

export type OfflineDbStatus = 'opening' | 'ready' | 'failed';

/**
 * Abre la base local (la cola de registros sin enviar) al arrancar y dice si pudo.
 * Dexie la abre sola en la primera consulta, pero entonces un fallo (la migración
 * de versión no pudo correr por falta de espacio, el navegador bloquea IndexedDB,
 * una pestaña vieja la tiene bloqueada) sale como un error suelto de cada consulta
 * y la pantalla queda rota sin decir por qué. Con el estado a la vista la app
 * puede mostrar qué hacer.
 *
 * `retry` vuelve a intentar abrirla sin recargar la página.
 */
export function useOfflineDb(): { status: OfflineDbStatus; retry: () => void } {
  const [status, setStatus] = useState<OfflineDbStatus>('opening');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus('opening');
    db.open().then(
      () => {
        if (!cancelled) setStatus('ready');
      },
      (error: unknown) => {
        logger.error('No se pudo abrir la base local de registros sin enviar.', error);
        if (!cancelled) setStatus('failed');
      },
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { status, retry };
}
