import { create } from 'zustand';

/**
 * Store de UI transversal — SOLO estado de interfaz (sidebar, filtros, etc).
 * La sesión de auth NUNCA vive acá: esa es responsabilidad exclusiva de
 * `useSession()` (Better Auth), ver `hooks/useCurrentUser.ts`.
 */
interface UiState {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  isSidebarOpen: true,
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setSidebarOpen: (open) => set({ isSidebarOpen: open }),
}));
