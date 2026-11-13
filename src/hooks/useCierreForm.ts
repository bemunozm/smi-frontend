import { useState, type Dispatch, type SetStateAction } from 'react';
import { toast } from '@heroui/react';

import { formatDecimalInput, parseDecimal } from '../lib/decimal';
import { validarLitros } from '../lib/litros';
import type { TarjetaTurno } from './shift-register-helpers';
import { enqueueCloseCard } from '../offline/outbox';
import { adBlueIncompleto, validarAdBlue, type ResultadoAdBlue } from '../lib/adblue';
import { toDateOnly, type ContextoTurno } from '../lib/turno';
import { generateUuid } from '../lib/uuid';
import { usePhotoCaptureFlow, type UsePhotoCaptureFlowResult } from '../lib/usePhotoCaptureFlow';

export interface CierreState {
  final: string;
  litros: string;
  /** ¿Cargó AdBlue en el turno? */
  adBlue: boolean;
  adBlueLitros: string;
  observaciones: string;
}

// Topes y mensajes de litros: viven en `lib/litros.ts` (los comparten el cierre,
// el turno pasado y las cargas del panel). Se re-exportan por compatibilidad.
export { LITROS_FUERA_DE_RANGO, LITROS_MAX } from '../lib/litros';

const DEFAULT_CIERRE: CierreState = { final: '', litros: '', adBlue: false, adBlueLitros: '', observaciones: '' };

export interface UseCierreFormParams {
  tarjetas: TarjetaTurno[];
  ctx: ContextoTurno;
  userId: string | undefined;
}

export interface UseCierreFormResult {
  cerrandoId: string | null;
  setCerrandoId: Dispatch<SetStateAction<string | null>>;
  cerrando: TarjetaTurno | null;
  cierre: CierreState;
  setCierre: Dispatch<SetStateAction<CierreState>>;
  abrirCierre: (id: string) => void;
  cerrar: () => Promise<void>;
  finalNum: number | null;
  horasMaquina: number | null;
  finalInvalido: boolean;
  /** Texto que no es número o litros fuera de 0–100.000: no se puede cerrar
   * (el servidor lo rechazaría y la tarjeta quedaría trabada en la cola). */
  litrosError: string | null;
  /** Muchos litros para una camioneta: se avisa, no bloquea. */
  litrosAviso: string | null;
  /** Validación del AdBlue: `error` impide cerrar, `aviso` (> 30 L) no. */
  adBlueCierre: ResultadoAdBlue;
  /** `true` si se marcó AdBlue y los litros todavía no sirven. */
  adBlueIncompletoCierre: boolean;
  isCerrando: boolean;
  foto: UsePhotoCaptureFlowResult;
}

/**
 * Formulario de cierre de tarjeta — sub-hook de `useShiftRegister`.
 * `cerrar()` SIEMPRE encola vía `enqueueCloseCard` (la
 * subida de la foto pasa en segundo plano en el replay, ver
 * `offline/replay.ts`).
 */
export function useCierreForm({ tarjetas, ctx, userId }: UseCierreFormParams): UseCierreFormResult {
  const [cierre, setCierre] = useState<CierreState>(DEFAULT_CIERRE);

  /** Foto del surtidor, OCR y EXIF (`usePhotoCaptureFlow` + `FotoRespaldoField`).
   * La foto no se sube desde la pantalla: se guarda comprimida en Dexie
   * (`enqueueCloseCard`) y se sube recién durante el replay (`offline/replay.ts`). */
  const foto = usePhotoCaptureFlow((litros) =>
    setCierre((c) => ({
      ...c,
      // Los 3 decimales del surtidor tal cual (antes se redondeaba a 1: 48,493 → 48,5).
      litros: formatDecimalInput(litros, 3),
    })),
  );

  const [cerrandoId, setCerrandoId] = useState<string | null>(null);
  const cerrando = tarjetas.find((t) => t.id === cerrandoId) ?? null;
  const finalNum = parseDecimal(cierre.final);
  const horasMaquina = cerrando && finalNum != null ? finalNum - cerrando.inicial : null;
  const finalInvalido = horasMaquina != null && horasMaquina < 0;

  // El punto del surtidor es la coma (48.493 = 48,493 L); una camioneta no carga
  // cientos de litros y un pesado con miles se avisa — ver `lib/litros.ts`.
  const validacionLitros = validarLitros(cierre.litros, { liviano: !!cerrando?.liviano });
  const litrosError = validacionLitros.error;
  const litrosAviso = validacionLitros.aviso;

  const adBlueLitrosNum = parseDecimal(cierre.adBlueLitros);
  const adBlueCierre = validarAdBlue(cierre.adBlue, adBlueLitrosNum, cierre.adBlueLitros.trim() !== '');
  const adBlueIncompletoCierre = adBlueIncompleto(cierre.adBlue, adBlueLitrosNum);

  const [isCerrando, setIsCerrando] = useState(false);

  const abrirCierre = (id: string) => {
    setCerrandoId(id);
    setCierre(DEFAULT_CIERRE);
    // La foto es de ESTA tarjeta: arrastrar la anterior mezclaría el
    // respaldo de un equipo con el de otro.
    foto.resetPhoto();
  };

  const cerrar = async () => {
    if (!cerrando || finalNum == null || finalInvalido || litrosError || adBlueIncompletoCierre || !foto.file || isCerrando)
      return;
    if (!userId) return;

    setIsCerrando(true);
    try {
      await enqueueCloseCard(
        userId,
        cerrando.id,
        {
          closeClientId: generateUuid(),
          valorFinal: finalNum,
          fuelLiters: parseDecimal(cierre.litros) ?? 0,
          adBlue: cierre.adBlue,
          ...(cierre.adBlue ? { adBlueLiters: adBlueCierre.litros ?? undefined } : {}),
          observaciones: cierre.observaciones.trim() || undefined,
          capturedAt: new Date().toISOString(),
          photoCapturedAt: foto.captureDate ? foto.captureDate.toISOString() : undefined,
          // El turno de quien cierra: un liviano entra en el reporte de ESE turno.
          shiftDate: toDateOnly(ctx.fecha),
          shiftType: ctx.turno,
        },
        foto.file,
      );
      setCerrandoId(null);
      foto.resetPhoto();
    } catch (error) {
      toast.danger(error instanceof Error ? error.message : 'No se pudo guardar el cierre en el equipo.');
    } finally {
      setIsCerrando(false);
    }
  };

  return { cerrandoId, setCerrandoId, cerrando, cierre, setCierre, abrirCierre, cerrar, finalNum, horasMaquina, finalInvalido, litrosError, litrosAviso, adBlueCierre, adBlueIncompletoCierre, isCerrando, foto };
}
