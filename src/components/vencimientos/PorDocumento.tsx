import { Link } from 'react-router-dom';

import { Card, Chip, type Tono } from '../terreno/ui';
import { ChipMantencion, NombreVehiculo } from './calendario';
import { fecha } from '../../lib/meses';
import { otrosPapeles, PAPELES, papelActual, porRevisar, textoPlazo } from '../../lib/vencimientos';
import type { CalendarDocument, CalendarEquipment } from '../../types/vencimientos';

/**
 * Vencimientos «por documento»: una columna por papel (revisión técnica,
 * permiso de circulación, seguro), con la fecha completa, cuánto falta y el
 * estado en palabras. Es lo que el administrador revisa para saber qué renovar.
 */

const ESTADO: Record<CalendarDocument['status'], { label: string; tono: Tono; barra: string }> = {
  VENCIDO: { label: 'Vencido', tono: 'danger', barra: 'bg-[var(--danger)]' },
  POR_VENCER: { label: 'Por vencer', tono: 'warning', barra: 'bg-[var(--warning)]' },
  VIGENTE: { label: 'Al día', tono: 'success', barra: 'bg-[var(--success)]' },
  SIN_DATO: { label: 'Sin fecha', tono: 'neutral', barra: 'bg-border' },
};

/** Fecha, cuánto falta y el estado de un papel. */
function Papel({ d, alineado = 'izquierda' }: { d: CalendarDocument | undefined; alineado?: 'izquierda' | 'derecha' }) {
  const lado = alineado === 'derecha' ? 'items-end text-right' : 'items-start';
  if (!d) {
    return (
      <div className={`flex flex-col gap-1 ${lado}`}>
        <Chip tono="neutral">Sin cargar</Chip>
        <span className="text-[13px] text-[var(--label-color)]">No hay papel registrado</span>
      </div>
    );
  }
  const e = ESTADO[d.status];
  return (
    <div className={`flex flex-col gap-1 ${lado}`}>
      <Chip tono={e.tono}>{e.label}</Chip>
      <span className="tabular text-[15px] font-semibold text-foreground">{fecha(d.expiryDate)}</span>
      <span
        className={`text-[13px] ${
          d.status === 'VENCIDO'
            ? 'font-semibold text-[var(--danger)]'
            : d.status === 'POR_VENCER'
              ? 'font-semibold text-[var(--warning-soft-foreground)]'
              : 'text-[var(--label-color)]'
        }`}
      >
        {textoPlazo(d.daysToExpiry)}
      </span>
    </div>
  );
}

/** Resumen del vehículo: cuántos papeles piden atención, o cuántos faltan cargar. */
function Resumen({ e }: { e: CalendarEquipment }) {
  const n = porRevisar(e);
  const faltan = PAPELES.filter((p) => !papelActual(e, p.type)).length;
  return (
    <span className="flex w-fit flex-wrap gap-1.5">
      {n > 0 ? <Chip tono="danger">{n === 1 ? '1 papel por revisar' : `${n} papeles por revisar`}</Chip> : null}
      {faltan > 0 ? <Chip tono="warning">{faltan === 1 ? 'Falta 1 papel' : `Faltan ${faltan} papeles`}</Chip> : null}
      {n === 0 && faltan === 0 ? <Chip tono="success">Papeles al día</Chip> : null}
    </span>
  );
}

/** Color de la franja izquierda: el peor estado de sus papeles. */
function franja(e: CalendarEquipment): string {
  const estados = [...PAPELES.map((p) => papelActual(e, p.type)?.status), ...otrosPapeles(e).map((d) => d.status)];
  if (estados.includes('VENCIDO')) return ESTADO.VENCIDO.barra;
  if (estados.includes('POR_VENCER')) return ESTADO.POR_VENCER.barra;
  return 'bg-transparent';
}

const aFicha = (base: string, e: CalendarEquipment) => `${base}/${e.id}`;

/** Escritorio: una fila por patente, una columna por papel. */
export function TablaPorDocumento({ base, equipos }: { base: string; equipos: CalendarEquipment[] }) {
  const conOtros = equipos.some((e) => otrosPapeles(e).length > 0);
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full min-w-[960px] border-collapse text-left">
        <thead>
          <tr className="bg-[#fafbfc]">
            <th className="px-4 py-3 text-[13.5px] font-bold text-[var(--label-color)]">Vehículo</th>
            {PAPELES.map((p) => (
              <th key={p.type} className="px-3 py-3 text-[13.5px] font-bold text-[var(--label-color)]">
                {p.label}
              </th>
            ))}
            {conOtros && <th className="px-3 py-3 text-[13.5px] font-bold text-[var(--label-color)]">Otros</th>}
            <th className="px-3 py-3 text-[13.5px] font-bold text-[var(--label-color)]">Mantención</th>
          </tr>
        </thead>
        <tbody>
          {equipos.map((e) => (
            <tr key={e.id} className="border-t border-border align-top">
              <td className="relative px-4 py-3.5">
                <span className={`absolute inset-y-0 left-0 w-1 ${franja(e)}`} aria-hidden />
                <div className="flex flex-col gap-2">
                  <Link className="w-fit rounded-lg hover:underline" to={aFicha(base, e)}>
                    <NombreVehiculo equipo={e} />
                  </Link>
                  <Resumen e={e} />
                </div>
              </td>
              {PAPELES.map((p) => (
                <td key={p.type} className="px-3 py-3.5">
                  <Papel d={papelActual(e, p.type)} />
                </td>
              ))}
              {conOtros && (
                <td className="px-3 py-3.5">
                  <div className="flex flex-col gap-3">
                    {otrosPapeles(e).map((d) => (
                      <div key={d.id} className="flex flex-col gap-1">
                        <span className="text-[13px] font-semibold text-foreground">{d.label}</span>
                        <Papel d={d} />
                      </div>
                    ))}
                  </div>
                </td>
              )}
              <td className="px-3 py-3.5">
                <ChipMantencion s={e.service} equipmentId={e.id} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Tablet y teléfono: una tarjeta por patente con un renglón por papel. */
export function TarjetasPorDocumento({ base, equipos }: { base: string; equipos: CalendarEquipment[] }) {
  return (
    <div className="grid gap-3.5 md:grid-cols-2">
      {equipos.map((e) => {
        const filas: { clave: string; label: string; d: CalendarDocument | undefined }[] = [
          ...PAPELES.map((p) => ({ clave: p.type, label: p.label, d: papelActual(e, p.type) })),
          ...otrosPapeles(e).map((d) => ({ clave: d.id, label: d.label, d })),
        ];
        return (
          <Card key={e.id} className="relative flex flex-col gap-3 overflow-hidden">
            <span className={`absolute inset-y-0 left-0 w-1.5 ${franja(e)}`} aria-hidden />
            <div className="flex flex-wrap items-start justify-between gap-2">
              <Link className="rounded-lg hover:underline" to={aFicha(base, e)}>
                <NombreVehiculo equipo={e} />
              </Link>
              <Resumen e={e} />
            </div>
            <ul className="m-0 flex list-none flex-col divide-y divide-border p-0">
              {filas.map((f) => (
                <li key={f.clave} className="flex items-start justify-between gap-3 py-2.5">
                  <span className="pt-0.5 text-[15px] font-semibold text-foreground">{f.label}</span>
                  <Papel d={f.d} alineado="derecha" />
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
              <span className="text-[15px] font-semibold text-foreground">Mantención</span>
              <ChipMantencion s={e.service} equipmentId={e.id} />
            </div>
          </Card>
        );
      })}
    </div>
  );
}
