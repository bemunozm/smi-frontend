import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import {
  Button,
  Chip,
  FieldError,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  Spinner,
  Switch,
  Table,
  TextField,
} from '@heroui/react';
import { z } from 'zod';

import { useCurrentUser } from '../hooks/useCurrentUser';
import {
  useDesgloseInsumo,
  useSetStockMinimo,
  useStockSucursal,
} from '../hooks/useStock';
import { useSucursales } from '../hooks/useSucursales';
import { unidadSimbolo } from '../config/flota-colors';
import { ROLES } from '../types/roles';
import { sucursalPorDefecto, type Sucursal } from '../types/sucursal';
import {
  DISPONIBILIDAD_COLORS,
  DISPONIBILIDAD_LABELS,
  disponibilidad,
} from '../types/disponibilidad';
import {
  TIPOS_INSUMO,
  TIPO_INSUMO_LABELS,
  type StockEnSucursal,
  type TipoInsumo,
} from '../types/stock';

const NUMERO = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 });

/** Valor centinela del select: HeroUI no admite `''` como id de opción. */
const TODOS = '__todos__';

// --- Desglose "¿dónde está?" ----------------------------------------------

interface DesgloseModalProps {
  item: StockEnSucursal;
  sucursalActualId: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

/**
 * Responde la pregunta que sigue naturalmente a "acá no hay": ¿y dónde sí?
 * Sin esto, la pantalla informa un problema y deja al usuario sin el dato que
 * necesita para resolverlo.
 */
function DesgloseModal({
  item,
  sucursalActualId,
  isOpen,
  onOpenChange,
}: DesgloseModalProps) {
  // Se pide solo mientras el modal está abierto: son N consultas potenciales
  // sobre una tabla que el usuario casi nunca abre entera.
  const { data, isPending, isError, error } = useDesgloseInsumo(
    isOpen ? item.insumoId : null,
  );

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-lg">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading className="font-display text-xl font-semibold tracking-[-0.02em]">
                ¿Dónde hay {item.nombre}?
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              {isPending ? (
                <div className="flex justify-center py-10">
                  <Spinner color="accent" size="md" />
                </div>
              ) : null}

              {isError ? (
                <p className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger-soft-foreground">
                  {error instanceof Error
                    ? error.message
                    : 'No se pudo obtener el desglose.'}
                </p>
              ) : null}

              {data ? (
                <div className="flex flex-col gap-2">
                  {data.sucursales.map((fila) => (
                    <div
                      key={fila.sucursalId}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-foreground">
                          {fila.sucursalNombre}
                          {fila.sucursalId === sucursalActualId ? (
                            <span className="text-muted-foreground">
                              {' '}
                              · estás acá
                            </span>
                          ) : null}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {fila.sucursalCodigo} · mínimo{' '}
                          {NUMERO.format(fila.stockMinimo)}
                        </span>
                      </div>
                      <Chip
                        color={fila.bajoMinimo ? 'danger' : 'success'}
                        size="sm"
                        variant="soft"
                      >
                        {NUMERO.format(fila.stock)} {unidadSimbolo(data.unidad)}
                      </Chip>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">
                    Total en la empresa: {NUMERO.format(data.stockTotal)}{' '}
                    {unidadSimbolo(data.unidad)}
                  </p>
                </div>
              ) : null}
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

// --- Mínimo propio de la bodega -------------------------------------------

const MinimoFormSchema = z.object({
  stockMinimo: z
    .string()
    .min(1, 'Ingresa el mínimo')
    .refine((value) => Number.isFinite(Number(value)) && Number(value) >= 0, {
      message: 'Ingresa un número válido',
    }),
});
type MinimoFormValues = z.infer<typeof MinimoFormSchema>;

interface MinimoModalProps {
  item: StockEnSucursal;
  sucursalId: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

function MinimoModal({
  item,
  sucursalId,
  isOpen,
  onOpenChange,
}: MinimoModalProps) {
  const setMinimo = useSetStockMinimo();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<MinimoFormValues>({
    resolver: zodResolver(MinimoFormSchema),
    values: { stockMinimo: String(item.stockMinimo) },
  });

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-md">
            {({ close }) => {
              const onSubmit = (values: MinimoFormValues): void => {
                setMinimo.mutate(
                  {
                    insumoId: item.insumoId,
                    sucursalId,
                    stockMinimo: Number(values.stockMinimo),
                  },
                  { onSuccess: () => close() },
                );
              };

              return (
                <>
                  <Modal.CloseTrigger />
                  <Modal.Header>
                    <Modal.Heading className="font-display text-xl font-semibold tracking-[-0.02em]">
                      Mínimo de esta bodega
                    </Modal.Heading>
                  </Modal.Header>
                  <Modal.Body>
                    <form
                      className="flex flex-col gap-4"
                      id="set-minimo-form"
                      onSubmit={(event) => void handleSubmit(onSubmit)(event)}
                    >
                      <p className="text-sm text-muted-foreground">
                        {item.codigo} · {item.nombre}. Este umbral aplica solo a
                        esta sucursal. Déjalo en 0 para que use el mínimo global
                        del insumo.
                      </p>

                      <Controller
                        control={control}
                        name="stockMinimo"
                        render={({ field }) => (
                          <TextField
                            fullWidth
                            isInvalid={!!errors.stockMinimo}
                            name={field.name}
                            onBlur={field.onBlur}
                            onChange={field.onChange}
                            value={field.value}
                          >
                            <Label>
                              Stock mínimo ({unidadSimbolo(item.unidad)})
                            </Label>
                            <Input inputMode="decimal" placeholder="0" />
                            {errors.stockMinimo ? (
                              <FieldError>
                                {errors.stockMinimo.message}
                              </FieldError>
                            ) : null}
                          </TextField>
                        )}
                      />
                    </form>
                  </Modal.Body>
                  <Modal.Footer>
                    <Button variant="secondary" onPress={close}>
                      Cancelar
                    </Button>
                    <Button
                      form="set-minimo-form"
                      isPending={setMinimo.isPending}
                      type="submit"
                    >
                      {({ isPending }) =>
                        isPending ? (
                          <Spinner color="current" size="sm" />
                        ) : (
                          'Guardar'
                        )
                      }
                    </Button>
                  </Modal.Footer>
                </>
              );
            }}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

// --- Fila ------------------------------------------------------------------

interface FilaProps {
  item: StockEnSucursal;
  sucursalId: string;
  esAdmin: boolean;
}

function FilaStock({ item, sucursalId, esAdmin }: FilaProps) {
  const [verDesglose, setVerDesglose] = useState(false);
  const [editarMinimo, setEditarMinimo] = useState(false);
  const estado = disponibilidad(item.stock, item.stockTotal);

  return (
    <>
      <Table.Row>
        <Table.Cell>
          <Link
            className="font-mono text-sm font-medium text-(--accent) hover:underline"
            to={`/inventario/${item.insumoId}`}
          >
            {item.codigo}
          </Link>
        </Table.Cell>
        <Table.Cell>{item.nombre}</Table.Cell>
        <Table.Cell>
          <Chip size="sm" variant="secondary">
            {TIPO_INSUMO_LABELS[item.tipo]}
          </Chip>
        </Table.Cell>
        <Table.Cell className="font-mono text-sm">
          {NUMERO.format(item.stock)} {unidadSimbolo(item.unidad)}
        </Table.Cell>
        <Table.Cell className="font-mono text-sm text-muted-foreground">
          {NUMERO.format(item.stockTotal)}
        </Table.Cell>
        <Table.Cell className="font-mono text-sm text-muted-foreground">
          {NUMERO.format(item.stockMinimo)}
        </Table.Cell>
        <Table.Cell>
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip color={DISPONIBILIDAD_COLORS[estado]} size="sm" variant="soft">
              {DISPONIBILIDAD_LABELS[estado]}
            </Chip>
            {/* Reponer y no tener son cosas distintas: el ítem puede estar
                disponible hoy y aun así haber cruzado el mínimo de la bodega. */}
            {estado === 'en-bodega' && item.bajoMinimo ? (
              <Chip color="warning" size="sm" variant="soft">
                Bajo mínimo
              </Chip>
            ) : null}
          </div>
        </Table.Cell>
        <Table.Cell>
          <div className="flex justify-end gap-3">
            <button
              className="text-sm text-(--accent) hover:underline"
              type="button"
              onClick={() => setVerDesglose(true)}
            >
              ¿Dónde hay?
            </button>
            {esAdmin ? (
              <button
                className="text-sm text-muted-foreground hover:underline"
                type="button"
                onClick={() => setEditarMinimo(true)}
              >
                Mínimo
              </button>
            ) : null}
          </div>
        </Table.Cell>
      </Table.Row>

      {verDesglose ? (
        <DesgloseModal
          isOpen={verDesglose}
          item={item}
          sucursalActualId={sucursalId}
          onOpenChange={setVerDesglose}
        />
      ) : null}
      {editarMinimo ? (
        <MinimoModal
          isOpen={editarMinimo}
          item={item}
          sucursalId={sucursalId}
          onOpenChange={setEditarMinimo}
        />
      ) : null}
    </>
  );
}

// --- Vista -----------------------------------------------------------------

export function StockSucursalView() {
  const { user } = useCurrentUser();
  const esAdmin = user?.role === ROLES.ADMIN;

  const [sucursalId, setSucursalId] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [tipo, setTipo] = useState<TipoInsumo | typeof TODOS>(TODOS);
  const [soloBajoStock, setSoloBajoStock] = useState(false);
  const [soloEnBodega, setSoloEnBodega] = useState(false);

  const { data: sucursales } = useSucursales({ activa: true });

  // La bodega principal se preselecciona una sola vez, cuando llega la lista.
  // No se fuerza en cada render: eso pisaría la elección del usuario.
  useEffect(() => {
    if (sucursalId || !sucursales) return;
    const inicial = sucursalPorDefecto(sucursales);
    if (inicial) setSucursalId(inicial.id);
  }, [sucursales, sucursalId]);

  const { data, isPending, isError, error } = useStockSucursal({
    ...(sucursalId ? { sucursalId } : {}),
    ...(busqueda.trim() ? { q: busqueda.trim() } : {}),
    ...(tipo !== TODOS ? { tipo } : {}),
    ...(soloBajoStock ? { bajoStock: true } : {}),
    ...(soloEnBodega ? { soloEnBodega: true } : {}),
  });

  const items = useMemo(() => data?.items ?? [], [data]);

  // Los contadores salen de las filas ya traídas y no de un endpoint aparte:
  // el resumen agregado por sucursal es el alcance de PROD-14 (Benjamín), y
  // adelantarlo acá sería construir su ticket a medias.
  const resumen = useMemo(() => {
    const bajoMinimo = items.filter((item) => item.bajoMinimo).length;
    const enOtra = items.filter(
      (item) => disponibilidad(item.stock, item.stockTotal) === 'en-otra',
    ).length;
    return { total: items.length, bajoMinimo, enOtra };
  }, [items]);

  const sucursalActual: Sucursal | undefined = sucursales?.find(
    (sucursal) => sucursal.id === sucursalId,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium tracking-[0.14em] text-(--eyebrow-color) uppercase">
          SMI · Inventario
        </span>
        <h1 className="font-display text-[28px] font-semibold tracking-[-0.03em] text-foreground">
          Stock por sucursal
        </h1>
        <p className="text-sm text-(--muted)">
          Qué suministros y repuestos hay en cada bodega, y dónde está lo que
          falta acá.
        </p>
      </div>

      {data ? (
        <div className="flex flex-wrap items-center gap-2">
          <Chip size="sm" variant="secondary">
            {resumen.total} ítems
          </Chip>
          <Chip
            color={resumen.bajoMinimo > 0 ? 'danger' : 'success'}
            size="sm"
            variant="soft"
          >
            {resumen.bajoMinimo} bajo el mínimo acá
          </Chip>
          {resumen.enOtra > 0 ? (
            <Chip color="warning" size="sm" variant="soft">
              {resumen.enOtra} disponibles en otra sucursal
            </Chip>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-4">
        <Select
          className="w-full sm:w-56"
          value={sucursalId}
          onChange={(value) => {
            if (value) setSucursalId(String(value));
          }}
        >
          <Label>Sucursal</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {(sucursales ?? []).map((sucursal) => (
                <ListBox.Item
                  key={sucursal.id}
                  id={sucursal.id}
                  textValue={sucursal.nombre}
                >
                  {sucursal.nombre}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>

        <TextField
          className="w-full sm:w-64"
          aria-label="Buscar insumo"
          value={busqueda}
          onChange={setBusqueda}
        >
          <Label>Buscar</Label>
          <Input placeholder="Código o nombre" />
        </TextField>

        <Select
          className="w-full sm:w-44"
          value={tipo}
          onChange={(value) => {
            if (value) setTipo(String(value) as TipoInsumo | typeof TODOS);
          }}
        >
          <Label>Tipo</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id={TODOS} textValue="Todos">
                Todos
                <ListBox.ItemIndicator />
              </ListBox.Item>
              {TIPOS_INSUMO.map((valor) => (
                <ListBox.Item
                  key={valor}
                  id={valor}
                  textValue={TIPO_INSUMO_LABELS[valor]}
                >
                  {TIPO_INSUMO_LABELS[valor]}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>

        <Switch
          className="pb-2.5"
          isSelected={soloBajoStock}
          onChange={setSoloBajoStock}
        >
          Solo bajo mínimo
        </Switch>

        <Switch
          className="pb-2.5"
          isSelected={soloEnBodega}
          onChange={setSoloEnBodega}
        >
          Solo lo que maneja esta bodega
        </Switch>
      </div>

      {sucursalActual?.direccion ? (
        <p className="text-xs text-muted-foreground">
          {sucursalActual.codigo} · {sucursalActual.direccion}
        </p>
      ) : null}

      {isPending ? (
        <div className="flex justify-center py-16">
          <Spinner color="accent" size="lg" />
        </div>
      ) : null}

      {isError ? (
        <div className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger-soft-foreground">
          {error instanceof Error
            ? error.message
            : 'No se pudo obtener el stock de la sucursal.'}
        </div>
      ) : null}

      {data && items.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-sm font-medium text-foreground">
            No hay ítems que coincidan
          </p>
          <p className="text-sm text-(--muted)">
            Ajusta los filtros o cambia de sucursal.
          </p>
        </div>
      ) : null}

      {data && items.length > 0 ? (
        <Table variant="secondary">
          <Table.ScrollContainer>
            <Table.Content
              aria-label="Stock por sucursal"
              className="min-w-230"
            >
              <Table.Header>
                <Table.Column isRowHeader>Código</Table.Column>
                <Table.Column>Nombre</Table.Column>
                <Table.Column>Tipo</Table.Column>
                <Table.Column>Stock acá</Table.Column>
                <Table.Column>Total empresa</Table.Column>
                <Table.Column>Mínimo</Table.Column>
                <Table.Column>Estado</Table.Column>
                <Table.Column>Acciones</Table.Column>
              </Table.Header>
              <Table.Body>
                {items.map((item) => (
                  <FilaStock
                    key={item.insumoId}
                    esAdmin={esAdmin}
                    item={item}
                    sucursalId={data.sucursalId}
                  />
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      ) : null}
    </div>
  );
}
