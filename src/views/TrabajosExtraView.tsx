import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight } from 'lucide-react';
import {
  trabajoExtraFormSchema,
  ACTIVIDADES,
  actividadLabel,
  type TrabajoExtraForm,
  type TrabajoExtraFormInput,
} from '../types/trabajosExtra';
import { useTrabajosExtraList, useCreateTrabajoExtra } from '../hooks/useTrabajosExtra';
import { useEquipment } from '../hooks/useEquipment';
import { fmtDate, fmtNum } from '../lib/format';
import {
  Card,
  Chip,
  Field,
  FieldLabel,
  ListCard,
  PrimaryButton,
  ScreenTitle,
  Segmented,
  SelectField,
  TextareaField,
} from '../components/terreno/mobile';
import { COLUMNA, Historial, Tabla, VistaTerreno } from '../components/terreno/historial';
import { Table } from '@heroui/react';

const TURNOS = [
  { value: 'DIURNO' as const, label: 'DIURNO', sub: '08-20' },
  { value: 'NOCTURNO' as const, label: 'NOCTURNO', sub: '20-08' },
];

export function TrabajosExtraView() {
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
    defaultValues: { equipoId: '', operador: '', faena: '', turno: 'DIURNO', actividad: 'REGULACION_CARGA' },
  });

  const turno = (watch('turno') as TrabajoExtraForm['turno']) ?? 'DIURNO';
  const ini = Number(watch('horometroInicial')) || 0;
  const fin = Number(watch('horometroFinal')) || 0;
  const totalHoras = fin > ini ? fin - ini : null;

  const onSubmit = (values: TrabajoExtraForm) =>
    crear.mutate(values, {
      onSuccess: () => reset({ equipoId: '', operador: '', faena: '', turno: 'DIURNO', actividad: 'REGULACION_CARGA' }),
    });

  const formulario = (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Card className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Equipo" error={errors.equipoId?.message} {...register('equipoId')}>
            <option value="">Seleccioná…</option>
            {equipos.map((e) => (
              <option key={e.id} value={e.id}>
                {e.internalCode}
              </option>
            ))}
          </SelectField>
          <Field label="Operador" placeholder="Nombre y apellido" error={errors.operador?.message} {...register('operador')} />
        </div>

        <Field label="Faena" placeholder="Ej: Rajo Norte" error={errors.faena?.message} {...register('faena')} />

        <div>
          <FieldLabel>Turno</FieldLabel>
          <Segmented value={turno} onChange={(v) => setValue('turno', v)} options={TURNOS} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Horómetro inicial"
            unit="h"
            type="number"
            step="0.1"
            inputMode="decimal"
            placeholder="0"
            error={errors.horometroInicial?.message}
            {...register('horometroInicial', { valueAsNumber: true })}
          />
          <Field
            label="Horómetro final"
            unit="h"
            type="number"
            step="0.1"
            inputMode="decimal"
            placeholder="0"
            error={errors.horometroFinal?.message}
            {...register('horometroFinal', { valueAsNumber: true })}
          />
        </div>

        <SelectField label="Actividad" error={errors.actividad?.message} {...register('actividad')}>
          {ACTIVIDADES.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </SelectField>

        <div className="rounded-2xl bg-secondary p-4 text-secondary-foreground">
          <div className="text-[10px] font-bold tracking-wider text-white/50 uppercase">Total horas de tarea</div>
          <div className="tabular mt-1 text-3xl font-bold">{totalHoras != null ? `${fmtNum(totalHoras)} h` : '—'}</div>
          <div className="mt-1 text-xs text-white/50">Se calcula desde el horómetro inicial y final.</div>
        </div>

        <TextareaField
          label="Descripción de la tarea"
          rows={3}
          placeholder="Qué se hizo y dónde"
          error={errors.descripcion?.message}
          {...register('descripcion')}
        />

        <TextareaField
          label="Observaciones"
          hint={<span className="text-muted-foreground">Opcional</span>}
          rows={2}
          placeholder="Novedades, detenciones, etc."
          {...register('observaciones')}
        />

        <PrimaryButton type="submit" disabled={crear.isPending}>
          {crear.isPending ? 'Guardando…' : 'Registrar trabajo'}
          <ArrowRight className="h-4 w-4" />
        </PrimaryButton>
      </Card>
    </form>
  );

  return (
    <VistaTerreno
      titulo={
        <ScreenTitle
          title="Trabajo extraordinario"
          subtitle="Registro de tarea por turno: horómetros, actividad y observaciones."
        />
      }
      formulario={formulario}
      historial={
        <Historial
          titulo="Registrados hoy"
          vacio="Sin trabajos registrados hoy."
          hayRegistros={registros.length > 0}
          tarjetas={() =>
            registros.map((r) => (
              <ListCard key={r.id}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="font-semibold text-foreground">{r.equipo?.internalCode ?? r.equipoId}</span>
                    <span className="truncate text-sm text-muted-foreground">{r.operador}</span>
                  </div>
                  <Chip tone="info">{r.turno}</Chip>
                </div>
                <div className="mt-1 text-sm text-foreground">{actividadLabel[r.actividad] ?? r.actividad}</div>
                <div className="tabular mt-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {r.faena} · {fmtDate(r.fecha)}
                  </span>
                  <span className="font-semibold text-foreground">{fmtNum(r.totalHoras)} h</span>
                </div>
              </ListCard>
            ))
          }
          tabla={() => (
            <Tabla label="Trabajos extraordinarios registrados hoy" anchoMinimo="min-w-180">
              <Table.Header>
                <Table.Column className={COLUMNA} isRowHeader>
                  Equipo
                </Table.Column>
                <Table.Column className={COLUMNA}>Operador</Table.Column>
                <Table.Column className={COLUMNA}>Faena</Table.Column>
                <Table.Column className={COLUMNA}>Turno</Table.Column>
                <Table.Column className={COLUMNA}>Actividad</Table.Column>
                <Table.Column className={COLUMNA}>Horas</Table.Column>
                <Table.Column className={COLUMNA}>Fecha</Table.Column>
              </Table.Header>
              <Table.Body>
                {registros.map((r) => (
                  <Table.Row key={r.id}>
                    <Table.Cell className="font-semibold whitespace-nowrap text-foreground">
                      {r.equipo?.internalCode ?? r.equipoId}
                    </Table.Cell>
                    <Table.Cell className="text-sm whitespace-nowrap text-foreground">{r.operador}</Table.Cell>
                    <Table.Cell className="text-sm whitespace-nowrap text-muted-foreground">{r.faena}</Table.Cell>
                    <Table.Cell>
                      <Chip tone="info">{r.turno}</Chip>
                    </Table.Cell>
                    <Table.Cell className="w-full max-w-0 truncate text-sm text-foreground">
                      {actividadLabel[r.actividad] ?? r.actividad}
                    </Table.Cell>
                    <Table.Cell className="tabular font-semibold whitespace-nowrap text-foreground">
                      {fmtNum(r.totalHoras)} h
                    </Table.Cell>
                    <Table.Cell className="tabular text-sm whitespace-nowrap text-muted-foreground">
                      {fmtDate(r.fecha)}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Tabla>
          )}
        />
      }
    />
  );
}
