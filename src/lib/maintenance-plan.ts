import {
  PLAN_ITEM_KINDS,
  type MaintenancePlanView,
  type PlanItemKind,
  type SaveMaintenancePlanInput,
} from '../types/maintenance-plan';

/**
 * Borrador de una pauta de mantención mientras se edita en la ventana: la
 * planilla tal cual se ve, con los números como texto de formulario. Se
 * convierte a la forma del backend recién al guardar.
 */

export interface FilaBorrador {
  /** Identidad local de la fila (React `key`); no viaja al servidor. */
  key: string;
  kind: PlanItemKind;
  description: string;
  quantity: string;
  unit: string;
  partNumber: string;
  milestones: number[];
}

export interface PautaBorrador {
  milestones: number[];
  /** Servicio inicial único («1ras 50H»); vacío si no hay. */
  initialMilestone: string;
  /** Avisar al mantenedor N horas (o km) antes; vacío = sin aviso. */
  alertBefore: string;
  items: FilaBorrador[];
}

let contador = 0;
const PREFIJO_NUEVA = 'fila-';
const nuevaKey = () => `${PREFIJO_NUEVA}${Date.now()}-${contador++}`;
/** Las filas nuevas llevan una key local; las guardadas, el id del servidor. */
const esFilaGuardada = (key: string) => !key.startsWith(PREFIJO_NUEVA);

export function filaVacia(): FilaBorrador {
  return { key: nuevaKey(), kind: 'OPERACION', description: '', quantity: '', unit: '', partNumber: '', milestones: [] };
}

/**
 * Hitos con los que arranca una pauta nueva: los del ejemplo del cliente
 * (Caterpillar D6). Se pueden quitar o cambiar; es un punto de partida, no una
 * regla.
 */
export const HITOS_SUGERIDOS = [250, 500, 750, 1000, 1500, 2000];

/** Lee un número escrito en formato es-CL: «1.500» son mil quinientos, «26,2» es veintiséis coma dos. */
export function leerNumero(texto: string): number | null {
  const limpio = texto.trim().replace(/\./g, '').replace(',', '.');
  if (limpio === '') return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

const esKind = (k: string): k is PlanItemKind => (PLAN_ITEM_KINDS as readonly string[]).includes(k);

export function borradorDesde(vista: MaintenancePlanView | undefined): PautaBorrador {
  const plan = vista?.plan;
  if (!plan) return { milestones: [...HITOS_SUGERIDOS], initialMilestone: '', alertBefore: '', items: [filaVacia()] };
  return {
    milestones: [...plan.milestones],
    initialMilestone: plan.initialMilestone != null ? String(plan.initialMilestone) : '',
    alertBefore: plan.alertBefore != null ? String(plan.alertBefore) : '',
    items: plan.items.map((i) => ({
      key: i.id,
      kind: esKind(i.kind) ? i.kind : 'OPERACION',
      description: i.description,
      quantity: i.quantity != null ? String(i.quantity).replace('.', ',') : '',
      unit: i.unit ?? '',
      partNumber: i.partNumber ?? '',
      milestones: [...i.milestones],
    })),
  };
}

/** Agrega un hito y deja la lista ordenada; uno repetido no cambia nada. */
export function agregarHito(b: PautaBorrador, hito: number): PautaBorrador {
  if (b.milestones.includes(hito)) return b;
  return { ...b, milestones: [...b.milestones, hito].sort((x, y) => x - y) };
}

/** Quita un hito y también sus marcas: una marca en un hito que no existe el servidor la rechaza. */
export function quitarHito(b: PautaBorrador, hito: number): PautaBorrador {
  return {
    ...b,
    milestones: b.milestones.filter((m) => m !== hito),
    items: b.items.map((i) => ({ ...i, milestones: i.milestones.filter((m) => m !== hito) })),
  };
}

export function alternarMarca(b: PautaBorrador, key: string, hito: number): PautaBorrador {
  return {
    ...b,
    items: b.items.map((i) =>
      i.key !== key
        ? i
        : {
            ...i,
            milestones: i.milestones.includes(hito)
              ? i.milestones.filter((m) => m !== hito)
              : [...i.milestones, hito].sort((x, y) => x - y),
          },
    ),
  };
}

/** Los hitos que se dibujan como columnas: el servicio inicial primero, si hay. */
export function columnas(b: PautaBorrador): { hito: number; inicial: boolean }[] {
  const inicial = leerNumero(b.initialMilestone);
  return [
    ...(inicial != null ? [{ hito: inicial, inicial: true }] : []),
    ...b.milestones.map((hito) => ({ hito, inicial: false })),
  ];
}

/**
 * Por qué no se puede guardar todavía, o null si se puede. Repite las reglas
 * del servidor para no mandar algo que va a rechazar.
 */
export function problemaDe(b: PautaBorrador): string | null {
  if (b.milestones.length === 0) return 'Agregá al menos un hito.';
  const inicial = leerNumero(b.initialMilestone);
  if (b.initialMilestone.trim() !== '') {
    if (inicial == null || !Number.isInteger(inicial) || inicial < 1) {
      return 'El servicio inicial tiene que ser un número entero de horas o km.';
    }
    if (inicial >= b.milestones[0]) return 'El servicio inicial tiene que ir antes del primer hito.';
  }
  if (b.alertBefore.trim() !== '') {
    const aviso = leerNumero(b.alertBefore);
    if (aviso == null || !Number.isInteger(aviso) || aviso < 1) {
      return 'El aviso al mantenedor tiene que ser un número entero de horas o km.';
    }
  }
  const conTexto = b.items.filter((i) => i.description.trim() !== '' || i.milestones.length > 0);
  if (conTexto.some((i) => i.description.trim() === '')) return 'Cada operación necesita una descripción.';
  if (conTexto.some((i) => i.quantity.trim() !== '' && (leerNumero(i.quantity) ?? -1) < 0)) {
    return 'Revisá las cantidades: tienen que ser números.';
  }
  return null;
}

/** El borrador en la forma que guarda el servidor. Las filas totalmente vacías se omiten. */
export function aEntrada(b: PautaBorrador): SaveMaintenancePlanInput {
  const inicial = leerNumero(b.initialMilestone);
  return {
    milestones: b.milestones,
    initialMilestone: inicial,
    alertBefore: leerNumero(b.alertBefore),
    items: b.items
      .filter((i) => i.description.trim() !== '' || i.milestones.length > 0)
      .map((i) => {
        const quantity = leerNumero(i.quantity);
        return {
          // Una fila que vino del servidor viaja con su id: así se actualiza
          // en su lugar y no pierde lo ya registrado en el ciclo.
          ...(esFilaGuardada(i.key) ? { id: i.key } : {}),
          kind: i.kind,
          description: i.description.trim(),
          ...(quantity != null ? { quantity } : {}),
          ...(i.unit.trim() ? { unit: i.unit.trim() } : {}),
          ...(i.partNumber.trim() ? { partNumber: i.partNumber.trim() } : {}),
          milestones: i.milestones,
        };
      }),
  };
}

/** `2.100 h` / `15.000 km`. */
export function fmtContador(n: number, unit: 'h' | 'km'): string {
  return `${n.toLocaleString('es-CL')} ${unit}`;
}
