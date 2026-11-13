import { useMemo, useState } from 'react';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { opcionesOperador } from '../lib/operadores-habituales';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowRight, ChevronRight, History, Lock, Pencil, Plus, X } from 'lucide-react';

import {
  trabajoExtraCorreccionSchema,
  trabajoExtraFormSchema,
  ACTIVIDAD_DE_PLANTA,
  ACTIVIDADES,
  DESCRIPCION_ACTIVIDAD_MAX,
  TIPOS_ELEGIBLES,
  actividadLabel,
  destinoLabel,
  AYUDA_PLANTAS_SILOS,
  opcionesPlantasSilos,
  plantasDeFila,
  tipoAlCambiarActividad,
  type TrabajoExtraForm,
  type TrabajoExtraFormInput,
} from '../types/trabajosExtra';
import { useTurnoActual } from '../hooks/useTurnoActual';
import { usePhotoCaptureFlow } from '../lib/usePhotoCaptureFlow';
import { FotoRespaldoField } from '../components/flota/FotoRespaldoField';
import {
  COBRO_MINIMO_HORAS,
  actividadDeFila,
  cobraMinimo,
  horasCobrables,
  horasDelDetalle,
  lugarDeFila,
  numeroReport,
  pistaFolio,
  textoPistaFolio,
} from '../lib/trabajos-extra';
import {
  useRegistrarTrabajoExtra,
  useEditarTrabajoExtra,
  useCambiosTrabajoExtra,
} from '../hooks/useTrabajosExtra';
import { useTrabajosExtraProjection, type TrabajoExtraProyectado } from '../hooks/useTrabajosExtraProjection';
import { useEquipment } from '../hooks/useEquipment';
import { useOperators } from '../hooks/useOperators';
import type { Operator } from '../types/operator';
import { DESKTOP_QUERY, useMediaQuery } from '../hooks/useMediaQuery';
import { formatDecimalInput } from '../lib/decimal';
import { leerNumero } from '../lib/forms';
import { fmtDate, fmtNum } from '../lib/format';
import { toDateOnly } from '../lib/turno';
import { DateField } from '../components/terreno/DateField';
import { MarcaSinSincronizar } from '../components/terreno/MarcaSinSincronizar';
import {
  AvisoEdicion,
  Automatico,
  Automaticos,
  Boton,
  Calculado,
  Campo,
  Card,
  CardHead,
  Chip,
  ChipSeleccion,
  ChipContexto,
  Cifras,
  Filas,
  Form,
  GrupoHead,
  HistorialCambios,
  Hint,
  Input,
  Label,
  ModalTerreno,
  Segmentado,
  Selector,
  Tabla,
  Tarjeta,
  Textarea,
  TD,
  TH,
  VistaHead,
  VistaUnica,
  type OpcionSelector,
} from '../components/terreno/ui';

interface OperadorEnTurno {
  nombre: string;
  /** `null` cuando el turno es previo al catálogo de operadores. */
  operatorId: string | null;
}

const TURNOS = [
  { valor: 'DIURNO' as const, label: 'DIURNO', sub: '08–20' },
  { valor: 'NOCTURNO' as const, label: 'NOCTURNO', sub: '20–08' },
];

/**
 * Sima opera dos faenas y solo dos. Antes esto era un campo de texto libre con
 * placeholder «Ej: Rajo Norte», que producía «Patillo», «patillo» y «PAT» como
 * tres lugares distintos para la base de datos.
 *
 * Es provisorio: la faena pasará a ser una `Branch` de tipo `SITE`, así
 * que cuando exista `branchId` esta lista sale del servidor y deja de estar
 * escrita acá.
 */
/**
 * Cómo se lee un trabajo en el historial. «Otro» se muestra con su texto y no
 * con la etiqueta genérica, que no le diría nada a quien revisa para cobrar.
 */
function etiquetaActividades(r: { actividades: string[]; otraActividad: string | null }): string {
  return r.actividades
    .map((a) => (a === 'OTRO' && r.otraActividad ? r.otraActividad : (actividadLabel[a] ?? a)))
    .join(', ');
}

/** Un registro guardado solo en el equipo todavía no existe en el servidor: no hay qué editar. */
const MOTIVO_SIN_SINCRONIZAR = 'Se puede editar cuando termine de sincronizarse.';
/** Un cambio anterior del mismo trabajo espera una acción: encadenar otro encima lo dejaría trabado. */
const MOTIVO_EDICION_ATENCION = 'Resuelve el cambio pendiente en Sincronización antes de editar de nuevo.';

/** Por qué un equipo no se puede elegir, según su estado en Flota. */
const ESTADO_NO_DISPONIBLE: Record<string, string> = {
  IN_WORKSHOP: 'En taller',
  OUT_OF_SERVICE: 'Fuera de servicio',
};

const FAENAS = [
  { valor: 'Patillo', label: 'Patillo' },
  { valor: 'Kainita', label: 'Kainita' },
];

/**
 * Una fila del desglose mientras se escribe: los campos parten vacíos, cosa
 * que el schema no admite — por eso el tipo propio y los `as` al leer/escribir
 * el formulario. Validar valida la forma final, no la intermedia.
 */
interface FilaDetalleInput {
  actividad: string;
  lugar: string;
  plantas?: string[];
  /** Texto tal como se escribe (`1,5`): el schema lo lee con `leerNumero`. */
  horas?: string | number;
  /** Qué se hizo en esta actividad (p. ej. en qué silo o planta). */
  descripcion?: string;
}

/** Número de un campo de texto (`12,5`, `12.5`); vacío o ilegible → `NaN`. */
const numeroEscrito = (v: unknown): number => {
  const n = leerNumero(v);
  return typeof n === 'number' ? n : Number.NaN;
};

const filaVacia = (): FilaDetalleInput => ({ actividad: '', lugar: '', plantas: [], horas: undefined, descripcion: '' });

export function TrabajosExtraView() {
  const esEscritorio = useMediaQuery(DESKTOP_QUERY);
  const { data: equipos = [] } = useEquipment();
  const { registros } = useTrabajosExtraProjection();
  // Mismo catálogo (solo activos) que `RegistroEquipoView`/`OperatorPicker`.
  const { data: operadores = [] } = useOperators({ isActive: true });
  const { registrar, isGuardando } = useRegistrarTrabajoExtra();
  const [historialAbierto, setHistorialAbierto] = useState(false);
  const [detalleId, setDetalleId] = useState<string | null>(null);
  /** Modo edición del trabajo abierto en el detalle. */
  const [editando, setEditando] = useState(false);
  const { guardar: guardarCambio, isGuardando: isActualizando } = useEditarTrabajoExtra();
  // Se lee de la lista y no de una copia: tras editar, la lista se refresca
  // y el detalle muestra el dato nuevo sin tener que volver a abrirlo. Un
  // trabajo pendiente de sincronizar solo existe en el equipo: no tiene
  // historial de cambios en el servidor ni se puede editar todavía.
  const detalle = registros.find((r) => r.id === detalleId) ?? null;
  const cambios = useCambiosTrabajoExtra(detalle?.sinSincronizar ? null : detalleId);
  const motivoSinEdicion = detalle?.sinSincronizar
    ? MOTIVO_SIN_SINCRONIZAR
    : detalle?.edicionRequiereAtencion
      ? MOTIVO_EDICION_ATENCION
      : undefined;

  /**
   * El turno arranca en el vigente de Terreno (`useTurnoActual`: el mismo que
   * muestra Registro de equipo, con su adelanto al turno siguiente), no siempre
   * en DIURNO. Sigue siendo editable, porque un trabajo se puede cargar después
   * de terminado.
   */
  const turnoActual = useTurnoActual();
  const vacio = (): Partial<TrabajoExtraFormInput> => ({
    equipoId: '',
    operatorId: '',
    faena: 'Patillo',
    turno: turnoActual.turno,
    detalle: [filaVacia()] as unknown as TrabajoExtraFormInput['detalle'],
    otraActividad: '',
    fecha: toDateOnly(new Date()),
    reportNumero: '',
  });

  // La foto del report es OBLIGATORIA: viaja como blob junto a la operación
  // y se sube en el replay — igual que la foto de un hallazgo.
  const foto = usePhotoCaptureFlow(() => {}, { ocr: false });

  /**
   * Equipos **en terreno**: los que tienen un turno en curso, con el operador
   * que lo lleva. «Turno en curso» es `equipo.openShift`: la lectura de
   * horómetro sin `valorFinal`, la misma definición que usa el backend.
   *
   * Un equipo en turno se puede elegir: el trabajo extra se registra al final
   * del turno y usa la misma máquina, que tiene tiempos en ralentí. El turno
   * abierto queda como **aviso** —para no tener que coordinarlo por
   * radio—, no como bloqueo.
   */
  const enTurno = useMemo(
    () =>
      new Map<string, OperadorEnTurno>(
        equipos
          .filter((e) => e.openShift != null)
          .map((e) => [e.id, { nombre: e.openShift!.operador, operatorId: e.openShift!.operatorId }]),
      ),
    [equipos],
  );

  /**
   * El selector separa los equipos en terreno de los disponibles. Los que
   * están en taller o fuera de servicio quedan al final, a la vista pero sin
   * poder elegirse, para que no parezca que desaparecieron.
   *
   * Solo equipos pesados: son los que hacen los trabajos del Report (cliente,
   * 13-11). Al corregir un report viejo hecho con otro equipo, ese se mantiene.
   */
  const equipoEditado = detalle?.equipoId;
  const opcionesEquipo = useMemo((): OpcionSelector[] => {
    const opcion = (e: (typeof equipos)[number]): OpcionSelector => {
      const operador = enTurno.get(e.id);
      if (operador != null) {
        return { valor: e.id, titulo: e.internalCode, detalle: e.type, grupo: 'En terreno', aviso: `En turno · ${operador.nombre}` };
      }
      if (e.status && e.status !== 'OPERATIONAL') {
        return { valor: e.id, titulo: e.internalCode, detalle: e.type, grupo: 'No disponibles', motivo: ESTADO_NO_DISPONIBLE[e.status] ?? 'No operativo' };
      }
      return { valor: e.id, titulo: e.internalCode, detalle: e.type, grupo: 'Disponibles' };
    };
    const orden = ['En terreno', 'Disponibles', 'No disponibles'];
    return equipos
      .filter((e) => e.equipmentClass !== 'LIGHT' || e.id === equipoEditado)
      .map(opcion)
      .sort((a, b) => orden.indexOf(a.grupo!) - orden.indexOf(b.grupo!));
  }, [equipos, enTurno, equipoEditado]);

  /**
   * Al registrar, el formulario se vuelve a montar en blanco (`key` nueva) en
   * vez de resetear campo por campo: así vuelve también el turno según la
   * hora, y no queda nada del trabajo anterior.
   */
  const [formKey, setFormKey] = useState(0);

  const formulario = (
    <Card>
      <CardHead
        titulo="Nuevo report"
        bajada="Horas y respaldo del trabajo fuera de la operación habitual."
      />
      <FormularioTrabajo
        key={formKey}
        inicial={vacio()}
        folios={registros}
        equipos={equipos}
        operadores={operadores}
        enTurno={enTurno}
        opcionesEquipo={opcionesEquipo}
        foto={foto}
        textoBoton="Registrar trabajo"
        pendiente={isGuardando}
        onGuardar={async (values) => {
          // El formulario ya garantizó la foto (es obligatoria). Siempre por
          // el outbox (con o sin señal): el formulario vuelve a blanco solo
          // si el trabajo quedó guardado en el equipo.
          if (!foto.file) return;
          if (await registrar(values, foto.file)) {
            foto.resetPhoto();
            setFormKey((k) => k + 1);
          }
        }}
      />
    </Card>
  );

  const codigo = (r: TrabajoExtraProyectado) => r.equipo?.internalCode ?? r.equipoId;

  const lista =
    registros.length === 0 ? (
      <p className="m-0 rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
        Todavía no hay trabajos registrados.
      </p>
    ) : esEscritorio ? (
      <Tabla titulo="Trabajos registrados" detalle={`Patillo y Kainita · ${registros.length} registros`}>
        <thead>
          <tr>
            <th className={TH}>Correlativo</th>
            <th className={TH}>Fecha</th>
            <th className={TH}>Faena</th>
            <th className={TH}>Equipo</th>
            <th className={TH}>Operador</th>
            <th className={`${TH} text-right`}>Horas</th>
            <th className={TH}>
              <span className="sr-only">Detalle</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {registros.map((r) => (
            <tr key={r.id}>
              <td className={`${TD} tabular font-semibold whitespace-nowrap`}>{r.numero ?? '—'}</td>
              <td className={`${TD} tabular whitespace-nowrap`}>
                {fmtDate(r.fecha)}
                <div className="text-[12.5px] text-muted-foreground">{r.turno}</div>
              </td>
              <td className={`${TD} whitespace-nowrap`}>{r.faena}</td>
              <td className={TD}>
                <b className="tabular block text-[15px] font-semibold">{codigo(r)}</b>
              </td>
              <td className={`${TD} whitespace-nowrap`}>
                {r.operador}
                {r.sinSincronizar && <MarcaSinSincronizar requiereAtencion={r.requiereAtencion} />}
                {r.edicionSinSincronizar && <MarcaSinSincronizar edicion requiereAtencion={r.edicionRequiereAtencion} />}
              </td>
              <td className={`${TD} tabular text-right font-semibold whitespace-nowrap`}>
                {fmtNum(horasCobrables(r.totalHoras))} h
                {cobraMinimo(r.totalHoras) && (
                  <div className="text-[12px] font-normal text-muted-foreground">real {fmtNum(r.totalHoras)} h</div>
                )}
              </td>
              <td className={`${TD} text-right`}>
                <button
                  type="button"
                  onClick={() => setDetalleId(r.id)}
                  className="inline-flex min-h-[38px] cursor-pointer items-center gap-1 rounded-xl bg-[var(--accent-soft)] px-2.5 text-[12.5px] font-semibold whitespace-nowrap text-[var(--accent-soft-foreground)]"
                >
                  Ver detalle <ChevronRight className="h-4 w-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </Tabla>
    ) : (
      <div className="flex flex-col gap-3">
        {registros.map((r) => (
          <Tarjeta key={r.id}>
            <div className="flex items-start justify-between gap-2.5">
              <div className="min-w-0">
                <div className="tabular text-[12.5px] font-semibold text-muted-foreground">{numeroReport(r.numero)}</div>
                <div className="tabular text-[19px] font-semibold tracking-[-0.01em]">{codigo(r)}</div>
                <div className="truncate text-[13px] text-muted-foreground">{r.operador}</div>
              </div>
              <Chip tono="neutral">{r.faena}</Chip>
            </div>
            <Chip tono="info">{etiquetaActividades(r)}</Chip>
            {r.sinSincronizar && <MarcaSinSincronizar requiereAtencion={r.requiereAtencion} />}
                {r.edicionSinSincronizar && <MarcaSinSincronizar edicion requiereAtencion={r.edicionRequiereAtencion} />}
            <div className="tabular flex flex-wrap items-center justify-between gap-2 text-[13px] text-muted-foreground">
              <span>
                {fmtDate(r.fecha)} · {r.turno}
              </span>
              <span className="font-semibold text-foreground">
                {fmtNum(horasCobrables(r.totalHoras))} h
                {cobraMinimo(r.totalHoras) && (
                  <span className="font-normal text-muted-foreground"> · real {fmtNum(r.totalHoras)} h</span>
                )}
              </span>
            </div>
            <Boton variante="contorno" ancho onClick={() => setDetalleId(r.id)}>
              Ver detalle <ChevronRight className="h-[18px] w-[18px]" />
            </Boton>
          </Tarjeta>
        ))}
      </div>
    );

  /**
   * Editar un trabajo ya registrado: el mismo formulario
   * del alta, con los datos guardados y el aviso de que el administrador se
   * entera. Vive en la misma ventana que el detalle, como lista y detalle.
   */
  const vistaEdicion = detalle && editando && (
    <div className="flex flex-col gap-4">
      <AvisoEdicion />
      <FormularioTrabajo
        inicial={{
          equipoId: detalle.equipoId,
          operatorId: detalle.operatorId ?? '',
          faena: detalle.faena,
          turno: detalle.turno === 'NOCTURNO' ? 'NOCTURNO' : 'DIURNO',
          horometroInicial: formatDecimalInput(detalle.horometroInicial),
          horometroFinal: formatDecimalInput(detalle.horometroFinal),
          // El desglose guardado; en un registro LEGACY (previo al desglose)
          // se parte de sus actividades y se completan lugar y horas acá.
          detalle: (detalle.detalleActividades?.length
            ? detalle.detalleActividades.map((f) => ({
                actividad: f.actividad,
                // Una limpieza de silos guardada con otro tipo se corrige acá.
                lugar: f.actividad === ACTIVIDAD_DE_PLANTA ? 'PLANTA' : f.lugar,
                plantas: plantasDeFila(f),
                horas: formatDecimalInput(f.horas),
                descripcion: f.descripcion ?? '',
              }))
            : detalle.actividades.map((a) => ({ ...filaVacia(), actividad: a, lugar: tipoAlCambiarActividad(a, '') }))) as unknown as TrabajoExtraFormInput['detalle'],
          otraActividad: detalle.otraActividad ?? '',
          descripcion: detalle.descripcion,
          observaciones: detalle.observaciones ?? '',
          reportNumero: detalle.reportNumero ?? '',
        }}
        equipos={equipos}
        operadores={operadores}
        enTurno={enTurno}
        opcionesEquipo={opcionesEquipo}
        textoBoton="Guardar cambios"
        numero={detalle.numero}
        folios={registros}
        idEditado={detalle.id}
        pendiente={isActualizando}
        onGuardar={async (payload) => {
          if (await guardarCambio(detalle, payload)) setEditando(false);
        }}
        onCancelar={() => setEditando(false)}
      />
    </div>
  );

  const vistaDetalle = detalle && (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Boton variante="contorno" onClick={() => setDetalleId(null)}>
          <ArrowLeft className="h-[18px] w-[18px]" /> Volver al historial
        </Boton>
        <Boton
          variante="contorno"
          disabled={motivoSinEdicion != null}
          title={motivoSinEdicion}
          onClick={() => setEditando(true)}
        >
          <Pencil className="h-[17px] w-[17px]" /> Editar
        </Boton>
      </div>
      {detalle.sinSincronizar && (
        <>
          <MarcaSinSincronizar requiereAtencion={detalle.requiereAtencion} />
          <Hint>{MOTIVO_SIN_SINCRONIZAR}</Hint>
        </>
      )}
      {detalle.edicionSinSincronizar && (
        <MarcaSinSincronizar edicion requiereAtencion={detalle.edicionRequiereAtencion} />
      )}
      {detalle.edicionRequiereAtencion && <Hint>{MOTIVO_EDICION_ATENCION}</Hint>}

      <Cifras
        items={[
          { label: 'Horóm. inicial', valor: fmtNum(detalle.horometroInicial) },
          { label: 'Horóm. final', valor: fmtNum(detalle.horometroFinal) },
          { label: 'Horas reales', valor: `${fmtNum(detalle.totalHoras)} h` },
          { label: 'A cobrar', valor: `${fmtNum(horasCobrables(detalle.totalHoras))} h`, destacado: true },
        ]}
      />
      {cobraMinimo(detalle.totalHoras) && (
        <Hint>Duró menos de {COBRO_MINIMO_HORAS} h: se cobra el mínimo de {COBRO_MINIMO_HORAS} h máquina.</Hint>
      )}

      <div className="flex flex-col gap-1.5">
        <GrupoHead titulo="Trabajo" />
        <Filas
          filas={[
            ['Correlativo', numeroReport(detalle.numero)],
            ['Fecha', fmtDate(detalle.fecha)],
            ['Turno', detalle.turno],
            ['Faena', detalle.faena],
            ['Equipo', codigo(detalle)],
            ['Operador', detalle.operador],
            ['Report N°', detalle.reportNumero || '—'],
          ]}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <GrupoHead titulo="Actividades" />
        {detalle.detalleActividades?.length ? (
          // El desglose: qué se hizo, dónde y cuántas horas máquina cada una.
          <div className="flex flex-col overflow-hidden rounded-2xl border border-border">
            {detalle.detalleActividades.map((f, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-2.5 border-t border-border bg-card px-3 py-2.5 first:border-t-0"
              >
                <div className="min-w-0">
                  <div className="text-[14.5px] font-semibold">{actividadDeFila(f, detalle.otraActividad)}</div>
                  <div className="text-[12.5px] text-muted-foreground">{lugarDeFila(f)}</div>
                  {f.descripcion && <div className="mt-0.5 text-[13px] leading-snug">{f.descripcion}</div>}
                </div>
                <span className="tabular shrink-0 text-[14.5px] font-semibold">{fmtNum(f.horas)} h</span>
              </div>
            ))}
          </div>
        ) : (
          // Registro anterior al desglose: solo la lista de actividades.
          <div className="flex flex-wrap gap-1.5">
            {etiquetaActividades(detalle)
              .split(', ')
              .map((a) => (
                <ChipContexto key={a}>{a}</ChipContexto>
              ))}
          </div>
        )}
      </div>

      {(
        [
          ['Descripción de la tarea', detalle.descripcion, 'Sin descripción.'],
          ['Observaciones', detalle.observaciones, 'Sin observaciones.'],
        ] as const
      ).map(([titulo, texto, vacio]) => (
        <div key={titulo} className="flex flex-col gap-1.5">
          <GrupoHead titulo={titulo} />
          <p className="m-0 rounded-2xl border border-border bg-[#fafbfc] px-3 py-2.5 text-[14.5px] whitespace-pre-line">
            {texto?.trim() || <span className="text-muted-foreground">{vacio}</span>}
          </p>
        </div>
      ))}

      {detalle.fotoUrl && (
        <div className="flex flex-col gap-1.5">
          <GrupoHead titulo="Foto del report" />
          <a
            className="text-sm font-medium text-(--accent) hover:underline"
            href={detalle.fotoUrl}
            rel="noreferrer"
            target="_blank"
          >
            Ver foto del report
          </a>
        </div>
      )}

      <HistorialCambios entradas={cambios.data ?? []} cargando={cambios.isLoading} />
    </div>
  );

  return (
    <>
      <VistaHead
        titulo="Report"
        contexto={<ChipContexto>Respalda cobros posteriores</ChipContexto>}
      />

      {/* Mismo esquema que Reporte diario: el formulario solo, y lo ya
          registrado en una ventana que se abre a pedido. */}
      <VistaUnica>
        <Boton
          variante="contorno"
          ancho
          onClick={() => {
            setDetalleId(null);
            setHistorialAbierto(true);
          }}
        >
          <History className="h-[19px] w-[19px]" /> Ver historial de trabajos
          <span className="tabular font-medium text-muted-foreground">· {registros.length}</span>
        </Boton>
        {formulario}
      </VistaUnica>

      <ModalTerreno
        abierto={historialAbierto}
        onAbiertoChange={(abierto) => {
          setHistorialAbierto(abierto);
          if (!abierto) {
            setDetalleId(null);
            setEditando(false);
          }
        }}
        titulo={
          detalle
            ? `${editando ? 'Editar · ' : ''}${numeroReport(detalle.numero)} · ${codigo(detalle)} · ${fmtDate(detalle.fecha)}`
            : 'Historial de trabajos'
        }
        detalle={
          detalle
            ? `${detalle.faena} · turno ${detalle.turno} · ${detalle.operador}`
            : `Patillo y Kainita · ${registros.length} ${registros.length === 1 ? 'registro' : 'registros'}`
        }
      >
        {vistaEdicion || vistaDetalle || lista}
      </ModalTerreno>
    </>
  );
}

/**
 * Los campos de un trabajo extraordinario, para registrarlo y para editarlo
 * Es el mismo formulario en los dos casos a propósito:
 * corregir un dato no tiene por qué verse distinto de cargarlo, y las reglas
 * —horómetros, «Otro» con texto, cobro mínimo— no pueden quedar aplicadas en
 * uno y en el otro no.
 */
function FormularioTrabajo({
  inicial,
  equipos,
  operadores,
  enTurno,
  opcionesEquipo,
  foto,
  textoBoton,
  pendiente,
  onGuardar,
  onCancelar,
  numero,
  folios,
  idEditado,
}: {
  inicial: Partial<TrabajoExtraFormInput>;
  /** Los Reports ya registrados: de ahí sale el último folio y si el escrito se repite. */
  folios: readonly { id: string; reportNumero?: string | null }[];
  /** Al corregir, el Report que se edita (su folio no cuenta como repetido). */
  idEditado?: string;
  /** El correlativo al corregir; sin él (alta), se asigna al guardar. */
  numero?: number | null;
  equipos: { id: string; internalCode: string }[];
  /** Catálogo de operadores activos: el operador se elige, no se escribe. */
  operadores: Pick<Operator, 'id' | 'name'>[];
  /** Equipos con turno abierto → operador que lo lleva. */
  enTurno: Map<string, OperadorEnTurno>;
  opcionesEquipo: OpcionSelector[];
  /** Captura de la foto del report — OBLIGATORIA al registrar; ausente al
   * editar (la foto no se cambia desde la edición). */
  foto?: ReturnType<typeof usePhotoCaptureFlow>;
  textoBoton: string;
  pendiente: boolean;
  onGuardar: (values: TrabajoExtraForm) => void | Promise<void>;
  onCancelar?: () => void;
}) {
  // «Tus operadores» primero: los que salen habitualmente con este supervisor.
  const supervisorId = useCurrentUser().user?.id;
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitted },
  } = useForm<TrabajoExtraFormInput, unknown, TrabajoExtraForm>({
    // Al corregir, una actividad anterior a la descripción puede quedar sin ella.
    resolver: zodResolver(idEditado ? trabajoExtraCorreccionSchema : trabajoExtraFormSchema),
    defaultValues: inicial,
  });
  /** La foto no vive en el schema (es un `File`): se exige a mano al enviar. */
  const [fotoFaltante, setFotoFaltante] = useState(false);

  const turno = (watch('turno') as TrabajoExtraForm['turno']) ?? 'DIURNO';
  const faena = watch('faena') || 'Patillo';
  const reportNumero = (watch('reportNumero') as string | undefined) ?? '';
  const pista = pistaFolio(folios, reportNumero, idEditado);
  /** Las filas del desglose, con los vacíos intermedios que el schema no admite. */
  const filas = (watch('detalle') ?? []) as unknown as FilaDetalleInput[];
  // Antes del primer intento de guardar no se valida al tipear: marcaría en
  // rojo las celdas de la fila que recién se está llenando.
  const ponerFilas = (nuevas: FilaDetalleInput[]) =>
    setValue('detalle', nuevas as unknown as TrabajoExtraFormInput['detalle'], { shouldValidate: isSubmitted });
  const cambiarFila = (i: number, cambios: Partial<FilaDetalleInput>) =>
    ponerFilas(filas.map((f, j) => (j === i ? { ...f, ...cambios } : f)));
  /** Errores por fila (`detalle.0.lugar`…) y el del arreglo (sin filas). */
  const erroresDetalle = errors.detalle as
    | (Array<Partial<Record<keyof FilaDetalleInput, { message?: string }>> | undefined> & { message?: string })
    | undefined;
  const ini = numeroEscrito(watch('horometroInicial'));
  const fin = numeroEscrito(watch('horometroFinal'));
  // Con inicial y final iguales el trabajo igual se cobra (el mínimo): por
  // eso `>=` y no `>`. Si falta uno de los dos, todavía no hay nada que calcular.
  const totalHoras =
    Number.isFinite(ini) && Number.isFinite(fin) && fin >= ini ? Number((fin - ini).toFixed(2)) : null;

  // Aviso (no bloquea, decisión del cliente): el desglose debería sumar lo
  // que marca el trabajo. Se compara contra las horas reales Y las cobrables
  // —con el mínimo de 1 h ambas son referencias legítimas— y solo cuando
  // todas las filas ya tienen horas, para no retar a quien va a mitad.
  const horasFilas = filas.map((f) => numeroEscrito(f.horas)).filter((h) => Number.isFinite(h) && h > 0);
  const sumaDetalle = horasDelDetalle(horasFilas.map((horas) => ({ horas })));
  const descuadre =
    totalHoras != null &&
    filas.length > 0 &&
    horasFilas.length === filas.length &&
    Math.abs(sumaDetalle - totalHoras) > 0.01 &&
    Math.abs(sumaDetalle - horasCobrables(totalHoras)) > 0.01;

  const equipoId = watch('equipoId') ?? '';
  const operadorEnTurno = enTurno.get(equipoId);
  const codigoElegido = equipos.find((e) => e.id === equipoId)?.internalCode;

  return (
    <form
      onSubmit={handleSubmit((values) => {
        // La foto del report es obligatoria al registrar (al editar no se
        // toca). Se chequea acá y no en el schema: un `File` no viaja en el
        // formulario validado.
        if (foto && !foto.file) {
          setFotoFaltante(true);
          return;
        }
        setFotoFaltante(false);
        return onGuardar(values);
      })}
    >
      <Form>
        <div className="grid grid-cols-2 gap-3">
          <Campo
            label="Equipo"
            hint={
              errors.equipoId?.message ??
              (operadorEnTurno != null
                ? `${codigoElegido} está en turno con ${operadorEnTurno.nombre}. Se registra igual: queda a nombre de esta máquina.`
                : undefined)
            }
          >
            <Selector
              etiqueta="Equipo"
              tituloTabular
              valor={equipoId}
              onChange={(id) => {
                setValue('equipoId', id, { shouldValidate: true });
                // Si el equipo está en turno, su operador es el candidato
                // obvio; se propone solo si el campo sigue vacío. Si el turno
                // no trae `operatorId` (dato previo al catálogo) no se propone
                // nada: se elige a mano.
                const enTurnoCon = enTurno.get(id);
                if (enTurnoCon?.operatorId && !watch('operatorId')) {
                  setValue('operatorId', enTurnoCon.operatorId, { shouldValidate: true });
                }
              }}
              opciones={opcionesEquipo}
            />
          </Campo>
          <Campo label="Operador" hint={errors.operatorId?.message}>
            <Selector
              etiqueta="Operador"
              placeholder="Elegí el operador"
              valor={watch('operatorId') ?? ''}
              onChange={(operatorId) => setValue('operatorId', operatorId, { shouldValidate: true })}
              opciones={opcionesOperador(operadores, supervisorId)}
            />
          </Campo>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Faena</Label>
          <Segmentado etiqueta="Faena" valor={faena} onChange={(v) => setValue('faena', v)} opciones={FAENAS} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Turno</Label>
          <Segmentado etiqueta="Turno" valor={turno} onChange={(v) => setValue('turno', v)} opciones={TURNOS} />
        </div>

        {/* Carga histórica: por defecto hoy; una fecha pasada registra el
            trabajo en ese día (misma ventana de 30 días del backend). */}
        <DateField
          label="Fecha del trabajo"
          value={(watch('fecha') as string | undefined) ?? toDateOnly(new Date())}
          onChange={(v) => setValue('fecha', v)}
          min={toDateOnly(
            new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() - 30),
          )}
          max={toDateOnly(new Date())}
        />

        {/* El folio del report en papel: con él se cruza este registro contra
            la planilla del cliente (y el Excel que exporta el admin). */}
        <Campo
          label="N° del report (boleta)"
          hint={
            errors.reportNumero?.message ??
            [
              'El número impreso en la boleta del report en papel.',
              textoPistaFolio(pista),
            ]
              .filter(Boolean)
              .join(' ')
          }
          aviso={pista.repetido ? `El N° ${reportNumero.trim()} ya está registrado en otro Report: revisa el folio.` : undefined}
        >
          <Input
            inputMode="numeric"
            placeholder={pista.siguiente ? `Ej: ${pista.siguiente}` : 'Ej: 4509'}
            {...register('reportNumero')}
          />
        </Campo>

        <div className="grid grid-cols-2 gap-3">
          <Campo label="Horómetro inicial" unidad="h" hint={errors.horometroInicial?.message}>
            <Input numerico placeholder="0" {...register('horometroInicial')} />
          </Campo>
          <Campo label="Horómetro final" unidad="h" hint={errors.horometroFinal?.message}>
            <Input numerico placeholder="0" {...register('horometroFinal')} />
          </Campo>
        </div>
        <Hint>Delimitan el trabajo, no el turno completo.</Hint>

        {/* Lo que se muestra es lo que se COBRA: el mínimo es una hora
            máquina. Las horas reales van en la nota cuando
            son menos, para que se vea por qué la cifra no calza con la
            resta de los horómetros. */}
        <Calculado
          label="Horas a cobrar"
          nota={
            <span className="flex items-center gap-1.5">
              <Lock className="h-[13px] w-[13px]" />
              {totalHoras != null && cobraMinimo(totalHoras)
                ? `Duró ${fmtNum(totalHoras)} h · mínimo ${COBRO_MINIMO_HORAS} h máquina`
                : `Calculado · mínimo ${COBRO_MINIMO_HORAS} h máquina`}
            </span>
          }
          valor={totalHoras != null ? `${fmtNum(horasCobrables(totalHoras))} h` : '—'}
        />

        {/*
          El desglose del report, UNA FILA POR ACTIVIDAD (planilla del
          cliente): qué se hizo, de qué tipo —define cómo se paga; la
          limpieza de silos es Planta sola y es la única—, cuántas horas
          máquina tomó y su descripción. Las horas son desglose: el cobro
          sigue saliendo de los horómetros, y un descuadre avisa sin bloquear.
        */}
        <div className="flex flex-col gap-2">
          <Label>Actividades del report</Label>
          <Hint>
            Tipo: Planta es la limpieza de silos (se asigna sola); Transporte, el resto de las tareas; Variado, lo
            circunstancial, como trabajos con otras empresas.
          </Hint>
          {filas.map((fila, i) => {
            const err = erroresDetalle?.[i];
            return (
              <div key={i} className="flex flex-col gap-2 rounded-2xl border border-border bg-[#fafbfc] p-2.5">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <Campo label={`Actividad ${i + 1}`} error={err?.actividad?.message}>
                      <Selector
                        etiqueta={`Actividad ${i + 1}`}
                        placeholder="Elegí la actividad"
                        valor={fila.actividad}
                        onChange={(v) => {
                          const lugar = tipoAlCambiarActividad(v, fila.lugar);
                          cambiarFila(i, { actividad: v, lugar, ...(lugar !== 'PLANTA' ? { plantas: [] } : {}) });
                        }}
                        opciones={ACTIVIDADES.map((a) => ({ valor: a.value, titulo: a.label }))}
                      />
                    </Campo>
                  </div>
                  {filas.length > 1 && (
                    <button
                      type="button"
                      aria-label={`Quitar la actividad ${i + 1}`}
                      onClick={() => ponerFilas(filas.filter((_, j) => j !== i))}
                      className="inline-flex h-[52px] w-11 shrink-0 cursor-pointer items-center justify-center rounded-2xl border-[1.5px] border-[var(--line2,#c3c9d1)] bg-card text-muted-foreground"
                    >
                      <X className="h-[18px] w-[18px]" aria-hidden />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_108px] gap-2">
                  {fila.actividad === ACTIVIDAD_DE_PLANTA ? (
                    // La limpieza de silos es siempre de tipo Planta: no se elige.
                    <Campo label="Tipo" error={err?.lugar?.message}>
                      <Input
                        readOnly
                        aria-label={`Tipo de la actividad ${i + 1}`}
                        value={`${destinoLabel.PLANTA} · automático`}
                      />
                    </Campo>
                  ) : (
                    <Campo label="Tipo" error={err?.lugar?.message}>
                      <Selector
                        etiqueta={`Tipo de la actividad ${i + 1}`}
                        placeholder="Elige el tipo"
                        valor={fila.lugar}
                        onChange={(v) => cambiarFila(i, { lugar: v, plantas: [] })}
                        opciones={TIPOS_ELEGIBLES.map((d) => ({ valor: d.value as string, titulo: d.label }))}
                      />
                    </Campo>
                  )}
                  <Campo label="HM" unidad="h" error={err?.horas?.message}>
                    <Input
                      numerico
                      aria-label={`Horas máquina de la actividad ${i + 1}`}
                      value={fila.horas ?? ''}
                      onChange={(e) =>
                        cambiarFila(i, { horas: e.target.value === '' ? undefined : e.target.value })
                      }
                    />
                  </Campo>
                </div>
                {fila.lugar === 'PLANTA' && (
                  // Una limpieza de silos puede abarcar varias plantas (PP1 y PP4):
                  // se marcan todas las que correspondan.
                  <div
                    role="group"
                    aria-label={`Plantas de la actividad ${i + 1}`}
                    className="flex flex-col gap-1.5"
                  >
                    <Label requerido>¿En qué plantas?</Label>
                    <div className="flex flex-wrap gap-2">
                      {opcionesPlantasSilos(fila.plantas ?? []).map(({ nombre, detalle }) => {
                        const elegidas = fila.plantas ?? [];
                        const activo = elegidas.includes(nombre);
                        return (
                          <ChipSeleccion
                            key={nombre}
                            activo={activo}
                            onToggle={() =>
                              cambiarFila(i, {
                                plantas: activo ? elegidas.filter((p) => p !== nombre) : [...elegidas, nombre],
                              })
                            }
                          >
                            <span className="flex flex-col items-start leading-tight">
                              <span>{nombre}</span>
                              {detalle && (
                                <span className="text-[11.5px] font-normal text-muted-foreground">{detalle}</span>
                              )}
                            </span>
                          </ChipSeleccion>
                        );
                      })}
                    </div>
                    <Hint>{err?.plantas?.message ?? AYUDA_PLANTAS_SILOS}</Hint>
                  </div>
                )}
                <Campo label="Descripción de la actividad" error={err?.descripcion?.message}>
                  <Textarea
                    rows={2}
                    maxLength={DESCRIPCION_ACTIVIDAD_MAX}
                    aria-label={`Descripción de la actividad ${i + 1}`}
                    placeholder={
                      fila.actividad === ACTIVIDAD_DE_PLANTA
                        ? 'Ej: silo 2, limpieza de fondo y paredes'
                        : 'Qué se hizo en esta actividad y dónde'
                    }
                    value={fila.descripcion ?? ''}
                    onChange={(e) => cambiarFila(i, { descripcion: e.target.value })}
                  />
                </Campo>
              </div>
            );
          })}
          <Boton variante="contorno" ancho type="button" onClick={() => ponerFilas([...filas, filaVacia()])}>
            <Plus className="h-[18px] w-[18px]" /> Agregar actividad
          </Boton>
          {erroresDetalle?.message && <Hint>{erroresDetalle.message}</Hint>}
          {descuadre && totalHoras != null && (
            <span className="text-[12.5px] leading-snug text-[var(--warning-soft-foreground)]" role="status">
              Las actividades suman {fmtNum(sumaDetalle)} h, pero por horómetros el trabajo da{' '}
              {fmtNum(horasCobrables(totalHoras))} h a cobrar. Se puede registrar igual — revisá el desglose por si
              un dato quedó mal.
            </span>
          )}
        </div>

        {/* El texto aparece solo si alguna fila eligió «Otro», y es
            obligatorio: sin él la actividad quedaría como «otro» a secas y el
            trabajo no se podría justificar ni cobrar. */}
        {filas.some((f) => f.actividad === 'OTRO') && (
          <Campo label="¿Cuál fue la otra actividad?" requerido hint={errors.otraActividad?.message}>
            <Input placeholder="Ej: despeje de acceso a romana" {...register('otraActividad')} />
          </Campo>
        )}

        <Campo label="Descripción de la tarea" hint={errors.descripcion?.message}>
          <Textarea rows={3} placeholder="Resumen del trabajo completo" {...register('descripcion')} />
        </Campo>

        <Campo label="Observaciones" hint="Incidentes que respalden el cobro: una detención, un neumático pinchado.">
          <Textarea rows={2} placeholder="Novedades, detenciones, etc." {...register('observaciones')} />
        </Campo>

        {foto && (
          <>
            <FotoRespaldoField
              file={foto.file}
              isReadingPhoto={foto.isReadingPhoto}
              captureDate={foto.captureDate}
              onSelect={(file) => {
                setFotoFaltante(false);
                void foto.handleSelectPhoto(file);
              }}
              onClear={foto.handleClearPhoto}
              requerida
              guia="Encuadrá el report completo, legible y con el folio a la vista: es el respaldo del cobro."
              title="Foto del report"
              subtitle="Obligatoria: el trabajo se cobra contra el report en papel."
              staleQuestion="¿Es la foto del report de este trabajo?"
            />
            {fotoFaltante && <Hint>La foto del report es obligatoria: sacala antes de registrar.</Hint>}
          </>
        )}

        {/* El correlativo lo pone el sistema, nunca el usuario: se informa,
            no se edita (el backend rechaza un `numero` en el body). No es el
            folio del papel («N° del report», arriba), que sí se escribe. */}
        <Automaticos>
          <Automatico
            label="Correlativo"
            valor={numero != null ? numeroReport(numero) : 'Se asigna al guardar'}
            nota={numero != null ? 'No se cambia' : 'Automático'}
          />
        </Automaticos>

        <Boton ancho type="submit" disabled={pendiente}>
          {pendiente ? 'Guardando…' : textoBoton}
          <ArrowRight className="h-[19px] w-[19px]" />
        </Boton>
        {onCancelar && (
          <Boton variante="contorno" ancho type="button" onClick={onCancelar}>
            Cancelar
          </Boton>
        )}
      </Form>
    </form>
  );
}
