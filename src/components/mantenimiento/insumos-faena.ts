import { useMemo } from 'react';

import { useBranches } from '../../hooks/useBranches';
import { useItems } from '../../hooks/useInventory';
import type { Branch } from '../../types/branch';
import { UNIT_SYMBOLS, quantityAt, type InventoryItem } from '../../types/inventory';
import type { OpcionSelector } from '../terreno/ui';

/**
 * La bodega del taller (SIEMPRE la de faena) y las opciones del selector de
 * insumos: la distinción de Inventario como grupos Suministros/Repuestos, la
 * existencia en Faena como aviso y "sin stock" deshabilitado con su motivo.
 *
 * Fuente única — lo consumen "Finalizar tarea" (intervención) y el checklist
 * de la mantención preventiva, que descuentan stock con la misma regla.
 */
export function useInsumosFaena(): {
  faenaBranch: Branch | undefined;
  opcionesInsumo: OpcionSelector[];
} {
  const { data: items } = useItems({ isActive: true });
  const { data: branches } = useBranches({ isActive: true });

  const faenaBranch = useMemo(
    () => branches?.find((branch) => /faena/i.test(branch.name)),
    [branches],
  );

  const opcionesInsumo: OpcionSelector[] = useMemo(() => {
    const opcion = (item: InventoryItem, grupo: string): OpcionSelector => {
      const stock = faenaBranch ? quantityAt(item, faenaBranch.id) : null;
      const sinStock = stock !== null && stock <= 0;
      return {
        valor: item.id,
        titulo: item.sku,
        detalle: item.name,
        grupo,
        ...(sinStock
          ? { motivo: 'Sin stock en Faena' }
          : stock !== null
            ? { aviso: `${stock} ${UNIT_SYMBOLS[item.unit]} en Faena` }
            : {}),
      };
    };
    const lista = items ?? [];
    return [
      ...lista.filter((item) => item.type === 'SUPPLY').map((item) => opcion(item, 'Suministros')),
      ...lista.filter((item) => item.type === 'PART').map((item) => opcion(item, 'Repuestos')),
    ];
  }, [items, faenaBranch]);

  return { faenaBranch, opcionesInsumo };
}
