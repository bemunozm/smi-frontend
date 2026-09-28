import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { UsersView } from './UsersView';

vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: { id: 'u1', name: 'Admin SMI', email: 'admin@smi.local', role: 'ADMIN' },
    role: 'ADMIN',
    isPending: false,
    isAuthenticated: true,
  }),
}));

// Se mockea la capa de API (no el hook) — mismo criterio que
// `EquiposView.interactions.test.tsx`: el `mutate` real de `useCreateUser`
// termina llamando a `UserAPI.create`, así que verificar sus argumentos
// prueba el flujo completo vista → hook → API.
const { listMock, createMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  createMock: vi.fn(),
}));

vi.mock('../api/UserAPI', () => ({
  UserAPI: {
    list: listMock,
    getById: vi.fn(),
    create: createMock,
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  listMock.mockResolvedValue([]);
});

function renderView() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <UsersView />
    </QueryClientProvider>,
  );
}

async function abrirModalCrear() {
  fireEvent.click(screen.getByRole('button', { name: 'Nuevo usuario' }));
  // El diálogo monta su contenido de forma asíncrona (mismo criterio que
  // `EquiposView.interactions.test.tsx#CreateEquipoModal`) — se espera el
  // primer campo antes de seguir interactuando.
  await screen.findByLabelText('Nombre');
}

function completarCamposObligatorios() {
  fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Nueva Persona' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'nueva@smi.local' } });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'Clave12345' } });
}

describe('UsersView — crear usuario, rol sin default', () => {
  it('el rol arranca sin valor: el trigger muestra el placeholder "Elegí un rol"', async () => {
    renderView();
    await abrirModalCrear();

    expect(screen.getByRole('button', { name: /Elegí un rol/ })).toBeTruthy();
  });

  it('las opciones de rol son ADMIN/SUPERVISOR/MANTENEDOR — "Operador" ya no existe', async () => {
    renderView();
    await abrirModalCrear();

    fireEvent.click(screen.getByRole('button', { name: /Elegí un rol/ }));

    expect(screen.getByRole('option', { name: 'Administrador' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Supervisor' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Mantenedor' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'Operador' })).toBeNull();
  });

  it('sin elegir un rol, el submit muestra el error y NO llama a UserAPI.create', async () => {
    renderView();
    await abrirModalCrear();
    completarCamposObligatorios();

    fireEvent.click(screen.getByRole('button', { name: 'Crear usuario' }));

    // Mensaje DISTINTO del placeholder a propósito (ver `types/user.ts`),
    // así que esta query no es ambigua con el trigger del `Select`.
    await screen.findByText('Elegí un rol para continuar');
    expect(createMock).not.toHaveBeenCalled();
  });

  it('al elegir un rol y completar el resto, el submit llama a UserAPI.create con ese rol', async () => {
    createMock.mockResolvedValue({
      id: 'u2',
      name: 'Nueva Persona',
      email: 'nueva@smi.local',
      emailVerified: false,
      image: null,
      role: 'MANTENEDOR',
      banned: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    renderView();
    await abrirModalCrear();
    completarCamposObligatorios();

    fireEvent.click(screen.getByRole('button', { name: /Elegí un rol/ }));
    fireEvent.click(screen.getByRole('option', { name: 'Mantenedor' }));

    fireEvent.click(screen.getByRole('button', { name: 'Crear usuario' }));

    await waitFor(() =>
      expect(createMock).toHaveBeenCalledWith({
        name: 'Nueva Persona',
        email: 'nueva@smi.local',
        password: 'Clave12345',
        role: 'MANTENEDOR',
      }),
    );
  });
});
