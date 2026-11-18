import { useState, type Dispatch, type SetStateAction } from 'react';
import { toast } from '@heroui/react';

import type { TarjetaTurno } from './shift-register-helpers';
import { adBlueIncompleto, validarAdBlue, type ResultadoAdBlue } from '../lib/adblue';
import { formatDecimalInput, parseDecimal } from '../lib/decimal';
import { mensajeErrorOperacion } from '../lib/error-messages';
import { validarLitros } from '../lib/litros';
import { avisarGuardadoEnCola } from '../lib/outbox-feedback';
import { toDateOnly, type ContextoTurno } from '../lib/turno';
import { usePhotoCaptureFlow, type UsePhotoCaptureFlowResult } from '../lib/usePhotoCaptureFlow';
import { generateUuid } from '../lib/uuid';
import { submitWrite } from '../offline/submit-write';
import type { Equipment } from '../types/equipment';

/** Tope del kilometraje que acepta el servidor. */
export const KM_MAX = 1_000_000;

export interface CargaLivianoState {
  litros: string;
  km: string;
  adBlue: boolean;
  adBlueLitros: string;
}

const VACIO: CargaLivianoState = { litros: '', km: '', adBlue: false, adBlueLitros: '' };

export interface UseCargaLivianoParams {
  tarjetas: TarjetaTurno[];
  /** Para sugerir el último kilometraje conocido de la camioneta. */
  equipos: Equipment[];
  ctx: ContextoTurno;
  userId: string | undefined;
}

export interface UseCargaLivianoResult {
  cargandoId: string | null;
  /** La tarjeta (liviano abierto) a la que se le está registrando la carga. */
  cargando: TarjetaTurno | null;
  abrirCarga: (id: string) => void;
  cancelarCarga: () => void;
  form: CargaLivianoState;
  setForm: Dispatch<SetStateAction<CargaLivianoState>>;
  /** El último kilometraje conocido (la última carga o el de la camioneta), si
   * sirve: con él se prellena el campo al abrir. */
  kmSugerido: number | null;
  litrosError: string | null;
  litrosAviso: string | null;
  /** Error del kilometraje (no es número, menor que el inicial, fuera de rango). */
  kmError: string | null;
  adBlue: ResultadoAdBlue;
  adBlueIncompleto: boolean;
  /** Por qué todavía no se puede guardar, para decirlo bajo el botón; `null` si se puede. */
  falta: string | null;
  /** Todo listo para guardar (incluida la lectura de la foto ya terminada). */
  puedeGuardar: boolean;
  guardar: () => Promise<void>;
  isGuardando: boolean;
  foto: UsePhotoCaptureFlowResult;
}

/** El último km conocido de la tarjeta: su última carga o el de la camioneta,
 * nunca uno menor que el inicial (no serviría de sugerencia). */
function ultimoKm(t: TarjetaTurno, equipos: Equipment[]): number | null {
  const ultimaCarga = t.cargas?.at(-1)?.km;
  const delEquipo = equipos.find((e) => e.id === t.equipoId)?.currentMileage ?? null;
  const candidatos = [ultimaCarga, delEquipo].filter((v): v is number => v != null && v >= t.inicial);
  return candidatos.length ? Math.max(...candidatos) : null;
}

/**
 * Carga de combustible de una camioneta SIN cerrar su tarjeta (a veces cargan y
 * la siguen usando). Mismo flujo de foto + OCR que el cierre; el km al cargar es
 * obligatorio y no puede ser menor que el inicial. Siempre se encola
 * (`shiftCard.fuelLoad` en la cola, ver `offline/endpoints/terreno.ts`): la foto
 * se sube en el replay y la carga se ve en la tarjeta mientras tanto
 * (`useShiftProjection`).
 */
export function useCargaLiviano({ tarjetas, equipos, ctx, userId }: UseCargaLivianoParams): UseCargaLivianoResult {
  const [form, setForm] = useState<CargaLivianoState>(VACIO);
  const [cargandoId, setCargandoId] = useState<string | null>(null);
  const [isGuardando, setIsGuardando] = useState(false);

  const foto = usePhotoCaptureFlow((litros) => setForm((f) => ({ ...f, litros: formatDecimalInput(litros, 3) })));

  const cargando = tarjetas.find((t) => t.id === cargandoId && t.liviano && t.estado === 'curso') ?? null;
  const kmSugerido = cargando ? ultimoKm(cargando, equipos) : null;

  const validacionLitros = validarLitros(form.litros, { liviano: true });
  const litrosNum = validacionLitros.valor;
  const litrosError =
    validacionLitros.error ?? (litrosNum != null && litrosNum <= 0 ? 'Los litros tienen que ser más que 0.' : null);

  const kmNum = parseDecimal(form.km);
  const kmError =
    form.km.trim() !== '' && kmNum == null
      ? 'Escribe un número, por ejemplo 45120.'
      : kmNum != null && cargando && kmNum < cargando.inicial
        ? `No puede ser menor que el kilometraje inicial de la tarjeta (${cargando.inicial.toLocaleString('es-CL')} km).`
        : kmNum != null && kmNum > KM_MAX
          ? `No puede superar los ${KM_MAX.toLocaleString('es-CL')} km.`
          : null;

  const adBlueLitrosNum = parseDecimal(form.adBlueLitros);
  const adBlue = validarAdBlue(form.adBlue, adBlueLitrosNum, form.adBlueLitros.trim() !== '');
  const adBlueFalta = adBlueIncompleto(form.adBlue, adBlueLitrosNum);

  const falta = !foto.file
    ? 'Falta la foto del surtidor.'
    : litrosNum == null
      ? 'Faltan los litros cargados.'
      : kmNum == null
        ? 'Falta el kilometraje al cargar.'
        : null;
  const listo = falta == null && !litrosError && !kmError && !adBlueFalta && !foto.isReadingPhoto;

  const abrirCarga = (id: string) => {
    const t = tarjetas.find((x) => x.id === id);
    const sugerido = t ? ultimoKm(t, equipos) : null;
    setCargandoId(id);
    setForm({ ...VACIO, km: formatDecimalInput(sugerido ?? undefined, 0) });
    // La foto es de ESTA carga: arrastrar otra mezclaría respaldos.
    foto.resetPhoto();
  };

  const cancelarCarga = () => {
    setCargandoId(null);
    foto.resetPhoto();
  };

  const guardar = async () => {
    if (!cargando || !listo || isGuardando || !userId || !foto.file || litrosNum == null || kmNum == null) return;
    setIsGuardando(true);
    try {
      await submitWrite(
        'shiftCard.fuelLoad',
        {
          params: { id: cargando.id },
          body: {
            id: generateUuid(),
            liters: litrosNum,
            reading: kmNum,
            ...(form.adBlue && adBlue.litros != null ? { adBlueLiters: adBlue.litros } : {}),
            capturedAt: new Date().toISOString(),
            ...(foto.captureDate ? { photoCapturedAt: foto.captureDate.toISOString() } : {}),
            // El turno de quien carga, igual que en el cierre del liviano.
            shiftDate: toDateOnly(ctx.fecha),
            shiftType: ctx.turno,
          },
          files: [{ field: 'tmpPhotoKey', file: foto.file }],
        },
        // Terreno no espera al servidor: queda en la cola y se ve en la tarjeta.
        { waitMs: 0, userId },
      );
      avisarGuardadoEnCola();
      setCargandoId(null);
      foto.resetPhoto();
    } catch (error) {
      toast.danger(mensajeErrorOperacion(error, 'No se pudo guardar la carga en el equipo.'));
    } finally {
      setIsGuardando(false);
    }
  };

  return {
    cargandoId,
    cargando,
    abrirCarga,
    cancelarCarga,
    form,
    setForm,
    kmSugerido,
    litrosError,
    litrosAviso: validacionLitros.aviso,
    kmError,
    adBlue,
    adBlueIncompleto: adBlueFalta,
    falta,
    puedeGuardar: listo && !isGuardando,
    guardar,
    isGuardando,
    foto,
  };
}
