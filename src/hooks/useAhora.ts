import { useEffect, useState } from 'react';

/**
 * Hora actual, refrescada al ritmo que se pida (por defecto cada 30 s).
 *
 * La pantalla de Registro de equipo muestra el turno y la hora como encabezado
 * de lo que el supervisor está firmando. Un turno abierto a las 19:58 y cargado
 * a las 20:01 cambia de turno mientras la pantalla está abierta: sin refresco,
 * seguiría diciendo DIURNO y el registro quedaría mal atribuido justo en el
 * momento del día en que es más fácil equivocarse.
 */
export function useAhora(intervaloMs = 30_000): Date {
  const [ahora, setAhora] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), intervaloMs);
    return () => clearInterval(id);
  }, [intervaloMs]);

  return ahora;
}
