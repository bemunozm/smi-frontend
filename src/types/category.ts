import { z } from 'zod';

/**
 * Contrato de las categorías del catálogo (`/api/inventory/categories`) —
 * T05 · DEV-29.
 *
 * Vive aparte de `types/inventory.ts` a propósito: el ítem trae su categoría
 * embebida (`{ id, name }`), así que ninguno de los dos archivos necesita
 * importar al otro. Cruzar los imports acá fue justo lo que rompió `z.enum`
 * con un `undefined` la vez anterior.
 */
export const ItemCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  /** Cuántos ítems la usan. Es lo que explica por qué una no se puede borrar. */
  _count: z.object({ items: z.number() }),
});
export type ItemCategory = z.infer<typeof ItemCategorySchema>;

// --- Envolturas `{ data, message }` ---------------------------------------

export const CategoryListResponseSchema = z.object({
  data: z.array(ItemCategorySchema),
  message: z.string(),
});

export const CategoryResponseSchema = z.object({
  data: ItemCategorySchema,
  message: z.string(),
});

export const DeleteCategoryResponseSchema = z.object({
  data: z.object({ id: z.string() }).nullable(),
  message: z.string(),
});

// --- Formulario ------------------------------------------------------------

export const CategoryFormSchema = z.object({
  name: z
    .string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(60, 'Máximo 60 caracteres'),
});
export type CategoryFormValues = z.infer<typeof CategoryFormSchema>;
