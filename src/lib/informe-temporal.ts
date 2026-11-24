import { adBlueIncompleto, validarAdBlue } from './adblue';
import { parseDecimal } from './decimal';
import { validarLitros } from './litros';
import type { Turno } from './turno';
import type { OutboxOp } from '../offline/db';
import type { Equipment } from '../types/equipment';
import type { CierreTemporalInput, CreateInformeTemporalInput, PersonalInforme } from '../types/informe-temporal';

/**
 * Lógica pura del informe del supervisor temporal (`CierreTemporalForm`):
 * validación del formulario, armado del body de `POST /api/informes-temporales`
 * y qué tarjetas ya van en un informe que sigue en la cola.
 */

/** Tope de personas por actividad: las 10 líneas del papel (lo valida también el backend). */
export const MAX_PERSONAL_POR_ACTIVIDAD = 10;

/** Tipo, marca y modelo: lo que identifica al equipo junto a su código. */
export const nombreEquipo = (e: Pick<Equipment, 'type' | 'brand' | 'model'>) =>
  [e.type, e.brand, e.model].filter(Boolean).join(' ');

/** Lectura con su unidad: `45.120 km` en una camioneta, `1.200,0 h` en un pesado. */
export const fmtLectura = (valor: number, liviano: boolean) =>
  liviano
    ? `${valor.toLocaleString('es-CL', { maximumFractionDigits: 1 })} km`
    : `${valor.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h`;

/** Una tarjeta abierta del supervisor temporal, tal como la muestra su pantalla. */
export interface TarjetaTemporal {
  id: string;
  equipoId: string;
  /** `internalCode` del equipo. */
  codigo: string;
  /** Tipo, marca y modelo: el equipo no tiene un nombre propio. */
  nombre: string;
  /** Camioneta: se mide en km y no lleva AdBlue. */
  liviano: boolean;
  inicial: number;
  /** ISO de la apertura. */
  abiertaIso?: string;
  /** La apertura sigue en la cola: el servidor todavía no la conoce. */
  sinSincronizar?: boolean;
}

/** El cierre de una tarjeta dentro del formulario (texto tal cual se escribió). */
export interface FilaCierreForm {
  cardId: string;
  inicial: number;
  liviano: boolean;
  final: string;
  litros: string;
  /** Foto del surtidor: obligatoria si se cargaron litros. */
  foto: File | null;
  /** Fecha de captura de la foto (EXIF), si se pudo leer. */
  fotoCapturada: Date | null;
  adBlue: boolean;
  adBlueLitros: string;
}

/** Una línea de personal: del catálogo de operadores (`operatorId`) o escrita a mano. */
export interface PersonaForm {
  operatorId: string | null;
  nombre: string;
}

export interface InformeTemporalForm {
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
  fotosEnviadas: boolean;
  infoSubidaApp: boolean;
  cierres: FilaCierreForm[];
}

/** Claves de error por tarjeta: `final.<cardId>`, `litros.<cardId>`, `foto.<cardId>`, `adBlue.<cardId>`. */
export const claveError = (campo: 'final' | 'litros' | 'foto' | 'adBlue', cardId: string) => `${campo}.${cardId}`;

const conNombre = (personas: PersonaForm[]) => personas.filter((p) => p.nombre.trim() !== '');

/** Errores del formulario por campo; `{}` si se puede enviar. */
export function validarInformeTemporal(form: InformeTemporalForm): Record<string, string> {
  const errores: Record<string, string> = {};

  if (form.fecha.trim() === '') errores.fecha = 'Elige la fecha.';
  if (form.actividad1.trim() === '') errores.actividad1 = 'Escribe la actividad realizada.';
  if (form.supervisor1.trim() === '') errores.supervisor1 = 'Escribe el supervisor responsable.';

  const personal1 = conNombre(form.personal1).length;
  const personal2 = conNombre(form.personal2).length;
  if (personal1 > MAX_PERSONAL_POR_ACTIVIDAD) {
    errores.personal1 = `Máximo ${MAX_PERSONAL_POR_ACTIVIDAD} personas por actividad.`;
  }
  if (personal2 > 0 && form.actividad2.trim() === '') {
    errores.personal2 = 'Hay personal en la actividad 2: escribe la actividad 2 o quítalo.';
  } else if (personal2 > MAX_PERSONAL_POR_ACTIVIDAD) {
    errores.personal2 = `Máximo ${MAX_PERSONAL_POR_ACTIVIDAD} personas por actividad.`;
  }

  for (const fila of form.cierres) {
    const final = parseDecimal(fila.final);
    if (fila.final.trim() === '') {
      errores[claveError('final', fila.cardId)] = 'Escribe la lectura final.';
    } else if (final == null) {
      errores[claveError('final', fila.cardId)] = 'Escribe un número, por ejemplo 1250,5.';
    } else if (final < fila.inicial) {
      errores[claveError('final', fila.cardId)] = 'No puede ser menor que la lectura inicial.';
    }

    const litros = validarLitros(fila.litros, { liviano: fila.liviano });
    if (litros.error) errores[claveError('litros', fila.cardId)] = litros.error;
    else if ((litros.valor ?? 0) > 0 && !fila.foto) {
      errores[claveError('foto', fila.cardId)] = 'Con combustible cargado falta la foto del surtidor.';
    }

    if (!fila.liviano && fila.adBlue) {
      const adBlueLitros = parseDecimal(fila.adBlueLitros);
      if (adBlueIncompleto(true, adBlueLitros)) {
        errores[claveError('adBlue', fila.cardId)] =
          validarAdBlue(true, adBlueLitros, true).error ?? 'Indica cuántos litros de AdBlue se cargaron.';
      }
    }
  }

  return errores;
}

export interface IdsInforme {
  /** `id` del informe: generado UNA vez al abrir el formulario. */
  id: string;
  /** `closeClientId` de cada tarjeta, también generado una sola vez. */
  closeClientIdDe: (cardId: string) => string;
  ahora: Date;
}

const opcional = (texto: string) => texto.trim() || undefined;

/** Body del informe y fotos por `cardId`, a partir de un formulario ya validado. */
export function armarInformeTemporal(
  form: InformeTemporalForm,
  { id, closeClientIdDe, ahora }: IdsInforme,
): { informe: CreateInformeTemporalInput; fotos: Record<string, File> } {
  const personal: PersonalInforme[] = [
    ...conNombre(form.personal1).map((p) => ({
      actividad: 1 as const,
      operatorId: p.operatorId,
      nombre: p.nombre.trim(),
    })),
    ...conNombre(form.personal2).map((p) => ({
      actividad: 2 as const,
      operatorId: p.operatorId,
      nombre: p.nombre.trim(),
    })),
  ];
  const capturedAt = ahora.toISOString();
  const fotos: Record<string, File> = {};

  const cierres = form.cierres.map((fila): CierreTemporalInput => {
    const conAdBlue = !fila.liviano;
    if (fila.foto) fotos[fila.cardId] = fila.foto;
    return {
      cardId: fila.cardId,
      closeClientId: closeClientIdDe(fila.cardId),
      valorFinal: parseDecimal(fila.final) ?? fila.inicial,
      fuelLiters: parseDecimal(fila.litros) ?? 0,
      ...(conAdBlue ? { adBlue: fila.adBlue } : {}),
      ...(conAdBlue && fila.adBlue ? { adBlueLiters: parseDecimal(fila.adBlueLitros) ?? undefined } : {}),
      capturedAt,
      ...(fila.foto && fila.fotoCapturada ? { photoCapturedAt: fila.fotoCapturada.toISOString() } : {}),
    };
  });

  const informe: CreateInformeTemporalInput = {
    id,
    fecha: form.fecha,
    turno: form.turno,
    actividad1: form.actividad1.trim(),
    personal,
    supervisorResponsable1: form.supervisor1.trim(),
    fotosEnviadas: form.fotosEnviadas,
    infoSubidaApp: form.infoSubidaApp,
    cierres,
  };
  const actividad2 = opcional(form.actividad2);
  if (actividad2) informe.actividad2 = actividad2;
  const observaciones = opcional(form.observaciones);
  if (observaciones) informe.observaciones = observaciones;
  const supervisor2 = opcional(form.supervisor2);
  if (supervisor2) informe.supervisorResponsable2 = supervisor2;

  return { informe, fotos };
}

/**
 * Tarjetas que ya van en un informe que sigue en la cola (sin señal, o
 * esperando una acción en la sincronización). Hasta que el servidor lo
 * confirme siguen abiertas en `mine`: la pantalla las saca de «Equipos
 * abiertos» para que no se cierren dos veces. `excluirInformeId`: el informe
 * del formulario abierto, que no se oculta a sí mismo.
 */
export function cardIdsEnInformePendiente(ops: readonly OutboxOp[], excluirInformeId?: string): Set<string> {
  const ids = new Set<string>();
  for (const op of ops) {
    if (op.type !== 'httpWrite' || op.endpoint !== 'informeTemporal.create') continue;
    // El informe del formulario abierto: mientras espera al servidor su
    // operación ya está en la cola, pero sus tarjetas no deben desaparecer
    // del formulario (un 409 lo descarta y el formulario sigue).
    if (excluirInformeId !== undefined && op.body.id === excluirInformeId) continue;
    const cierres = op.body.cierres;
    if (!Array.isArray(cierres)) continue;
    for (const cierre of cierres) {
      if (cierre && typeof cierre === 'object' && !Array.isArray(cierre) && typeof cierre.cardId === 'string') {
        ids.add(cierre.cardId);
      }
    }
  }
  return ids;
}
