import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { combustibleFormSchema, type CombustibleForm, type CombustibleFormInput } from './schema';
import { useCombustibleList, useCreateCombustible } from './hooks';
import { useEquipos } from '../../../shared/hooks/useEquipos';
import { Button, SelectField, TextField } from '../../../shared/ui/controls';
import { ImageUploadField } from '../../../shared/ui/ImageUploadField';
import { assetUrl } from '../../../shared/api/uploads';

export function CombustiblePage() {
  const { data: equipos = [] } = useEquipos();
  const { data: registros = [], isLoading } = useCombustibleList();
  const crear = useCreateCombustible();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CombustibleFormInput, unknown, CombustibleForm>({
    resolver: zodResolver(combustibleFormSchema),
    defaultValues: { equipoId: '', litros: 0 },
  });

  const fotoUrl = watch('fotoUrl');

  const onSubmit = (values: CombustibleForm) => {
    crear.mutate(values, { onSuccess: () => reset({ equipoId: '', litros: 0, fotoUrl: undefined }) });
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Cargas de combustible</h1>
        <p className="text-sm text-muted-foreground">
          Registrá una carga con foto; el sistema calcula el rendimiento.
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

        <TextField
          label="Litros"
          type="number"
          step="0.1"
          inputMode="decimal"
          error={errors.litros?.message}
          {...register('litros')}
        />
        <TextField
          label="Lectura actual (horómetro)"
          type="number"
          step="0.1"
          inputMode="decimal"
          {...register('lecturaActual')}
        />
        <ImageUploadField
          label="Foto de la carga"
          value={fotoUrl}
          onChange={(url) => setValue('fotoUrl', url)}
        />

        <div className="sm:col-span-2">
          <Button type="submit" disabled={crear.isPending}>
            {crear.isPending ? 'Guardando…' : 'Registrar carga'}
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
                <th className="p-3">Foto</th>
                <th className="p-3">Equipo</th>
                <th className="p-3">Litros</th>
                <th className="p-3">Rendimiento</th>
                <th className="p-3">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {registros.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="p-3">
                    {r.fotoUrl ? (
                      <img
                        src={assetUrl(r.fotoUrl)}
                        alt="Carga"
                        className="h-10 w-10 rounded-lg border border-border object-cover"
                      />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-3">{r.equipo?.codigo ?? r.equipoId}</td>
                  <td className="p-3">{r.litros} L</td>
                  <td className="p-3">{r.rendimiento != null ? r.rendimiento : '—'}</td>
                  <td className="p-3 whitespace-nowrap">{new Date(r.fecha).toLocaleDateString()}</td>
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
