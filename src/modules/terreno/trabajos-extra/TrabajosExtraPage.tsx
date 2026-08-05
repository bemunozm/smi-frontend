import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  trabajoExtraFormSchema,
  calcMonto,
  type TrabajoExtraForm,
  type TrabajoExtraFormInput,
} from './schema';
import { useTrabajosExtraList, useCreateTrabajoExtra } from './hooks';
import { useEquipos } from '../../../shared/hooks/useEquipos';
import { Button, SelectField, TextField } from '../../../shared/ui/controls';

const money = (n: number) => n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });

export function TrabajosExtraPage() {
  const { data: equipos = [] } = useEquipos();
  const { data: registros = [], isLoading } = useTrabajosExtraList();
  const crear = useCreateTrabajoExtra();

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<TrabajoExtraFormInput, unknown, TrabajoExtraForm>({
    resolver: zodResolver(trabajoExtraFormSchema),
    defaultValues: { equipoId: '', cliente: '', horasMaquina: 0, tarifa: 0 },
  });

  const horas = Number(useWatch({ control, name: 'horasMaquina' })) || 0;
  const tarifa = Number(useWatch({ control, name: 'tarifa' })) || 0;
  const montoPreview = calcMonto(horas, tarifa);

  const onSubmit = (values: TrabajoExtraForm) =>
    crear.mutate(values, {
      onSuccess: () => reset({ equipoId: '', cliente: '', horasMaquina: 0, tarifa: 0 }),
    });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Trabajos extraordinarios</h1>
        <p className="text-sm text-muted-foreground">Horas máquina × tarifa determinan el monto.</p>
      </header>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="grid gap-4 rounded-(--radius) border border-border bg-card p-4 sm:grid-cols-2"
      >
        <SelectField label="Equipo" error={errors.equipoId?.message} {...register('equipoId')}>
          <option value="">Seleccioná…</option>
          {equipos.map((e) => (
            <option key={e.id} value={e.id}>
              {e.codigo} — {e.modelo}
            </option>
          ))}
        </SelectField>

        <TextField label="Cliente" error={errors.cliente?.message} {...register('cliente')} />
        <TextField
          label="Horas máquina"
          type="number"
          step="0.1"
          error={errors.horasMaquina?.message}
          {...register('horasMaquina')}
        />
        <TextField label="Tonelaje (opcional)" type="number" step="0.1" {...register('tonelaje')} />
        <TextField
          label="Tarifa"
          type="number"
          step="1"
          error={errors.tarifa?.message}
          {...register('tarifa')}
        />

        <div className="flex items-end">
          <div className="rounded-lg bg-muted px-4 py-2 text-sm">
            Monto estimado: <span className="font-semibold text-primary">{money(montoPreview)}</span>
          </div>
        </div>

        <div className="sm:col-span-2">
          <Button type="submit" disabled={crear.isPending}>
            {crear.isPending ? 'Guardando…' : 'Registrar trabajo'}
          </Button>
        </div>
      </form>

      <section className="overflow-x-auto rounded-(--radius) border border-border bg-card">
        {isLoading ? (
          <p className="p-4 text-muted-foreground">Cargando…</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr className="border-b border-border">
                <th className="p-3">Equipo</th>
                <th className="p-3">Cliente</th>
                <th className="p-3">Horas</th>
                <th className="p-3">Monto</th>
                <th className="p-3">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {registros.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="p-3">{r.equipo?.codigo ?? r.equipoId}</td>
                  <td className="p-3">{r.cliente}</td>
                  <td className="p-3">{r.horasMaquina}</td>
                  <td className="p-3 font-medium">{money(r.monto)}</td>
                  <td className="p-3">{new Date(r.fecha).toLocaleDateString()}</td>
                </tr>
              ))}
              {registros.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-4 text-muted-foreground">
                    Sin registros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
