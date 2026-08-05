import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CombustiblePage } from './CombustiblePage';

// Smoke test: renderiza la página (fase de render) para verificar que la
// composición de componentes HeroUI v3 (React-Aria) es válida y no lanza.
describe('CombustiblePage', () => {
  it('renderiza sin lanzar', () => {
    const qc = new QueryClient();
    const html = renderToString(
      createElement(QueryClientProvider, { client: qc }, createElement(CombustiblePage)),
    );
    expect(html).toContain('Cargas de combustible');
  });
});
