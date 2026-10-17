import { useState, type ReactNode } from "react";
import { Card, Chip, Spinner, Table } from "@heroui/react";

import { RESUMEN_CARD_BG } from "../../config/dashboard-colors";
import { useDashboardResumenDia } from "../../hooks/useDashboard";
import { NUM_CL, NUM_CL_1, formatDia } from "../../lib/dashboard-format";
import { toDateOnly } from "../../lib/turno";
import type { ResumenDia as ResumenDiaData } from "../../types/dashboard";
import { UNIT_SYMBOLS, type UnitOfMeasure } from "../../types/inventory";

const MAX_REPORTS_EQUIPOS = 3;

function KpiTile({
  bg,
  label,
  fecha,
  big,
  unit,
  testId,
  children,
}: {
  bg: string;
  label: string;
  fecha: string;
  big: string;
  unit?: string;
  testId: string;
  children: ReactNode;
}) {
  return (
    <div
      className="flex flex-col gap-2 rounded-xl p-4 text-white"
      data-testid={testId}
      style={{ backgroundColor: bg }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold tracking-wider uppercase">
          {label}
        </span>
        <span className="text-xs opacity-90">{formatDia(fecha)}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-display text-4xl font-semibold tracking-[-0.03em] xl:text-5xl">
          {big}
        </span>
        {unit ? (
          <span className="text-base font-medium opacity-90">{unit}</span>
        ) : null}
      </div>
      <div className="flex flex-col gap-0.5 text-sm opacity-95">{children}</div>
    </div>
  );
}

function TarjetasKpi({ data }: { data: ResumenDiaData }) {
  const { fecha, hm, diesel, reports, produccion, adBlue } = data;
  const vueltasTotal =
    produccion.internos + produccion.minaCaleta + produccion.mineras;
  const extra = reports.porEquipo.length - MAX_REPORTS_EQUIPOS;
  const unidadAdBlue = adBlue
    ? (UNIT_SYMBOLS[adBlue.unidad as UnitOfMeasure] ?? adBlue.unidad)
    : "";

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
      <KpiTile
        bg={RESUMEN_CARD_BG.hm}
        big={NUM_CL_1.format(hm.total)}
        fecha={fecha}
        label="HM operacionales"
        testId="kpi-hm"
      >
        <span>
          {NUM_CL_1.format(hm.dia)} Día + {NUM_CL_1.format(hm.noche)} Noche
        </span>
      </KpiTile>

      <KpiTile
        bg={RESUMEN_CARD_BG.diesel}
        big={NUM_CL_1.format(diesel.total)}
        fecha={fecha}
        label="Diésel"
        testId="kpi-diesel"
        unit="L"
      >
        <span>
          {NUM_CL_1.format(diesel.dia)} Día + {NUM_CL_1.format(diesel.noche)}{" "}
          Noche
        </span>
        <span>
          {diesel.porHm === null
            ? "— L/HM"
            : `${NUM_CL_1.format(diesel.porHm)} L/HM`}
        </span>
      </KpiTile>

      <KpiTile
        bg={RESUMEN_CARD_BG.reports}
        big={NUM_CL_1.format(reports.totalHoras)}
        fecha={fecha}
        label="Reports"
        testId="kpi-reports"
        unit="HM"
      >
        {reports.porEquipo.length === 0 ? <span>Sin reports</span> : null}
        {reports.porEquipo.slice(0, MAX_REPORTS_EQUIPOS).map((e) => (
          <span key={e.internalCode}>
            {e.internalCode}: {NUM_CL_1.format(e.horas)} HM
          </span>
        ))}
        {extra > 0 ? <span>+{extra} más</span> : null}
      </KpiTile>

      <KpiTile
        bg={RESUMEN_CARD_BG.produccion}
        big={NUM_CL.format(vueltasTotal)}
        fecha={fecha}
        label="Producción"
        testId="kpi-produccion"
        unit="vueltas"
      >
        <span>Internos: {NUM_CL.format(produccion.internos)} (vueltas)</span>
        <span>
          Mina Caleta: {NUM_CL.format(produccion.minaCaleta)} (vueltas)
        </span>
        <span>Mineras: {NUM_CL.format(produccion.mineras)} (vueltas)</span>
      </KpiTile>

      <KpiTile
        bg={RESUMEN_CARD_BG.adBlue}
        big={adBlue ? NUM_CL_1.format(adBlue.stock) : "—"}
        fecha={fecha}
        label="AdBlue"
        testId="kpi-adblue"
        unit={adBlue ? unidadAdBlue : undefined}
      >
        {adBlue ? (
          <span>{adBlue.nombre}</span>
        ) : (
          <>
            <span>
              <Chip color="default" size="sm" variant="soft">
                Por verificar
              </Chip>
            </span>
            <span>Crea el ítem AdBlue en Inventario</span>
          </>
        )}
      </KpiTile>
    </div>
  );
}

function TablaOperacion({ data }: { data: ResumenDiaData }) {
  const filas = data.operacionPorEquipo;
  const tot = filas.reduce(
    (a, f) => ({
      diaHm: a.diaHm + f.dia.hm,
      diaL: a.diaL + f.dia.litros,
      nocheHm: a.nocheHm + f.noche.hm,
      nocheL: a.nocheL + f.noche.litros,
      totHm: a.totHm + f.total.hm,
      totL: a.totL + f.total.litros,
    }),
    { diaHm: 0, diaL: 0, nocheHm: 0, nocheL: 0, totHm: 0, totL: 0 },
  );
  const n = (v: number) => NUM_CL_1.format(v);

  return (
    <Card>
      <Card.Header>
        <Card.Title>Operación por equipo – {formatDia(data.fecha)}</Card.Title>
      </Card.Header>
      <Card.Content>
        {filas.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin actividad este día.
          </p>
        ) : (
          <Table variant="secondary">
            <Table.ScrollContainer>
              <Table.Content
                aria-label="Operación por equipo"
                className="min-w-full"
              >
                <Table.Header>
                  <Table.Column isRowHeader>Equipo</Table.Column>
                  <Table.Column>Día HM</Table.Column>
                  <Table.Column>Día L</Table.Column>
                  <Table.Column>Noche HM</Table.Column>
                  <Table.Column>Noche L</Table.Column>
                  <Table.Column>Total HM</Table.Column>
                  <Table.Column>Total L</Table.Column>
                </Table.Header>
                <Table.Body>
                  {[
                    ...filas.map((f) => (
                      <Table.Row
                        data-testid={`op-${f.internalCode}`}
                        id={f.internalCode}
                        key={f.internalCode}
                      >
                        <Table.Cell className="font-mono text-sm">
                          {f.internalCode}
                        </Table.Cell>
                        <Table.Cell className="font-mono text-sm">
                          {n(f.dia.hm)}
                        </Table.Cell>
                        <Table.Cell className="font-mono text-sm">
                          {n(f.dia.litros)}
                        </Table.Cell>
                        <Table.Cell className="font-mono text-sm">
                          {n(f.noche.hm)}
                        </Table.Cell>
                        <Table.Cell className="font-mono text-sm">
                          {n(f.noche.litros)}
                        </Table.Cell>
                        <Table.Cell className="font-mono text-sm">
                          {n(f.total.hm)}
                        </Table.Cell>
                        <Table.Cell className="font-mono text-sm">
                          {n(f.total.litros)}
                        </Table.Cell>
                      </Table.Row>
                    )),
                    <Table.Row data-testid="op-TOTAL" id="TOTAL" key="TOTAL">
                      <Table.Cell className="text-sm font-semibold">
                        TOTAL
                      </Table.Cell>
                      <Table.Cell className="font-mono text-sm font-semibold">
                        {n(tot.diaHm)}
                      </Table.Cell>
                      <Table.Cell className="font-mono text-sm font-semibold">
                        {n(tot.diaL)}
                      </Table.Cell>
                      <Table.Cell className="font-mono text-sm font-semibold">
                        {n(tot.nocheHm)}
                      </Table.Cell>
                      <Table.Cell className="font-mono text-sm font-semibold">
                        {n(tot.nocheL)}
                      </Table.Cell>
                      <Table.Cell className="font-mono text-sm font-semibold">
                        {n(tot.totHm)}
                      </Table.Cell>
                      <Table.Cell className="font-mono text-sm font-semibold">
                        {n(tot.totL)}
                      </Table.Cell>
                    </Table.Row>,
                  ]}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        )}
      </Card.Content>
    </Card>
  );
}

function TablaLecturas({ data }: { data: ResumenDiaData }) {
  return (
    <Card>
      <Card.Header>
        <Card.Title>Lecturas de horómetro</Card.Title>
      </Card.Header>
      <Card.Content>
        {data.lecturas.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin tarjetas este día.
          </p>
        ) : (
          <Table variant="secondary">
            <Table.ScrollContainer>
              <Table.Content
                aria-label="Lecturas de horómetro"
                className="min-w-full"
              >
                <Table.Header>
                  <Table.Column isRowHeader>Equipo</Table.Column>
                  <Table.Column>Turno</Table.Column>
                  <Table.Column>Inicial</Table.Column>
                  <Table.Column>Final</Table.Column>
                  <Table.Column>Avance</Table.Column>
                </Table.Header>
                <Table.Body>
                  {data.lecturas.map((l) => {
                    return (
                      <Table.Row
                        data-testid={`lectura-${l.id}`}
                        id={l.id}
                        key={l.id}
                      >
                        <Table.Cell className="font-mono text-sm">
                          {l.internalCode}
                        </Table.Cell>
                        <Table.Cell className="text-sm">{l.turno}</Table.Cell>
                        <Table.Cell className="font-mono text-sm">
                          {NUM_CL_1.format(l.inicial)}
                        </Table.Cell>
                        <Table.Cell className="font-mono text-sm">
                          {l.final === null
                            ? "en curso"
                            : NUM_CL_1.format(l.final)}
                        </Table.Cell>
                        <Table.Cell className="font-mono text-sm">
                          {l.avance === null
                            ? "en curso"
                            : NUM_CL_1.format(l.avance)}
                        </Table.Cell>
                      </Table.Row>
                    );
                  })}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        )}
      </Card.Content>
    </Card>
  );
}

/** Portada del dashboard: cinco tarjetas KPI + operación por equipo y lecturas del día. */
export function ResumenDia() {
  // `undefined` = hoy (consulta viva); un valor = día pasado puntual.
  const [fecha, setFecha] = useState<string | undefined>(undefined);
  const { data, isPending, isError, error, refetch } =
    useDashboardResumenDia(fecha);
  const hoy = toDateOnly(new Date());
  const actual = fecha ?? hoy;
  const irA = (dia: string) => {
    if (!dia) return; // input vaciado: conservar el día actual
    setFecha(dia >= hoy ? undefined : dia); // hoy = consulta viva, sin param
  };
  const mover = (delta: number) => {
    const [y, m, d] = actual.split("-").map(Number);
    irA(toDateOnly(new Date(y, m - 1, d + delta)));
  };
  const btn =
    "rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-foreground disabled:opacity-40";

  return (
    <section aria-label="Resumen del día" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[11px] font-semibold tracking-wider text-(--eyebrow-color) uppercase">
          Resumen del día
        </h2>
        <div className="flex items-center gap-2">
          <button
            aria-label="Día anterior"
            className={btn}
            onClick={() => mover(-1)}
            type="button"
          >
            ◀
          </button>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Fecha
            <input
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
              max={hoy}
              onChange={(event) => irA(event.target.value)}
              type="date"
              value={actual}
            />
          </label>
          <button
            aria-label="Día siguiente"
            className={btn}
            disabled={actual >= hoy}
            onClick={() => mover(1)}
            type="button"
          >
            ▶
          </button>
          {fecha ? (
            <button
              className={btn}
              onClick={() => setFecha(undefined)}
              type="button"
            >
              Hoy
            </button>
          ) : null}
        </div>
      </div>

      {isPending ? (
        <div
          className="flex justify-center py-8"
          data-testid="resumen-dia-skeleton"
        >
          <Spinner color="accent" size="sm" />
        </div>
      ) : null}

      {isError ? (
        <div
          className="flex items-center justify-between gap-3 rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger-soft-foreground"
          role="alert"
        >
          <span>
            {error instanceof Error
              ? error.message
              : "No se pudo cargar el resumen del día."}
          </span>
          <button
            className="font-medium underline"
            onClick={() => void refetch()}
            type="button"
          >
            Reintentar
          </button>
        </div>
      ) : null}

      {data ? (
        <>
          <TarjetasKpi data={data} />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <TablaOperacion data={data} />
            <TablaLecturas data={data} />
          </div>
        </>
      ) : null}
    </section>
  );
}
