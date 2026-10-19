import { Wrench } from 'lucide-react';

import { Chip, type Tono } from '../terreno/ui';
import { fmtNum } from '../../lib/format';
import { fecha, mesLargo } from '../../lib/meses';
import type { CalendarDocument, CalendarEquipment, CalendarService } from '../../types/vencimientos';

/**
 * Piezas del calendario de vencimientos de los livianos (Módulo 4 · R21). Las
 * comparten la vista general (Equipos › Vencimientos de livianos) y la tarjeta
 * de la ficha de cada liviano.
 */

const TONO_DOC: Record<CalendarDocument['status'], Tono> = {
  VENCIDO: 'danger',
  POR_VENCER: 'warning',
  VIGENTE: 'neutral',
  SIN_DATO: 'neutral',
};

/** Patente en grande; código, marca y modelo debajo. */
export function NombreVehiculo({ equipo: e }: { equipo: CalendarEquipment }) {
  return (
    <span className="flex flex-col leading-tight">
      <span className="tabular text-[17px] font-bold text-foreground">{e.licensePlate ?? e.internalCode}</span>
      <span className="text-[13.5px] text-[var(--label-color)]">
        {e.licensePlate ? `${e.internalCode} · ` : ''}
        {e.brand} {e.model}
      </span>
    </span>
  );
}

/** Un documento: rojo vencido, amarillo por vencer, gris vigente. */
export function ChipDocumento({ d, conFecha }: { d: CalendarDocument; conFecha?: boolean }) {
  return (
    <Chip className="!whitespace-normal" tono={TONO_DOC[d.status]}>
      <span>
        {d.label}
        {conFecha ? ` · ${fecha(d.expiryDate)}` : ` · ${d.expiryDate.slice(8, 10)}`}
      </span>
    </Chip>
  );
}

/** La próxima mantención: no tiene fecha, se dice cuánto falta. */
export function ChipMantencion({ s }: { s: CalendarService | null }) {
  if (!s) return <span className="text-[13.5px] text-[var(--label-color)]">Sin lectura</span>;
  const faltan = s.remaining <= 0 ? 'toca ahora' : `faltan ${fmtNum(s.remaining)} ${s.unit}`;
  return (
    <Chip className="!whitespace-normal" tono={s.due ? 'info' : 'neutral'}>
      <Wrench className="size-3.5" aria-hidden />
      <span>
        {fmtNum(s.nextAt)} {s.unit} · {faltan}
      </span>
    </Chip>
  );
}

/**
 * Lo que vence de un vehículo, en orden: los ya vencidos primero y después,
 * mes a mes, lo de los 12 meses del calendario.
 */
export function ListaVencimientos({ equipo: e, months }: { equipo: CalendarEquipment; months: string[] }) {
  const primero = months[0];
  const vencidos = e.documents.filter((d) => d.status === 'VENCIDO' && d.month < primero);
  const porMes = months
    .map((m) => ({ m, docs: e.documents.filter((d) => d.month === m) }))
    .filter((x) => x.docs.length > 0);
  if (vencidos.length === 0 && porMes.length === 0) {
    return <p className="text-[14px] text-[var(--label-color)]">Sin vencimientos en estos 12 meses.</p>;
  }
  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {vencidos.map((d) => (
        <li key={d.id} className="flex flex-wrap items-center gap-2">
          <span className="w-28 shrink-0 text-[14px] font-semibold text-[var(--danger)]">Vencido</span>
          <ChipDocumento conFecha d={d} />
        </li>
      ))}
      {porMes.map(({ m, docs }) => (
        <li key={m} className="flex flex-wrap items-center gap-2">
          <span className="w-28 shrink-0 text-[14px] font-semibold text-[var(--label-color)] capitalize">
            {mesLargo(m)}
          </span>
          {docs.map((d) => (
            <ChipDocumento key={d.id} conFecha d={d} />
          ))}
        </li>
      ))}
    </ul>
  );
}

export function Leyenda({ conDia = true }: { conDia?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[13.5px] text-[var(--label-color)]">
      <Chip tono="danger">Vencido</Chip>
      <Chip tono="warning">Por vencer (dentro del aviso)</Chip>
      <Chip tono="neutral">Vigente</Chip>
      <Chip tono="info">
        <Wrench className="size-3.5" aria-hidden /> Mantención por hacer
      </Chip>
      {conDia ? <span>En la tabla, el número junto al documento es el día del mes en que vence.</span> : null}
    </div>
  );
}
