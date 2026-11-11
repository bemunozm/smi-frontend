import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

const { enqueueClosedCardMock } = vi.hoisted(() => ({ enqueueClosedCardMock: vi.fn() }));
vi.mock('../../offline/outbox', () => ({ enqueueClosedCard: enqueueClosedCardMock }));
vi.mock('../../lib/outbox-feedback', () => ({ avisarGuardadoEnCola: vi.fn() }));
vi.mock('../../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { id: 'u1' }, role: null, isOfflineSnapshot: false }),
}));

import { PastShiftQuickEntry } from './PastShiftQuickEntry';
import { contextoDeTurno } from '../../lib/turno';
import type { Equipment } from '../../types/equipment';
import type { Operator } from '../../types/operator';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const CTX = contextoDeTurno('DIURNO', new Date(2026, 9, 20));
const EQUIPOS = [
  { id: 'e1', internalCode: 'EX-005', type: 'Excavadora', status: 'OPERATIONAL' },
  { id: 'e2', internalCode: 'PE-009', type: 'Perforadora', status: 'IN_WORKSHOP' },
] as Equipment[];
const OPERADORES = [
  { id: 'op_1', name: 'Patricio Rojas', rut: null, isActive: true, createdAt: '', updatedAt: '' },
] as Operator[];

function renderEntry(props: { esDiaPasado?: boolean; checklists?: Map<string, string> } = {}) {
  render(
    <PastShiftQuickEntry
      ctx={CTX}
      disponibles={EQUIPOS}
      operadores={OPERADORES}
      checklistSinAceptar={props.checklists ?? new Map()}
      esDiaPasado={props.esDiaPasado ?? false}
    />,
  );
}

describe('PastShiftQuickEntry', () => {
  it('apaga el equipo con el checklist sin aceptar y muestra el motivo', () => {
    renderEntry({ checklists: new Map([['e1', 'Checklist por validar (Checklists)']]) });

    fireEvent.click(screen.getByLabelText('Equipo de la fila 1'));

    const ex = screen.getByRole('option', { name: /EX-005/ });
    expect(ex.getAttribute('aria-disabled')).toBe('true');
    expect(ex.textContent).toContain('Checklist por validar');
    expect(screen.getByRole('option', { name: /PE-009/ }).getAttribute('aria-disabled')).not.toBe('true');
  });

  it('avisa "No operativo hoy" solo si el día es pasado', () => {
    renderEntry({ esDiaPasado: true });
    fireEvent.click(screen.getByLabelText('Equipo de la fila 1'));
    expect(screen.getByRole('option', { name: /PE-009/ }).textContent).toContain('No operativo hoy');
    expect(screen.getByRole('option', { name: /EX-005/ }).textContent).not.toContain('No operativo hoy');
  });

  it('sin día pasado no avisa "No operativo hoy"', () => {
    renderEntry({ esDiaPasado: false });
    fireEvent.click(screen.getByLabelText('Equipo de la fila 1'));
    expect(screen.getByRole('option', { name: /PE-009/ }).textContent).not.toContain('No operativo hoy');
  });

  it('mientras guarda, bloquea los campos, la foto y las acciones de fila', async () => {
    let liberar!: () => void;
    enqueueClosedCardMock.mockImplementationOnce(
      () => new Promise<void>((resolve) => (liberar = resolve)),
    );
    renderEntry();

    fireEvent.click(screen.getByLabelText('Equipo de la fila 1'));
    fireEvent.click(screen.getByRole('option', { name: /EX-005/ }));
    fireEvent.click(screen.getByLabelText('Operador de la fila 1'));
    fireEvent.click(screen.getByRole('option', { name: /Patricio Rojas/ }));
    fireEvent.change(screen.getByLabelText('Horómetro inicial de la fila 1'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('Horómetro final de la fila 1'), { target: { value: '110' } });
    const foto = new File([new Uint8Array([1])], 'f.jpg', { type: 'image/jpeg' });
    const inputsArchivo = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="file"]'));
    await act(async () => {
      fireEvent.change(inputsArchivo[0]!, { target: { files: [foto] } });
    });

    const guardar = screen.getByRole('button', { name: /Guardar tarjetas del turno/ });
    await vi.waitFor(() => expect(guardar.hasAttribute('disabled')).toBe(false));
    fireEvent.click(guardar);

    await vi.waitFor(() => expect(screen.getByRole('button', { name: /Guardando/ })).toBeTruthy());
    expect(screen.getByLabelText('Horómetro inicial de la fila 1').hasAttribute('disabled')).toBe(true);
    expect(screen.getByLabelText('Horómetro final de la fila 1').hasAttribute('disabled')).toBe(true);
    expect(screen.getByLabelText('Litros de la fila 1').hasAttribute('disabled')).toBe(true);
    expect(screen.getByLabelText('Equipo de la fila 1').hasAttribute('disabled')).toBe(true);
    expect(screen.getByLabelText('Operador de la fila 1').hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Quitar fila 1' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: /Agregar fila/ }).hasAttribute('disabled')).toBe(true);
    const botonesFoto = screen
      .getAllByRole('button')
      .filter((b) => /galería|cámara|foto/i.test(b.textContent ?? b.getAttribute('aria-label') ?? ''));
    expect(botonesFoto.length).toBeGreaterThan(0);
    for (const b of botonesFoto) expect(b.hasAttribute('disabled')).toBe(true);

    await act(async () => {
      liberar();
    });
  });
});
