import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, Card, Chip, Spinner, Table } from '@heroui/react';

import { useEquipmentDetail } from '../hooks/useEquipment';
import { useHorometroList } from '../hooks/useHorometro';
import { useCombustibleList } from '../hooks/useCombustible';
import {
  controlUnitLabel,
  equipmentClassLabel,
  equipmentStatusChipColor,
  equipmentStatusLabel,
} from '../config/flota-colors';
import { RegistrarLecturaModal } from '../components/flota/RegistrarLecturaModal';
import { RegistrarCargaCombustibleModal } from '../components/flota/RegistrarCargaCombustibleModal';

const NUMERO = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 });

const TIPO_COMBUSTIBLE_LABEL: Record<string, string> = {
  PETROLEO: 'Petróleo',
  BENCINA: 'Bencina',
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
  const { data: equipo, isPending, isError, error } = useEquipmentDetail(id);
  // `useHorometroList`/`useCombustibleList` no aceptan `equipoId` — traen el
  // historial completo (mismas queries que usa Terreno) y se filtra acá por
  // esta unidad. `RegistrarLecturaModal`/`RegistrarCargaCombustibleModal`
  // invalidan estas mismas queries al guardar, así que esta ficha se
  // refresca sola (ver el fix de invalidación en `useHorometro`/`useCombustible`).
  const { data: horometros, isPending: isHorometroPending } = useHorometroList();
  const { data: combustibles, isPending: isCombustiblePending } = useCombustibleList();
  const [isLecturaOpen, setIsLecturaOpen] = useState(false);
  const [isCargaOpen, setIsCargaOpen] = useState(false);

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
        <Link className="text-sm text-(--accent) hover:underline" to="/equipos">
          ← Volver a equipos
        </Link>
      </div>
    );
  }

  const uso =
    equipo.controlUnit === 'HOURS'
      ? equipo.currentHourmeter != null
        ? `${NUMERO.format(equipo.currentHourmeter)} h`
        : '—'
      : equipo.currentMileage != null
        ? `${NUMERO.format(equipo.currentMileage)} km`
        : '—';

  // Más reciente primero — mismo criterio que la bitácora consolidada.
  const historialHorometro = (horometros ?? [])
    .filter((registro) => registro.equipoId === equipo.id)
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  const historialCombustible = (combustibles ?? [])
    .filter((registro) => registro.equipoId === equipo.id)
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  // El nivel de combustible se reporta junto a la lectura de horómetro, no
  // en la carga (ver `types/horometro.ts#nivelCombustible`) — el "último
  // nivel" es la lectura más reciente que trajo ese dato, no necesariamente
  // la lectura más reciente a secas.
  const ultimaLecturaConNivel = historialHorometro.find((registro) => registro.nivelCombustible != null);
  const isFuelPending = isHorometroPending || isCombustiblePending;

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
            {equipo.internalCode}
          </h1>
          <Chip color={equipmentStatusChipColor(equipo.status)} variant="soft">
            {equipmentStatusLabel(equipo.status)}
          </Chip>
        </div>
        <p className="text-sm text-(--muted)">
          {equipo.type} · {equipo.brand} {equipo.model}
          {equipo.year ? ` · ${equipo.year}` : ''}
        </p>
        <Link className="text-sm text-(--accent) hover:underline" to={`/equipos/${equipo.id}/ficha`}>
          Ver ficha completa →
        </Link>
      </div>

      {/* KPI hero: uso acumulado (horómetro u odómetro, según `controlUnit`)
         es el dato que más se consulta en terreno — se promueve acá arriba
         en vez de enterrarlo como una fila más de la ficha técnica. */}
      <Card className="border-l-4 border-l-(--accent) bg-(--accent-soft)">
        <Card.Header>
          <Card.Description className="text-[11px] font-semibold tracking-wider text-(--accent-soft-foreground) uppercase">
            {controlUnitLabel(equipo.controlUnit)} · uso acumulado
          </Card.Description>
          <Card.Title className="font-display text-[40px] font-semibold tracking-[-0.02em] text-(--accent-soft-foreground) sm:text-[48px]">
            {uso}
          </Card.Title>
        </Card.Header>
      </Card>

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
            <Dato label="Código interno" value={equipo.internalCode} />
            <Dato label="Patente" value={equipo.licensePlate ?? '—'} />
            <Dato label="Clase" value={equipmentClassLabel(equipo.equipmentClass)} />
            <Dato label="Tipo" value={equipo.type} />
            <Dato label="Marca" value={equipo.brand} />
            <Dato label="Modelo" value={equipo.model} />
            <Dato label="Año" value={equipo.year ? String(equipo.year) : '—'} />
            <Dato label="Estado" value={equipmentStatusLabel(equipo.status)} />
            <Dato label="Unidad de control" value={controlUnitLabel(equipo.controlUnit)} />
            <Dato label="Sucursal base" value={equipo.homeBranch?.name ?? '—'} />
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
                            <span className="font-mono text-xs text-(--muted)">
                              {movimiento.insumo.codigo}
                            </span>{' '}
                            {movimiento.insumo.nombre}
                          </Table.Cell>
                          <Table.Cell className="font-mono text-sm">
                            {movimiento.tipo === 'SALIDA' ? '−' : '+'}
                            {NUMERO.format(movimiento.cantidad)}
                          </Table.Cell>
                          <Table.Cell className="text-sm text-(--muted)">
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
            <p className="px-1 pb-2 text-sm text-(--muted)">
              Esta unidad todavía no tiene consumos de inventario registrados.
            </p>
          )}
        </Card>
      </div>

      {/* Combustible: último nivel viene de la lectura de horómetro más
         reciente que lo trae, y el historial de cargas de
         `useCombustibleList`. Los botones abren el flujo foto→OCR→EXIF
         (`RegistrarLecturaModal`/`RegistrarCargaCombustibleModal`, Fase B). */}
      <Card>
        <Card.Header>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Card.Title>Combustible</Card.Title>
              <Card.Description>Último nivel reportado e historial de cargas.</Card.Description>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onPress={() => setIsLecturaOpen(true)} size="sm" variant="secondary">
                Registrar lectura
              </Button>
              <Button onPress={() => setIsCargaOpen(true)} size="sm" variant="secondary">
                Registrar carga
              </Button>
            </div>
          </div>
          <p className="text-xs text-(--muted)">
            Registro con foto obligatoria: la lectura se autorrellena por OCR y la fecha de la foto se
            valida por EXIF.
          </p>
        </Card.Header>

        <Card.Content className="mt-2 flex flex-col gap-4">
          {isFuelPending ? (
            <div className="flex justify-center py-6">
              <Spinner color="accent" size="sm" />
            </div>
          ) : (
            <>
              <div className="rounded-lg bg-surface-secondary px-4 py-3">
                <p className="text-[11px] font-semibold tracking-wider text-(--eyebrow-color) uppercase">
                  Último nivel
                </p>
                {ultimaLecturaConNivel ? (
                  <>
                    <p className="font-display text-2xl font-semibold text-foreground">
                      {NUMERO.format(ultimaLecturaConNivel.nivelCombustible ?? 0)}%
                    </p>
                    <p className="text-xs text-(--muted)">
                      Registrado {formatFecha(ultimaLecturaConNivel.fecha)} por{' '}
                      {ultimaLecturaConNivel.operador}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-(--muted)">
                    Esta unidad todavía no tiene lecturas de horómetro con nivel de combustible.
                  </p>
                )}
              </div>

              <div>
                <p className="mb-2 text-[11px] font-semibold tracking-wider text-(--eyebrow-color) uppercase">
                  Historial de cargas
                </p>
                {historialCombustible.length > 0 ? (
                  <ul className="divide-y divide-border">
                    {historialCombustible.map((registro) => (
                      <li className="flex items-center justify-between gap-3 py-2 text-sm" key={registro.id}>
                        <span className="text-foreground">
                          {TIPO_COMBUSTIBLE_LABEL[registro.tipo] ?? registro.tipo}
                        </span>
                        <span className="font-mono font-medium text-foreground">
                          {NUMERO.format(registro.litros)} L
                        </span>
                        <span className="text-(--muted)">{formatFecha(registro.fecha)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-(--muted)">
                    Esta unidad todavía no tiene cargas de combustible registradas.
                  </p>
                )}
              </div>
            </>
          )}
        </Card.Content>
      </Card>

      <RegistrarLecturaModal
        equipoId={equipo.id}
        equipoLabel={equipo.internalCode}
        isOpen={isLecturaOpen}
        onOpenChange={setIsLecturaOpen}
      />
      <RegistrarCargaCombustibleModal
        equipoId={equipo.id}
        equipoLabel={equipo.internalCode}
        isOpen={isCargaOpen}
        onOpenChange={setIsCargaOpen}
      />
    </div>
  );
}
