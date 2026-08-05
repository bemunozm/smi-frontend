import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { horometroFormSchema, type HorometroForm, type HorometroFormInput } from './schema';
import { useHorometroList, useCreateHorometro } from './hooks';
import { useEquipos } from '../../../shared/hooks/useEquipos';
import { Button, SelectField, TextField } from '../../../shared/ui/controls';

const TURNOS = ['MANANA', 'TARDE', 'NOCHE'] as const;

export function HorometroPage() {
  const { data: equipos = [] } = useEquipos();
  const { data: registros = [], isLoading } = useHorometroList();
  const crear = useCreateHorometro();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<HorometroFormInput, unknown, HorometroForm>({
    resolver: zodResolver(horometroFormSchema),
    defaultValues: { equipoId: '', operadorId: '', turno: 'MANANA', valorInicial: 0 },
  });

  const onSubmit = (values: HorometroForm) =>
    crear.mutate(values, {
      onSuccess: () => reset({ equipoId: '', operadorId: '', turno: 'MANANA', valorInicial: 0 }),
    });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Registro de horómetro por turno</h1>
        <p className="text-sm text-muted-foreground">
          Al cerrar el turno (valor final) se actualiza el horómetro del equipo.
        </p>
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

        <SelectField label="Turno" {...register('turno')}>
          {TURNOS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </SelectField>

        <TextField label="Operador (id)" error={errors.operadorId?.message} {...register('operadorId')} />
        <TextField label="Valor inicial" type="number" step="0.1" {...register('valorInicial')} />
        <TextField label="Valor final (cierra turno)" type="number" step="0.1" {...register('valorFinal')} />

        <div className="sm:col-span-2">
          <Button type="submit" disabled={crear.isPending}>
            {crear.isPending ? 'Guardando…' : 'Registrar lectura'}
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
                <th className="p-3">Turno</th>
                <th className="p-3">Inicial</th>
                <th className="p-3">Final</th>
                <th className="p-3">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {registros.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="p-3">{r.equipo?.codigo ?? r.equipoId}</td>
                  <td className="p-3">{r.turno}</td>
                  <td className="p-3">{r.valorInicial}</td>
                  <td className="p-3">{r.valorFinal ?? '— (abierto)'}</td>
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
