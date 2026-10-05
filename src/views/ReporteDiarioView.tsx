import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronRight, History, Pencil } from 'lucide-react';

import { DESKTOP_QUERY, useMediaQuery } from '../hooks/useMediaQuery';
import { useAhora } from '../hooks/useAhora';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { aNumero, seccionesDelFormulario, vueltasDeSeccion } from '../lib/reporte-diario';
import { diferencias } from '../lib/cambios';
import type { EntradaCambios } from '../types/cambios';
import { contextoTurno, turnoAnterior, type Turno } from '../lib/turno';
import {
  AvisoEdicion,
  Boton,
  Campo,
  Card,
  CardHead,
  Chip,
  ChipContexto,
  Cifras,
  Filas,
  Form,
  GrupoHead,
  HistorialCambios,
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
 * Lo que el supervisor escribió en un turno ya enviado. Los totales NO se
 * guardan acá: se calculan desde `secciones` con la misma regla que el
 * formulario, para que un dato de ejemplo no pueda contradecir a otro.
 */
interface ContenidoReporte {
  personal: [string, string][];
  secciones: { label: string; camiones: number; vueltas: number }[];
  tolvas: number[];
  plantas: [string, string][];
  traspasos: [string, string][];
  empresas: string[];
  /** Quién corrigió qué después de enviarlo, del más reciente al más viejo (R13). */
  cambios?: EntradaCambios[];
}

/** Un reporte enviado mientras se corrige: los mismos datos, como texto de formulario. */
interface BorradorReporte {
  personal: string[];
  secciones: { camiones: string; vueltas: string }[];
  tolvas: string[];
  /** Planta → producto; vacío si no operó en el turno. */
  plantas: Record<string, string>;
  traspasos: string[];
  empresas: string[];
}

/** Un turno ya enviado: su contenido más a qué turno pertenece y quién firmó. */
interface ReporteAnterior extends ContenidoReporte {
  fecha: Date;
  turno: Turno;
  supervisor: string;
}

/** Quién firmó los turnos de ejemplo: el supervisor real de cada turno (Acta N.° 004). En el sistema real viene del reporte. */
const SUPERVISOR_DE_EJEMPLO: Record<Turno, string> = {
  DIURNO: 'Limbert Villacorta',
  NOCTURNO: 'José Pérez',
};

/**
 * Contenido de los cinco turnos anteriores, del más reciente al más viejo.
 * La fecha y el turno NO están escritos acá: salen del reloj, así el
 * historial siempre muestra los turnos que de verdad precedieron al actual en
 * vez de una semana fija que queda vieja al día siguiente.
 */
const CONTENIDO_ANTERIORES: ContenidoReporte[] = [
  {
    personal: [
      ['Jefe de turno mina', 'Álvaro Henríquez'],
      ['Jefe de turno transporte', 'Nelson Cáceres'],
      ['HSE · prevención de riesgos', 'Daniela Figueroa'],
      ['Asistente de planta', 'Javiera Morales'],
    ],
    secciones: [
      { label: 'Camiones internos', camiones: 5, vueltas: 4 },
      { label: 'Camiones Mina Caleta', camiones: 16, vueltas: 3 },
      { label: 'Camiones mineras', camiones: 34, vueltas: 1 },
    ],
    tolvas: [1, 2, 3],
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
    personal: [
      ['Jefe de turno mina', 'Álvaro Henríquez'],
      ['Jefe de turno transporte', 'Claudio Bravo'],
      ['HSE · prevención de riesgos', 'Daniela Figueroa'],
      ['Asistente de planta', 'Javiera Morales'],
    ],
    secciones: [
      { label: 'Camiones internos', camiones: 6, vueltas: 5 },
      { label: 'Camiones Mina Caleta', camiones: 20, vueltas: 3 },
      { label: 'Camiones mineras', camiones: 42, vueltas: 1 },
    ],
    tolvas: [2, 2, 4],
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
    personal: [
      ['Jefe de turno mina', 'Mauricio Pinto'],
      ['Jefe de turno transporte', 'Nelson Cáceres'],
      ['HSE · prevención de riesgos', 'Daniela Figueroa'],
      ['Asistente de planta', 'Ignacio Sepúlveda'],
    ],
    secciones: [
      { label: 'Camiones internos', camiones: 5, vueltas: 4 },
      { label: 'Camiones Mina Caleta', camiones: 14, vueltas: 3 },
      { label: 'Camiones mineras', camiones: 30, vueltas: 1 },
    ],
    tolvas: [1, 1, 3],
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
    personal: [
      ['Jefe de turno mina', 'Álvaro Henríquez'],
      ['Jefe de turno transporte', 'Claudio Bravo'],
      ['HSE · prevención de riesgos', 'Paulina Vergara'],
      ['Asistente de planta', 'Javiera Morales'],
    ],
    secciones: [
      { label: 'Camiones internos', camiones: 8, vueltas: 5 },
      { label: 'Camiones Mina Caleta', camiones: 18, vueltas: 3 },
      { label: 'Camiones mineras', camiones: 40, vueltas: 1 },
    ],
    tolvas: [2, 2, 4],
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
    personal: [
      ['Jefe de turno mina', 'Mauricio Pinto'],
      ['Jefe de turno transporte', 'Nelson Cáceres'],
      ['HSE · prevención de riesgos', 'Daniela Figueroa'],
      ['Asistente de planta', 'Ignacio Sepúlveda'],
    ],
    secciones: [
      { label: 'Camiones internos', camiones: 5, vueltas: 5 },
      { label: 'Camiones Mina Caleta', camiones: 15, vueltas: 3 },
      { label: 'Camiones mineras', camiones: 36, vueltas: 1 },
    ],
    tolvas: [1, 2, 3],
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
 * cuántas vueltas da cada uno de esos camiones en el turno, y lleva su propio
 * contador: cada tipo tiene tarifa distinta (Acta N.° 004, R9).
 *
 * La referencia es la que dio el cliente en esa reunión, en volúmenes
 * **diarios** — el formulario es por turno, así que sirve para detectar un
 * dato fuera de escala, no como meta.
 */
const SECCIONES_CAMIONES = [
  {
    label: 'Camiones internos',
    corto: 'Internos',
    camiones: 'camionesInternos',
    vueltas: 'vueltasInternos',
    referencia: 'Retiro de rechazos. 5 camiones por contrato (8 a 10 en alta demanda o huelga), 30 a 50 vueltas al día.',
  },
  {
    label: 'Camiones Mina Caleta',
    corto: 'Mina Caleta',
    camiones: 'camionesMinaCaleta',
    vueltas: 'vueltasMinaCaleta',
    referencia: 'De unos 100 camiones se cargan 30 a 40, con 5 a 6 vueltas al día cada uno.',
  },
  {
    label: 'Camiones mineras',
    corto: 'Mineras',
    camiones: 'camionesMinera',
    vueltas: 'vueltasMinera',
    referencia: 'Unos 80 camiones, 1 vuelta al día: traslados a Calama, RT y Spence.',
  },
] as const;

/**
 * Alimentación Planta PPE (Planta Producto Envasado): lo que cada tolva
 * descargó a la planta en el turno, contado en cargas. Antes se llamaba
 * «vueltas por tolva»; el cliente pidió el cambio de nombre en el Acta N.° 004
 * porque «vuelta» se confundía con las de los camiones, que son otra cosa y
 * no se cruzan ni se suman con estas.
 */
const TOLVAS = [
  { label: 'Tolva 1', clave: 'tolva1' },
  { label: 'Tolva 2', clave: 'tolva2' },
  { label: 'Tolva 3', clave: 'tolva3' },
] as const;

const fmt = (n: number, dec = 0) =>
  n.toLocaleString('es-CL', { minimumFractionDigits: dec, maximumFractionDigits: dec });

/** Un contador de vueltas por tipo de camión, con su nombre corto. */
const cifrasPorTipo = (secciones: readonly { camiones: number; vueltas: number }[]) =>
  SECCIONES_CAMIONES.map((s, i) => ({
    label: s.corto,
    valor: fmt(secciones[i] ? vueltasDeSeccion(secciones[i]) : 0),
    destacado: true,
  }));

const dd = (n: number) => String(n).padStart(2, '0');
/** `22/09` */
const diaMes = (f: Date) => `${dd(f.getDate())}/${dd(f.getMonth() + 1)}`;
/** `22/09/2026` */
const fechaCompleta = (f: Date) => `${diaMes(f)}/${f.getFullYear()}`;

/**
 * Los `n` turnos que preceden al turno en curso, del más reciente al más
 * viejo. Se encadena `turnoAnterior` en vez de restar días: al diurno lo
 * precede el nocturno del día ANTERIOR, y al nocturno el diurno del mismo día.
 */
function turnosPrevios(turno: Turno, fecha: Date, n: number): { turno: Turno; fecha: Date }[] {
  const previos: { turno: Turno; fecha: Date }[] = [];
  let actual = { turno, fecha };
  for (let i = 0; i < n; i++) {
    actual = turnoAnterior(actual.turno, actual.fecha);
    previos.push(actual);
  }
  return previos;
}


/**
 * Nombre de una sección dentro de una tarjeta.
 *
 * Va en 15 px y caja normal, no en la versaleta de `Label`: las secciones y
 * los campos compartían estilo, y «CAMIONES INTERNOS» no se distinguía de
 * «CANTIDAD DE CAMIONES» justo debajo. Es el mismo tratamiento que ya usan
 * los ítems de Traspasos en esta pantalla.
 */
function TituloSeccion({ children }: { children: ReactNode }) {
  return <b className="text-[15px] leading-tight">{children}</b>;
}

/**
 * Encabezado de la ficha: qué faena, qué turno, qué día y quién firma.
 *
 * Los tres datos los pone el sistema, y la nota va una sola vez al pie en vez
 * de una insignia «Automático» por fila: repetida tres veces pesaba más que
 * el dato que acompañaba, y hacía que el bloque se leyera como una pantalla
 * de ajustes en vez de como la cabecera de un reporte.
 *
 * Turno y fecha salen del reloj con la misma regla que Registro de equipo
 * (`lib/turno`): de madrugada la fecha es la del día en que arrancó el
 * nocturno, no la del reloj. El supervisor es el usuario de la sesión.
 */
function CabeceraFicha({ turno, fecha, supervisor }: { turno: string; fecha: string; supervisor: string }) {
  /** El `true` marca lo que va en cifra tabular. */
  const datos: [string, string, boolean][] = [
    ['Turno', turno, false],
    ['Fecha', fecha, true],
    ['Supervisor', supervisor, false],
  ];
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
          {datos.map(([label, valor, tabular]) => (
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

export function ReporteDiarioView() {
  const esEscritorio = useMediaQuery(DESKTOP_QUERY);

  const ahora = useAhora();
  const ctx = useMemo(() => contextoTurno(ahora), [ahora]);
  const { user } = useCurrentUser();
  const supervisor = user?.name?.trim() || user?.email || 'Sin identificar';

  /** Lo escrito en los turnos anteriores; es estado porque se puede corregir (R13). */
  const [contenidos, setContenidos] = useState(CONTENIDO_ANTERIORES);

  const anteriores = useMemo<ReporteAnterior[]>(() => {
    const previos = turnosPrevios(ctx.turno, ctx.fecha, contenidos.length);
    return contenidos.map((contenido, i) => ({
      ...contenido,
      ...previos[i],
      supervisor: SUPERVISOR_DE_EJEMPLO[previos[i].turno],
    }));
  }, [ctx, contenidos]);

  const [historialAbierto, setHistorialAbierto] = useState(false);
  const [detalleIdx, setDetalleIdx] = useState<number | null>(null);
  const detalle = detalleIdx == null ? null : (anteriores[detalleIdx] ?? null);
  /** Borrador de la corrección del reporte abierto; null si no se edita. */
  const [edicion, setEdicion] = useState<BorradorReporte | null>(null);
  const [avisoGuardado, setAvisoGuardado] = useState(false);

  /** Abrir o dejar un reporte siempre sale del modo edición. */
  const abrirDetalle = (idx: number | null) => {
    setDetalleIdx(idx);
    setEdicion(null);
    setAvisoGuardado(false);
  };

  const abrirEdicion = (r: ReporteAnterior) => {
    setAvisoGuardado(false);
    setEdicion({
      personal: r.personal.map(([, nombre]) => nombre),
      secciones: r.secciones.map((s) => ({ camiones: String(s.camiones), vueltas: String(s.vueltas) })),
      tolvas: r.tolvas.map(String),
      plantas: Object.fromEntries(PLANTAS.map((p) => [p, r.plantas.find(([nombre]) => nombre === p)?.[1] ?? ''])),
      traspasos: r.traspasos.map(([, v]) => v),
      empresas: r.empresas,
    });
  };

  /**
   * Guarda la corrección de un reporte ya enviado (Acta N.° 004, R13): sin
   * autorización, pero con registro de quién cambió qué. Si nada cambió de
   * verdad no se registra nada. Maqueta: el aviso al administrador lo hará el
   * servidor cuando exista el backend del reporte.
   */
  const guardarEdicion = () => {
    if (detalleIdx == null || !detalle || !edicion) return;
    const r = detalle;
    const nuevo: ContenidoReporte = {
      personal: r.personal.map(([cargo], i) => [cargo, edicion.personal[i].trim()]),
      secciones: r.secciones.map((s, i) => ({
        label: s.label,
        camiones: aNumero(edicion.secciones[i].camiones),
        vueltas: aNumero(edicion.secciones[i].vueltas),
      })),
      tolvas: edicion.tolvas.map(aNumero),
      plantas: PLANTAS.filter((p) => edicion.plantas[p].trim()).map((p) => [p, edicion.plantas[p].trim()]),
      traspasos: r.traspasos.map(([label], i) => [label, edicion.traspasos[i].trim()]),
      empresas: [...EMPRESAS, ...EMPRESAS_EN_DUDA].filter((e) => edicion.empresas.includes(e)),
    };
    const productoDe = (c: ContenidoReporte, p: string) => c.plantas.find(([n]) => n === p)?.[1] ?? '';
    const cambios = diferencias([
      ...r.personal.map(([cargo, nombre], i) => ({
        field: `personal.${i}`,
        label: cargo,
        antes: nombre,
        despues: nuevo.personal[i][1],
      })),
      ...r.secciones.flatMap((s, i) => [
        { field: `secciones.${i}.camiones`, label: `${s.label} · camiones`, antes: String(s.camiones), despues: String(nuevo.secciones[i].camiones) },
        { field: `secciones.${i}.vueltas`, label: `${s.label} · vueltas por camión`, antes: String(s.vueltas), despues: String(nuevo.secciones[i].vueltas) },
      ]),
      ...r.tolvas.map((v, i) => ({
        field: `tolvas.${i}`,
        label: `Alimentación Planta PPE · tolva ${i + 1}`,
        antes: String(v),
        despues: String(nuevo.tolvas[i]),
      })),
      ...PLANTAS.map((p) => ({ field: `plantas.${p}`, label: `Planta ${p}`, antes: productoDe(r, p), despues: productoDe(nuevo, p) })),
      ...r.traspasos.map(([label, v], i) => ({ field: `traspasos.${i}`, label, antes: v, despues: nuevo.traspasos[i][1] })),
      { field: 'empresas', label: 'Empresas externas', antes: r.empresas.join(', '), despues: nuevo.empresas.join(', ') },
    ]);
    if (cambios.length > 0) {
      const entrada: EntradaCambios = {
        id: `${detalleIdx}-${Date.now()}`,
        userName: supervisor,
        createdAt: new Date().toISOString(),
        changes: cambios,
      };
      setContenidos((cs) =>
        cs.map((c, i) => (i === detalleIdx ? { ...nuevo, cambios: [entrada, ...(c.cambios ?? [])] } : c)),
      );
      setAvisoGuardado(true);
    }
    setEdicion(null);
  };

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
    camionesInternos: '5',
    vueltasInternos: '5',
    camionesMinaCaleta: '18',
    vueltasMinaCaleta: '3',
    camionesMinera: '38',
    vueltasMinera: '1',
    tolva1: '2',
    tolva2: '2',
    tolva3: '4',
  });

  const secciones = useMemo(() => seccionesDelFormulario(prod), [prod]);

  const formulario = (
    <>
      {/*
       * La cabecera abre el reporte en vez de cerrarlo: es el contexto que dice
       * en qué turno se está cargando, y al final de la pantalla llegaba cuando
       * el registro ya estaba escrito.
       */}
      <CabeceraFicha
        turno={ctx.etiqueta}
        fecha={ctx.fecha.toLocaleDateString('es-CL')}
        supervisor={supervisor}
      />

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
          <div className="flex flex-col gap-4">
            {SECCIONES_CAMIONES.map((seccion, i) => (
              <div key={seccion.camiones} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <TituloSeccion>{seccion.label}</TituloSeccion>
                  {/* El contador de la sección, a la vista mientras se tipea:
                      es la cifra que se cobra con la tarifa de este tipo. */}
                  <span className="tabular text-[13.5px] font-semibold whitespace-nowrap text-[#0f2a7a]">
                    {fmt(vueltasDeSeccion(secciones[i]))} vueltas
                  </span>
                </div>
                <Hint>Referencia: {seccion.referencia}</Hint>
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
          {/* Un contador por tipo y ningún total: cada tipo se cobra con su
              tarifa (R9), y una suma no correspondería a ninguna. */}
          <div className="flex flex-col gap-1.5">
            <Label>Vueltas del turno por tipo</Label>
            <Cifras
              items={SECCIONES_CAMIONES.map((s, i) => ({
                label: s.corto,
                valor: fmt(vueltasDeSeccion(secciones[i])),
                destacado: true,
              }))}
            />
            <Hint>Cada tipo de camión tiene su propia tarifa: se cuentan por separado y no se suman.</Hint>
          </div>

          <div className="flex flex-col gap-1.5">
            <TituloSeccion>Alimentación Planta PPE</TituloSeccion>
            <Hint>Planta Producto Envasado. Cargas que cada tolva descargó a la planta en el turno.</Hint>
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
              Referencia diaria: tolva 1, 60–70 t (unas 30 t por carga); tolva 2, 60–80 t en
              maxisacos; tolva 3, 150–200 t en 6 a 7 cargas. No son vueltas de camión: se cuentan
              aparte y no tienen por qué cuadrar con ellas.
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
    <Tabla titulo="Reportes anteriores" detalle={`Faena Patillo · últimos ${anteriores.length} turnos`}>
      <thead>
        <tr>
          <th className={TH}>Fecha</th>
          <th className={TH}>Turno</th>
          <th className={TH}>Supervisor</th>
          {/* Una columna de vueltas por tipo de camión: se cobran por separado. */}
          {SECCIONES_CAMIONES.map((s) => (
            <th key={s.corto} className={`${TH} text-right`}>
              {s.corto}
            </th>
          ))}
          <th className={TH}>Estado</th>
          <th className={TH}>
            <span className="sr-only">Detalle</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {anteriores.map((r, i) => {
          return (
            <tr key={i}>
              <td className={`${TD} tabular`}>{fechaCompleta(r.fecha)}</td>
              <td className={TD}>{r.turno}</td>
              <td className={TD}>{r.supervisor}</td>
              {r.secciones.map((s) => (
                <td key={s.label} className={`${TD} tabular text-right`}>
                  {fmt(vueltasDeSeccion(s))}
                </td>
              ))}
              <td className={TD}>
                <Chip tono="success">Enviado</Chip>
              </td>
              <td className={`${TD} text-right`}>
                <button
                  type="button"
                  onClick={() => abrirDetalle(i)}
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
      {anteriores.map((r, i) => {
        return (
          <Tarjeta key={i}>
            <div className="flex items-center justify-between gap-2">
              <b>
                {diaMes(r.fecha)} · {r.turno}
              </b>
              <Chip tono="success">Enviado</Chip>
            </div>
            <span className="text-[13px] text-muted-foreground">{r.supervisor}</span>
            <Cifras items={cifrasPorTipo(r.secciones)} />
            <Boton variante="contorno" ancho onClick={() => abrirDetalle(i)}>
              Ver más detalle <ChevronRight className="h-[18px] w-[18px]" />
            </Boton>
          </Tarjeta>
        );
      })}
    </div>
  );

  /** Para cambiar un valor del borrador sin repetir el `e && {...}` en cada campo. */
  const editar = (cambio: (b: BorradorReporte) => BorradorReporte) => setEdicion((b) => (b ? cambio(b) : b));

  /**
   * Corregir un reporte ya enviado (R13): los mismos bloques del formulario
   * del turno, con lo que se envió, y el aviso al administrador arriba.
   */
  const vistaEdicion = detalle && edicion && (
    <div className="flex flex-col gap-4">
      <AvisoEdicion />

      <div className="flex flex-col gap-2">
        <GrupoHead titulo="Personal del turno" />
        <div className="grid gap-2.5 sm:grid-cols-2">
          {detalle.personal.map(([cargo], i) => (
            <Campo key={cargo} label={cargo}>
              <Input
                value={edicion.personal[i]}
                onChange={(ev) => editar((b) => ({ ...b, personal: b.personal.map((v, j) => (j === i ? ev.target.value : v)) }))}
              />
            </Campo>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <GrupoHead titulo="Producción del turno" />
        {detalle.secciones.map((s, i) => (
          <div key={s.label} className="flex flex-col gap-1.5">
            <TituloSeccion>{s.label}</TituloSeccion>
            <div className="grid grid-cols-2 gap-2.5">
              {(['camiones', 'vueltas'] as const).map((campo) => (
                <Campo key={campo} label={campo === 'camiones' ? 'Cantidad de camiones' : 'Vueltas por camión'}>
                  <Input
                    numerico
                    className="!pr-3.5"
                    value={edicion.secciones[i][campo]}
                    onChange={(ev) =>
                      editar((b) => ({
                        ...b,
                        secciones: b.secciones.map((x, j) => (j === i ? { ...x, [campo]: ev.target.value } : x)),
                      }))
                    }
                  />
                </Campo>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <GrupoHead titulo="Alimentación Planta PPE" detalle="cargas por tolva" />
        <div className="grid grid-cols-3 gap-2.5">
          {edicion.tolvas.map((v, i) => (
            <Campo key={i} label={`Tolva ${i + 1}`}>
              <Input
                numerico
                className="!pr-3.5"
                value={v}
                onChange={(ev) => editar((b) => ({ ...b, tolvas: b.tolvas.map((x, j) => (j === i ? ev.target.value : x)) }))}
              />
            </Campo>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <GrupoHead titulo="Operaciones en planta" />
        {PLANTAS.map((p) => (
          <div key={p} className="grid grid-cols-[132px_1fr] items-center gap-2.5">
            <span className="tabular text-sm leading-tight font-semibold">{p}</span>
            <Input
              aria-label={`Producto de ${p}`}
              className="!h-12 !text-[15px]"
              placeholder="Sin operación en el turno"
              value={edicion.plantas[p]}
              onChange={(ev) => editar((b) => ({ ...b, plantas: { ...b.plantas, [p]: ev.target.value } }))}
            />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <GrupoHead titulo="Traspasos" />
        <div className="grid gap-2.5 sm:grid-cols-3">
          {detalle.traspasos.map(([label], i) => (
            <Campo key={label} label={label}>
              <Input
                numerico
                className="!pr-3.5"
                value={edicion.traspasos[i]}
                onChange={(ev) => editar((b) => ({ ...b, traspasos: b.traspasos.map((x, j) => (j === i ? ev.target.value : x)) }))}
              />
            </Campo>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <GrupoHead titulo="Empresas externas" />
        <div className="flex flex-wrap gap-2">
          {[...EMPRESAS, ...EMPRESAS_EN_DUDA].map((e) => (
            <ChipSeleccion
              key={e}
              activo={edicion.empresas.includes(e)}
              onToggle={() =>
                editar((b) => ({
                  ...b,
                  empresas: b.empresas.includes(e) ? b.empresas.filter((x) => x !== e) : [...b.empresas, e],
                }))
              }
            >
              {e}
            </ChipSeleccion>
          ))}
        </div>
      </div>

      <Boton ancho onClick={guardarEdicion}>
        Guardar cambios <ArrowRight className="h-[19px] w-[19px]" />
      </Boton>
      <Boton variante="contorno" ancho onClick={() => setEdicion(null)}>
        Cancelar
      </Boton>
    </div>
  );

  const vistaDetalle = detalle && (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Boton variante="contorno" onClick={() => abrirDetalle(null)}>
          <ArrowLeft className="h-[18px] w-[18px]" /> Volver al historial
        </Boton>
        <Boton variante="contorno" onClick={() => abrirEdicion(detalle)}>
          <Pencil className="h-[17px] w-[17px]" /> Editar
        </Boton>
      </div>
      {avisoGuardado && (
        <p className="m-0 flex items-center gap-2 rounded-2xl bg-[var(--success-soft)] px-3 py-2.5 text-[13px] font-semibold text-[var(--success-soft-foreground)]">
          <Check className="h-4 w-4 shrink-0" /> Cambio guardado. Se avisó al administrador.
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <GrupoHead titulo="Vueltas por tipo de camión" />
        <Cifras items={cifrasPorTipo(detalle.secciones)} />
      </div>

      <div className="flex flex-col gap-1.5">
        <GrupoHead titulo="Producción del turno" />
        <Filas
          filas={detalle.secciones.map((s): [string, string] => [
            s.label,
            `${s.camiones} camiones × ${s.vueltas} = ${fmt(vueltasDeSeccion(s))} vueltas`,
          ])}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <GrupoHead titulo="Alimentación Planta PPE" detalle="cargas por tolva" />
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

      <HistorialCambios entradas={detalle.cambios ?? []} />
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
            abrirDetalle(null);
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
          if (!abierto) abrirDetalle(null);
        }}
        titulo={
          detalle
            ? `${edicion ? 'Editar · ' : ''}Reporte del ${fechaCompleta(detalle.fecha)} · ${detalle.turno}`
            : 'Historial de reportes'
        }
        detalle={detalle ? detalle.supervisor : `Faena Patillo · últimos ${anteriores.length} turnos`}
      >
        {vistaEdicion || vistaDetalle || lista}
      </ModalTerreno>
    </>
  );
}
