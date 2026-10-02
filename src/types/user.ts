import { z } from 'zod';

import { ALL_ROLES, ROLES } from './roles';

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
 * Schema del FORM de creación (`UsersView#CreateUserModal`) — distinto de
 * `CreateUserSchema` (el payload real que espera el backend) en un solo
 * campo: `role` arranca vacío (`''`) a propósito, sin ningún default. Antes
 * el form partía en `ROLES.OPERADOR`; ese rol ya no existe, y más de fondo un
 * ADMIN nunca debería poder crear un usuario sin elegir su rol a propósito.
 *
 * El `.refine` valida "no vacío" con un mensaje propio — y, con TS 5.5+
 * (inferred type predicates), `value !== ''` alcanza para que TypeScript
 * angoste el tipo de SALIDA del schema a `Role` (sin `''`), aunque el de
 * ENTRADA (lo que el form realmente tiene mientras el usuario no eligió
 * nada) sigue siendo `Role | ''`. `CreateUserFormInput`/`CreateUserFormOutput`
 * exponen esos dos lados por separado — `UsersView.tsx` los pasa como 1er y
 * 3er genérico de `useForm` (`TFieldValues`/`TTransformedValues`) para que
 * `defaultValues` acepte `''` y `onSubmit` reciba directamente `role: Role`,
 * sin castear ni descartar `''` a mano.
 */
export const CreateUserFormSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  email: z.string().min(1, 'El email es obligatorio').email('Ingresa un email válido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  // Mensaje DISTINTO del placeholder del `Select` ("Elegí un rol", ver
  // `UsersView.tsx`) a propósito: ambos textos conviven en pantalla a la vez
  // cuando el error se muestra (el trigger sigue en placeholder porque nada
  // quedó seleccionado), y un texto repetido dos veces es ambiguo tanto para
  // quien lee con lector de pantalla como para los tests (`getByText`).
  role: z
    .enum([...ALL_ROLES, ''] as const)
    .refine((value) => value !== '', { message: 'Elegí un rol para continuar' }),
});

/** Lo que el form de creación tiene mientras se completa (`role` puede ser `''`). */
export type CreateUserFormInput = z.input<typeof CreateUserFormSchema>;
/** Lo que `onSubmit` recibe una vez validado (`role` ya es un `Role` real). */
export type CreateUserFormOutput = z.output<typeof CreateUserFormSchema>;

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
