import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HallazgosPage } from './HallazgosPage';

describe('HallazgosPage', () => {
  it('renderiza sin lanzar', () => {
    const qc = new QueryClient();
    const html = renderToString(
      createElement(QueryClientProvider, { client: qc }, createElement(HallazgosPage)),
    );
    expect(html).toContain('Hallazgos');
  });
});
