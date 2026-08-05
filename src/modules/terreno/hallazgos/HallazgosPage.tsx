import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { hallazgoFormSchema, CRITICIDADES, type HallazgoForm, type HallazgoFormInput } from './schema';
import { useHallazgosList, useCreateHallazgo } from './hooks';
import { useEquipos } from '../../../shared/hooks/useEquipos';
import { Button, SelectField, TextField } from '../../../shared/ui/controls';

const critClass: Record<string, string> = {
  BAJA: 'bg-muted text-muted-foreground',
  MEDIA: 'bg-primary/15 text-primary',
  ALTA: 'bg-destructive/15 text-destructive',
  CRITICA: 'bg-destructive text-destructive-foreground',
};

const estadoClass: Record<string, string> = {
  ABIERTO: 'bg-destructive/15 text-destructive',
  EN_PROCESO: 'bg-primary/15 text-primary',
  CERRADO: 'bg-muted text-muted-foreground',
};

function Badge({ text, cls }: { text: string; cls: string }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs ${cls}`}>{text}</span>;
}

export function HallazgosPage() {
  const { data: equipos = [] } = useEquipos();
  const { data: hallazgos = [], isLoading } = useHallazgosList();
  const crear = useCreateHallazgo();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<HallazgoFormInput, unknown, HallazgoForm>({
    resolver: zodResolver(hallazgoFormSchema),
    defaultValues: { equipoId: '', descripcion: '', criticidad: 'MEDIA' },
  });

  const onSubmit = (values: HallazgoForm) =>
    crear.mutate(values, {
      onSuccess: () => reset({ equipoId: '', descripcion: '', criticidad: 'MEDIA' }),
    });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Hallazgos</h1>
        <p className="text-sm text-muted-foreground">
          Registrá un hallazgo con su criticidad; nace en estado ABIERTO.
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

        <SelectField label="Criticidad" {...register('criticidad')}>
          {CRITICIDADES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </SelectField>

        <TextField
          label="Descripción"
          wrapClassName="sm:col-span-2"
          error={errors.descripcion?.message}
          {...register('descripcion')}
        />
        <TextField label="Foto (URL)" error={errors.fotoUrl?.message} {...register('fotoUrl')} />

        <div className="sm:col-span-2">
          <Button type="submit" disabled={crear.isPending}>
            {crear.isPending ? 'Guardando…' : 'Registrar hallazgo'}
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
                <th className="p-3">Descripción</th>
                <th className="p-3">Criticidad</th>
                <th className="p-3">Estado</th>
                <th className="p-3">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {hallazgos.map((h) => (
                <tr key={h.id} className="border-b border-border last:border-0">
                  <td className="p-3">{h.equipo?.codigo ?? h.equipoId}</td>
                  <td className="p-3">{h.descripcion}</td>
                  <td className="p-3">
                    <Badge text={h.criticidad} cls={critClass[h.criticidad] ?? ''} />
                  </td>
                  <td className="p-3">
                    <Badge text={h.estado} cls={estadoClass[h.estado] ?? ''} />
                  </td>
                  <td className="p-3">{new Date(h.fecha).toLocaleDateString()}</td>
                </tr>
              ))}
              {hallazgos.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-4 text-muted-foreground">
                    Sin hallazgos.
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
