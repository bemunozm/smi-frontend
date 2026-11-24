import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from '@heroui/react';

import {
  InventoryAPI,
  type ItemFilters,
  type MovementFilters,
} from '../api/InventoryAPI';
import { DomainError } from '../lib/api-error';
import { parseDecimal } from '../lib/decimal';
import { generateUuid } from '../lib/uuid';
import { pickFields } from '../lib/edit-diff';
import { mensajeErrorFormulario } from '../lib/error-messages';
import { avisarGuardadoEnCola } from '../lib/outbox-feedback';
import { INVENTORY_KEY } from '../lib/query-keys';
import { buildQueuedEdit } from '../lib/queued-edit';
import { existenciaConPendientes } from '../lib/stock-pending';
import { itemEntity } from '../offline/db';
import type { TransferStockBody } from '../offline/endpoints/inventario';
import { escriturasPendientes } from '../offline/outbox';
import {
  UNIT_SYMBOLS,
  type AdjustStockInput,
  type CompatibilityEntry,
  type CreateItemInput,
  type CreateMovementInput,
  type ItemFields,
  type InventoryItem,
  type UpdateItemInput,
} from '../types/inventory';
import { useQueuedCreate, useQueuedDelete, useQueuedMutation, writeQueued } from './useQueuedMutation';

export function useItems(filters: ItemFilters = {}) {
  return useQuery({
    queryKey: [...INVENTORY_KEY, 'items', filters],
    queryFn: () => InventoryAPI.listItems(filters),
  });
}

/** «Consumido por»: equipos que han gastado el ítem (salidas imputadas a un equipo). */
export function useItemConsumers(itemId: string | null) {
  return useQuery({
    queryKey: [...INVENTORY_KEY, 'consumers', itemId],
    queryFn: () => InventoryAPI.consumers(itemId ?? ''),
    enabled: !!itemId,
  });
}

/** ¿Es el mismo set de equipos (con las mismas notas)? Sin importar el orden. */
export function sameEquipments(a: readonly CompatibilityEntry[], b: readonly CompatibilityEntry[]): boolean {
  if (a.length !== b.length) return false;
  const notes = new Map(a.map((entry) => [entry.equipmentId, (entry.note ?? '').trim()]));
  return b.every((entry) => notes.get(entry.equipmentId) === (entry.note ?? '').trim());
}

/** Los equipos de un ítem como entradas del PUT (la nota vacía se omite). */
export function toCompatibilityEntries(item: Pick<InventoryItem, 'compatibilities'>): CompatibilityEntry[] {
  return item.compatibilities.map((c) => ({ equipmentId: c.equipmentId, ...(c.note ? { note: c.note } : {}) }));
}

/**
 * Historial de TODO el inventario. Comparte la raíz `['inventory']` con el
 * resto para que cualquier movimiento lo invalide junto con los saldos: si el
 * listado se actualiza y el historial no, quedan contándose cosas distintas.
 */
export function useMovements(filters: MovementFilters = {}) {
  return useQuery({
    queryKey: [...INVENTORY_KEY, 'movements', filters],
    queryFn: () => InventoryAPI.listMovements(filters),
  });
}

export function useKardex(itemId: string | null, branchId?: string) {
  return useQuery({
    queryKey: [...INVENTORY_KEY, 'kardex', itemId, branchId ?? null],
    queryFn: () => InventoryAPI.kardex(itemId ?? '', branchId),
    enabled: !!itemId,
  });
}

/* Las escrituras van por la cola (`useQueuedMutation`). Al terminar, el replay
 * invalida todo `['inventory', ...]`: cualquier movimiento cambia a la vez el
 * saldo del listado y el kardex del ítem; invalidar solo uno dejaría la
 * pantalla mostrando cifras que ya no cuadran entre sí. */

export function useCreateItem() {
  return useQueuedCreate<'item.create', CreateItemInput>({
    endpoint: 'item.create',
    build: (input, id) => ({ params: {}, body: { ...input, id } }),
    onSent: (item, input) => {
      toast.success('Ítem creado', { description: item ? `${item.sku} · ${item.name}` : input.name });
    },
    errorFallback: 'No se pudo crear el ítem.',
  });
}

export interface CreateItemWithMinimumsVars {
  input: CreateItemInput;
  /** Lo escrito en cada bodega (`branchId` → texto del campo); vacío o 0 = sin mínimo. */
  minimums: Record<string, string>;
  /** Equipos asignados desde el alta; se guardan detrás de ella (el `id` lo genera el cliente). */
  equipments?: CompatibilityEntry[];
}

/**
 * Alta del ítem con su stock mínimo por bodega, en el mismo formulario. Igual
 * que la edición (`useSaveItemWithMinimums`) son escrituras distintas — el alta
 * y un PUT de mínimo por bodega — pero el `id` del ítem lo genera el cliente,
 * así que los mínimos se encolan detrás del alta apuntando a ese id y el replay
 * (FIFO) los manda después, con o sin señal. Si el alta falla, los mínimos ni se
 * intentan; si falla un mínimo, el ítem ya quedó creado y el aviso lo dice.
 */
export function useCreateItemWithMinimums() {
  return useMutation<
    { sku?: string; guardadoEnCola: boolean; fallos: unknown[]; conEquipos: boolean },
    Error,
    CreateItemWithMinimumsVars
  >({
    mutationFn: async ({ input, minimums, equipments = [] }) => {
      const id = generateUuid();
      const alta = await writeQueued('item.create', { params: {}, body: { ...input, id } });
      const asignacion =
        equipments.length > 0
          ? [writeQueued('itemCompatibility.save', { params: { id }, body: { entries: equipments } })]
          : [];
      const minimos = Object.entries(minimums).flatMap(([branchId, texto]) => {
        const valor = parseDecimal(texto);
        return valor != null && valor > 0 ? [{ branchId, minimumQuantity: valor }] : [];
      });
      const resultados = await Promise.allSettled([
        ...asignacion,
        ...minimos.map((minimo) => writeQueued('item.setMinimum', { params: {}, body: { itemId: id, ...minimo } })),
      ]);
      const fallos = resultados.flatMap((r) => (r.status === 'rejected' ? [r.reason as unknown] : []));
      const estados = [alta, ...resultados.map((r) => (r.status === 'fulfilled' ? r.value : null))];
      return {
        sku: alta.status === 'sent' ? alta.data?.sku : undefined,
        guardadoEnCola: estados.some((e) => e?.status === 'queued'),
        fallos,
        conEquipos: equipments.length > 0,
      };
    },
    onSuccess: ({ sku, guardadoEnCola, fallos, conEquipos }, { input }) => {
      if (fallos.length > 0) {
        toast.warning(`Ítem creado, pero no se guardó el stock mínimo${conEquipos ? ' o los equipos' : ''}`, {
          description: mensajeErrorFormulario(fallos[0], 'No se pudo guardar el mínimo.'),
        });
      } else if (guardadoEnCola) {
        avisarGuardadoEnCola();
      } else {
        toast.success('Ítem creado', { description: sku ? `${sku} · ${input.name}` : input.name });
      }
    },
    onError: (error) => {
      toast.danger(mensajeErrorFormulario(error, 'No se pudo crear el ítem.'));
    },
  });
}

const CAMPOS_DE_ITEM = [
  'name',
  'description',
  'unit',
  'contentPerUnit',
  'contentUnit',
  'type',
  'categoryId',
  'partNumber',
  'defaultSupplier',
  'isCritical',
] as const satisfies readonly (keyof ItemFields)[];

export interface UpdateItemVars {
  /** El ítem tal como lo muestra la pantalla: la base de la edición. */
  item: InventoryItem;
  input: UpdateItemInput;
}

/** Arma la edición de un ítem contra su base. Un texto vacío no se manda (el
 * formulario lo omite): no se puede limpiar desde acá, así que "omitido" es "sin
 * cambio", no "borrar"; `categoryId: null` sí deja el ítem sin categoría. */
async function edicionDeItem({ item, input }: UpdateItemVars) {
  const edicion = await buildQueuedEdit<ItemFields>({
    entity: itemEntity(item.id),
    ops: ['item.update'],
    // El contenido por unidad puede venir sin el campo (respuesta anterior): nulo.
    base: pickFields(
      { ...item, contentPerUnit: item.contentPerUnit ?? null, contentUnit: item.contentUnit ?? null },
      CAMPOS_DE_ITEM,
    ),
    next: input,
    fields: CAMPOS_DE_ITEM,
  });
  if (!edicion.hayCambios) return null;
  return { params: { id: item.id }, body: edicion.cambios, expected: edicion.esperado };
}

export function useUpdateItem() {
  return useQueuedMutation<'item.update', UpdateItemVars>({
    endpoint: 'item.update',
    build: edicionDeItem,
    onSent: (data, { item }) => {
      toast.success('Ítem actualizado', { description: data?.name ?? item.name });
    },
    errorFallback: 'No se pudo actualizar el ítem.',
  });
}

export interface SaveItemWithMinimumsVars extends UpdateItemVars {
  /** Lo escrito en cada bodega (`branchId` → texto del campo). */
  minimums: Record<string, string>;
  /** El set de equipos que queda; omitido = no se toca. Solo se manda si cambió. */
  equipments?: CompatibilityEntry[];
}

interface SaveItemResult {
  huboCambios: boolean;
  guardadoEnCola: boolean;
  fallos: unknown[];
  conEquipos: boolean;
}

/**
 * Edita la ficha del ítem y los mínimos de cada bodega que cambiaron, con UN solo
 * aviso. No van en el mismo endpoint (la ficha es un PATCH; cada mínimo, un PUT
 * sobre la existencia de esa bodega), pero comparten la entidad `item`: el replay
 * manda los mínimos detrás de la edición, así que no hace falta encadenarlos a
 * mano. Si la edición falla, los mínimos ni se intentan; si falla un mínimo, la
 * ficha ya quedó guardada y el aviso lo dice.
 */
export function useSaveItemWithMinimums() {
  return useMutation<SaveItemResult, Error, SaveItemWithMinimumsVars>({
    mutationFn: async ({ item, input, minimums, equipments }) => {
      const edicion = await edicionDeItem({ item, input });
      const ficha = edicion ? await writeQueued('item.update', edicion) : null;
      const cambioEquipos = equipments !== undefined && !sameEquipments(equipments, toCompatibilityEntries(item));

      const cambiados = Object.entries(minimums).flatMap(([branchId, texto]) => {
        const nuevo = parseDecimal(texto);
        const actual = item.stocks.find((stock) => stock.branchId === branchId)?.minimumQuantity ?? 0;
        return nuevo != null && nuevo >= 0 && nuevo !== actual ? [{ branchId, minimumQuantity: nuevo }] : [];
      });
      const resultados = await Promise.allSettled([
        ...(cambioEquipos
          ? [writeQueued('itemCompatibility.save', { params: { id: item.id }, body: { entries: equipments } })]
          : []),
        ...cambiados.map((minimo) =>
          writeQueued('item.setMinimum', { params: {}, body: { itemId: item.id, ...minimo } }),
        ),
      ]);
      const fallos = resultados.flatMap((r) => (r.status === 'rejected' ? [r.reason as unknown] : []));
      const estados = [ficha, ...resultados.map((r) => (r.status === 'fulfilled' ? r.value : null))];
      return {
        huboCambios: ficha != null || cambiados.length > 0 || cambioEquipos,
        guardadoEnCola: estados.some((e) => e?.status === 'queued'),
        fallos,
        conEquipos: cambioEquipos,
      };
    },
    onSuccess: ({ huboCambios, guardadoEnCola, fallos, conEquipos }, { item }) => {
      if (fallos.length > 0) {
        toast.warning(`Ítem actualizado, pero no se guardó el stock mínimo${conEquipos ? ' o los equipos' : ''}`, {
          description: mensajeErrorFormulario(fallos[0], 'No se pudo actualizar el mínimo.'),
        });
      } else if (guardadoEnCola) {
        avisarGuardadoEnCola();
      } else if (huboCambios) {
        toast.success('Ítem actualizado', { description: item.name });
      }
    },
    onError: (error) => {
      toast.danger(mensajeErrorFormulario(error, 'No se pudo actualizar el ítem.'));
    },
  });
}

export interface SaveItemEquipmentsVars {
  item: InventoryItem;
  entries: CompatibilityEntry[];
}

/** Asignar o quitar equipos desde la ficha (reemplaza el set completo, idempotente). */
export function useSaveItemEquipments() {
  return useQueuedMutation<'itemCompatibility.save', SaveItemEquipmentsVars>({
    endpoint: 'itemCompatibility.save',
    build: ({ item, entries }) => ({ params: { id: item.id }, body: { entries } }),
    onSent: (_data, { item }) => {
      toast.success('Equipos actualizados', { description: item.name });
    },
    errorFallback: 'No se pudieron guardar los equipos del ítem.',
  });
}

/** Dar de baja o reactivar un ítem (sale o vuelve a listados y selectores; el kardex no cambia). */
export function useSetItemActive() {
  return useQueuedMutation<'item.setActive', { item: InventoryItem; isActive: boolean }>({
    endpoint: 'item.setActive',
    build: ({ item, isActive }) => ({ params: { id: item.id }, body: { isActive } }),
    onSent: (_data, { item, isActive }) => {
      toast.success(isActive ? 'Ítem reactivado' : 'Ítem dado de baja', { description: item.name });
    },
    errorFallback: 'No se pudo cambiar el estado del ítem.',
  });
}

export function useDeleteItem() {
  // El 409 del backend explica que tiene kardex y sugiere la baja lógica; ese
  // mensaje es más útil que cualquier texto genérico.
  return useQueuedDelete({
    endpoint: 'item.delete',
    sentMessage: 'Ítem eliminado',
    errorFallback: 'No se pudo eliminar el ítem.',
  });
}

/**
 * Entrada o salida manual. El aviso de mínimo se da **en el momento de la
 * acción**: si la salida deja la bodega en o bajo su umbral, el toast lo dice.
 * Esperar a que el usuario mire la fila pintada es tarde — ya se llevó el
 * material. Solo es posible si el servidor alcanzó a responder; encolado, no hay
 * un saldo resultante que mostrar.
 */
export function useCreateMovement() {
  return useQueuedCreate<'movement.create', { input: CreateMovementInput; item: InventoryItem }>({
    endpoint: 'movement.create',
    build: ({ input }, id) => ({ params: {}, body: { ...input, id } }),
    onSent: (movement, { item }) => {
      if (!movement) {
        toast.success('Movimiento registrado');
        return;
      }
      const symbol = UNIT_SYMBOLS[item.unit];
      const minimum =
        item.stocks.find((stock) => stock.branchId === movement.branchId)?.minimumQuantity ?? 0;

      if (minimum > 0 && movement.resultingBalance <= minimum) {
        toast.warning('Movimiento registrado · quedaste bajo el mínimo', {
          description: `Quedan ${movement.resultingBalance} ${symbol} y el mínimo de esta bodega es ${minimum}.`,
        });
        return;
      }

      toast.success('Movimiento registrado', {
        description: `Saldo en esta bodega: ${movement.resultingBalance} ${symbol}`,
      });
    },
    // El 409 por existencia insuficiente (`INSUFFICIENT_STOCK`) llega con su texto:
    // trae lo disponible, lo pedido y el stock de otras sucursales.
    errorFallback: 'No se pudo registrar el movimiento.',
  });
}

export interface AdjustStockVars {
  id: string;
  /** `expectedQuantity` = la existencia que se veía al empezar a contar. */
  input: AdjustStockInput;
}

export function useAdjustStock() {
  return useQueuedCreate<'item.adjust', AdjustStockVars>({
    endpoint: 'item.adjust',
    build: async ({ id, input }, movimientoId) => {
      // Lo que ya tengo guardado sin enviar mueve la existencia antes de que
      // llegue este conteo: se declara la que habrá, no la que se ve.
      const pendientes = await escriturasPendientes(itemEntity(id), [
        'movement.create',
        'stock.transfer',
        'item.adjust',
      ]);
      const expectedQuantity =
        input.expectedQuantity === undefined
          ? undefined
          : existenciaConPendientes(input.expectedQuantity, input.branchId, pendientes);
      return {
        params: { id },
        body: { ...input, ...(expectedQuantity === undefined ? {} : { expectedQuantity }), id: movimientoId },
      };
    },
    onSent: (result) => {
      // Dos resultados válidos: hubo diferencia, o el conteo coincidía.
      if (result?.movement) {
        toast.success('Existencia ajustada', {
          description: `${result.item.name}: saldo ahora en ${result.movement.resultingBalance}`,
        });
      } else {
        toast.info('El conteo coincide con la existencia registrada: no se movió nada.');
      }
    },
    errorFallback: 'No se pudo ajustar la existencia.',
    errorMessage: (error) =>
      error instanceof DomainError && error.code === 'STALE_UPDATE'
        ? 'Alguien movió el stock de este ítem mientras contabas. Revisá la existencia actual y volvé a contar.'
        : mensajeErrorFormulario(error, 'No se pudo ajustar la existencia.'),
  });
}

export function useTransferStock() {
  return useQueuedCreate<'stock.transfer', TransferStockBody>({
    endpoint: 'stock.transfer',
    build: (input, id) => ({ params: {}, body: { ...input, id } }),
    onSent: (result) => {
      toast.success(
        result
          ? `Traspaso registrado: de ${result.sourceBranchName} a ${result.destinationBranchName}`
          : 'Traspaso registrado',
      );
    },
    errorFallback: 'No se pudo registrar el traspaso.',
  });
}
