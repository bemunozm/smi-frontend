import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { MantencionLivianoModal } from './MantencionLivianoModal';
import { problemaLiviano } from '../../lib/mantencion-liviano';
import type { LightConfigView } from '../../types/vencimientos';

const mutate = vi.fn();

const VISTA: LightConfigView = {
  equipment: {
    id: 'eq_1',
    internalCode: 'CN-007',
    licensePlate: 'ABCD-12',
    brand: 'Toyota',
    model: 'Hilux',
    mileage: 15000,
  },
  intervalKm: 10000,
  config: {
    serviceAlertKm: 1000,
    technicalInspectionAlertDays: 30,
    circulationPermitAlertDays: 30,
    insuranceAlertDays: 30,
  },
  service: { source: 'LIVIANO', unit: 'km', nextAt: 20000, remaining: 5000, due: false },
  documents: [
    {
      type: 'TECHNICAL_INSPECTION',
      label: 'Revisión técnica',
      expiryDate: '2026-11-08',
      daysToExpiry: 17,
      status: 'POR_VENCER',
    },
    { type: 'CIRCULATION_PERMIT', label: 'Permiso de circulación', expiryDate: null, daysToExpiry: null, status: null },
    { type: 'INSURANCE', label: 'Seguro', expiryDate: '2026-10-17', daysToExpiry: -5, status: 'VENCIDO' },
  ],
};

let esAdmin = true;
vi.mock('../../hooks/usePermissions', () => ({ usePermissions: () => ({ can: () => esAdmin }) }));
vi.mock('../../hooks/useEquipmentDocuments', () => ({
  useEquipmentDocuments: () => ({
    data: [
      { id: 'doc_rt', type: 'TECHNICAL_INSPECTION', expiryDate: '2026-11-08T00:00:00.000Z' },
      { id: 'doc_seg', type: 'INSURANCE', expiryDate: '2026-10-17T00:00:00.000Z' },
    ],
  }),
}));
// El formulario de documentos de la ficha: acá solo importa con qué se abre.
vi.mock('../flota/EquipmentDocumentModal', () => ({
  EquipmentDocumentModal: (p: { isOpen: boolean; tipoInicial?: string; document: { id: string } | null }) =>
    p.isOpen ? <div data-testid="form-papel">{`${p.tipoInicial} · ${p.document?.id ?? 'nuevo'}`}</div> : null,
}));

vi.mock('../../hooks/useVencimientos', () => ({
  useLightConfig: () => ({ data: VISTA, isLoading: false, isError: false, error: null }),
  useSaveLightConfig: () => ({ mutate, isPending: false }),
}));

// Fecha estimada por uso: CN-007 llegaría a los 20.000 km el lun 16-11.
vi.mock('../../hooks/useMaintenancePlans', () => ({
  useMaintenanceForecastByEquipment: () => ({
    data: new Map([
      [
        'eq_1',
        {
          equipmentId: 'eq_1',
          unit: 'km',
          source: 'LIVIANO',
          nextAt: 20000,
          remaining: 5000,
          status: 'ESTIMADA',
          dailyUsage: 220,
          basedOnDays: 28,
          estimatedDate: '2026-11-16',
          weekStart: '2026-11-10',
          suggestedDate: '2026-11-15',
        },
      ],
    ]),
  }),
}));

const EQUIPO = { id: 'eq_1', internalCode: 'CN-007', brand: 'Toyota', model: 'Hilux' };

afterEach(() => {
  cleanup();
  mutate.mockClear();
  esAdmin = true;
});

describe('MantencionLivianoModal («Asignar mantenciones» de un liviano)', () => {
  it('muestra la mantención cada 10.000 km y el estado de cada papel', () => {
    render(<MantencionLivianoModal equipo={EQUIPO} isOpen onOpenChange={() => {}} soloLectura={false} />);
    expect(screen.getByText('Cada 10.000 km')).toBeTruthy();
    expect(screen.getByText(/faltan 5\.000 km/)).toBeTruthy();
    expect(screen.getByText('Vence el 08-11-2026 · en 17 días')).toBeTruthy();
    expect(screen.getByText('Venció el 17-10-2026')).toBeTruthy();
    expect(screen.getByText('Sin papel cargado')).toBeTruthy();
  });

  it('guarda los km y los días de cada papel', () => {
    render(<MantencionLivianoModal equipo={EQUIPO} isOpen onOpenChange={() => {}} soloLectura={false} />);
    fireEvent.change(screen.getByLabelText('Avisar antes (km)'), { target: { value: '1500' } });
    fireEvent.change(screen.getByLabelText('Avisar (días antes)', { selector: '#aviso-INSURANCE' }), {
      target: { value: '45' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(mutate).toHaveBeenCalledWith(
      {
        equipmentId: 'eq_1',
        config: {
          serviceAlertKm: 1500,
          technicalInspectionAlertDays: 30,
          circulationPermitAlertDays: 30,
          insuranceAlertDays: 45,
        },
      },
      expect.anything(),
    );
  });

  it('el administrador carga el papel que falta y edita los que ya están', () => {
    render(<MantencionLivianoModal equipo={EQUIPO} isOpen onOpenChange={() => {}} soloLectura={false} />);
    // Permiso de circulación no está cargado; revisión técnica y seguro, sí.
    expect(screen.getAllByRole('button', { name: /Editar/ })).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: /Cargar/ }));
    expect(screen.getByTestId('form-papel').textContent).toBe('CIRCULATION_PERMIT · nuevo');
  });

  it('editar abre el papel vigente de ese tipo', () => {
    render(<MantencionLivianoModal equipo={EQUIPO} isOpen onOpenChange={() => {}} soloLectura={false} />);
    fireEvent.click(screen.getAllByRole('button', { name: /Editar/ })[1]);
    expect(screen.getByTestId('form-papel').textContent).toBe('INSURANCE · doc_seg');
  });

  it('el mantenedor ve los papeles, pero no los carga (los carga el administrador)', () => {
    esAdmin = false;
    render(<MantencionLivianoModal equipo={EQUIPO} isOpen onOpenChange={() => {}} soloLectura={false} />);
    expect(screen.queryByRole('button', { name: /Cargar|Editar/ })).toBeNull();
  });

  it('en solo lectura no deja guardar', () => {
    render(<MantencionLivianoModal equipo={EQUIPO} isOpen onOpenChange={() => {}} soloLectura />);
    expect(screen.queryByRole('button', { name: 'Guardar' })).toBeNull();
  });
});

describe('problemaLiviano', () => {
  const ok = {
    serviceAlertKm: '1000',
    technicalInspectionAlertDays: '30',
    circulationPermitAlertDays: '30',
    insuranceAlertDays: '30',
  };
  it('acepta valores dentro de rango', () => {
    expect(problemaLiviano(ok)).toBeNull();
  });
  it('el aviso en km tiene que ser menor que los 10.000', () => {
    expect(problemaLiviano({ ...ok, serviceAlertKm: '10000' })).toMatch(/9\.999/);
  });
  it('los días van de 1 a 365', () => {
    expect(problemaLiviano({ ...ok, insuranceAlertDays: '0' })).toMatch(/1 y 365/);
    expect(problemaLiviano({ ...ok, insuranceAlertDays: '' })).toMatch(/1 y 365/);
  });
});
