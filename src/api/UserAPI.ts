import axios from 'axios';
import { ZodError } from 'zod';

import { axiosInstance } from '../lib/axios';
import {
  DeleteUserResponseSchema,
  UserListResponseSchema,
  UserResponseSchema,
  type CreateUserInput,
  type UpdateUserInput,
  type User,
} from '../types/user';

/**
 * Extrae `message` del body `{ data, message }` que el backend devuelve
 * incluso en 4xx/5xx (ver contrato en `types/user.ts`). `data` llega como
 * `unknown` a propósito — es la barrera que evita que el `any` implícito de
 * `AxiosError.response.data` se filtre al resto del código.
 */
function extractBackendMessage(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null || !('message' in data)) {
    return undefined;
  }
  const raw = (data as { message?: unknown }).message;
  return typeof raw === 'string' && raw.trim().length > 0 ? raw : undefined;
}

/**
 * Normaliza cualquier error capturado en las funciones de `UserAPI` a un
 * `Error` con mensaje claro, distinguiendo el origen:
 * - `ZodError`: el backend respondió pero el shape no calza con nuestro
 *   contrato (`types/user.ts`) — bug de contrato, no de red.
 * - Error de axios: prioriza el `message` descriptivo del backend
 *   (`error.response.data.message`, p. ej. "User already exists"). Si no
 *   vino ninguno (caída de red, 500 sin body, etc.) usa `fallbackMessage`
 *   — NUNCA el `error.message` técnico de axios ("Request failed with
 *   status code 500", "Network Error"), que no le sirve a quien lo lee.
 * - Cualquier otro `unknown`: fallback genérico.
 *
 * Esta función es la ÚNICA fuente de verdad del mensaje de error para
 * `UserAPI` — `lib/axios.ts` ya no reescribe `error.message` (ver su
 * comentario) precisamente para no duplicar esta lógica en dos lugares.
 */
function toDomainError(error: unknown, fallbackMessage: string): Error {
  if (error instanceof ZodError) {
    const firstIssue = error.issues[0]?.message ?? 'formato inesperado';
    return new Error(`Respuesta de /users inválida: ${firstIssue}`);
  }
  if (axios.isAxiosError(error)) {
    const backendMessage = extractBackendMessage(error.response?.data);
    return new Error(backendMessage ?? fallbackMessage);
  }
  if (error instanceof Error) {
    return new Error(error.message);
  }
  return new Error(fallbackMessage);
}

/**
 * Módulo de dominio de referencia para el resto del equipo: instancia axios
 * (`lib/axios.ts`) + try/catch + validación Zod de la respuesta completa
 * (`types/user.ts`) + retorno del `.data` ya tipado. Estas funciones son las
 * `queryFn` de TanStack Query (ver `hooks/useUsers.ts`).
 */
async function list(): Promise<User[]> {
  try {
    const response = await axiosInstance.get('/api/users');
    return UserListResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo obtener la lista de usuarios.');
  }
}

async function getById(id: string): Promise<User> {
  try {
    const response = await axiosInstance.get(`/api/users/${id}`);
    return UserResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, `No se pudo obtener el usuario "${id}".`);
  }
}

async function create(input: CreateUserInput): Promise<User> {
  try {
    const response = await axiosInstance.post('/api/users', input);
    return UserResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo crear el usuario.');
  }
}

async function update(id: string, input: UpdateUserInput): Promise<User> {
  try {
    const response = await axiosInstance.patch(`/api/users/${id}`, input);
    return UserResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, `No se pudo actualizar el usuario "${id}".`);
  }
}

async function remove(id: string): Promise<void> {
  try {
    const response = await axiosInstance.delete(`/api/users/${id}`);
    DeleteUserResponseSchema.parse(response.data);
  } catch (error: unknown) {
    throw toDomainError(error, `No se pudo eliminar el usuario "${id}".`);
  }
}

export const UserAPI = {
  list,
  getById,
  create,
  update,
  remove,
};
