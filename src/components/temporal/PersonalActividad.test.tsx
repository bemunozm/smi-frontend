import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';

import { PersonalActividad, type LineaPersonal } from './PersonalActividad';
import { nuevaLinea } from '../../lib/informe-temporal';

vi.mock('../../hooks/useOperators', () => ({
  useOperators: () => ({ data: [{ id: 'op_1', name: 'Juan Rojas' }], isPending: false }),
}));
vi.mock('../../hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ user: { id: 'tmp_1' } }) }));

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

  it('elegir un operador del catálogo con el selector del kit llena operatorId y nombre', () => {
    const onChange = vi.fn();
    render(
      <PersonalActividad
        actividad={1}
        lineas={[{ ...nuevaLinea({ modo: 'catalogo', operatorId: null, nombre: '' }) }]}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByLabelText('Persona 1'));
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Juan Rojas' }));

    const [lineas] = onChange.mock.calls[0] as [LineaPersonal[]];
    expect(lineas[0]).toMatchObject({ modo: 'catalogo', operatorId: 'op_1', nombre: 'Juan Rojas' });
  });

  it('cada línea agregada trae su propio id', () => {
    const a = nuevaLinea({ modo: 'texto', operatorId: null, nombre: '' });
    const b = nuevaLinea({ modo: 'texto', operatorId: null, nombre: '' });
    expect(a.id).not.toBe(b.id);
  });
});
