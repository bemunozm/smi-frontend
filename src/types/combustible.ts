import { z } from 'zod';
import { parseDecimal } from '../lib/decimal';
import { posNumber } from '../lib/forms';

/** El campo es texto: un `.` o una `,` sueltos son el decimal (`12.5` y `12,5`
 * valen 12,5) y sin separador es entero (`100000`). Lo mismo que el resto de
 * los formularios (`lib/decimal.ts#parseDecimal`). Texto que no es número →
 * `NaN`, que `posNumber` rechaza. */
const litrosDeTexto = (v: unknown) =>
  typeof v === 'string' ? (v.trim() === '' ? undefined : (parseDecimal(v) ?? Number.NaN)) : v;

export const combustibleFormSchema = z.object({
  equipoId: z.string().min(1, 'Seleccioná un equipo'),
  litros: z.preprocess(litrosDeTexto, posNumber('Litros debe ser mayor a 0')),
  tipo: z.enum(['PETROLEO', 'BENCINA']),
  fotoUrl: z.string().optional(), // legacy Terreno: ruta servida por el backend (/uploads/...)
  /** Key `tmp/<userId>/<uuid>.<ext>` de la foto, que escribe el replay al
   * subirla (la foto viaja como archivo de la escritura, ver
   * `hooks/useCombustible.ts`). Excluyente con
   * `fotoUrl`: el backend rechaza los dos juntos. */
  fotoKey: z.string().optional(),
  // ISO datetime — auto-rellenada en el modal desde la EXIF de la foto (o
  // "ahora" sin EXIF), editable. Opcional en el schema porque el backend cae
  // a `@default(now())` sin ella, pero el modal siempre la manda con valor.
  fecha: z.string().optional(),
});

export type CombustibleForm = z.infer<typeof combustibleFormSchema>;
export type CombustibleFormInput = z.input<typeof combustibleFormSchema>;

export interface RegistroCombustible {
  id: string;
  equipoId: string;
  litros: number;
  tipo: string;
  fotoUrl: string | null;
  fecha: string;
  /** Tarjeta de turno que originó la carga (cierre con litros); null/ausente
   * en cargas manuales. */
  registroHorometroId?: string | null;
  /** `type`/`equipmentClass`/`controlUnit` los agrega el backend para la
   * vista admin de cargas; opcionales para tolerar respuestas del backend
   * anterior. */
  equipo?: {
    internalCode: string;
    type?: string;
    equipmentClass?: 'LIGHT' | 'HEAVY';
    controlUnit?: 'KM' | 'HOURS';
  };
  /** Lectura del contador del equipo AL CARGAR (horómetro en pesados, km en
   * livianos): la propia de la carga manual, o el valorFinal de la tarjeta
   * que la originó — resuelta por el backend. Null en filas viejas. */
  lectura?: number | null;
  /** Nombre YA resuelto de quien realizó la carga: el supervisor que cerró la
   * tarjeta, o quien creó la carga manual. Null en filas viejas sin ninguno. */
  realizadoPor?: string | null;
  /** TARJETA = nació del cierre de una tarjeta de turno; MANUAL = alta directa. */
  origen?: 'TARJETA' | 'MANUAL';
}
