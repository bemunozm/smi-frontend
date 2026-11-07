import type { OpcionSelector } from '../components/terreno/ui';

/** Lo mínimo de un operador para armar el selector. */
interface OperadorElegible {
  id: string;
  name: string;
  supervisorHabitualId?: string | null;
}

/**
 * Opciones del selector de operador para un supervisor (pedido del cliente,
 * 06/11): primero «Tus operadores» —los que salen habitualmente con él, ver
 * `Operator.supervisorHabitualId`— y después «Otros operadores», porque a
 * veces un operador trabaja con otro supervisor. Sin operadores habituales
 * (o sin supervisor), la lista va de corrido, igual que antes.
 */
export function opcionesOperador(
  operadores: readonly OperadorElegible[],
  supervisorId: string | null | undefined,
): OpcionSelector[] {
  const opcion = (o: OperadorElegible): OpcionSelector => ({ valor: o.id, titulo: o.name });
  const tuyos = supervisorId ? operadores.filter((o) => o.supervisorHabitualId === supervisorId) : [];
  if (tuyos.length === 0) return operadores.map(opcion);
  const otros = operadores.filter((o) => o.supervisorHabitualId !== supervisorId);
  return [
    ...tuyos.map((o) => ({ ...opcion(o), grupo: 'Tus operadores' })),
    ...otros.map((o) => ({ ...opcion(o), grupo: 'Otros operadores' })),
  ];
}
