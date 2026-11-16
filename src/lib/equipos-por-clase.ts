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
export function opcionesEquipoPorClase<T extends { equipmentClass?: EquipmentClass | null }>(
  equipos: readonly T[],
  primero: PrimeroClase,
  opcion: (equipo: T) => OpcionSelector,
): OpcionSelector[] {
  const orden: EquipmentClass[] = primero === 'LIGHT' ? ['LIGHT', 'HEAVY'] : ['HEAVY', 'LIGHT'];
  return orden.flatMap((clase) =>
    equipos
      // Sin clase conocida va con los pesados (la clase por defecto del catálogo).
      .filter((e) => (e.equipmentClass === 'LIGHT' ? 'LIGHT' : 'HEAVY') === clase)
      .map((e) => ({ ...opcion(e), grupo: TITULO_GRUPO[clase] })),
  );
}

/** Título del grupo de una clase («Equipos pesados» / «Equipos livianos»). */
export function tituloGrupoClase(clase: EquipmentClass): string {
  return TITULO_GRUPO[clase];
}

/**
 * Pesados primero y después livianos (pedido del cliente, 16/11/2026): en los
 * selectores que traen las dos clases se separan de un vistazo. Dentro de
 * cada clase se mantiene el orden recibido. Un equipo sin clase conocida va
 * con los pesados (la clase por defecto del catálogo).
 */
export function pesadosPrimero<T extends { equipmentClass?: EquipmentClass | null }>(equipos: readonly T[]): T[] {
  const rango = (e: T) => (e.equipmentClass === 'LIGHT' ? 1 : 0);
  return equipos
    .map((e, i) => ({ e, i }))
    .sort((a, b) => rango(a.e) - rango(b.e) || a.i - b.i)
    .map(({ e }) => e);
}

/** Pesados y livianos agrupados de a clase, en ese orden. */
export function gruposPorClase<T extends { equipmentClass?: EquipmentClass | null }>(
  equipos: readonly T[],
): { clase: EquipmentClass; titulo: string; equipos: T[] }[] {
  return (['HEAVY', 'LIGHT'] as const)
    .map((clase) => ({
      clase,
      titulo: TITULO_GRUPO[clase],
      equipos: equipos.filter((e) => (e.equipmentClass === 'LIGHT' ? 'LIGHT' : 'HEAVY') === clase),
    }))
    .filter((g) => g.equipos.length > 0);
}
