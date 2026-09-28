import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronRight, History } from 'lucide-react';

import { DESKTOP_QUERY, useMediaQuery } from '../hooks/useMediaQuery';
import { calcularTotales, totalesDeSecciones } from '../lib/reporte-diario';
import {
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
  ChipSeleccion,
  ModalTerreno,
  Tabla,
  Tarjeta,
  TD,
  TH,
  VistaHead,
  VistaUnica,
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

/**
 * Un turno ya enviado, con todo lo que se ve al abrir su detalle. Los totales
 * NO se guardan acá: se calculan desde `secciones` con la misma regla que el
 * formulario, para que un dato de ejemplo no pueda contradecir a otro.
 */
interface ReporteAnterior {
  fecha: string;
  turno: string;
  supervisor: string;
  personal: [string, string][];
  secciones: { label: string; camiones: number; vueltas: number }[];
  tolvas: number[];
  plantas: [string, string][];
  traspasos: [string, string][];
  empresas: string[];
}

const ANTERIORES: ReporteAnterior[] = [
  {
    fecha: '22/09',
    turno: 'NOCTURNO',
    supervisor: 'Gonzalo Riquelme',
    personal: [
      ['Jefe de turno mina', 'Álvaro Henríquez'],
      ['Jefe de turno transporte', 'Nelson Cáceres'],
      ['HSE · prevención de riesgos', 'Daniela Figueroa'],
      ['Asistente de planta', 'Javiera Morales'],
    ],
    secciones: [
      { label: 'Camiones internos', camiones: 5, vueltas: 6 },
      { label: 'Camiones mina-caleta', camiones: 3, vueltas: 5 },
      { label: 'Camiones minera', camiones: 2, vueltas: 4 },
    ],
    tolvas: [10, 8, 6],
    plantas: [
      ['P.P.1', 'Sal gruesa granel'],
      ['P.R.2', 'Rechazo a acopio'],
      ['Producto Fino', 'Fino a silo 2'],
    ],
    traspasos: [
      ['Equipos internos', '3'],
      ['Equipos externos', '1'],
      ['Equipos Mina-Puerto', '4'],
    ],
    empresas: ['Hyd', 'Sijam'],
  },
  {
    fecha: '22/09',
    turno: 'DIURNO',
    supervisor: 'Rodrigo Fuentes',
    personal: [
      ['Jefe de turno mina', 'Álvaro Henríquez'],
      ['Jefe de turno transporte', 'Claudio Bravo'],
      ['HSE · prevención de riesgos', 'Daniela Figueroa'],
      ['Asistente de planta', 'Javiera Morales'],
    ],
    secciones: [
      { label: 'Camiones internos', camiones: 6, vueltas: 7 },
      { label: 'Camiones mina-caleta', camiones: 4, vueltas: 5 },
      { label: 'Camiones minera', camiones: 2, vueltas: 5 },
    ],
    tolvas: [14, 11, 8],
    plantas: [
      ['P.P.1', 'Sal gruesa granel'],
      ['P.P.2', 'Sal fina'],
      ['P.P.4', 'Sal gruesa granel'],
      ['Producto Camino', 'Sal para camino'],
    ],
    traspasos: [
      ['Equipos internos', '4'],
      ['Equipos externos', '2'],
      ['Equipos Mina-Puerto', '5'],
    ],
    empresas: ['Hyd', 'Casa Blanca', 'Sijam'],
  },
  {
    fecha: '21/09',
    turno: 'NOCTURNO',
    supervisor: 'Gonzalo Riquelme',
    personal: [
      ['Jefe de turno mina', 'Mauricio Pinto'],
      ['Jefe de turno transporte', 'Nelson Cáceres'],
      ['HSE · prevención de riesgos', 'Daniela Figueroa'],
      ['Asistente de planta', 'Ignacio Sepúlveda'],
    ],
    secciones: [
      { label: 'Camiones internos', camiones: 4, vueltas: 6 },
      { label: 'Camiones mina-caleta', camiones: 3, vueltas: 4 },
      { label: 'Camiones minera', camiones: 2, vueltas: 5 },
    ],
    tolvas: [9, 7, 5],
    plantas: [
      ['P.R.2', 'Rechazo a acopio'],
      ['Producto Fino', 'Fino a silo 2'],
    ],
    traspasos: [
      ['Equipos internos', '2'],
      ['Equipos externos', '1'],
      ['Equipos Mina-Puerto', '3'],
    ],
    empresas: ['Coseducam'],
  },
  {
    fecha: '21/09',
    turno: 'DIURNO',
    supervisor: 'Rodrigo Fuentes',
    personal: [
      ['Jefe de turno mina', 'Álvaro Henríquez'],
      ['Jefe de turno transporte', 'Claudio Bravo'],
      ['HSE · prevención de riesgos', 'Paulina Vergara'],
      ['Asistente de planta', 'Javiera Morales'],
    ],
    secciones: [
      { label: 'Camiones internos', camiones: 6, vueltas: 6 },
      { label: 'Camiones mina-caleta', camiones: 4, vueltas: 6 },
      { label: 'Camiones minera', camiones: 2, vueltas: 4 },
    ],
    tolvas: [13, 10, 7],
    plantas: [
      ['P.P.1', 'Sal gruesa granel'],
      ['P.P.2', 'Sal fina'],
      ['Apoyo piso externos', 'Carguío a contratistas'],
    ],
    traspasos: [
      ['Equipos internos', '3'],
      ['Equipos externos', '3'],
      ['Equipos Mina-Puerto', '4'],
    ],
    empresas: ['Hyd', 'Casa Blanca', 'Coseducam', 'Sijam'],
  },
  {
    fecha: '20/09',
    turno: 'NOCTURNO',
    supervisor: 'Gonzalo Riquelme',
    personal: [
      ['Jefe de turno mina', 'Mauricio Pinto'],
      ['Jefe de turno transporte', 'Nelson Cáceres'],
      ['HSE · prevención de riesgos', 'Daniela Figueroa'],
      ['Asistente de planta', 'Ignacio Sepúlveda'],
    ],
    secciones: [
      { label: 'Camiones internos', camiones: 5, vueltas: 7 },
      { label: 'Camiones mina-caleta', camiones: 3, vueltas: 5 },
      { label: 'Camiones minera', camiones: 2, vueltas: 4 },
    ],
    tolvas: [11, 9, 6],
    plantas: [
      ['P.P.1', 'Sal gruesa granel'],
      ['P.R.4', 'Rechazo a acopio'],
      ['Producto Fino', 'Fino a silo 2'],
    ],
    traspasos: [
      ['Equipos internos', '3'],
      ['Equipos externos', '2'],
      ['Equipos Mina-Puerto', '4'],
    ],
    empresas: ['Hyd', 'Sijam'],
  },
];

/**
 * Las tres secciones de camiones. Cada una registra cuántos camiones tiene y
 * cuántas vueltas da cada uno de esos camiones en el turno.
 */
const SECCIONES_CAMIONES = [
  { label: 'Camiones internos', camiones: 'camionesInternos', vueltas: 'vueltasInternos' },
  { label: 'Camiones mina-caleta', camiones: 'camionesMinaCaleta', vueltas: 'vueltasMinaCaleta' },
  { label: 'Camiones minera', camiones: 'camionesMinera', vueltas: 'vueltasMinera' },
] as const;

/**
 * Las tres tolvas. Su «vuelta» es un ciclo de llenado y descarga de la tolva
 * misma — no tiene relación con las vueltas de los camiones, y por eso no se
 * cruzan ni se suman entre sí.
 */
const TOLVAS = [
  { label: 'Tolva 1', clave: 'tolva1' },
  { label: 'Tolva 2', clave: 'tolva2' },
  { label: 'Tolva 3', clave: 'tolva3' },
] as const;

const fmt = (n: number, dec = 0) =>
  n.toLocaleString('es-CL', { minimumFractionDigits: dec, maximumFractionDigits: dec });


/** Lo que el sistema completa solo. El `true` marca lo que va en cifra tabular. */
const DATOS_FICHA: [string, string, boolean][] = [
  ['Turno', 'DIURNO · 08–20', false],
  ['Fecha', '24/09/2026', true],
  ['Supervisor', 'Rodrigo Fuentes', false],
];

/**
 * Encabezado de la ficha: qué faena, qué turno, qué día y quién firma.
 *
 * Los tres datos los pone el sistema, y la nota va una sola vez al pie en vez
 * de una insignia «Automático» por fila: repetida tres veces pesaba más que
 * el dato que acompañaba, y hacía que el bloque se leyera como una pantalla
 * de ajustes en vez de como la cabecera de un reporte.
 */
function CabeceraFicha() {
  return (
    <Card>
      <div className="flex flex-col gap-3">
        <div>
          <span className="text-[11.5px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
            Reporte diario del supervisor
          </span>
          <h2 className="text-[19px] leading-tight font-bold tracking-[-0.01em]">Faena Patillo</h2>
        </div>
        <dl className="m-0 grid grid-cols-2 gap-x-3 gap-y-3 border-t border-border pt-3 sm:grid-cols-3">
          {DATOS_FICHA.map(([label, valor, tabular]) => (
            <div key={label} className="flex flex-col gap-0.5">
              <dt>
                <Label>{label}</Label>
              </dt>
              <dd className={`m-0 text-[15px] font-semibold ${tabular ? 'tabular' : ''}`}>
                {valor}
              </dd>
            </div>
          ))}
        </dl>
        <Hint>Los tres los completa el sistema al abrir el reporte.</Hint>
      </div>
    </Card>
  );
}

/**
 * Pares etiqueta → valor para leer un turno ya enviado. El detalle se lee, no
 * se edita: usar los campos del formulario acá invitaría a escribir sobre un
 * reporte que ya se mandó.
 */
function Filas({ filas }: { filas: [string, string][] }) {
  return (
    <dl className="m-0 overflow-hidden rounded-2xl border border-border">
      {filas.map(([label, valor]) => (
        <div
          key={label}
          className="flex items-baseline justify-between gap-3 bg-[#fafbfc] px-3 py-2.5 not-first:border-t not-first:border-border"
        >
          <dt className="text-[12.5px] text-muted-foreground">{label}</dt>
          <dd className="m-0 text-right text-[14.5px] font-medium">{valor}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ReporteDiarioView() {
  const esEscritorio = useMediaQuery(DESKTOP_QUERY);
  const [historialAbierto, setHistorialAbierto] = useState(false);
  const [detalle, setDetalle] = useState<ReporteAnterior | null>(null);

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
    vueltasInternos: '6',
    camionesMinaCaleta: '4',
    vueltasMinaCaleta: '5',
    camionesMinera: '3',
    vueltasMinera: '4',
    tolva1: '12',
    tolva2: '9',
    tolva3: '7',
  });

  const totales = useMemo(() => calcularTotales(prod), [prod]);

  const formulario = (
    <>
      {/*
       * La cabecera abre el reporte en vez de cerrarlo: es el contexto que dice
       * en qué turno se está cargando, y al final de la pantalla llegaba cuando
       * el registro ya estaba escrito.
       */}
      <CabeceraFicha />

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
            <ChipSeleccion key={e} activo={!!empresas[e]} onToggle={() => setEmpresas((v) => ({ ...v, [e]: !v[e] }))}>
              {e}
            </ChipSeleccion>
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
          {/*
           * Una fila por sección: cuántos camiones tiene y cuántas vueltas da
           * cada uno de ellos. Las dos cifras van lado a lado porque es el par
           * que el supervisor anota junto, sección por sección.
           */}
          <div className="flex flex-col gap-3">
            {SECCIONES_CAMIONES.map((seccion) => (
              <div key={seccion.camiones} className="flex flex-col gap-1.5">
                <Label>{seccion.label}</Label>
                <div className="grid grid-cols-2 gap-2.5">
                  <Campo label="Cantidad de camiones">
                    <Input
                      numerico
                      value={prod[seccion.camiones]}
                      className="!pr-3.5"
                      onChange={(e) =>
                        setProd((p) => ({ ...p, [seccion.camiones]: e.target.value }))
                      }
                    />
                  </Campo>
                  <Campo label="Vueltas por camión">
                    <Input
                      numerico
                      value={prod[seccion.vueltas]}
                      className="!pr-3.5"
                      onChange={(e) =>
                        setProd((p) => ({ ...p, [seccion.vueltas]: e.target.value }))
                      }
                    />
                  </Campo>
                </div>
              </div>
            ))}
          </div>
          <Hint>Referencia: entre 5 y 7 vueltas por camión en el turno.</Hint>

          <Cifras
            items={[
              { label: 'Total camiones', valor: fmt(totales.camiones) },
              { label: 'Total vueltas', valor: fmt(totales.vueltas), destacado: true },
            ]}
          />

          <div className="flex flex-col gap-1.5">
            <Label>Vueltas por tolva</Label>
            <div className="grid grid-cols-3 gap-2.5">
              {TOLVAS.map((tolva) => (
                <Campo key={tolva.clave} label={tolva.label}>
                  <Input
                    numerico
                    value={prod[tolva.clave]}
                    className="!pr-3.5"
                    onChange={(e) => setProd((p) => ({ ...p, [tolva.clave]: e.target.value }))}
                  />
                </Campo>
              ))}
            </div>
            <Hint>
              Una vuelta de tolva es un ciclo de llenado y descarga. No son las vueltas de los
              camiones: se cuentan aparte y no tienen por qué cuadrar entre sí.
            </Hint>
          </div>
        </Form>
      </Card>

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

  const lista = esEscritorio ? (
    <Tabla titulo="Reportes anteriores" detalle={`Faena Patillo · últimos ${ANTERIORES.length} turnos`}>
      <thead>
        <tr>
          <th className={TH}>Fecha</th>
          <th className={TH}>Turno</th>
          <th className={TH}>Supervisor</th>
          <th className={`${TH} text-right`}>Camiones</th>
          <th className={`${TH} text-right`}>Vueltas</th>
          <th className={TH}>Estado</th>
          <th className={TH}>
            <span className="sr-only">Detalle</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {ANTERIORES.map((r, i) => {
          const t = totalesDeSecciones(r.secciones);
          return (
            <tr key={i}>
              <td className={`${TD} tabular`}>{r.fecha}/2026</td>
              <td className={TD}>{r.turno}</td>
              <td className={TD}>{r.supervisor}</td>
              <td className={`${TD} tabular text-right`}>{t.camiones}</td>
              <td className={`${TD} tabular text-right`}>{fmt(t.vueltas)}</td>
              <td className={TD}>
                <Chip tono="success">Enviado</Chip>
              </td>
              <td className={`${TD} text-right`}>
                <button
                  type="button"
                  onClick={() => setDetalle(r)}
                  className="inline-flex min-h-[38px] cursor-pointer items-center gap-1 rounded-xl bg-[var(--accent-soft)] px-2.5 text-[12.5px] font-semibold whitespace-nowrap text-[var(--accent-soft-foreground)]"
                >
                  Ver más detalle <ChevronRight className="h-4 w-4" />
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </Tabla>
  ) : (
    <div className="flex flex-col gap-3">
      {ANTERIORES.map((r, i) => {
        const t = totalesDeSecciones(r.secciones);
        return (
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
                { label: 'Camiones', valor: t.camiones },
                { label: 'Vueltas', valor: fmt(t.vueltas), destacado: true },
              ]}
            />
            <Boton variante="contorno" ancho onClick={() => setDetalle(r)}>
              Ver más detalle <ChevronRight className="h-[18px] w-[18px]" />
            </Boton>
          </Tarjeta>
        );
      })}
    </div>
  );

  const vistaDetalle = detalle && (
    <div className="flex flex-col gap-4">
      <Boton variante="contorno" onClick={() => setDetalle(null)} className="self-start">
        <ArrowLeft className="h-[18px] w-[18px]" /> Volver al historial
      </Boton>

      <Cifras
        items={[
          { label: 'Camiones', valor: totalesDeSecciones(detalle.secciones).camiones },
          {
            label: 'Vueltas',
            valor: fmt(totalesDeSecciones(detalle.secciones).vueltas),
            destacado: true,
          },
        ]}
      />

      <div className="flex flex-col gap-1.5">
        <GrupoHead titulo="Producción del turno" />
        <Filas
          filas={detalle.secciones.map((s): [string, string] => [
            s.label,
            `${s.camiones} camiones × ${s.vueltas} vueltas`,
          ])}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <GrupoHead titulo="Vueltas por tolva" />
        <Cifras
          items={detalle.tolvas.map((v, i) => ({ label: `Tolva ${i + 1}`, valor: v }))}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <GrupoHead titulo="Personal del turno" />
        <Filas filas={detalle.personal} />
      </div>

      <div className="flex flex-col gap-1.5">
        <GrupoHead titulo="Operaciones en planta" detalle={`${detalle.plantas.length} con operación`} />
        <Filas filas={detalle.plantas} />
      </div>

      <div className="flex flex-col gap-1.5">
        <GrupoHead titulo="Traspasos" />
        <Filas filas={detalle.traspasos} />
      </div>

      <div className="flex flex-col gap-1.5">
        <GrupoHead titulo="Empresas externas" />
        <div className="flex flex-wrap gap-1.5">
          {detalle.empresas.map((e) => (
            <ChipContexto key={e}>{e}</ChipContexto>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <VistaHead
        titulo="Reporte diario del supervisor"
        /* Faena y turno viven en la cabecera de la ficha: repetirlos acá los
           mostraba dos veces en la misma pantalla. */
        contexto={<Chip tono="warning">Maqueta</Chip>}
      />

      <VistaUnica>
        <Boton
          variante="contorno"
          ancho
          onClick={() => {
            setDetalle(null);
            setHistorialAbierto(true);
          }}
        >
          <History className="h-[19px] w-[19px]" /> Ver historial de reportes
        </Boton>
        {formulario}
      </VistaUnica>

      {/*
       * Lista y detalle son dos pantallas de la MISMA ventana, no una ventana
       * sobre otra: dos modales apilados se pelean el foco y en tablet dejan
       * al supervisor sin saber cuál cierra con Escape.
       */}
      <ModalTerreno
        abierto={historialAbierto}
        onAbiertoChange={(abierto) => {
          setHistorialAbierto(abierto);
          if (!abierto) setDetalle(null);
        }}
        titulo={detalle ? `Reporte del ${detalle.fecha}/2026 · ${detalle.turno}` : 'Historial de reportes'}
        detalle={detalle ? detalle.supervisor : `Faena Patillo · últimos ${ANTERIORES.length} turnos`}
      >
        {vistaDetalle ?? lista}
      </ModalTerreno>
    </>
  );
}
