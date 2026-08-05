import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TrabajosExtraPage } from './TrabajosExtraPage';

describe('TrabajosExtraPage', () => {
  it('renderiza sin lanzar', () => {
    const qc = new QueryClient();
    const html = renderToString(
      createElement(QueryClientProvider, { client: qc }, createElement(TrabajosExtraPage)),
    );
    expect(html).toContain('Trabajos extraordinarios');
  });
});
