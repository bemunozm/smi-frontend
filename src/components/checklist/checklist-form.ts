import { parseDecimal } from '../../lib/decimal';
import {
  type ChecklistItem,
  type DailyChecklistDetail,
  type EntryStatus,
  pideFoto,
  type SubmitDailyChecklistInput,
} from '../../types/daily-checklist';

/** Una foto que ya está en el checklist (al corregir uno rechazado). */
export interface FotoGuardada {
  id: string;
  url: string;
}

/** Una foto del formulario: recién sacada (`File`) o ya guardada. */
export type FotoForm = File | FotoGuardada;

export const esFotoGuardada = (f: FotoForm): f is FotoGuardada => !(f instanceof File);

/** Lo que el mantenedor lleva marcado de un ítem, antes de enviar. */
export interface EntradaForm {
  status: EntryStatus | null;
  description: string;
  note: string;
  /** Texto del campo: se convierte al enviar. */
  temperature: string;
  photos: FotoForm[];
  /** La cantidad se guarda como texto mientras se escribe (`1,5`). */
  supplies: { insumoId: string; cantidad: string }[];
}

export const ENTRADA_VACIA: EntradaForm = {
  status: null,
  description: '',
  note: '',
  temperature: '',
  photos: [],
  supplies: [],
};

const declarada = (e: EntradaForm | undefined) => e?.status === 'MAINTAINED' || e?.status === 'CHECKED';

/** Lo escrito como número, con la misma regla de toda la app (`parseDecimal`). */
export function numero(texto: string): number | null {
  return parseDecimal(texto);
}

/**
 * Mientras se escribe solo pasan dígitos, punto y coma (y el signo, donde se
 * permite): una letra o un símbolo no llegan al campo.
 */
export function soloNumero(texto: string, { negativo = false } = {}): string {
  const limpio = texto.replace(negativo ? /[^\d.,-]/g : /[^\d.,]/g, '');
  return negativo ? limpio.replace(/(?!^)-/g, '') : limpio;
}

/** Hay algo escrito pero no se lee como número (`1.2.3`, `,`): es un error, no un campo vacío. */
export function noEsNumero(texto: string): boolean {
  return texto.trim() !== '' && parseDecimal(texto) === null;
}

/**
 * Lo que le falta a un ítem marcado para poder enviarse, en palabras cortas
 * para la tarjeta: «Falta foto», «Falta temperatura»… Vacío si está completo
 * o si no se revisó (ahí no se pide nada).
 */
export function pendientesItem(item: ChecklistItem, e: EntradaForm | undefined): string[] {
  if (!e || !declarada(e)) return [];
  const faltan: string[] = [];
  if (e.status === 'MAINTAINED' && e.description.trim().length < 3) faltan.push('Falta qué se hizo');
  if (item.requiresTemperature && numero(e.temperature) === null) faltan.push('Falta temperatura');
  if (pideFoto(item, e.status) && e.photos.length === 0) faltan.push('Falta foto');
  if (e.status === 'MAINTAINED' && e.supplies.some((s) => !s.insumoId || !((numero(s.cantidad) ?? 0) > 0))) {
    faltan.push('Falta completar un insumo');
  }
  return faltan;
}

/**
 * Las fotos obligatorias: una por cada ítem crítico con «Se hizo mantención».
 * `conFoto` cuenta cuántas de esas ya la tienen; para enviar tienen que estar
 * todas.
 */
export function cuentaFotos(items: readonly ChecklistItem[], entradas: Record<string, EntradaForm>) {
  const obligatorias = items.filter((i) => pideFoto(i, entradas[i.id]?.status ?? null));
  return {
    declarados: items.filter((i) => declarada(entradas[i.id])).length,
    obligatorias: obligatorias.length,
    conFoto: obligatorias.filter((i) => (entradas[i.id]?.photos.length ?? 0) > 0).length,
  };
}

/**
 * Por qué todavía no se puede enviar. Las mismas reglas que valida el
 * backend (`daily-checklist-rules.ts`), dichas para la pantalla.
 */
export function motivosBloqueo(
  items: readonly ChecklistItem[],
  entradas: Record<string, EntradaForm>,
  equipo: {
    equipmentId: string;
    counter: string;
    /** La lectura con que partió el equipo: el horómetro no puede ser menor. */
    lecturaInicial?: number | null;
    branchId?: string;
  },
): string[] {
  const motivos: string[] = [];
  const anotado = numero(equipo.counter);
  if (!equipo.equipmentId) motivos.push('Elige el equipo.');
  else if (noEsNumero(equipo.counter)) {
    motivos.push('El horómetro u odómetro no es un número válido.');
  } else if (anotado === null || anotado < 0) {
    motivos.push('Anota el horómetro u odómetro del equipo.');
  } else if (equipo.lecturaInicial != null && anotado < equipo.lecturaInicial) {
    motivos.push('El horómetro u odómetro es menor que la lectura con que partió el equipo.');
  }

  const sinMarcar = items.filter((i) => !entradas[i.id]?.status);
  if (sinMarcar.length > 0) {
    motivos.push(
      sinMarcar.length === 1 ? `Falta marcar «${sinMarcar[0].name}».` : `Faltan ${sinMarcar.length} ítems por marcar.`,
    );
  }

  for (const item of items) {
    const e = entradas[item.id];
    if (!e || !declarada(e)) continue;
    if (e.status === 'MAINTAINED' && e.description.trim().length < 3) {
      motivos.push(`«${item.name}»: describe la mantención.`);
    }
    if (pideFoto(item, e.status) && e.photos.length === 0) {
      motivos.push(`«${item.name}»: falta la foto obligatoria de la mantención.`);
    }
    if (item.requiresTemperature && noEsNumero(e.temperature)) {
      motivos.push(`«${item.name}»: la temperatura no es un número válido.`);
    } else if (item.requiresTemperature && numero(e.temperature) === null) {
      motivos.push(`«${item.name}»: anota la temperatura.`);
    }
    if (e.status === 'MAINTAINED' && e.supplies.some((s) => !s.insumoId || !((numero(s.cantidad) ?? 0) > 0))) {
      motivos.push(`«${item.name}»: completa el insumo y su cantidad.`);
    }
  }

  if (sinMarcar.length === 0 && cuentaFotos(items, entradas).declarados === 0) {
    motivos.push('Marca al menos un ítem como revisado o con mantención.');
  }

  const usaInsumos = items.some((i) => entradas[i.id]?.status === 'MAINTAINED' && entradas[i.id].supplies.length > 0);
  if (usaInsumos && !equipo.branchId) motivos.push('No se encontró la bodega de faena para los insumos.');
  return motivos;
}

/**
 * Arma lo que se envía y la lista de fotos con su campo anidado
 * (`entries.i.photoKeys.j`): la cola las sube y pone cada key en su lugar.
 */
export function armarEnvio(
  items: readonly ChecklistItem[],
  entradas: Record<string, EntradaForm>,
  datos: {
    equipmentId: string;
    date: string;
    counter: string;
    branchId?: string;
  },
): {
  input: SubmitDailyChecklistInput;
  files: { field: string; file: File }[];
} {
  const files: { field: string; file: File }[] = [];
  const entries = items.map((item, i) => {
    const e = entradas[item.id] ?? ENTRADA_VACIA;
    const status = e.status ?? 'NOT_CHECKED';
    if (status === 'NOT_CHECKED') return { itemId: item.id, status };
    // Las que ya estaban van primero, por su id; las nuevas las sube la cola y
    // pone su key a continuación (`entries.i.photoKeys.j`).
    const guardadas = e.photos.filter(esFotoGuardada).map((p) => p.id);
    e.photos
      .filter((p): p is File => p instanceof File)
      .forEach((file, j) => files.push({ field: `entries.${i}.photoKeys.${guardadas.length + j}`, file }));
    const temperatura = item.requiresTemperature ? numero(e.temperature) : null;
    return {
      itemId: item.id,
      status,
      ...(guardadas.length ? { photoKeys: guardadas } : {}),
      ...(status === 'MAINTAINED' ? { description: e.description.trim() } : {}),
      ...(e.note.trim() ? { note: e.note.trim() } : {}),
      ...(temperatura !== null ? { temperature: temperatura } : {}),
      ...(status === 'MAINTAINED' && e.supplies.length
        ? { supplies: e.supplies.map((s) => ({ insumoId: s.insumoId, cantidad: numero(s.cantidad) ?? 0 })) }
        : {}),
    };
  });
  const usaInsumos = entries.some((e) => 'supplies' in e);
  return {
    input: {
      equipmentId: datos.equipmentId,
      date: datos.date,
      // `motivosBloqueo` ya exige un número: no se llega acá sin horómetro.
      counter: numero(datos.counter) ?? 0,
      ...(usaInsumos && datos.branchId ? { branchId: datos.branchId } : {}),
      entries,
    },
    files,
  };
}

/**
 * Un checklist rechazado, de vuelta en el formulario para corregirlo: lo que
 * se había marcado, con sus fotos (que se conservan si no se quitan).
 */
export function entradasDesdeDetalle(detalle: DailyChecklistDetail): Record<string, EntradaForm> {
  const entradas: Record<string, EntradaForm> = {};
  for (const e of detalle.entries) {
    if (!e.itemId) continue;
    entradas[e.itemId] = {
      status: e.status,
      description: e.description ?? '',
      note: e.note ?? '',
      temperature: e.temperature != null ? String(e.temperature).replace('.', ',') : '',
      photos: e.photos,
      supplies: e.supplies.map((s) => ({ insumoId: s.itemId, cantidad: String(s.quantity).replace('.', ',') })),
    };
  }
  return entradas;
}
