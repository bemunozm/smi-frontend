import { useState } from 'react';

import { useCambiosTarjeta } from './useShiftCards';
import { useOnlineStatus } from './useOnlineStatus';
import { useQueuedMutation } from './useQueuedMutation';
import type { TarjetaTurno } from './shift-register-helpers';
import { formatDecimalInput, parseDecimal } from '../lib/decimal';
import { diferenciaEdicion, precondicion, type DiffEdicion } from '../lib/edit-diff';
import { adBlueIncompleto, validarAdBlue, type ResultadoAdBlue } from '../lib/adblue';
import { mensajeErrorOperacion } from '../lib/error-messages';
import { avisarGuardadoEnCola } from '../lib/outbox-feedback';
import type { OutboxOp } from '../offline/db';
import { patchCloseCardOp, patchOpenCardOp } from '../offline/outbox';
import type { EntradaCambios } from '../types/cambios';
import type { EditShiftCardBody } from '../types/shift';

export interface EdicionTarjetaState {
  operatorId: string;
  inicial: string;
  final: string;
  litros: string;
  adBlue: boolean;
  adBlueLitros: string;
  observaciones: string;
}

function estadoInicial(t: TarjetaTurno): EdicionTarjetaState {
  return {
    operatorId: t.operatorId ?? '',
    inicial: formatDecimalInput(t.inicial),
    final: formatDecimalInput(t.final),
    litros: formatDecimalInput(t.litros),
    adBlue: t.adBlue ?? false,
    adBlueLitros: formatDecimalInput(t.adBlueLitros),
    observaciones: t.observaciones ?? '',
  };
}

export interface UseEditarTarjetaParams {
  tarjetas: TarjetaTurno[];
  ops: OutboxOp[];
  userId: string | undefined;
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
  /** La tarjeta todavía no llegó al servidor: el cambio se aplica antes de
   * enviarla (no hay aviso al administrador ni historial). */
  soloEnElEquipo: boolean;
  adBlue: ResultadoAdBlue;
  finalInvalido: boolean;
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
export function useEditarTarjeta({ tarjetas, ops, userId }: UseEditarTarjetaParams): UseEditarTarjetaResult {
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
  const opApertura = ops.find((o) => o.type === 'openCard' && o.id === editandoId);
  const soloEnElEquipo = opApertura != null;

  const historialDisponible = editando != null && !soloEnElEquipo && enLinea;
  const cambios = useCambiosTarjeta(editandoId, historialDisponible);

  const adBlueLitros = parseDecimal(form.adBlueLitros);
  const adBlue = validarAdBlue(form.adBlue, adBlueLitros, true);
  const inicialNum = parseDecimal(form.inicial);
  const finalNum = parseDecimal(form.final);
  const litrosNum = parseDecimal(form.litros);
  const finalInvalido = esCerrada && inicialNum != null && finalNum != null && finalNum < inicialNum;
  const incompleto =
    inicialNum == null ||
    !form.operatorId ||
    (esCerrada && (finalNum == null || litrosNum == null || litrosNum < 0)) ||
    (esCerrada && adBlueIncompleto(form.adBlue, adBlueLitros));
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
    t.edicionRequiereAtencion ? 'Resolvé el cambio pendiente en Sincronización antes de editar de nuevo.' : null;

  const guardar = async () => {
    if (!editando || !puedeGuardar || !userId || inicialNum == null) return;

    const base = estadoDeBase(editando);
    const nuevo: EditShiftCardBody = {
      operatorId: form.operatorId,
      valorInicial: inicialNum,
      ...(esCerrada
        ? {
            valorFinal: finalNum ?? undefined,
            fuelLiters: litrosNum ?? undefined,
            adBlue: form.adBlue,
            adBlueLiters: form.adBlue ? (adBlue.litros ?? undefined) : undefined,
          }
        : {}),
      observaciones: form.observaciones.trim(),
    };
    const campos: (keyof EditShiftCardBody)[] = [
      'operatorId',
      'valorInicial',
      ...(esCerrada ? (['valorFinal', 'fuelLiters', 'adBlue', 'adBlueLiters'] as const) : []),
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
    try {
      await edicion.mutateAsync({ tarjetaId: editando.id, userId, diff, aperturaId, cierreId });
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
    soloEnElEquipo,
    adBlue,
    finalInvalido,
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
}

/**
 * Lo que vive en una operación de apertura o cierre todavía pendiente se edita
 * ahí (el servidor nunca vio el dato viejo); lo que queda se manda como `PATCH`
 * con solo los campos tocados y su precondición. La cola ya lo pone detrás de lo
 * que siga pendiente para esta tarjeta.
 */
async function armarPatchDeTarjeta({ tarjetaId, userId, diff, aperturaId, cierreId }: GuardarTarjetaVars) {
  const { operatorId, valorInicial, ...deCierre } = diff.cambios;

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

  const body: EditShiftCardBody = { ...aperturaPendiente, ...cierrePendiente };
  const campos = Object.keys(body);
  if (campos.length === 0) return null;
  return { params: { id: tarjetaId }, body, expected: precondicion(diff.esperado, campos) };
}

/** Lo que la pantalla muestra HOY de la tarjeta (servidor + pendientes): la
 * base contra la que se compara el formulario y la precondición del PATCH. */
function estadoDeBase(t: TarjetaTurno): EditShiftCardBody {
  return {
    operatorId: t.operatorId ?? '',
    valorInicial: t.inicial,
    valorFinal: t.final,
    fuelLiters: t.litros,
    adBlue: t.adBlue ?? false,
    adBlueLiters: t.adBlue ? t.adBlueLitros : undefined,
    observaciones: (t.observaciones ?? '').trim(),
  };
}
