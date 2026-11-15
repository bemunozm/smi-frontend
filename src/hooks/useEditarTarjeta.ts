import { useMemo, useState } from 'react';

import { useCambiosTarjeta } from './useShiftCards';
import { LITROS_MAX } from './useCierreForm';
import { validarLitros } from '../lib/litros';
import { useOnlineStatus } from './useOnlineStatus';
import { useQueuedMutation } from './useQueuedMutation';
import type { TarjetaTurno } from './shift-register-helpers';
import { formatDecimalInput, parseDecimal } from '../lib/decimal';
import { diferenciaEdicion, precondicion, type DiffEdicion } from '../lib/edit-diff';
import { adBlueIncompleto, validarAdBlue, type ResultadoAdBlue } from '../lib/adblue';
import { mensajeErrorOperacion } from '../lib/error-messages';
import { avisarGuardadoEnCola } from '../lib/outbox-feedback';
import type { OutboxOp } from '../offline/db';
import { patchCloseCardOp, patchOpenCardOp, patchRegisterClosedCardOp } from '../offline/outbox';
import type { EntradaCambios } from '../types/cambios';
import type { Equipment } from '../types/equipment';
import type { EditShiftCardBody, ShiftType } from '../types/shift';

export interface EdicionTarjetaState {
  operatorId: string;
  /** Qué máquina salió — solo editable en una tarjeta ya cerrada. */
  equipoId: string;
  /** DIURNO | NOCTURNO — solo editable en una tarjeta ya cerrada. */
  turno: string;
  inicial: string;
  final: string;
  litros: string;
  adBlue: boolean;
  adBlueLitros: string;
  observaciones: string;
}

/** El turno de la tarjeta si lo trae y es del vocabulario; una tarjeta vieja
 * sin `shift` no lo tiene y su turno no se edita. */
function turnoDeTarjeta(t: TarjetaTurno): ShiftType | undefined {
  return t.turnoTipo === 'DIURNO' || t.turnoTipo === 'NOCTURNO' ? t.turnoTipo : undefined;
}

function estadoInicial(t: TarjetaTurno): EdicionTarjetaState {
  return {
    operatorId: t.operatorId ?? '',
    equipoId: t.equipoId,
    turno: turnoDeTarjeta(t) ?? '',
    inicial: formatDecimalInput(t.inicial),
    final: formatDecimalInput(t.final),
    // 3 decimales, como el surtidor: con 2, guardar sin cambios redondeaba 48,493 a 48,49.
    litros: formatDecimalInput(t.litros, 3),
    adBlue: t.adBlue ?? false,
    adBlueLitros: formatDecimalInput(t.adBlueLitros),
    observaciones: t.observaciones ?? '',
  };
}

export interface UseEditarTarjetaParams {
  tarjetas: TarjetaTurno[];
  ops: OutboxOp[];
  userId: string | undefined;
  /** Catálogo completo de equipos — las opciones del selector de máquina. */
  equipos: Equipment[];
}

export interface UseEditarTarjetaResult {
  editando: TarjetaTurno | null;
  abrirEdicion: (id: string) => void;
  cerrarEdicion: () => void;
  /** `null` si se puede editar; si no, el motivo para mostrar junto al botón. */
  motivoSinEdicion: (t: TarjetaTurno) => string | null;
  form: EdicionTarjetaState;
  setForm: (cambio: (actual: EdicionTarjetaState) => EdicionTarjetaState) => void;
  /** Tarjeta ya cerrada: el horómetro final, los litros y el AdBlue también se editan. */
  esCerrada: boolean;
  /** Cerrada Y con turno conocido: se puede corregir si salió DIURNO o NOCTURNO. */
  editaTurno: boolean;
  /** Opciones del selector de máquina (misma clase pesado/liviano que la tarjeta). */
  opcionesEquipo: { valor: string; titulo: string; detalle: string }[];
  /** La tarjeta todavía no llegó al servidor: el cambio se aplica antes de
   * enviarla (no hay aviso al administrador ni historial). */
  soloEnElEquipo: boolean;
  adBlue: ResultadoAdBlue;
  finalInvalido: boolean;
  /** Qué falta para guardar una tarjeta cerrada; `null` si nada falta o si lo
   * dice ya el propio campo (final menor que el inicial, AdBlue). */
  faltante: string | null;
  puedeGuardar: boolean;
  guardar: () => Promise<void>;
  isGuardando: boolean;
  guardado: boolean;
  /** Historial del servidor — vacío si la tarjeta no existe allá o no hay señal. */
  cambios: EntradaCambios[];
  cargandoCambios: boolean;
  /** Se muestra el historial (online y tarjeta ya enviada). */
  historialDisponible: boolean;
}

const SIN_FORM: EdicionTarjetaState = {
  operatorId: '',
  equipoId: '',
  turno: '',
  inicial: '',
  final: '',
  litros: '',
  adBlue: false,
  adBlueLitros: '',
  observaciones: '',
};

/** Quita las claves `undefined`: un campo sin valor no es un cambio. */
function sinUndefined<T extends object>(obj: T): T {
  // Mismas claves que `obj`, menos las vacías: el tipo no cambia.
  return Object.fromEntries(Object.entries(obj).filter(([, valor]) => valor !== undefined)) as T;
}

/**
 * Editar una tarjeta de turno (operador, horómetros, litros, AdBlue,
 * observaciones) — sub-hook de `useShiftRegister`.
 *
 * Si la apertura o el cierre de la tarjeta TODAVÍA están en el outbox se edita
 * ESA operación (el servidor nunca vio el dato viejo: no hay qué avisar ni qué
 * versionar). Lo que no cabe ahí —o si el replay ya la tiene en vuelo— se
 * encola como `PATCH` con solo los campos tocados y su precondición.
 */
export function useEditarTarjeta({ tarjetas, ops, userId, equipos }: UseEditarTarjetaParams): UseEditarTarjetaResult {
  const enLinea = useOnlineStatus();
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setFormState] = useState<EdicionTarjetaState>(SIN_FORM);
  const [guardado, setGuardado] = useState(false);
  const edicion = useQueuedMutation<'shiftCard.edit', GuardarTarjetaVars>({
    endpoint: 'shiftCard.edit',
    waitMs: 0,
    userId,
    build: armarPatchDeTarjeta,
    // El cambio se absorbió en operaciones que seguían en la cola: no hay PATCH,
    // pero quedó guardado igual.
    onUnchanged: avisarGuardadoEnCola,
    errorFallback: 'No se pudo guardar el cambio en el equipo.',
    errorMessage: (error) => mensajeErrorOperacion(error, 'No se pudo guardar el cambio en el equipo.'),
  });
  const isGuardando = edicion.isPending;

  const editando = tarjetas.find((t) => t.id === editandoId) ?? null;
  const esCerrada = editando?.estado === 'cerrada';
  // El turno solo se corrige si se sabe cuál es (una tarjeta vieja sin
  // `shift` no lo trae); el servidor igual lo exige cerrada.
  const editaTurno = esCerrada && editando != null && turnoDeTarjeta(editando) != null;
  const opcionesEquipo = useMemo(() => {
    if (!editando) return [];
    // Misma clase que la tarjeta: un pesado va en horas y exige operador, un
    // liviano va en km — cruzarlos cambiaría las reglas (y el backend lo
    // rechaza igual).
    const liviano = editando.liviano === true;
    const opciones = equipos
      .filter((e) => (e.equipmentClass === 'LIGHT') === liviano)
      .map((e) => ({ valor: e.id, titulo: e.internalCode, detalle: e.type }))
      .sort((a, b) => a.titulo.localeCompare(b.titulo, 'es-CL', { numeric: true }));
    // La máquina actual siempre aparece, aunque el catálogo (cacheado
    // offline) todavía no la tenga.
    if (!opciones.some((o) => o.valor === editando.equipoId)) {
      opciones.unshift({ valor: editando.equipoId, titulo: editando.equipo, detalle: editando.tipo });
    }
    return opciones;
  }, [equipos, editando]);
  // Un liviano (camioneta) no lleva operador: lo maneja quien la saca
  // (administrador, supervisor, mantenedor…). Solo el pesado lo exige.
  const pideOperador = editando != null && !editando.liviano;
  const opApertura = ops.find((o) => o.type === 'openCard' && o.id === editandoId);
  // Backfill (`registerClosedCard`): la tarjeta COMPLETA todavía vive en la
  // cola — mismo trato que una apertura pendiente.
  const opRegistroCerrado = ops.find((o) => o.type === 'registerClosedCard' && o.id === editandoId);
  const soloEnElEquipo = opApertura != null || opRegistroCerrado != null;

  const historialDisponible = editando != null && !soloEnElEquipo && enLinea;
  const cambios = useCambiosTarjeta(editandoId, historialDisponible);

  const adBlueLitros = parseDecimal(form.adBlueLitros);
  const adBlue = validarAdBlue(form.adBlue, adBlueLitros, true);
  const inicialNum = parseDecimal(form.inicial);
  const finalNum = parseDecimal(form.final);
  const litrosNum = parseDecimal(form.litros);
  // Mismo criterio que el cierre: 48493 en una camioneta no se guarda (era 48,493).
  const revisionLitros = validarLitros(form.litros, { liviano: !!editando?.liviano });
  const finalInvalido = esCerrada && inicialNum != null && finalNum != null && finalNum < inicialNum;
  const incompleto =
    inicialNum == null ||
    (pideOperador && !form.operatorId) ||
    (esCerrada && !form.equipoId) ||
    (esCerrada &&
      (finalNum == null ||
        litrosNum == null ||
        litrosNum < 0 ||
        litrosNum > LITROS_MAX ||
        revisionLitros.error != null)) ||
    (esCerrada && adBlueIncompleto(form.adBlue, adBlueLitros));
  const faltante = !esCerrada
    ? null
    : inicialNum == null || finalNum == null
      ? editando?.liviano
        ? 'Falta el kilometraje.'
        : 'Faltan los horómetros.'
      : litrosNum == null || litrosNum < 0
        ? 'Indica los litros de combustible (cero si no cargó).'
        : revisionLitros.error;
  const puedeGuardar = editando != null && !incompleto && !finalInvalido && !isGuardando;

  const abrirEdicion = (id: string) => {
    const t = tarjetas.find((x) => x.id === id);
    if (!t) return;
    setFormState(estadoInicial(t));
    setGuardado(false);
    setEditandoId(id);
  };

  const cerrarEdicion = () => setEditandoId(null);

  const motivoSinEdicion = (t: TarjetaTurno): string | null =>
    t.edicionRequiereAtencion ? 'Resuelve el cambio pendiente en Sincronización antes de editar de nuevo.' : null;

  const guardar = async () => {
    if (!editando || !puedeGuardar || !userId || inicialNum == null) return;

    const base = estadoDeBase(editando);
    const nuevo: EditShiftCardBody = {
      operatorId: form.operatorId,
      valorInicial: inicialNum,
      ...(esCerrada
        ? {
            equipoId: form.equipoId,
            ...(editaTurno ? { turno: form.turno as ShiftType } : {}),
            valorFinal: finalNum ?? undefined,
            fuelLiters: litrosNum ?? undefined,
            adBlue: form.adBlue,
            adBlueLiters: form.adBlue ? (adBlue.litros ?? undefined) : undefined,
          }
        : {}),
      observaciones: form.observaciones.trim(),
    };
    const campos: (keyof EditShiftCardBody)[] = [
      ...(pideOperador ? (['operatorId'] as const) : []),
      'valorInicial',
      ...(esCerrada ? (['equipoId', 'valorFinal', 'fuelLiters', 'adBlue', 'adBlueLiters'] as const) : []),
      ...(editaTurno ? (['turno'] as const) : []),
      'observaciones',
    ];
    const diff = diferenciaEdicion(base, nuevo, campos);
    // Con AdBlue apagado el servidor borra los litros solo: mandar
    // `adBlueLiters` junto a `adBlue: false` sería un 400.
    if (!form.adBlue) {
      delete diff.cambios.adBlueLiters;
      delete diff.esperado.adBlueLiters;
    }
    if (Object.keys(diff.cambios).length === 0) {
      setEditandoId(null);
      return;
    }

    const aperturaId = opApertura?.id;
    const cierreId = ops.find((o) => o.type === 'closeCard' && o.payload.cardId === editando.id)?.id;
    const registroCerradoId = opRegistroCerrado?.id;
    try {
      await edicion.mutateAsync({ tarjetaId: editando.id, userId, diff, aperturaId, cierreId, registroCerradoId });
      setGuardado(true);
    } catch {
      // `useQueuedMutation` ya avisó el error; la hoja queda abierta.
    }
  };

  return {
    editando,
    abrirEdicion,
    cerrarEdicion,
    motivoSinEdicion,
    form,
    setForm: (cambio) => setFormState(cambio),
    esCerrada,
    editaTurno,
    opcionesEquipo,
    soloEnElEquipo,
    adBlue,
    finalInvalido,
    faltante,
    puedeGuardar,
    guardar,
    isGuardando,
    guardado,
    cambios: cambios.data ?? [],
    cargandoCambios: cambios.isLoading,
    historialDisponible,
  };
}

interface GuardarTarjetaVars {
  tarjetaId: string;
  userId: string;
  diff: DiffEdicion<EditShiftCardBody>;
  /** Operación `openCard` de esta tarjeta que todavía está en la cola. */
  aperturaId: string | undefined;
  /** Operación `closeCard` de esta tarjeta que todavía está en la cola. */
  cierreId: string | undefined;
  /** Operación `registerClosedCard` (backfill) de esta tarjeta aún en la cola. */
  registroCerradoId: string | undefined;
}

/**
 * Lo que vive en una operación de apertura o cierre todavía pendiente se edita
 * ahí (el servidor nunca vio el dato viejo); lo que queda se manda como `PATCH`
 * con solo los campos tocados y su precondición. La cola ya lo pone detrás de lo
 * que siga pendiente para esta tarjeta.
 */
async function armarPatchDeTarjeta({
  tarjetaId,
  userId,
  diff,
  aperturaId,
  cierreId,
  registroCerradoId,
}: GuardarTarjetaVars) {
  // Backfill aún en cola: la tarjeta COMPLETA vive en una sola operación, así
  // que TODOS los campos tocados se corrigen ahí; si el replay ya la tiene en
  // vuelo (`maybe-sent`/`missing`), cae al PATCH normal de abajo.
  if (registroCerradoId) {
    const {
      adBlue: conAdBlue,
      adBlueLiters: litrosAdBlue,
      observaciones,
      turno: turnoBackfill,
      ...resto
    } = diff.cambios;
    const resultado = await patchRegisterClosedCardOp(registroCerradoId, userId, {
      ...resto,
      // El turno de la tarjeta es el `shiftType` del payload del backfill.
      ...(turnoBackfill !== undefined ? { shiftType: turnoBackfill } : {}),
      ...(conAdBlue !== undefined ? { adBlue: conAdBlue, adBlueLiters: conAdBlue ? litrosAdBlue : undefined } : {}),
      ...(conAdBlue === undefined && litrosAdBlue !== undefined ? { adBlueLiters: litrosAdBlue } : {}),
      ...(observaciones !== undefined ? { observaciones: observaciones || undefined } : {}),
    });
    if (resultado === 'updated') return null;
  }

  const { operatorId, valorInicial, turno, equipoId, ...deCierre } = diff.cambios;

  let aperturaPendiente: EditShiftCardBody = sinUndefined({ operatorId, valorInicial });
  if (aperturaId && Object.keys(aperturaPendiente).length > 0) {
    const resultado = await patchOpenCardOp(aperturaId, userId, aperturaPendiente);
    if (resultado === 'updated') aperturaPendiente = {};
  }
  let cierrePendiente: EditShiftCardBody = sinUndefined(deCierre);
  if (cierreId && Object.keys(cierrePendiente).length > 0) {
    const { adBlue: conAdBlue, adBlueLiters: litrosAdBlue, observaciones, ...resto } = cierrePendiente;
    const resultado = await patchCloseCardOp(cierreId, userId, {
      ...resto,
      ...(conAdBlue !== undefined ? { adBlue: conAdBlue, adBlueLiters: conAdBlue ? litrosAdBlue : undefined } : {}),
      ...(conAdBlue === undefined && litrosAdBlue !== undefined ? { adBlueLiters: litrosAdBlue } : {}),
      ...(observaciones !== undefined ? { observaciones: observaciones || undefined } : {}),
    });
    if (resultado === 'updated') cierrePendiente = {};
  }

  // Turno y equipo no viven en las operaciones pendientes de apertura/cierre:
  // van siempre por PATCH — la cola ya lo pone detrás de lo que siga
  // pendiente para esta tarjeta, así que el servidor los aplica al final.
  const body: EditShiftCardBody = { ...aperturaPendiente, ...cierrePendiente, ...sinUndefined({ turno, equipoId }) };
  const campos = Object.keys(body);
  if (campos.length === 0) return null;
  return { params: { id: tarjetaId }, body, expected: precondicion(diff.esperado, campos) };
}

/** Lo que la pantalla muestra HOY de la tarjeta (servidor + pendientes): la
 * base contra la que se compara el formulario y la precondición del PATCH. */
function estadoDeBase(t: TarjetaTurno): EditShiftCardBody {
  return {
    operatorId: t.operatorId ?? '',
    equipoId: t.equipoId,
    turno: turnoDeTarjeta(t),
    valorInicial: t.inicial,
    valorFinal: t.final,
    fuelLiters: t.litros,
    adBlue: t.adBlue ?? false,
    adBlueLiters: t.adBlue ? t.adBlueLitros : undefined,
    observaciones: (t.observaciones ?? '').trim(),
  };
}
