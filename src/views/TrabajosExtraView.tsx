import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Lock } from 'lucide-react';

import {
  trabajoExtraFormSchema,
  ACTIVIDADES,
  actividadLabel,
  type TrabajoExtraForm,
  type TrabajoExtraFormInput,
} from '../types/trabajosExtra';
import { useTrabajosExtraList, useCreateTrabajoExtra } from '../hooks/useTrabajosExtra';
import { useEquipment } from '../hooks/useEquipment';
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
  Form,
  GrupoHead,
  Hint,
  Input,
  Label,
  Segmentado,
  Select,
  Tabla,
  Tarjeta,
  Textarea,
  TD,
  TH,
  VistaHead,
  VistaSplit,
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
  const crear = useCreateTrabajoExtra();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<TrabajoExtraFormInput, unknown, TrabajoExtraForm>({
    resolver: zodResolver(trabajoExtraFormSchema),
    defaultValues: { equipoId: '', operador: '', faena: 'Patillo', turno: 'DIURNO', actividades: [], otraActividad: '' },
  });

  const turno = (watch('turno') as TrabajoExtraForm['turno']) ?? 'DIURNO';
  const faena = watch('faena') || 'Patillo';
  const actividades = watch('actividades') ?? [];
  const ini = Number(watch('horometroInicial')) || 0;
  const fin = Number(watch('horometroFinal')) || 0;
  const totalHoras = fin > ini ? fin - ini : null;

  const onSubmit = (values: TrabajoExtraForm) =>
    crear.mutate(values, {
      onSuccess: () =>
        reset({ equipoId: '', operador: '', faena: 'Patillo', turno: 'DIURNO', actividades: [], otraActividad: '' }),
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
            <Campo label="Equipo" hint={errors.equipoId?.message}>
              <Select {...register('equipoId')}>
                <option value="">Seleccioná…</option>
                {equipos.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.internalCode}
                  </option>
                ))}
              </Select>
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

  const historial =
    registros.length === 0 ? (
      <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
        Sin trabajos registrados hoy.
      </p>
    ) : esEscritorio ? (
      <Tabla titulo="Trabajos registrados" detalle={`Patillo y Kainita · ${registros.length} registros`}>
        <thead>
          <tr>
            <th className={TH}>Fecha</th>
            <th className={TH}>Faena</th>
            <th className={TH}>Equipo</th>
            <th className={TH}>Operador</th>
            <th className={TH}>Actividad</th>
            <th className={`${TH} text-right`}>Horas</th>
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
                <b className="tabular block text-[15px] font-semibold">{r.equipo?.internalCode ?? r.equipoId}</b>
              </td>
              <td className={`${TD} whitespace-nowrap`}>{r.operador}</td>
              <td className={`${TD} w-full max-w-0 truncate`}>{etiquetaActividades(r)}</td>
              <td className={`${TD} tabular text-right font-semibold`}>{fmtNum(r.totalHoras)} h</td>
            </tr>
          ))}
        </tbody>
      </Tabla>
    ) : (
      <>
        <GrupoHead titulo="Trabajos registrados" detalle={`${registros.length} registros`} />
        <div className="flex flex-col gap-3">
          {registros.map((r) => (
            <Tarjeta key={r.id}>
              <div className="flex items-start justify-between gap-2.5">
                <div className="min-w-0">
                  <div className="tabular text-[19px] font-semibold tracking-[-0.01em]">
                    {r.equipo?.internalCode ?? r.equipoId}
                  </div>
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
            </Tarjeta>
          ))}
        </div>
      </>
    );

  return (
    <>
      <VistaHead
        titulo="Trabajos extraordinarios"
        contexto={<ChipContexto>Respalda cobros posteriores</ChipContexto>}
      />
      <VistaSplit formulario={formulario} historial={historial} />
    </>
  );
}
