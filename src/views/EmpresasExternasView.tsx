import { useMemo, useState } from 'react';
import { AlertDialog, Button, Card, Input, Label, Modal, Spinner, TextField } from '@heroui/react';
import { Chip } from '../components/ui/Chip';
import { SortControl, type SortOption } from '../components/ui/SortControl';
import { compareText, sortRows, type SortColumn, type TableSort } from '../lib/table-sort';

import {
  useActualizarEmpresaExterna,
  useCrearEmpresaExterna,
  useEliminarEmpresaExterna,
  useEmpresasExternasAdmin,
} from '../hooks/useReporteDiario';
import type { EmpresaExternaAdmin } from '../types/reporte-diario';

/** Nombre limpio: sin espacios de más (mismo criterio que el backend). */
function limpiar(nombre: string): string {
  return nombre.trim().replace(/\s+/g, ' ');
}

const byName = (a: EmpresaExternaAdmin, b: EmpresaExternaAdmin): number => compareText(a.nombre, b.nombre);

/** Esta vista es una lista (sin títulos de columna): el orden se elige con «Ordenar por». */
const COLUMNAS_ORDEN: Record<string, SortColumn<EmpresaExternaAdmin>> = {
  nombre: { kind: 'text', value: (e) => e.nombre },
  reportes: { kind: 'number', value: (e) => e.reportes, tiebreak: byName },
};

const OPCIONES_ORDEN: SortOption[] = [
  { id: 'nombre', label: 'Nombre' },
  { id: 'reportes', label: 'Reportes en que sale' },
];

const ORDEN_INICIAL: TableSort = { column: 'nombre', direction: 'ascending' };

function usosTexto(reportes: number): string {
  if (reportes === 0) return 'Sin reportes todavía';
  return `En ${reportes} ${reportes === 1 ? 'reporte' : 'reportes'}`;
}

/**
 * Empresas externas (contratistas) que el supervisor marca en el reporte
 * diario de producción («Empresas externas del turno»). Pedido del cliente
 * (16/11/2026): el administrador las agrega, renombra y quita.
 *
 * Quitar una que ya sale en reportes no la borra (esos reportes la nombran):
 * la desactiva. Deja de salirle al supervisor y se puede reactivar.
 */
export function EmpresasExternasView() {
  const { data, isPending, isError, error } = useEmpresasExternasAdmin();
  const crear = useCrearEmpresaExterna();
  const actualizar = useActualizarEmpresaExterna();
  const eliminar = useEliminarEmpresaExterna();

  const [nueva, setNueva] = useState('');
  const [editando, setEditando] = useState<EmpresaExternaAdmin | null>(null);
  const [nombreEdicion, setNombreEdicion] = useState('');
  const [quitando, setQuitando] = useState<EmpresaExternaAdmin | null>(null);

  const [orden, setOrden] = useState<TableSort>(ORDEN_INICIAL);
  // Primero la separación activas/desactivadas y después el orden elegido.
  const activas = useMemo(
    () => sortRows((data ?? []).filter((e) => e.activa), orden, COLUMNAS_ORDEN),
    [data, orden],
  );
  const inactivas = useMemo(
    () => sortRows((data ?? []).filter((e) => !e.activa), orden, COLUMNAS_ORDEN),
    [data, orden],
  );

  const agregar = () => {
    const nombre = limpiar(nueva);
    if (!nombre) return;
    crear.mutate(nombre, { onSuccess: () => setNueva('') });
  };

  const abrirEdicion = (empresa: EmpresaExternaAdmin) => {
    setEditando(empresa);
    setNombreEdicion(empresa.nombre);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium tracking-[0.14em] text-(--eyebrow-color) uppercase">
          SMI · Administración
        </span>
        <h1 className="font-display text-[28px] font-semibold tracking-[-0.03em] text-foreground">Empresas externas</h1>
        <p className="text-sm text-muted-foreground">
          Las contratistas que el supervisor marca en el Informe de producción diaria («Empresas externas del turno»).
          Lo que agregues o quites acá es lo que le aparece al supervisor.
        </p>
      </div>

      <Card>
        <Card.Header>
          <Card.Title>Agregar empresa</Card.Title>
        </Card.Header>
        <Card.Content>
          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              agregar();
            }}
          >
            <TextField className="sm:max-w-sm" fullWidth onChange={setNueva} value={nueva}>
              <Label>Nombre de la empresa</Label>
              <Input maxLength={60} placeholder=" " />
            </TextField>
            <Button isDisabled={limpiar(nueva) === '' || crear.isPending} isPending={crear.isPending} type="submit">
              {crear.isPending ? <Spinner color="current" size="sm" /> : 'Agregar'}
            </Button>
          </form>
        </Card.Content>
      </Card>

      <Card>
        <Card.Header>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <Card.Title>Empresas activas</Card.Title>
              <Card.Description>
                Las que ve el supervisor al cargar el reporte del turno. Ordenadas por{' '}
                {orden.column === 'reportes' ? 'cantidad de reportes' : 'nombre'}
                {orden.direction === 'ascending' ? ' (ascendente)' : ' (descendente)'}; cámbialo con «Ordenar por».
              </Card.Description>
            </div>
            <Chip color="accent" data-testid="total-activas" size="md" variant="soft">
              {activas.length} {activas.length === 1 ? 'empresa' : 'empresas'}
            </Chip>
          </div>
        </Card.Header>
        <Card.Content>
          {isPending ? (
            <div className="flex justify-center py-8">
              <Spinner color="accent" size="sm" />
            </div>
          ) : null}
          {isError ? (
            <p className="text-sm text-danger-soft-foreground" role="alert">
              {error instanceof Error ? error.message : 'No se pudieron cargar las empresas externas.'}
            </p>
          ) : null}
          {!isPending && !isError && activas.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">No hay empresas activas. Agrega la primera arriba.</p>
          ) : null}
          {!isPending && !isError && data && data.length > 1 ? (
            <SortControl onChange={setOrden} options={OPCIONES_ORDEN} sort={orden} />
          ) : null}
          <ul className="m-0 flex list-none flex-col p-0">
            {activas.map((empresa) => (
              <li
                className="flex flex-wrap items-center gap-3 border-t border-border py-3 first:border-t-0"
                data-testid={`empresa-${empresa.id}`}
                key={empresa.id}
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-semibold text-foreground">{empresa.nombre}</span>
                  <span className="text-xs text-muted-foreground">{usosTexto(empresa.reportes)}</span>
                </div>
                <Button onPress={() => abrirEdicion(empresa)} size="sm" variant="tertiary">
                  Editar
                </Button>
                <Button onPress={() => setQuitando(empresa)} size="sm" variant="danger-soft">
                  {empresa.reportes > 0 ? 'Desactivar' : 'Eliminar'}
                </Button>
              </li>
            ))}
          </ul>
        </Card.Content>
      </Card>

      {inactivas.length > 0 ? (
        <Card>
          <Card.Header>
            <Card.Title>Desactivadas</Card.Title>
            <Card.Description>
              Ya no le salen al supervisor, pero los reportes anteriores las conservan. Puedes reactivarlas.
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <ul className="m-0 flex list-none flex-col p-0">
              {inactivas.map((empresa) => (
                <li
                  className="flex flex-wrap items-center gap-3 border-t border-border py-3 first:border-t-0"
                  data-testid={`empresa-${empresa.id}`}
                  key={empresa.id}
                >
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm text-muted-foreground">{empresa.nombre}</span>
                    <span className="text-xs text-muted-foreground">{usosTexto(empresa.reportes)}</span>
                  </div>
                  <Button
                    isDisabled={actualizar.isPending}
                    onPress={() => actualizar.mutate({ id: empresa.id, activa: true })}
                    size="sm"
                    variant="secondary"
                  >
                    Reactivar
                  </Button>
                </li>
              ))}
            </ul>
          </Card.Content>
        </Card>
      ) : null}

      <Modal.Backdrop
        isOpen={editando !== null}
        onOpenChange={(open) => {
          if (!open) setEditando(null);
        }}
      >
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-md">
            {({ close }) => (
              <>
                <Modal.CloseTrigger />
                <Modal.Header>
                  <Modal.Heading className="font-display text-xl font-semibold tracking-[-0.02em]">
                    Editar empresa
                  </Modal.Heading>
                </Modal.Header>
                <Modal.Body>
                  <form
                    id="editar-empresa-form"
                    noValidate
                    onSubmit={(e) => {
                      e.preventDefault();
                      const nombre = limpiar(nombreEdicion);
                      if (!editando || !nombre) return;
                      actualizar.mutate({ id: editando.id, nombre }, { onSuccess: () => close() });
                    }}
                  >
                    <TextField fullWidth onChange={setNombreEdicion} value={nombreEdicion}>
                      <Label>Nombre de la empresa</Label>
                      <Input autoFocus maxLength={60} placeholder=" " />
                    </TextField>
                    {editando && editando.reportes > 0 ? (
                      <p className="mt-2 mb-0 text-xs text-muted-foreground">
                        Los {editando.reportes} reportes que ya la marcaron pasan a mostrar el nombre nuevo.
                      </p>
                    ) : null}
                  </form>
                </Modal.Body>
                <Modal.Footer>
                  <Button onPress={close} variant="tertiary">
                    Cancelar
                  </Button>
                  <Button
                    form="editar-empresa-form"
                    isDisabled={limpiar(nombreEdicion) === '' || actualizar.isPending}
                    isPending={actualizar.isPending}
                    type="submit"
                  >
                    Guardar
                  </Button>
                </Modal.Footer>
              </>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      <AlertDialog.Backdrop
        isOpen={quitando !== null}
        onOpenChange={(open) => {
          if (!open) setQuitando(null);
        }}
      >
        <AlertDialog.Container>
          <AlertDialog.Dialog className="sm:max-w-105">
            {({ close }) => (
              <>
                <AlertDialog.CloseTrigger />
                <AlertDialog.Header>
                  <AlertDialog.Icon status="danger" />
                  <AlertDialog.Heading>
                    {quitando && quitando.reportes > 0 ? '¿Desactivar' : '¿Eliminar'} {quitando?.nombre ?? 'la empresa'}?
                  </AlertDialog.Heading>
                </AlertDialog.Header>
                <AlertDialog.Body>
                  <p>
                    {quitando && quitando.reportes > 0
                      ? `Ya sale en ${quitando.reportes} ${quitando.reportes === 1 ? 'reporte' : 'reportes'}, así que no se borra: deja de aparecerle al supervisor y esos reportes la conservan. Puedes reactivarla después.`
                      : 'Deja de aparecerle al supervisor en el reporte diario. No tiene reportes, así que se borra.'}
                  </p>
                </AlertDialog.Body>
                <AlertDialog.Footer>
                  <Button onPress={close} variant="tertiary">
                    Cancelar
                  </Button>
                  <Button
                    isPending={eliminar.isPending}
                    onPress={() => {
                      if (!quitando) return;
                      eliminar.mutate(quitando.id, {
                        onSuccess: () => {
                          close();
                          setQuitando(null);
                        },
                      });
                    }}
                    variant="danger"
                  >
                    {quitando && quitando.reportes > 0 ? 'Desactivar' : 'Eliminar'}
                  </Button>
                </AlertDialog.Footer>
              </>
            )}
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </div>
  );
}
