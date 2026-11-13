import { Table } from '@heroui/react';

import { controlUnitSuffix, turnoLabel } from '../../config/flota-colors';
import { DESKTOP_QUERY, useMediaQuery } from '../../hooks/useMediaQuery';
import { fmtDuracion, fmtFechaHora } from '../../lib/format';
import type { EquipmentDetail } from '../../types/equipment';
import type { RegistroHorometro } from '../../types/horometro';

const NUMERO = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 });

/** Historial de horómetro / kilometraje: tarjetas bajo `lg`, tabla en escritorio. */
export function UsageHistoryList({ equipo, registros }: { equipo: EquipmentDetail; registros: RegistroHorometro[] }) {
  const esEscritorio = useMediaQuery(DESKTOP_QUERY);
  const esLiviano = equipo.equipmentClass === 'LIGHT';

  if (registros.length === 0) {
    return (
      <p className="text-sm text-(--muted)">
        {esLiviano
          ? 'Esta unidad todavía no tiene registros de kilometraje.'
          : 'Esta unidad todavía no tiene lecturas de horómetro registradas.'}
      </p>
    );
  }

  if (!esEscritorio) {
    return (
      <ul
        aria-label={esLiviano ? 'Historial de kilometraje' : 'Historial de horómetro'}
        className="m-0 flex max-h-80 list-none flex-col gap-2 overflow-y-auto p-0"
      >
        {registros.map((registro) => (
          <li className="flex flex-col gap-1 rounded-xl border border-border px-3.5 py-2.5" key={registro.id}>
            <div className="flex items-start justify-between gap-3">
              <span className="text-sm text-(--muted)">{fmtFechaHora(registro.fecha)}</span>
              <span className="font-mono text-sm font-semibold text-foreground">
                {registro.valorFinal != null
                  ? `${NUMERO.format(registro.valorFinal - registro.valorInicial)} ${controlUnitSuffix(equipo.controlUnit)}`
                  : 'En curso'}
              </span>
            </div>
            <span className="text-sm text-foreground">
              {esLiviano ? (registro.supervisorName ?? '—') : registro.operador}
              {esLiviano && registro.closedByName && registro.closedByName !== registro.supervisorName
                ? ` · cerró ${registro.closedByName}`
                : ''}
            </span>
            <span className="text-xs text-(--muted)">
              {esLiviano
                ? `Km ${NUMERO.format(registro.valorInicial)} → ${
                    registro.valorFinal != null ? NUMERO.format(registro.valorFinal) : '…'
                  }`
                : `Turno ${turnoLabel(registro.turno).toLowerCase()}`}
              {' · '}
              <span>
                {registro.fechaSalida
                  ? fmtDuracion(registro.fecha, registro.fechaSalida)
                  : registro.valorFinal != null
                    ? 'sin hora de salida'
                    : 'en curso'}
              </span>
            </span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <Table variant="secondary">
      {/* Misma regla que el historial de cargas: ~3 filas y scroll propio. */}
      <Table.ScrollContainer className="max-h-48 overflow-y-auto [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10">
        <Table.Content
          aria-label={esLiviano ? 'Historial de kilometraje' : 'Historial de horómetro'}
          className="min-w-full"
        >
          <Table.Header>
            <Table.Column isRowHeader>{esLiviano ? 'Inicio' : 'Entrada'}</Table.Column>
            <Table.Column>{esLiviano ? 'Registró' : 'Operador'}</Table.Column>
            <Table.Column>{esLiviano ? 'Km inicial → final' : 'Turno'}</Table.Column>
            <Table.Column className="text-right">{esLiviano ? 'Recorrido' : 'Uso'}</Table.Column>
            <Table.Column className="text-right">Duración</Table.Column>
          </Table.Header>
          <Table.Body>
            <Table.Collection items={registros}>
              {(registro) => (
                <Table.Row>
                  <Table.Cell className="text-sm text-(--muted)">{fmtFechaHora(registro.fecha)}</Table.Cell>
                  <Table.Cell>
                    {esLiviano ? (registro.supervisorName ?? '—') : registro.operador}
                    {esLiviano && registro.closedByName && registro.closedByName !== registro.supervisorName ? (
                      <span className="block text-xs text-(--muted)">cerró {registro.closedByName}</span>
                    ) : null}
                  </Table.Cell>
                  <Table.Cell className={esLiviano ? 'font-mono text-sm' : undefined}>
                    {esLiviano
                      ? `${NUMERO.format(registro.valorInicial)} → ${
                          registro.valorFinal != null ? NUMERO.format(registro.valorFinal) : '…'
                        }`
                      : turnoLabel(registro.turno)}
                  </Table.Cell>
                  <Table.Cell className="text-right font-mono text-sm font-semibold">
                    {registro.valorFinal != null
                      ? `${NUMERO.format(registro.valorFinal - registro.valorInicial)} ${controlUnitSuffix(equipo.controlUnit)}`
                      : 'En curso'}
                  </Table.Cell>
                  <Table.Cell className="text-right text-sm text-(--muted)">
                    {/* Cerrado sin hora de salida (dato antiguo): no está «en curso». */}
                    {registro.fechaSalida
                      ? fmtDuracion(registro.fecha, registro.fechaSalida)
                      : registro.valorFinal != null
                        ? '—'
                        : 'En curso'}
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Collection>
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}
