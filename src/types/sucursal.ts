import { z } from 'zod';

/**
 * Contrato del dominio Sucursales (`/api/sucursales`) — RFC-11.
 *
 * Una sucursal es una bodega física. El sistema garantiza que siempre hay
 * exactamente una `esPrincipal`: es la que recibe los movimientos que no
 * indican bodega, y la que la UI preselecciona.
 */
export const SucursalSchema = z.object({
  id: z.string(),
  codigo: z.string(),
  nombre: z.string(),
  direccion: z.string().nullable(),
  activa: z.boolean(),
  esPrincipal: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Sucursal = z.infer<typeof SucursalSchema>;

// --- Envolturas `{ data, message }` ---------------------------------------

export const SucursalListResponseSchema = z.object({
  data: z.array(SucursalSchema),
  message: z.string(),
});

export const SucursalResponseSchema = z.object({
  data: SucursalSchema,
  message: z.string(),
});

export const DeleteSucursalResponseSchema = z.object({
  data: z.object({ id: z.string() }).nullable(),
  message: z.string(),
});

// --- Formularios (RHF + zodResolver) --------------------------------------

export const SucursalFormSchema = z.object({
  codigo: z
    .string()
    .min(1, 'El código es obligatorio')
    .max(20, 'Máximo 20 caracteres'),
  nombre: z.string().min(1, 'El nombre es obligatorio').max(80),
  direccion: z.string().max(160).or(z.literal('')),
});
export type SucursalFormValues = z.infer<typeof SucursalFormSchema>;

export interface CreateSucursalInput {
  codigo: string;
  nombre: string;
  direccion?: string;
}

export function toSucursalPayload(
  values: SucursalFormValues,
): CreateSucursalInput {
  return {
    codigo: values.codigo.trim().toUpperCase(),
    nombre: values.nombre.trim(),
    // Se omite en vez de mandar `''`: el backend corre con
    // `forbidNonWhitelisted` y un string vacío solo dejaría basura en la base.
    ...(values.direccion.trim() ? { direccion: values.direccion.trim() } : {}),
  };
}

/**
 * Bodega que la pantalla debe mostrar por defecto. La principal viene primero
 * desde el backend, pero se busca explícitamente en vez de tomar `[0]`: si
 * alguien cambia el `orderBy`, el selector no debe empezar a apuntar a otra
 * bodega en silencio.
 */
export function sucursalPorDefecto(
  sucursales: readonly Sucursal[],
): Sucursal | undefined {
  return sucursales.find((sucursal) => sucursal.esPrincipal) ?? sucursales[0];
}
