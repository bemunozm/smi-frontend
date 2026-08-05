import { Link, useParams } from 'react-router-dom';
import { Card, Chip, Spinner, Table } from '@heroui/react';

import { useKardex } from '../hooks/useInventario';
import { UNIDAD_LABELS, unidadSimbolo } from '../config/flota-colors';
import { estaBajoMinimo, type OrigenMovimiento } from '../types/inventario';

const NUMERO = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 });

const ORIGEN_LABELS: Record<OrigenMovimiento, string> = {
  COMPRA: 'Compra',
  DEVOLUCION: 'Devolución',
  AJUSTE_FISICO: 'Ajuste físico',
  INTERVENCION: 'Mantención',
  ACTIVIDAD: 'Actividad',
  TRABAJO_EXTRAORDINARIO: 'Trabajo extra',
};

function formatFecha(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Kardex de un insumo (requerimientos §5.1): historial de entradas y salidas
 * con el saldo resultante en cada punto.
 *
 * El saldo NO se calcula acá: viene guardado en cada movimiento, escrito por el
 * backend dentro de la misma transacción que movió el stock. Recalcularlo en el
 * cliente daría un número distinto en cuanto la lista viniera paginada o
 * filtrada.
 */
export function InsumoKardexView() {
  const { id = '' } = useParams<{ id: string }>();
  const { data, isPending, isError, error } = useKardex(id);

  if (isPending) {
    return (
      <div className="flex justify-center py-16">
        <Spinner color="accent" size="lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col gap-4">
        <div
          className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger-soft-foreground"
          role="alert"
        >
          {error instanceof Error ? error.message : 'No se pudo cargar el kardex.'}
        </div>
        <Link className="text-sm text-accent hover:underline" to="/inventario">
          ← Volver a inventario
        </Link>
      </div>
    );
  }

  const { insumo, movimientos } = data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Link
          className="text-[11px] font-medium tracking-[0.14em] text-(--eyebrow-color) uppercase hover:underline"
          to="/inventario"
        >
          ← SMI · Inventario
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-[28px] font-semibold tracking-[-0.03em] text-foreground">
            {insumo.nombre}
          </h1>
          <Chip size="sm" variant="secondary">
            {insumo.codigo}
          </Chip>
          {estaBajoMinimo(insumo) ? (
            <Chip color="danger" size="sm" variant="soft">
              Stock bajo
            </Chip>
          ) : null}
        </div>
        <p className="text-sm text-muted">
          {insumo.descripcion || `Medido en ${UNIDAD_LABELS[insumo.unidad].toLowerCase()}.`}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <Card.Header>
            <Card.Description className="text-[11px] font-semibold tracking-wider text-(--eyebrow-color) uppercase">
              Stock actual
            </Card.Description>
            <Card.Title className="font-display text-[26px] font-semibold tracking-[-0.02em] text-foreground">
              {NUMERO.format(insumo.stock)} {unidadSimbolo(insumo.unidad)}
            </Card.Title>
          </Card.Header>
        </Card>
        <Card>
          <Card.Header>
            <Card.Description className="text-[11px] font-semibold tracking-wider text-(--eyebrow-color) uppercase">
              Stock mínimo
            </Card.Description>
            <Card.Title className="font-display text-[26px] font-semibold tracking-[-0.02em] text-foreground">
              {NUMERO.format(insumo.stockMinimo)} {unidadSimbolo(insumo.unidad)}
            </Card.Title>
          </Card.Header>
        </Card>
        <Card>
          <Card.Header>
            <Card.Description className="text-[11px] font-semibold tracking-wider text-(--eyebrow-color) uppercase">
              Movimientos
            </Card.Description>
            <Card.Title className="font-display text-[26px] font-semibold tracking-[-0.02em] text-foreground">
              {movimientos.length}
            </Card.Title>
          </Card.Header>
        </Card>
      </div>

      <Card className="flex flex-col gap-3">
        <Card.Header>
          <Card.Title>Kardex</Card.Title>
          <Card.Description>
            Entradas y salidas del insumo, de la más reciente a la más antigua, con el saldo que
            quedó tras cada una.
          </Card.Description>
        </Card.Header>

        {movimientos.length > 0 ? (
          <Table variant="secondary">
            <Table.ScrollContainer>
              <Table.Content aria-label="Kardex del insumo" className="min-w-200">
                <Table.Header>
                  <Table.Column isRowHeader>Fecha</Table.Column>
                  <Table.Column>Tipo</Table.Column>
                  <Table.Column>Origen</Table.Column>
                  <Table.Column>Equipo</Table.Column>
                  <Table.Column>Cantidad</Table.Column>
                  <Table.Column>Saldo</Table.Column>
                  <Table.Column>Observación</Table.Column>
                </Table.Header>
                <Table.Body>
                  <Table.Collection items={movimientos}>
                    {(movimiento) => (
                      <Table.Row>
                        <Table.Cell className="text-sm text-muted">
                          {formatFecha(movimiento.fecha)}
                        </Table.Cell>
                        <Table.Cell>
                          <Chip
                            color={movimiento.tipo === 'ENTRADA' ? 'success' : 'warning'}
                            size="sm"
                            variant="soft"
                          >
                            {movimiento.tipo === 'ENTRADA' ? 'Entrada' : 'Salida'}
                          </Chip>
                        </Table.Cell>
                        <Table.Cell className="text-sm">
                          {ORIGEN_LABELS[movimiento.origen]}
                        </Table.Cell>
                        <Table.Cell className="font-mono text-xs text-muted">
                          {movimiento.equipo ? (
                            <Link
                              className="text-accent hover:underline"
                              to={`/equipos/${movimiento.equipo.id}`}
                            >
                              {movimiento.equipo.codigo}
                            </Link>
                          ) : (
                            '—'
                          )}
                        </Table.Cell>
                        <Table.Cell className="font-mono text-sm">
                          {movimiento.tipo === 'ENTRADA' ? '+' : '−'}
                          {NUMERO.format(movimiento.cantidad)}
                        </Table.Cell>
                        <Table.Cell className="font-mono text-sm font-medium">
                          {NUMERO.format(movimiento.saldoResultante)}
                        </Table.Cell>
                        <Table.Cell className="text-sm text-muted">
                          {movimiento.observacion || '—'}
                        </Table.Cell>
                      </Table.Row>
                    )}
                  </Table.Collection>
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        ) : (
          <p className="px-1 pb-2 text-sm text-muted">
            Este insumo todavía no tiene movimientos registrados.
          </p>
        )}
      </Card>
    </div>
  );
}
