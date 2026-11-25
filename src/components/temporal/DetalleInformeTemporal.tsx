import { Button } from '@heroui/react';

import { RecordPhoto } from '../RecordPhoto';
import { turnoLabel } from '../../config/flota-colors';
import { NUM_CL_1 } from '../../lib/dashboard-format';
import type { InformeTemporal } from '../../types/informe-temporal';

/** `YYYY-MM-DD` → `DD-MM-YYYY`. */
export const fechaLegible = (dia: string) => dia.split('-').reverse().join('-');

const fmtHora = new Intl.DateTimeFormat('es-CL', { dateStyle: 'short', timeStyle: 'short' });
const hora = (iso: string | null) => (iso ? fmtHora.format(new Date(iso)) : '—');

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3.5 border-t border-separator py-2.5">
      <span className="shrink-0 text-[11px] font-bold tracking-wider text-(--label-color) uppercase">{label}</span>
      <span className="text-right text-sm text-foreground">{value}</span>
    </div>
  );
}

/**
 * Contenido del detalle de un informe temporal: datos, personal por actividad,
 * observaciones y cada equipo con sus lecturas, litros y foto del surtidor.
 * Lo comparten el panel de oficina (`InformesTemporalesAdminView`, dentro de su
 * modal y con «Corregir» por tarjeta) y «Mis reportes» del supervisor temporal
 * (`MisReportesTemporalView`, solo lectura: sin `onCorregirTarjeta`).
 */
export function DetalleInformeTemporal({
  informe,
  onCorregirTarjeta,
}: {
  informe: InformeTemporal;
  /** Sin él, las tarjetas no ofrecen «Corregir». */
  onCorregirTarjeta?: (tarjetaId: string) => void;
}) {
  const personalDe = (actividad: 1 | 2) =>
    informe.personal
      .filter((p) => p.actividad === actividad)
      .map((p) => p.nombre)
      .join(', ') || '—';
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-x-7 sm:grid-cols-2 [&>*:first-child]:border-t-0 sm:[&>*:nth-child(2)]:border-t-0">
        <Dato label="Fecha" value={fechaLegible(informe.fecha)} />
        <Dato label="Turno" value={turnoLabel(informe.turno)} />
        <Dato label="Supervisor" value={informe.supervisorNombre} />
        <Dato
          label="Responsables"
          value={[informe.supervisorResponsable1, informe.supervisorResponsable2].filter(Boolean).join(' · ')}
        />
        <Dato label="Actividad 1" value={informe.actividad1} />
        <Dato label="Personal act. 1" value={personalDe(1)} />
        <Dato label="Actividad 2" value={informe.actividad2 ?? '—'} />
        <Dato label="Personal act. 2" value={personalDe(2)} />
        <Dato label="Inicio" value={hora(informe.inicio)} />
        <Dato label="Envío" value={hora(informe.fin)} />
      </div>
      <div className="flex flex-col gap-1 border-t border-separator pt-2.5">
        <span className="text-[11px] font-bold tracking-wider text-(--label-color) uppercase">Observaciones</span>
        <p className="m-0 text-sm whitespace-pre-wrap text-foreground">{informe.observaciones ?? '—'}</p>
      </div>
      <div className="flex flex-col gap-3">
        <span className="text-[11px] font-bold tracking-wider text-(--label-color) uppercase">
          Equipos · {informe.tarjetas.length}
        </span>
        {informe.tarjetas.map((t) => (
          <div key={t.id} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm font-semibold text-foreground">
                <span className="font-mono">{t.equipo.internalCode}</span> · {t.equipo.name}
              </span>
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                {t.operador}
                {onCorregirTarjeta && t.valorFinal != null ? (
                  <Button
                    aria-label={`Corregir lecturas de ${t.equipo.internalCode}`}
                    onPress={() => onCorregirTarjeta(t.id)}
                    size="sm"
                    variant="secondary"
                  >
                    Corregir
                  </Button>
                ) : null}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <span>Inicial: {NUM_CL_1.format(t.valorInicial)}</span>
              <span>Final: {t.valorFinal == null ? '—' : NUM_CL_1.format(t.valorFinal)}</span>
              <span>Combustible: {t.fuelLiters == null ? '—' : `${NUM_CL_1.format(t.fuelLiters)} L`}</span>
              <span>AdBlue: {t.adBlueLiters == null ? '—' : `${NUM_CL_1.format(t.adBlueLiters)} L`}</span>
            </div>
            {t.pumpPhotoUrl ? (
              <RecordPhoto
                alt={`Foto del surtidor de ${t.equipo.internalCode}`}
                src={t.pumpPhotoUrl}
                maxHeightClassName="max-h-60"
              />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
