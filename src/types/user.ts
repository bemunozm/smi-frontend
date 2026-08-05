import { z } from 'zod';

import { ROLES } from './roles';

/**
 * Shape real de `User` devuelto por `smi-backend` (`GET /api/users`,
 * `GET /api/users/:id`) — verificado con curl contra el endpoint real.
 * `role` reusa `ROLES` (fuente única) en vez de repetir los 4 strings.
 */
export const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  emailVerified: z.boolean(),
  image: z.string().nullable(),
  role: z.enum(ROLES),
  banned: z.boolean().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type User = z.infer<typeof UserSchema>;

/** Envoltura `{ data, message }` que devuelve el backend en toda respuesta. */
export const UserListResponseSchema = z.object({
  data: z.array(UserSchema),
  message: z.string(),
});

export const UserResponseSchema = z.object({
  data: UserSchema,
  message: z.string(),
});

/** `DELETE /api/users/:id` → `{ data: { id } | null, message }`. */
export const DeleteUserResponseSchema = z.object({
  data: z.object({ id: z.string() }).nullable(),
  message: z.string(),
});

/** `POST /api/users` body — crear usuario (solo ADMIN). */
export const CreateUserSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  email: z.string().min(1, 'El email es obligatorio').email('Ingresa un email válido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  role: z.enum(ROLES),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;

/**
 * `PATCH /api/users/:id` body — el backend acepta `{name?,email?,role?}`
 * parcial, pero el form de edición siempre reenvía el set completo (name,
 * email, role) porque es más simple y predecible que calcular un diff.
 */
export const UpdateUserSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  email: z.string().min(1, 'El email es obligatorio').email('Ingresa un email válido'),
  role: z.enum(ROLES),
});

export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
