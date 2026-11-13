import { Table } from '@heroui/react';

import { fmtFechaHora, fmtLitros } from '../../lib/format';
import type { RegistroCombustible } from '../../types/combustible';

const FUEL_TYPE_LABEL: Record<string, string> = { PETROLEO: 'Petróleo', BENCINA: 'Bencina' };

/** Historial de cargas de combustible de una unidad. El orden lo decide el caller. */
export function FuelHistoryTable({ registros }: { registros: RegistroCombustible[] }) {
  if (registros.length === 0) {
    return <p className="text-sm text-(--muted)">Esta unidad todavía no tiene cargas de combustible registradas.</p>;
  }
  return (
    <Table variant="secondary">
      {/* ~3 filas visibles con scroll propio (pedido del administrador:
         que el historial no estire la ficha); el encabezado queda fijo. */}
      <Table.ScrollContainer className="max-h-48 overflow-y-auto [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10">
        <Table.Content aria-label="Historial de cargas de combustible" className="min-w-full">
          <Table.Header>
            <Table.Column isRowHeader>Fecha</Table.Column>
            <Table.Column>Tipo</Table.Column>
            <Table.Column className="text-right">Litros</Table.Column>
            <Table.Column>Realizó</Table.Column>
          </Table.Header>
          <Table.Body>
            <Table.Collection items={registros}>
              {(registro) => (
                <Table.Row>
                  <Table.Cell className="text-sm text-(--muted)">{fmtFechaHora(registro.fecha)}</Table.Cell>
                  <Table.Cell>{FUEL_TYPE_LABEL[registro.tipo] ?? registro.tipo}</Table.Cell>
                  <Table.Cell className="text-right font-mono text-sm font-semibold">
                    {fmtLitros(registro.litros)} L
                  </Table.Cell>
                  <Table.Cell className="text-sm">{registro.realizadoPor ?? '—'}</Table.Cell>
                </Table.Row>
              )}
            </Table.Collection>
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}
