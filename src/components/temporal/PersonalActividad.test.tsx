import { afterEach, describe, expect, it } from 'vitest';
import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { PersonalActividad, type LineaPersonal } from './PersonalActividad';
import { nuevaLinea } from '../../lib/informe-temporal';

function ConEstado({ inicial }: { inicial: LineaPersonal[] }) {
  const [lineas, setLineas] = useState(inicial);
  return <PersonalActividad actividad={1} lineas={lineas} onChange={setLineas} />;
}

afterEach(cleanup);

describe('PersonalActividad', () => {
  it('quitar una línea del medio no recicla la de abajo: cada línea conserva su propio campo', () => {
    render(
      <ConEstado
        inicial={[
          nuevaLinea({ modo: 'texto', operatorId: null, nombre: 'Ana' }),
          nuevaLinea({ modo: 'texto', operatorId: null, nombre: 'Luis' }),
        ]}
      />,
    );
    const campoLuis = screen.getByLabelText('Nombre de la persona 2 de la actividad 1') as HTMLInputElement;

    fireEvent.click(screen.getByRole('button', { name: 'Quitar persona 1 de la actividad 1' }));

    // Con `key={i}` React reutilizaba el campo de Ana para Luis y desmontaba el de Luis.
    expect(campoLuis.isConnected).toBe(true);
    expect(campoLuis.value).toBe('Luis');
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
  });

  it('cada línea agregada trae su propio id', () => {
    const a = nuevaLinea({ modo: 'texto', operatorId: null, nombre: '' });
    const b = nuevaLinea({ modo: 'texto', operatorId: null, nombre: '' });
    expect(a.id).not.toBe(b.id);
  });
});
