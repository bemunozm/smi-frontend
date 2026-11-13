import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { FotoRespaldoField } from './FotoRespaldoField';

afterEach(cleanup);

const foto = new File(['x'], 'papel.jpg', { type: 'image/jpeg' });

function renderField(extra: Partial<Parameters<typeof FotoRespaldoField>[0]> = {}) {
  render(
    <FotoRespaldoField
      file={foto}
      isReadingPhoto={false}
      captureDate={null}
      onSelect={() => {}}
      onClear={() => {}}
      title="Foto del combustible"
      subtitle="Del surtidor o del papel"
      staleQuestion="¿es la de esa carga?"
      {...extra}
    />,
  );
}

describe('FotoRespaldoField', () => {
  it('una foto sin fecha se acepta igual y el aviso lo dice (antes se leía como rechazo)', () => {
    renderField();
    expect(screen.getByText(/no trae su fecha/).textContent).toMatch(/se acepta igual/);
  });

  it('solo pide revisar la fecha del registro cuando el formulario tiene ese campo', () => {
    renderField({ fechaEditable: true });
    expect(screen.getByText(/no trae su fecha/).textContent).toMatch(/Revisa que la fecha del registro/);
  });

  it('en un flujo del día (sin campo de fecha) no manda a buscar un campo que no existe', () => {
    renderField();
    expect(screen.getByText(/no trae su fecha/).textContent).not.toMatch(/Revisa que la fecha/);
  });

  it('en un registro anterior no avisa nada de la fecha de la foto', () => {
    renderField({ registroAnterior: true });
    expect(screen.queryByText(/no trae su fecha/)).toBeNull();
  });

  it('en un registro anterior tampoco marca la foto como vieja', () => {
    renderField({ registroAnterior: true, captureDate: new Date(2026, 0, 1) });
    expect(screen.queryByText(/Foto tomada/)).toBeNull();
  });
});
