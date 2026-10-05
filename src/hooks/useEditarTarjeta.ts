import { useState } from 'react';
import { toast } from '@heroui/react';

import { useCambiosTarjeta } from './useShiftCards';
import { useOnlineStatus } from './useOnlineStatus';
import { aNumero, type TarjetaTurno } from './shift-register-helpers';
import { diferenciaEdicion, precondicion } from '../lib/edit-diff';
import { adBlueIncompleto, validarAdBlue, type ResultadoAdBlue } from '../lib/adblue';
import { mensajeErrorOperacion } from '../lib/error-messages';
import { avisarGuardadoEnCola } from '../lib/outbox-feedback';
import { opsDeCreacion, shiftCardEntity, type OutboxOp } from '../offline/db';
import { patchCloseCardOp, patchOpenCardOp } from '../offline/outbox';
import { submitWrite } from '../offline/submit-write';
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

/** Número → texto del formulario (formato chileno, sin separador de miles: es
 * lo que `aNumero` vuelve a leer). */
function aTexto(n: number | undefined): string {
  return n == null ? '' : n.toLocaleString('es-CL', { useGrouping: false, maximumFractionDigits: 2 });
}

function estadoInicial(t: TarjetaTurno): EdicionTarjetaState {
  return {
    operatorId: t.operatorId ?? '',
    inicial: aTexto(t.inicial),
    final: aTexto(t.final),
    litros: aTexto(t.litros),
    adBlue: t.adBlue ?? false,
    adBlueLitros: aTexto(t.adBlueLitros),
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
  const [isGuardando, setIsGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  const editando = tarjetas.find((t) => t.id === editandoId) ?? null;
  const esCerrada = editando?.estado === 'cerrada';
  const opApertura = ops.find((o) => o.type === 'openCard' && o.id === editandoId);
  const soloEnElEquipo = opApertura != null;

  const historialDisponible = editando != null && !soloEnElEquipo && enLinea;
  const cambios = useCambiosTarjeta(editandoId, historialDisponible);

  const adBlueLitros = aNumero(form.adBlueLitros);
  const adBlue = validarAdBlue(form.adBlue, adBlueLitros, true);
  const inicialNum = aNumero(form.inicial);
  const finalNum = aNumero(form.final);
  const litrosNum = aNumero(form.litros);
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

    setIsGuardando(true);
    try {
      const opCierre = ops.find((o) => o.type === 'closeCard' && o.payload.cardId === editando.id);
      const { operatorId, valorInicial, ...deCierre } = diff.cambios;

      // 1. Lo que vive en una operación todavía pendiente se edita ahí.
      let aperturaPendiente: EditShiftCardBody = sinUndefined({ operatorId, valorInicial });
      if (opApertura && Object.keys(aperturaPendiente).length > 0) {
        const resultado = await patchOpenCardOp(opApertura.id, userId, aperturaPendiente);
        if (resultado === 'updated') aperturaPendiente = {};
      }
      let cierrePendiente: EditShiftCardBody = sinUndefined(deCierre);
      if (opCierre && Object.keys(cierrePendiente).length > 0) {
        const { adBlue: conAdBlue, adBlueLiters: litrosAdBlue, observaciones, ...resto } = cierrePendiente;
        const resultado = await patchCloseCardOp(opCierre.id, userId, {
          ...resto,
          ...(conAdBlue !== undefined ? { adBlue: conAdBlue, adBlueLiters: conAdBlue ? litrosAdBlue : undefined } : {}),
          ...(conAdBlue === undefined && litrosAdBlue !== undefined ? { adBlueLiters: litrosAdBlue } : {}),
          ...(observaciones !== undefined ? { observaciones: observaciones || undefined } : {}),
        });
        if (resultado === 'updated') cierrePendiente = {};
      }

      // 2. Lo que quedó se manda como PATCH, detrás de lo que todavía esté en cola para esta tarjeta.
      const body: EditShiftCardBody = { ...aperturaPendiente, ...cierrePendiente };
      const campos = Object.keys(body);
      if (campos.length > 0) {
        await submitWrite(
          'shiftCard.edit',
          {
            params: { id: editando.id },
            body,
            expected: precondicion(diff.esperado, campos),
            entityKey: shiftCardEntity(editando.id),
            dependsOn: opsDeCreacion(shiftCardEntity(editando.id), ops),
          },
          { waitMs: 0, userId },
        );
      }
      avisarGuardadoEnCola();
      setGuardado(true);
    } catch (error: unknown) {
      toast.danger(mensajeErrorOperacion(error, 'No se pudo guardar el cambio en el equipo.'));
    } finally {
      setIsGuardando(false);
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
