import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight } from 'lucide-react';
import {
  trabajoExtraFormSchema,
  calcMonto,
  type TrabajoExtraForm,
  type TrabajoExtraFormInput,
} from './schema';
import { useTrabajosExtraList, useCreateTrabajoExtra } from './hooks';
import { useEquipos } from '../../../shared/hooks/useEquipos';
import { fmtMoney, fmtNum } from '../../../shared/lib/format';
import {
  Card,
  Chip,
  Field,
  ListCard,
  PrimaryButton,
  ScreenTitle,
  SectionHeader,
  SelectField,
} from '../../../shared/ui/mobile';

export function TrabajosExtraPage() {
  const { data: equipos = [] } = useEquipos();
  const { data: registros = [] } = useTrabajosExtraList();
  const crear = useCreateTrabajoExtra();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<TrabajoExtraFormInput, unknown, TrabajoExtraForm>({
    resolver: zodResolver(trabajoExtraFormSchema),
    defaultValues: { equipoId: '', cliente: '' },
  });

  const horas = Number(watch('horasMaquina')) || 0;
  const tarifa = Number(watch('tarifa')) || 0;
  const monto = calcMonto(horas, tarifa);

  const onSubmit = (values: TrabajoExtraForm) =>
    crear.mutate(values, { onSuccess: () => reset({ equipoId: '', cliente: '' }) });

  return (
    <div>
      <ScreenTitle
        title="Trabajo extraordinario"
        subtitle="Horas máquina × tarifa determinan el monto a facturar al cliente."
      />

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Equipo" error={errors.equipoId?.message} {...register('equipoId')}>
              <option value="">Seleccioná…</option>
              {equipos.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.codigo}
                </option>
              ))}
            </SelectField>
            <Field label="Cliente" placeholder="Seleccionar" error={errors.cliente?.message} {...register('cliente')} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Horas máquina"
              unit="h"
              type="number"
              step="0.1"
              inputMode="decimal"
              placeholder="0"
              error={errors.horasMaquina?.message}
              {...register('horasMaquina', { valueAsNumber: true })}
            />
            <Field
              label="Tarifa"
              prefix="$"
              unit="/h"
              type="number"
              step="1"
              inputMode="numeric"
              placeholder="0"
              error={errors.tarifa?.message}
              {...register('tarifa', { valueAsNumber: true })}
            />
          </div>

          <Field
            label="Tonelaje"
            hint={<span className="text-muted-foreground">Opcional</span>}
            unit="t"
            type="number"
            step="0.1"
            inputMode="decimal"
            placeholder="0"
            {...register('tonelaje', { valueAsNumber: true })}
          />

          <div className="rounded-2xl bg-secondary p-4 text-secondary-foreground">
            <div className="flex items-center justify-between text-[10px] font-bold tracking-wider uppercase">
              <span className="text-white/50">Monto estimado</span>
              <span className="tabular text-white/70">
                {fmtNum(horas)} h × {fmtMoney(tarifa)}
              </span>
            </div>
            <div className="tabular mt-1 text-3xl font-bold">{fmtMoney(monto)}</div>
            <div className="mt-1 text-xs text-white/50">Referencial. Se confirma al aprobar el reporte.</div>
          </div>

          <PrimaryButton type="submit" disabled={crear.isPending}>
            {crear.isPending ? 'Guardando…' : 'Registrar trabajo'}
            <ArrowRight className="h-4 w-4" />
          </PrimaryButton>
        </Card>
      </form>

      <SectionHeader action="Ver todos">Registrados hoy</SectionHeader>
      <div className="space-y-2.5">
        {registros.map((r) => (
          <ListCard key={r.id}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="font-semibold text-foreground">{r.equipo?.codigo ?? r.equipoId}</span>
                <span className="truncate text-sm text-muted-foreground">{r.cliente}</span>
              </div>
              <Chip tone="info">Por aprobar</Chip>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="tabular text-xs text-muted-foreground">
                {fmtNum(r.horasMaquina)} h × {fmtMoney(r.tarifa)}
              </span>
              <span className="tabular font-bold text-foreground">{fmtMoney(r.monto)}</span>
            </div>
          </ListCard>
        ))}
        {registros.length === 0 && <p className="px-1 text-sm text-muted-foreground">Sin trabajos registrados hoy.</p>}
      </div>
    </div>
  );
}
