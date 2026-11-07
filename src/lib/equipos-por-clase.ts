import type { OpcionSelector } from '../components/terreno/ui';
import type { EquipmentClass } from '../types/equipment';

/** Qué grupo va arriba en el selector de equipo del taller. */
export type PrimeroClase = 'HEAVY' | 'LIGHT';

const TITULO_GRUPO: Record<EquipmentClass, string> = {
  HEAVY: 'Equipos pesados',
  LIGHT: 'Equipos livianos',
};

/** Clave de `localStorage`: la preferencia queda en el dispositivo del mantenedor. */
export const CLAVE_PRIMERO_CLASE = 'smi.taller.equiposPrimero';

export function leerPrimeroClase(): PrimeroClase {
  try {
    return localStorage.getItem(CLAVE_PRIMERO_CLASE) === 'LIGHT' ? 'LIGHT' : 'HEAVY';
  } catch {
    return 'HEAVY';
  }
}

export function guardarPrimeroClase(valor: PrimeroClase): void {
  try {
    localStorage.setItem(CLAVE_PRIMERO_CLASE, valor);
  } catch {
    // Sin almacenamiento (modo privado): la preferencia dura lo que la pantalla.
  }
}

/**
 * Opciones del selector de equipo separadas en «Equipos pesados» y «Equipos
 * livianos» (pedido del 06/11): hay mantenedores que trabajan más con unos
 * que con otros, así que cada uno elige cuál grupo ve primero. Dentro de cada
 * grupo se mantiene el orden recibido. Si todos son de una sola clase, igual
 * se rotula el grupo (deja claro qué se está viendo).
 */
export function opcionesEquipoPorClase<T extends { equipmentClass: EquipmentClass }>(
  equipos: readonly T[],
  primero: PrimeroClase,
  opcion: (equipo: T) => OpcionSelector,
): OpcionSelector[] {
  const orden: EquipmentClass[] = primero === 'LIGHT' ? ['LIGHT', 'HEAVY'] : ['HEAVY', 'LIGHT'];
  return orden.flatMap((clase) =>
    equipos
      .filter((e) => e.equipmentClass === clase)
      .map((e) => ({ ...opcion(e), grupo: TITULO_GRUPO[clase] })),
  );
}
