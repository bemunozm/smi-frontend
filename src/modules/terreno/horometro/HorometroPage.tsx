import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Table } from '@heroui/react';
import { horometroFormSchema, type HorometroForm } from './schema';
import { useHorometroList, useCreateHorometro } from './hooks';
import { useEquipos } from '../../../shared/hooks/useEquipos';
import { FormNumberField, FormSelectField, FormTextField } from '../../../shared/ui/form';

const TURNO_ITEMS = ['MANANA', 'TARDE', 'NOCHE'].map((t) => ({ value: t, label: t }));

export function HorometroPage() {
  const { data: equipos = [] } = useEquipos();
  const { data: registros = [], isLoading } = useHorometroList();
  const crear = useCreateHorometro();

  const { control, handleSubmit, reset } = useForm<HorometroForm>({
    resolver: zodResolver(horometroFormSchema),
    defaultValues: { equipoId: '', operadorId: '', turno: 'MANANA', valorInicial: 0 },
  });

  const equipoItems = equipos.map((e) => ({ value: e.id, label: `${e.codigo} — ${e.modelo}` }));

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
        className="grid gap-4 rounded-3xl border border-border bg-card shadow-[var(--shadow-card)] p-4 sm:grid-cols-2"
      >
        <FormSelectField control={control} name="equipoId" label="Equipo" items={equipoItems} />
        <FormSelectField control={control} name="turno" label="Turno" items={TURNO_ITEMS} />
        <FormTextField control={control} name="operadorId" label="Operador (id)" />
        <FormNumberField control={control} name="valorInicial" label="Valor inicial" minValue={0} step={0.1} />
        <FormNumberField control={control} name="valorFinal" label="Valor final (cierra turno)" minValue={0} step={0.1} />

        <div className="sm:col-span-2">
          <Button type="submit" variant="primary" isDisabled={crear.isPending}>
            {crear.isPending ? 'Guardando…' : 'Registrar lectura'}
          </Button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-3xl border border-border bg-card shadow-[var(--shadow-card)]">
        {isLoading ? (
          <p className="p-4 text-muted-foreground">Cargando…</p>
        ) : (
          <Table className="w-full">
            <Table.Content aria-label="Registros de horómetro">
              <Table.Header>
                <Table.Column id="equipo" isRowHeader>
                  Equipo
                </Table.Column>
                <Table.Column id="turno">Turno</Table.Column>
                <Table.Column id="inicial">Inicial</Table.Column>
                <Table.Column id="final">Final</Table.Column>
                <Table.Column id="fecha">Fecha</Table.Column>
              </Table.Header>
              <Table.Body items={registros} renderEmptyState={() => 'Sin registros.'}>
                {(r) => (
                  <Table.Row id={r.id}>
                    <Table.Cell className="tabular font-medium">{r.equipo?.codigo ?? r.equipoId}</Table.Cell>
                    <Table.Cell>{r.turno}</Table.Cell>
                    <Table.Cell className="tabular">{r.valorInicial}</Table.Cell>
                    <Table.Cell className="tabular">{r.valorFinal ?? '— (abierto)'}</Table.Cell>
                    <Table.Cell className="tabular text-muted-foreground">
                      {new Date(r.fecha).toLocaleDateString()}
                    </Table.Cell>
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
