import { z } from 'zod';

/**
 * Contrato de las categorías del catálogo (`/api/inventory/categories`).
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
