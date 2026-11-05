import { z } from 'zod';

export const PRIORIDADES = ['BAJA', 'MEDIA', 'ALTA', 'CRITICA'] as const;

/**
 * De qué es un hallazgo (pedido del cliente, 05/11): de un EQUIPO —llega al
 * taller— o de una ZONA de la faena —un camino, una cancha, la romana—, que
 * no tiene máquina que reparar y la atiende el administrador.
 */
export const HALLAZGO_TIPOS = ['EQUIPO', 'ZONA'] as const;
export type HallazgoTipo = (typeof HALLAZGO_TIPOS)[number];

/** Las faenas de un hallazgo de zona — las mismas del Report. */
export const HALLAZGO_FAENAS = ['Patillo', 'Kainita'] as const;

export const hallazgoFormSchema = z
  .object({
    tipo: z.enum(HALLAZGO_TIPOS),
    equipoId: z.string().optional(),
    faena: z.enum(HALLAZGO_FAENAS).optional(),
    lugar: z.string().max(120, 'Máximo 120 caracteres').optional(),
    descripcion: z.string().min(3, 'Describe el hallazgo'),
    prioridad: z.enum(PRIORIDADES),
  /**
   * La foto nueva sube a storage privado y viaja como `fotoKey`; `fotoUrl`
   * queda para los hallazgos ya cargados por `/api/uploads`. El servidor
   * rechaza las dos juntas, así que el formulario manda una sola.
   */
  fotoUrl: z.string().optional(),
  fotoKey: z.string().optional(),
  /** `YYYY-MM-DD` del hallazgo — por defecto hoy; una fecha pasada es la
   * carga histórica. Solo viaja al backend cuando difiere de hoy (ver
   * `useRegistrarHallazgo`). */
    fecha: z.string().optional(),
  })
  // Cada tipo con lo suyo: el de equipo, su equipo; el de zona, faena y lugar.
  .superRefine((v, ctx) => {
    if (v.tipo === 'EQUIPO' && !v.equipoId) {
      ctx.addIssue({ code: 'custom', path: ['equipoId'], message: 'Selecciona un equipo' });
    }
    if (v.tipo === 'ZONA') {
      if (!v.faena) ctx.addIssue({ code: 'custom', path: ['faena'], message: 'Elige la faena' });
      if (!v.lugar?.trim()) ctx.addIssue({ code: 'custom', path: ['lugar'], message: 'Escribe el lugar' });
    }
  });

export type HallazgoForm = z.infer<typeof hallazgoFormSchema>;

/**
 * Lo que se guarda en el outbox al registrar un hallazgo: `id` es la clave de
 * idempotencia (uuid v4 del cliente) y `capturedAt` la hora del dispositivo.
 * La foto no viaja acá — se sube aparte y su key se agrega al mandar el POST
 * (ver `CreateHallazgoBody`).
 */
export interface CreateHallazgoInput {
  id: string;
  /** Sin él, EQUIPO (lo que mandaban los clientes viejos). */
  tipo?: HallazgoTipo;
  /** Solo EQUIPO. */
  equipoId?: string;
  /** Solo ZONA. */
  faena?: string;
  lugar?: string;
  descripcion: string;
  prioridad: HallazgoForm['prioridad'];
  capturedAt: string;
  /** `YYYY-MM-DD` — solo cuando difiere de hoy (carga histórica). */
  fecha?: string;
}

/** Body real de `POST /api/hallazgos`. `fecha` viene heredada de
 * `CreateHallazgoInput`: date-only desde Terreno (carga histórica) o con
 * hora desde el panel (un hallazgo olvidado) — en ambos casos gana sobre
 * `capturedAt`. */
export interface CreateHallazgoBody extends CreateHallazgoInput {
  fotoKey?: string;
}

export interface Hallazgo {
  id: string;
  /** Sin él (respuesta cacheada de antes), EQUIPO. */
  tipo?: HallazgoTipo;
  /** `null` en un hallazgo de zona. */
  equipoId: string | null;
  /** Solo ZONA: la faena y el lugar escrito libre. */
  faena?: string | null;
  lugar?: string | null;
  descripcion: string;
  prioridad: string;
  estado: string;
  fotoUrl: string | null;
  fecha: string;
  equipo?: { internalCode: string } | null;
  /** Nombre de quien lo registró — null si la cuenta ya no existe; opcional
   * para tolerar un backend que aún no manda el campo. */
  registradoPor?: string | null;
}

/** Forma de un hallazgo en las respuestas del servidor. */
export const HallazgoSchema = z.object({
  id: z.string(),
  // `default`: respuestas guardadas por el Service Worker antes de la columna.
  tipo: z.enum(HALLAZGO_TIPOS).default('EQUIPO'),
  equipoId: z.string().nullable(),
  faena: z.string().nullish(),
  lugar: z.string().nullish(),
  descripcion: z.string(),
  prioridad: z.string(),
  estado: z.string(),
  fotoUrl: z.string().nullable(),
  fecha: z.string(),
  equipo: z.object({ internalCode: z.string() }).nullish(),
  registradoPor: z.string().nullable().optional(),
});

/** `PATCH /api/hallazgos/:id`: solo los campos que cambiaron (la foto no se edita). */
export type EditHallazgoBody = {
  /** Solo EQUIPO; uno de zona corrige `faena` y `lugar`. `null` solo en el
   * tipo de la base: el tipo no cambia, así que nunca viaja un cambio a null. */
  equipoId?: string | null;
  faena?: string | null;
  lugar?: string | null;
  descripcion?: string;
  prioridad?: string;
  estado?: string;
};

/** Un hallazgo de equipo, con su equipo: el único que llega al taller. */
export type HallazgoDeEquipo = Hallazgo & { equipoId: string };

/** Si el hallazgo es de una zona de la faena (no de un equipo). */
export function esHallazgoDeZona(h: Pick<Hallazgo, 'tipo'>): boolean {
  return h.tipo === 'ZONA';
}

/**
 * Dónde está el hallazgo, en una línea: el código del equipo, o el lugar y la
 * faena de la zona («Cancha norte · Kainita»).
 */
export function dondeHallazgo(h: Pick<Hallazgo, 'tipo' | 'equipo' | 'equipoId' | 'faena' | 'lugar'>): string {
  if (esHallazgoDeZona(h)) return [h.lugar, h.faena].filter(Boolean).join(' · ') || 'Zona';
  return h.equipo?.internalCode ?? h.equipoId ?? '—';
}
