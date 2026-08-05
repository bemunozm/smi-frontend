import { create } from 'zustand';

export type Rol = 'ADMIN' | 'SUPERVISOR' | 'MANTENEDOR' | 'OPERADOR';

interface AuthState {
  rol: Rol;
  setRol: (rol: Rol) => void;
}

// PROVISIONAL — reemplazar por useSession() de Better Auth (Sprint 0).
export const useAuthStore = create<AuthState>((set) => ({
  rol: 'ADMIN',
  setRol: (rol) => set({ rol }),
}));
