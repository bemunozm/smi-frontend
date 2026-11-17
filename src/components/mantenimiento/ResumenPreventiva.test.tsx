import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import type { MaintenanceBoardRow } from '../../types/maintenance-board';
import { ResumenPreventiva } from './ResumenPreventiva';

afterEach(() => {
  cleanup();
});

const FILA: MaintenanceBoardRow = {
  equipmentId: 'eq-1',
  internalCode: 'SEM 05',
  type: 'Cargador',
  brand: 'SEM',
  model: '656F',
  equipmentClass: 'HEAVY',
  unit: 'h',
  status: 'OPERATIONAL',
  counter: 2700.7,
  source: 'PAUTA',
  milestones: [250, 500],
  initialMilestone: null,
  lastChange: null,
  interval: 250,
  nextMilestone: 500,
  dueAt: 2750,
  remaining: 49.3,
  alertBefore: 50,
  estimated: true,
  items: [],
};

describe('ResumenPreventiva', () => {
  it('con pauta: horómetro actual, horas pendientes y fecha estimada', () => {
    render(
      <ResumenPreventiva
        fila={FILA}
        pronostico={{
          equipmentId: 'eq-1',
          unit: 'h',
          source: 'PAUTA',
          nextAt: 2750,
          remaining: 49.3,
          status: 'ESTIMADA',
          dailyUsage: 10,
          basedOnDays: 14,
          estimatedDate: '2026-11-18',
          weekStart: '2026-11-16',
          suggestedDate: null,
        }}
      />,
    );
    expect(screen.getByText('2.700,7 h')).toBeTruthy();
    expect(screen.getByText('49,3 h')).toBeTruthy();
    expect(screen.getByText('mié 18-11')).toBeTruthy();
  });

  it('atrasada: lo dice en las horas pendientes y la fecha queda «Vencida»', () => {
    render(<ResumenPreventiva fila={{ ...FILA, remaining: -12 }} />);
    expect(screen.getByText('Atrasada +12 h')).toBeTruthy();
    expect(screen.getByText('Vencida')).toBeTruthy();
  });

  it('sin pauta: igual muestra el horómetro actual', () => {
    render(<ResumenPreventiva fila={{ ...FILA, source: 'SIN_PAUTA', remaining: null, counter: 5029 }} />);
    expect(screen.getByText('5.029 h')).toBeTruthy();
    expect(screen.getByText('Sin pauta')).toBeTruthy();
  });
});
