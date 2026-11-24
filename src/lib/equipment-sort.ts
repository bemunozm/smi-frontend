import type { SortMeta } from './sort-description';
import { EQUIPMENT_STATUS, type Equipment } from '../types/equipment';
import { compareText, type SortColumn } from './table-sort';

/** Columnas del listado de equipos que ordenan (el `id` es el de `Table.Column`). */
export const EQUIPMENT_SORT_COLUMNS = [
  'equipo',
  'patente',
  'clase',
  'sucursal',
  'uso',
  'combustible',
  'asignado',
  'estado',
] as const;

/** Opciones del «Ordenar por» del celular/tablet. */
export const EQUIPMENT_SORT_OPTIONS: SortMeta[] = [
  { id: 'equipo', label: 'Código', reading: 'text' },
  { id: 'patente', label: 'Patente', reading: 'text' },
  { id: 'clase', label: 'Clase y tipo', reading: ['pesados primero', 'livianos primero'] },
  { id: 'sucursal', label: 'Sucursal', reading: 'text' },
  { id: 'uso', label: 'Horómetro / km', reading: 'number' },
  { id: 'combustible', label: 'Combustible', reading: 'number' },
  { id: 'asignado', label: 'En uso por', reading: 'text' },
  { id: 'estado', label: 'Estado', reading: ['de operativo a fuera de servicio', 'de fuera de servicio a operativo'] },
];

/**
 * Quién tiene el equipo hoy, igual que la celda «En uso por»: manda la tarjeta
 * de turno abierta (el operador en un pesado, quien está a cargo en un liviano)
 * y, sin ella, la asignación manual. Sin nadie = vacío (siempre al final).
 */
export function assigneeSortName(equipo: Equipment): string | null {
  const { openShift, operator, supervisor } = equipo;
  if (openShift) {
    return (equipo.equipmentClass === 'LIGHT' ? openShift.supervisorName : openShift.operador) ?? null;
  }
  return operator?.name ?? supervisor?.name ?? null;
}

/** Contador que muestra la celda: horas en un pesado, kilómetros en un liviano. */
function usageValue(equipo: Equipment): number | null {
  return equipo.controlUnit === 'HOURS' ? equipo.currentHourmeter : equipo.currentMileage;
}

/**
 * Pesados primero y, dentro de cada clase, por tipo (Excavadora antes que
 * Retroexcavadora): la clave es texto para poder ordenar por las dos cosas.
 */
export function classSortKey(equipo: Equipment): string {
  return `${equipo.equipmentClass === 'HEAVY' ? 0 : 1}|${equipo.type}`;
}

/** Desempate de todas las columnas: por código del equipo. */
const byCode = (a: Equipment, b: Equipment): number => compareText(a.internalCode, b.internalCode);

/** `branchName` resuelve el nombre de la sucursal de un equipo (vacío = sin sucursal). */
export function equipmentSortColumns(
  branchName: (equipo: Equipment) => string | null,
): Record<(typeof EQUIPMENT_SORT_COLUMNS)[number], SortColumn<Equipment>> {
  return {
    equipo: { kind: 'text', value: (e) => e.internalCode },
    patente: { kind: 'text', value: (e) => e.licensePlate, tiebreak: byCode },
    clase: { kind: 'text', value: classSortKey, tiebreak: byCode },
    sucursal: { kind: 'text', value: branchName, tiebreak: byCode },
    uso: { kind: 'number', value: usageValue, tiebreak: byCode },
    combustible: { kind: 'number', value: (e) => e.currentFuelLevel, tiebreak: byCode },
    asignado: { kind: 'text', value: assigneeSortName, tiebreak: byCode },
    // Orden lógico del estado, no alfabético: operativo, en taller, fuera de servicio.
    estado: { kind: 'number', value: (e) => EQUIPMENT_STATUS.indexOf(e.status), tiebreak: byCode },
  };
}
