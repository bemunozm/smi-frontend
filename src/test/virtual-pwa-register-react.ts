/**
 * Stub de `virtual:pwa-register/react` para el entorno de tests.
 *
 * El módulo real lo genera `vite-plugin-pwa` en tiempo de build/dev (no
 * existe en disco); `vitest.config.ts` no carga ese plugin (tiene su propia
 * config, separada de `vite.config.ts`), así que sin este alias cualquier
 * import de esa ruta virtual rompería la resolución de módulos.
 *
 * `ReloadPrompt.test.tsx` reemplaza esto con `vi.mock` para controlar
 * `needRefresh`/`offlineReady` por test. Este stub es solo la red de
 * seguridad para cualquier otro test que monte `AppProviders` (que incluye
 * `<ReloadPrompt/>`) sin mockear el módulo explícitamente.
 */
export function useRegisterSW() {
  return {
    needRefresh: [false, () => {}] as [boolean, (value: boolean) => void],
    offlineReady: [false, () => {}] as [boolean, (value: boolean) => void],
    updateServiceWorker: async () => {},
  };
}
