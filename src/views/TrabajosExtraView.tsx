import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowRight, ChevronRight, History, Lock } from 'lucide-react';

import {
  trabajoExtraFormSchema,
  ACTIVIDADES,
  actividadLabel,
  type TrabajoExtraForm,
  type TrabajoExtraFormInput,
  type TrabajoExtraordinario,
} from '../types/trabajosExtra';
import { turnoDe } from '../lib/turno';
import { useTrabajosExtraList, useCreateTrabajoExtra } from '../hooks/useTrabajosExtra';
import { useEquipment } from '../hooks/useEquipment';
import { useHorometroList } from '../hooks/useHorometro';
import { DESKTOP_QUERY, useMediaQuery } from '../hooks/useMediaQuery';
import { fmtDate, fmtNum } from '../lib/format';
import {
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
  const [detalle, setDetalle] = useState<TrabajoExtraordinario | null>(null);

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
   * Un equipo con **turno en curso** está ocupado y no admite un trabajo
   * extraordinario hasta que se cierre la tarjeta.
   *
   * El motivo es el cobro: las horas del trabajo y las del turno se facturan
   * por separado, y mientras el turno sigue abierto no se sabe cuáles serán
   * sus horas, así que las del trabajo podrían quedar contadas dos veces.
   *
   * «Turno en curso» es la misma definición que usa el backend —una lectura
   * de horómetro sin `valorFinal`— y ahí está la regla de verdad, porque la
   * especificación pide registrar sin señal y sincronizar después (R4). Acá
   * solo se evita ofrecer una opción que el servidor va a rechazar.
   */
  const ocupados = useMemo(
    () => new Set(lecturas.filter((l) => l.valorFinal == null).map((l) => l.equipoId)),
    [lecturas],
  );

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<TrabajoExtraFormInput, unknown, TrabajoExtraForm>({
    resolver: zodResolver(trabajoExtraFormSchema),
    defaultValues: vacio(),
  });

  const turno = (watch('turno') as TrabajoExtraForm['turno']) ?? 'DIURNO';
  const faena = watch('faena') || 'Patillo';
  const actividades = watch('actividades') ?? [];
  const ini = Number(watch('horometroInicial')) || 0;
  const fin = Number(watch('horometroFinal')) || 0;
  const totalHoras = fin > ini ? fin - ini : null;

  const onSubmit = (values: TrabajoExtraForm) =>
    crear.mutate(values, {
      onSuccess: () => reset(vacio()),
    });

  const formulario = (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Card>
        <CardHead
          titulo="Nuevo trabajo extraordinario"
          bajada="Horas y respaldo del trabajo fuera de la operación habitual."
        />
        <Form>
          <div className="grid grid-cols-2 gap-3">
            {/*
              Los ocupados se muestran **deshabilitados**, no escondidos. Si un
              equipo desaparece de la lista el supervisor no sabe si está
              ocupado, si lo dieron de baja o si se equivocó de pantalla;
              verlo en gris y con el motivo al lado responde la pregunta sin
              que tenga que ir a buscarla a otro lado.
            */}
            <Campo
              label="Equipo"
              hint={
                errors.equipoId?.message ??
                (ocupados.size > 0
                  ? `${ocupados.size} ${ocupados.size === 1 ? 'equipo está' : 'equipos están'} en turno. Cerrá su tarjeta para poder cargarle un trabajo.`
                  : undefined)
              }
            >
              <Selector
                etiqueta="Equipo"
                tituloTabular
                valor={watch('equipoId') ?? ''}
                onChange={(id) => setValue('equipoId', id, { shouldValidate: true })}
                opciones={equipos.map((e) => ({
                  valor: e.id,
                  titulo: e.internalCode,
                  detalle: e.type,
                  motivo: ocupados.has(e.id) ? 'Ocupado, en turno' : undefined,
                }))}
              />
            </Campo>
            <Campo label="Operador" hint={errors.operador?.message}>
              <Input placeholder="Nombre y apellido" {...register('operador')} />
            </Campo>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Faena</Label>
            <Segmentado
              etiqueta="Faena"
              valor={faena}
              onChange={(v) => setValue('faena', v)}
              opciones={FAENAS}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Turno</Label>
            <Segmentado
              etiqueta="Turno"
              valor={turno}
              onChange={(v) => setValue('turno', v)}
              opciones={TURNOS}
            />
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

          <Calculado
            label="Horas totales"
            nota={
              <span className="flex items-center gap-1.5">
                <Lock className="h-[13px] w-[13px]" />
                Calculado · no editable
              </span>
            }
            valor={totalHoras != null ? `${fmtNum(totalHoras)} h` : '—'}
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

          <Boton ancho type="submit" disabled={crear.isPending}>
            {crear.isPending ? 'Guardando…' : 'Registrar trabajo'}
            <ArrowRight className="h-[19px] w-[19px]" />
          </Boton>
        </Form>
      </Card>
    </form>
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
              <td className={`${TD} tabular text-right font-semibold`}>{fmtNum(r.totalHoras)} h</td>
              <td className={`${TD} text-right`}>
                <button
                  type="button"
                  onClick={() => setDetalle(r)}
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
              <span className="font-semibold text-foreground">{fmtNum(r.totalHoras)} h</span>
            </div>
            <Boton variante="contorno" ancho onClick={() => setDetalle(r)}>
              Ver detalle <ChevronRight className="h-[18px] w-[18px]" />
            </Boton>
          </Tarjeta>
        ))}
      </div>
    );

  const vistaDetalle = detalle && (
    <div className="flex flex-col gap-4">
      <Boton variante="contorno" onClick={() => setDetalle(null)} className="self-start">
        <ArrowLeft className="h-[18px] w-[18px]" /> Volver al historial
      </Boton>

      <Cifras
        items={[
          { label: 'Horóm. inicial', valor: fmtNum(detalle.horometroInicial) },
          { label: 'Horóm. final', valor: fmtNum(detalle.horometroFinal) },
          { label: 'Horas', valor: `${fmtNum(detalle.totalHoras)} h`, destacado: true },
        ]}
      />

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
            setDetalle(null);
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
          if (!abierto) setDetalle(null);
        }}
        titulo={detalle ? `${codigo(detalle)} · ${fmtDate(detalle.fecha)}` : 'Historial de trabajos'}
        detalle={
          detalle
            ? `${detalle.faena} · turno ${detalle.turno} · ${detalle.operador}`
            : `Patillo y Kainita · ${registros.length} ${registros.length === 1 ? 'registro' : 'registros'}`
        }
      >
        {vistaDetalle || lista}
      </ModalTerreno>
    </>
  );
}
