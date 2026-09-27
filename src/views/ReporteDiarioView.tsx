import { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';

import { DESKTOP_QUERY, useMediaQuery } from '../hooks/useMediaQuery';
import {
  Automatico,
  Automaticos,
  Boton,
  Campo,
  Card,
  CardHead,
  Chip,
  ChipContexto,
  Cifras,
  Form,
  GrupoHead,
  Hint,
  Input,
  Label,
  Pick,
  Tabla,
  Tarjeta,
  TD,
  TH,
  VistaHead,
  VistaSplit,
} from '../components/terreno/ui';

/**
 * Reporte diario del supervisor — Módulo B de la especificación del 21/09/2026.
 *
 * ⚠️ MAQUETA. No hay backend: ni endpoints, ni tablas, ni tipos compartidos.
 * La especificación define SIETE entidades nuevas para esta pantalla
 * (`reporte_diario`, `planta`, `reporte_planta`, `reporte_traspaso`,
 * `empresa_externa`, `produccion_turno` y los catálogos), y además dice que el
 * Módulo B es alcance nuevo, fuera de la propuesta que se cotizó.
 *
 * Se maqueta ahora para que el cliente la vea en la prueba en faena del
 * 05/10, no porque esté lista. Todo lo que hay debajo son constantes de este
 * archivo: nada se guarda y nada se lee del servidor. Cuando exista el
 * backend, lo que se reemplaza es el origen de los datos — el layout y los
 * cálculos de esta pantalla ya quedan resueltos.
 */

// --- Datos de ejemplo. Salen de la especificación, no son inventados. -------

/** Las diez plantas y apoyos. Catálogo administrable según R7, no constante. */
const PLANTAS = [
  'P.P.1',
  'P.P.2',
  'P.R.2',
  'P.P.4',
  'P.R.4',
  'Apoyo piso Mina-Puerto',
  'Apoyo piso externos',
  'Producto Camino',
  'Producto Fino',
  'Planta P.P.E',
];

/** Las cuatro que nombró el cliente. RT y Spence están en duda (Q8). */
const EMPRESAS = ['Hyd', 'Casa Blanca', 'Coseducam', 'Sijam'];
const EMPRESAS_EN_DUDA = ['RT', 'Spence'];

const TRASPASOS = [
  { clave: 'internos', label: 'Equipos internos', detalle: 'Sal y rechazos dentro de faena' },
  { clave: 'externos', label: 'Equipos externos', detalle: 'Contratistas que cargan para otras faenas' },
  { clave: 'minaPuerto', label: 'Equipos Mina-Puerto', detalle: 'Bajan material hasta el puerto' },
] as const;

/** Operadores del turno. En el sistema real salen del Registro de equipo. */
const OPERADORES_DEL_TURNO = [
  { nombre: 'Patricio Rojas', equipo: 'CA-011' },
  { nombre: 'Luis Contreras', equipo: 'PE-004' },
  { nombre: 'Marcelo Soto', equipo: 'EX-002' },
  { nombre: 'Cristian Araya', equipo: 'CM-015' },
  { nombre: 'Héctor Villalobos', equipo: 'CM-021' },
];

const ANTERIORES = [
  { fecha: '22/09', turno: 'NOCTURNO', supervisor: 'Gonzalo Riquelme', camiones: 10, tonelaje: 1860, piso: 31 },
  { fecha: '22/09', turno: 'DIURNO', supervisor: 'Rodrigo Fuentes', camiones: 12, tonelaje: 2250, piso: 28 },
  { fecha: '21/09', turno: 'NOCTURNO', supervisor: 'Gonzalo Riquelme', camiones: 9, tonelaje: 1590, piso: 33 },
  { fecha: '21/09', turno: 'DIURNO', supervisor: 'Rodrigo Fuentes', camiones: 12, tonelaje: 2190, piso: 26 },
  { fecha: '20/09', turno: 'NOCTURNO', supervisor: 'Gonzalo Riquelme', camiones: 10, tonelaje: 1770, piso: 30 },
];

/** Toneladas por camión, según la referencia que dio el cliente. */
const TONELADAS_POR_CAMION = 30;
/** Meta de carga de piso — es la remunerada, y el cliente quiere verla. */
const META_PISO = 30;

const fmt = (n: number, dec = 0) =>
  n.toLocaleString('es-CL', { minimumFractionDigits: dec, maximumFractionDigits: dec });

const aNumero = (s: string): number => {
  const v = Number.parseFloat(s.replace(/\./g, '').replace(',', '.'));
  return Number.isNaN(v) ? 0 : v;
};

export function ReporteDiarioView() {
  const esEscritorio = useMediaQuery(DESKTOP_QUERY);

  const [personal, setPersonal] = useState({
    jefeMina: 'Álvaro Henríquez',
    jefeTransporte: 'Claudio Bravo',
    hse: 'Daniela Figueroa',
    asistentePlanta: 'Javiera Morales',
  });
  const [productos, setProductos] = useState<string[]>([
    'Sal gruesa granel',
    'Sal fina',
    'Rechazo a acopio',
    'Sal gruesa granel',
    '',
    'Carga directa a camión puerto',
    'Carguío a contratistas',
    'Sal para camino',
    'Fino a silo 2',
    '',
  ]);
  const [traspasos, setTraspasos] = useState({ internos: '3', externos: '2', minaPuerto: '5' });
  const [empresas, setEmpresas] = useState<Record<string, boolean>>({
    Hyd: true,
    'Casa Blanca': true,
    Coseducam: false,
    Sijam: true,
  });
  const [prod, setProd] = useState({
    camionesInternos: '8',
    camionesMinaCaleta: '4',
    vueltas: '6',
    tonelaje: '2.160',
    piso: '583',
    planta: '1.577',
    tf: '720',
    tm: '860',
    tg: '580',
    report: 'R-0917',
    horasReport: '3,5',
  });

  /**
   * El tonelaje se sugiere, no se impone: la especificación dice «puede
   * calcularse desde vueltas × 30 y dejarse editable». El supervisor sabe
   * cuándo un camión salió a media carga.
   */
  const sugerido = useMemo(() => {
    const camiones = aNumero(prod.camionesInternos) + aNumero(prod.camionesMinaCaleta);
    return camiones * aNumero(prod.vueltas) * TONELADAS_POR_CAMION;
  }, [prod.camionesInternos, prod.camionesMinaCaleta, prod.vueltas]);

  const piso = aNumero(prod.piso);
  const planta = aNumero(prod.planta);
  const total = piso + planta;
  const pctPiso = total ? Math.round((piso / total) * 100) : 0;
  const brechaMeta = META_PISO - pctPiso;
  const sumaTolvas = aNumero(prod.tf) + aNumero(prod.tm) + aNumero(prod.tg);

  const formulario = (
    <>
      <Card>
        <CardHead titulo="Personal del turno" bajada="Los cuatro cargos los escribe el supervisor." />
        <Form>
          <div className="flex flex-col gap-3.5 sm:grid sm:grid-cols-2 lg:flex lg:flex-col">
            {(
              [
                ['jefeMina', 'Jefe de turno mina'],
                ['jefeTransporte', 'Jefe de turno transporte'],
                ['hse', 'HSE · prevención de riesgos'],
                ['asistentePlanta', 'Asistente de planta'],
              ] as const
            ).map(([clave, label]) => (
              <Campo key={clave} label={label}>
                <Input
                  value={personal[clave]}
                  onChange={(e) => setPersonal((p) => ({ ...p, [clave]: e.target.value }))}
                />
              </Campo>
            ))}
          </div>

          {/*
           * La lista de operadores es VIVA: se recalcula al abrir el reporte,
           * no se congela al crearlo. Si el supervisor agrega un equipo después,
           * tiene que aparecer acá — es el punto fino que marca la especificación.
           */}
          <div className="flex flex-col gap-2.5 rounded-2xl border border-border bg-[#fafaf8] p-3">
            <Label>
              Operadores del turno
              <em className="rounded-md bg-[var(--accent-soft)] px-1.5 py-px text-[10.5px] font-normal text-[var(--accent-soft-foreground)] not-italic">
                Automático · desde Registro de equipo
              </em>
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {OPERADORES_DEL_TURNO.map((o) => (
                <span key={o.equipo} className="inline-flex items-center gap-2 rounded-xl bg-muted px-2.5 py-1.5 text-sm font-medium">
                  {o.nombre}
                  <b className="tabular text-[12.5px] font-semibold text-muted-foreground">{o.equipo}</b>
                </span>
              ))}
            </div>
            <Hint>Lista viva: se recalcula cada vez que se abre el reporte.</Hint>
          </div>
        </Form>
      </Card>

      <Card>
        <CardHead
          titulo="Operaciones en planta"
          bajada="Una línea por planta. El producto se escribe libre, sin catálogo."
        />
        <div className="flex flex-col gap-2">
          {PLANTAS.map((planta, i) => (
            <div key={planta} className="grid grid-cols-[132px_1fr] items-center gap-2.5">
              <span className="tabular text-sm leading-tight font-semibold">{planta}</span>
              <Input
                aria-label={`Producto de ${planta}`}
                value={productos[i]}
                placeholder="Sin operación en el turno"
                className="!h-12 !text-[15px]"
                onChange={(e) =>
                  setProductos((p) => p.map((v, j) => (j === i ? e.target.value : v)))
                }
              />
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHead titulo="Traspasos" bajada="Movimiento de material dentro y fuera de la faena." />
        <div>
          {TRASPASOS.map((t) => (
            <div key={t.clave} className="flex flex-col gap-1.5 py-2.5 not-first:border-t not-first:border-[#eceef1]">
              <div className="flex items-baseline justify-between gap-2">
                <b className="text-[15px]">{t.label}</b>
                <span className="text-right text-xs text-muted-foreground">{t.detalle}</span>
              </div>
              <Input
                numerico
                aria-label={t.label}
                value={traspasos[t.clave]}
                className="!pr-3.5"
                onChange={(e) => setTraspasos((v) => ({ ...v, [t.clave]: e.target.value }))}
              />
            </div>
          ))}
        </div>
        <Hint>
          Pendiente con el cliente: si se registran como cantidad de equipos, como toneladas o como
          texto. La unidad queda abierta hasta que respondan.
        </Hint>
      </Card>

      <Card>
        <CardHead titulo="Empresas externas del turno" bajada="Marca las contratistas que trabajaron hoy." />
        <div className="flex flex-wrap gap-2">
          {[...EMPRESAS, ...EMPRESAS_EN_DUDA].map((e) => (
            <Pick key={e} activo={!!empresas[e]} onToggle={() => setEmpresas((v) => ({ ...v, [e]: !v[e] }))}>
              {e}
            </Pick>
          ))}
        </div>
        <Hint>
          <span className="mt-2.5 block">
            RT y Spence se nombraron cargando en Kainita, pero no están en el listado que dio el
            cliente. Confirmar si entran acá o son otra categoría.
          </span>
        </Hint>
      </Card>

      <Card>
        <CardHead titulo="Producción del turno" bajada="Mide el turno y respalda lo que se cobra." />
        <Form>
          <div className="grid grid-cols-3 gap-2.5">
            <Campo label="Camiones internos">
              <Input numerico value={prod.camionesInternos} className="!pr-3.5" onChange={(e) => setProd((p) => ({ ...p, camionesInternos: e.target.value }))} />
            </Campo>
            <Campo label="Camiones mina-caleta">
              <Input numerico value={prod.camionesMinaCaleta} className="!pr-3.5" onChange={(e) => setProd((p) => ({ ...p, camionesMinaCaleta: e.target.value }))} />
            </Campo>
            <Campo label="Vueltas por camión">
              <Input numerico value={prod.vueltas} className="!pr-3.5" onChange={(e) => setProd((p) => ({ ...p, vueltas: e.target.value }))} />
            </Campo>
          </div>
          <Hint>Referencia: entre 5 y 7 vueltas por camión en el turno.</Hint>

          <Campo label="Tonelaje estimado" unidad="t">
            <Input numerico value={prod.tonelaje} onChange={(e) => setProd((p) => ({ ...p, tonelaje: e.target.value }))} />
          </Campo>
          <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-muted-foreground">
            <span>
              Sugerido: {aNumero(prod.camionesInternos) + aNumero(prod.camionesMinaCaleta)} camiones ×{' '}
              {prod.vueltas} vueltas × {TONELADAS_POR_CAMION} t ={' '}
              <b className="tabular text-foreground">{fmt(sugerido)} t</b>
            </span>
            <button
              type="button"
              onClick={() => setProd((p) => ({ ...p, tonelaje: fmt(sugerido) }))}
              className="min-h-[34px] cursor-pointer rounded-xl bg-[var(--accent-soft)] px-2.5 text-[12.5px] font-semibold text-[var(--accent-soft-foreground)]"
            >
              Usar sugerido
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Carga de piso vs. carga de planta</Label>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Piso" unidad="t">
                <Input numerico value={prod.piso} onChange={(e) => setProd((p) => ({ ...p, piso: e.target.value }))} />
              </Campo>
              <Campo label="Planta" unidad="t">
                <Input numerico value={prod.planta} onChange={(e) => setProd((p) => ({ ...p, planta: e.target.value }))} />
              </Campo>
            </div>
            {/* La carga de piso es la remunerada: la meta se dibuja para que la
                brecha se vea sin tener que calcularla mentalmente. */}
            <div className="mt-1.5 flex flex-col gap-2 rounded-2xl bg-[#f5f6f8] p-3">
              <div className="relative mt-3.5 h-[18px] rounded-[9px] bg-[#b9c1cc]">
                <span
                  className="absolute inset-y-0 left-0 rounded-[9px] bg-[var(--accent)]"
                  style={{ width: `${pctPiso}%` }}
                />
                <span className="absolute -top-1.5 -bottom-1.5 border-l-2 border-dashed border-foreground" style={{ left: `${META_PISO}%` }}>
                  <span className="absolute -top-[18px] left-1 text-[10.5px] font-bold tracking-wide whitespace-nowrap">
                    META {META_PISO} %
                  </span>
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[13px]">
                <span>
                  <i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-[var(--accent)]" />
                  Piso <b className="tabular">{pctPiso} %</b>
                </span>
                <span>
                  <i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-[#b9c1cc]" />
                  Planta <b className="tabular">{total ? 100 - pctPiso : 0} %</b>
                </span>
                <Chip tono={brechaMeta <= 0 ? 'success' : 'warning'}>
                  {brechaMeta <= 0 ? 'Cumple la meta' : `${brechaMeta} pts bajo la meta`}
                </Chip>
              </div>
              <Hint>La carga de piso es remunerada. Meta: {META_PISO} % piso · {100 - META_PISO} % planta.</Hint>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Producción por tolva</Label>
            <div className="grid grid-cols-3 gap-2.5">
              <Campo label="TF · fina" unidad="t">
                <Input numerico value={prod.tf} onChange={(e) => setProd((p) => ({ ...p, tf: e.target.value }))} />
              </Campo>
              <Campo label="TM · media" unidad="t">
                <Input numerico value={prod.tm} onChange={(e) => setProd((p) => ({ ...p, tm: e.target.value }))} />
              </Campo>
              <Campo label="TG · gruesa" unidad="t">
                <Input numerico value={prod.tg} onChange={(e) => setProd((p) => ({ ...p, tg: e.target.value }))} />
              </Campo>
            </div>
            <Hint>
              Suma de tolvas: <b className="tabular text-foreground">{fmt(sumaTolvas)} t</b> · piso + planta:{' '}
              <b className="tabular text-foreground">{fmt(total)} t</b>
            </Hint>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Campo label="N.º de report">
              <Input value={prod.report} className="tabular" onChange={(e) => setProd((p) => ({ ...p, report: e.target.value }))} />
            </Campo>
            <Campo label="Horas del report" unidad="h">
              <Input numerico value={prod.horasReport} onChange={(e) => setProd((p) => ({ ...p, horasReport: e.target.value }))} />
            </Campo>
          </div>
          <Hint>Para asegurar que se adjunten las fotos de los trabajos adicionales.</Hint>
        </Form>
      </Card>

      <Automaticos>
        <Automatico label="Turno" valor="DIURNO · 08–20" />
        <Automatico label="Fecha" valor={<span className="tabular text-[14.5px]">24/09/2026</span>} />
        <Automatico label="Supervisor" valor="Rodrigo Fuentes" />
      </Automaticos>

      <Boton ancho disabled>
        Enviar reporte diario <ArrowRight className="h-[19px] w-[19px]" />
      </Boton>
      <Hint>
        <span className="block text-center">
          Maqueta: todavía no hay dónde guardarlo. Llegará al administrador y a Sergio Torres.
        </span>
      </Hint>
    </>
  );

  const historial = esEscritorio ? (
    <Tabla titulo="Reportes anteriores" detalle={`Faena Patillo · últimos ${ANTERIORES.length} turnos`}>
      <thead>
        <tr>
          <th className={TH}>Fecha</th>
          <th className={TH}>Turno</th>
          <th className={TH}>Supervisor</th>
          <th className={`${TH} text-right`}>Camiones</th>
          <th className={`${TH} text-right`}>Tonelaje</th>
          <th className={`${TH} text-right`}>Piso / planta</th>
          <th className={TH}>Estado</th>
        </tr>
      </thead>
      <tbody>
        {ANTERIORES.map((r, i) => (
          <tr key={i}>
            <td className={`${TD} tabular`}>{r.fecha}/2026</td>
            <td className={TD}>{r.turno}</td>
            <td className={TD}>{r.supervisor}</td>
            <td className={`${TD} tabular text-right`}>{r.camiones}</td>
            <td className={`${TD} tabular text-right`}>{fmt(r.tonelaje)} t</td>
            <td className={`${TD} text-right`}>
              <Chip tono={r.piso >= META_PISO ? 'success' : 'warning'}>
                {r.piso} / {100 - r.piso}
              </Chip>
            </td>
            <td className={TD}>
              <Chip tono="success">Enviado</Chip>
            </td>
          </tr>
        ))}
      </tbody>
    </Tabla>
  ) : (
    <>
      <GrupoHead titulo="Reportes anteriores" detalle={`${ANTERIORES.length} turnos`} />
      <div className="flex flex-col gap-3">
        {ANTERIORES.map((r, i) => (
          <Tarjeta key={i}>
            <div className="flex items-center justify-between gap-2">
              <b>
                {r.fecha} · {r.turno}
              </b>
              <Chip tono="success">Enviado</Chip>
            </div>
            <span className="text-[13px] text-muted-foreground">{r.supervisor}</span>
            <Cifras
              items={[
                { label: 'Camiones', valor: r.camiones },
                { label: 'Tonelaje', valor: `${fmt(r.tonelaje)} t` },
                { label: 'Piso', valor: `${r.piso} %`, destacado: r.piso < META_PISO },
              ]}
            />
          </Tarjeta>
        ))}
      </div>
    </>
  );

  return (
    <>
      <VistaHead
        titulo="Reporte diario del supervisor"
        contexto={
          <>
            <ChipContexto>Faena Patillo</ChipContexto>
            <ChipContexto>DIURNO · 08–20</ChipContexto>
            <Chip tono="warning">Maqueta</Chip>
          </>
        }
      />
      <VistaSplit formulario={formulario} historial={historial} />
    </>
  );
}
