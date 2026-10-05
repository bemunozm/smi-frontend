import { z } from 'zod';

/**
 * Trazabilidad de cambios a un registro ya enviado: quién
 * cambió qué dato, de qué valor a cuál y cuándo. Misma forma que devuelve el
 * backend (`ChangeLog`), con los valores ya legibles.
 */
export interface CambioCampo {
  field: string;
  label: string;
  before: string;
  after: string;
}

export interface EntradaCambios {
  id: string;
  userName: string;
  /** ISO. */
  createdAt: string;
  changes: CambioCampo[];
}

export const EntradaCambiosSchema = z.object({
  id: z.string(),
  userName: z.string(),
  createdAt: z.string(),
  changes: z.array(z.object({ field: z.string(), label: z.string(), before: z.string(), after: z.string() })),
});

export const EntradaCambiosListResponseSchema = z.object({
  data: z.array(EntradaCambiosSchema),
  message: z.string().optional(),
});
