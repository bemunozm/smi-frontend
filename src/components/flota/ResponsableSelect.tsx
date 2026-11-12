import { Label, ListBox, Select } from '@heroui/react';
import { Header } from 'react-aria-components';

import { useUsers } from '../../hooks/useUsers';
import { SIN_ASIGNAR } from '../../lib/equipment-assignment';
import { ROLES } from '../../types/roles';

/**
 * A cargo de quién está el equipo. En un pesado es el supervisor; un liviano
 * no lleva operador y lo usa cualquiera que se mueva en faena: supervisor,
 * mantenedor, administrador o prevencionista (`PATCH /equipment/:id/assignment`
 * admite esos cuatro roles en livianos).
 *
 * La lista va separada por rol, con un título por grupo: con todos mezclados
 * no se distinguía quién era supervisor y quién mantenedor o administrador.
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
  const { data: administradores } = useUsers({ role: ROLES.ADMIN }, liviano);
  const { data: prevencionistas } = useUsers({ role: ROLES.PREVENCIONISTA }, liviano);

  // En un pesado solo el supervisor de la cuadrilla; el resto de los grupos
  // es solo para livianos. Un grupo sin personas no muestra su título.
  const grupos = [
    { titulo: 'Supervisores', rol: 'Supervisor', usuarios: supervisores ?? [] },
    ...(liviano
      ? [
          { titulo: 'Mantenedores', rol: 'Mantenedor', usuarios: mantenedores ?? [] },
          { titulo: 'Administración', rol: 'Administrador', usuarios: administradores ?? [] },
          { titulo: 'Prevención de riesgos', rol: 'Prevencionista', usuarios: prevencionistas ?? [] },
        ]
      : []),
  ].filter((g) => g.usuarios.length > 0);

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
          {grupos.map((g) => (
            <ListBox.Section key={g.titulo} id={g.titulo} className="mt-1.5 border-t border-border pt-1.5">
              <Header className="px-3 pt-1 pb-1 text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                {g.titulo}
              </Header>
              {g.usuarios.map((u) => (
                // El rol también va en la opción: el campo cerrado muestra la
                // opción elegida, y ahí ya no se ve el título del grupo.
                <ListBox.Item key={u.id} id={u.id} textValue={liviano ? `${u.name} · ${g.rol}` : u.name}>
                  {u.name}
                  {liviano ? <span className="text-muted-foreground"> · {g.rol}</span> : null}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox.Section>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
