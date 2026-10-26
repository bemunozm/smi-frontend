import type { OutboxOp } from '../offline/db';

/**
 * Textos de la hoja de sincronización que dicen QUÉ es cada registro y QUÉ
 * hacer con uno rechazado. Funciones puras: `SyncOpsList` solo las pinta.
 */

const num = (n: number) => n.toLocaleString('es-CL', { maximumFractionDigits: 1 });

/** Un registro guardado por una versión anterior puede no traer el campo. */
const si = (n: unknown, texto: (n: number) => string): string => (typeof n === 'number' ? texto(n) : '');

/** «26-10 10:15». */
function cuando(iso: string | number | undefined): string {
  if (iso == null) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dia = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  return `${dia} ${d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
}

/** Lo que se guardó, en una línea: lecturas, litros y cuándo. */
export function detalleOp(op: OutboxOp): string {
  switch (op.type) {
    case 'openCard':
      return [si(op.payload.valorInicial, (n) => `Lectura inicial ${num(n)}`), cuando(op.payload.capturedAt)]
        .filter(Boolean)
        .join(' · ');
    case 'closeCard': {
      const i = op.payload.input;
      return [
        si(i?.valorFinal, (n) => `Lectura final ${num(n)}`),
        si(i?.fuelLiters, (n) => `${num(n)} L`),
        cuando(i?.capturedAt),
      ]
        .filter(Boolean)
        .join(' · ');
    }
    default:
      return cuando(op.createdAt);
  }
}

/** Nombres de campo del servidor, como los conoce quien registra. */
const CAMPOS: Record<string, string> = {
  fuelLiters: 'Litros',
  valorFinal: 'Lectura final',
  valorInicial: 'Lectura inicial',
  adBlueLiters: 'Litros de AdBlue',
  horometroInicial: 'Horómetro inicial',
  horometroFinal: 'Horómetro final',
};

/**
 * El mensaje del servidor, en español. La validación de NestJS responde en
 * inglés («fuelLiters must not be greater than 10000») cuando el DTO no trae
 * su propio mensaje; acá se traducen esos casos y el resto pasa tal cual.
 */
export function mensajeLegible(mensaje: string): string {
  return mensaje
    .split(/,\s*(?=[a-zA-Z]+ must )/)
    .map((parte) => {
      const m = parte.trim().match(/^(\w+) must (not be greater than|not be less than|be a number)(?: (-?[\d.]+))?/);
      if (!m) return parte.trim();
      const campo = CAMPOS[m[1]] ?? m[1];
      const limite = m[3] != null ? num(Number(m[3])) : '';
      if (m[2] === 'not be greater than') return `${campo}: no puede superar ${limite}.`;
      if (m[2] === 'not be less than') return `${campo}: no puede ser menor que ${limite}.`;
      return `${campo}: tiene que ser un número.`;
    })
    .join(' ');
}

/** Ocupado porque sigue abierta una tarjeta del mismo equipo. */
function esEquipoOcupado(op: OutboxOp): boolean {
  return (
    op.lastError?.code === 'EQUIPMENT_BUSY' ||
    (op.lastError?.message ?? '').includes('ya tiene una tarjeta de turno abierta')
  );
}

/**
 * Qué hacer con un registro rechazado. `ops`: todas las del usuario, para ver
 * si el rechazo viene de otro registro trabado (una apertura que choca con el
 * cierre pendiente del mismo equipo).
 */
export function queHacer(op: OutboxOp, ops: readonly OutboxOp[]): string {
  const status = op.lastError?.status;
  if (op.type === 'openCard' && esEquipoOcupado(op)) {
    const cierreTrabado = ops.some((o) => o.type === 'closeCard' && o.status === 'needs_attention' && o.seq < op.seq);
    return cierreTrabado
      ? 'El equipo sigue abierto porque el cierre de arriba no pasó. Resuelve primero ese cierre y después toca Reintentar aquí.'
      : 'Alguien más tiene el equipo abierto. Cuando lo cierren, toca Reintentar; si ya no sirve, descártala.';
  }
  if (op.type === 'closeCard' && (status === 400 || status === 422)) {
    return 'Un dato no es válido y no se puede corregir desde aquí. Descarta este cierre: la tarjeta vuelve a quedar abierta y la cierras de nuevo con el valor correcto.';
  }
  if (status === 403) return 'Tu usuario no puede hacer esto. Descártalo o pide a un administrador que lo registre.';
  return 'Si ya se resolvió el problema, toca Reintentar. Si el registro ya no sirve, descártalo.';
}
