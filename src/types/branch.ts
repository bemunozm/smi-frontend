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

export const DeleteBranchResponseSchema = z.object({
  data: z.object({ id: z.string() }).nullable(),
  message: z.string(),
});

// --- Formularios (RHF + zodResolver) --------------------------------------

export const BranchFormSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio').max(80, 'Máximo 80 caracteres'),
  address: z.string().max(200, 'Máximo 200 caracteres').or(z.literal('')),
  isActive: z.boolean(),
});
export type BranchFormValues = z.infer<typeof BranchFormSchema>;

/** Body de `POST /api/branches`. */
export interface CreateBranchInput {
  name: string;
  address?: string;
  isActive?: boolean;
}

/** Body de `PATCH /api/branches/:id`. */
export type UpdateBranchInput = Partial<CreateBranchInput>;

export function toBranchPayload(values: BranchFormValues): CreateBranchInput {
  return {
    name: values.name.trim(),
    ...(values.address.trim() ? { address: values.address.trim() } : {}),
    isActive: values.isActive,
  };
}
