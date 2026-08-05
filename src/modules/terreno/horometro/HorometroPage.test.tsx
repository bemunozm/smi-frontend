import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HorometroPage } from './HorometroPage';

describe('HorometroPage', () => {
  it('renderiza sin lanzar', () => {
    const qc = new QueryClient();
    const html = renderToString(
      createElement(QueryClientProvider, { client: qc }, createElement(HorometroPage)),
    );
    expect(html).toContain('Registro de horómetro por turno');
  });
});
