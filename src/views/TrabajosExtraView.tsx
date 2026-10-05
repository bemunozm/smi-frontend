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
  type TrabajoExtraordinario,
} from '../types/trabajosExtra';
import { turnoDe } from '../lib/turno';
import { COBRO_MINIMO_HORAS, cobraMinimo, horasCobrables } from '../lib/trabajos-extra';
import {
  useTrabajosExtraList,
  useCreateTrabajoExtra,
  useUpdateTrabajoExtra,
  useCambiosTrabajoExtra,
} from '../hooks/useTrabajosExtra';
import { useEquipment } from '../hooks/useEquipment';
import { useHorometroList } from '../hooks/useHorometro';
import { DESKTOP_QUERY, useMediaQuery } from '../hooks/useMediaQuery';
import { fmtDate, fmtNum } from '../lib/format';
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

const TURNOS = [
  { valor: 'DIURNO' as const, label: 'DIURNO', sub: '08–20' },
  { valor: 'NOCTURNO' as const, label: 'NOCTURNO', sub: '20–08' },
];

/**
 * Sima opera dos faenas y solo dos. Antes esto era un campo de texto libre con
 * placeholder «Ej: Rajo Norte», que producía «Patillo», «patillo» y «PAT» como
 * tres lugares distintos para la base de datos.
 *
 * Es provisorio: RFC-4 decide que la faena es una `Branch` de tipo `SITE`, así
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
  const { data: registros = [] } = useTrabajosExtraList();
  const { data: lecturas = [] } = useHorometroList();
  const crear = useCreateTrabajoExtra();
  const [historialAbierto, setHistorialAbierto] = useState(false);
  const [detalleId, setDetalleId] = useState<string | null>(null);
  /** Modo edición del trabajo abierto en el detalle (Acta N.° 004, R13). */
  const [editando, setEditando] = useState(false);
  const actualizar = useUpdateTrabajoExtra();
  const cambios = useCambiosTrabajoExtra(detalleId);
  // Se lee de la lista y no de una copia: tras editar, la lista se refresca
  // y el detalle muestra el dato nuevo sin tener que volver a abrirlo.
  const detalle = registros.find((r) => r.id === detalleId) ?? null;

  /**
   * El turno arranca en el que corre según el reloj (`lib/turno`, la misma
   * regla que Registro de equipo), no siempre en DIURNO: de noche el valor
   * por defecto quedaba mal y había que acordarse de cambiarlo. Sigue siendo
   * editable, porque un trabajo se puede cargar después de terminado.
   */
  const vacio = (): Partial<TrabajoExtraFormInput> => ({
    equipoId: '',
    operador: '',
    faena: 'Patillo',
    turno: turnoDe(new Date()),
    actividades: [],
    otraActividad: '',
  });

  /**
   * Equipos **en uso**: los que tienen un turno en curso, con el operador que
   * lo lleva. «En uso» es la misma definición que usa el backend: una lectura
   * de horómetro sin `valorFinal` — la que abre una tarjeta en Registro de
   * equipo y se apaga al cerrarla.
   *
   * Hasta el Acta N.° 004 un equipo en turno no se podía elegir. El cliente lo
   * corrigió (punto 4): el trabajo extra se registra al final del turno y usa
   * la misma máquina, que tiene tiempos en ralentí. Ahora se puede elegir, y
   * el equipo en uso queda como **aviso** —para no tener que coordinarlo por
   * radio—, no como bloqueo.
   */
  const enUso = useMemo(
    () => new Map(lecturas.filter((l) => l.valorFinal == null).map((l) => [l.equipoId, l.operador])),
    [lecturas],
  );

  /**
   * R10: el selector separa los equipos en terreno de los disponibles. Los que
   * están en taller o fuera de servicio quedan al final, a la vista pero sin
   * poder elegirse, para que no parezca que desaparecieron.
   */
  const opcionesEquipo = useMemo((): OpcionSelector[] => {
    const opcion = (e: (typeof equipos)[number]): OpcionSelector => {
      const operador = enUso.get(e.id);
      if (operador != null) {
        return { valor: e.id, titulo: e.internalCode, detalle: e.type, grupo: 'En terreno', aviso: `En uso · ${operador}` };
      }
      if (e.status && e.status !== 'OPERATIONAL') {
        return { valor: e.id, titulo: e.internalCode, detalle: e.type, grupo: 'No disponibles', motivo: ESTADO_NO_DISPONIBLE[e.status] ?? 'No operativo' };
      }
      return { valor: e.id, titulo: e.internalCode, detalle: e.type, grupo: 'Disponibles' };
    };
    const orden = ['En terreno', 'Disponibles', 'No disponibles'];
    return equipos.map(opcion).sort((a, b) => orden.indexOf(a.grupo!) - orden.indexOf(b.grupo!));
  }, [equipos, enUso]);

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
        enUso={enUso}
        opcionesEquipo={opcionesEquipo}
        textoBoton="Registrar trabajo"
        pendiente={crear.isPending}
        onGuardar={(values) => crear.mutate(values, { onSuccess: () => setFormKey((k) => k + 1) })}
      />
    </Card>
  );

  const codigo = (r: TrabajoExtraordinario) => r.equipo?.internalCode ?? r.equipoId;

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
              <td className={`${TD} whitespace-nowrap`}>{r.operador}</td>
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
   * Editar un trabajo ya registrado (Acta N.° 004, R13): el mismo formulario
   * del alta, con los datos guardados y el aviso de que el administrador se
   * entera. Vive en la misma ventana que el detalle, como lista y detalle.
   */
  const vistaEdicion = detalle && editando && (
    <div className="flex flex-col gap-4">
      <AvisoEdicion />
      <FormularioTrabajo
        inicial={{
          equipoId: detalle.equipoId,
          operador: detalle.operador,
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
        enUso={enUso}
        opcionesEquipo={opcionesEquipo}
        textoBoton="Guardar cambios"
        pendiente={actualizar.isPending}
        onGuardar={(payload) =>
          actualizar.mutate({ id: detalle.id, payload }, { onSuccess: () => setEditando(false) })
        }
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
        <Boton variante="contorno" onClick={() => setEditando(true)}>
          <Pencil className="h-[17px] w-[17px]" /> Editar
        </Boton>
      </div>

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
 * (Acta N.° 004, R13). Es el mismo formulario en los dos casos a propósito:
 * corregir un dato no tiene por qué verse distinto de cargarlo, y las reglas
 * —horómetros, «Otro» con texto, cobro mínimo— no pueden quedar aplicadas en
 * uno y en el otro no.
 */
function FormularioTrabajo({
  inicial,
  equipos,
  enUso,
  opcionesEquipo,
  textoBoton,
  pendiente,
  onGuardar,
  onCancelar,
}: {
  inicial: Partial<TrabajoExtraFormInput>;
  equipos: { id: string; internalCode: string; operator?: { name: string } | null }[];
  /** Equipos en uso (turno abierto) → operador que lo lleva. */
  enUso: Map<string, string>;
  opcionesEquipo: OpcionSelector[];
  textoBoton: string;
  pendiente: boolean;
  onGuardar: (values: TrabajoExtraForm) => void;
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
  const operadorEnUso = enUso.get(equipoId);
  const codigoElegido = equipos.find((e) => e.id === equipoId)?.internalCode;

  return (
    <form onSubmit={handleSubmit(onGuardar)}>
      <Form>
        <div className="grid grid-cols-2 gap-3">
          <Campo
            label="Equipo"
            hint={
              errors.equipoId?.message ??
              (operadorEnUso != null
                ? `${codigoElegido} está en uso con ${operadorEnUso}. Se registra igual: queda a nombre de esta máquina.`
                : undefined)
            }
          >
            <Selector
              etiqueta="Equipo"
              tituloTabular
              valor={equipoId}
              onChange={(id) => {
                setValue('equipoId', id, { shouldValidate: true });
                // El operador acompaña a la máquina: al cambiar de equipo, el
                // campo se sincroniza con el que corresponde al elegido — el
                // del turno abierto si está en uso, si no el asignado en
                // Flota, y vacío si no tiene ninguno (antes quedaba pegado el
                // operador del equipo anterior).
                const delEquipo = enUso.get(id) ?? equipos.find((e) => e.id === id)?.operator?.name ?? '';
                // Al vaciar no se valida: marcaría «falta el operador» recién
                // cambiado el equipo, antes de que el supervisor pueda tipear.
                setValue('operador', delEquipo, { shouldValidate: delEquipo !== '' });
              }}
              opciones={opcionesEquipo}
            />
          </Campo>
          <Campo label="Operador" hint={errors.operador?.message}>
            <Input placeholder="Nombre y apellido" {...register('operador')} />
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
            máquina (Acta N.° 004). Las horas reales van en la nota cuando
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
