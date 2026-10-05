import { z } from 'zod';

/**
 * Contrato del dominio Plataforma (`GET/POST/PATCH/DELETE /api/branches`).
 * Sucursal / bodega base, referenciada por `Equipment.homeBranch` (ver
 * `types/equipment.ts`) y, a futuro, por Inventario.
 */
export const BranchSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Branch = z.infer<typeof BranchSchema>;

// --- Envolturas `{ data, message }` ---------------------------------------

export const BranchListResponseSchema = z.object({
  data: z.array(BranchSchema),
  message: z.string(),
});

export const BranchResponseSchema = z.object({
  data: BranchSchema,
  message: z.string(),
});

// --- Bodies de API -------------------------------------------------------

/** Body de `POST /api/branches`. */
export interface CreateBranchInput {
  name: string;
  address?: string;
  isActive?: boolean;
}

/** Body de `PATCH /api/branches/:id`. */
export type UpdateBranchInput = Partial<CreateBranchInput>;

/** Los campos editables de una sucursal tal como los guarda el servidor: la
 * forma de la base de una edición (una dirección vacía es `null`). */
export interface BranchFields {
  name: string;
  address: string | null;
  isActive: boolean;
}
