import { create } from 'zustand';

/**
 * Store de UI transversal — SOLO estado de interfaz (sidebar, sucursal elegida,
 * filtros). La sesión de auth NUNCA vive acá: esa es responsabilidad exclusiva
 * de `useSession()` (Better Auth), ver `hooks/useCurrentUser.ts`.
 */
interface UiState {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;

  /**
   * Sucursal sobre la que trabaja el usuario. Vive en el store y no en cada
   * pantalla porque **T12** la va a subir al layout de la PWA para que persista
   * entre vistas; cuando eso pase, el selector se mueve y las pantallas que ya
   * leen de acá no se tocan.
   *
   * `null` hasta que llega la lista de sucursales y se elige la primera.
   */
  selectedBranchId: string | null;
  setSelectedBranchId: (branchId: string) => void;
}

export const useUiStore = create<UiState>((set) => ({
  isSidebarOpen: true,
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setSidebarOpen: (open) => set({ isSidebarOpen: open }),

  selectedBranchId: null,
  setSelectedBranchId: (branchId) => set({ selectedBranchId: branchId }),
}));
