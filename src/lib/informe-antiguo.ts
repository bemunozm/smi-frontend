import { formatDecimalInput, parseDecimal } from './decimal';
import { validarInformeTemporal, type PersonaForm } from './informe-temporal';
import type { Turno } from './turno';
import type { OutboxOp } from '../offline/db';
import type {
  CreateInformeAntiguoInput,
  EquipoRegistradoInput,
  InformeTemporal,
  PersonalInforme,
} from '../types/informe-temporal';

/**
 * Lógica pura de «Subir informe antiguo» (`InformeAntiguoForm`): el informe en
 * papel de una jornada pasada, SIN tarjetas. Sus equipos se escriben a mano
 * (equipo, lectura inicial y final, litros) y no abren ni cierran nada.
 */

/** Tope de equipos de un informe (el mismo del backend). */
export const MAX_EQUIPOS_INFORME = 20;

/** Una fila de equipo mientras se escribe (las cifras como texto). */
export interface FilaEquipoForm {
  /** Solo para la `key` de React y las claves de error; no viaja. */
  id: string;
  equipoId: string;
  inicial: string;
  final: string;
  litros: string;
}

export interface InformeAntiguoForm {
  /** El N° del papel, tal como se escribe. */
  numero: string;
  /** `YYYY-MM-DD`. */
  fecha: string;
  turno: Turno;
  actividad1: string;
  actividad2: string;
  personal1: PersonaForm[];
  personal2: PersonaForm[];
  observaciones: string;
  supervisor1: string;
  supervisor2: string;
  /** Solo la oficina: a qué supervisor temporal pertenece. */
  supervisorId: string;
  equipos: FilaEquipoForm[];
}

/** Claves de error por fila: `equipo.<id>`, `inicial.<id>`, `final.<id>`, `litros.<id>`. */
export const claveErrorEquipo = (campo: 'equipo' | 'inicial' | 'final' | 'litros', filaId: string) =>
  `${campo}.${filaId}`;

/** El N° escrito como entero positivo; `null` si no lo es. */
export function numeroDeInforme(texto: string): number | null {
  const limpio = texto.trim();
  if (!/^\d+$/.test(limpio)) return null;
  const n = Number(limpio);
  return n >= 1 && n <= 1_000_000 ? n : null;
}

/** El mensaje (bloqueante) de un N° que ya tiene otro informe. */
export const mensajeNumeroTomado = (numero: number) => `El N° ${numero} ya está registrado en otro informe.`;

export interface OpcionesValidacion {
  /** N° que ya tienen otros informes (los conocidos en el equipo). */
  numerosTomados: ReadonlySet<number>;
  /** La oficina tiene que elegir el supervisor temporal. */
  exigirSupervisor: boolean;
  /** `YYYY-MM-DD` de hoy: la fecha no puede ser futura. */
  hoy: string;
  /** `YYYY-MM-DD` más antiguo aceptado (un año atrás, como el backend). */
  desde?: string;
}

/** Errores del formulario por campo; `{}` si se puede enviar. */
export function validarInformeAntiguo(form: InformeAntiguoForm, opciones: OpcionesValidacion): Record<string, string> {
  // Actividades, personal y supervisores: las mismas reglas del informe normal.
  const errores = validarInformeTemporal({ ...form, cierres: [] });

  const numero = numeroDeInforme(form.numero);
  if (form.numero.trim() === '') errores.numero = 'Escribe el N° del informe en papel.';
  else if (numero == null) errores.numero = 'El N° es un número entero mayor que 0.';
  else if (opciones.numerosTomados.has(numero)) errores.numero = mensajeNumeroTomado(numero);

  if (form.fecha.trim() !== '' && form.fecha > opciones.hoy) errores.fecha = 'La fecha no puede ser futura.';
  else if (opciones.desde && form.fecha.trim() !== '' && form.fecha < opciones.desde) {
    errores.fecha = 'La fecha tiene más de un año de antigüedad.';
  }
  if (opciones.exigirSupervisor && form.supervisorId === '') {
    errores.supervisorId = 'Elige a qué supervisor temporal pertenece el informe.';
  }

  Object.assign(errores, validarFilasEquipos(form.equipos));
  return errores;
}

/** Hasta 2 decimales, como el papel (y como lo acepta el backend). */
const DOS_DECIMALES = 'Usa hasta 2 decimales, por ejemplo 484,92.';
const masDeDosDecimales = (n: number) => Math.abs(Math.round(n * 100) - n * 100) > 1e-6;

/** Errores de las filas de equipo (alta y corrección): al menos una, sin
 * repetir equipo, lecturas válidas con final ≥ inicial y litros opcionales. */
export function validarFilasEquipos(filas: readonly FilaEquipoForm[]): Record<string, string> {
  const errores: Record<string, string> = {};
  if (filas.length === 0) errores.equipos = 'Agrega al menos un equipo.';
  const vistos = new Set<string>();
  for (const fila of filas) {
    if (fila.equipoId === '') {
      errores[claveErrorEquipo('equipo', fila.id)] = 'Elige el equipo.';
    } else if (vistos.has(fila.equipoId)) {
      errores[claveErrorEquipo('equipo', fila.id)] = 'Este equipo ya está en el informe.';
    }
    vistos.add(fila.equipoId);

    const inicial = parseDecimal(fila.inicial);
    const final = parseDecimal(fila.final);
    if (fila.inicial.trim() === '') errores[claveErrorEquipo('inicial', fila.id)] = 'Escribe la lectura inicial.';
    else if (inicial == null || inicial < 0)
      errores[claveErrorEquipo('inicial', fila.id)] = 'Escribe un número, por ejemplo 1250,5.';
    else if (masDeDosDecimales(inicial)) errores[claveErrorEquipo('inicial', fila.id)] = DOS_DECIMALES;
    if (fila.final.trim() === '') errores[claveErrorEquipo('final', fila.id)] = 'Escribe la lectura final.';
    else if (final == null || final < 0)
      errores[claveErrorEquipo('final', fila.id)] = 'Escribe un número, por ejemplo 1250,5.';
    else if (masDeDosDecimales(final)) errores[claveErrorEquipo('final', fila.id)] = DOS_DECIMALES;
    else if (inicial != null && final < inicial) {
      errores[claveErrorEquipo('final', fila.id)] = 'No puede ser menor que la lectura inicial.';
    }

    if (fila.litros.trim() !== '') {
      const litros = parseDecimal(fila.litros);
      if (litros == null || litros < 0 || litros > 100_000) {
        errores[claveErrorEquipo('litros', fila.id)] = 'Escribe los litros, por ejemplo 40.';
      } else if (masDeDosDecimales(litros)) {
        errores[claveErrorEquipo('litros', fila.id)] = DOS_DECIMALES;
      }
    }
  }
  return errores;
}

/** Filas del formulario a partir de lo guardado (la corrección). */
export function filasDeEquipos(
  equipos: readonly { equipoId: string; inicial: number; final: number; litros: number | null }[],
  nuevoId: () => string,
): FilaEquipoForm[] {
  return equipos.map((e) => ({
    id: nuevoId(),
    equipoId: e.equipoId,
    inicial: formatDecimalInput(e.inicial, 2),
    final: formatDecimalInput(e.final, 2),
    litros: e.litros == null ? '' : formatDecimalInput(e.litros, 2),
  }));
}

const opcional = (texto: string) => texto.trim() || undefined;

/** Las filas de equipo como las recibe el servidor (formulario ya validado). */
export function equiposDeFilas(filas: readonly FilaEquipoForm[]): EquipoRegistradoInput[] {
  return filas.map((f) => {
    const litros = f.litros.trim() === '' ? null : parseDecimal(f.litros);
    return {
      equipoId: f.equipoId,
      inicial: parseDecimal(f.inicial) ?? 0,
      final: parseDecimal(f.final) ?? 0,
      litros: litros ?? null,
    };
  });
}

/** Body de `POST /api/informes-temporales/antiguo` (sin la foto, que va como archivo). */
export function armarInformeAntiguo(
  form: InformeAntiguoForm,
  { id, conSupervisor }: { id: string; conSupervisor: boolean },
): CreateInformeAntiguoInput {
  const personaDe = (actividad: 1 | 2) => (p: PersonaForm) => ({
    actividad,
    operatorId: p.operatorId,
    nombre: p.nombre.trim(),
  });
  const personal: PersonalInforme[] = [
    ...form.personal1.filter((p) => p.nombre.trim() !== '').map(personaDe(1)),
    ...form.personal2.filter((p) => p.nombre.trim() !== '').map(personaDe(2)),
  ];
  const informe: CreateInformeAntiguoInput = {
    id,
    numero: numeroDeInforme(form.numero) ?? 0,
    fecha: form.fecha,
    turno: form.turno,
    actividad1: form.actividad1.trim(),
    personal,
    supervisorResponsable1: form.supervisor1.trim(),
    equipos: equiposDeFilas(form.equipos),
  };
  const actividad2 = opcional(form.actividad2);
  if (actividad2) informe.actividad2 = actividad2;
  const observaciones = opcional(form.observaciones);
  if (observaciones) informe.observaciones = observaciones;
  const supervisor2 = opcional(form.supervisor2);
  if (supervisor2) informe.supervisorResponsable2 = supervisor2;
  if (conSupervisor && form.supervisorId) informe.supervisorId = form.supervisorId;
  return informe;
}

/** Los N° de los informes antiguos que esperan en la cola (todavía no en la lista). */
export function numerosEnCola(ops: readonly OutboxOp[]): number[] {
  const numeros: number[] = [];
  for (const op of ops) {
    if (op.type !== 'httpWrite' || op.endpoint !== 'informeTemporal.createAntiguo') continue;
    if (typeof op.body.numero === 'number') numeros.push(op.body.numero);
  }
  return numeros;
}

/**
 * Una fila de equipo del informe, venga de una tarjeta (informe normal) o
 * escrita a mano (subido después): lo que muestran el detalle, la lista y el
 * Excel, de la misma forma en los dos casos.
 */
export interface FilaEquipoInforme {
  key: string;
  /** La tarjeta, si la hay: solo esas se corrigen con «Corregir». */
  tarjetaId: string | null;
  codigo: string;
  nombre: string;
  /** Solo en las escritas a mano (`h` o `km`); la tarjeta no la trae. */
  unidad: 'h' | 'km' | null;
  operador: string | null;
  inicial: number;
  final: number | null;
  litros: number | null;
  adBlue: number | null;
  pumpPhotoUrl: string | null;
}

export function equiposDelInforme(informe: InformeTemporal): FilaEquipoInforme[] {
  const deTarjetas = informe.tarjetas.map((t): FilaEquipoInforme => ({
    key: t.id,
    tarjetaId: t.id,
    codigo: t.equipo.internalCode,
    nombre: t.equipo.name,
    unidad: null,
    operador: t.operador,
    inicial: t.valorInicial,
    final: t.valorFinal,
    litros: t.fuelLiters,
    adBlue: t.adBlueLiters,
    pumpPhotoUrl: t.pumpPhotoUrl,
  }));
  const aMano = (informe.equiposRegistrados ?? []).map((e, i): FilaEquipoInforme => ({
    key: `${e.equipoId}-${i}`,
    tarjetaId: null,
    codigo: e.codigo,
    nombre: e.nombre,
    unidad: e.unidad,
    operador: null,
    inicial: e.inicial,
    final: e.final,
    litros: e.litros,
    adBlue: null,
    pumpPhotoUrl: null,
  }));
  return [...deTarjetas, ...aMano];
}
