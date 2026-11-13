import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { RecordPhoto } from './RecordPhoto';

afterEach(cleanup);

describe('RecordPhoto', () => {
  it('muestra la foto como link para abrirla completa, con su leyenda', () => {
    render(
      <RecordPhoto alt="Foto de la carga" caption="Toca la foto para verla completa." src="https://x/firmada.jpg" />,
    );
    const link = screen.getByRole('link', { name: 'Foto de la carga' });
    expect(link.getAttribute('href')).toBe('https://x/firmada.jpg');
    expect(screen.getByText('Toca la foto para verla completa.')).toBeTruthy();
  });

  it('si la imagen no carga (URL firmada vencida), avisa en vez de dejar un link roto', () => {
    render(<RecordPhoto alt="Foto de la carga" src="https://x/vencida.jpg" />);
    fireEvent.error(screen.getByAltText('Foto de la carga'));
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText(/No se pudo cargar la foto/)).toBeTruthy();
  });
});
