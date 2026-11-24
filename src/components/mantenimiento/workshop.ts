import { avisoDeAgrupacion, formatDecimalInput, parseDecimal, parseInteger } from '../../lib/decimal';
import { fmtNum } from '../../lib/format';
import type { ControlUnit } from '../../types/equipment';
import { PRIORIDAD_OT, type Intervencion, type OrdenTrabajo, type PrioridadOT } from '../../types/mantenimiento';

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

/** Preventiva de pauta (nace del ciclo de mantenciones, con su checklist de
 * tareas): se registra y se consulta con el checklist, no con la bitácora. */
export function esChecklistPauta(orden: OrdenTrabajo): boolean {
  return orden.origen === 'PREVENTIVO' && orden.tareas.length > 0;
}

/** Días que una operación finalizada se queda en la columna «Finalizadas»
 * del tablero; las más antiguas pasan al historial. */
export const FINISHED_RECENT_DAYS = 7;

/**
 * Separa las finalizadas (ya ordenadas por `groupWorkshopBoard`) en las de los
 * últimos `FINISHED_RECENT_DAYS` días —las que se ven en el tablero— y el
 * historial. Se mide por `updatedAt`, la misma fecha que la tarjeta muestra
 * como «Finalizada». Una fecha ilegible cae en recientes: mejor verla de más
 * que esconderla.
 */
export function splitFinished(
  finished: readonly OrdenTrabajo[],
  now: Date = new Date(),
): { recent: OrdenTrabajo[]; history: OrdenTrabajo[] } {
  const limite = now.getTime() - FINISHED_RECENT_DAYS * 24 * 60 * 60 * 1000;
  const recent: OrdenTrabajo[] = [];
  const history: OrdenTrabajo[] = [];
  for (const orden of finished) {
    const fecha = new Date(orden.updatedAt).getTime();
    (Number.isNaN(fecha) || fecha >= limite ? recent : history).push(orden);
  }
  return { recent, history };
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
   * miles; en km, entera), redondeada HACIA ABAJO para no quedar nunca sobre
   * la actual; `''` si no se conoce — el campo queda vacío y hay que escribirla. */
  inicial: string;
  /** La última lectura conocida del equipo (de la lista de Flota en caché):
   * una lectura de mantención mayor se avisa, no se bloquea — el backend la
   * compara contra el valor fresco. */
  actual: number | null;
}

/** Lo que necesita la lectura para leerse y validarse: su unidad y, si se conoce, la actual. */
export type CampoLectura = Pick<LecturaMantencion, 'unidad' | 'actual'>;

/**
 * Lo que necesita el campo «lectura al momento de la mantención» al cerrar una
 * OT preventiva: el backend la usa para contar el próximo cambio desde ahí. La
 * unidad la decide el equipo (liviano por km, pesado por horas); si la OT no
 * resuelve en Flota se asume horómetro, que es el caso de la pauta.
 */
export function lecturaMantencion(equipoId: string, equipment: readonly EquipmentRef[] | undefined): LecturaMantencion {
  const equipo = findEquipment(equipoId, equipment);
  const esKm = equipo?.controlUnit === 'KM';
  const actual = (esKm ? equipo?.currentMileage : equipo?.currentHourmeter) ?? null;
  return {
    label: esKm ? 'Kilometraje al momento de la mantención (km)' : 'Horómetro al momento de la mantención (h)',
    unidad: esKm ? 'km' : 'h',
    // Hacia abajo: 264582,5 km redondeado (264583) quedaría sobre la actual.
    inicial: formatDecimalInput(actual == null ? null : esKm ? Math.floor(actual) : Math.floor(actual * 100) / 100, 2),
    actual,
  };
}

/**
 * El texto de una lectura de mantención como número, según su unidad. En km
 * es un entero y el `.` o la `,` son el separador de miles: «264.582» km son
 * 264582 km — leído como decimal (264,582 km) el backend rechazaba el cierre
 * por quedar bajo la mantención anterior. En horas sigue siendo un decimal
 * (`parseDecimal`); el aviso de agrupación dice cómo se leerá «1.500».
 */
export function parseLecturaMantencion(texto: string, unidad: LecturaMantencion['unidad']): number | null {
  return unidad === 'km' ? parseInteger(texto) : parseDecimal(texto);
}

/**
 * Aviso (no bloquea) para una lectura en horas con aspecto de miles («1.500»
 * se lee 1,5 h). En km no hay ambigüedad: `null`.
 */
export function avisoLecturaMantencion(texto: string, unidad: LecturaMantencion['unidad']): string | null {
  return unidad === 'h' ? avisoDeAgrupacion(texto) : null;
}

/**
 * Por qué una lectura de mantención ya leída no vale (`NaN`/vacía: falta, es
 * obligatoria); `null` si vale.
 */
export function errorLecturaMantencion(valor: number | null | undefined): string | null {
  if (valor == null || Number.isNaN(valor)) return 'Indica la lectura al momento de la mantención.';
  if (valor < 0) return 'Escribe una lectura válida (0 o mayor).';
  if (valor > LECTURA_MAXIMA) return 'La lectura no puede superar 1.000.000.';
  return null;
}

/**
 * Aviso (no bloquea) para una lectura de mantención mayor que la última
 * conocida del equipo. La lista de Flota puede estar atrasada (sin señal, otra
 * tablet registró una lectura después): bloquear impediría un cierre que el
 * backend, que compara contra el valor fresco, aceptaría. `null` si no aplica.
 */
export function avisoLecturaMayor(valor: number | null | undefined, campo: CampoLectura): string | null {
  if (valor == null || Number.isNaN(valor) || campo.actual == null || valor <= campo.actual) return null;
  return `Es mayor que la última lectura conocida del equipo (${fmtNum(campo.actual)} ${campo.unidad}); revisa que esté bien.`;
}

/** Por qué un texto no es una lectura en esa unidad (en km, que no es entera). */
function errorDeTexto(unidad: LecturaMantencion['unidad']): string {
  return unidad === 'km'
    ? 'Escribe los km como número entero, sin decimales.'
    : 'Escribe una lectura válida (0 o mayor).';
}

/** El texto del campo como número, o el motivo por el que no vale (es obligatorio). */
export function leerLecturaMantencion(texto: string, campo: CampoLectura): { valor: number } | { error: string } {
  if (texto.trim() === '') return { error: 'Indica la lectura al momento de la mantención.' };
  const valor = parseLecturaMantencion(texto, campo.unidad);
  if (valor == null) return { error: errorDeTexto(campo.unidad) };
  const error = errorLecturaMantencion(valor);
  return error ? { error } : { valor };
}

/**
 * Igual que `leerLecturaMantencion`, para un campo OPCIONAL (vacío = el
 * backend usa la lectura actual del equipo): `{ valor: undefined }` si está vacío.
 */
export function leerLecturaOpcional(
  texto: string,
  campo: CampoLectura,
): { valor: number | undefined } | { error: string } {
  return texto.trim() === '' ? { valor: undefined } : leerLecturaMantencion(texto, campo);
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

/**
 * Quién se hace cargo de la orden en el tablero: el asignado o, en las que
 * nadie tomó (las preventivas que se abren solas), quien marcó la última
 * tarea. Desde el 17/11/2026 el backend asigna a quien la mueve o la trabaja;
 * esto cubre las órdenes de antes. `null` = de verdad nadie la tomó.
 */
export function responsableDe(orden: Pick<OrdenTrabajo, 'asignadoA' | 'tareas'>): string | null {
  if (orden.asignadoA?.nombre) return orden.asignadoA.nombre;
  const ultima = orden.tareas
    .filter((t) => t.hechaPorNombre)
    .sort((a, b) => (b.hechaAt ?? '').localeCompare(a.hechaAt ?? ''))[0];
  return ultima?.hechaPorNombre ?? null;
}

/**
 * Si al eliminar la orden se puede registrar «ya se hizo» (espejo de
 * `OrdenesService.remove` en el backend): una preventiva de la pauta (con el
 * hito guardado, o una anterior que solo lo tiene en «Pauta: 250 h · ciclo 2»)
 * o el servicio de un liviano («Livianos: mantención de 20.000 km»). Son las
 * que el sistema crea solo y volvería a crear si se borran sin registrar.
 */
export function registrableComoHecha(orden: Pick<OrdenTrabajo, 'pautaCycle' | 'origenDetalle' | 'tipo'>): boolean {
  if (orden.pautaCycle != null) return true;
  const detalle = orden.origenDetalle ?? '';
  return (
    /^Pauta: [\d.]+ (?:h|km) · ciclo \d+/.test(detalle) ||
    (orden.tipo === 'PREVENTIVA' && detalle.startsWith('Livianos: '))
  );
}

/**
 * Las fotos de una intervención, en orden. `fotoUrls` es la lista completa;
 * si viene vacía o falta (backend viejo, o una respuesta guardada en el caché
 * antes del cambio) se cae a `fotoUrl`, la única foto que existía antes.
 */
export function fotosIntervencion(intervencion: Pick<Intervencion, 'fotoUrl'> & { fotoUrls?: string[] }): string[] {
  if (intervencion.fotoUrls && intervencion.fotoUrls.length > 0) return intervencion.fotoUrls;
  return intervencion.fotoUrl ? [intervencion.fotoUrl] : [];
}
