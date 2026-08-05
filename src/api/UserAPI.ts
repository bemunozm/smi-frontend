import { axiosInstance } from '../lib/axios';
import { toDomainError } from '../lib/api-error';
import {
  DeleteUserResponseSchema,
  UserListResponseSchema,
  UserResponseSchema,
  type CreateUserInput,
  type UpdateUserInput,
  type User,
} from '../types/user';

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
