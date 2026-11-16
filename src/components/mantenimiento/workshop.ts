import { formatDecimalInput, parseDecimal } from '../../lib/decimal';
import type { ControlUnit } from '../../types/equipment';
import { PRIORIDAD_OT, type OrdenTrabajo, type PrioridadOT } from '../../types/mantenimiento';

/**
 * Helpers puros del tablero del taller (diseño "Mantenedor Taller").
 * Mapeo de estados del backend a las tres columnas del diseño:
 * PENDIENTE/ASIGNADA → bandeja de hallazgos · EN_PROCESO → en proceso ·
 * COMPLETADA/CANCELADA → finalizado.
 */
export interface WorkshopBoard {
  backlog: OrdenTrabajo[];
  inProgress: OrdenTrabajo[];
  finished: OrdenTrabajo[];
}

const PRIORITY_RANK: Record<PrioridadOT, number> = { CRITICA: 0, ALTA: 1, MEDIA: 2, BAJA: 3 };

function byDateDesc(field: 'createdAt' | 'updatedAt') {
  return (a: OrdenTrabajo, b: OrdenTrabajo) => new Date(b[field]).getTime() - new Date(a[field]).getTime();
}

export function groupWorkshopBoard(ordenes: readonly OrdenTrabajo[]): WorkshopBoard {
  const backlog = ordenes
    .filter((o) => o.estado === 'PENDIENTE' || o.estado === 'ASIGNADA')
    .sort((a, b) => PRIORITY_RANK[a.prioridad] - PRIORITY_RANK[b.prioridad] || byDateDesc('createdAt')(a, b));
  const inProgress = ordenes.filter((o) => o.estado === 'EN_PROCESO').sort(byDateDesc('updatedAt'));
  const finished = ordenes
    .filter((o) => o.estado === 'COMPLETADA' || o.estado === 'CANCELADA')
    .sort(byDateDesc('updatedAt'));
  return { backlog, inProgress, finished };
}

export interface WorkshopStats {
  backlog: number;
  inProgress: number;
  finishedToday: number;
  total: number;
}

function isSameLocalDay(iso: string, reference: Date): boolean {
  const date = new Date(iso);
  return (
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() === reference.getFullYear() &&
    date.getMonth() === reference.getMonth() &&
    date.getDate() === reference.getDate()
  );
}

export function buildWorkshopStats(ordenes: readonly OrdenTrabajo[], now: Date = new Date()): WorkshopStats {
  const board = groupWorkshopBoard(ordenes);
  return {
    backlog: board.backlog.length,
    inProgress: board.inProgress.length,
    finishedToday: ordenes.filter((o) => o.estado === 'COMPLETADA' && isSameLocalDay(o.updatedAt, now)).length,
    total: ordenes.length,
  };
}

/**
 * Subset estructural de `Equipment` — lo único que el taller necesita para
 * etiquetar. `Equipment` completo lo satisface tal cual.
 */
export interface EquipmentRef {
  id: string;
  internalCode: string;
  brand: string;
  model: string;
  /** Bodega base de la unidad — el default de la bodega al descontar insumos. */
  homeBranchId?: string | null;
  /** Unidad y lecturas actuales: prellenan la lectura de la mantención al
   * cerrar una OT preventiva. Opcionales: hay listas que no las traen. */
  controlUnit?: ControlUnit;
  currentHourmeter?: number | null;
  currentMileage?: number | null;
}

/** La unidad de Flota detrás del `equipoId` libre de una OT, si se resuelve. */
export function findEquipment(
  equipoId: string,
  equipment: readonly EquipmentRef[] | undefined,
): EquipmentRef | undefined {
  return equipment?.find((eq) => eq.internalCode === equipoId || eq.id === equipoId);
}

/** Tope de la lectura de la mantención — el mismo que valida el backend. */
const LECTURA_MAXIMA = 1_000_000;

export interface LecturaMantencion {
  /** «Horómetro al momento de la mantención (h)» o su versión en km. */
  label: string;
  unidad: 'h' | 'km';
  /** La lectura actual del equipo como texto del campo (coma decimal, sin
   * miles); `''` si no se conoce — el campo queda vacío y hay que escribirla. */
  inicial: string;
}

/**
 * Lo que necesita el campo «lectura al momento de la mantención» al cerrar una
 * OT preventiva: el backend la usa para contar el próximo cambio desde ahí. La
 * unidad la decide el equipo (liviano por km, pesado por horas); si la OT no
 * resuelve en Flota se asume horómetro, que es el caso de la pauta.
 */
export function lecturaMantencion(equipoId: string, equipment: readonly EquipmentRef[] | undefined): LecturaMantencion {
  const equipo = findEquipment(equipoId, equipment);
  const esKm = equipo?.controlUnit === 'KM';
  const actual = esKm ? equipo?.currentMileage : equipo?.currentHourmeter;
  return {
    label: esKm ? 'Kilometraje al momento de la mantención (km)' : 'Horómetro al momento de la mantención (h)',
    unidad: esKm ? 'km' : 'h',
    inicial: formatDecimalInput(actual),
  };
}

/** Por qué una lectura de mantención ya leída no vale (`NaN`/vacía: falta, es obligatoria); `null` si vale. */
export function errorLecturaMantencion(valor: number | null | undefined): string | null {
  if (valor == null || Number.isNaN(valor)) return 'Indica la lectura al momento de la mantención.';
  if (valor < 0) return 'Escribe una lectura válida (0 o mayor).';
  if (valor > LECTURA_MAXIMA) return 'La lectura no puede superar 1.000.000.';
  return null;
}

/** El texto del campo como número, o el motivo por el que no vale (es obligatorio). */
export function leerLecturaMantencion(texto: string): { valor: number } | { error: string } {
  if (texto.trim() === '') return { error: 'Indica la lectura al momento de la mantención.' };
  const valor = parseDecimal(texto);
  if (valor == null) return { error: 'Escribe una lectura válida (0 o mayor).' };
  const error = errorLecturaMantencion(valor);
  return error ? { error } : { valor };
}

/**
 * "EX-014 · CAT 320". `equipoId` en la OT es texto libre (puede ser código
 * interno o id de Flota); sin match se muestra crudo, nunca rompe.
 */
export function equipmentLabel(equipoId: string, equipment: readonly EquipmentRef[] | undefined): string {
  const match = equipment?.find((eq) => eq.internalCode === equipoId || eq.id === equipoId);
  return match ? `${match.internalCode} · ${match.brand} ${match.model}` : equipoId;
}

/**
 * La prioridad de un hallazgo de Terreno viaja como string libre; para los
 * chips del taller se proyecta al set de OT, con MEDIA como caída segura.
 */
export function toPrioridadOT(prioridad: string): PrioridadOT {
  return (Object.values(PRIORIDAD_OT) as string[]).includes(prioridad)
    ? (prioridad as PrioridadOT)
    : PRIORIDAD_OT.MEDIA;
}

/** Mismo formato corto que el resto del dominio (es-CL, dd-mm hh:mm). */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
