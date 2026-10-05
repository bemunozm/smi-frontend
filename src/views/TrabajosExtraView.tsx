import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowRight, ChevronRight, History, Lock, Pencil } from 'lucide-react';

import {
  trabajoExtraFormSchema,
  ACTIVIDADES,
  actividadLabel,
  type TrabajoExtraForm,
  type TrabajoExtraFormInput,
} from '../types/trabajosExtra';
import { useTurnoActual } from '../hooks/useTurnoActual';
import { COBRO_MINIMO_HORAS, cobraMinimo, horasCobrables } from '../lib/trabajos-extra';
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
import { fmtDate, fmtNum } from '../lib/format';
import { MarcaSinSincronizar } from '../components/terreno/MarcaSinSincronizar';
import {
  AvisoEdicion,
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
const MOTIVO_EDICION_ATENCION = 'Resolvé el cambio pendiente en Sincronización antes de editar de nuevo.';

/** Por qué un equipo no se puede elegir, según su estado en Flota. */
const ESTADO_NO_DISPONIBLE: Record<string, string> = {
  IN_WORKSHOP: 'En taller',
  OUT_OF_SERVICE: 'Fuera de servicio',
};

const FAENAS = [
  { valor: 'Patillo', label: 'Patillo' },
  { valor: 'Kainita', label: 'Kainita' },
];

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
    actividades: [],
    otraActividad: '',
  });

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
   */
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
    return equipos.map(opcion).sort((a, b) => orden.indexOf(a.grupo!) - orden.indexOf(b.grupo!));
  }, [equipos, enTurno]);

  /**
   * Al registrar, el formulario se vuelve a montar en blanco (`key` nueva) en
   * vez de resetear campo por campo: así vuelve también el turno según la
   * hora, y no queda nada del trabajo anterior.
   */
  const [formKey, setFormKey] = useState(0);

  const formulario = (
    <Card>
      <CardHead
        titulo="Nuevo trabajo extraordinario"
        bajada="Horas y respaldo del trabajo fuera de la operación habitual."
      />
      <FormularioTrabajo
        key={formKey}
        inicial={vacio()}
        equipos={equipos}
        operadores={operadores}
        enTurno={enTurno}
        opcionesEquipo={opcionesEquipo}
        textoBoton="Registrar trabajo"
        pendiente={isGuardando}
        onGuardar={async (values) => {
          // Siempre por el outbox (con o sin señal): el formulario vuelve a
          // blanco solo si el trabajo quedó guardado en el equipo.
          if (await registrar(values)) setFormKey((k) => k + 1);
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
          horometroInicial: detalle.horometroInicial,
          horometroFinal: detalle.horometroFinal,
          actividades: detalle.actividades,
          otraActividad: detalle.otraActividad ?? '',
          descripcion: detalle.descripcion,
          observaciones: detalle.observaciones ?? '',
        }}
        equipos={equipos}
        operadores={operadores}
        enTurno={enTurno}
        opcionesEquipo={opcionesEquipo}
        textoBoton="Guardar cambios"
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
            ['Fecha', fmtDate(detalle.fecha)],
            ['Turno', detalle.turno],
            ['Faena', detalle.faena],
            ['Equipo', codigo(detalle)],
            ['Operador', detalle.operador],
          ]}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <GrupoHead titulo="Actividades" />
        <div className="flex flex-wrap gap-1.5">
          {etiquetaActividades(detalle)
            .split(', ')
            .map((a) => (
              <ChipContexto key={a}>{a}</ChipContexto>
            ))}
        </div>
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

      <HistorialCambios entradas={cambios.data ?? []} cargando={cambios.isLoading} />
    </div>
  );

  return (
    <>
      <VistaHead
        titulo="Trabajos extraordinarios"
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
            ? `${editando ? 'Editar · ' : ''}${codigo(detalle)} · ${fmtDate(detalle.fecha)}`
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
  textoBoton,
  pendiente,
  onGuardar,
  onCancelar,
}: {
  inicial: Partial<TrabajoExtraFormInput>;
  equipos: { id: string; internalCode: string }[];
  /** Catálogo de operadores activos: el operador se elige, no se escribe. */
  operadores: Pick<Operator, 'id' | 'name'>[];
  /** Equipos con turno abierto → operador que lo lleva. */
  enTurno: Map<string, OperadorEnTurno>;
  opcionesEquipo: OpcionSelector[];
  textoBoton: string;
  pendiente: boolean;
  onGuardar: (values: TrabajoExtraForm) => void | Promise<void>;
  onCancelar?: () => void;
}) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<TrabajoExtraFormInput, unknown, TrabajoExtraForm>({
    resolver: zodResolver(trabajoExtraFormSchema),
    defaultValues: inicial,
  });

  const turno = (watch('turno') as TrabajoExtraForm['turno']) ?? 'DIURNO';
  const faena = watch('faena') || 'Patillo';
  const actividades = watch('actividades') ?? [];
  const ini = Number(watch('horometroInicial'));
  const fin = Number(watch('horometroFinal'));
  // Con inicial y final iguales el trabajo igual se cobra (el mínimo): por
  // eso `>=` y no `>`. Si falta uno de los dos, todavía no hay nada que calcular.
  const totalHoras =
    Number.isFinite(ini) && Number.isFinite(fin) && fin >= ini ? Number((fin - ini).toFixed(2)) : null;

  const equipoId = watch('equipoId') ?? '';
  const operadorEnTurno = enTurno.get(equipoId);
  const codigoElegido = equipos.find((e) => e.id === equipoId)?.internalCode;

  return (
    <form onSubmit={handleSubmit(onGuardar)}>
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
              opciones={operadores.map((o) => ({ valor: o.id, titulo: o.name }))}
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

        <div className="grid grid-cols-2 gap-3">
          <Campo label="Horómetro inicial" unidad="h" hint={errors.horometroInicial?.message}>
            <Input numerico type="number" step="0.1" placeholder="0" {...register('horometroInicial', { valueAsNumber: true })} />
          </Campo>
          <Campo label="Horómetro final" unidad="h" hint={errors.horometroFinal?.message}>
            <Input numerico type="number" step="0.1" placeholder="0" {...register('horometroFinal', { valueAsNumber: true })} />
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
          Multi-selección con chips grandes y no un `select` múltiple: una
          salida suele mezclar tareas, y el `select` múltiple obliga a saber
          que hay que mantener Ctrl apretado — impensable con guantes.
        */}
        <div className="flex flex-col gap-1.5">
          <Label>Actividades</Label>
          <div className="flex flex-wrap gap-2">
            {ACTIVIDADES.map((a) => (
              <ChipSeleccion
                key={a.value}
                activo={actividades.includes(a.value)}
                onToggle={() =>
                  setValue(
                    'actividades',
                    actividades.includes(a.value)
                      ? actividades.filter((v) => v !== a.value)
                      : [...actividades, a.value],
                    { shouldValidate: true },
                  )
                }
              >
                {a.label}
              </ChipSeleccion>
            ))}
          </div>
          {errors.actividades?.message && <Hint>{errors.actividades.message}</Hint>}
        </div>

        {/* El texto aparece solo si se eligió «Otro», y es obligatorio: sin
            él la actividad quedaría como «otro» a secas y el trabajo no se
            podría justificar ni cobrar. */}
        {actividades.includes('OTRO') && (
          <Campo label="¿Cuál fue la otra actividad?" requerido hint={errors.otraActividad?.message}>
            <Input placeholder="Ej: despeje de acceso a romana" {...register('otraActividad')} />
          </Campo>
        )}

        <Campo label="Descripción de la tarea" hint={errors.descripcion?.message}>
          <Textarea rows={3} placeholder="Qué se hizo y dónde" {...register('descripcion')} />
        </Campo>

        <Campo label="Observaciones" hint="Incidentes que respalden el cobro: una detención, un neumático pinchado.">
          <Textarea rows={2} placeholder="Novedades, detenciones, etc." {...register('observaciones')} />
        </Campo>

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
