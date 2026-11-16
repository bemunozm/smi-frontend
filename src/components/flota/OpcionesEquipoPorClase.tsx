import { Header, ListBox } from '@heroui/react';

import { gruposPorClase } from '../../lib/equipos-por-clase';
import type { EquipmentClass } from '../../types/equipment';

interface EquipoOpcion {
  id: string;
  internalCode: string;
  type?: string;
  equipmentClass?: EquipmentClass | null;
}

/**
 * Opciones de un `<Select>` de equipo con los pesados primero y después los
 * livianos, cada grupo con su título (pedido del cliente, 16/11/2026): cuando
 * el selector trae las dos clases se distinguen de un vistazo. Va dentro del
 * `<ListBox>` del `Select`.
 */
export function OpcionesEquipoPorClase({ equipos }: { equipos: readonly EquipoOpcion[] }) {
  return gruposPorClase(equipos).map((g, i) => (
    <ListBox.Section
      key={g.clase}
      id={g.clase}
      className={i > 0 ? 'mt-1.5 border-t border-border pt-1.5' : undefined}
    >
      <Header className="px-3 pt-1 pb-1 text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
        {g.titulo}
      </Header>
      {g.equipos.map((equipo) => (
        <ListBox.Item id={equipo.id} key={equipo.id} textValue={equipo.internalCode}>
          {equipo.internalCode}
          {equipo.type ? <span className="text-muted-foreground"> · {equipo.type}</span> : null}
          <ListBox.ItemIndicator />
        </ListBox.Item>
      ))}
    </ListBox.Section>
  ));
}
