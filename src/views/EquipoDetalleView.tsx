import { Link, useParams } from 'react-router-dom';
import { Card, Chip, Spinner, Table } from '@heroui/react';

import { useEquipo } from '../hooks/useEquipos';
import { estadoEquipoChipColor, estadoEquipoLabel } from '../config/flota-colors';

const NUMERO = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 });

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

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-t border-border py-3 first:border-t-0 first:pt-0 sm:flex-row sm:items-baseline sm:justify-between">
      <span className="text-[11px] font-semibold tracking-wider text-(--label-color) uppercase">
        {label}
      </span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );
}

function Contador({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <Card.Header>
        <Card.Description className="text-[11px] font-semibold tracking-wider text-(--eyebrow-color) uppercase">
          {label}
        </Card.Description>
        <Card.Title className="font-display text-[26px] font-semibold tracking-[-0.02em] text-foreground">
          {value}
        </Card.Title>
      </Card.Header>
    </Card>
  );
}

/**
 * Ficha técnica del equipo (requerimientos §5.1). Muestra los datos de la
 * unidad, su uso acumulado, cuántos registros tiene en cada dominio y los
 * últimos consumos de inventario imputados.
 *
 * No es la "bitácora consolidada" de §5.5 — esa línea de tiempo que cruza los
 * eventos de todos los dominios es del bloque Núcleo (Benjamín).
 */
export function EquipoDetalleView() {
  const { id = '' } = useParams<{ id: string }>();
  const { data: equipo, isPending, isError, error } = useEquipo(id);

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
          {error instanceof Error ? error.message : 'No se pudo cargar la ficha del equipo.'}
        </div>
        <Link className="text-sm text-accent hover:underline" to="/equipos">
          ← Volver a equipos
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Link
          className="text-[11px] font-medium tracking-[0.14em] text-(--eyebrow-color) uppercase hover:underline"
          to="/equipos"
        >
          ← SMI · Flota
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-[28px] font-semibold tracking-[-0.03em] text-foreground">
            {equipo.codigo}
          </h1>
          <Chip color={estadoEquipoChipColor(equipo.estado)} variant="soft">
            {estadoEquipoLabel(equipo.estado)}
          </Chip>
        </div>
        <p className="text-sm text-muted">
          {equipo.tipo} · {equipo.marca} {equipo.modelo}
          {equipo.anio ? ` · ${equipo.anio}` : ''}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Contador label="Cargas combustible" value={equipo._count.combustibles} />
        <Contador label="Lecturas horómetro" value={equipo._count.horometros} />
        <Contador label="Trabajos extra" value={equipo._count.trabajosExtra} />
        <Contador label="Hallazgos" value={equipo._count.hallazgos} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <Card.Header>
            <Card.Title>Ficha técnica</Card.Title>
            <Card.Description>Identificación y uso acumulado de la unidad.</Card.Description>
          </Card.Header>
          <Card.Content className="mt-2">
            <Dato label="Código / patente" value={equipo.codigo} />
            <Dato label="Tipo" value={equipo.tipo} />
            <Dato label="Marca" value={equipo.marca} />
            <Dato label="Modelo" value={equipo.modelo} />
            <Dato label="Año" value={equipo.anio ? String(equipo.anio) : '—'} />
            <Dato label="Estado" value={estadoEquipoLabel(equipo.estado)} />
            <Dato label="Horómetro actual" value={`${NUMERO.format(equipo.horometroActual)} h`} />
            <Dato
              label="Kilometraje actual"
              value={
                equipo.kilometrajeActual > 0
                  ? `${NUMERO.format(equipo.kilometrajeActual)} km`
                  : '—'
              }
            />
            <Dato label="Dado de alta" value={formatFecha(equipo.createdAt)} />
          </Card.Content>
        </Card>

        <Card className="flex flex-col gap-3">
          <Card.Header>
            <Card.Title>Consumos de inventario</Card.Title>
            <Card.Description>
              Últimos materiales imputados a esta unidad ({equipo._count.movimientos} en total).
            </Card.Description>
          </Card.Header>

          {equipo.movimientos.length > 0 ? (
            <Table variant="secondary">
              <Table.ScrollContainer>
                <Table.Content aria-label="Consumos de inventario" className="min-w-full">
                  <Table.Header>
                    <Table.Column isRowHeader>Insumo</Table.Column>
                    <Table.Column>Cantidad</Table.Column>
                    <Table.Column>Fecha</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    <Table.Collection items={equipo.movimientos}>
                      {(movimiento) => (
                        <Table.Row>
                          <Table.Cell>
                            <span className="font-mono text-xs text-muted">
                              {movimiento.insumo.codigo}
                            </span>{' '}
                            {movimiento.insumo.nombre}
                          </Table.Cell>
                          <Table.Cell className="font-mono text-sm">
                            {movimiento.tipo === 'SALIDA' ? '−' : '+'}
                            {NUMERO.format(movimiento.cantidad)}
                          </Table.Cell>
                          <Table.Cell className="text-sm text-muted">
                            {formatFecha(movimiento.fecha)}
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
              Esta unidad todavía no tiene consumos de inventario registrados.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
