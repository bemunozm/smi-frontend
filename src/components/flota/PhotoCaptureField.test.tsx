import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { PhotoCaptureField } from './PhotoCaptureField';

afterEach(cleanup);

describe('PhotoCaptureField', () => {
  it('el recuadro abre la cámara y «Elegir de la galería» abre las fotos del equipo', () => {
    const onSelect = vi.fn();
    const { container } = render(<PhotoCaptureField file={null} onClear={() => {}} onSelect={onSelect} title="Foto del surtidor" />);

    const [camara, galeria] = Array.from(container.querySelectorAll('input[type="file"]'));
    expect(camara?.getAttribute('capture')).toBe('environment');
    // Sin `capture`: el sistema ofrece la galería.
    expect(galeria?.hasAttribute('capture')).toBe(false);

    const click = vi.spyOn(galeria as HTMLInputElement, 'click');
    fireEvent.click(screen.getByRole('button', { name: /Elegir de la galería/ }));
    expect(click).toHaveBeenCalled();

    const foto = new File(['x'], 'surtidor.jpg', { type: 'image/jpeg' });
    fireEvent.change(galeria as HTMLInputElement, { target: { files: [foto] } });
    expect(onSelect).toHaveBeenCalledWith(foto);
  });
});
