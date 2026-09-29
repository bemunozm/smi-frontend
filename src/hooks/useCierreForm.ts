import { useState, type Dispatch, type SetStateAction } from 'react';
import { toast } from '@heroui/react';

import { aNumero, type TarjetaTurno } from './shift-register-helpers';
import { enqueueCloseCard } from '../offline/outbox';
import { generateUuid } from '../lib/uuid';
import { usePhotoCaptureFlow, type UsePhotoCaptureFlowResult } from '../lib/usePhotoCaptureFlow';

export interface CierreState {
  final: string;
  litros: string;
  observaciones: string;
}

const DEFAULT_CIERRE: CierreState = { final: '', litros: '', observaciones: '' };

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
  isCerrando: boolean;
  foto: UsePhotoCaptureFlowResult;
}

/**
 * Formulario de cierre de tarjeta — sub-hook de `useShiftRegister` (Anexo 3,
 * revisión final). `cerrar()` SIEMPRE encola vía `enqueueCloseCard` (la
 * subida de la foto pasa en segundo plano en el replay, ver
 * `offline/replay.ts`).
 */
export function useCierreForm({ tarjetas, userId }: UseCierreFormParams): UseCierreFormResult {
  const [cierre, setCierre] = useState<CierreState>(DEFAULT_CIERRE);

  /** Foto del surtidor, OCR y EXIF — mismo flujo compartido de Flota que ya
   * usaba la maqueta (`usePhotoCaptureFlow` + `FotoRespaldoField`). La
   * SUBIDA no la dispara esta pantalla (`foto.upload` queda sin uso acá): el
   * archivo se guarda comprimido en Dexie (`enqueueCloseCard`) y se sube
   * recién durante el replay (`offline/replay.ts`). */
  const foto = usePhotoCaptureFlow((litros) =>
    setCierre((c) => ({
      ...c,
      litros: litros.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    })),
  );

  const [cerrandoId, setCerrandoId] = useState<string | null>(null);
  const cerrando = tarjetas.find((t) => t.id === cerrandoId) ?? null;
  const finalNum = aNumero(cierre.final);
  const horasMaquina = cerrando && finalNum != null ? finalNum - cerrando.inicial : null;
  const finalInvalido = horasMaquina != null && horasMaquina < 0;

  const [isCerrando, setIsCerrando] = useState(false);

  const abrirCierre = (id: string) => {
    setCerrandoId(id);
    setCierre(DEFAULT_CIERRE);
    // La foto es de ESTA tarjeta: arrastrar la anterior mezclaría el
    // respaldo de un equipo con el de otro.
    foto.resetPhoto();
  };

  const cerrar = async () => {
    if (!cerrando || finalNum == null || finalInvalido || !foto.file || isCerrando) return;
    if (!userId) return;

    setIsCerrando(true);
    try {
      await enqueueCloseCard(
        userId,
        cerrando.id,
        {
          closeClientId: generateUuid(),
          valorFinal: finalNum,
          fuelLiters: aNumero(cierre.litros) ?? 0,
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

  return { cerrandoId, setCerrandoId, cerrando, cierre, setCierre, abrirCierre, cerrar, finalNum, horasMaquina, finalInvalido, isCerrando, foto };
}
