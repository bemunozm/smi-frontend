import { Label, ListBox, Select } from '@heroui/react';

import { useUsers } from '../../hooks/useUsers';
import { SIN_ASIGNAR } from '../../lib/equipment-assignment';
import { ROLES } from '../../types/roles';

/**
 * A cargo de quién está el equipo. En un pesado es el supervisor; un liviano
 * no lleva operador y se asigna a un supervisor o, a veces, a un mantenedor
 * (`PATCH /equipment/:id/assignment` admite los dos roles en livianos).
 */
export function ResponsableSelect({
  liviano,
  value,
  onChange,
}: {
  liviano: boolean;
  value: string;
  onChange: (id: string) => void;
}) {
  const { data: supervisores } = useUsers({ role: ROLES.SUPERVISOR });
  const { data: mantenedores } = useUsers({ role: ROLES.MANTENEDOR }, liviano);
  const opciones = [
    ...(supervisores ?? []).map((u) => ({ ...u, rol: 'Supervisor' })),
    ...(liviano ? (mantenedores ?? []) : []).map((u) => ({ ...u, rol: 'Mantenedor' })),
  ];

  return (
    <Select fullWidth value={value} onChange={(v) => v && onChange(String(v))}>
      <Label>{liviano ? 'Asignado a' : 'Supervisor a cargo'}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          <ListBox.Item id={SIN_ASIGNAR} textValue={liviano ? 'Sin asignar' : 'Sin supervisor asignado'}>
            {liviano ? 'Sin asignar' : 'Sin supervisor asignado'}
            <ListBox.ItemIndicator />
          </ListBox.Item>
          {opciones.map((u) => (
            <ListBox.Item key={u.id} id={u.id} textValue={u.name}>
              {u.name}
              {liviano ? <span className="text-(--muted)"> · {u.rol}</span> : null}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
