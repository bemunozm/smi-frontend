import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@heroui/react';

import { UserAPI } from '../api/UserAPI';
import type { CreateUserInput, UpdateUserInput } from '../types/user';

const USERS_QUERY_KEY = ['users'] as const;

export function useUsers() {
  return useQuery({
    queryKey: USERS_QUERY_KEY,
    queryFn: UserAPI.list,
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: ['users', id],
    queryFn: () => UserAPI.getById(id),
    enabled: !!id,
  });
}

/**
 * Patrón "crear/editar/eliminar → useMutation + invalidar + feedback": las
 * tres mutaciones de abajo son la plantilla de referencia para el resto del
 * equipo. El feedback (toast de éxito/error) vive ACÁ, centralizado en el
 * hook — no en la vista. Las vistas solo llaman `mutate(payload, { onSuccess
 * })` para su propia UI (cerrar modal, `reset()` del form); ambos
 * `onSuccess` (el de acá y el del call-site) se ejecutan, es el
 * comportamiento esperado de TanStack Query.
 *
 * `onError` siempre muestra `error.message` — `UserAPI` ya lanza un `Error`
 * con el mensaje correcto priorizado (backend > fallback amigable, nunca el
 * texto técnico de axios; ver `api/UserAPI.ts#toDomainError`), así que acá
 * no hay que volver a decidir qué mensaje mostrar.
 */
export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateUserInput) => UserAPI.create(input),
    onSuccess: (user) => {
      void queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
      toast.success('Usuario creado', { description: `${user.name} ya puede iniciar sesión.` });
    },
    onError: (error: unknown) => {
      toast.danger(error instanceof Error ? error.message : 'No se pudo crear el usuario.');
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateUserInput }) =>
      UserAPI.update(id, input),
    onSuccess: (user) => {
      void queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
      toast.success('Usuario actualizado', { description: user.name });
    },
    onError: (error: unknown) => {
      toast.danger(error instanceof Error ? error.message : 'No se pudo actualizar el usuario.');
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => UserAPI.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
      toast.success('Usuario eliminado');
    },
    onError: (error: unknown) => {
      toast.danger(error instanceof Error ? error.message : 'No se pudo eliminar el usuario.');
    },
  });
}
