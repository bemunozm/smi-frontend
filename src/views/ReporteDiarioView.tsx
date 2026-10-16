import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronRight, History, Pencil } from 'lucide-react';

import { DESKTOP_QUERY, useMediaQuery } from '../hooks/useMediaQuery';
import { useTurnoActual } from '../hooks/useTurnoActual';
import { useCurrentUser } from '../hooks/useCurrentUser';
import {
  useCreateReporteDiario,
  useEditReporteDiario,
  useEmpresasExternas,
  usePlantas,
  useReporteCambios,
  useReportesDiarios,
} from '../hooks/useReporteDiario';
import { useShiftCardsMine } from '../hooks/useShiftCards';
import { errorDeEntero, formatDecimalInput } from '../lib/decimal';
import {
  aReporteAnterior,
  enteroOCero,
  seccionesDelFormulario,
  vueltasDeSeccion,
  type ReporteAnterior,
} from '../lib/reporte-diario';
import { toDateOnly } from '../lib/turno';
import { SECCIONES, type CreateReporteDiarioInput, type EditReporteDiarioBody } from '../types/reporte-diario';
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
 * Reporte diario del supervisor (Módulo B de la especificación).
 *
 * Conectado al backend: las plantas y empresas salen de los catálogos, el
 * supervisor es el usuario de la sesión, los operadores salen de las tarjetas
 * de turno abiertas, y «Enviar» crea el reporte por la cola offline (sin señal
 * queda guardado en el equipo y se envía solo). El historial lista los reportes
 * de la última semana que devuelve el servidor.
 *
 * Corregir un reporte enviado manda un PATCH por la cola con los bloques
 * editados (plantas y empresas por id, nunca por nombre); el historial de
 * cambios lo registra y lo devuelve el servidor.
 */

// --- Datos de ejemplo. Salen de la especificación, no son inventados. -------

const TRASPASOS = [
  { clave: 'internos', label: 'Equipos internos', detalle: 'Sal y rechazos dentro de faena' },
  { clave: 'externos', label: 'Equipos externos', detalle: 'Contratistas que cargan para otras faenas' },
  { clave: 'minaPuerto', label: 'Equipos Mina-Puerto', detalle: 'Bajan material hasta el puerto' },
] as const;

/** Un reporte enviado mientras se corrige: los mismos datos, como texto de formulario. */
interface BorradorReporte {
  personal: string[];
  secciones: { camiones: string; vueltas: string }[];
  tolvas: string[];
  /** plantaId → producto; vacío si no operó en el turno. */
  plantas: Record<string, string>;
  traspasos: string[];
  /** Ids de las empresas externas que trabajaron. */
  empresas: string[];
}

/**
 * Las tres secciones de camiones. Cada una registra cuántos camiones tiene y
 * cuántas vueltas da cada uno de esos camiones en el turno, y lleva su propio
 * contador: cada tipo tiene tarifa distinta.
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
 * «vueltas por tolva»; el cliente pidió el cambio de nombre
 * porque «vuelta» se confundía con las de los camiones, que son otra cosa y
 * no se cruzan ni se suman con estas.
 */
const TOLVAS = [
  { label: 'Tolva 1', clave: 'tolva1' },
  { label: 'Tolva 2', clave: 'tolva2' },
  { label: 'Tolva 3', clave: 'tolva3' },
] as const;

/** Los cuatro cargos del formulario: clave del estado y rol que viaja al servidor. */
const PERSONAL = [
  ['jefeMina', 'Jefe de turno mina'],
  ['jefeTransporte', 'Jefe de turno transporte'],
  ['hse', 'HSE · prevención de riesgos'],
  ['asistentePlanta', 'Asistente de planta'],
] as const;

/** Tipo de traspaso que espera el servidor para cada fila del formulario. */
const TRASPASO_TIPO = { internos: 'INTERNOS', externos: 'EXTERNOS', minaPuerto: 'MINA_PUERTO' } as const;

/** El formulario arranca en blanco: ningún dato se inventa por el supervisor. */
const PERSONAL_VACIO = { jefeMina: '', jefeTransporte: '', hse: '', asistentePlanta: '' };
const TRASPASOS_VACIO = { internos: '', externos: '', minaPuerto: '' };
const PROD_VACIO = {
  camionesInternos: '',
  vueltasInternos: '',
  camionesMinaCaleta: '',
  vueltasMinaCaleta: '',
  camionesMinera: '',
  vueltasMinera: '',
  tolva1: '',
  tolva2: '',
  tolva3: '',
};

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

  const ctx = useTurnoActual();
  const { user } = useCurrentUser();
  const supervisor = user?.name?.trim() || user?.email || 'Sin identificar';

  // Catálogos y operadores reales. Mientras cargan (o si fallan) las listas
  // quedan vacías y la pantalla sigue renderizando.
  const { data: plantasCatalogo, isSuccess: plantasListas } = usePlantas();
  const { data: empresasCatalogo, isSuccess: empresasListas } = useEmpresasExternas();
  /** Editar necesita ambos catálogos: con uno vacío el borrador borraría bloques. */
  const catalogosListos = plantasListas && empresasListas;
  const { data: tarjetas } = useShiftCardsMine();
  const plantas = useMemo(() => plantasCatalogo ?? [], [plantasCatalogo]);
  const empresasExternas = useMemo(() => empresasCatalogo ?? [], [empresasCatalogo]);
  /** Tarjetas abiertas (sin salida registrada): quién opera qué equipo ahora. */
  const operadoresDelTurno = useMemo(
    () =>
      (tarjetas ?? [])
        .filter((c) => c.closedAt == null)
        .map((c) => ({ id: c.id, nombre: c.operatorName, equipo: c.equipo.internalCode })),
    [tarjetas],
  );

  /** Reportes de la última semana, del turno más reciente al más viejo. */
  const desde = toDateOnly(new Date(ctx.fecha.getFullYear(), ctx.fecha.getMonth(), ctx.fecha.getDate() - 7));
  const hasta = toDateOnly(ctx.fecha);
  const { data: reportes } = useReportesDiarios({ desde, hasta });
  const anteriores = useMemo<ReporteAnterior[]>(
    () =>
      (reportes ?? [])
        .map(aReporteAnterior)
        .sort(
          (a, b) =>
            b.fecha.getTime() - a.fecha.getTime() ||
            Number(b.turno === 'NOCTURNO') - Number(a.turno === 'NOCTURNO'),
        ),
    [reportes],
  );

  const [historialAbierto, setHistorialAbierto] = useState(false);
  /** Id del reporte abierto: un índice apuntaría a otro tras un refetch. */
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const detalle = detalleId == null ? null : (anteriores.find((r) => r.id === detalleId) ?? null);
  const { data: cambios, isLoading: cargandoCambios } = useReporteCambios(detalle?.id ?? null);
  const editarReporte = useEditReporteDiario();
  /** Borrador de la corrección del reporte abierto; null si no se edita. */
  const [edicion, setEdicion] = useState<BorradorReporte | null>(null);
  /** Cómo quedó la última corrección: enviada ya, o guardada en el equipo. */
  const [avisoGuardado, setAvisoGuardado] = useState<'sent' | 'queued' | null>(null);

  /** Abrir o dejar un reporte siempre sale del modo edición. */
  const abrirDetalle = (id: string | null) => {
    setDetalleId(id);
    setEdicion(null);
    setAvisoGuardado(null);
  };

  // Si el reporte abierto desaparece tras un refetch, se cierra sin dejar un
  // borrador colgando (los setState de render sobre el mismo componente son válidos).
  if (detalleId != null && detalle == null) abrirDetalle(null);

  const abrirEdicion = (r: ReporteAnterior) => {
    setAvisoGuardado(null);
    setEdicion({
      personal: r.personal.map(([, nombre]) => nombre),
      secciones: r.secciones.map((s) => ({ camiones: formatDecimalInput(s.camiones), vueltas: formatDecimalInput(s.vueltas) })),
      tolvas: r.tolvas.map((cargas) => formatDecimalInput(cargas)),
      // Por id y solo del catálogo activo: el servidor rechaza con 400 una
      // planta o empresa inactiva, así que las que ya no lo están se quitan.
      plantas: Object.fromEntries(plantas.map((p) => [p.id, r.productosPorPlantaId[p.id] ?? ''])),
      traspasos: r.traspasos.map(([, v]) => v),
      empresas: r.empresaIds.filter((id) => empresasExternas.some((e) => e.id === id)),
    });
  };

  /** Nombres de las plantas y empresas del reporte que ya no están en el catálogo activo. */
  const inactivasDe = (r: ReporteAnterior): string[] => [
    ...r.plantaIds.flatMap((id, i) => (plantas.some((p) => p.id === id) ? [] : [r.plantas[i][0]])),
    ...r.empresaIds.flatMap((id, i) => (empresasExternas.some((e) => e.id === id) ? [] : [r.empresas[i]])),
  ];

  /** Arma el PATCH con los bloques editados y lo manda por la cola. */
  const guardarEdicion = (r: ReporteAnterior, b: BorradorReporte) => {
    const n = (v: string) => enteroOCero(v);
    const body: EditReporteDiarioBody = {
      produccion: SECCIONES.map((seccion, i) => ({
        seccion,
        camiones: n(b.secciones[i].camiones),
        vueltasPorCamion: n(b.secciones[i].vueltas),
      })),
      tolvas: b.tolvas.map((v, i) => ({ tolva: i + 1, cargas: n(v) })),
      plantas: Object.entries(b.plantas)
        .map(([plantaId, producto]) => ({ plantaId, producto: producto.trim() }))
        .filter((p) => p.producto !== ''),
      traspasos: b.traspasos.map((v, i) => ({ tipo: r.traspasoTipos[i], cantidad: n(v) })),
      empresaIds: b.empresas,
      personal: r.personal
        .map(([rol], i) => ({ rol, nombre: b.personal[i].trim() }))
        .filter((p) => p.nombre !== ''),
    };
    editarReporte.mutate(
      { id: r.id, body },
      {
        onSuccess: (result) => {
          setEdicion(null);
          setAvisoGuardado(result.status === 'unchanged' ? null : result.status);
        },
      },
    );
  };

  const [personal, setPersonal] = useState(PERSONAL_VACIO);
  /** plantaId → producto escrito; vacío si no operó en el turno. */
  const [productos, setProductos] = useState<Record<string, string>>({});
  const [traspasos, setTraspasos] = useState(TRASPASOS_VACIO);
  /** empresaId → trabajó en el turno. */
  const [empresas, setEmpresas] = useState<Record<string, boolean>>({});
  const [prod, setProd] = useState(PROD_VACIO);

  const secciones = useMemo(() => seccionesDelFormulario(prod), [prod]);

  const crear = useCreateReporteDiario();
  /** El turno vigente ya tiene reporte en el historial de la semana. */
  const yaReportado = (reportes ?? []).some(
    (r) => r.fecha.slice(0, 10) === hasta && r.turno === ctx.turno,
  );
  const hayErrorDeEntero = [
    ...Object.values(prod),
    ...Object.values(traspasos),
  ].some((v) => errorDeEntero(v));

  /**
   * Arma el reporte desde el formulario y lo manda por la cola. Un 409 (el
   * turno ya fue reportado) lo muestra el hook como aviso con el mensaje del
   * backend.
   */
  const enviar = () => {
    const n = (v: string) => enteroOCero(v);
    const input: CreateReporteDiarioInput = {
      fecha: toDateOnly(ctx.fecha),
      turno: ctx.turno,
      produccion: SECCIONES_CAMIONES.map((s, i) => ({
        seccion: SECCIONES[i],
        camiones: n(prod[s.camiones]),
        vueltasPorCamion: n(prod[s.vueltas]),
      })),
      tolvas: TOLVAS.map((t, i) => ({ tolva: i + 1, cargas: n(prod[t.clave]) })),
      plantas: plantas
        .map((p) => ({ plantaId: p.id, producto: (productos[p.id] ?? '').trim() }))
        .filter((p) => p.producto !== ''),
      traspasos: TRASPASOS.map((t) => ({ tipo: TRASPASO_TIPO[t.clave], cantidad: n(traspasos[t.clave]) })),
      empresaIds: empresasExternas.filter((e) => empresas[e.id]).map((e) => e.id),
      personal: PERSONAL.map(([clave, rol]) => ({ rol, nombre: personal[clave].trim() })).filter(
        (p) => p.nombre !== '',
      ),
    };
    crear.mutate(input, {
      onSuccess: (result) => {
        // Enviado o en cola, el formulario vuelve a blanco: el turno ya quedó
        // registrado (ver `yaReportado`) y no se debe poder reenviar.
        if (result.status === 'unchanged') return;
        setPersonal(PERSONAL_VACIO);
        setProductos({});
        setTraspasos(TRASPASOS_VACIO);
        setEmpresas({});
        setProd(PROD_VACIO);
      },
    });
  };

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
            {PERSONAL.map(([clave, label]) => (
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
              {operadoresDelTurno.map((o) => (
                <span key={o.id} className="inline-flex items-center gap-2 rounded-xl bg-muted px-2.5 py-1.5 text-sm font-medium">
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
          {plantas.map((planta) => (
            <div key={planta.id} className="grid grid-cols-[132px_1fr] items-center gap-2.5">
              <span className="tabular text-sm leading-tight font-semibold">{planta.nombre}</span>
              <Input
                aria-label={`Producto de ${planta.nombre}`}
                value={productos[planta.id] ?? ''}
                placeholder="Sin operación en el turno"
                className="!h-12 !text-[15px]"
                onChange={(e) =>
                  setProductos((p) => ({ ...p, [planta.id]: e.target.value }))
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
                entero
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
          {empresasExternas.map((e) => (
            <ChipSeleccion key={e.id} activo={!!empresas[e.id]} onToggle={() => setEmpresas((v) => ({ ...v, [e.id]: !v[e.id] }))}>
              {e.nombre}
            </ChipSeleccion>
          ))}
        </div>
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
                  <Campo label="Cantidad de camiones" error={errorDeEntero(prod[seccion.camiones])}>
                    <Input
                      entero
                      value={prod[seccion.camiones]}
                      className="!pr-3.5"
                      onChange={(e) =>
                        setProd((p) => ({ ...p, [seccion.camiones]: e.target.value }))
                      }
                    />
                  </Campo>
                  <Campo label="Vueltas por camión" error={errorDeEntero(prod[seccion.vueltas])}>
                    <Input
                      entero
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
              tarifa, y una suma no correspondería a ninguna. */}
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
                <Campo key={tolva.clave} label={tolva.label} error={errorDeEntero(prod[tolva.clave])}>
                  <Input
                    entero
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

      <Boton ancho disabled={crear.isPending || hayErrorDeEntero || yaReportado} onClick={enviar}>
        Enviar reporte diario <ArrowRight className="h-[19px] w-[19px]" />
      </Boton>
      {yaReportado && (
        <Hint>
          <span className="block text-center font-semibold">
            El turno {ctx.turno} de hoy ya fue reportado
          </span>
        </Hint>
      )}
      <Hint>
        <span className="block text-center">
          Llegará al administrador y a Sergio Torres. Sin señal queda guardado en el equipo y se envía solo.
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
        {anteriores.map((r) => {
          return (
            <tr key={r.id}>
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
                  onClick={() => abrirDetalle(r.id)}
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
      {anteriores.map((r) => {
        return (
          <Tarjeta key={r.id}>
            <div className="flex items-center justify-between gap-2">
              <b>
                {diaMes(r.fecha)} · {r.turno}
              </b>
              <Chip tono="success">Enviado</Chip>
            </div>
            <span className="text-[13px] text-muted-foreground">{r.supervisor}</span>
            <Cifras items={cifrasPorTipo(r.secciones)} />
            <Boton variante="contorno" ancho onClick={() => abrirDetalle(r.id)}>
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
   * Corregir un reporte ya enviado: los mismos bloques del formulario
   * del turno, con lo que se envió, y el aviso al administrador arriba.
   */
  const hayErrorEnEdicion =
    edicion != null &&
    [...edicion.secciones.flatMap((s) => [s.camiones, s.vueltas]), ...edicion.tolvas, ...edicion.traspasos].some((v) =>
      errorDeEntero(v),
    );

  const vistaEdicion = detalle && edicion && (
    <div className="flex flex-col gap-4">
      <AvisoEdicion />
      {inactivasDe(detalle).map((nombre) => (
        <Hint key={nombre}>{nombre} ya no está activa y se quitará al guardar.</Hint>
      ))}

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
                <Campo
                  key={campo}
                  label={campo === 'camiones' ? 'Cantidad de camiones' : 'Vueltas por camión'}
                  error={errorDeEntero(edicion.secciones[i][campo])}
                >
                  <Input
                    entero
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
            <Campo key={i} label={`Tolva ${i + 1}`} error={errorDeEntero(v)}>
              <Input
                entero
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
        {plantas.map(({ id, nombre: p }) => (
          <div key={id} className="grid grid-cols-[132px_1fr] items-center gap-2.5">
            <span className="tabular text-sm leading-tight font-semibold">{p}</span>
            <Input
              aria-label={`Producto de ${p}`}
              className="!h-12 !text-[15px]"
              placeholder="Sin operación en el turno"
              value={edicion.plantas[id] ?? ''}
              onChange={(ev) => editar((b) => ({ ...b, plantas: { ...b.plantas, [id]: ev.target.value } }))}
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
                entero
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
          {empresasExternas.map(({ id, nombre: e }) => (
            <ChipSeleccion
              key={id}
              activo={edicion.empresas.includes(id)}
              onToggle={() =>
                editar((b) => ({
                  ...b,
                  empresas: b.empresas.includes(id) ? b.empresas.filter((x) => x !== id) : [...b.empresas, id],
                }))
              }
            >
              {e}
            </ChipSeleccion>
          ))}
        </div>
      </div>

      <Boton
        ancho
        disabled={editarReporte.isPending || hayErrorEnEdicion}
        onClick={() => guardarEdicion(detalle, edicion)}
      >
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
        <Boton variante="contorno" disabled={!catalogosListos} onClick={() => abrirEdicion(detalle)}>
          <Pencil className="h-[17px] w-[17px]" /> Editar
        </Boton>
      </div>
      {avisoGuardado && (
        <p className="m-0 flex items-center gap-2 rounded-2xl bg-[var(--success-soft)] px-3 py-2.5 text-[13px] font-semibold text-[var(--success-soft-foreground)]">
          <Check className="h-4 w-4 shrink-0" />{' '}
          {avisoGuardado === 'sent'
            ? 'Cambio guardado. Se avisó al administrador.'
            : 'Cambio guardado en el equipo; se enviará al recuperar señal.'}
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

      <HistorialCambios entradas={cambios ?? []} cargando={cargandoCambios} />
    </div>
  );

  return (
    <>
      <VistaHead
        titulo="Reporte diario del supervisor"
        /* Faena y turno viven en la cabecera de la ficha: repetirlos acá los
           mostraba dos veces en la misma pantalla. */
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
