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
  { value: 'DIURNO' as const, label: 'DIURNO', sub: '08-20' },
  { value: 'NOCTURNO' as const, label: 'NOCTURNO', sub: '20-08' },
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
    defaultValues: { equipoId: '', operador: '', turno: 'DIURNO' },
  });

  const turno = (watch('turno') as HorometroForm['turno']) ?? 'DIURNO';
  const inicial = Number(watch('valorInicial')) || 0;
  const final = Number(watch('valorFinal')) || 0;
  const horasTurno = final > inicial ? final - inicial : null;

  const onSubmit = (values: HorometroForm) =>
    crear.mutate(values, { onSuccess: () => reset({ equipoId: '', operador: '', turno: 'DIURNO' }) });

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
            placeholder="Nombre y apellido"
            right={<User className="h-4 w-4 text-muted-foreground" />}
            error={errors.operador?.message}
            {...register('operador')}
          />

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Horómetro inicial"
              unit="h"
              type="number"
              step="0.1"
              inputMode="decimal"
              placeholder="0"
              error={errors.valorInicial?.message}
              {...register('valorInicial', { valueAsNumber: true })}
            />
            <Field
              label="Horómetro final"
              unit="h"
              type="number"
              step="0.1"
              inputMode="decimal"
              placeholder="—"
              {...register('valorFinal', { valueAsNumber: true })}
            />
          </div>

          <Field
            label="Nivel de combustible"
            unit="%"
            type="number"
            step="1"
            inputMode="numeric"
            placeholder="0"
            {...register('nivelCombustible', { valueAsNumber: true })}
          />

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
            <div className="mt-1 text-sm text-foreground">{r.operador}</div>
            <div className="tabular mt-0.5 text-xs text-muted-foreground">
              {fmtNum(r.valorInicial)} h → {r.valorFinal != null ? `${fmtNum(r.valorFinal)} h` : '—'}
              {r.nivelCombustible != null ? ` · ${fmtNum(r.nivelCombustible)}% comb.` : ''} · {fmtDate(r.fecha)}
            </div>
          </ListCard>
        ))}
        {registros.length === 0 && <p className="px-1 text-sm text-muted-foreground">Sin lecturas registradas.</p>}
      </div>
    </div>
  );
}
