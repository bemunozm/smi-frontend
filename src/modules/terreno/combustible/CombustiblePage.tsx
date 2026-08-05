import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Table } from '@heroui/react';
import { combustibleFormSchema, type CombustibleForm } from './schema';
import { useCombustibleList, useCreateCombustible } from './hooks';
import { useEquipos } from '../../../shared/hooks/useEquipos';
import { FormNumberField, FormSelectField } from '../../../shared/ui/form';
import { ImageUploadField } from '../../../shared/ui/ImageUploadField';
import { assetUrl } from '../../../shared/api/uploads';

export function CombustiblePage() {
  const { data: equipos = [] } = useEquipos();
  const { data: registros = [], isLoading } = useCombustibleList();
  const crear = useCreateCombustible();

  const { control, handleSubmit, reset, setValue, watch } = useForm<CombustibleForm>({
    resolver: zodResolver(combustibleFormSchema),
    defaultValues: { equipoId: '', litros: 0 },
  });

  const fotoUrl = watch('fotoUrl');
  const equipoItems = equipos.map((e) => ({ value: e.id, label: `${e.codigo} — ${e.modelo}` }));

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
        <FormSelectField control={control} name="equipoId" label="Equipo" items={equipoItems} />
        <FormNumberField control={control} name="litros" label="Litros" minValue={0} step={0.1} />
        <FormNumberField control={control} name="lecturaActual" label="Lectura actual (horómetro)" minValue={0} step={0.1} />
        <ImageUploadField label="Foto de la carga" value={fotoUrl} onChange={(url) => setValue('fotoUrl', url)} />

        <div className="sm:col-span-2">
          <Button type="submit" variant="primary" isDisabled={crear.isPending}>
            {crear.isPending ? 'Guardando…' : 'Registrar carga'}
          </Button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-(--radius) border border-border bg-card">
        {isLoading ? (
          <p className="p-4 text-muted-foreground">Cargando…</p>
        ) : (
          <Table className="w-full">
            <Table.Content aria-label="Cargas de combustible">
              <Table.Header>
                <Table.Column id="foto">Foto</Table.Column>
                <Table.Column id="equipo" isRowHeader>
                  Equipo
                </Table.Column>
                <Table.Column id="litros">Litros</Table.Column>
                <Table.Column id="rendimiento">Rendimiento</Table.Column>
                <Table.Column id="fecha">Fecha</Table.Column>
              </Table.Header>
              <Table.Body items={registros} renderEmptyState={() => 'Sin registros.'}>
                {(r) => (
                  <Table.Row id={r.id}>
                    <Table.Cell>
                      {r.fotoUrl ? (
                        <img
                          src={assetUrl(r.fotoUrl)}
                          alt="Carga"
                          className="h-10 w-10 rounded-lg border border-border object-cover"
                        />
                      ) : (
                        '—'
                      )}
                    </Table.Cell>
                    <Table.Cell>{r.equipo?.codigo ?? r.equipoId}</Table.Cell>
                    <Table.Cell>{r.litros} L</Table.Cell>
                    <Table.Cell>{r.rendimiento != null ? r.rendimiento : '—'}</Table.Cell>
                    <Table.Cell>{new Date(r.fecha).toLocaleDateString()}</Table.Cell>
                  </Table.Row>
                )}
              </Table.Body>
            </Table.Content>
          </Table>
        )}
      </div>
    </div>
  );
}
