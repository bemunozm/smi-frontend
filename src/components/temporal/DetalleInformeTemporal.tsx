import { Button } from '@heroui/react';

import { RecordPhoto } from '../RecordPhoto';
import { Chip } from '../ui/Chip';
import { turnoLabel } from '../../config/flota-colors';
import { NUM_CL_1 } from '../../lib/dashboard-format';
import { equiposDelInforme } from '../../lib/informe-antiguo';
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

/** Las escritas a mano conservan los decimales del papel (484,92). */
const NUM_PAPEL = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 });

/** Una lectura: la de una tarjeta como siempre; la escrita a mano, con su unidad. */
const lectura = (valor: number, unidad: 'h' | 'km' | null) =>
  unidad ? `${NUM_PAPEL.format(valor)} ${unidad}` : NUM_CL_1.format(valor);

/**
 * Contenido del detalle de un informe temporal: datos, personal por actividad,
 * observaciones, la foto del report en papel (si la tiene) y cada equipo con
 * sus lecturas, litros y foto del surtidor. Un informe subido después
 * (`antiguo`) no tiene tarjetas: sus equipos escritos a mano salen igual, con
 * el chip «Subido después».
 * Lo comparten el panel de oficina (`InformesTemporalesAdminView`, dentro de su
 * modal y con «Corregir» por tarjeta) y el historial de reportes del supervisor temporal
 * (`HistorialReportes`, solo lectura: sin `onCorregirTarjeta`).
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
  const equipos = equiposDelInforme(informe);
  return (
    <div className="flex flex-col gap-4">
      {informe.antiguo ? (
        <div className="flex flex-wrap items-center gap-2">
          <Chip color="warning" size="sm" variant="soft">
            Subido después
          </Chip>
          <span className="text-xs text-muted-foreground">
            Informe en papel digitalizado después: sus equipos no abrieron ni cerraron tarjetas.
          </span>
        </div>
      ) : null}
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
        {/* Sin tarjetas no hay ventana real: un informe subido después no la muestra. */}
        {informe.antiguo ? null : <Dato label="Inicio" value={hora(informe.inicio)} />}
        {informe.antiguo ? null : <Dato label="Envío" value={hora(informe.fin)} />}
      </div>
      <div className="flex flex-col gap-1 border-t border-separator pt-2.5">
        <span className="text-[11px] font-bold tracking-wider text-(--label-color) uppercase">Observaciones</span>
        <p className="m-0 text-sm whitespace-pre-wrap text-foreground">{informe.observaciones ?? '—'}</p>
      </div>
      {informe.fotoUrl ? (
        <div className="flex flex-col gap-1.5 border-t border-separator pt-2.5">
          <span className="text-[11px] font-bold tracking-wider text-(--label-color) uppercase">Foto del report</span>
          <RecordPhoto alt="Foto del report" src={informe.fotoUrl} maxHeightClassName="max-h-80" />
        </div>
      ) : null}
      <div className="flex flex-col gap-3">
        <span className="text-[11px] font-bold tracking-wider text-(--label-color) uppercase">
          Equipos · {equipos.length}
        </span>
        {equipos.map((t) => (
          <div key={t.key} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm font-semibold text-foreground">
                <span className="font-mono">{t.codigo}</span> · {t.nombre}
              </span>
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                {t.operador}
                {onCorregirTarjeta && t.tarjetaId && t.final != null ? (
                  <Button
                    aria-label={`Corregir lecturas de ${t.codigo}`}
                    onPress={() => onCorregirTarjeta(t.tarjetaId!)}
                    size="sm"
                    variant="secondary"
                  >
                    Corregir
                  </Button>
                ) : null}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <span>Inicial: {lectura(t.inicial, t.unidad)}</span>
              <span>Final: {t.final == null ? '—' : lectura(t.final, t.unidad)}</span>
              <span>Combustible: {t.litros == null ? '—' : `${NUM_CL_1.format(t.litros)} L`}</span>
              <span>AdBlue: {t.adBlue == null ? '—' : `${NUM_CL_1.format(t.adBlue)} L`}</span>
            </div>
            {t.pumpPhotoUrl ? (
              <RecordPhoto
                alt={`Foto del surtidor de ${t.codigo}`}
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
