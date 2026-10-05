import { useState, type Dispatch, type SetStateAction } from 'react';
import { toast } from '@heroui/react';

import { formatDecimalInput, parseDecimal } from '../lib/decimal';
import type { TarjetaTurno } from './shift-register-helpers';
import { enqueueCloseCard } from '../offline/outbox';
import { adBlueIncompleto, validarAdBlue, type ResultadoAdBlue } from '../lib/adblue';
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

const DEFAULT_CIERRE: CierreState = { final: '', litros: '', adBlue: false, adBlueLitros: '', observaciones: '' };

export interface UseCierreFormParams {
  tarjetas: TarjetaTurno[];
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
export function useCierreForm({ tarjetas, userId }: UseCierreFormParams): UseCierreFormResult {
  const [cierre, setCierre] = useState<CierreState>(DEFAULT_CIERRE);

  /** Foto del surtidor, OCR y EXIF (`usePhotoCaptureFlow` + `FotoRespaldoField`).
   * La foto no se sube desde la pantalla: se guarda comprimida en Dexie
   * (`enqueueCloseCard`) y se sube recién durante el replay (`offline/replay.ts`). */
  const foto = usePhotoCaptureFlow((litros) =>
    setCierre((c) => ({
      ...c,
      litros: formatDecimalInput(litros, 1),
    })),
  );

  const [cerrandoId, setCerrandoId] = useState<string | null>(null);
  const cerrando = tarjetas.find((t) => t.id === cerrandoId) ?? null;
  const finalNum = parseDecimal(cierre.final);
  const horasMaquina = cerrando && finalNum != null ? finalNum - cerrando.inicial : null;
  const finalInvalido = horasMaquina != null && horasMaquina < 0;

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
    if (!cerrando || finalNum == null || finalInvalido || adBlueIncompletoCierre || !foto.file || isCerrando) return;
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

  return { cerrandoId, setCerrandoId, cerrando, cierre, setCierre, abrirCierre, cerrar, finalNum, horasMaquina, finalInvalido, adBlueCierre, adBlueIncompletoCierre, isCerrando, foto };
}
