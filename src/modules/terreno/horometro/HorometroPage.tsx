import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, ScanLine, User } from 'lucide-react';
import { horometroFormSchema, type HorometroForm, type HorometroFormInput } from './schema';
import { useHorometroList, useCreateHorometro } from './hooks';
import { useEquipos } from '../../../shared/hooks/useEquipos';
import { fmtDate, fmtNum } from '../../../shared/lib/format';
import {
  Card,
  Chip,
  Field,
  FieldLabel,
  ListCard,
  PrimaryButton,
  ScreenTitle,
  SectionHeader,
  Segmented,
  SelectField,
} from '../../../shared/ui/mobile';

const TURNOS = [
  { value: 'MANANA' as const, label: 'MAÑANA', sub: '08-16' },
  { value: 'TARDE' as const, label: 'TARDE', sub: '16-00' },
  { value: 'NOCHE' as const, label: 'NOCHE', sub: '00-08' },
];

export function HorometroPage() {
  const { data: equipos = [] } = useEquipos();
  const { data: registros = [] } = useHorometroList();
  const crear = useCreateHorometro();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<HorometroFormInput, unknown, HorometroForm>({
    resolver: zodResolver(horometroFormSchema),
    defaultValues: { equipoId: '', operadorId: '', turno: 'MANANA' },
  });

  const turno = (watch('turno') as HorometroForm['turno']) ?? 'MANANA';
  const inicial = Number(watch('valorInicial')) || 0;
  const final = Number(watch('valorFinal')) || 0;
  const horasTurno = final > inicial ? final - inicial : null;

  const onSubmit = (values: HorometroForm) =>
    crear.mutate(values, {
      onSuccess: () => reset({ equipoId: '', operadorId: '', turno: 'MANANA' }),
    });

  return (
    <div>
      <ScreenTitle
        title="Lectura de turno"
        subtitle="Al ingresar el valor final se cierra el turno y se actualiza el horómetro del equipo."
      />

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card className="space-y-4">
          <SelectField
            label="Equipo"
            error={errors.equipoId?.message}
            right={<ScanLine className="h-4 w-4 text-muted-foreground" />}
            {...register('equipoId')}
          >
            <option value="">Buscar o escanear equipo</option>
            {equipos.map((e) => (
              <option key={e.id} value={e.id}>
                {e.codigo} — {e.tipo}
              </option>
            ))}
          </SelectField>

          <div>
            <FieldLabel>Turno</FieldLabel>
            <Segmented value={turno} onChange={(v) => setValue('turno', v)} options={TURNOS} />
          </div>

          <Field
            label="Operador"
            placeholder="OP-1148"
            prefix="ID"
            right={<User className="h-4 w-4 text-muted-foreground" />}
            error={errors.operadorId?.message}
            {...register('operadorId')}
          />

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Valor inicial"
              unit="h"
              type="number"
              step="0.1"
              inputMode="decimal"
              placeholder="0"
              error={errors.valorInicial?.message}
              {...register('valorInicial', { valueAsNumber: true })}
            />
            <Field
              label="Valor final"
              unit="h"
              type="number"
              step="0.1"
              inputMode="decimal"
              placeholder="—"
              {...register('valorFinal', { valueAsNumber: true })}
            />
          </div>

          <div className="flex items-center justify-between rounded-2xl bg-[var(--surface-tertiary)] px-3.5 py-3">
            <div>
              <div className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">Horas del turno</div>
              <div className="tabular mt-0.5 text-xl font-semibold text-foreground">
                {horasTurno != null ? `${fmtNum(horasTurno)} h` : '—'}
              </div>
            </div>
            {horasTurno == null && (
              <span className="rounded-full bg-card px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                + Valor final cierra turno
              </span>
            )}
          </div>

          <PrimaryButton type="submit" disabled={crear.isPending}>
            {crear.isPending ? 'Guardando…' : 'Registrar lectura'}
            <ArrowRight className="h-4 w-4" />
          </PrimaryButton>
        </Card>
      </form>

      <SectionHeader action="Ver todas">Lecturas recientes</SectionHeader>
      <div className="space-y-2.5">
        {registros.map((r) => (
          <ListCard key={r.id}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">{r.equipo?.codigo ?? r.equipoId}</span>
                <Chip tone="info">{r.turno}</Chip>
              </div>
              <Chip tone={r.valorFinal != null ? 'success' : 'neutral'}>
                {r.valorFinal != null ? 'Cerrado' : 'Abierto'}
              </Chip>
            </div>
            <div className="tabular mt-1.5 text-xs text-muted-foreground">
              {fmtNum(r.valorInicial)} h → {r.valorFinal != null ? `${fmtNum(r.valorFinal)} h` : '—'} · {fmtDate(r.fecha)}
            </div>
          </ListCard>
        ))}
        {registros.length === 0 && <p className="px-1 text-sm text-muted-foreground">Sin lecturas registradas.</p>}
      </div>
    </div>
  );
}
