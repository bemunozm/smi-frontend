import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';

import { Boton, Card, Input, Segmentado } from '../components/terreno/ui';
import { TablaPorDocumento, TarjetasPorDocumento } from '../components/vencimientos/PorDocumento';
import {
  ChipDocumento,
  ChipMantencion,
  MantencionEnMes,
  Leyenda,
  ListaVencimientos,
  NombreVehiculo,
} from '../components/vencimientos/calendario';
import { mesCorto, mesLargo, mover } from '../lib/meses';
import { ordenarPorUrgencia, papelesVigentes } from '../lib/vencimientos';
import { DESKTOP_QUERY, useMediaQuery } from '../hooks/useMediaQuery';
import { useCalendarioVencimientos } from '../hooks/useVencimientos';
import type { CalendarEquipment } from '../types/vencimientos';

/**
 * Dos maneras de verlo: «Por documento» (por defecto) dice de cada papel la
 * fecha, cuánto falta y su estado, con lo más urgente arriba; «Calendario 12
 * meses» los ubica mes a mes.
 *
 * Módulo 4 · R21 — calendario anual de los vehículos livianos, por patente:
 * qué documento vence cada mes (revisión técnica, permiso de circulación,
 * seguro…) y cuánto falta para la mantención de cada 10.000 km (o la de su
 * pauta). Los documentos ya vencidos van aparte, primero. La mantención va por
 * kilometraje, sin fecha: se muestra cuánto falta.
 *
 * No es un módulo aparte: se abre desde Equipos («Vencimientos de livianos»),
 * en el panel (`/equipos/vencimientos`) o en el taller
 * (`/mantenimiento/vencimientos`). Cada liviano además lo trae en su ficha.
 */
export function VencimientosView({ contexto = 'flota' }: { contexto?: 'flota' | 'taller' }) {
  const esEscritorio = useMediaQuery(DESKTOP_QUERY);
  const [desde, setDesde] = useState<string | undefined>(undefined);
  const [busqueda, setBusqueda] = useState('');
  const [vista, setVista] = useState<'documentos' | 'calendario'>('documentos');
  const { data, isLoading, isError } = useCalendarioVencimientos(desde);
  const base = contexto === 'taller' ? '/mantenimiento/equipos' : '/equipos';

  const inicio = data?.months[0];
  const equipos = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const lista = data?.equipment ?? [];
    if (!q) return lista;
    return lista.filter((e) =>
      [e.internalCode, e.licensePlate ?? '', e.brand, e.model].some((t) => t.toLowerCase().includes(q)),
    );
  }, [data, busqueda]);

  // Solo el papel actual de cada tipo: uno ya renovado no cuenta como vencido.
  const vencidos = (data?.equipment ?? []).reduce(
    (n, e) => n + papelesVigentes(e).filter((d) => d.status === 'VENCIDO').length,
    0,
  );
  const porVencer = (data?.equipment ?? []).reduce(
    (n, e) => n + papelesVigentes(e).filter((d) => d.status === 'POR_VENCER').length,
    0,
  );
  const mantenciones = (data?.equipment ?? []).filter((e) => e.service?.due).length;

  return (
    <div className="flex flex-col gap-4">
      <Link
        className="inline-flex w-fit items-center gap-1.5 text-[15px] font-semibold text-[var(--accent)] hover:underline"
        to={base}
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Equipos
      </Link>
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-[24px] leading-tight font-bold tracking-[-0.02em] text-foreground">
          Vencimientos de livianos
        </h2>
        <p className="text-[15px] leading-snug text-[var(--label-color)]">
          Cuándo vence la revisión técnica, el permiso de circulación y el seguro de cada vehículo, y cuánto falta para
          su mantención de cada 10.000 km. Los avisos llegan con la anticipación de cada papel.
        </p>
      </div>

      <dl className="m-0 grid grid-cols-1 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {[
          {
            label: 'Papeles vencidos',
            ayuda: 'Hay que renovarlos ya',
            valor: vencidos,
            color: vencidos ? 'text-[var(--danger)]' : '',
          },
          {
            label: 'Por vencer',
            ayuda: 'Dentro de los días de aviso',
            valor: porVencer,
            color: porVencer ? 'text-[var(--warning-soft-foreground)]' : '',
          },
          {
            label: 'Mantenciones por hacer',
            ayuda: 'Dentro del margen de km',
            valor: mantenciones,
            color: mantenciones ? 'text-[#0f2a7a]' : '',
          },
        ].map((c) => (
          <div
            key={c.label}
            className="flex items-center justify-between gap-3 px-4 py-3 sm:flex-col sm:items-start sm:gap-0.5"
          >
            <dt className="flex flex-col">
              <span className="text-[14px] leading-tight font-semibold text-foreground">{c.label}</span>
              <span className="text-[12.5px] text-[var(--label-color)]">{c.ayuda}</span>
            </dt>
            <dd className={`tabular m-0 text-[26px] leading-tight font-bold ${c.color || 'text-foreground'}`}>
              {c.valor}
            </dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="sm:w-[380px]">
          <Segmentado
            etiqueta="Cómo ver los vencimientos"
            valor={vista}
            onChange={setVista}
            opciones={[
              { valor: 'documentos', label: 'Por documento' },
              { valor: 'calendario', label: 'Calendario 12 meses' },
            ]}
          />
        </div>
        <div className="w-full sm:ml-auto sm:w-64">
          <Input
            aria-label="Buscar por patente o código"
            placeholder="Buscar patente o código…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
      </div>

      {vista === 'calendario' && (
        <div className="flex flex-wrap items-center gap-2">
          <Boton
            aria-label="12 meses antes"
            className="min-h-[44px] px-3"
            disabled={!inicio}
            variante="contorno"
            onClick={() => inicio && setDesde(mover(inicio, -12))}
          >
            <ChevronLeft className="h-5 w-5" />
          </Boton>
          <span className="min-w-[200px] text-center text-[16px] font-semibold">
            {data ? `${mesLargo(data.months[0])} – ${mesLargo(data.months[11])}` : '…'}
          </span>
          <Boton
            aria-label="12 meses después"
            className="min-h-[44px] px-3"
            disabled={!inicio}
            variante="contorno"
            onClick={() => inicio && setDesde(mover(inicio, 12))}
          >
            <ChevronRight className="h-5 w-5" />
          </Boton>
          {desde && (
            <Boton className="min-h-[44px] px-4 text-sm" variante="contorno" onClick={() => setDesde(undefined)}>
              Volver a hoy
            </Boton>
          )}
        </div>
      )}

      {isLoading ? (
        <p className="text-[15px] text-[var(--label-color)]">Cargando el calendario…</p>
      ) : isError || !data ? (
        <p className="rounded-2xl bg-[var(--danger-soft)] px-4 py-3 text-[15px] text-[var(--danger-soft-foreground)]">
          No se pudo cargar el calendario de vencimientos.
        </p>
      ) : equipos.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-[15px] text-[var(--label-color)]">
          {busqueda ? 'Ningún liviano coincide con la búsqueda.' : 'No hay vehículos livianos registrados.'}
        </p>
      ) : vista === 'documentos' ? (
        esEscritorio ? (
          <TablaPorDocumento base={base} equipos={ordenarPorUrgencia(equipos)} />
        ) : (
          <TarjetasPorDocumento base={base} equipos={ordenarPorUrgencia(equipos)} />
        )
      ) : esEscritorio ? (
        <TablaCalendario base={base} equipos={equipos} months={data.months} />
      ) : (
        <div className="flex flex-col gap-3.5">
          {equipos.map((e) => (
            <TarjetaVehiculo key={e.id} base={base} equipo={e} months={data.months} />
          ))}
        </div>
      )}

      {vista === 'calendario' ? (
        <Leyenda />
      ) : (
        <p className="text-[14px] text-[var(--label-color)]">
          Arriba, lo más urgente. «Por vencer» significa que el papel ya entró en sus días de aviso (se fijan por tipo
          de papel en «Asignar mantenciones» de cada vehículo). Toca la patente para ver o renovar sus papeles.
        </p>
      )}
      {contexto === 'taller' ? (
        <p className="text-[14px] text-[var(--label-color)]">
          Los documentos los carga el administrador. Las órdenes de mantención aparecen en{' '}
          <Link className="font-semibold text-[var(--accent)] underline" to="/mantenimiento/ordenes">
            Órdenes
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}

/** La patente lleva a la ficha del equipo (documentos y su calendario). */
function AFicha({ base, equipo, children }: { base: string; equipo: CalendarEquipment; children: React.ReactNode }) {
  return (
    <Link className="rounded-lg hover:underline" to={`${base}/${equipo.id}`}>
      {children}
    </Link>
  );
}

/** Escritorio: una fila por patente y una columna por mes. */
function TablaCalendario({ base, equipos, months }: { base: string; equipos: CalendarEquipment[]; months: string[] }) {
  const primero = months[0];
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full min-w-[1100px] border-collapse text-left">
        <thead>
          <tr className="bg-[#fafbfc]">
            <th className="sticky left-0 z-10 bg-[#fafbfc] px-3 py-2.5 text-[13.5px] font-bold text-[var(--label-color)]">
              Patente
            </th>
            <th className="px-2 py-2.5 text-[13.5px] font-bold text-[var(--danger)]">Vencidos</th>
            {months.map((m) => (
              <th key={m} className="px-2 py-2.5 text-[13.5px] font-bold text-[var(--label-color)] capitalize">
                {mesCorto(m)}
              </th>
            ))}
            <th className="px-3 py-2.5 text-[13.5px] font-bold text-[var(--label-color)]">Mantención</th>
          </tr>
        </thead>
        <tbody>
          {equipos.map((e) => (
            <tr key={e.id} className="border-t border-border align-top">
              <td className="sticky left-0 z-10 bg-card px-3 py-3">
                <AFicha base={base} equipo={e}>
                  <NombreVehiculo equipo={e} />
                </AFicha>
              </td>
              <td className="px-2 py-3">
                <div className="flex flex-col gap-1.5">
                  {e.documents
                    .filter((d) => d.status === 'VENCIDO' && d.month < primero)
                    .map((d) => (
                      <ChipDocumento key={d.id} conFecha d={d} />
                    ))}
                </div>
              </td>
              {months.map((m) => (
                <td key={m} className="px-2 py-3">
                  <div className="flex flex-col gap-1.5">
                    {e.documents
                      .filter((d) => d.month === m)
                      .map((d) => (
                        <ChipDocumento key={d.id} d={d} />
                      ))}
                    <MantencionEnMes equipmentId={e.id} mes={m} />
                  </div>
                </td>
              ))}
              <td className="px-3 py-3">
                <ChipMantencion s={e.service} equipmentId={e.id} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Tablet y teléfono: una tarjeta por patente, con lo que vence en orden. */
function TarjetaVehiculo({ base, equipo: e, months }: { base: string; equipo: CalendarEquipment; months: string[] }) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <AFicha base={base} equipo={e}>
          <NombreVehiculo equipo={e} />
        </AFicha>
        <ChipMantencion s={e.service} equipmentId={e.id} />
      </div>
      <ListaVencimientos equipo={e} months={months} />
    </Card>
  );
}
