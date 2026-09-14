import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // `vite-plugin-pwa` genera este módulo virtual en dev/build; acá (config
      // de Vitest separada de `vite.config.ts`, sin el plugin) lo resolvemos a
      // un stub para que ningún test rompa por resolución de módulos. Ver
      // `src/test/virtual-pwa-register-react.ts` y `ReloadPrompt.test.tsx`
      // (que lo reemplaza con `vi.mock` para controlar el estado por test).
      'virtual:pwa-register/react': fileURLToPath(
        new URL('./src/test/virtual-pwa-register-react.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
