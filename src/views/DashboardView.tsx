import { Card, Chip, Spinner, Table } from '@heroui/react';

import { useCurrentUser } from '../hooks/useCurrentUser';
import {
  useDashboardSummary,
  useHallazgosRecientes,
  useMantencionesProximas,
} from '../hooks/useDashboard';
import {
  criticidadChipColor,
  hallazgoEstadoChipColor,
  hallazgoEstadoLabel,
} from '../config/dashboard-colors';

const CLP_FORMATTER = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

function formatFecha(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(
    date,
  );
}

interface KpiCardProps {
  label: string;
  value: string;
  hint: string;
  hintTone?: 'muted' | 'warning';
}

function KpiCard({ label, value, hint, hintTone = 'muted' }: KpiCardProps) {
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
      <Card.Content>
        <p className={`text-xs ${hintTone === 'warning' ? 'text-warning-soft-foreground' : 'text-muted'}`}>
          {hint}
        </p>
      </Card.Content>
    </Card>
  );
}

function KpiCardSkeleton() {
  return (
    <Card>
      <Card.Content className="flex items-center justify-center py-6">
        <Spinner color="accent" size="sm" />
      </Card.Content>
    </Card>
  );
}

/**
 * Sección de 4 KPIs. Consume `useDashboardSummary()` — el contrato real de
 * cada campo (qué endpoint de qué dominio lo alimentará) está documentado
 * en `types/dashboard.ts` y `DASHBOARD-CONTRACTS.md`.
 */
function SummaryCards() {
  const { data: summary, isPending, isError, error } = useDashboardSummary();

  if (isPending) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <KpiCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger-soft-foreground" role="alert">
        {error instanceof Error ? error.message : 'No se pudo cargar el resumen.'}
      </div>
    );
  }

  const disponibilidadPct = Math.round(
    (summary.equiposDisponibles.disponibles / summary.equiposDisponibles.total) * 100,
  );

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        hint={`${disponibilidadPct}% de la flota operativa`}
        label="Equipos disponibles"
        value={`${summary.equiposDisponibles.disponibles} / ${summary.equiposDisponibles.total}`}
      />
      <KpiCard hint="Requieren seguimiento" label="Hallazgos abiertos" value={String(summary.hallazgosAbiertos)} />
      <KpiCard
        hint="Según umbral de horómetro"
        label="Próximas mantenciones"
        value={String(summary.proximasMantenciones)}
      />
      <KpiCard
        hint="Cifra sujeta a confirmación con Terreno"
        hintTone="warning"
        label="Ingresos trabajos extra"
        value={CLP_FORMATTER.format(summary.ingresosTrabajosExtra)}
      />
    </div>
  );
}

/** Lista de hallazgos recientes — filas dentro de una sola card (mismo
 * patrón de filas con separador que `ProfileView`), no una card por ítem. */
function HallazgosRecientesSection() {
  const { data: hallazgos, isPending, isError, error } = useHallazgosRecientes();

  return (
    <Card>
      <Card.Header>
        <Card.Title>Hallazgos recientes</Card.Title>
        <Card.Description>Últimos reportes de terreno, sin importar su estado.</Card.Description>
      </Card.Header>
      <Card.Content>
        {isPending ? (
          <div className="flex justify-center py-8">
            <Spinner color="accent" size="sm" />
          </div>
        ) : null}

        {isError ? (
          <p className="text-sm text-danger-soft-foreground" role="alert">
            {error instanceof Error ? error.message : 'No se pudo cargar los hallazgos.'}
          </p>
        ) : null}

        {!isPending && !isError
          ? hallazgos.map((hallazgo) => (
              <div
                className="flex flex-col gap-1.5 border-t border-border py-3 first:border-t-0 first:pt-0"
                key={hallazgo.id}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-muted">{hallazgo.equipo}</span>
                  <Chip color={criticidadChipColor(hallazgo.criticidad)} size="sm" variant="soft">
                    {hallazgo.criticidad}
                  </Chip>
                  <Chip color={hallazgoEstadoChipColor(hallazgo.estado)} size="sm" variant="secondary">
                    {hallazgoEstadoLabel(hallazgo.estado)}
                  </Chip>
                  <span className="ms-auto font-mono text-xs text-muted">{formatFecha(hallazgo.fecha)}</span>
                </div>
                <p className="text-sm text-foreground">{hallazgo.descripcion}</p>
              </div>
            ))
          : null}

        {!isPending && !isError && hallazgos.length === 0 ? (
          <p className="py-4 text-sm text-muted">No hay hallazgos recientes.</p>
        ) : null}
      </Card.Content>
    </Card>
  );
}

/** Próximas mantenciones — `Table variant="secondary"`, mismo patrón que
 * `UsersView` (un solo contenedor, sin card anidada). */
function MantencionesProximasSection() {
  const { data: mantenciones, isPending, isError, error } = useMantencionesProximas();

  return (
    <Card className="flex flex-col gap-3">
      <Card.Header>
        <Card.Title>Próximas mantenciones</Card.Title>
        <Card.Description>Equipos cerca de su umbral de horómetro.</Card.Description>
      </Card.Header>

      {isPending ? (
        <div className="flex justify-center py-8">
          <Spinner color="accent" size="sm" />
        </div>
      ) : null}

      {isError ? (
        <p className="px-1 text-sm text-danger-soft-foreground" role="alert">
          {error instanceof Error ? error.message : 'No se pudo cargar las mantenciones.'}
        </p>
      ) : null}

      {!isPending && !isError && mantenciones.length > 0 ? (
        <Table variant="secondary">
          <Table.ScrollContainer>
            <Table.Content aria-label="Próximas mantenciones" className="min-w-full">
              <Table.Header>
                <Table.Column isRowHeader>Equipo</Table.Column>
                <Table.Column>Tipo</Table.Column>
                <Table.Column>Horómetro restante</Table.Column>
              </Table.Header>
              <Table.Body>
                <Table.Collection items={mantenciones}>
                  {(mantencion) => (
                    <Table.Row>
                      <Table.Cell className="font-mono text-sm">{mantencion.equipo}</Table.Cell>
                      <Table.Cell>{mantencion.tipo === 'PREVENTIVA' ? 'Preventiva' : 'Correctiva'}</Table.Cell>
                      <Table.Cell>
                        {mantencion.horometroRestante > 0 ? (
                          `${mantencion.horometroRestante} h`
                        ) : (
                          <Chip color="danger" size="sm" variant="soft">
                            Umbral alcanzado
                          </Chip>
                        )}
                      </Table.Cell>
                    </Table.Row>
                  )}
                </Table.Collection>
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      ) : null}

      {!isPending && !isError && mantenciones.length === 0 ? (
        <p className="px-1 text-sm text-muted">No hay mantenciones próximas.</p>
      ) : null}
    </Card>
  );
}

export function DashboardView() {
  const { user } = useCurrentUser();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium tracking-[0.14em] text-(--eyebrow-color) uppercase">
            SMI · Dashboard
          </span>
          <h1 className="font-display text-[28px] font-semibold tracking-[-0.03em] text-foreground">
            Hola, {user?.name || user?.email}
          </h1>
          <p className="text-sm text-muted">Resumen general del sistema.</p>
        </div>
        <Chip color="warning" size="sm" variant="soft">
          Datos de ejemplo
        </Chip>
      </div>

      <SummaryCards />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <HallazgosRecientesSection />
        <MantencionesProximasSection />
      </div>
    </div>
  );
}
