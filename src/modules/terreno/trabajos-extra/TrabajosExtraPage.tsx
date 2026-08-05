import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Table } from '@heroui/react';
import { trabajoExtraFormSchema, calcMonto, type TrabajoExtraForm } from './schema';
import { useTrabajosExtraList, useCreateTrabajoExtra } from './hooks';
import { useEquipos } from '../../../shared/hooks/useEquipos';
import { FormNumberField, FormSelectField, FormTextField } from '../../../shared/ui/form';

const money = (n: number) => n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });

export function TrabajosExtraPage() {
  const { data: equipos = [] } = useEquipos();
  const { data: registros = [], isLoading } = useTrabajosExtraList();
  const crear = useCreateTrabajoExtra();

  const { control, handleSubmit, reset } = useForm<TrabajoExtraForm>({
    resolver: zodResolver(trabajoExtraFormSchema),
    defaultValues: { equipoId: '', cliente: '', horasMaquina: 0, tarifa: 0 },
  });

  const equipoItems = equipos.map((e) => ({ value: e.id, label: `${e.codigo} — ${e.modelo}` }));
  const horas = useWatch({ control, name: 'horasMaquina' }) ?? 0;
  const tarifa = useWatch({ control, name: 'tarifa' }) ?? 0;
  const montoPreview = calcMonto(Number(horas) || 0, Number(tarifa) || 0);

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
        <FormSelectField control={control} name="equipoId" label="Equipo" items={equipoItems} />
        <FormTextField control={control} name="cliente" label="Cliente" />
        <FormNumberField control={control} name="horasMaquina" label="Horas máquina" minValue={0} step={0.1} />
        <FormNumberField control={control} name="tonelaje" label="Tonelaje (opcional)" minValue={0} step={0.1} />
        <FormNumberField control={control} name="tarifa" label="Tarifa" minValue={0} step={1} />

        <div className="flex items-end">
          <div className="rounded-lg bg-muted px-4 py-2 text-sm">
            Monto estimado: <span className="font-semibold text-primary">{money(montoPreview)}</span>
          </div>
        </div>

        <div className="sm:col-span-2">
          <Button type="submit" variant="primary" isDisabled={crear.isPending}>
            {crear.isPending ? 'Guardando…' : 'Registrar trabajo'}
          </Button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-(--radius) border border-border bg-card">
        {isLoading ? (
          <p className="p-4 text-muted-foreground">Cargando…</p>
        ) : (
          <Table className="w-full">
            <Table.Content aria-label="Trabajos extraordinarios">
              <Table.Header>
                <Table.Column id="equipo" isRowHeader>
                  Equipo
                </Table.Column>
                <Table.Column id="cliente">Cliente</Table.Column>
                <Table.Column id="horas">Horas</Table.Column>
                <Table.Column id="monto">Monto</Table.Column>
                <Table.Column id="fecha">Fecha</Table.Column>
              </Table.Header>
              <Table.Body items={registros} renderEmptyState={() => 'Sin registros.'}>
                {(r) => (
                  <Table.Row id={r.id}>
                    <Table.Cell>{r.equipo?.codigo ?? r.equipoId}</Table.Cell>
                    <Table.Cell>{r.cliente}</Table.Cell>
                    <Table.Cell>{r.horasMaquina}</Table.Cell>
                    <Table.Cell>{money(r.monto)}</Table.Cell>
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
