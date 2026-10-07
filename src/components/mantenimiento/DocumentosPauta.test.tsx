import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { DocumentosPauta } from './DocumentosPauta';
import { EQUIPMENT_DOCUMENTS_KEY } from '../../lib/query-keys';
import type { Role } from '../../types/roles';
import type { EquipmentDocument } from '../../types/equipment-document';

let rolActual: Role = 'ADMIN';

vi.mock('../../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { id: 'u1', role: rolActual }, role: rolActual, isPending: false, isAuthenticated: true }),
}));

afterEach(cleanup);

const doc = (id: string, type: EquipmentDocument['type'], title: string): EquipmentDocument => ({
  id,
  equipmentId: 'e1',
  type,
  title,
  expiryDate: null,
  fileUrl: 'https://signed.example/x',
  fileName: `${title}.pdf`,
  notes: null,
  createdAt: '2026-10-06T12:00:00.000Z',
  updatedAt: '2026-10-06T12:00:00.000Z',
  status: 'SIN_DATO',
  daysToExpiry: null,
});

function renderComo(rol: Role) {
  rolActual = rol;
  const qc = new QueryClient();
  qc.setQueryData(
    [...EQUIPMENT_DOCUMENTS_KEY, 'e1'],
    [doc('d1', 'MAINTENANCE_MANUAL', 'Pauta SANY SY215C'), doc('d2', 'INSURANCE', 'Póliza de seguro')],
  );
  return render(
    <QueryClientProvider client={qc}>
      <DocumentosPauta equipmentId="e1" internalCode="BD-005" />
    </QueryClientProvider>,
  );
}

describe('DocumentosPauta', () => {
  it('lista solo los documentos de la pauta, con su enlace para abrir o descargar', () => {
    renderComo('ADMIN');

    expect(screen.getByText('Pauta SANY SY215C')).toBeTruthy();
    // Los demás documentos del equipo (seguro, revisión técnica) no van acá.
    expect(screen.queryByText('Póliza de seguro')).toBeNull();
    const enlace = screen.getByRole('link', { name: /Ver \/ descargar/ });
    expect(enlace.getAttribute('href')).toContain('/api/equipment/documents/d1/file');
    expect(screen.getByRole('button', { name: /Adjuntar documento/ })).toBeTruthy();
  });

  /** El mantenedor es quien lo consulta: abre y descarga, pero no adjunta ni quita. */
  it('el mantenedor puede abrirlo pero no adjuntar ni quitar', () => {
    renderComo('MANTENEDOR');

    expect(screen.getByRole('link', { name: /Ver \/ descargar/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Adjuntar documento/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Quitar/ })).toBeNull();
  });
});
