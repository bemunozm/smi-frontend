import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Chip, Table } from '@heroui/react';
import { hallazgoFormSchema, CRITICIDADES, type HallazgoForm } from './schema';
import { useHallazgosList, useCreateHallazgo } from './hooks';
import { useEquipos } from '../../../shared/hooks/useEquipos';
import { FormSelectField, FormTextField } from '../../../shared/ui/form';
import { ImageUploadField } from '../../../shared/ui/ImageUploadField';

type ChipColor = 'default' | 'warning' | 'danger' | 'success' | 'accent';

const critColor: Record<string, ChipColor> = {
  BAJA: 'default',
  MEDIA: 'warning',
  ALTA: 'danger',
  CRITICA: 'danger',
};

const estadoColor: Record<string, ChipColor> = {
  ABIERTO: 'danger',
  EN_PROCESO: 'warning',
  CERRADO: 'default',
};

const CRITICIDAD_ITEMS = CRITICIDADES.map((c) => ({ value: c, label: c }));

export function HallazgosPage() {
  const { data: equipos = [] } = useEquipos();
  const { data: hallazgos = [], isLoading } = useHallazgosList();
  const crear = useCreateHallazgo();

  const { control, handleSubmit, reset, setValue, watch } = useForm<HallazgoForm>({
    resolver: zodResolver(hallazgoFormSchema),
    defaultValues: { equipoId: '', descripcion: '', criticidad: 'MEDIA' },
  });

  const fotoUrl = watch('fotoUrl');
  const equipoItems = equipos.map((e) => ({ value: e.id, label: `${e.codigo} — ${e.modelo}` }));

  const onSubmit = (values: HallazgoForm) =>
    crear.mutate(values, {
      onSuccess: () => reset({ equipoId: '', descripcion: '', criticidad: 'MEDIA', fotoUrl: undefined }),
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
        <FormSelectField control={control} name="equipoId" label="Equipo" items={equipoItems} />
        <FormSelectField control={control} name="criticidad" label="Criticidad" items={CRITICIDAD_ITEMS} />
        <FormTextField control={control} name="descripcion" label="Descripción" className="sm:col-span-2" />
        <ImageUploadField label="Foto (opcional)" value={fotoUrl} onChange={(url) => setValue('fotoUrl', url)} />

        <div className="sm:col-span-2">
          <Button type="submit" variant="primary" isDisabled={crear.isPending}>
            {crear.isPending ? 'Guardando…' : 'Registrar hallazgo'}
          </Button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-(--radius) border border-border bg-card">
        {isLoading ? (
          <p className="p-4 text-muted-foreground">Cargando…</p>
        ) : (
          <Table className="w-full">
            <Table.Content aria-label="Hallazgos">
              <Table.Header>
                <Table.Column id="equipo" isRowHeader>
                  Equipo
                </Table.Column>
                <Table.Column id="descripcion">Descripción</Table.Column>
                <Table.Column id="criticidad">Criticidad</Table.Column>
                <Table.Column id="estado">Estado</Table.Column>
                <Table.Column id="fecha">Fecha</Table.Column>
              </Table.Header>
              <Table.Body items={hallazgos} renderEmptyState={() => 'Sin hallazgos.'}>
                {(h) => (
                  <Table.Row id={h.id}>
                    <Table.Cell>{h.equipo?.codigo ?? h.equipoId}</Table.Cell>
                    <Table.Cell>{h.descripcion}</Table.Cell>
                    <Table.Cell>
                      <Chip color={critColor[h.criticidad] ?? 'default'} variant="soft" size="sm">
                        {h.criticidad}
                      </Chip>
                    </Table.Cell>
                    <Table.Cell>
                      <Chip color={estadoColor[h.estado] ?? 'default'} variant="soft" size="sm">
                        {h.estado}
                      </Chip>
                    </Table.Cell>
                    <Table.Cell>{new Date(h.fecha).toLocaleDateString()}</Table.Cell>
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
